from groq import Groq
from app.config import settings

client = Groq(api_key=settings.groq_api_key)
MODEL = "llama-3.3-70b-versatile"

NOT_FOUND_MARKER = "NOT_FOUND_IN_DOCUMENT"

SYSTEM_PROMPT = f"""You are a helpful assistant answering questions about a PDF document.
Use ONLY the provided context chunks to answer.
If the answer is not present in the context, respond with EXACTLY this marker and nothing else: {NOT_FOUND_MARKER}
Do not guess or use outside knowledge. Keep answers concise and cite which part of the context you used when helpful."""

WEB_SYSTEM_PROMPT = """You are a helpful assistant. Answer the user's question using ONLY the
provided web search results as context. Keep the answer concise and mention it's based on
web results, not the uploaded document."""


def generate_answer(question: str, context_chunks: list[str]) -> tuple[str, bool]:
    """
    Returns (answer, found_in_document).
    found_in_document is False when the model couldn't answer from the given chunks.
    """
    context = "\n\n---\n\n".join(context_chunks)

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context from the document:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.2,
        max_tokens=1024,
    )

    answer = completion.choices[0].message.content.strip()

    if NOT_FOUND_MARKER in answer:
        return (
            "I couldn't find an answer to that in the PDF. Want me to search the web instead?",
            False,
        )

    return answer, True


NOT_FOUND_FALLBACK = "I couldn't find an answer to that in the PDF. Want me to search the web instead?"


def generate_answer_stream(question: str, context_chunks: list[str]):
    """
    Streams the answer token-by-token as it's generated.
    Yields dicts: {"type": "chunk", "text": str} while streaming,
    then a final {"type": "done", "found_in_document": bool, "full_text": str}.

    Buffers the first chunk of output before streaming live, since the model
    may open with the NOT_FOUND marker - in that case we swap in the friendly
    fallback message instead of streaming the raw marker to the user.
    """
    context = "\n\n---\n\n".join(context_chunks)

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context from the document:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.2,
        max_tokens=1024,
        stream=True,
    )

    buffer = ""
    decided = False
    full_text = ""
    marker_len = len(NOT_FOUND_MARKER)

    for event in stream:
        delta = event.choices[0].delta.content or ""
        if not delta:
            continue

        if not decided:
            buffer += delta
            full_text += delta
            # Wait until we have enough characters to confidently compare, or the stream ends
            if len(buffer) < marker_len:
                continue
            decided = True
            if buffer.strip().startswith(NOT_FOUND_MARKER):
                yield {"type": "done", "found_in_document": False, "full_text": NOT_FOUND_FALLBACK}
                return
            else:
                yield {"type": "chunk", "text": buffer}
        else:
            full_text += delta
            yield {"type": "chunk", "text": delta}

    if not decided:
        # Stream ended before we hit marker_len chars - decide now with what we have
        full_text = buffer
        if buffer.strip() == NOT_FOUND_MARKER or NOT_FOUND_MARKER in buffer:
            yield {"type": "done", "found_in_document": False, "full_text": NOT_FOUND_FALLBACK}
            return
        yield {"type": "chunk", "text": buffer}

    yield {"type": "done", "found_in_document": True, "full_text": full_text}


def generate_web_answer(question: str, search_results: list[dict]) -> str:
    """Answer a question using web search results as context (fallback path)."""
    context = "\n\n---\n\n".join(
        f"{r['title']}\n{r['url']}\n{r['content']}" for r in search_results
    )

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": WEB_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Web search results:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.3,
        max_tokens=1024,
    )

    return completion.choices[0].message.content
