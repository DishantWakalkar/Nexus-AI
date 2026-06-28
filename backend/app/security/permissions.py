from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SourceType(str, Enum):
    NOTION = "notion"
    GOOGLE_DRIVE = "google_drive"
    SLACK = "slack"
    GMAIL = "gmail"


@dataclass
class DocumentPermission:
    doc_id: str
    source: SourceType
    company_id: str
    owner_user_id: Optional[str]       # None = accessible to whole company
    restricted_user_ids: list[str]     # Empty = no restrictions


def can_user_access_document(
    user_id: str,
    company_id: str,
    permission: DocumentPermission,
) -> bool:
    """
    Rules:
    1. Document must belong to the same company - hard block.
    2. If restricted_user_ids is set, user must be in it.
    3. Otherwise, any company member can access.
    """
    # Rule 1 - company isolation is absolute
    if permission.company_id != company_id:
        return False

    # Rule 2 - restricted document
    if permission.restricted_user_ids:
        return user_id in permission.restricted_user_ids

    # Rule 3 - open to whole company
    return True


def filter_chunks_by_permission(
    chunks: list[dict],
    user_id: str,
    company_id: str,
) -> list[dict]:
    """
    Filter retrieved chunks to only those the user has access to.
    Called after every retrieval - before anything is passed to the LLM.
    """
    accessible = []
    for chunk in chunks:
        perm = DocumentPermission(
            doc_id=chunk["doc_id"],
            source=chunk["source"],
            company_id=chunk["company_id"],
            owner_user_id=chunk.get("owner_user_id"),
            restricted_user_ids=chunk.get("restricted_user_ids", []),
        )
        if can_user_access_document(user_id, company_id, perm):
            accessible.append(chunk)
    return accessible