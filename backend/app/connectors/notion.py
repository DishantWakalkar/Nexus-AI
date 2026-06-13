import os
from typing import Any, Optional, cast
from notion_client import Client
from notion_client import APIResponseError
import logging

logger = logging.getLogger("nexusai.connectors.notion")


class NotionConnector:
    def __init__(self):
        api_key = os.environ.get("NOTION_API_KEY")
        if not api_key:
            raise ValueError("NOTION_API_KEY not set in environment")
        self.client = Client(auth=api_key)

    def fetch_all_pages(self, company_id: str = "unknown") -> list[dict]:
        logger.info(f"Starting Notion fetch for company: {company_id}")
        """
        Fetch all pages the integration has access to.
        Returns a list of clean document dicts ready for chunking.
        """
        results = []
        try:
            # Search for all pages accessible to this integration
            response = cast(dict[str, Any], self.client.search(
                filter={"property": "object", "value": "page"},
                page_size=100
            ))
            pages = response.get("results", [])

            # Handle pagination
            while response.get("has_more"):
                response = cast(dict[str, Any], self.client.search(
                    filter={"property": "object", "value": "page"},
                    start_cursor=response["next_cursor"],
                    page_size=100
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
        """Extract metadata and full text content from a single page."""
        try:
            page_id = page["id"]
            title = self._get_page_title(page)
            url = page.get("url", "")
            created_time = page.get("created_time", "")
            last_edited = page.get("last_edited_time", "")

            # Fetch all blocks (the actual content)
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
                }
            }
        except Exception as e:
            logger.warning(f"Failed to extract page {page.get('id')}: {e}")
            return None

    def _get_page_title(self, page: dict) -> str:
        """Extract title from page properties."""
        props = page.get("properties", {})
        for prop in props.values():
            if prop.get("type") == "title":
                title_parts = prop.get("title", [])
                return "".join(t.get("plain_text", "") for t in title_parts)
        return "Untitled"

    def _fetch_blocks_recursive(self, block_id: str, depth: int = 0) -> str:
        """
        Recursively fetch all blocks and convert to plain text.
        Handles nested blocks (toggles, callouts, bulleted lists etc.)
        Max depth 5 to avoid infinite loops on circular references.
        """
        if depth > 5:
            return ""

        text_parts = []
        try:
            response = self.client.blocks.children.list(
                block_id=block_id,
                page_size=100
            )
            response = cast(dict[str, Any], response)
            blocks = response.get("results", [])

            while response.get("has_more"):
                response = cast(dict[str, Any], self.client.blocks.children.list(
                    block_id=block_id,
                    start_cursor=response["next_cursor"],
                    page_size=100
                ))
                blocks.extend(response.get("results", []))

            for block in blocks:
                text = self._block_to_text(block)
                if text:
                    text_parts.append(text)

                # Recurse into children if block has them
                if block.get("has_children"):
                    child_text = self._fetch_blocks_recursive(
                        block["id"], depth + 1
                    )
                    if child_text:
                        text_parts.append(child_text)

        except APIResponseError as e:
            logger.warning(f"Could not fetch blocks for {block_id}: {e}")

        return "\n".join(text_parts)

    def _block_to_text(self, block: dict) -> str:
        """Convert a single Notion block to plain text."""
        block_type = block.get("type", "")
        block_data = block.get(block_type, {})

        # Blocks that have rich_text
        rich_text_types = {
            "paragraph", "heading_1", "heading_2", "heading_3",
            "bulleted_list_item", "numbered_list_item", "toggle",
            "quote", "callout", "code"
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
                "".join(t.get("plain_text", "") for t in cell)
                for cell in cells
            )

        # Unsupported block type — skip silently
        return ""