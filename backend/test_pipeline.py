"""
Quick test — runs the full Notion ingestion pipeline.
Run with: python test_pipeline.py
Uses a hardcoded test company_id — replace with your own.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from app.ingestion.pipeline import IngestionPipeline

pipeline = IngestionPipeline()
summary = pipeline.run_notion(company_id="test-company-001")

print("\n✅ Ingestion complete!")
print(f"   Pages fetched:   {summary['pages_fetched']}")
print(f"   Chunks created:  {summary['chunks_created']}")
print(f"   Chunks stored:   {summary['chunks_stored']}")