"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentSummary, listDocuments, deleteDocument } from "@/lib/api";

interface Props {
  activeId: string | null;
  onSelect: (doc: DocumentSummary) => void;
  refreshKey: number;
  multiMode: boolean;
  selectedIds: string[];
  onToggleMultiMode: () => void;
  onToggleSelected: (id: string) => void;
  onAskAcrossSelected: (docs: { id: string; filename: string }[]) => void;
}

export default function DocumentSidebar({
  activeId,
  onSelect,
  refreshKey,
  multiMode,
  selectedIds,
  onToggleMultiMode,
  onToggleSelected,
  onAskAcrossSelected,
}: Props) {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDocs();
  }, [refreshKey]);

  // Poll while any document is still processing, so status badges update live
  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "processing");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(loadDocs, 3000);
    }
    if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [docs]);

  async function loadDocs() {
    try {
      const result = await listDocuments();
      setDocs(result);
    } catch {
      // fail quietly
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    await deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setConfirmingId(null);
  }

  const readyDocs = docs.filter((d) => d.status === "ready");

  return (
    <div className="w-64 bg-ink h-full overflow-y-auto p-4 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-6 px-1">
        <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center text-white text-sm font-display font-bold">
          P
        </div>
        <span className="font-display font-bold text-white text-sm tracking-tight">
          PDF Copilot
        </span>
      </div>

      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] font-semibold text-indigo-300/70 uppercase tracking-wider">
          Your PDFs
        </p>
        {readyDocs.length > 1 && (
          <button
            onClick={onToggleMultiMode}
            className={`text-[11px] font-medium rounded px-1.5 py-0.5 transition-colors ${
              multiMode ? "bg-teal text-white" : "text-indigo-300 hover:text-white"
            }`}
          >
            {multiMode ? "Done" : "Select"}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-indigo-300/50 px-1">Loading…</p>}
      {!loading && docs.length === 0 && (
        <p className="text-sm text-indigo-300/50 px-1 leading-relaxed">
          Nothing uploaded yet. Add a PDF to get started.
        </p>
      )}

      <div className="space-y-1">
        {docs.map((doc) => {
          const isConfirming = confirmingId === doc.id;
          const isSelected = selectedIds.includes(doc.id);
          const isProcessing = doc.status === "processing";
          const isFailed = doc.status === "failed";

          return (
            <div
              key={doc.id}
              onClick={() => {
                if (isConfirming) return;
                if (multiMode) {
                  if (doc.status === "ready") onToggleSelected(doc.id);
                } else if (doc.status === "ready") {
                  onSelect(doc);
                }
              }}
              className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                doc.status !== "ready" ? "cursor-default opacity-60" : "cursor-pointer"
              } ${
                activeId === doc.id || isSelected
                  ? "bg-teal/20 text-white"
                  : "text-indigo-100/80 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {multiMode && doc.status === "ready" && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelected(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-teal shrink-0"
                  />
                )}
                <span className="truncate">{doc.filename}</span>
                {isProcessing && (
                  <span className="text-[10px] shrink-0 bg-amber/20 text-amber px-1.5 py-0.5 rounded">
                    Processing…
                  </span>
                )}
                {isFailed && (
                  <span
                    className="text-[10px] shrink-0 bg-rose/20 text-rose px-1.5 py-0.5 rounded"
                    title={doc.error_message || "Processing failed"}
                  >
                    Failed
                  </span>
                )}
              </div>
              <button
                onClick={(e) => handleDelete(e, doc.id)}
                onMouseLeave={() => isConfirming && setConfirmingId(null)}
                className={`ml-2 shrink-0 text-xs rounded px-1.5 py-0.5 transition-all ${
                  isConfirming
                    ? "bg-rose text-white opacity-100"
                    : "opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-rose"
                }`}
                title={isConfirming ? "Click again to confirm" : "Delete"}
              >
                {isConfirming ? "Confirm?" : "✕"}
              </button>
            </div>
          );
        })}
      </div>

      {multiMode && selectedIds.length > 0 && (
        <button
          onClick={() =>
            onAskAcrossSelected(
              docs.filter((d) => selectedIds.includes(d.id)).map((d) => ({ id: d.id, filename: d.filename }))
            )
          }
          className="mt-4 bg-teal text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-teal-dark transition-colors"
        >
          Ask across {selectedIds.length} PDF{selectedIds.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
