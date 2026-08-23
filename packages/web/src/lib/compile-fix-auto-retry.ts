/** One automatic compile-fix retry after a post-fix compile still fails. */

export interface CompileFixRetrySession {
  /** User initiated a compile-fix flow; one auto-retry is allowed per session. */
  active: boolean;
  autoRetryUsed: boolean;
  /** Compile was scheduled after compile-fix edits landed. */
  awaitingPostFixCompile: boolean;
}

export function createCompileFixRetrySession(): CompileFixRetrySession {
  return {
    active: false,
    autoRetryUsed: false,
    awaitingPostFixCompile: false,
  };
}

export function beginCompileFixRetrySession(session: CompileFixRetrySession): void {
  session.active = true;
  session.autoRetryUsed = false;
  session.awaitingPostFixCompile = false;
}

export function markCompileFixEditsApplied(
  session: CompileFixRetrySession,
  appliedEditCount: number
): void {
  if (!session.active || appliedEditCount <= 0) return;
  session.awaitingPostFixCompile = true;
}

export interface CompileFixAutoRetryDecision {
  shouldRetry: boolean;
  reason?: "still_has_errors" | "success" | "no_session" | "no_edits" | "retry_used";
}

export function decideCompileFixAutoRetry(
  session: CompileFixRetrySession,
  compileErrorCount: number
): CompileFixAutoRetryDecision {
  if (!session.awaitingPostFixCompile) {
    return { shouldRetry: false, reason: "no_edits" };
  }

  session.awaitingPostFixCompile = false;

  if (!session.active) {
    return { shouldRetry: false, reason: "no_session" };
  }

  if (compileErrorCount <= 0) {
    session.active = false;
    return { shouldRetry: false, reason: "success" };
  }

  if (session.autoRetryUsed) {
    session.active = false;
    return { shouldRetry: false, reason: "retry_used" };
  }

  session.autoRetryUsed = true;
  return { shouldRetry: true, reason: "still_has_errors" };
}
