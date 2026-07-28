"use client";

import { useState } from "react";
import { summarizeDocument } from "@/lib/api";

interface Props {
  documentId: string;
}

export default function SummaryPanel({ documentId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSummarize() {
    setLoading(true);
    setError(null);
    try {
      const result = await summarizeDocument(documentId);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate summary");
    } finally {
      setLoading(false);
    }
  }

  if (!summary) {
    return (
      <button
        onClick={handleSummarize}
        disabled={loading}
        className="text-sm font-medium text-teal-dark hover:text-teal flex items-center gap-1.5 disabled:opacity-50 transition-colors"
      >
        <span>📝</span>
        {loading ? "Summarizing…" : "Summarize this PDF"}
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-text whitespace-pre-wrap shadow-sm">
      <p className="font-display font-semibold text-ink mb-2">Summary</p>
      {summary}
      {error && <p className="text-rose mt-2">{error}</p>}
    </div>
  );
}
