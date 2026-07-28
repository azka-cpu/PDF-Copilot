import httpx
from app.config import settings

JINA_URL = "https://api.jina.ai/v1/embeddings"
BATCH_SIZE = 50  # keep requests reasonably sized


async def embed_texts(texts: list[str], task: str = "retrieval.passage") -> list[list[float]]:
    """
    Embed a list of texts using Jina AI.
    task: 'retrieval.passage' for document chunks, 'retrieval.query' for search queries.
    Jina v3 uses task hints to optimize embeddings for asymmetric search.
    """
    all_embeddings: list[list[float]] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            response = await client.post(
                JINA_URL,
                headers={
                    "Authorization": f"Bearer {settings.jina_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "jina-embeddings-v3",
                    "task": task,
                    "input": batch,
                },
            )
            response.raise_for_status()
            data = response.json()
            all_embeddings.extend(item["embedding"] for item in data["data"])

    return all_embeddings


async def embed_query(query: str) -> list[float]:
    result = await embed_texts([query], task="retrieval.query")
    return result[0]
