import type { AiCompileError } from "@/lib/ai-compile-fix-context";
import {
  isPackageAvailableInCompiler,
  normalizeLatexPackageName,
  packageForUndefinedCommand,
  UNDEFINED_COMMAND_PACKAGE_MAP,
} from "@/lib/latex-compiler-packages";

const STY_NOT_FOUND_RE = /File `([^']+\.sty)' not found/i;
const LATEX_ERROR_STY_NOT_FOUND_RE = /LaTeX Error: File `([^']+\.sty)' not found/i;
const UNDEFINED_CONTROL_SEQUENCE_RE = /undefined control sequence/i;
const LATEX_COMMAND_RE = /\\([a-zA-Z@]+)/g;

export type MissingCompilerPackageOutcome = {
  kind: "missing_compiler_package";
  package: string;
  command?: string;
};

export type UnknownCommandOutcome = {
  kind: "unknown_command";
  command: string;
};

export type CompileFixStopOutcome = MissingCompilerPackageOutcome | UnknownCommandOutcome;

export type CompileMissingPackageAnalysis =
  | { kind: "none" }
  | { kind: "available"; packages: string[] }
  | CompileFixStopOutcome;

function styNameToPackage(styFile: string): string {
  return normalizeLatexPackageName(styFile.replace(/\.sty$/i, ""));
}

/** Extract a missing .sty name from a compile error or log line. */
export function parseMissingStyPackage(message: string): string | null {
  const styMatch =
    message.match(STY_NOT_FOUND_RE) ?? message.match(LATEX_ERROR_STY_NOT_FOUND_RE);
  if (!styMatch?.[1]) return null;
  return styNameToPackage(styMatch[1]);
}

/** Extract undefined LaTeX commands referenced in compile errors. */
export function detectUndefinedCommands(
  errors: readonly { message: string }[]
): string[] {
  const commands = new Set<string>();

  for (const error of errors) {
    const message = error.message;

    for (const match of message.matchAll(LATEX_COMMAND_RE)) {
      const cmd = match[1];
      if (!cmd) continue;
      if (cmd in UNDEFINED_COMMAND_PACKAGE_MAP) {
        commands.add(cmd);
      }
    }

    if (UNDEFINED_CONTROL_SEQUENCE_RE.test(message)) {
      for (const cmd of Object.keys(UNDEFINED_COMMAND_PACKAGE_MAP)) {
        if (message.includes(`\\${cmd}`) || new RegExp(`\\b${cmd}\\b`).test(message)) {
          commands.add(cmd);
        }
      }
    }
  }

  return [...commands];
}

/** Packages that may be inserted when compile errors cite undefined commands or missing .sty files. */
export function getResolvablePackagesForCompileErrors(
  errors: readonly { message: string }[]
): string[] {
  const packages = new Set<string>();

  for (const error of errors) {
    const styPackage = parseMissingStyPackage(error.message);
    if (styPackage) packages.add(styPackage);
  }

  for (const cmd of detectUndefinedCommands(errors)) {
    const pkg = packageForUndefinedCommand(cmd);
    if (pkg) packages.add(pkg);
  }

  return [...packages];
}

/** Packages the compiler image provides that match the current compile errors. */
export function getAllowedPackagesForCompileErrors(
  errors: readonly { message: string }[]
): string[] {
  return getResolvablePackagesForCompileErrors(errors).filter((pkg) =>
    isPackageAvailableInCompiler(pkg)
  );
}

function findUnknownUndefinedCommand(
  errors: readonly { message: string }[]
): string | undefined {
  for (const error of errors) {
    if (!UNDEFINED_CONTROL_SEQUENCE_RE.test(error.message)) continue;

    const mapped = detectUndefinedCommands([error]);
    if (mapped.length > 0) continue;

    const commandMatch = error.message.match(/\\([a-zA-Z@]+)/);
    if (commandMatch?.[1]) return commandMatch[1];

    const lLineMatch = error.message.match(/\bl\.\d+[^\n]*\\([a-zA-Z@]+)/);
    if (lLineMatch?.[1]) return lLineMatch[1];
  }
  return undefined;
}

/**
 * Decide whether compile-fix should stop (missing unavailable package) or proceed
 * with an allowlisted in-image package insert.
 */
export function analyzeCompileMissingPackage(options: {
  errors: readonly AiCompileError[];
  log?: string;
}): CompileMissingPackageAnalysis {
  const { errors, log } = options;
  const messages = [
    ...errors.map((entry) => entry.message),
    ...(log?.trim() ? log.split("\n") : []),
  ];

  const resolvedPackages = new Set<string>();
  for (const message of messages) {
    const styPackage = parseMissingStyPackage(message);
    if (styPackage) resolvedPackages.add(styPackage);
  }
  for (const pkg of getResolvablePackagesForCompileErrors(errors)) {
    resolvedPackages.add(pkg);
  }

  for (const pkg of resolvedPackages) {
    if (!isPackageAvailableInCompiler(pkg)) {
      const command = [...detectUndefinedCommands(errors)]
        .find((cmd) => packageForUndefinedCommand(cmd) === pkg);
      return {
        kind: "missing_compiler_package",
        package: pkg,
        ...(command ? { command } : {}),
      };
    }
  }

  const unknownCommand = findUnknownUndefinedCommand(errors);
  if (unknownCommand) {
    return {
      kind: "unknown_command",
      command: unknownCommand,
    };
  }

  const available = getAllowedPackagesForCompileErrors(errors);
  if (available.length > 0) {
    return { kind: "available", packages: available };
  }

  return { kind: "none" };
}

export function isMissingCompilerPackageOutcome(
  analysis: CompileMissingPackageAnalysis
): analysis is MissingCompilerPackageOutcome {
  return analysis.kind === "missing_compiler_package";
}

export function isUnknownCommandOutcome(
  analysis: CompileMissingPackageAnalysis
): analysis is UnknownCommandOutcome {
  return analysis.kind === "unknown_command";
}

export function isCompileFixStopOutcome(
  analysis: CompileMissingPackageAnalysis
): analysis is CompileFixStopOutcome {
  return analysis.kind === "missing_compiler_package" || analysis.kind === "unknown_command";
}
