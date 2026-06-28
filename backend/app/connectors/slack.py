import time
import logging
from datetime import datetime, timezone
from typing import Optional
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.db import get_connection_row
from app.security.encryption import decrypt_token

logger = logging.getLogger("nexusai.connectors.slack")


class SlackConnector:
    def __init__(self, company_id: str):
        row = get_connection_row(company_id, "slack")
        if not row:
            raise ValueError(
                "Slack is not connected for this company. "
                "Go to /connections to connect it first."
            )
        self.client = WebClient(token=decrypt_token(row["encrypted_access_token"]))

    def fetch_all_messages(self, company_id: str = "unknown") -> list[dict]:
        """
        Fetch messages from all channels the bot has been invited to.
        Returns one document per channel with all messages concatenated.
        """
        logger.info(f"Starting Slack fetch for company: {company_id}")
        results = []

        try:
            channels = self._list_channels()
            logger.info(f"Bot is in {len(channels)} channels")

            for channel in channels:
                doc = self._fetch_channel_messages(channel)
                if doc and doc["content"].strip():
                    results.append(doc)

        except SlackApiError as e:
            logger.error(f"Slack API error: {e.response['error']}")
            raise

        logger.info(f"Successfully extracted {len(results)} non-empty channels")
        return results

    def _list_channels(self) -> list[dict]:
        channels = []
        cursor = None

        while True:
            response = self.client.conversations_list(
                types="public_channel,private_channel",
                limit=200,
                cursor=cursor,
            )
            for channel in response["channels"]:
                if channel.get("is_member"):
                    channels.append(channel)

            cursor = response.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

        return channels

    def _fetch_channel_messages(self, channel: dict) -> Optional[dict]:
        channel_id = channel["id"]
        channel_name = channel.get("name", "unknown")

        try:
            messages = []
            cursor = None

            while True:
                response = self.client.conversations_history(
                    channel=channel_id,
                    limit=200,
                    cursor=cursor,
                )
                messages.extend(response["messages"])

                cursor = response.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break

                time.sleep(0.3)

            messages.sort(key=lambda m: float(m.get("ts", 0)))

            content = self._format_messages(messages)
            last_ts = max((float(m.get("ts", 0)) for m in messages), default=0)
            last_updated = datetime.fromtimestamp(last_ts, tz=timezone.utc).isoformat()

            return {
                "doc_id": f"slack_{channel_id}",
                "source": "slack",
                "title": f"#{channel_name}",
                "url": f"https://slack.com/app_redirect?channel={channel_id}",
                "content": content,
                "created_at": "",
                "updated_at": last_updated,
                "owner_user_id": None,
                "restricted_user_ids": [],
                "metadata": {
                    "channel_id": channel_id,
                    "channel_name": channel_name,
                    "source": "slack",
                    "title": f"#{channel_name}",
                    "url": f"https://slack.com/app_redirect?channel={channel_id}",
                },
            }

        except SlackApiError as e:
            logger.warning(f"Could not fetch messages for #{channel_name}: {e.response['error']}")
            return None

    def _format_messages(self, messages: list[dict]) -> str:
        lines = []
        for msg in messages:
            if msg.get("subtype") in {
                "channel_join", "channel_leave", "channel_topic",
                "channel_purpose", "channel_name", "bot_message",
            }:
                continue

            text = msg.get("text", "").strip()
            if not text:
                continue

            user = msg.get("user", "unknown")
            ts = msg.get("ts", "0")
            try:
                dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
                date_str = dt.strftime("%Y-%m-%d %H:%M")
            except (ValueError, TypeError):
                date_str = ""

            lines.append(f"[{date_str}] user_{user}: {text}")

        return "\n".join(lines)
