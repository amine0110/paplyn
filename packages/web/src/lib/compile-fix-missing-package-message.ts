import { buildReportIssueHref } from "@/lib/user-reports-url";

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
