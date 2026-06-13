from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.middleware.auth_middleware import SecurityMiddleware

load_dotenv()

app = FastAPI(
    title="NexusAI",
    description="Company Knowledge Agent — RAG + Agentic AI over Notion, Drive, Slack, Gmail",
    version="0.1.0",
    # Disable docs in production
    docs_url="/docs" if __import__("os").getenv("APP_ENV") == "development" else None,
    redoc_url=None,
)

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-vercel-app.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NexusAI"}