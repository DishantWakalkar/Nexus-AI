from dotenv import load_dotenv
load_dotenv()

from app.retrieval.retriever import HybridRetriever

retriever = HybridRetriever()
results = retriever.retrieve(
    query="test page",
    company_id="test_company_1"
)

print(f"Retrieved {len(results)} chunks\n")
for r in results:
    source = r["source"]
    title = r["title"]
    score = r["combined_score"]
    content = r["content"][:100]
    print(f"  [{source}] {title} | score: {score:.3f}")
    print(f"  {content}...")
    print()