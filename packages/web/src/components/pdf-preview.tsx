"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetectedErrorReportFooter } from "@/components/detected-error-report-footer";
import { FixWithAiButton } from "@/components/fix-with-ai-button";
import { reportDetectedError } from "@/lib/report-detected-error";
import { downloadPdfBase64 } from "@/lib/project-files";
import {
  buildPdfClickDomContext,
  scrollAwareClickToSynctexPoint,
} from "@/lib/pdf-synctex-coords";
import { getDefaultPdfScale } from "@/lib/pdf-preview-scale";
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

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PAGE_STACK_GAP_PX = 12;

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
  isStale?: boolean;
  staleErrorCount?: number;
  onFixWithAi?: () => void;
}

/** Page whose top edge is closest to the scroll container viewport top. */
export function pickPageNearestViewportTop(
  container: HTMLElement,
  pageElements: Map<number, HTMLElement>
): number {
  const viewportTop = container.getBoundingClientRect().top;
  let bestPage = 1;
  let bestDistance = Infinity;

  for (const [pageNum, el] of pageElements) {
    const distance = Math.abs(el.getBoundingClientRect().top - viewportTop);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPage = pageNum;
    }
  }

  return bestPage;
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
  isStale,
  staleErrorCount = 0,
  onFixWithAi,
}: PdfPreviewProps) {
  const pathname = usePathname();
  const [autoReportSent, setAutoReportSent] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(getDefaultPdfScale);
  const pageProxyRefs = useRef<Map<number, PdfPageProxy>>(new Map());
  const pageElementRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, index) => index + 1),
    [numPages]
  );

  useEffect(() => {
    pageProxyRefs.current.clear();
  }, [scale, pdfData]);

  const setPageElementRef = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    if (element) {
      pageElementRefs.current.set(pageNumber, element);
    } else {
      pageElementRefs.current.delete(pageNumber);
    }
  }, []);

  const scrollToPage = useCallback((pageNumber: number) => {
    const container = scrollContainerRef.current;
    const pageElement = pageElementRefs.current.get(pageNumber);
    if (!container || !pageElement) return;

    const top =
      pageElement.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, []);

  const updateCurrentPageFromScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || pageElementRefs.current.size === 0) return;

    const nextPage = pickPageNearestViewportTop(container, pageElementRefs.current);
    setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || numPages === 0) return;

    updateCurrentPageFromScroll();

    const observer = new IntersectionObserver(() => updateCurrentPageFromScroll(), {
      root: container,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    for (const pageNumber of pageNumbers) {
      const element = pageElementRefs.current.get(pageNumber);
      if (element) observer.observe(element);
    }

    container.addEventListener("scroll", updateCurrentPageFromScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", updateCurrentPageFromScroll);
    };
  }, [numPages, pageNumbers, scale, updateCurrentPageFromScroll]);

  const handleProofClick = useCallback(
    async (event: MouseEvent) => {
      if (!synctexData || !onJumpToLine) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const canvas = target.closest("canvas");
      if (!canvas) return;

      const pageElement = canvas.closest("[data-pdf-page]") as HTMLElement | null;
      if (!pageElement) return;

      const pageNumber = Number(pageElement.dataset.pdfPage);
      if (!Number.isFinite(pageNumber)) return;

      const proxy = pageProxyRefs.current.get(pageNumber);
      if (!proxy || proxy.pageNumber !== pageNumber) return;

      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const viewport = proxy.getViewport({
        scale,
        rotation: proxy.rotate ?? 0,
      });
      const dom = buildPdfClickDomContext(event, canvas, pageElement, scrollContainer);
      const [synctexX, synctexY] = scrollAwareClickToSynctexPoint(event, dom, viewport);

      const location = await synctexLookupFromBase64(
        synctexData,
        pageNumber,
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
    const container = scrollContainerRef.current;
    if (!container || !synctexData || !onJumpToLine) return;

    container.addEventListener("click", handleProofClick);
    return () => container.removeEventListener("click", handleProofClick);
  }, [handleProofClick, synctexData, onJumpToLine, numPages, scale]);

  const failureMessage = useMemo(() => {
    if (loading || pdfData) return null;
    return (
      compileErrors.find((error) => error.severity === "error")?.message ||
      (compileFailed ? "Compilation failed — see errors below the editor" : null)
    );
  }, [loading, pdfData, compileErrors, compileFailed]);

  useEffect(() => {
    if (!failureMessage) {
      setAutoReportSent(false);
      return;
    }

    let cancelled = false;
    void reportDetectedError({
      kind: "compile",
      message: failureMessage,
      page: pathname,
    }).then((result) => {
      if (!cancelled) setAutoReportSent(result.sent);
    });

    return () => {
      cancelled = true;
    };
  }, [failureMessage, pathname]);

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
        {failureMessage ? (
          <>
            <p className="text-error text-sm font-medium">Compilation failed</p>
            <p className="text-ink-muted text-sm">{failureMessage}</p>
            {onFixWithAi && (
              <FixWithAiButton
                errorCount={staleErrorCount}
                onClick={onFixWithAi}
                className="mt-2"
              />
            )}
            <DetectedErrorReportFooter
              sent={autoReportSent}
              message={failureMessage}
              kind="compile"
              page={pathname}
              className="mt-2"
            />
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
  const synctexEnabled = Boolean(synctexData && onJumpToLine);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isStale && (
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-error/25 bg-error/10 text-sm"
          role="status"
        >
          <AlertCircle className="h-3.5 w-3.5 text-error shrink-0" />
          <span className="text-ink flex-1 min-w-0">
            Showing last successful proof
            {staleErrorCount > 0 && (
              <span className="text-ink-muted">
                {" "}
                · {staleErrorCount} error{staleErrorCount !== 1 ? "s" : ""} in latest compile
              </span>
            )}
          </span>
          {onFixWithAi && (
            <FixWithAiButton
              errorCount={staleErrorCount}
              onClick={onFixWithAi}
              className="ml-auto"
            />
          )}
        </div>
      )}
      <div className="flex items-center justify-center gap-1 sm:gap-3 py-2 shrink-0 overflow-x-auto px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={currentPage <= 1}
          onClick={() => scrollToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-muted font-mono tabular-nums shrink-0">
          {currentPage} / {numPages || "—"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={currentPage >= numPages}
          onClick={() => scrollToPage(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5 sm:mx-1 shrink-0" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setScale(Math.max(0.5, scale - 0.1))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-ink-faint w-8 text-center tabular-nums shrink-0">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setScale(Math.min(2, scale + 0.1))}
        >
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
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: totalPages }) => {
            setNumPages(totalPages);
            setCurrentPage(1);
          }}
          loading={<div className="p-12 text-center text-ink-muted text-sm">Loading page…</div>}
          error={<div className="p-12 text-center text-error text-sm">Could not load proof</div>}
        >
          <div
            className="flex flex-col items-center mx-auto w-fit"
            style={{ gap: PAGE_STACK_GAP_PX }}
          >
            {pageNumbers.map((pageNumber) => (
              <div
                key={`${pageNumber}-${scale}`}
                ref={(element) => setPageElementRef(pageNumber, element)}
                data-pdf-page={pageNumber}
                className={`proof-page rounded-sm w-fit${synctexEnabled ? " cursor-crosshair" : ""}`}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={(pdfPage) => {
                    pageProxyRefs.current.set(pdfPage.pageNumber, pdfPage);
                  }}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
