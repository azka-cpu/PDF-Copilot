from fastapi import Header, HTTPException
from app.services.supabase_client import supabase


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Extracts and verifies the Supabase JWT sent as 'Authorization: Bearer <token>'
    from the frontend (Supabase Auth session). Returns the user's id.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user_response.user.id
