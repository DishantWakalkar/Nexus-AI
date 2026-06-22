import os
import io
import pickle
import logging
from typing import Optional
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.auth.transport.requests import Request

logger = logging.getLogger("nexusai.connectors.google_drive")

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
TOKEN_PATH = "google_token.pickle"

# Google Docs export as plain text via this MIME type
EXPORT_MIME = "text/plain"


class GoogleDriveConnector:
    def __init__(self):
        self.creds = self._load_credentials()
        self.service = build("drive", "v3", credentials=self.creds)

    def _load_credentials(self):
        if not os.path.exists(TOKEN_PATH):
            raise ValueError(
                "google_token.pickle not found. "
                "Run scripts/google_auth_setup.py first."
            )
        with open(TOKEN_PATH, "rb") as f:
            creds = pickle.load(f)

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, "wb") as f:
                pickle.dump(creds, f)

        return creds

    def fetch_all_documents(self, company_id: str = "unknown") -> list[dict]:
        """
        Fetch all Google Docs the authorized user has access to.
        Exports each as plain text.
        """
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
        """
        List Google Docs only within the configured folder.
        Scopes indexing to a specific knowledge base folder
        instead of the entire Drive — critical when the user's
        Drive contains large amounts of unrelated personal data.
        """
        folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")
        if not folder_id:
            raise ValueError(
                "GOOGLE_DRIVE_FOLDER_ID not set. "
                "Create a dedicated folder and set its ID in .env "
                "to scope indexing instead of scanning the entire Drive."
            )

        files = []
        page_token = None

        while True:
            response = self.service.files().list(
                q=(
                    f"'{folder_id}' in parents "
                    "and mimeType='application/vnd.google-apps.document' "
                    "and trashed=false"
                ),
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
        """Export a single Google Doc as plain text."""
        file_id = file["id"]
        title = file.get("name", "Untitled")

        try:
            request = self.service.files().export_media(
                fileId=file_id, mimeType=EXPORT_MIME
            )
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