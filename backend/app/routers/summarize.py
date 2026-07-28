from fastapi import APIRouter, Depends, HTTPException
from groq import Groq

from app.config import settings
from app.services.supabase_client import supabase
from app.auth import get_current_user_id

router = APIRouter()
client = Groq(api_key=settings.groq_api_key)
MODEL = "openai/gpt-oss-120b"

SUMMARY_PROMPT = """You are summarizing a document for someone who hasn't read it.
Write a clear, well-organized summary covering the main points, in a few short paragraphs
or bullet points. Base it only on the text provided."""

# Groq's context window limits how much raw text we can send in one go
MAX_CHARS = 40000


@router.post("/documents/{document_id}/summarize")
async def summarize_document(document_id: str, user_id: str = Depends(get_current_user_id)):
    doc = (
        supabase.table("documents")
        .select("id, summary")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Return cached summary if we already generated one
    if doc.data.get("summary"):
        return {"summary": doc.data["summary"], "cached": True}

    chunks = (
        supabase.table("chunks")
        .select("content, chunk_index")
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    if not chunks.data:
        raise HTTPException(status_code=404, detail="No content found for this document")

    full_text = "\n\n".join(c["content"] for c in chunks.data)[:MAX_CHARS]

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": full_text},
        ],
        temperature=0.3,
        max_tokens=1024,
    )
    summary = completion.choices[0].message.content

    # Cache it on the document row so we don't regenerate every time
    supabase.table("documents").update({"summary": summary}).eq("id", document_id).execute()

    return {"summary": summary, "cached": False}