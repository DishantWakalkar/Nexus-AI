import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.middleware.auth_middleware import SecurityMiddleware
from app.api.ask import router as ask_router
from app.api.auth import router as auth_router
from app.api.connections import router as connections_router
from app.api.ingest import router as ingest_router

app = FastAPI(
    title="NexusAI",
    description="Company Knowledge Agent - RAG + Agentic AI over Notion, Drive, Slack, Gmail",
    version="0.1.0",
    docs_url="/docs" if os.getenv("APP_ENV") == "development" else None,
    redoc_url=None,
)

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-vercel-app.vercel.app",
    ],
    allow_origin_regex=r"http://localhost:\d+",  # any localhost port in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask_router)
app.include_router(auth_router)
app.include_router(connections_router)
app.include_router(ingest_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NexusAI"}