from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import upload, chat, documents, summarize

app = FastAPI(title="PDF Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, tags=["upload"])
app.include_router(chat.router, tags=["chat"])
app.include_router(documents.router, tags=["documents"])
app.include_router(summarize.router, tags=["summarize"])


@app.get("/")
async def health_check():
    return {"status": "ok"}
