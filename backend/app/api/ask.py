from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.agent.graph import NexusAgent
from app.security.jwt_auth import CurrentUser, TokenPayload
import logging

router = APIRouter(prefix="/api", tags=["ask"])
logger = logging.getLogger("nexusai.api.ask")

# Singleton - avoid reloading the embedding model on every request
_agent_instance: Optional[NexusAgent] = None


def get_agent() -> NexusAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = NexusAgent()
    return _agent_instance


class AskRequest(BaseModel):
    query: str
    source_filter: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
    chunks_used: int
    needs_clarification: bool


@router.post("/ask", response_model=AskResponse)
async def ask(
    request: AskRequest,
    current_user: TokenPayload = CurrentUser,
):
    """
    Ask NexusAI a question. Runs through the LangGraph agent -
    classifies ambiguity, retrieves with retry logic, generates
    a cited answer scoped to the user's company and permissions.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        agent = get_agent()
        result = agent.run(
            query=request.query,
            company_id=current_user.company_id,
            user_id=current_user.sub,
            source_filter=request.source_filter,
        )
        return AskResponse(**result)
    except Exception as e:
        logger.error(f"Agent ask failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate answer")