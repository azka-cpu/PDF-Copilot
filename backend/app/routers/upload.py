import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks

from app.services.pdf_parser import extract_pages, chunk_pages
from app.services.embeddings import embed_texts
from app.services.supabase_client import supabase
from app.auth import get_current_user_id
from app.services.rate_limit import enforce_upload_limit

router = APIRouter()


def _process_pdf_in_background(document_id: str, pdf_bytes: bytes, filename: str):
    """
    Runs after the upload response has already been sent (FastAPI BackgroundTasks).
    Does the actual extraction/OCR/embedding work, then marks the document ready
    or failed. This keeps the upload endpoint fast even for large PDFs.
    """
    try:
        pages = extract_pages(pdf_bytes)
        if not any(p["text"] for p in pages):
            raise ValueError("No extractable text found in PDF")

        page_chunks = chunk_pages(pages)
        if not page_chunks:
            raise ValueError("Could not chunk document text")

        texts = [c["text"] for c in page_chunks]
        # embed_texts is async; run it via asyncio since this runs in a plain thread
        import asyncio
        embeddings = asyncio.run(embed_texts(texts, task="retrieval.passage"))

        rows = [
            {
                "document_id": document_id,
                "content": chunk["text"],
                "chunk_index": idx,
                "page_number": chunk["page_number"],
                "embedding": embedding,
            }
            for idx, (chunk, embedding) in enumerate(zip(page_chunks, embeddings))
        ]
        supabase.table("chunks").insert(rows).execute()

        supabase.table("documents").update(
            {"status": "ready", "page_count": len(pages)}
        ).eq("id", document_id).execute()

    except Exception as e:
        supabase.table("documents").update(
            {"status": "failed", "error_message": str(e)[:500]}
        ).eq("id", document_id).execute()


@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    enforce_upload_limit(user_id)

    pdf_bytes = await file.read()

    # Upload raw PDF to Supabase Storage right away
    document_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{document_id}/{file.filename}"
    supabase.storage.from_("pdfs").upload(
        storage_path, pdf_bytes, {"content-type": "application/pdf"}
    )

    # Create the document row immediately with status='processing' -
    # the heavy extraction/OCR/embedding work happens after this returns
    supabase.table("documents").insert(
        {
            "id": document_id,
            "user_id": user_id,
            "filename": file.filename,
            "storage_path": storage_path,
            "status": "processing",
        }
    ).execute()

    background_tasks.add_task(_process_pdf_in_background, document_id, pdf_bytes, file.filename)

    return {
        "document_id": document_id,
        "filename": file.filename,
        "status": "processing",
    }
