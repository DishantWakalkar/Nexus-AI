import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required but not set.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

bearer_scheme = HTTPBearer()


class TokenPayload(BaseModel):
    sub: str          # user_id
    company_id: str   # THE isolation key - every query is scoped to this
    email: str
    exp: datetime


def create_access_token(user_id: str, company_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "company_id": company_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
    try:
        raw = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**raw)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token."
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    """FastAPI dependency - inject into any route that needs auth."""
    return decode_access_token(credentials.credentials)


# Shorthand alias used in routes
CurrentUser = Depends(get_current_user)