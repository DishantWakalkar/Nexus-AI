import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import RedirectResponse

from app.db import get_supabase
from app.security.jwt_auth import (
    CurrentUser,
    TokenPayload,
    decode_access_token,
    SECRET_KEY,
    ALGORITHM,
)
from app.security.encryption import encrypt_token, decrypt_token  # noqa: F401 (decrypt used in connectors)

router = APIRouter(prefix="/api/connections", tags=["connections"])
logger = logging.getLogger("nexusai.api.connections")

_VALID_SOURCES = {"notion", "slack", "google_drive"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:5173")


def _api_base_url() -> str:
    return os.environ.get("API_BASE_URL", "http://localhost:8000")


def _create_oauth_state(company_id: str, user_id: str, extra: dict | None = None) -> str:
    payload = {
        "company_id": company_id,
        "user_id": user_id,
        "nonce": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        **(extra or {}),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_oauth_state(state: str) -> dict:
    try:
        return jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "OAuth state expired. Please try connecting again.")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Invalid OAuth state. Possible CSRF attempt — aborting.")


def _upsert_connection(
    company_id: str,
    user_id: str,
    source: str,
    access_token: str,
    refresh_token: Optional[str],
    metadata: dict,
) -> None:
    get_supabase().table("company_connections").upsert(
        {
            "company_id": company_id,
            "source": source,
            "encrypted_access_token": encrypt_token(access_token),
            "encrypted_refresh_token": encrypt_token(refresh_token) if refresh_token else None,
            "metadata": metadata,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "connected_by_user_id": user_id,
        },
        on_conflict="company_id,source",
    ).execute()


# ── Status endpoint ───────────────────────────────────────────────────────────

@router.get("")
async def list_connections(current_user: TokenPayload = CurrentUser):
    """Return connection status for all three sources for the caller's company."""
    rows = (
        get_supabase()
        .table("company_connections")
        .select("source, connected_at, metadata")
        .eq("company_id", current_user.company_id)
        .execute()
    )
    connected = {row["source"]: row for row in rows.data}
    return [
        {
            "source": src,
            "connected": src in connected,
            "connected_at": connected[src]["connected_at"] if src in connected else None,
            "metadata": connected[src]["metadata"] if src in connected else {},
        }
        for src in ["notion", "slack", "google_drive"]
    ]


# ── Disconnect endpoint ───────────────────────────────────────────────────────

@router.delete("/{source}")
async def disconnect_source(
    source: str = Path(...),
    current_user: TokenPayload = CurrentUser,
):
    if source not in _VALID_SOURCES:
        raise HTTPException(400, f"Unknown source '{source}'. Must be one of: {', '.join(_VALID_SOURCES)}")
    get_supabase().table("company_connections").delete().eq(
        "company_id", current_user.company_id
    ).eq("source", source).execute()
    return {"disconnected": source}


# ── Notion OAuth ──────────────────────────────────────────────────────────────

@router.get("/notion/start")
async def notion_start(token: str = Query(...)):
    """Begin Notion OAuth. Called via browser navigation with JWT as query param."""
    payload = decode_access_token(token)

    client_id = os.environ.get("NOTION_CLIENT_ID")
    if not client_id:
        raise HTTPException(500, "NOTION_CLIENT_ID is not configured on the server.")

    redirect_uri = f"{_api_base_url()}/api/connections/notion/callback"
    state = _create_oauth_state(payload.company_id, payload.sub)

    url = (
        "https://api.notion.com/v1/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&owner=user"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/notion/callback")
async def notion_callback(code: str = Query(...), state: str = Query(...)):
    state_data = _decode_oauth_state(state)
    company_id = state_data["company_id"]
    user_id = state_data["user_id"]

    redirect_uri = f"{_api_base_url()}/api/connections/notion/callback"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.notion.com/v1/oauth/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            auth=(os.environ["NOTION_CLIENT_ID"], os.environ["NOTION_CLIENT_SECRET"]),
            headers={"Content-Type": "application/json"},
        )

    if resp.status_code != 200:
        logger.error("Notion token exchange failed: status=%d", resp.status_code)
        return RedirectResponse(f"{_frontend_url()}/connections?notion=error")

    data = resp.json()
    _upsert_connection(
        company_id=company_id,
        user_id=user_id,
        source="notion",
        access_token=data["access_token"],
        refresh_token=None,
        metadata={
            "workspace_name": data.get("workspace_name", ""),
            "workspace_id": data.get("workspace_id", ""),
            "bot_id": data.get("bot_id", ""),
        },
    )

    return RedirectResponse(f"{_frontend_url()}/connections?notion=success")


# ── Slack OAuth ───────────────────────────────────────────────────────────────

_SLACK_SCOPES = (
    "channels:history,channels:read,groups:history,groups:read,"
    "im:history,mpim:history,users:read"
)


@router.get("/slack/start")
async def slack_start(token: str = Query(...)):
    payload = decode_access_token(token)

    client_id = os.environ.get("SLACK_CLIENT_ID")
    if not client_id:
        raise HTTPException(500, "SLACK_CLIENT_ID is not configured on the server.")

    redirect_uri = f"{_api_base_url()}/api/connections/slack/callback"
    state = _create_oauth_state(payload.company_id, payload.sub)

    url = (
        "https://slack.com/oauth/v2/authorize"
        f"?client_id={client_id}"
        f"&scope={_SLACK_SCOPES}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/slack/callback")
async def slack_callback(code: str = Query(...), state: str = Query(...)):
    state_data = _decode_oauth_state(state)
    company_id = state_data["company_id"]
    user_id = state_data["user_id"]

    redirect_uri = f"{_api_base_url()}/api/connections/slack/callback"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": os.environ["SLACK_CLIENT_ID"],
                "client_secret": os.environ["SLACK_CLIENT_SECRET"],
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )

    data = resp.json()
    if not data.get("ok"):
        logger.error("Slack token exchange failed: %s", data.get("error"))
        return RedirectResponse(f"{_frontend_url()}/connections?slack=error")

    _upsert_connection(
        company_id=company_id,
        user_id=user_id,
        source="slack",
        access_token=data["access_token"],
        refresh_token=None,
        metadata={
            "team_name": data.get("team", {}).get("name", ""),
            "team_id": data.get("team", {}).get("id", ""),
        },
    )

    return RedirectResponse(f"{_frontend_url()}/connections?slack=success")


