# PDF Copilot

> **Upload PDFs, ask questions, and get answers grounded in your documents.**

PDF Copilot is an AI-powered document assistant that lets you upload PDFs, chat with your documents, get page-level citations, generate summaries, process scanned PDFs with OCR, and search the web when the answer isn't available in your documents.

---

## Features

* **Multi-PDF Library** — Upload and switch between multiple PDF documents.
* **Authentication** — Supabase Auth with Row Level Security (RLS).
* **Persistent Chat History** — Conversations are saved per document.
* **Page Citations** — Answers include the page numbers used as sources.
* **PDF Preview** — View the original document alongside the chat.
* **Scanned PDF OCR** — Automatically processes pages with no extractable text.
* **Document Summaries** — Generate and cache whole-document summaries.
* **Web Search Fallback** — Search the web when the answer isn't available in the PDF.
* **Voice Input** — Ask questions using browser speech recognition.
* **Export Conversations** — Download chat history as `.txt`.
* **PDF Management** — Delete PDFs, chunks, and related chat history.
* **Clear Chat** — Remove an entire document conversation.
* **Delete Messages** — Delete individual questions or answers.
* **Streaming Responses** — See answers token-by-token.
* **Background Processing** — PDF extraction, OCR, and embedding run in the background.
* **Usage Limits** — Configurable daily upload and question limits.
* **Multi-Document Chat** — Search across multiple PDFs simultaneously.

---

## Tech Stack

| Category            | Technology             |
| ------------------- | ---------------------- |
| Frontend            | Next.js + Tailwind CSS |
| Backend             | FastAPI                |
| Authentication      | Supabase Auth          |
| Database            | Supabase Postgres      |
| Vector Database     | pgvector               |
| Embeddings          | Jina AI                |
| AI Chat & Summaries | Groq / Llama           |
| OCR                 | Groq Vision            |
| Web Search          | Serper.dev             |
| PDF Extraction      | PyMuPDF                |
| Voice Input         | Browser Web Speech API |


### Processing Flow

1. User signs in using **Supabase Auth**.
2. User uploads a PDF.
3. **FastAPI** extracts text page-by-page using **PyMuPDF**.
4. Pages without extractable text are processed using **Groq Vision OCR**.
5. Extracted text is split into chunks.
6. Chunks are embedded using **Jina AI**.
7. Embeddings and page metadata are stored in **Supabase pgvector**.
8. User asks a question.
9. The question is converted into an embedding.
10. Relevant chunks are retrieved using cosine similarity.
11. **Groq / Llama** generates an answer using the retrieved context.
12. The response includes the relevant PDF page citations.
13. If the answer isn't found, the application can offer a web search fallback.
14. Chat messages are stored for persistent conversation history.

---

# Getting Started

## Prerequisites

Before running PDF Copilot locally, make sure you have:

* Python installed
* Node.js and npm installed
* A Supabase project
* A Jina AI API key
* A Groq API key
* A Serper.dev API key

---

## 1. Set Up Supabase

Create a new Supabase project.

Then open the **SQL Editor** and run:

```text
supabase/schema.sql
```

If you already configured the project previously, run the schema again to ensure the latest database objects are available.

The schema includes support for:

* Document processing status
* Daily usage tracking
* Multi-document similarity search
* Usage tracking functions

Enable email authentication:

```text
Supabase Dashboard
→ Authentication
→ Providers
→ Email
```

For local development, you can disable **Confirm email** to simplify testing.

You will need:

* Supabase Project URL
* Frontend publishable / anonymous key
* Backend secret / service key

> **Security:** Never expose the backend secret/service key in the browser or commit it to GitHub.

---

## 2. Set Up Jina AI

Create a Jina AI account and generate an API key for embeddings.

PDF Copilot uses:

```text
jina-embeddings-v3
```

---

## 3. Set Up Groq

Create a Groq API key.

Groq is used for:

* AI chat responses
* Document summaries
* Vision-based OCR for scanned PDFs

---

## 4. Set Up Serper.dev

Create a Serper.dev account and generate an API key.

Serper.dev is used for the optional web-search fallback when an answer cannot be found in the uploaded PDF.

---

## 5. Configure Usage Limits

Default daily limits are:

```env
DAILY_UPLOAD_LIMIT=10
DAILY_QUESTION_LIMIT=100
```

You can customize these values in:

```text
backend/.env
```

---

# Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a Python virtual environment.

### macOS / Linux

```bash
python -m venv venv
source venv/bin/activate
```

### Windows

```powershell
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

Add your API keys and configuration values to `.env`.

Start the backend:

```bash
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

