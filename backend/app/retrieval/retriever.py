import logging
from app.retrieval.semantic_search import SemanticSearch
from app.retrieval.bm25_search import BM25Search

logger = logging.getLogger("nexusai.retrieval.retriever")


class HybridRetriever:
    """
    Combines semantic + BM25 search with weighted scoring,
    then applies MMR to remove redundant chunks before
    passing results to the LLM.

    Semantic catches meaning.
    BM25 catches exact terms - names, dates, product names.
    MMR ensures diversity - no 3 chunks saying the same thing.
    """

    def __init__(
        self,
        semantic_weight: float = 0.7,
        bm25_weight: float = 0.3,
        top_k: int = 8,
        mmr_lambda: float = 0.5,
    ):
        self.semantic = SemanticSearch()
        self.bm25 = BM25Search()
        self.semantic_weight = semantic_weight
        self.bm25_weight = bm25_weight
        self.top_k = top_k
        self.mmr_lambda = mmr_lambda  # 1.0 = pure relevance, 0.0 = pure diversity

    def retrieve(
        self,
        query: str,
        company_id: str,
        source_filter: str | None = None,
    ) -> list[dict]:
        """
        Main retrieval method. Returns top_k diverse, relevant chunks.
        """
        logger.info(f"Hybrid retrieval for query='{query[:60]}...' company={company_id}")

        # Step 1 - run both searches
        semantic_results = self.semantic.search(
            query, company_id, top_k=15, source_filter=source_filter
        )
        bm25_results = self.bm25.search(
            query, company_id, top_k=15, source_filter=source_filter
        )

        # Step 2 - merge and score
        merged = self._merge_results(semantic_results, bm25_results)

        # Step 3 - MMR reranking for diversity
        final = self._mmr_rerank(merged, query)

        logger.info(f"Retriever returning {len(final)} chunks after MMR")
        return final

    def _merge_results(
        self,
        semantic: list[dict],
        bm25: list[dict],
    ) -> list[dict]:
        """
        Merge semantic and BM25 results into a single ranked list.
        Normalise each score to 0-1, then combine with weights.
        """
        # Build score maps keyed by chunk id
        semantic_scores: dict[str, float] = {}
        for i, chunk in enumerate(semantic):
            # Use similarity score if available, else rank-based
            score = chunk.get("similarity", 1.0 - (i / len(semantic)))
            semantic_scores[chunk["id"]] = score

        bm25_scores: dict[str, float] = {}
        if bm25:
            max_bm25 = max(c["bm25_score"] for c in bm25)
            for chunk in bm25:
                # Normalise to 0-1
                norm_score = chunk["bm25_score"] / max_bm25 if max_bm25 > 0 else 0
                bm25_scores[chunk["id"]] = norm_score

        # Combine all unique chunks
        all_chunks: dict[str, dict] = {}
        for chunk in semantic + bm25:
            chunk_id = chunk["id"]
            if chunk_id not in all_chunks:
                all_chunks[chunk_id] = chunk

        # Calculate combined score
        scored_chunks = []
        for chunk_id, chunk in all_chunks.items():
            sem_score = semantic_scores.get(chunk_id, 0.0)
            bm25_score = bm25_scores.get(chunk_id, 0.0)
            combined = (
                self.semantic_weight * sem_score +
                self.bm25_weight * bm25_score
            )
            scored_chunks.append({
                **chunk,
                "combined_score": combined,
                "semantic_score": sem_score,
                "bm25_score": bm25_scores.get(chunk_id, 0.0),
            })

        # Sort by combined score
        scored_chunks.sort(key=lambda x: x["combined_score"], reverse=True)
        return scored_chunks

    def _mmr_rerank(self, chunks: list[dict], query: str) -> list[dict]:
        """
        Maximal Marginal Relevance - selects chunks that are
        relevant to the query BUT different from each other.
        Prevents the LLM getting 3 chunks all saying the same thing.

        mmr_lambda=1.0 → pure relevance (no diversity)
        mmr_lambda=0.0 → pure diversity (ignores relevance)
        mmr_lambda=0.5 → balanced (our default)
        """
        if not chunks:
            return []

        if len(chunks) <= self.top_k:
            return chunks

        selected = []
        remaining = chunks.copy()

        while len(selected) < self.top_k and remaining:
            if not selected:
                # First pick - highest combined score
                best = remaining[0]
            else:
                # Score each remaining chunk:
                # MMR = lambda * relevance - (1-lambda) * max_similarity_to_selected
                best = None
                best_score = float("-inf")

                for candidate in remaining:
                    relevance = candidate["combined_score"]

                    # Estimate similarity to already-selected chunks
                    # using content overlap (simple but effective)
                    max_sim = max(
                        self._content_overlap(candidate["content"], s["content"])
                        for s in selected
                    )

                    mmr_score = (
                        self.mmr_lambda * relevance -
                        (1 - self.mmr_lambda) * max_sim
                    )

                    if mmr_score > best_score:
                        best_score = mmr_score
                        best = candidate

            if best is not None:
                selected.append(best)
                remaining.remove(best)

        return selected

    def _content_overlap(self, text_a: str, text_b: str) -> float:
        """
        Simple word overlap ratio as a proxy for content similarity.
        Fast alternative to running another embedding comparison.
        """
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union)  # Jaccard similarity