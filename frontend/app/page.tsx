"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import LoginForm from "@/components/LoginForm";
import FileUpload from "@/components/FileUpload";
import ChatWindow from "@/components/ChatWindow";
import DocumentSidebar from "@/components/DocumentSidebar";
import MultiChatWindow from "@/components/MultiChatWindow";
import PDFPreview from "@/components/PDFPreview";
import SummaryPanel from "@/components/SummaryPanel";
import { DocumentSummary, UploadResponse } from "@/lib/api";

export default function Home() {
  const { session, loading, signOut } = useAuth();
  const [activeDoc, setActiveDoc] = useState<DocumentSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiDocs, setMultiDocs] = useState<{ id: string; filename: string }[] | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <p className="text-indigo-200 text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  function handleUploaded(doc: UploadResponse) {
    // Uploads now process in the background - the document starts in
    // 'processing' status and the sidebar polls until it's ready to open.
    setRefreshKey((k) => k + 1);
  }

  function handleSelectDoc(doc: DocumentSummary) {
    setMultiDocs(null);
    setActiveDoc(doc);
  }

  function toggleMultiMode() {
    setMultiMode((v) => !v);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleAskAcrossSelected(docs: { id: string; filename: string }[]) {
    setMultiDocs(docs);
    setActiveDoc(null);
    setMultiMode(false);
  }

  return (
    <div className="flex h-screen">
      <DocumentSidebar
        activeId={activeDoc?.id ?? null}
        onSelect={handleSelectDoc}
        refreshKey={refreshKey}
        multiMode={multiMode}
        selectedIds={selectedIds}
        onToggleMultiMode={toggleMultiMode}
        onToggleSelected={toggleSelected}
        onAskAcrossSelected={handleAskAcrossSelected}
      />

      <main className="flex-1 overflow-y-auto p-8 bg-paper">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Dashboard</h1>
            <p className="text-sm text-slate-muted">{session.user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-slate-muted hover:text-rose transition-colors"
          >
            Sign out
          </button>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Upload a new PDF</p>
            <FileUpload onUploaded={handleUploaded} />
            <p className="text-xs text-slate-muted mt-2">
              Large PDFs process in the background — you'll see a "Processing…" badge
              in the sidebar until it's ready to chat with.
            </p>
          </div>

          {multiDocs && (
            <MultiChatWindow
              documentIds={multiDocs.map((d) => d.id)}
              filenames={multiDocs.map((d) => d.filename)}
              onClose={() => setMultiDocs(null)}
            />
          )}

          {activeDoc && !multiDocs && (
            <>
              <div className="flex items-center justify-between pt-2">
                <SummaryPanel documentId={activeDoc.id} />
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="text-sm font-medium text-teal-dark hover:text-teal transition-colors"
                >
                  {showPreview ? "Hide PDF preview" : "Show PDF preview"}
                </button>
              </div>

              {showPreview && (
                <div className="h-[500px] border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <PDFPreview documentId={activeDoc.id} />
                </div>
              )}

              <ChatWindow documentId={activeDoc.id} filename={activeDoc.filename} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
