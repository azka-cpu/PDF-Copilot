import io
import base64
import pypdfium2 as pdfium
from groq import Groq

from app.config import settings

client = Groq(api_key=settings.groq_api_key)

OCR_PROMPT = (
    "Extract all text from this image exactly as it appears, preserving reading order. "
    "Return only the extracted text, no commentary. If there is no readable text, return nothing."
)


def _ocr_page_with_groq(png_bytes: bytes) -> str:
    """Send a rendered page image to Groq's vision model to read out its text."""
    b64_image = base64.b64encode(png_bytes).decode("utf-8")

    completion = client.chat.completions.create(
        model="llama-3.2-90b-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_image}"},
                    },
                ],
            }
        ],
        temperature=0,
        max_tokens=2048,
    )
    return completion.choices[0].message.content.strip()


def extract_pages(pdf_bytes: bytes) -> list[dict]:
    """
    Extract text page by page using pypdfium2 (lightweight, serverless-friendly
    alternative to PyMuPDF). If a page has no extractable text (likely a
    scanned/image page), fall back to Groq's vision model to read the page image.
    Returns a list of {page_number, text} (1-indexed pages).
    """
    pdf = pdfium.PdfDocument(pdf_bytes)
    pages = []

    try:
        for i in range(len(pdf)):
            page = pdf[i]
            textpage = page.get_textpage()
            text = textpage.get_text_range().strip()
            textpage.close()

            if not text:
                # Scanned page fallback: render to image and OCR via Groq vision.
                # scale=200/72 gives ~200 DPI, a good balance of OCR accuracy vs payload size.
                bitmap = page.render(scale=200 / 72)
                pil_image = bitmap.to_pil()
                buf = io.BytesIO()
                pil_image.save(buf, format="PNG")
                text = _ocr_page_with_groq(buf.getvalue())
                bitmap.close()

            pages.append({"page_number": i + 1, "text": text})
            page.close()
    finally:
        pdf.close()

    return pages


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """
    Split text into overlapping chunks by character count.
    Overlap keeps context from being cut off mid-idea at chunk boundaries.
    """
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def chunk_pages(pages: list[dict], chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    """
    Chunk each page's text separately so every chunk can be tagged with the
    page number it came from (used for 'found on page N' citations).
    Returns a list of {text, page_number}.
    """
    all_chunks = []
    for page in pages:
        for chunk in chunk_text(page["text"], chunk_size, overlap):
            all_chunks.append({"text": chunk, "page_number": page["page_number"]})
    return all_chunks