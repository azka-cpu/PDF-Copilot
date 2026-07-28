import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UploadResponse {
  document_id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
}

export interface DocumentSummary {
  id: string;
  filename: string;
  page_count: number;
  summary: string | null;
  status: "processing" | "ready" | "failed";
  error_message?: string | null;
  created_at: string;
}

export interface DocumentStatus {
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  page_count: number;
}

export interface MultiChatSource {
  document_id: string;
  filename: string | null;
  page_number: number | null;
  similarity: number;
}

export interface MultiChatResponse {
  answer: string;
  sources: MultiChatSource[];
  found_in_document: boolean;
}

export interface ChatSource {
  chunk_index: number;
  page_number: number | null;
  similarity: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  found_in_document: boolean;
  user_message_id: string | null;
  assistant_message_id: string | null;
}

export interface WebSource {
  title: string;
  url: string;
}

export interface WebChatResponse {
  answer: string;
  sources: WebSource[];
  assistant_message_id: string | null;
}

export interface SavedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  is_web_answer: boolean;
  sources: (ChatSource | WebSource)[];
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: fallbackMsg }));
    throw new Error(err.detail || fallbackMsg);
  }
  return res.json();
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });

  return handle(res, "Upload failed");
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch(`${API_URL}/documents`, {
    headers: await authHeaders(),
  });
  return handle(res, "Could not load documents");
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await handle(res, "Delete failed");
}

export async function summarizeDocument(documentId: string): Promise<{ summary: string }> {
  const res = await fetch(`${API_URL}/documents/${documentId}/summarize`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return handle(res, "Summary failed");
}

export async function getMessages(documentId: string): Promise<SavedMessage[]> {
  const res = await fetch(`${API_URL}/documents/${documentId}/messages`, {
    headers: await authHeaders(),
  });
  return handle(res, "Could not load chat history");
}

export async function getFileUrl(documentId: string): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/documents/${documentId}/file-url`, {
    headers: await authHeaders(),
  });
  return handle(res, "Could not load PDF preview");
}
export async function askQuestion(
  documentId: string,
  question: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ document_id: documentId, question }),
  });
  return handle(res, "Chat request failed");
}

export async function askWeb(question: string, documentId?: string): Promise<WebChatResponse> {
  const res = await fetch(`${API_URL}/chat/web`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ question, document_id: documentId }),
  });
  return handle(res, "Web search failed");
}

export async function clearChat(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}/messages`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await handle(res, "Could not clear chat");
}

export async function deleteMessage(messageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/messages/${messageId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await handle(res, "Could not delete message");
}

export async function getDocumentStatus(documentId: string): Promise<DocumentStatus> {
  const res = await fetch(`${API_URL}/documents/${documentId}/status`, {
    headers: await authHeaders(),
  });
  return handle(res, "Could not check document status");
}

export interface StreamEvent {
  type: "chunk" | "done" | "error";
  text?: string;
  found_in_document?: boolean;
  sources?: ChatSource[];
  user_message_id?: string;
  assistant_message_id?: string;
  detail?: string;
}

/**
 * Streams an answer via Server-Sent Events. Calls onEvent for each parsed
 * event as it arrives (chunk | done | error) so the UI can render tokens
 * progressively instead of waiting for the full response.
 */
export async function askQuestionStream(
  documentId: string,
  question: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ document_id: documentId, question }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: "Chat request failed" }));
    throw new Error(err.detail || "Chat request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr) as StreamEvent);
      } catch {
        // skip malformed line
      }
    }
  }
}

export async function askMulti(
  documentIds: string[],
  question: string
): Promise<MultiChatResponse> {
  const res = await fetch(`${API_URL}/chat/multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ document_ids: documentIds, question }),
  });
  return handle(res, "Multi-document chat failed");
}
