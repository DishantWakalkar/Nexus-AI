import os
import logging
from dotenv import load_dotenv
load_dotenv()
hf_token = os.environ.get("HF_TOKEN")
if hf_token:
    os.environ["HUGGINGFACE_HUB_TOKEN"] = hf_token
    
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client

logger = logging.getLogger("nexusai.retrieval.semantic")

MODEL_NAME = "all-MiniLM-L6-v2"


class SemanticSearch:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("Supabase credentials not set")
        self.client: Client = create_client(url, key)
        logger.info("Loading embedding model for search...")
        self.model = SentenceTransformer(MODEL_NAME)
        logger.info("Semantic search ready")

    def search(
        self,
        query: str,
        company_id: str,
        top_k: int = 10,
        source_filter: str | None = None,
    ) -> list[dict]:
        """
        Embed the query and find the most semantically similar chunks
        in pgvector using cosine distance.
        Always scoped to company_id — cross-company access is impossible.
        """
        # Embed the query using the same model as ingestion
        query_embedding = self.model.encode(
            query,
            normalize_embeddings=True
        ).tolist()

        # Call Supabase RPC for vector similarity search
        params = {
            "query_embedding": query_embedding,
            "company_id_filter": company_id,
            "match_count": top_k,
        }
        if source_filter:
            params["source_filter"] = source_filter

        try:
            result = self.client.rpc(
                "match_chunks",
                params
            ).execute()
            chunks = result.data or []
            logger.info(
                f"Semantic search returned {len(chunks)} chunks "
                f"for company={company_id}"
            )
            return chunks
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            raise