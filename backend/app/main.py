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

# Prefixed with /api/backend to match the Vercel vercel.json rewrite, which
# forwards the full path (including /api/backend) through to this service
# rather than stripping it. This means all endpoints now live under
# /api/backend/... - update NEXT_PUBLIC_API_URL to include this prefix
# in both local and deployed frontend env files.
API_PREFIX = "/api/backend"

app.include_router(upload.router, prefix=API_PREFIX, tags=["upload"])
app.include_router(chat.router, prefix=API_PREFIX, tags=["chat"])
app.include_router(documents.router, prefix=API_PREFIX, tags=["documents"])
app.include_router(summarize.router, prefix=API_PREFIX, tags=["summarize"])


@app.get(f"{API_PREFIX}/")
@app.get("/")
async def health_check():
    return {"status": "ok"}
