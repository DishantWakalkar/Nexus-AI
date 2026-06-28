import os
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.db import get_supabase, get_connection_row
from app.security.encryption import encrypt_token, decrypt_token

logger = logging.getLogger("nexusai.connectors.google_drive")

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
EXPORT_MIME = "text/plain"


class GoogleDriveConnector:
    def __init__(self, company_id: str):
        self.company_id = company_id
        row = get_connection_row(company_id, "google_drive")
        if not row:
            raise ValueError(
                "Google Drive is not connected for this company. "
                "Go to /connections to connect it first."
            )

        self.folder_id: Optional[str] = row["metadata"].get("folder_id")
        access_token = decrypt_token(row["encrypted_access_token"])
        refresh_token = (
            decrypt_token(row["encrypted_refresh_token"])
            if row.get("encrypted_refresh_token")
            else None
        )

        expires_at_str: str = row["metadata"].get("expires_at", "")
        expiry: Optional[datetime] = None
        if expires_at_str:
            try:
                dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                expiry = dt.astimezone(timezone.utc).replace(tzinfo=None)
            except ValueError:
                pass

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.environ["GOOGLE_CLIENT_ID"],
            client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
            scopes=SCOPES,
        )
        creds.expiry = expiry

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            self._store_refreshed_token(creds, row["metadata"])

        self.service = build("drive", "v3", credentials=creds)

    def _store_refreshed_token(self, creds: Credentials, current_metadata: dict) -> None:
        if not creds.token:
            return
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=3600)).isoformat()
        metadata = {**current_metadata, "expires_at": expires_at}
        get_supabase().table("company_connections").update(
            {
                "encrypted_access_token": encrypt_token(creds.token),
                "metadata": metadata,
            }
        ).eq("company_id", self.company_id).eq("source", "google_drive").execute()

    def fetch_all_documents(self, company_id: str = "unknown") -> list[dict]:
        """Fetch all Google Docs in the configured folder, exported as plain text."""
        logger.info(f"Starting Google Drive fetch for company: {company_id}")
        results = []

        try:
            files = self._list_docs()
            logger.info(f"Found {len(files)} Google Docs")

            for file in files:
                doc = self._extract_doc(file)
                if doc and doc["content"].strip():
                    results.append(doc)

        except Exception as e:
            logger.error(f"Google Drive API error: {e}")
            raise

        logger.info(f"Successfully extracted {len(results)} non-empty docs")
        return results

    def _list_docs(self) -> list[dict]:
        if self.folder_id:
            q = (
                f"'{self.folder_id}' in parents "
                "and mimeType='application/vnd.google-apps.document' "
                "and trashed=false"
            )
        else:
            # No folder scoping — index all Google Docs in the Drive
            q = "mimeType='application/vnd.google-apps.document' and trashed=false"

        files = []
        page_token = None

        while True:
            response = self.service.files().list(
                q=q,
                pageSize=100,
                fields="nextPageToken, files(id, name, webViewLink, modifiedTime, createdTime)",
                pageToken=page_token,
            ).execute()

            files.extend(response.get("files", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return files

    def _extract_doc(self, file: dict) -> Optional[dict]:
        file_id = file["id"]
        title = file.get("name", "Untitled")

        try:
            request = self.service.files().export_media(fileId=file_id, mimeType=EXPORT_MIME)
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()

            content = buffer.getvalue().decode("utf-8")

            return {
                "doc_id": f"gdrive_{file_id}",
                "source": "google_drive",
                "title": title,
                "url": file.get("webViewLink", ""),
                "content": content,
                "created_at": file.get("createdTime", ""),
                "updated_at": file.get("modifiedTime", ""),
                "owner_user_id": None,
                "restricted_user_ids": [],
                "metadata": {
                    "file_id": file_id,
                    "url": file.get("webViewLink", ""),
                    "source": "google_drive",
                    "title": title,
                },
            }
        except Exception as e:
            logger.warning(f"Failed to extract doc {title}: {e}")
            return None