# Frontend Setup

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.local.example .env.local
```

Configure your:

* Backend API URL
* Supabase URL
* Supabase anonymous / publishable key

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

---

# Environment Variables

## Backend

Your `backend/.env` should contain the required Supabase and AI provider configuration.

Example:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-secret-key

FRONTEND_URL=http://localhost:3000

DAILY_UPLOAD_LIMIT=10
DAILY_QUESTION_LIMIT=100

JINA_API_KEY=your-jina-api-key
GROQ_API_KEY=your-groq-api-key
SERPER_API_KEY=your-serper-api-key
```

> **Note:** The exact variable names should match your project's `.env.example` file.

## Frontend

Your `frontend/.env.local` should contain your backend and Supabase configuration.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
```

> **Security:** Never commit `.env` or `.env.local` files to GitHub.

Add them to `.gitignore`:

```gitignore
.env
.env.local
.env.*.local
```

---

# Deployment

## Backend

Deploy the FastAPI backend to a platform with persistent compute, such as Railway or a similar service.

The application does not require a local OCR binary because scanned-document OCR is handled through Groq's vision API.

Update:

```env
FRONTEND_URL
```

with the URL of your deployed frontend.

---

## Frontend

Deploy the Next.js application to Vercel or another compatible hosting provider.

Configure:

```env
NEXT_PUBLIC_API_URL
```

along with the required Supabase environment variables.

> **Note:** Environment variables are loaded when the process starts. Restart the backend and frontend after changing environment variables.

---

# Voice Input

Voice input uses the browser's built-in **Web Speech API**.

| Browser | Support       |
| ------- | ------------- |
| Chrome  | Supported     |
| Edge    | Supported     |
| Firefox | Not supported |

If voice recognition is unavailable, the microphone button will not appear.

---

# Troubleshooting

## `SupabaseException: Invalid URL`

Make sure `SUPABASE_URL` contains the Supabase project URL.

Correct:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
```

Incorrect:

```env
SUPABASE_URL=postgresql://...
```

The PostgreSQL connection string is intended for direct PostgreSQL connections, not the Supabase REST API client.

---

## `SupabaseException: Invalid API key`

Make sure the backend is using the **secret/service key**, not the frontend publishable/anonymous key.

The backend key should remain private.

If you're using an older version of `supabase-py`, update it:

```bash
pip install --upgrade supabase
```

---

## `.env` Changes Are Not Taking Effect

Environment variables are loaded when the process starts.

Stop the server completely:

```text
Ctrl+C
```

Then restart it:

```bash
uvicorn app.main:app --reload
```

Do not rely on hot reload after changing `.env`.

---

## CORS Error

If you see:

```text
No 'Access-Control-Allow-Origin' header
```

check your backend `.env`:

```env
FRONTEND_URL=http://localhost:3000
```

The value must exactly match the frontend origin.

For example:

```text
http://localhost:3000
```

and:

```text
http://127.0.0.1:3000
```

are different origins.

Restart the backend after changing the value.

---

## Model Not Found

If you receive:

```text
model_not_found
```

verify that the configured model ID is valid for the provider you are using.

Provider model names are not standardized, so always check the provider's official model catalog for the exact model ID.

---

## Payment Required

If you receive:

```text
402 payment_required
```

the selected model may not be available under your account's free tier.

Check your provider's billing and usage dashboard.

---

## Email Sign-Up Rate Limit

Supabase's free tier may limit confirmation emails.

For local development, disable email confirmation:

```text
Supabase Dashboard
→ Authentication
→ Providers
→ Email
→ Confirm email: OFF
```

This allows users to sign up and log in without email confirmation.

---

## VS Code Import Errors

If VS Code shows:

```text
Import could not be resolved
```

make sure VS Code is using the Python interpreter from your project's virtual environment.

Open:

```text
Ctrl + Shift + P
```

Then select:

```text
Python: Select Interpreter
```

Choose the interpreter inside your `venv`.

You can also reinstall or verify dependencies:

```bash
pip install -r requirements.txt
```

---

## Frontend Changes Are Not Showing

If Next.js does not reflect new styles or layouts, clear the `.next` cache:

```bash
rm -rf .next
npm run dev
```

On Windows, manually delete the `.next` directory and restart the development server.

You generally don't need to reinstall dependencies unless `package.json` changed or `node_modules` is corrupted.

---

# Project Structure

```text
pdf-copilot/
│
├── backend/
│   ├── app/
│   ├── requirements.txt
│   ├── .env.example
│   └── ...
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   ├── .env.local.example
│   └── ...
│
├── supabase/
│   └── schema.sql
│
├── .gitignore
└── README.md
```

---

# Security Notes

* Never commit API keys to GitHub.
* Never expose the Supabase secret/service key to the frontend.
* Use environment variables for sensitive configuration.
* Keep Row Level Security enabled in Supabase.
* Ensure backend CORS configuration matches your frontend URL.
* Review provider API quotas and usage limits before deploying publicly.

---
# Contributing

Contributions, improvements, and feature suggestions are welcome.

If you find a bug or have an idea for improvement, feel free to open an issue or submit a pull request.
