"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadPdfBase64 } from "@/lib/project-files";
import {
  buildPdfClickDomContext,
  scrollAwareClickToSynctexPoint,
} from "@/lib/pdf-synctex-coords";
import { synctexLookupFromBase64 } from "@/lib/synctex";

/** Minimal pdf.js page handle used for SyncTeX reverse lookup (react-pdf onRenderSuccess). */
interface PdfPageProxy {
  pageNumber: number;
  view: number[];
  rotate?: number;
  getViewport: (params: { scale: number; rotation?: number }) => {
    width: number;
    height: number;
    convertToPdfPoint: (x: number, y: number) => number[];
  };
}

interface SyncPageHandle {
  pageNumber: number;
  proxy: PdfPageProxy;
  generation: number;
}

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CompileError {
  message: string;
  severity: "error" | "warning";
}

interface PdfPreviewProps {
  pdfData: string | null;
  synctexData?: string | null;
  projectFiles?: string[];
  onJumpToLine?: (line: number, file?: string) => void;
  loading?: boolean;
  downloadFilename?: string;
  showDownload?: boolean;
  compileFailed?: boolean;
  compileErrors?: CompileError[];
}

export function PdfPreview({
  pdfData,
  synctexData,
  projectFiles = [],
  onJumpToLine,
  loading,
  downloadFilename,
  showDownload = false,
  compileFailed,
  compileErrors = [],
}: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(0.95);
  const pageProxyRef = useRef<SyncPageHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElementRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(page);
  const renderGenerationRef = useRef(0);

  pageRef.current = page;

  useEffect(() => {
    renderGenerationRef.current += 1;
    pageProxyRef.current = null;
  }, [page, scale]);

  const handleCanvasClick = useCallback(
    async (event: MouseEvent) => {
      if (!synctexData || !onJumpToLine) return;

      const lookupPage = pageRef.current;
      const handle = pageProxyRef.current;
      if (!handle || handle.pageNumber !== lookupPage) return;

      const canvas = canvasRef.current;
      const scrollContainer = scrollContainerRef.current;
      const pageElement = pageElementRef.current;
      if (!canvas || !scrollContainer || !pageElement) return;

      const viewport = handle.proxy.getViewport({
        scale,
        rotation: handle.proxy.rotate ?? 0,
      });
      const dom = buildPdfClickDomContext(event, canvas, pageElement, scrollContainer);
      const [synctexX, synctexY] = scrollAwareClickToSynctexPoint(event, dom, viewport);

      const location = await synctexLookupFromBase64(
        synctexData,
        lookupPage,
        synctexX,
        synctexY,
        projectFiles
      );
      if (location?.line) {
        onJumpToLine(location.line, location.file);
      }
    },
    [synctexData, onJumpToLine, scale, projectFiles]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !synctexData || !onJumpToLine) return;

    canvas.addEventListener("click", handleCanvasClick);
    return () => canvas.removeEventListener("click", handleCanvasClick);
  }, [handleCanvasClick, synctexData, onJumpToLine, page, scale]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm font-serif">
        Typesetting…
      </div>
    );
  }

  if (!pdfData) {
    const failureMessage =
      compileErrors.find((e) => e.severity === "error")?.message ||
      (compileFailed ? "Compilation failed — see errors below the editor" : null);

    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-muted text-sm font-serif px-6 text-center gap-2">
        {failureMessage ? (
          <>
            <p className="text-error text-sm font-medium">Compilation failed</p>
            <p className="text-ink-muted text-sm">{failureMessage}</p>
          </>
        ) : (
          <>
            <p>Compile to see your proof.</p>
            <p className="text-xs text-ink-faint">
              The rendered page will appear here, like a printed draft on your desk.
            </p>
          </>
        )}
      </div>
    );
  }

  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-1 sm:gap-3 py-2 shrink-0 overflow-x-auto px-2">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-muted font-mono tabular-nums shrink-0">
          {page} / {numPages || "—"}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={page >= numPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5 sm:mx-1 shrink-0" />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-faint w-8 text-center tabular-nums shrink-0">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setScale(Math.min(2, scale + 0.1))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        {showDownload && downloadFilename && (
          <>
            <div className="w-px h-4 bg-border mx-0.5 sm:mx-1 shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 sm:w-auto sm:px-2"
              onClick={() => downloadPdfBase64(pdfData, downloadFilename)}
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Download</span>
            </Button>
          </>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto px-3 sm:px-6 pb-8 pt-2"
      >
        <div className="proof-page rounded-sm mx-auto w-fit">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="p-12 text-center text-ink-muted text-sm">Loading page…</div>}
            error={<div className="p-12 text-center text-error text-sm">Could not load proof</div>}
          >
            <div
              ref={pageElementRef}
              className={synctexData && onJumpToLine ? "cursor-crosshair" : undefined}
            >
              <Page
                key={`${page}-${scale}`}
                pageNumber={page}
                scale={scale}
                canvasRef={canvasRef}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onRenderSuccess={(pdfPage) => {
                  if (pdfPage.pageNumber !== pageRef.current) return;
                  const generation = renderGenerationRef.current;
                  pageProxyRef.current = {
                    pageNumber: pdfPage.pageNumber,
                    proxy: pdfPage,
                    generation,
                  };
                }}
              />
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
