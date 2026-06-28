import logging
from typing import Any, Optional, cast
from notion_client import Client, APIResponseError

from app.db import get_connection_row
from app.security.encryption import decrypt_token

logger = logging.getLogger("nexusai.connectors.notion")


class NotionConnector:
    def __init__(self, company_id: str):
        row = get_connection_row(company_id, "notion")
        if not row:
            raise ValueError(
                "Notion is not connected for this company. "
                "Go to /connections to connect it first."
            )
        self.client = Client(auth=decrypt_token(row["encrypted_access_token"]))

    def fetch_all_pages(self, company_id: str = "unknown") -> list[dict]:
        logger.info(f"Starting Notion fetch for company: {company_id}")
        results = []
        try:
            response = cast(dict[str, Any], self.client.search(
                filter={"property": "object", "value": "page"},
                page_size=100,
            ))
            pages = response.get("results", [])

            while response.get("has_more"):
                response = cast(dict[str, Any], self.client.search(
                    filter={"property": "object", "value": "page"},
                    start_cursor=response["next_cursor"],
                    page_size=100,
                ))
                pages.extend(response.get("results", []))

            logger.info(f"Found {len(pages)} pages in Notion")

            for page in pages:
                doc = self._extract_page(page)
                if doc and doc["content"].strip():
                    results.append(doc)

        except APIResponseError as e:
            logger.error(f"Notion API error: {e}")
            raise

        logger.info(f"Successfully extracted {len(results)} non-empty pages")
        return results

    def _extract_page(self, page: dict) -> Optional[dict]:
        try:
            page_id = page["id"]
            title = self._get_page_title(page)
            url = page.get("url", "")
            created_time = page.get("created_time", "")
            last_edited = page.get("last_edited_time", "")
            content = self._fetch_blocks_recursive(page_id)

            return {
                "doc_id": page_id,
                "source": "notion",
                "title": title,
                "url": url,
                "content": content,
                "created_at": created_time,
                "updated_at": last_edited,
                "owner_user_id": None,
                "restricted_user_ids": [],
                "metadata": {
                    "page_id": page_id,
                    "url": url,
                    "source": "notion",
                    "title": title,
                },
            }
        except Exception as e:
            logger.warning(f"Failed to extract page {page.get('id')}: {e}")
            return None

    def _get_page_title(self, page: dict) -> str:
        props = page.get("properties", {})
        for prop in props.values():
            if prop.get("type") == "title":
                title_parts = prop.get("title", [])
                return "".join(t.get("plain_text", "") for t in title_parts)
        return "Untitled"

    def _fetch_blocks_recursive(self, block_id: str, depth: int = 0) -> str:
        if depth > 5:
            return ""

        text_parts = []
        try:
            response = cast(dict[str, Any], self.client.blocks.children.list(
                block_id=block_id, page_size=100,
            ))
            blocks = response.get("results", [])

            while response.get("has_more"):
                response = cast(dict[str, Any], self.client.blocks.children.list(
                    block_id=block_id,
                    start_cursor=response["next_cursor"],
                    page_size=100,
                ))
                blocks.extend(response.get("results", []))

            for block in blocks:
                text = self._block_to_text(block)
                if text:
                    text_parts.append(text)
                if block.get("has_children"):
                    child_text = self._fetch_blocks_recursive(block["id"], depth + 1)
                    if child_text:
                        text_parts.append(child_text)

        except APIResponseError as e:
            logger.warning(f"Could not fetch blocks for {block_id}: {e}")

        return "\n".join(text_parts)

    def _block_to_text(self, block: dict) -> str:
        block_type = block.get("type", "")
        block_data = block.get(block_type, {})

        rich_text_types = {
            "paragraph", "heading_1", "heading_2", "heading_3",
            "bulleted_list_item", "numbered_list_item", "toggle",
            "quote", "callout", "code",
        }

        if block_type in rich_text_types:
            rich_text = block_data.get("rich_text", [])
            text = "".join(t.get("plain_text", "") for t in rich_text)
            if block_type in {"heading_1", "heading_2", "heading_3"}:
                return f"\n## {text}\n"
            return text

        if block_type == "to_do":
            rich_text = block_data.get("rich_text", [])
            text = "".join(t.get("plain_text", "") for t in rich_text)
            checked = "✓" if block_data.get("checked") else "○"
            return f"{checked} {text}"

        if block_type == "divider":
            return "\n---\n"

        if block_type == "table_row":
            cells = block_data.get("cells", [])
            return " | ".join(
                "".join(t.get("plain_text", "") for t in cell) for cell in cells
            )

        return ""
