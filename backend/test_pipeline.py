from dotenv import load_dotenv
load_dotenv()

from app.agent.answer import AnswerEngine

engine = AnswerEngine()

result = engine.ask(
    query="What problem does NexusAI solve?",
    company_id="test_company_1",
    user_id="test_user_1",
)

print("ANSWER:")
print(result["answer"])
print()
print(f"CHUNKS USED: {result['chunks_used']}")
print()
print("SOURCES:")
for s in result["sources"]:
    print(f"  [{s['source_number']}] {s['title']} — {s['source']} — {s['url']}")