# ── Google Drive OAuth ────────────────────────────────────────────────────────

@router.get("/google-drive/start")
async def google_drive_start(
    token: str = Query(...),
    folder_id: Optional[str] = Query(None),
):
    payload = decode_access_token(token)

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(500, "GOOGLE_CLIENT_ID is not configured on the server.")

    redirect_uri = f"{_api_base_url()}/api/connections/google-drive/callback"
    extra = {"folder_id": folder_id} if folder_id else {}
    state = _create_oauth_state(payload.company_id, payload.sub, extra=extra)

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=https://www.googleapis.com/auth/drive.readonly"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/google-drive/callback")
async def google_drive_callback(code: str = Query(...), state: str = Query(...)):
    state_data = _decode_oauth_state(state)
    company_id = state_data["company_id"]
    user_id = state_data["user_id"]
    folder_id = state_data.get("folder_id")

    redirect_uri = f"{_api_base_url()}/api/connections/google-drive/callback"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if resp.status_code != 200:
        logger.error("Google token exchange failed: status=%d", resp.status_code)
        return RedirectResponse(f"{_frontend_url()}/connections?google_drive=error")

    data = resp.json()
    expires_in = data.get("expires_in", 3600)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    metadata: dict = {"expires_at": expires_at}
    if folder_id:
        metadata["folder_id"] = folder_id

    _upsert_connection(
        company_id=company_id,
        user_id=user_id,
        source="google_drive",
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        metadata=metadata,
    )

    return RedirectResponse(f"{_frontend_url()}/connections?google_drive=success")
