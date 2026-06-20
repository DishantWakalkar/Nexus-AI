from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.agent.answer import AnswerEngine
from app.security.jwt_auth import CurrentUser, TokenPayload
import logging

router = APIRouter(prefix="/api", tags=["ask"])
logger = logging.getLogger("nexusai.api.ask")


class AskRequest(BaseModel):
    query: str
    source_filter: str | None = None  # optional: "notion" | "google_drive" | "slack" | "gmail"


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
    chunks_used: int


@router.post("/ask", response_model=AskResponse)
async def ask(
    request: AskRequest,
    current_user: TokenPayload = CurrentUser,
):
    """
    Ask NexusAI a question. Answer is grounded only in the
    authenticated user's company documents, scoped by their
    JWT's company_id, and filtered by their access permissions.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        engine = AnswerEngine()
        result = engine.ask(
            query=request.query,
            company_id=current_user.company_id,
            user_id=current_user.sub,
            source_filter=request.source_filter,
        )
        return AskResponse(**result)
    except Exception as e:
        logger.error(f"Ask failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate answer")