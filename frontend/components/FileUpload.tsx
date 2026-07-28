"use client";

import { useState } from "react";
import { uploadPdf, UploadResponse } from "@/lib/api";

interface Props {
  onUploaded: (doc: UploadResponse) => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadPdf(file);
      onUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-2 border-dashed border-teal/30 bg-teal-light/30 rounded-xl p-6 text-center transition-colors hover:border-teal/50">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full text-sm text-slate-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal file:text-white file:font-medium file:cursor-pointer hover:file:bg-teal-dark file:transition-colors disabled:opacity-50"
      />
      {uploading && (
        <p className="mt-3 text-sm text-teal-dark">Uploading…</p>
      )}
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
    </div>
  );
}
