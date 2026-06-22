from fastapi import APIRouter, HTTPException
from app.ingestion.pipeline import IngestionPipeline
from app.security.jwt_auth import CurrentUser, TokenPayload
import logging

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])
logger = logging.getLogger("nexusai.api.ingest")


@router.post("/notion")
async def ingest_notion(current_user: TokenPayload = CurrentUser):
    """
    Trigger Notion ingestion for the authenticated user's company.
    JWT token provides the company_id — no user input needed.
    """
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_notion(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/slack")
async def ingest_slack(current_user: TokenPayload = CurrentUser):
    """
    Trigger Slack ingestion for the authenticated user's company.
    """
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_slack(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error(f"Slack ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/google-drive")
async def ingest_google_drive(current_user: TokenPayload = CurrentUser):
    """
    Trigger Google Drive ingestion for the authenticated user's company.
    """
    try:
        pipeline = IngestionPipeline()
        summary = pipeline.run_google_drive(company_id=current_user.company_id)
        return {"success": True, "summary": summary}
    except Exception as e:
        logger.error(f"Google Drive ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))