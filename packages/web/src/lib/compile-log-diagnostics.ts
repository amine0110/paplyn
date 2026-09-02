import type { AiCompileError } from "@/lib/ai-compile-fix-context";

const MAX_COMPILE_DIAGNOSTICS = 25;

function diagnosticKey(entry: AiCompileError): string {
  return `${entry.severity ?? "warning"}:${entry.file ?? ""}:${entry.line ?? ""}:${entry.message}`;
}

function dedupeDiagnostics(entries: AiCompileError[]): AiCompileError[] {
  const seen = new Set<string>();
  const out: AiCompileError[] = [];
  for (const entry of entries) {
    const key = diagnosticKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= MAX_COMPILE_DIAGNOSTICS) break;
  }
  return out;
}

/** Extract compiler warnings/errors that only appear in the raw LaTeX log. */
export function parseCompileDiagnosticsFromLog(
  log: string,
  mainFile = "main.tex"
): AiCompileError[] {
  if (!log.trim()) return [];

  const diagnostics: AiCompileError[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const latexWarning = trimmed.match(/^LaTeX Warning:\s*(.+)$/);
    if (latexWarning) {
      const message = latexWarning[1]!.trim();
      const onLine = message.match(/ on (?:input )?line (\d+)/i);
      const inFile = message.match(/ in ([^\s]+\.tex)/i);
      diagnostics.push({
        message,
        severity: "warning",
        ...(onLine ? { line: Number.parseInt(onLine[1]!, 10) } : {}),
        ...(inFile ? { file: inFile[1] } : {}),
      });
      continue;
    }

    const packageWarning = trimmed.match(/^Package ([^\s]+) Warning:\s*(.+)$/);
    if (packageWarning) {
      diagnostics.push({
        message: `Package ${packageWarning[1]} Warning: ${packageWarning[2]!.trim()}`,
        severity: "warning",
      });
      continue;
    }

    if (/^Overfull \\hbox/.test(trimmed) || /^Underfull \\hbox/.test(trimmed)) {
      const lineRef = trimmed.match(/ at lines (\d+)(?:--(\d+))?/);
      diagnostics.push({
        message: trimmed,
        severity: "warning",
        ...(lineRef ? { line: Number.parseInt(lineRef[1]!, 10), file: mainFile } : {}),
      });
      continue;
    }

    if (/^Overfull \\vbox/.test(trimmed) || /^Underfull \\vbox/.test(trimmed)) {
      diagnostics.push({ message: trimmed, severity: "warning" });
      continue;
    }

    if (/^There were undefined references\.?$/i.test(trimmed)) {
      diagnostics.push({ message: trimmed, severity: "warning" });
      continue;
    }

    if (/^There were undefined citations\.?$/i.test(trimmed)) {
      diagnostics.push({ message: trimmed, severity: "warning" });
      continue;
    }

    const styNotFound = trimmed.match(/File `([^']+\.sty)' not found/i);
    if (styNotFound) {
      diagnostics.push({
        message: trimmed,
        severity: "error",
      });
      continue;
    }

    const latexStyError = trimmed.match(/LaTeX Error: File `([^']+\.sty)' not found/i);
    if (latexStyError) {
      diagnostics.push({
        message: trimmed,
        severity: "error",
      });
      continue;
    }

    if (/^! Undefined control sequence\.?$/i.test(trimmed)) {
      const nextLine = lines[i + 1]?.trim() ?? "";
      const commandMatch = nextLine.match(/\\([a-zA-Z@]+)/);
      diagnostics.push({
        message: commandMatch
          ? `Undefined control sequence. ${commandMatch[0]}`
          : trimmed,
        severity: "error",
        ...(lines[i + 1]?.match(/\bl\.(\d+)/)
          ? { line: Number.parseInt(lines[i + 1]!.match(/\bl\.(\d+)/)![1]!, 10) }
          : {}),
      });
      continue;
    }

    const citeUndefined = trimmed.match(/^Citation `([^']+)' on page \d+ undefined/i);
    if (citeUndefined) {
      diagnostics.push({
        message: trimmed,
        severity: "warning",
      });
      continue;
    }

    const refUndefined = trimmed.match(/^Reference `([^']+)' on page \d+ undefined/i);
    if (refUndefined) {
      diagnostics.push({
        message: trimmed,
        severity: "warning",
      });
    }
  }

  return dedupeDiagnostics(diagnostics);
}

export function mergeCompileDiagnostics(
  errors: AiCompileError[] | undefined,
  log: string | undefined,
  options?: { mainFile?: string }
): AiCompileError[] {
  const fromErrors = (errors ?? []).map((entry) => ({
    ...entry,
    severity: entry.severity ?? ("error" as const),
  }));
  const fromLog = log?.trim()
    ? parseCompileDiagnosticsFromLog(log, options?.mainFile ?? "main.tex")
    : [];

  return dedupeDiagnostics([...fromErrors, ...fromLog]);
}
