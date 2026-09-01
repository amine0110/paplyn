import { execFile } from "child_process";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { promisify } from "util";
import type { CompileError, CompileResult, ProjectFile } from "./types.js";

const execFileAsync = promisify(execFile);

export const LATEX_ENGINES = ["pdflatex", "xelatex", "lualatex"] as const;
export type LatexEngine = (typeof LATEX_ENGINES)[number];

interface CompileOptions {
  mainFile: string;
  files: ProjectFile[];
  engine: LatexEngine;
  timeoutMs: number;
}

export function isLatexEngine(value: string): value is LatexEngine {
  return (LATEX_ENGINES as readonly string[]).includes(value);
}

export function buildEngineArgs(mainPath: string, workDir: string): string[] {
  return [
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-synctex=1",
    "-output-directory",
    workDir,
    mainPath,
  ];
}

export function getTexBaseName(mainFile: string): string {
  return mainFile.replace(/\.tex$/, "");
}

export function hasBibFiles(files: ProjectFile[]): boolean {
  return files.some((f) => f.path.endsWith(".bib"));
}

export function logRequestsBibliography(log: string): boolean {
  const patterns = [
    /No file .*\.bbl/i,
    /Rerun (LaTeX|to get (cross-references|outlines|bibliography|citations))/i,
    /There were undefined citations/i,
    /Please \(re\)run Biber/i,
    /Please run (Biber|bibtex)/i,
    /Package biblatex Warning/i,
  ];
  return patterns.some((pattern) => pattern.test(log));
}

