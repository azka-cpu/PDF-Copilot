from fastapi import APIRouter, Depends, HTTPException

from app.services.supabase_client import supabase
from app.auth import get_current_user_id

router = APIRouter()


@router.get("/documents")
async def list_documents(user_id: str = Depends(get_current_user_id)):
    """List all PDFs the current user has uploaded."""
    result = (
        supabase.table("documents")
        .select("id, filename, page_count, summary, status, error_message, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/documents/{document_id}/status")
async def get_document_status(document_id: str, user_id: str = Depends(get_current_user_id)):
    """Poll this while a document is 'processing' to know when it's ready to chat with."""
    doc = (
        supabase.table("documents")
        .select("status, error_message, page_count")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.data


@router.get("/documents/{document_id}/file-url")
async def get_file_url(document_id: str, user_id: str = Depends(get_current_user_id)):
    """Returns a short-lived signed URL so the frontend can preview/embed the PDF."""
    doc = (
        supabase.table("documents")
        .select("storage_path")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    signed = supabase.storage.from_("pdfs").create_signed_url(
        doc.data["storage_path"], expires_in=3600
    )
    return {"url": signed["signedURL"]}


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a document, its chunks, messages, and the stored PDF file."""
    doc = (
        supabase.table("documents")
        .select("id, storage_path")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove the raw file from storage
    supabase.storage.from_("pdfs").remove([doc.data["storage_path"]])

    # chunks/messages cascade-delete via foreign key "on delete cascade"
    supabase.table("documents").delete().eq("id", document_id).execute()

    return {"deleted": True, "document_id": document_id}
