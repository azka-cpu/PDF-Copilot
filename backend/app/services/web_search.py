import httpx
from app.config import settings

SERPER_URL = "https://google.serper.dev/search"


async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the web via Serper.dev (Google Search API) and return a list of
    {title, url, content}. Serper has a free tier (2,500 searches, one-time)
    and returns real Google results, including snippets suitable as LLM context.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            SERPER_URL,
            headers={
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json",
            },
            json={"q": query, "num": max_results},
        )
        response.raise_for_status()
        data = response.json()

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("link", ""),
            "content": r.get("snippet", ""),
        }
        for r in data.get("organic", [])[:max_results]
    ]