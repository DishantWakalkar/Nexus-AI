import os
import uuid
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
import bcrypt
from app.security.jwt_auth import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("nexusai.api.auth")


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    company_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    company_id: str
    user_id: str
    email: str


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    client = get_client()

    # Check if user already exists
    existing = client.table("users").select("id").eq("email", request.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create company
    company_id = str(uuid.uuid4())
    client.table("companies").insert({
        "id": company_id,
        "name": request.company_name,
    }).execute()

    # Hash password
    password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()

    # Create user
    user_id = str(uuid.uuid4())
    client.table("users").insert({
        "id": user_id,
        "email": request.email,
        "password_hash": password_hash,
        "company_id": company_id,
    }).execute()

    token = create_access_token(user_id=user_id, company_id=company_id, email=request.email)

    return AuthResponse(
        access_token=token,
        company_id=company_id,
        user_id=user_id,
        email=request.email,
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    client = get_client()

    result = client.table("users").select("*").eq("email", request.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = result.data[0]
    if not bcrypt.checkpw(request.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        user_id=user["id"],
        company_id=user["company_id"],
        email=user["email"],
    )

    return AuthResponse(
        access_token=token,
        company_id=user["company_id"],
        user_id=user["id"],
        email=user["email"],
    )