import logging
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("nexusai.access")

# Routes that don't require auth
PUBLIC_ROUTES = {"/api/health", "/api/auth/login", "/api/auth/register", "/docs", "/openapi.json"}

# Fields that must NEVER appear in logs
SENSITIVE_FIELDS = {"content", "text", "query", "answer", "chunks", "password", "token"}


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        # Log only safe metadata - never request/response body
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,          # path only, no query params (may contain tokens)
                "status": response.status_code,
                "duration_ms": duration_ms,
                # company_id from header if present - never user content
                "company_id": request.headers.get("X-Company-ID", "unknown"),
            }
        )
        return response