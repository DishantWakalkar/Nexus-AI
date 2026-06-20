from dotenv import load_dotenv
load_dotenv()

from app.agent.graph import NexusAgent

agent = NexusAgent()

print("=== TEST 1: Clear question ===")
result = agent.run(
    query="What problem does NexusAI solve?",
    company_id="b99ca620-e7c4-4899-8570-15d3afb26b4c",  # your real company_id
    user_id="test_user_1",
)
print("Answer:", result["answer"])
print("Chunks used:", result["chunks_used"])
print("Needs clarification:", result["needs_clarification"])
print()

print("=== TEST 2: Ambiguous question ===")
result = agent.run(
    query="What about it?",
    company_id="b99ca620-e7c4-4899-8570-15d3afb26b4c",
    user_id="test_user_1",
)
print("Answer:", result["answer"])
print("Needs clarification:", result["needs_clarification"])