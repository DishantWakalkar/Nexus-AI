import logging
from app.connectors.notion import NotionConnector
from app.connectors.slack import SlackConnector
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
        """
        Full pipeline: fetch Notion pages → chunk → embed → store.
        Returns a summary of what was ingested.
        """
        logger.info(f"Starting Notion ingestion for company: {company_id}")

        # Step 1 — fetch pages
        connector = NotionConnector()
        pages = connector.fetch_all_pages(company_id=company_id)
        logger.info(f"Fetched {len(pages)} pages")

        # Step 2 — chunk
        all_chunks = []
        for page in pages:
            chunks = self.chunker.chunk_document(page)
            all_chunks.extend(chunks)
        logger.info(f"Created {len(all_chunks)} chunks from {len(pages)} pages")

        # Step 3 — embed
        records = self.embedder.embed_chunks(all_chunks)

        # Step 4 — store
        inserted = self.vector_store.upsert_chunks(records, company_id)

        summary = {
            "pages_fetched": len(pages),
            "chunks_created": len(all_chunks),
            "chunks_stored": inserted,
            "company_id": company_id,
        }
        logger.info(f"Ingestion complete: {summary}")
        return summary
    
    def run_slack(self, company_id: str) -> dict:
        """
        Full pipeline: fetch Slack channels → chunk → embed → store.
        """
        logger.info(f"Starting Slack ingestion for company: {company_id}")

        connector = SlackConnector()
        channels = connector.fetch_all_messages(company_id=company_id)
        logger.info(f"Fetched {len(channels)} channels")

        all_chunks = []
        for doc in channels:
            chunks = self.chunker.chunk_document(doc)
            all_chunks.extend(chunks)
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