export function detectBibliographyTool(
  files: ProjectFile[],
  mainFile: string,
  options: { log?: string; hasBcf?: boolean; auxContent?: string } = {}
): "bibtex" | "biber" | null {
  const texContent = files
    .filter((f) => f.path.endsWith(".tex"))
    .map((f) => f.content)
    .join("\n");

  const usesBiblatex =
    /\\usepackage(?:\[[^\]]*\])?\{biblatex\}/.test(texContent) ||
    /\\addbibresource/.test(texContent);
  const usesLegacyBib =
    /\\bibliography\{/.test(texContent) || /\\bibliographystyle\{/.test(texContent);

  if (options.hasBcf || usesBiblatex) return "biber";
  if (usesLegacyBib || hasBibFiles(files)) return "bibtex";

  if (options.auxContent && /\\bibdata\{/.test(options.auxContent)) {
    return "bibtex";
  }

  if (options.log && logRequestsBibliography(options.log)) {
    return /Biber|biblatex/i.test(options.log) ? "biber" : "bibtex";
  }

  return null;
}

export function needsBibliographyPass(
  files: ProjectFile[],
  log: string,
  auxContent?: string,
  hasBcf?: boolean
): boolean {
  if (hasBibFiles(files)) return true;
  if (hasBcf) return true;
  if (auxContent && (/\\bibdata\{/.test(auxContent) || /\\citation\{/.test(auxContent))) {
    return true;
  }
  return logRequestsBibliography(log);
}

export function extractToolErrors(log: string): CompileError[] {
  const errors: CompileError[] = [];

  for (const match of log.matchAll(/spawn (\S+) ENOENT/g)) {
    errors.push({
      message: `LaTeX tool "${match[1]}" not found on the compiler service (install TeX Live)`,
      severity: "error",
    });
  }

  return errors;
}

export function parseBibliographyErrors(log: string, tool: "bibtex" | "biber"): CompileError[] {
  const errors: CompileError[] = [];
  const marker = `--- ${tool} ---`;
  const sectionStart = log.indexOf(marker);
  const section =
    sectionStart === -1
      ? log
      : log.slice(sectionStart + marker.length).split(/\n--- /)[0] ?? "";

  if (tool === "bibtex") {
    for (const match of section.matchAll(/Warning--(.+)/g)) {
      errors.push({
        message: `BibTeX: ${match[1].trim()}`,
        severity: "warning",
      });
    }

    const lines = section.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineMatch = lines[i].match(/^---line (\d+) of file ([^-]+?)---$/);
      if (!lineMatch) continue;

      const message = lines[i + 1]?.trim();
      if (!message) continue;

      errors.push({
        message: `BibTeX: ${message}`,
        file: lineMatch[2].trim(),
        line: parseInt(lineMatch[1], 10),
        severity: "error",
      });
    }

    for (const match of section.matchAll(/I couldn't open (?:file name )?`([^']+)'/g)) {
      errors.push({
        message: `BibTeX: Could not open ${match[1]}`,
        severity: "error",
      });
    }
  }

  if (tool === "biber") {
    for (const match of section.matchAll(/ERROR - (.+)/g)) {
      errors.push({
        message: `Biber: ${match[1].trim()}`,
        severity: "error",
      });
    }

    for (const match of section.matchAll(/WARN - (.+)/g)) {
      errors.push({
        message: `Biber: ${match[1].trim()}`,
        severity: "warning",
      });
    }
  }

  return errors;
}

function parseLog(log: string, mainFile: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const errorMatch = line.match(/^!(.+)$/);
    if (errorMatch) {
      let file = mainFile;
      let lineNum: number | undefined;

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const locMatch = lines[j].match(/^l\.(\d+)\s/);
        if (locMatch) {
          lineNum = parseInt(locMatch[1], 10);
        }
        const fileMatch = lines[j].match(/^\(([^)]+\.tex)\)/);
        if (fileMatch) {
          file = fileMatch[1];
        }
      }

      errors.push({
        message: errorMatch[1].trim(),
        line: lineNum,
        file,
        severity: "error",
      });
    }

    const warnMatch = line.match(/^(?:LaTeX|Package \S+) Warning:\s*(.+)$/);
    if (warnMatch) {
      const fullMessage = warnMatch[1]!.trim();
      const onLine = fullMessage.match(/ on (?:input )?line (\d+)/i);
      const inFile = fullMessage.match(/ in ([^\s]+\.tex)/i);
      errors.push({
        message: line.trim(),
        severity: "warning",
        ...(onLine ? { line: parseInt(onLine[1], 10) } : {}),
        ...(inFile ? { file: inFile[1] } : {}),
      });
      continue;
    }

    if (/^Overfull \\hbox/.test(line) || /^Underfull \\hbox/.test(line)) {
      const lineRef = line.match(/ at lines (\d+)(?:--(\d+))?/);
      errors.push({
        message: line.trim(),
        severity: "warning",
        ...(lineRef ? { line: parseInt(lineRef[1], 10), file: mainFile } : {}),
      });
      continue;
    }

    if (/^There were undefined references\.?$/i.test(line.trim())) {
      errors.push({ message: line.trim(), severity: "warning" });
      continue;
    }

    if (/^There were undefined citations\.?$/i.test(line.trim())) {
      errors.push({ message: line.trim(), severity: "warning" });
    }
  }

  return errors;
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        HOME: cwd,
        TEXMFHOME: cwd,
      },
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "Command failed",
    };
  }
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function compileProject(options: CompileOptions): Promise<CompileResult> {
  const start = Date.now();
  const workDir = join(tmpdir(), `quire-compile-${randomUUID()}`);
  let fullLog = "";

  try {
    await mkdir(workDir, { recursive: true });

    for (const file of options.files) {
      const filePath = join(workDir, file.path);
      await mkdir(dirname(filePath), { recursive: true });

      if (file.content.startsWith("data:")) {
        const base64 = file.content.split(",")[1];
        if (base64) {
          await writeFile(filePath, Buffer.from(base64, "base64"));
        }
      } else {
        await writeFile(filePath, file.content, "utf-8");
      }
    }

    const mainPath = join(workDir, options.mainFile);
    const engine = options.engine;
    const engineArgs = buildEngineArgs(mainPath, workDir);
    const mainBase = getTexBaseName(options.mainFile);
    const maxRuns = 5;
    const perRunTimeout = Math.max(1000, Math.floor(options.timeoutMs / maxRuns));

    const appendRun = (label: string, stdout: string, stderr: string) => {
      fullLog += `\n--- ${label} ---\n${stdout}\n${stderr}`;
    };

    const engineResult = await runCommand(engine, engineArgs, workDir, perRunTimeout);
    appendRun(`${engine} pass 1`, engineResult.stdout, engineResult.stderr);

    const auxContent = await readOptionalFile(join(workDir, `${mainBase}.aux`));
    const hasBcf = await fileExists(join(workDir, `${mainBase}.bcf`));
    const bibNeeded = needsBibliographyPass(options.files, fullLog, auxContent, hasBcf);
    let bibTool: "bibtex" | "biber" | null = null;

    if (bibNeeded) {
      bibTool = detectBibliographyTool(options.files, options.mainFile, {
        log: fullLog,
        hasBcf,
        auxContent,
      });

      if (bibTool) {
        const bibResult = await runCommand(bibTool, [mainBase], workDir, perRunTimeout);
        appendRun(bibTool, bibResult.stdout, bibResult.stderr);

        for (let pass = 2; pass <= 3; pass++) {
          const result = await runCommand(engine, engineArgs, workDir, perRunTimeout);
          appendRun(`${engine} pass ${pass}`, result.stdout, result.stderr);
        }
      }
    } else {
      const result = await runCommand(engine, engineArgs, workDir, perRunTimeout);
      appendRun(`${engine} pass 2`, result.stdout, result.stderr);
    }

    const pdfPath = join(workDir, `${mainBase}.pdf`);
    let pdfBase64: string | undefined;
    let synctex: string | undefined;

    try {
      const pdfBuffer = await readFile(pdfPath);
      pdfBase64 = pdfBuffer.toString("base64");
    } catch {
      // PDF not generated
    }

    try {
      const synctexGzPath = join(workDir, `${mainBase}.synctex.gz`);
      const synctexPath = join(workDir, `${mainBase}.synctex`);
      let synctexBuffer: Buffer | undefined;
      try {
        synctexBuffer = await readFile(synctexGzPath);
      } catch {
        synctexBuffer = await readFile(synctexPath);
      }
      synctex = synctexBuffer.toString("base64");
    } catch {
      // SyncTeX not generated — reverse sync unavailable
    }

    const errors = [
      ...parseLog(fullLog, options.mainFile),
      ...extractToolErrors(fullLog),
      ...(bibTool ? parseBibliographyErrors(fullLog, bibTool) : []),
    ];

    if (!pdfBase64 && !errors.some((e) => e.severity === "error") && fullLog.trim()) {
      errors.push({
        message: "Compilation failed — PDF was not generated",
        severity: "error",
      });
    }

    const hasErrors = errors.some((e) => e.severity === "error");

    return {
      success: !hasErrors && !!pdfBase64,
      pdf: pdfBase64,
      synctex,
      log: fullLog,
      errors,
      durationMs: Date.now() - start,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
