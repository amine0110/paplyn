import { describe, expect, it, vi } from "vitest";
import {
  DETECTED_ERROR_DEDUP_TTL_MS,
  hashDetectedErrorDedupKey,
  markDetectedErrorReported,
  shouldSkipDetectedErrorReport,
  titleForDetectedErrorKind,
} from "@/lib/report-detected-error-dedup";
import { mapReportSourceToNotion } from "@/lib/user-reports-validation";
import { COMPILE_FIX_USER_MESSAGE } from "@/lib/ai-compile-fix-intent";

describe("report-detected-error dedup", () => {
  it("hashes kind, message, and page deterministically", () => {
    const a = hashDetectedErrorDedupKey("compile", "Missing $", "/project/1");
    const b = hashDetectedErrorDedupKey("compile", "Missing $", "/project/1");
    const c = hashDetectedErrorDedupKey("compile", "Other error", "/project/1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("dedups within the TTL window", () => {
    const store = new Map<string, string>();
    const key = hashDetectedErrorDedupKey("cite", "Could not resolve DOI", "/project/2");
    const now = 1_700_000_000_000;

    expect(
      shouldSkipDetectedErrorReport(key, (k) => store.get(k) ?? null, now),
    ).toBe(false);

    markDetectedErrorReported(key, (k, v) => store.set(k, v), now);

    expect(
      shouldSkipDetectedErrorReport(key, (k) => store.get(k) ?? null, now + 1_000),
    ).toBe(true);

    expect(
      shouldSkipDetectedErrorReport(
        key,
        (k) => store.get(k) ?? null,
        now + DETECTED_ERROR_DEDUP_TTL_MS + 1,
      ),
    ).toBe(false);
  });

  it("maps auto-report titles by kind", () => {
    expect(titleForDetectedErrorKind("compile")).toBe("Compile failed");
    expect(titleForDetectedErrorKind("cite")).toBe("Cite failed");
    expect(titleForDetectedErrorKind("ai")).toBe("AI request failed");
    expect(titleForDetectedErrorKind("unexpected")).toBe("Unexpected error");
  });

  it("uses Source Error for auto payload source field", () => {
    expect(mapReportSourceToNotion("error")).toBe("Error");
  });
});

describe("reportDetectedError client helper", () => {
  it("POSTs auto-detected reports with source error", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/user-reports/csrf") {
          return new Response(JSON.stringify({ csrfToken: "csrf-1" }), { status: 200 });
        }
        if (url === "/api/user-reports") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { reportDetectedError } = await import("@/lib/report-detected-error");
    const result = await reportDetectedError({
      kind: "compile",
      message: "Undefined control sequence",
      page: "/project/abc",
    });

    expect(result.sent).toBe(true);
    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(([u]) => u === "/api/user-reports");
    expect(postCall).toBeDefined();
    const body = JSON.parse(String((postCall?.[1] as RequestInit)?.body));
    expect(body.source).toBe("error");
    expect(body.autoDetected).toBe(true);
    expect(body.whatHappened).toBe("Undefined control sequence");
    expect(body.title).toBe("Compile failed");
    expect(body.page).toBe("/project/abc");

    vi.unstubAllGlobals();
  });

  it("skips auto-report when only the compile-fix AI chip prompt is provided", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());

    const { reportDetectedError } = await import("@/lib/report-detected-error");
    const result = await reportDetectedError({
      kind: "compile",
      message: COMPILE_FIX_USER_MESSAGE,
      page: "/project/abc",
    });

    expect(result).toEqual({ sent: false, skipped: true });
    expect(fetch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("uses fallback text when the compile-fix AI chip prompt leaks into a report", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/user-reports/csrf") {
          return new Response(JSON.stringify({ csrfToken: "csrf-1" }), { status: 200 });
        }
        if (url === "/api/user-reports") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { reportDetectedError } = await import("@/lib/report-detected-error");
    const result = await reportDetectedError({
      kind: "compile",
      message: COMPILE_FIX_USER_MESSAGE,
      fallbackMessage: "L12: Undefined control sequence \\foo",
      page: "/project/abc",
    });

    expect(result.sent).toBe(true);
    const fetchMock = vi.mocked(fetch);
    const postCall = fetchMock.mock.calls.find(([u]) => u === "/api/user-reports");
    const body = JSON.parse(String((postCall?.[1] as RequestInit)?.body));
    expect(body.whatHappened).toBe("L12: Undefined control sequence \\foo");
    expect(body.whatHappened).not.toBe(COMPILE_FIX_USER_MESSAGE);

    vi.unstubAllGlobals();
  });
});
