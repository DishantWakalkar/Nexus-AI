import logging
from rank_bm25 import BM25Okapi
import os
from supabase import create_client, Client

logger = logging.getLogger("nexusai.retrieval.bm25")


class BM25Search:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("Supabase credentials not set")
        self.client: Client = create_client(url, key)

    def search(
        self,
        query: str,
        company_id: str,
        top_k: int = 10,
        source_filter: str | None = None,
    ) -> list[dict]:
        """
        Keyword-based BM25 search over all chunks for a company.
        Catches exact terms, names, dates, product names that
        semantic search might miss.
        Always scoped to company_id.
        """
        # Fetch all chunks for this company from Supabase
        # BM25 runs in-memory over them
        try:
            query_builder = (
                self.client.table("chunks")
                .select("id, doc_id, company_id, source, title, content, chunk_index, metadata")
                .eq("company_id", company_id)
            )
            if source_filter:
                query_builder = query_builder.eq("source", source_filter)

            result = query_builder.execute()
            all_chunks = result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch chunks for BM25: {e}")
            raise

        if not all_chunks:
            logger.warning(f"No chunks found for company={company_id}")
            return []

        # Tokenise — simple whitespace + lowercase
        tokenised_corpus = [
            chunk["content"].lower().split()
            for chunk in all_chunks
        ]

        # Build BM25 index
        bm25 = BM25Okapi(tokenised_corpus)

        # Score query against all chunks
        tokenised_query = query.lower().split()
        scores = bm25.get_scores(tokenised_query)

        # Pair chunks with scores and sort
        scored = sorted(
            zip(all_chunks, scores),
            key=lambda x: x[1],
            reverse=True
        )

        # Return top_k with score attached
        results = []
        for chunk, score in scored[:top_k]:
            if score > 0:  # Skip zero-score chunks
                results.append({
                    **chunk,
                    "bm25_score": float(score),
                })

        logger.info(
            f"BM25 search returned {len(results)} chunks "
            f"for company={company_id}"
        )
        return results