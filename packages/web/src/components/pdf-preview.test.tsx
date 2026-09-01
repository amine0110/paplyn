import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PdfPreview, pickPageNearestViewportTop } from "./pdf-preview";

const synctexLookupFromBase64 = vi.fn();
const onJumpToLine = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/project/test",
}));

vi.mock("@/lib/synctex", () => ({
  synctexLookupFromBase64: (...args: unknown[]) => synctexLookupFromBase64(...args),
}));

vi.mock("@/lib/report-detected-error", () => ({
  reportDetectedError: vi.fn().mockResolvedValue({ sent: false }),
}));

vi.mock("@/lib/project-files", () => ({
  downloadPdfBase64: vi.fn(),
}));

vi.mock("react-pdf", () => {
  const React = require("react");

  return {
    pdfjs: {
      GlobalWorkerOptions: {},
      version: "4.8.69",
    },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode;
      onLoadSuccess?: (payload: { numPages: number }) => void;
    }) => {
      React.useEffect(() => {
        onLoadSuccess?.({ numPages: 2 });
      }, [onLoadSuccess]);
      return <div data-testid="pdf-document">{children}</div>;
    },
    Page: ({
      pageNumber,
      onRenderSuccess,
    }: {
      pageNumber: number;
      onRenderSuccess?: (page: {
        pageNumber: number;
        rotate: number;
        getViewport: (params: { scale: number; rotation?: number }) => {
          width: number;
          height: number;
          convertToPdfPoint: (x: number, y: number) => number[];
        };
      }) => void;
    }) => {
      React.useEffect(() => {
        onRenderSuccess?.({
          pageNumber,
          rotate: 0,
          getViewport: ({ scale }: { scale: number }) => ({
            width: 612 * scale,
            height: 792 * scale,
            convertToPdfPoint: (x: number, y: number) => [x / scale, 792 - y / scale],
          }),
        });
      }, [pageNumber, onRenderSuccess]);

      return (
        <canvas
          data-testid={`pdf-canvas-${pageNumber}`}
          width={612}
          height={792}
        />
      );
    },
  };
});

const PDF_DATA = "JVBERi0xLjQK";

describe("pickPageNearestViewportTop", () => {
  it("returns the page whose top is closest to the container viewport top", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const page1 = document.createElement("div");
    page1.getBoundingClientRect = () =>
      ({ top: 80, left: 0, right: 100, bottom: 900, width: 100, height: 820, x: 0, y: 80 }) as DOMRect;
    const page2 = document.createElement("div");
    page2.getBoundingClientRect = () =>
      ({ top: 120, left: 0, right: 100, bottom: 940, width: 100, height: 820, x: 0, y: 120 }) as DOMRect;

    container.getBoundingClientRect = () =>
      ({ top: 100, left: 0, right: 100, bottom: 500, width: 100, height: 400, x: 0, y: 100 }) as DOMRect;

    const pages = new Map<number, HTMLElement>([
      [1, page1],
      [2, page2],
    ]);

    expect(pickPageNearestViewportTop(container, pages)).toBe(1);

    page1.getBoundingClientRect = () =>
      ({ top: 40, left: 0, right: 100, bottom: 860, width: 100, height: 820, x: 0, y: 40 }) as DOMRect;
    expect(pickPageNearestViewportTop(container, pages)).toBe(2);

    document.body.removeChild(container);
  });
});

describe("PdfPreview continuous scroll", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    class IntersectionObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(_callback: IntersectionObserverCallback) {}
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    synctexLookupFromBase64.mockReset();
    onJumpToLine.mockReset();
    synctexLookupFromBase64.mockResolvedValue(null);
  });

  it("renders every page in the scroll container", async () => {
    render(<PdfPreview pdfData={PDF_DATA} />);

    await waitFor(() => {
      expect(screen.getByTestId("pdf-canvas-1")).toBeInTheDocument();
      expect(screen.getByTestId("pdf-canvas-2")).toBeInTheDocument();
    });

    const pageWrappers = document.querySelectorAll("[data-pdf-page]");
    expect(pageWrappers).toHaveLength(2);
    expect(pageWrappers[0]).toHaveAttribute("data-pdf-page", "1");
    expect(pageWrappers[1]).toHaveAttribute("data-pdf-page", "2");
  });

  it("uses the clicked page number for SyncTeX lookup", async () => {
    synctexLookupFromBase64.mockResolvedValue({ line: 48, file: "main.tex" });

    render(
      <PdfPreview
        pdfData={PDF_DATA}
        synctexData="synctex-base64"
        projectFiles={["main.tex"]}
        onJumpToLine={onJumpToLine}
      />
    );

    const canvas = await screen.findByTestId("pdf-canvas-2");
    fireEvent.click(canvas, { pageX: 200, pageY: 500, clientX: 200, clientY: 500 });

    await waitFor(() => {
      expect(synctexLookupFromBase64).toHaveBeenCalled();
    });

    const lookupPage = synctexLookupFromBase64.mock.calls[0]?.[1];
    expect(lookupPage).toBe(2);
    expect(onJumpToLine).toHaveBeenCalledWith(48, "main.tex");
  });

  it("shows a crosshair cursor when SyncTeX is available", async () => {
    render(
      <PdfPreview
        pdfData={PDF_DATA}
        synctexData="synctex-base64"
        onJumpToLine={onJumpToLine}
      />
    );

    await screen.findByTestId("pdf-canvas-1");
    const pageWrapper = document.querySelector("[data-pdf-page='1']");
    expect(pageWrapper).toHaveClass("cursor-crosshair");
  });
});
