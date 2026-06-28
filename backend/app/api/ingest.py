import logging
from fastapi import APIRouter, HTTPException

from app.db import get_supabase
from app.ingestion.pipeline import IngestionPipeline
from app.security.jwt_auth import CurrentUser, TokenPayload

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])
logger = logging.getLogger("nexusai.api.ingest")

_SOURCE_LABELS = {
    "notion": "Notion",
    "slack": "Slack",
    "google_drive": "Google Drive",
}


def _require_connection(company_id: str, source: str) -> None:
    result = (
        get_supabase()
        .table("company_connections")
        .select("id")
        .eq("company_id", company_id)
        .eq("source", source)
        .execute()
    )
    if not result.data:
        label = _SOURCE_LABELS.get(source, source)
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} is not connected. "
                "Go to /connections to connect it first."
            ),
        )


@router.post("/notion")
async def ingest_notion(current_user: TokenPayload = CurrentUser):
    _require_connection(current_user.company_id, "notion")
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_notion(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Notion ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slack")
async def ingest_slack(current_user: TokenPayload = CurrentUser):
    _require_connection(current_user.company_id, "slack")
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_slack(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Slack ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/google-drive")
async def ingest_google_drive(current_user: TokenPayload = CurrentUser):
    _require_connection(current_user.company_id, "google_drive")
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_google_drive(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Drive ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
