import { readFileSync } from "fs";
import { join } from "path";

export type TemplateId = "blank" | "ieee" | "thesis" | "beamer";

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  mainFile: string;
  compiler: "pdflatex" | "xelatex";
  files: { path: string; content: string }[];
}

function loadTex(templateId: string, filename: string): string {
  return readFileSync(join(process.cwd(), "templates", templateId, filename), "utf-8");
}

export const templates: Record<TemplateId, Template> = {
  blank: {
    id: "blank",
    name: "Blank Article",
    description: "A simple article with abstract and sections",
    mainFile: "main.tex",
    compiler: "pdflatex",
    files: [{ path: "main.tex", content: loadTex("blank", "main.tex") }],
  },
  ieee: {
    id: "ieee",
    name: "IEEE Conference",
    description: "Two-column IEEE conference paper format",
    mainFile: "main.tex",
    compiler: "pdflatex",
    files: [{ path: "main.tex", content: loadTex("ieee", "main.tex") }],
  },
  thesis: {
    id: "thesis",
    name: "Thesis Chapter",
    description: "Single chapter for a thesis or dissertation",
    mainFile: "main.tex",
    compiler: "pdflatex",
    files: [{ path: "main.tex", content: loadTex("thesis", "main.tex") }],
  },
  beamer: {
    id: "beamer",
    name: "Beamer Slides",
    description: "Presentation slides with Beamer",
    mainFile: "main.tex",
    compiler: "pdflatex",
    files: [{ path: "main.tex", content: loadTex("beamer", "main.tex") }],
  },
};

export function getTemplateList() {
  return Object.values(templates).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
