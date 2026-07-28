from fastapi import HTTPException
from app.services.supabase_client import supabase
from app.config import settings


def check_and_increment(user_id: str, kind: str, limit: int):
    """
    Atomically increments today's usage counter for a user and raises 429
    if it would exceed the daily limit. kind is 'upload_count' or 'question_count'.

    Uses a Postgres RPC (increment_usage) so the check-and-increment is atomic
    even under concurrent requests, rather than a read-then-write race in Python.
    """
    result = supabase.rpc(
        "increment_usage", {"p_user_id": user_id, "p_kind": kind}
    ).execute()

    new_count = result.data
    if new_count is not None and new_count > limit:
        kind_label = "uploads" if kind == "upload_count" else "questions"
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {limit} {kind_label} reached. Try again tomorrow.",
        )


def enforce_upload_limit(user_id: str):
    check_and_increment(user_id, "upload_count", settings.daily_upload_limit)


def enforce_question_limit(user_id: str):
    check_and_increment(user_id, "question_count", settings.daily_question_limit)
