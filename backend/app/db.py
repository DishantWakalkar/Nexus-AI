import os
from supabase import create_client, Client


def get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


def get_connection_row(company_id: str, source: str) -> dict | None:
    result = (
        get_supabase()
        .table("company_connections")
        .select("*")
        .eq("company_id", company_id)
        .eq("source", source)
        .execute()
    )
    return result.data[0] if result.data else None
