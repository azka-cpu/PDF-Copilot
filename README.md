# PDF Copilot

Upload PDFs, ask questions, get answers grounded in the document — with page citations,
chat history, summaries, multi-document support, scanned-PDF OCR, voice input, and a
web-search fallback for questions the PDF can't answer.

**Stack:** Next.js + Tailwind (frontend) · FastAPI (backend) · Supabase (Auth, Postgres/pgvector, Storage) · Jina AI (embeddings) · Groq/Llama (chat answers, summaries, and vision OCR) · Serper.dev (web search fallback)

## Features

- **Multi-PDF library** — upload and switch between several documents, listed in a sidebar
- **Accounts** — Supabase Auth; each user only sees their own PDFs (enforced by Row Level Security)
- **Persistent chat history** — saved per document, reloads automatically when you reopen it
- **Page citations** — answers show which page(s) of the PDF they came from
- **PDF preview** — view the actual PDF alongside the chat
- **Scanned PDF support** — pages with no extractable text automatically fall back to OCR via Groq's vision model
- **Whole-document summary** — one-click summary, cached after first generation
- **Web search fallback** — if the answer isn't in the PDF, offers to search the web instead (Serper.dev / Google)
- **Voice input** — ask questions by speaking (uses the browser's built-in speech recognition)
- **Export conversation** — download any chat as a `.txt` file
- **Delete PDFs** — removes the file, its chunks, and its chat history (two-step confirm)
- **Clear chat** — wipe an entire conversation for a document (two-step confirm)
- **Delete individual messages** — remove a single question or answer from history
- **Streaming answers** — responses appear token-by-token instead of waiting for the full generation
- **Background PDF processing** — uploads return immediately; extraction/OCR/embedding happens in the background with a live "Processing…" status badge
- **Daily usage limits** — per-user upload and question quotas to prevent runaway API costs (configurable)
- **Multi-document chat** — select several PDFs in the sidebar and ask a question that searches across all of them at once

## How it works

1. User signs in (Supabase Auth) and uploads a PDF
2. FastAPI extracts text page-by-page (PyMuPDF); pages with no text get OCR'd via Groq's vision model (`llama-3.2-90b-vision-preview`) — handles scanned documents with no extra system dependencies
3. Each page's text is chunked, embedded via Jina AI (`jina-embeddings-v3`, 1024 dims), and stored in Supabase (`pgvector`) tagged with its page number
4. On a question: embed it, run a cosine-similarity search scoped to that document and that user, pull the top chunks
5. Groq (`llama-3.3-70b-versatile`) answers using only those chunks. If it can't find an answer, the bot offers a web-search fallback (Serper.dev + Groq)
6. Every message is saved to the `messages` table (with its own id) so history persists across sessions and individual messages can be deleted

## Design

Indigo sidebar for navigation, warm off-white workspace, teal for primary actions and your messages, amber reserved specifically for "answered from the web" responses, rose for delete/destructive actions. Manrope for headings.

## Setup

### 1. Supabase
- Create a project at supabase.com
- Open the SQL editor, run `supabase/schema.sql`
- **If you already had this project set up before:** re-run `schema.sql` again — it adds a `status` column to `documents`, a `usage_daily` table, and two new RPC functions (`match_chunks_multi`, `increment_usage`) needed for background processing, rate limits, and multi-document chat. All statements use `if not exists` / safe defaults so it won't touch your existing data.
- Enable Email auth under Authentication → Providers (on by default; disable "Confirm email" for easier local testing)
- Grab: Project URL, **publishable/anon** key (frontend), and **secret/service_role** key (backend only — never expose this to the browser)

### 2. Jina AI (embeddings)
- Sign up at jina.ai, get a free API key from the embeddings section

### 3. Groq (chat answers, summaries, vision/OCR)
- Get an API key at console.groq.com

### 4. Serper.dev (web search fallback)
- Sign up at serper.dev, free tier gives 2,500 searches (one-time, no expiry)
- Get your API key from the dashboard

### 5. Rate limits (optional)
- Defaults: 10 uploads/day and 100 questions/day per user
- Override in `backend/.env` if you want different limits:
```env
DAILY_UPLOAD_LIMIT=10
DAILY_QUESTION_LIMIT=100
```

### 6. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # fill in your keys
uvicorn app.main:app --reload
```
Runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### 7. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in API URL + Supabase URL/anon key
npm run dev
```
Runs at `http://localhost:3000`.

## Deployment notes

- **Backend**: Railway (or similar with persistent compute) — avoids serverless bundle-size limits. No OCR system binary needed since it's done via Groq's vision API, not a local model.
- **Frontend**: Vercel.
- Update `FRONTEND_URL` (backend `.env`) and `NEXT_PUBLIC_API_URL` / Supabase env vars (frontend `.env.local`) to your deployed URLs.
- Voice input relies on the browser's Web Speech API — works in Chrome/Edge, not supported in Firefox; the mic button just won't appear if unsupported.
- Both `.env` and `.env.local` are only read at process startup — restart the server fully (not just hot-reload) after changing either file.

## Troubleshooting

Real issues hit while building this, and how they were fixed:

**`SupabaseException: Invalid URL`**
`SUPABASE_URL` was set to the Postgres connection string (`postgresql://...`) instead of the project URL. The `supabase-py` client needs the REST API URL, not a database connection string:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
```
The `postgresql://...` string is only for connecting a raw Postgres client (psql, SQLAlchemy) directly — different use case.

**`SupabaseException: Invalid API key`**
`SUPABASE_SERVICE_KEY` had the **publishable** key (`sb_publishable_...`) instead of the **secret** key (`sb_secret_...`). The backend needs the secret key — it's under a separate "Secret keys" section on the Supabase API Keys page, revealed via the eye icon. If you're on an older `supabase-py` version, the new `sb_secret_...` / `sb_publishable_...` key format may not be supported yet — run `pip install --upgrade supabase` if you get this error even with the correct key.

**Changes to `.env` not taking effect**
Env vars are only read once at process startup. `uvicorn --reload` watches your Python *code* files, not `.env`. After any `.env` change: `Ctrl+C` to fully stop the server, then restart it — don't rely on reload alone.

**CORS error: "No 'Access-Control-Allow-Origin' header"**
`FRONTEND_URL` in backend `.env` didn't match the frontend's actual origin exactly. Must be an exact match — no trailing slash, and `localhost` vs `127.0.0.1` count as different origins:
```env
FRONTEND_URL=http://localhost:3000
```
Full backend restart required after fixing (see above).

**`cerebras.cloud.sdk.NotFoundError: Error code: 404 - model_not_found`**
Model name string was wrong (e.g. `"llama-3.3-70b"` isn't a valid Cerebras model ID). Provider model names aren't standardized — always check the provider's own model catalog page for the exact `Model ID` string, not the display name.

**`cerebras.cloud.sdk.APIStatusError: 402 - payment_required`**
The specific model being called wasn't covered under the free tier for that account. Not a code bug — check the provider's billing/usage dashboard for which models are actually free before wiring one in.

**Email sign-up: "email rate limit exceeded"**
Supabase's free tier caps confirmation emails per hour (very low, e.g. 2/hour). For local development, disable it entirely: Supabase dashboard → Authentication → Providers → Email → turn off "Confirm email." Users can then sign up and be logged in immediately, no inbox required.

**VS Code shows red squiggles / "Import could not be resolved" for installed packages**
Usually VS Code pointing at the wrong Python interpreter, not a missing package. `Ctrl+Shift+P` → "Python: Select Interpreter" → pick the one inside your project's `venv`. Confirm the install actually completed by running `pip install -r requirements.txt` again and checking for "Requirement already satisfied."

**Frontend not reflecting new styles/layout after a change**
Usually a stale Next.js build cache, not a real error. Faster than a full reinstall:
```bash
rm -rf .next
npm run dev
```
Only run `npm install` again if `package.json` actually changed or `node_modules` is corrupted.
