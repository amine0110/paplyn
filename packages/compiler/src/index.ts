import express from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { compileProject, isLatexEngine } from "./compile.js";
import type { CompileRequest } from "./types.js";

const execFileAsync = promisify(execFile);

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = parseInt(process.env.COMPILER_PORT || "3001", 10);
const TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || "60000", 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.COMPILE_MAX_FILE_SIZE_MB || "10", 10);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "compiler" });
});

app.get("/tex-package/:name", async (req, res) => {
  const raw = req.params.name?.trim() ?? "";
  const name = raw.replace(/\.sty$/i, "");
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    res.status(400).json({ error: "Invalid package name" });
    return;
  }

  try {
    const { stdout } = await execFileAsync("kpsewhich", [`${name}.sty`], {
      timeout: 5000,
    });
    const available = stdout.trim().length > 0;
    res.json({ package: name, available });
  } catch {
    res.json({ package: name, available: false });
  }
});

app.post("/compile", async (req, res) => {
  try {
    const body = req.body as CompileRequest;

    if (!body.mainFile || !body.files || !Array.isArray(body.files)) {
      res.status(400).json({ error: "mainFile and files array required" });
      return;
    }

    const totalSize = body.files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (totalSize > maxBytes) {
      res.status(400).json({ error: `Total file size exceeds ${MAX_FILE_SIZE_MB}MB limit` });
      return;
    }

    const engine = body.engine || "pdflatex";
    if (!isLatexEngine(engine)) {
      res.status(400).json({ error: "engine must be pdflatex, xelatex, or lualatex" });
      return;
    }

    const result = await compileProject({
      mainFile: body.mainFile,
      files: body.files,
      engine,
      timeoutMs: TIMEOUT_MS,
    });

    res.json(result);
  } catch (err) {
    console.error("Compile error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal compile error",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Compiler service listening on port ${PORT}`);
});
