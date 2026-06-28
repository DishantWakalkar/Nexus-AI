import logging
from app.connectors.notion import NotionConnector
from app.connectors.slack import SlackConnector
from app.connectors.google_drive import GoogleDriveConnector
from app.ingestion.chunker import RecursiveChunker
from app.ingestion.embedder import Embedder
from app.ingestion.vector_store import VectorStore

logger = logging.getLogger("nexusai.ingestion.pipeline")


class IngestionPipeline:
    def __init__(self):
        self.chunker = RecursiveChunker(chunk_size=512, chunk_overlap=64)
        self.embedder = Embedder()
        self.vector_store = VectorStore()

    def run_notion(self, company_id: str) -> dict:
        logger.info(f"Starting Notion ingestion for company: {company_id}")

        connector = NotionConnector(company_id=company_id)
        pages = connector.fetch_all_pages(company_id=company_id)
        logger.info(f"Fetched {len(pages)} pages")

        all_chunks = []
        for page in pages:
            all_chunks.extend(self.chunker.chunk_document(page))
        logger.info(f"Created {len(all_chunks)} chunks from {len(pages)} pages")

        records = self.embedder.embed_chunks(all_chunks)
        inserted = self.vector_store.upsert_chunks(records, company_id)

        summary = {
            "pages_fetched": len(pages),
            "chunks_created": len(all_chunks),
            "chunks_stored": inserted,
            "company_id": company_id,
        }
        logger.info(f"Notion ingestion complete: {summary}")
        return summary

    def run_slack(self, company_id: str) -> dict:
        logger.info(f"Starting Slack ingestion for company: {company_id}")

        connector = SlackConnector(company_id=company_id)
        channels = connector.fetch_all_messages(company_id=company_id)
        logger.info(f"Fetched {len(channels)} channels")

        all_chunks = []
        for doc in channels:
            all_chunks.extend(self.chunker.chunk_document(doc))
        logger.info(f"Created {len(all_chunks)} chunks from {len(channels)} channels")

        records = self.embedder.embed_chunks(all_chunks)
        inserted = self.vector_store.upsert_chunks(records, company_id)

        summary = {
            "channels_fetched": len(channels),
            "chunks_created": len(all_chunks),
            "chunks_stored": inserted,
            "company_id": company_id,
        }
        logger.info(f"Slack ingestion complete: {summary}")
        return summary

    def run_google_drive(self, company_id: str) -> dict:
        logger.info(f"Starting Google Drive ingestion for company: {company_id}")

        connector = GoogleDriveConnector(company_id=company_id)
        docs = connector.fetch_all_documents(company_id=company_id)
        logger.info(f"Fetched {len(docs)} documents")

        all_chunks = []
        for doc in docs:
            all_chunks.extend(self.chunker.chunk_document(doc))
        logger.info(f"Created {len(all_chunks)} chunks from {len(docs)} documents")

        records = self.embedder.embed_chunks(all_chunks)
        inserted = self.vector_store.upsert_chunks(records, company_id)

        summary = {
            "docs_fetched": len(docs),
            "chunks_created": len(all_chunks),
            "chunks_stored": inserted,
            "company_id": company_id,
        }
        logger.info(f"Google Drive ingestion complete: {summary}")
        return summary
