"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  pdfData: string | null;
  loading?: boolean;
}

export function PdfPreview({ pdfData, loading }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(0.95);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm font-serif">
        Typesetting…
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-muted text-sm font-serif px-6 text-center gap-2">
        <p>Compile to see your proof.</p>
        <p className="text-xs text-ink-faint">The rendered page will appear here, like a printed draft on your desk.</p>
      </div>
    );
  }

  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-3 py-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-muted font-mono tabular-nums">
          {page} / {numPages || "—"}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= numPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-faint w-8 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(Math.min(2, scale + 0.1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-8 pt-2">
        <div className="proof-page rounded-sm mx-auto w-fit">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="p-12 text-center text-ink-muted text-sm">Loading page…</div>}
            error={<div className="p-12 text-center text-error text-sm">Could not load proof</div>}
          >
            <Page pageNumber={page} scale={scale} renderTextLayer={false} />
          </Document>
        </div>
      </div>
    </div>
  );
}
