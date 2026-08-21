export interface ProjectFile {
  path: string;
  content: string;
}

export interface CompileRequest {
  mainFile: string;
  files: ProjectFile[];
  engine?: "pdflatex" | "xelatex" | "lualatex";
}

export interface CompileError {
  line?: number;
  file?: string;
  message: string;
  severity: "error" | "warning";
}

export interface CompileResult {
  success: boolean;
  pdf?: string;
  log: string;
  errors: CompileError[];
  durationMs: number;
}
