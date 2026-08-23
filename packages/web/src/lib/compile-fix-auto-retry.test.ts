import { describe, expect, it } from "vitest";
import {
  beginCompileFixRetrySession,
  createCompileFixRetrySession,
  decideCompileFixAutoRetry,
  markCompileFixEditsApplied,
} from "./compile-fix-auto-retry";

describe("compile-fix auto-retry session", () => {
  it("retries once when post-fix compile still has errors", () => {
    const session = createCompileFixRetrySession();
    beginCompileFixRetrySession(session);
    markCompileFixEditsApplied(session, 1);

    expect(decideCompileFixAutoRetry(session, 2)).toEqual({
      shouldRetry: true,
      reason: "still_has_errors",
    });

    session.awaitingPostFixCompile = true;
    markCompileFixEditsApplied(session, 1);
    expect(decideCompileFixAutoRetry(session, 1)).toEqual({
      shouldRetry: false,
      reason: "retry_used",
    });
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
});
