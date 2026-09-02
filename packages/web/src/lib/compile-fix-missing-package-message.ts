import { buildReportIssueHref } from "@/lib/user-reports-url";
import type { CompileFixStopOutcome } from "@/lib/compile-missing-package";

export function buildMissingCompilerPackageUserMessage(options: {
  packageName: string;
  command?: string;
  page?: string;
}): string {
  const { packageName, command, page } = options;
  const commandPhrase = command ? ` (command \\${command.replace(/^\\/, "")})` : "";
  const reportHref = buildReportIssueHref(page, "report", {
    title: `LaTeX package request: ${packageName}`,
    whatHappened:
      `My paper needs the LaTeX package "${packageName}"` +
      (command ? ` for \\${command.replace(/^\\/, "")}` : "") +
      ", which is not installed on Paplyn yet.",
    steps: `Package: ${packageName}${commandPhrase}`,
  });

  return (
    `This paper needs the LaTeX package **${packageName}**, which isn't installed on Paplyn yet.` +
    (command ? ` (missing command: \\${command.replace(/^\\/, "")})` : "") +
    ` [Request this package](${reportHref})`
  );
}

export function buildUnknownCommandUserMessage(options: {
  command: string;
  page?: string;
}): string {
  const command = options.command.replace(/^\\/, "");
  const reportHref = buildReportIssueHref(options.page, "report", {
    title: `Unknown LaTeX command: \\${command}`,
    whatHappened: `LaTeX doesn't know the command \\${command} when compiling my paper.`,
    steps: `Command: \\${command}`,
  });

  return `LaTeX doesn't know the command \\${command}. [Report this issue](${reportHref})`;
}

export function buildCompileFixStopUserMessage(
  outcome: CompileFixStopOutcome,
  page?: string
): string {
  if (outcome.kind === "unknown_command") {
    return buildUnknownCommandUserMessage({ command: outcome.command, page });
  }
  return buildMissingCompilerPackageUserMessage({
    packageName: outcome.package,
    command: outcome.command,
    page,
  });
}

export function buildPackageAddedUserMessage(options: {
  packageName: string;
  commands?: string[];
}): string {
  const { packageName, commands } = options;
  if (commands?.length) {
    const commandList = commands.map((cmd) => `\\${cmd.replace(/^\\/, "")}`).join(", ");
    return `Added the ${packageName} package so ${commandList} works.`;
  }
  return `Added the ${packageName} package to fix the compile error.`;
}

/** Infer which package was added from a replace_lines / apply_edit payload. */
export function detectAddedPackagesFromEdit(
  originalContent: string,
  newContent: string
): string[] {
  const usepackageRe = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  const before = new Set<string>();
  const after = new Set<string>();

  for (const match of originalContent.matchAll(usepackageRe)) {
    for (const pkg of (match[1] ?? "").split(",")) {
      const name = pkg.trim();
      if (name) before.add(name);
    }
  }
  for (const match of newContent.matchAll(usepackageRe)) {
    for (const pkg of (match[1] ?? "").split(",")) {
      const name = pkg.trim();
      if (name) after.add(name);
    }
  }

  return [...after].filter((pkg) => !before.has(pkg));
}
