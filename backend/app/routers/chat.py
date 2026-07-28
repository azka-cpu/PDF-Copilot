
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.embeddings import embed_query
from app.services.llm import generate_answer, generate_answer_stream, generate_web_answer
from app.services.web_search import search_web
from app.services.supabase_client import supabase
from app.auth import get_current_user_id
from app.services.rate_limit import enforce_question_limit

router = APIRouter()


class ChatRequest(BaseModel):
    document_id: str
    question: str
    match_count: int = 5


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    found_in_document: bool
    user_message_id: str | None = None
    assistant_message_id: str | None = None


class WebChatRequest(BaseModel):
    question: str
    document_id: str | None = None  # optional, so web messages can still be saved to a doc's history


class WebChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    assistant_message_id: str | None = None


class MultiChatRequest(BaseModel):
    document_ids: list[str]
    question: str
    match_count: int = 8


class MultiChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    found_in_document: bool


def _save_message(document_id: str, user_id: str, role: str, content: str,
                   is_web_answer: bool = False, sources: list | None = None) -> str:
    result = supabase.table("messages").insert({
        "document_id": document_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "is_web_answer": is_web_answer,
        "sources": sources or [],
    }).execute()
    return result.data[0]["id"]


@router.get("/documents/{document_id}/messages")
async def get_messages(document_id: str, user_id: str = Depends(get_current_user_id)):
    """Load saved chat history for a document."""
    result = (
        supabase.table("messages")
        .select("id, role, content, is_web_answer, sources, created_at")
        .eq("document_id", document_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data


@router.delete("/documents/{document_id}/messages")
async def clear_chat(document_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete the entire conversation history for a document."""
    supabase.table("messages").delete().eq("document_id", document_id).eq(
        "user_id", user_id
    ).execute()
    return {"cleared": True, "document_id": document_id}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a single chat message."""
    supabase.table("messages").delete().eq("id", message_id).eq(
        "user_id", user_id
    ).execute()
    return {"deleted": True, "message_id": message_id}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    enforce_question_limit(user_id)
    user_msg_id = _save_message(req.document_id, user_id, "user", req.question)

    query_embedding = await embed_query(req.question)

    result = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_document_id": req.document_id,
            "match_count": req.match_count,
        },
    ).execute()

    matches = result.data
    if not matches:
        answer = "I couldn't find an answer to that in the PDF. Want me to search the web instead?"
        assistant_msg_id = _save_message(req.document_id, user_id, "assistant", answer)
        return ChatResponse(
            answer=answer, sources=[], found_in_document=False,
            user_message_id=user_msg_id, assistant_message_id=assistant_msg_id,
        )

    context_chunks = [m["content"] for m in matches]
    answer, found = generate_answer(req.question, context_chunks)

    sources = [
        {
            "chunk_index": m["chunk_index"],
            "page_number": m.get("page_number"),
            "similarity": round(m["similarity"], 3),
        }
        for m in matches
    ] if found else []

    assistant_msg_id = _save_message(req.document_id, user_id, "assistant", answer, sources=sources)

    return ChatResponse(
        answer=answer, sources=sources, found_in_document=found,
        user_message_id=user_msg_id, assistant_message_id=assistant_msg_id,
    )


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    """
    Same as /chat but streams the answer as Server-Sent Events, so the UI can
    show tokens as they're generated instead of waiting for the full response.

    Each SSE line is a JSON object:
      {"type": "chunk", "text": "..."}                         - a piece of the answer
      {"type": "done", "found_in_document": bool, "sources": [...],
       "user_message_id": str, "assistant_message_id": str}    - final event
      {"type": "error", "detail": "..."}                       - on failure
    """
    enforce_question_limit(user_id)
    user_msg_id = _save_message(req.document_id, user_id, "user", req.question)

    query_embedding = await embed_query(req.question)

    result = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_document_id": req.document_id,
            "match_count": req.match_count,
        },
    ).execute()
    matches = result.data

    def event_stream():
        if not matches:
            answer = "I couldn't find an answer to that in the PDF. Want me to search the web instead?"
            assistant_msg_id = _save_message(req.document_id, user_id, "assistant", answer)
            yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'found_in_document': False, 'sources': [], 'user_message_id': user_msg_id, 'assistant_message_id': assistant_msg_id})}\n\n"
            return

        context_chunks = [m["content"] for m in matches]
        try:
            for event in generate_answer_stream(req.question, context_chunks):
                if event["type"] == "chunk":
                    yield f"data: {json.dumps({'type': 'chunk', 'text': event['text']})}\n\n"
                elif event["type"] == "done":
                    found = event["found_in_document"]
                    full_text = event["full_text"]
                    sources = [
                        {
                            "chunk_index": m["chunk_index"],
                            "page_number": m.get("page_number"),
                            "similarity": round(m["similarity"], 3),
                        }
                        for m in matches
                    ] if found else []
                    assistant_msg_id = _save_message(
                        req.document_id, user_id, "assistant", full_text, sources=sources
                    )
                    yield f"data: {json.dumps({'type': 'done', 'found_in_document': found, 'sources': sources, 'user_message_id': user_msg_id, 'assistant_message_id': assistant_msg_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)[:300]})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat/web", response_model=WebChatResponse)
