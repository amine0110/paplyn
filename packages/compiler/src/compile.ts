import { execFile } from "child_process";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { promisify } from "util";
import type { CompileError, CompileResult, ProjectFile } from "./types.js";

const execFileAsync = promisify(execFile);

interface CompileOptions {
  mainFile: string;
  files: ProjectFile[];
  engine: "pdflatex" | "xelatex";
  timeoutMs: number;
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

    const warnMatch = line.match(/LaTeX Warning: (.+)/);
    if (warnMatch) {
      errors.push({
        message: warnMatch[1].trim(),
        severity: "warning",
      });
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
    const engineArgs = [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-output-directory",
      workDir,
      mainPath,
    ];

    const perRunTimeout = Math.floor(options.timeoutMs / 4);

    for (let pass = 0; pass < 2; pass++) {
      const { stdout, stderr } = await runCommand(engine, engineArgs, workDir, perRunTimeout);
      fullLog += `\n--- ${engine} pass ${pass + 1} ---\n${stdout}\n${stderr}`;
    }

    const hasBib = options.files.some((f) => f.path.endsWith(".bib"));
    if (hasBib) {
      const bibFile = options.files.find((f) => f.path.endsWith(".bib"));
      if (bibFile) {
        const bibBase = bibFile.path.replace(/\.bib$/, "");
        const { stdout, stderr } = await runCommand(
          "bibtex",
          [bibBase],
          workDir,
          perRunTimeout
        );
        fullLog += `\n--- bibtex ---\n${stdout}\n${stderr}`;

        for (let pass = 0; pass < 2; pass++) {
          const r = await runCommand(engine, engineArgs, workDir, perRunTimeout);
          fullLog += `\n--- ${engine} post-bib pass ${pass + 1} ---\n${r.stdout}\n${r.stderr}`;
        }
      }
    }

    const pdfPath = join(workDir, options.mainFile.replace(/\.tex$/, ".pdf"));
    let pdfBase64: string | undefined;

    try {
      const pdfBuffer = await readFile(pdfPath);
      pdfBase64 = pdfBuffer.toString("base64");
    } catch {
      // PDF not generated
    }

    const errors = parseLog(fullLog, options.mainFile);
    const hasErrors = errors.some((e) => e.severity === "error");

    return {
      success: !hasErrors && !!pdfBase64,
      pdf: pdfBase64,
      log: fullLog,
      errors,
      durationMs: Date.now() - start,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
