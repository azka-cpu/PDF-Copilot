"use client";

import { useEffect, useState } from "react";
import {
  askQuestionStream,
  askWeb,
  getMessages,
  clearChat,
  deleteMessage,
  ChatSource,
  WebSource,
} from "@/lib/api";
import { useVoiceInput } from "@/lib/useVoiceInput";
import { exportConversation } from "@/lib/exportConversation";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  offerWebSearch?: boolean;
  question?: string;
  isWebAnswer?: boolean;
  sources?: (ChatSource | WebSource)[];
}

interface Props {
  documentId: string;
  filename: string;
}

export default function ChatWindow({ documentId, filename }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const voice = useVoiceInput((transcript) => setInput(transcript));

  useEffect(() => {
    setHistoryLoading(true);
    getMessages(documentId)
      .then((saved) => {
        setMessages(
          saved.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            isWebAnswer: m.is_web_answer,
            sources: m.sources as (ChatSource | WebSource)[],
          }))
        );
      })
      .catch(() => setMessages([]))
      .finally(() => setHistoryLoading(false));
  }, [documentId]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);

    // Add the user's message immediately, and a placeholder assistant
    // message that will be filled in token-by-token as the stream arrives.
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

    try {
      await askQuestionStream(documentId, question, (event) => {
        if (event.type === "chunk" && event.text) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + event.text };
            return next;
          });
        } else if (event.type === "done") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 2] = { ...next[next.length - 2], id: event.user_message_id };
            next[next.length - 1] = {
              ...next[next.length - 1],
              id: event.assistant_message_id,
              offerWebSearch: !event.found_in_document,
              question,
              sources: event.sources,
            };
            return next;
          });
        } else if (event.type === "error") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: `Error: ${event.detail || "Something went wrong"}`,
            };
            return next;
          });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: `Error: ${message}` };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleWebSearch(question: string) {
    setLoading(true);
    try {
      const result = await askWeb(question, documentId);
      setMessages((prev) => [
        ...prev,
        {
          id: result.assistant_message_id ?? undefined,
          role: "assistant",
          content: result.answer,
          isWebAnswer: true,
          sources: result.sources,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Web search failed";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMessage(id: string | undefined, index: number) {
    setMessages((prev) => prev.filter((_, i) => i !== index));
    if (id) {
      try {
        await deleteMessage(id);
      } catch {
        // message already removed from view; ignore failure
      }
    }
  }

  async function handleClearChat() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setMessages([]);
    setConfirmClear(false);
    try {
      await clearChat(documentId);
    } catch {
      // best-effort
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-paper flex items-center justify-between">
        <p className="text-sm font-display font-semibold text-ink truncate flex items-center gap-1.5">
          <span>📄</span> {filename}
        </p>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <button
            onClick={() => exportConversation(filename, messages)}
            disabled={messages.length === 0}
            className="text-xs font-medium text-teal-dark hover:text-teal disabled:opacity-40 transition-colors"
          >
            Export
          </button>
          <button
            onClick={handleClearChat}
            onMouseLeave={() => confirmClear && setConfirmClear(false)}
            disabled={messages.length === 0}
            className={`text-xs font-medium disabled:opacity-40 transition-colors ${
              confirmClear ? "text-rose" : "text-slate-muted hover:text-rose"
            }`}
          >
            {confirmClear ? "Confirm clear?" : "Clear chat"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/40">
        {historyLoading && (
          <p className="text-sm text-slate-muted text-center mt-8">Loading conversation…</p>
        )}
        {!historyLoading && messages.length === 0 && (
          <p className="text-sm text-slate-muted text-center mt-8">
            Ask a question about this document to get started.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id ?? i}
            className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-start gap-1.5 max-w-[85%]">
              {msg.role === "assistant" && (
                <button
                  onClick={() => handleDeleteMessage(msg.id, i)}
                  className="opacity-0 group-hover:opacity-100 text-slate-muted hover:text-rose text-xs mt-2 transition-opacity"
                  title="Delete message"
                >
                  ✕
                </button>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
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
                {msg.content || (msg.role === "assistant" && loading ? (
                  <span className="text-slate-muted">Thinking…</span>
                ) : "")}

                {!msg.isWebAnswer && msg.sources && msg.sources.length > 0 && (
                  <p className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-muted">
                    Found on page{(msg.sources as ChatSource[]).length > 1 ? "s" : ""}:{" "}
                    {[...new Set((msg.sources as ChatSource[]).map((s) => s.page_number))]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}

                {msg.isWebAnswer && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-border space-y-1">
                    {(msg.sources as WebSource[]).map((s, j) => (
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
              {msg.role === "user" && (
                <button
                  onClick={() => handleDeleteMessage(msg.id, i)}
                  className="opacity-0 group-hover:opacity-100 text-slate-muted hover:text-rose text-xs mt-2 transition-opacity"
                  title="Delete message"
                >
                  ✕
                </button>
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
      </div>

      <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask a question about the PDF…"
          disabled={loading}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent disabled:opacity-50"
        />
        {voice.supported && (
          <button
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={loading}
            title="Voice input"
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              voice.listening
                ? "bg-rose-light border-rose/30 text-rose"
                : "border-slate-200 text-slate-muted hover:bg-slate-50"
            } disabled:opacity-50`}
          >
            🎤
          </button>
        )}
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
