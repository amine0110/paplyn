/** Bounded automatic compile-fix retries after post-fix compiles still fail. */

import {
  analyzeCompileMissingPackage,
  isMissingCompilerPackageOutcome,
} from "@/lib/compile-missing-package";

/** Total compile-fix rounds per user session (first manual turn + auto-retries). */
export const COMPILE_FIX_MAX_ROUNDS = 4;

/** Automatic follow-up compile-fix turns after the first manual compile-fix. */
export const COMPILE_FIX_MAX_AUTO_RETRIES = COMPILE_FIX_MAX_ROUNDS - 1;

export interface CompileFixRetrySession {
  /** User initiated a compile-fix flow; bounded auto-retries are allowed per session. */
  active: boolean;
  /** How many automatic compile-fix retries have already been scheduled. */
  autoRetryCount: number;
  /** Compile was scheduled after compile-fix edits landed. */
  awaitingPostFixCompile: boolean;
  /** Fingerprint of errors from the last post-fix compile (for no-progress detection). */
  lastErrorFingerprint?: string;
}

export interface CompileErrorFingerprintInput {
  message: string;
  file?: string;
  line?: number;
  severity?: "error" | "warning";
}

export function createCompileFixRetrySession(): CompileFixRetrySession {
  return {
    active: false,
    autoRetryCount: 0,
    awaitingPostFixCompile: false,
  };
}

export function beginCompileFixRetrySession(session: CompileFixRetrySession): void {
  session.active = true;
  session.autoRetryCount = 0;
  session.awaitingPostFixCompile = false;
  session.lastErrorFingerprint = undefined;
}

export function endCompileFixRetrySession(session: CompileFixRetrySession): void {
  session.active = false;
  session.autoRetryCount = 0;
  session.awaitingPostFixCompile = false;
  session.lastErrorFingerprint = undefined;
}

export function markCompileFixEditsApplied(
  session: CompileFixRetrySession,
  appliedEditCount: number
): void {
  if (!session.active || appliedEditCount <= 0) return;
  session.awaitingPostFixCompile = true;
}

/** Stable fingerprint of compile errors for no-progress detection. */
export function fingerprintCompileErrors(errors: CompileErrorFingerprintInput[]): string {
  return errors
    .filter((entry) => entry.severity !== "warning")
    .map((entry) => `${entry.file ?? ""}:${entry.line ?? ""}:${entry.message}`)
    .sort()
    .join("|");
}

export interface CompileFixAutoRetryDecision {
  shouldRetry: boolean;
  reason?:
    | "still_has_errors"
    | "success"
    | "no_session"
    | "no_edits"
    | "retry_used"
    | "no_progress"
    | "missing_compiler_package";
}

export function decideCompileFixAutoRetry(
  session: CompileFixRetrySession,
  compileErrorCount: number,
  errorFingerprint?: string,
  options?: {
    errors?: CompileErrorFingerprintInput[];
    log?: string;
  }
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

  if (options?.errors?.length) {
    const missingPackage = analyzeCompileMissingPackage({
      errors: options.errors,
      log: options.log,
    });
    if (isMissingCompilerPackageOutcome(missingPackage)) {
      session.active = false;
      return { shouldRetry: false, reason: "missing_compiler_package" };
    }
  }

  if (
    errorFingerprint &&
    session.lastErrorFingerprint &&
    errorFingerprint === session.lastErrorFingerprint
  ) {
    session.active = false;
    return { shouldRetry: false, reason: "no_progress" };
  }

  if (session.autoRetryCount >= COMPILE_FIX_MAX_AUTO_RETRIES) {
    session.active = false;
    return { shouldRetry: false, reason: "retry_used" };
  }

  session.autoRetryCount += 1;
  if (errorFingerprint) {
    session.lastErrorFingerprint = errorFingerprint;
  }
  return { shouldRetry: true, reason: "still_has_errors" };
}
