"use client";

import { useState } from "react";
import { askMulti, askWeb, MultiChatSource, WebSource } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: MultiChatSource[];
  isWebAnswer?: boolean;
  webSources?: WebSource[];
  offerWebSearch?: boolean;
  question?: string;
}

interface Props {
  documentIds: string[];
  filenames: string[];
  onClose: () => void;
}

export default function MultiChatWindow({ documentIds, filenames, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const result = await askMulti(documentIds, question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          offerWebSearch: !result.found_in_document,
          question,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleWebSearch(question: string) {
    setLoading(true);
    try {
      // No single document_id in multi-doc mode, so this answer isn't saved to any
      // document's persisted history - it's shown here only, same as a one-off lookup.
      const result = await askWeb(question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          isWebAnswer: true,
          webSources: result.sources,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Web search failed";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-white border border-teal/30 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-teal-light/40 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-display font-semibold text-ink">
            🔎 Asking across {filenames.length} PDFs
          </p>
          <p className="text-xs text-slate-muted truncate">{filenames.join(", ")}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-medium text-slate-muted hover:text-rose transition-colors shrink-0 ml-2"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/40">
        {messages.length === 0 && (
          <p className="text-sm text-slate-muted text-center mt-8">
            Ask a question that spans these documents — the answer will pull from
            whichever ones are relevant.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-teal text-white rounded-br-sm"
                  : msg.isWebAnswer
                  ? "bg-amber-light border border-amber-border text-slate-text rounded-bl-sm"
                  : "bg-slate-100 text-slate-text rounded-bl-sm"
              }`}
            >
              {msg.isWebAnswer && (
                <p className="text-xs font-semibold text-amber-700 mb-1">🌐 From the web</p>
              )}
              {msg.content}

              {!msg.isWebAnswer && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-muted space-y-0.5">
                  {msg.sources.map((s, j) => (
                    <p key={j}>
                      {s.filename} — page {s.page_number ?? "?"}
                    </p>
                  ))}
                </div>
              )}

              {msg.isWebAnswer && msg.webSources && msg.webSources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-border space-y-1">
                  {msg.webSources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-teal-dark hover:underline truncate"
                    >
                      {s.title || s.url}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {msg.offerWebSearch && msg.question && (
              <button
                onClick={() => handleWebSearch(msg.question!)}
                disabled={loading}
                className="mt-1 text-xs font-medium text-teal-dark hover:text-teal disabled:opacity-50 transition-colors"
              >
                🌐 Search the web instead
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
              Searching…
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask something across the selected PDFs…"
          disabled={loading}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-teal text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-dark transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
