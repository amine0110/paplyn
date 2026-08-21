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
  const [scale, setScale] = useState(1.0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm">
        Compiling...
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm">
        Compile to preview PDF
      </div>
    );
  }

  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-canvas-dark text-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-ink-muted px-2">
            {page} / {numPages || "?"}
          </span>
          <Button variant="ghost" size="icon" disabled={page >= numPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-ink-faint w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setScale(Math.min(2, scale + 0.1))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-canvas-dark p-4">
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="text-center text-ink-muted">Loading PDF...</div>}
          error={<div className="text-center text-error">Failed to load PDF</div>}
        >
          <Page pageNumber={page} scale={scale} renderTextLayer={false} />
        </Document>
      </div>
    </div>
  );
}
