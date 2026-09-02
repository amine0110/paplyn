import { describe, expect, it } from "vitest";
import {
  COMPILE_FIX_MAX_AUTO_RETRIES,
  beginCompileFixRetrySession,
  createCompileFixRetrySession,
  decideCompileFixAutoRetry,
  endCompileFixRetrySession,
  fingerprintCompileErrors,
  markCompileFixEditsApplied,
} from "./compile-fix-auto-retry";

describe("compile-fix auto-retry session", () => {
  it("retries after first failure when edits landed", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 1);

    expect(
      decideCompileFixAutoRetry(session, 2, fingerprintCompileErrors([{ message: "error A" }]))
    ).toEqual({
      shouldRetry: true,
      reason: "still_has_errors",
    });
    expect(session.autoRetryCount).toBe(1);
  });

  it("stops on unknown_command", () => {
    const session = createCompileFixRetrySession();
    session.active = true;
    session.awaitingPostFixCompile = true;
    expect(
      decideCompileFixAutoRetry(session, 1, "fp", {
        errors: [{ message: "Undefined control sequence. \\customMacro" }],
      })
    ).toEqual({ shouldRetry: false, reason: "unknown_command" });
  });

  it("stops on missing_compiler_package", () => {
    const session = createCompileFixRetrySession();
    session.active = true;
    session.awaitingPostFixCompile = true;
    expect(
      decideCompileFixAutoRetry(session, 1, "fp", {
        errors: [{ message: "LaTeX Error: File `minted.sty' not found." }],
      })
    ).toEqual({ shouldRetry: false, reason: "missing_compiler_package" });
  });

  it(`stops on retry_used after ${COMPILE_FIX_MAX_AUTO_RETRIES} auto-retries`, () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);

    for (let round = 0; round < COMPILE_FIX_MAX_AUTO_RETRIES; round += 1) {
      markCompileFixEditsApplied(session, 1);
      const fingerprint = fingerprintCompileErrors([{ message: `error ${round}` }]);
      expect(decideCompileFixAutoRetry(session, 1, fingerprint)).toEqual({
        shouldRetry: true,
        reason: "still_has_errors",
      });
    }

    markCompileFixEditsApplied(session, 1);
    expect(
      decideCompileFixAutoRetry(
        session,
        1,
        fingerprintCompileErrors([{ message: "error final" }])
      )
    ).toEqual({
      shouldRetry: false,
      reason: "retry_used",
    });
    expect(session.active).toBe(false);
  });

  it("does not retry when no edits landed", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 0);

    expect(decideCompileFixAutoRetry(session, 2)).toEqual({
      shouldRetry: false,
      reason: "no_edits",
    });
  });

  it("ends session on successful compile", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 1);

    expect(decideCompileFixAutoRetry(session, 0)).toEqual({
      shouldRetry: false,
      reason: "success",
    });
    expect(session.active).toBe(false);
  });

  it("stops when the error set is unchanged (no progress)", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 1);

    const fingerprint = fingerprintCompileErrors([
      { message: "Undefined control sequence", file: "main.tex", line: 12 },
    ]);

    expect(decideCompileFixAutoRetry(session, 1, fingerprint)).toEqual({
      shouldRetry: true,
      reason: "still_has_errors",
    });

    markCompileFixEditsApplied(session, 1);
    expect(decideCompileFixAutoRetry(session, 1, fingerprint)).toEqual({
      shouldRetry: false,
      reason: "no_progress",
    });
    expect(session.active).toBe(false);
  });

  it("endCompileFixRetrySession clears active retry state", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 1);
    endCompileFixRetrySession(session);
    expect(session.active).toBe(false);
    expect(session.awaitingPostFixCompile).toBe(false);
    expect(session.autoRetryCount).toBe(0);
    expect(session.lastErrorFingerprint).toBeUndefined();
  });
});

describe("fingerprintCompileErrors", () => {
  it("ignores warnings and sorts error entries", () => {
    expect(
      fingerprintCompileErrors([
        { message: "b", severity: "error" },
        { message: "a", severity: "warning" },
        { message: "a", severity: "error", file: "main.tex", line: 3 },
      ])
    ).toBe("::b|main.tex:3:a");
  });
});
