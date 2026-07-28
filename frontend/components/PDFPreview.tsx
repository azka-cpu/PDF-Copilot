"use client";

import { useEffect, useState } from "react";
import { getFileUrl } from "@/lib/api";

interface Props {
  documentId: string;
  page?: number | null;
}

export default function PDFPreview({ documentId, page }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFileUrl(documentId).then((res) => {
      if (!cancelled) setUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-muted">
        Loading preview…
      </div>
    );
  }

  // #page=N is a standard PDF-viewer URL fragment supported by browser PDF viewers
  const src = page ? `${url}#page=${page}` : url;

  return (
    <iframe
      key={src}
      src={src}
      title="PDF preview"
      className="w-full h-full border-0"
    />
  );
}