async def chat_web(req: WebChatRequest, user_id: str = Depends(get_current_user_id)):
    """Fallback endpoint: answer a question using live web search instead of the PDF."""
    enforce_question_limit(user_id)
    try:
        results = await search_web(req.question)
    except Exception:
        raise HTTPException(
            status_code=502, detail="Web search failed. Check your Serper API key/config."
        )

    if not results:
        raise HTTPException(status_code=404, detail="No web results found for that question")

    answer = generate_web_answer(req.question, results)
    sources = [{"title": r["title"], "url": r["url"]} for r in results]

    assistant_msg_id = None
    if req.document_id:
        assistant_msg_id = _save_message(
            req.document_id, user_id, "assistant", answer, is_web_answer=True, sources=sources
        )

    return WebChatResponse(answer=answer, sources=sources, assistant_message_id=assistant_msg_id)


@router.post("/chat/multi", response_model=MultiChatResponse)
async def chat_multi(req: MultiChatRequest, user_id: str = Depends(get_current_user_id)):
    """
    Ask a question across MULTIPLE PDFs at once. Retrieves the top matching
    chunks from any of the given documents (verifying the user owns all of
    them first) and answers using that combined context.
    """
    enforce_question_limit(user_id)

    if not req.document_ids:
        raise HTTPException(status_code=400, detail="Select at least one document")

    # Verify ownership of every requested document before searching across them
    owned = (
        supabase.table("documents")
        .select("id")
        .eq("user_id", user_id)
        .in_("id", req.document_ids)
        .execute()
    )
    owned_ids = {d["id"] for d in owned.data}
    if owned_ids != set(req.document_ids):
        raise HTTPException(status_code=403, detail="You don't have access to one or more of these documents")

    query_embedding = await embed_query(req.question)

    result = supabase.rpc(
        "match_chunks_multi",
        {
            "query_embedding": query_embedding,
            "match_document_ids": req.document_ids,
            "match_count": req.match_count,
        },
    ).execute()

    matches = result.data
    if not matches:
        return MultiChatResponse(
            answer="I couldn't find an answer to that across the selected PDFs.",
            sources=[],
            found_in_document=False,
        )

    # Map document_id -> filename for readable source citations
    doc_names = {d["id"]: None for d in owned.data}
    docs_full = (
        supabase.table("documents").select("id, filename").in_("id", req.document_ids).execute()
    )
    for d in docs_full.data:
        doc_names[d["id"]] = d["filename"]

    context_chunks = [m["content"] for m in matches]
    answer, found = generate_answer(req.question, context_chunks)

    sources = [
        {
            "document_id": m["document_id"],
            "filename": doc_names.get(m["document_id"]),
            "page_number": m.get("page_number"),
            "similarity": round(m["similarity"], 3),
        }
        for m in matches
    ] if found else []

    return MultiChatResponse(answer=answer, sources=sources, found_in_document=found)
