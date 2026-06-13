import logging
from sentence_transformers import SentenceTransformer
from app.ingestion.chunker import Chunk

logger = logging.getLogger("nexusai.ingestion.embedder")

# all-MiniLM-L6-v2 — fast, 384 dimensions, great for semantic search
# Downloads once (~90MB), cached locally after first run
MODEL_NAME = "all-MiniLM-L6-v2"


class Embedder:
    def __init__(self):
        logger.info(f"Loading embedding model: {MODEL_NAME}")
        self.model = SentenceTransformer(MODEL_NAME)
        logger.info("Embedding model loaded")

    def embed_chunks(self, chunks: list[Chunk]) -> list[dict]:
        """
        Embed a list of chunks and return dicts ready for Supabase insertion.
        Batches embeddings for efficiency.
        """
        if not chunks:
            return []

        texts = [chunk.content for chunk in chunks]

        logger.info(f"Embedding {len(texts)} chunks...")
        embeddings = self.model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True  # Normalise for cosine similarity
        )
        logger.info("Embedding complete")

        records = []
        for chunk, embedding in zip(chunks, embeddings):
            records.append({
                "doc_id": chunk.doc_id,
                "source": chunk.source,
                "title": chunk.title or "Untitled",
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "embedding": embedding.tolist(),
                "metadata": chunk.metadata,
                "company_id": "",
                "owner_user_id": None,
                "restricted_user_ids": [],
            })

        return records