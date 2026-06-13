import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger("nexusai.ingestion.vector_store")


class VectorStore:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        self.client: Client = create_client(url, key)

    def upsert_chunks(self, records: list[dict], company_id: str) -> int:
        if not records:
            return 0

        for record in records:
            record["company_id"] = company_id

        doc_ids = list({r["doc_id"] for r in records})

        # Step 1 — upsert document metadata into `documents` table
        doc_records = []
        for r in records:
            # Only insert once per doc_id (first chunk carries the metadata)
            if r["chunk_index"] == 0:
                doc_records.append({
                    "company_id": company_id,
                    "source": r["source"],
                    "doc_id": r["doc_id"],
                    "title": r.get("title", "Untitled"),
                    "url": r["metadata"].get("url", ""),
                    "owner_user_id": r.get("owner_user_id"),
                    "restricted_user_ids": r.get("restricted_user_ids", []),
                })

        if doc_records:
            self.client.table("documents").upsert(
                doc_records, on_conflict="company_id,source,doc_id"
            ).execute()

        # Step 2 — delete old chunks for these docs before re-inserting
        self.client.table("chunks").delete().in_(
            "doc_id", doc_ids
        ).eq("company_id", company_id).execute()

        # Step 3 — insert chunks in batches of 100
        inserted = 0
        batch_size = 100
        chunk_records = [{
            "company_id": r["company_id"],
            "source": r["source"],
            "doc_id": r["doc_id"],
            "title": r.get("title", "Untitled"),
            "content": r["content"],
            "embedding": r["embedding"],
            "chunk_index": r["chunk_index"],
            "metadata": r["metadata"],
        } for r in records]

        for i in range(0, len(chunk_records), batch_size):
            batch = chunk_records[i:i + batch_size]
            self.client.table("chunks").insert(batch).execute()
            inserted += len(batch)
            logger.info(f"Inserted batch {i//batch_size + 1} — {inserted} chunks total")

        return inserted

    def delete_company_docs(self, company_id: str, source: Optional[str] = None) -> None:
        """Delete all documents for a company, optionally filtered by source."""
        query = self.client.table("documents").delete().eq(
            "company_id", company_id
        )
        if source is not None:
            query = query.eq("source", source)
        query.execute()
        logger.info(f"Deleted docs for company {company_id}" + (f" source={source}" if source else ""))