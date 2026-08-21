import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

export const LATEX_ENVIRONMENTS = [
  "abstract",
  "align",
  "align*",
  "center",
  "enumerate",
  "equation",
  "equation*",
  "figure",
  "figure*",
  "itemize",
  "table",
  "tabular",
  "thebibliography",
  "verbatim",
] as const;

const LATEX_COMMAND_DEFS: Array<{ label: string; detail: string; type: Completion["type"] }> = [
  { label: "\\documentclass", detail: "Document class", type: "keyword" },
  { label: "\\usepackage", detail: "Load package", type: "keyword" },
  { label: "\\begin{document}", detail: "Start document body", type: "keyword" },
  { label: "\\end{document}", detail: "End document body", type: "keyword" },
  { label: "\\part", detail: "Part heading", type: "keyword" },
  { label: "\\chapter", detail: "Chapter heading", type: "keyword" },
  { label: "\\section", detail: "Section heading", type: "keyword" },
  { label: "\\subsection", detail: "Subsection heading", type: "keyword" },
  { label: "\\subsubsection", detail: "Subsubsection heading", type: "keyword" },
  { label: "\\paragraph", detail: "Paragraph heading", type: "keyword" },
  { label: "\\subparagraph", detail: "Subparagraph heading", type: "keyword" },
  { label: "\\tableofcontents", detail: "Table of contents", type: "keyword" },
  { label: "\\listoffigures", detail: "List of figures", type: "keyword" },
  { label: "\\listoftables", detail: "List of tables", type: "keyword" },
  { label: "\\appendix", detail: "Start appendix", type: "keyword" },
  { label: "\\title", detail: "Document title", type: "keyword" },
  { label: "\\author", detail: "Document author", type: "keyword" },
  { label: "\\date", detail: "Document date", type: "keyword" },
  { label: "\\maketitle", detail: "Render title block", type: "keyword" },
  { label: "\\abstract", detail: "Abstract environment", type: "keyword" },
  { label: "\\textbf", detail: "Bold text", type: "keyword" },
  { label: "\\textit", detail: "Italic text", type: "keyword" },
  { label: "\\textrm", detail: "Roman text", type: "keyword" },
  { label: "\\texttt", detail: "Monospace text", type: "keyword" },
  { label: "\\textsf", detail: "Sans-serif text", type: "keyword" },
  { label: "\\emph", detail: "Emphasized text", type: "keyword" },
  { label: "\\underline", detail: "Underlined text", type: "keyword" },
  { label: "\\textsc", detail: "Small caps", type: "keyword" },
  { label: "\\label", detail: "Set a reference label", type: "keyword" },
  { label: "\\ref", detail: "Reference by label", type: "keyword" },
  { label: "\\eqref", detail: "Equation reference", type: "keyword" },
  { label: "\\pageref", detail: "Page reference", type: "keyword" },
  { label: "\\cite", detail: "Bibliography citation", type: "keyword" },
  { label: "\\citep", detail: "Parenthetical citation", type: "keyword" },
  { label: "\\citet", detail: "Textual citation", type: "keyword" },
  { label: "\\bibliography", detail: "Bibliography file", type: "keyword" },
  { label: "\\bibliographystyle", detail: "Bibliography style", type: "keyword" },
  { label: "\\includegraphics", detail: "Include image", type: "keyword" },
  { label: "\\caption", detail: "Figure/table caption", type: "keyword" },
  { label: "\\centering", detail: "Center content", type: "keyword" },
  { label: "\\hline", detail: "Horizontal rule in table", type: "keyword" },
  { label: "\\multicolumn", detail: "Span table columns", type: "keyword" },
  { label: "\\multirow", detail: "Span table rows", type: "keyword" },
  { label: "\\item", detail: "List item", type: "keyword" },
  { label: "\\footnote", detail: "Footnote", type: "keyword" },
  { label: "\\url", detail: "URL link", type: "keyword" },
  { label: "\\href", detail: "Hyperlink", type: "keyword" },
  { label: "\\newline", detail: "Line break", type: "keyword" },
  { label: "\\newpage", detail: "New page", type: "keyword" },
  { label: "\\clearpage", detail: "Clear page", type: "keyword" },
  { label: "\\vspace", detail: "Vertical space", type: "keyword" },
  { label: "\\hspace", detail: "Horizontal space", type: "keyword" },
  { label: "\\noindent", detail: "Suppress paragraph indent", type: "keyword" },
  { label: "\\input", detail: "Include file", type: "keyword" },
  { label: "\\include", detail: "Include file (new page)", type: "keyword" },
  { label: "\\includeonly", detail: "Compile subset of files", type: "keyword" },
  { label: "\\begin", detail: "Begin environment", type: "keyword" },
  { label: "\\end", detail: "End environment", type: "keyword" },
  { label: "\\frac", detail: "Fraction", type: "function" },
  { label: "\\sqrt", detail: "Square root", type: "function" },
  { label: "\\sum", detail: "Summation", type: "function" },
  { label: "\\prod", detail: "Product", type: "function" },
  { label: "\\int", detail: "Integral", type: "function" },
  { label: "\\iint", detail: "Double integral", type: "function" },
  { label: "\\iiint", detail: "Triple integral", type: "function" },
  { label: "\\oint", detail: "Contour integral", type: "function" },
  { label: "\\lim", detail: "Limit", type: "function" },
  { label: "\\infty", detail: "Infinity", type: "constant" },
  { label: "\\partial", detail: "Partial derivative", type: "constant" },
  { label: "\\nabla", detail: "Nabla / del", type: "constant" },
  { label: "\\cdot", detail: "Center dot", type: "constant" },
  { label: "\\times", detail: "Multiplication cross", type: "constant" },
  { label: "\\pm", detail: "Plus-minus", type: "constant" },
  { label: "\\mp", detail: "Minus-plus", type: "constant" },
  { label: "\\leq", detail: "Less than or equal", type: "constant" },
  { label: "\\geq", detail: "Greater than or equal", type: "constant" },
  { label: "\\neq", detail: "Not equal", type: "constant" },
  { label: "\\approx", detail: "Approximately equal", type: "constant" },
  { label: "\\equiv", detail: "Equivalent", type: "constant" },
  { label: "\\in", detail: "Element of", type: "constant" },
  { label: "\\subset", detail: "Subset", type: "constant" },
  { label: "\\subseteq", detail: "Subset or equal", type: "constant" },
  { label: "\\forall", detail: "For all", type: "constant" },
  { label: "\\exists", detail: "There exists", type: "constant" },
  { label: "\\left", detail: "Left delimiter", type: "function" },
  { label: "\\right", detail: "Right delimiter", type: "function" },
  { label: "\\mathbf", detail: "Bold math", type: "function" },
  { label: "\\mathrm", detail: "Roman math", type: "function" },
  { label: "\\mathcal", detail: "Calligraphic math", type: "function" },
  { label: "\\mathbb", detail: "Blackboard bold", type: "function" },
  { label: "\\alpha", detail: "Greek alpha", type: "constant" },
  { label: "\\beta", detail: "Greek beta", type: "constant" },
  { label: "\\gamma", detail: "Greek gamma", type: "constant" },
  { label: "\\delta", detail: "Greek delta", type: "constant" },
  { label: "\\epsilon", detail: "Greek epsilon", type: "constant" },
  { label: "\\varepsilon", detail: "Greek varepsilon", type: "constant" },
  { label: "\\zeta", detail: "Greek zeta", type: "constant" },
  { label: "\\eta", detail: "Greek eta", type: "constant" },
  { label: "\\theta", detail: "Greek theta", type: "constant" },
  { label: "\\lambda", detail: "Greek lambda", type: "constant" },
  { label: "\\mu", detail: "Greek mu", type: "constant" },
  { label: "\\nu", detail: "Greek nu", type: "constant" },
  { label: "\\pi", detail: "Greek pi", type: "constant" },
  { label: "\\rho", detail: "Greek rho", type: "constant" },
  { label: "\\sigma", detail: "Greek sigma", type: "constant" },
  { label: "\\tau", detail: "Greek tau", type: "constant" },
  { label: "\\phi", detail: "Greek phi", type: "constant" },
  { label: "\\omega", detail: "Greek omega", type: "constant" },
  { label: "\\Gamma", detail: "Greek Gamma", type: "constant" },
  { label: "\\Delta", detail: "Greek Delta", type: "constant" },
  { label: "\\Theta", detail: "Greek Theta", type: "constant" },
  { label: "\\Lambda", detail: "Greek Lambda", type: "constant" },
  { label: "\\Sigma", detail: "Greek Sigma", type: "constant" },
  { label: "\\Omega", detail: "Greek Omega", type: "constant" },
];

/** Commands that should insert `{}` with the cursor inside when chosen. */
export const BRACE_COMMANDS = new Set([
  "part",
  "chapter",
  "section",
  "subsection",
  "subsubsection",
  "paragraph",
  "subparagraph",
  "title",
  "author",
  "date",
  "textbf",
  "textit",
  "textrm",
  "texttt",
  "textsf",
  "emph",
  "underline",
  "textsc",
  "label",
  "ref",
  "eqref",
  "pageref",
  "cite",
  "citep",
  "citet",
  "bibliography",
  "bibliographystyle",
  "includegraphics",
  "caption",
  "footnote",
  "url",
  "href",
  "vspace",
  "hspace",
  "input",
  "include",
  "includeonly",
  "begin",
  "end",
  "sqrt",
  "mathbf",
  "mathrm",
  "mathcal",
  "mathbb",
]);

/** Commands that insert `{}{}` with the cursor in the first pair. */
export const DOUBLE_BRACE_COMMANDS = new Set(["frac", "multicolumn", "multirow"]);

export function commandNameFromLabel(label: string): string {
  const body = label.startsWith("\\") ? label.slice(1) : label;
  return body.split("{")[0] ?? body;
}

export function completionInsertSpec(label: string): { insert: string; cursor: number } | null {
  if (label.includes("{")) {
    return { insert: label, cursor: label.length };
  }

  const name = commandNameFromLabel(label);

  if (DOUBLE_BRACE_COMMANDS.has(name)) {
    const insert = `${label}{}{}`;
    return { insert, cursor: label.length + 1 };
  }

  if (BRACE_COMMANDS.has(name)) {
    const insert = `${label}{}`;
    return { insert, cursor: label.length + 1 };
  }

  return null;
}

export function withCompletionApply(completion: Completion): Completion {
  const spec = completionInsertSpec(completion.label);
  if (!spec) return completion;

  return {
    ...completion,
    apply: (view, _completion, from, to) => {
      view.dispatch({
        changes: { from, to, insert: spec.insert },
        selection: { anchor: from + spec.cursor },
      });
    },
  };
}

export const LATEX_COMMANDS: Completion[] = LATEX_COMMAND_DEFS.map((def) =>
  withCompletionApply({
    label: def.label,
    detail: def.detail,
    type: def.type,
  })
);

export interface LatexCompletionMatchInput {
  textBefore: string;
  explicit?: boolean;
}

export function matchLatexCompletions(input: LatexCompletionMatchInput): CompletionResult | null {
  const { textBefore, explicit = false } = input;

  const envBegin = textBefore.match(/\\begin\{[a-zA-Z*]*$/);
  if (envBegin) {
    const typed = envBegin[0].slice(7);
    const fromOffset = textBefore.length - typed.length;
    return {
      from: fromOffset,
      options: LATEX_ENVIRONMENTS.filter((env) => env.startsWith(typed)).map((env) => ({
        label: env,
        type: "variable",
        detail: "environment",
        apply: `${env}}`,
      })),
    };
  }

  const envEnd = textBefore.match(/\\end\{[a-zA-Z*]*$/);
  if (envEnd) {
    const typed = envEnd[0].slice(5);
    const fromOffset = textBefore.length - typed.length;
    return {
      from: fromOffset,
      options: LATEX_ENVIRONMENTS.filter((env) => env.startsWith(typed)).map((env) => ({
        label: env,
        type: "variable",
        detail: "environment",
        apply: `${env}}`,
      })),
    };
  }

  const cmd = textBefore.match(/\\[a-zA-Z@]*$/);
  if (!cmd) return null;

  const typed = cmd[0].slice(1).toLowerCase();
  if (typed.length === 0 && !explicit) return null;

  const options = LATEX_COMMANDS.filter((c) =>
    c.label.slice(1).toLowerCase().startsWith(typed)
  );

  if (options.length === 0) return null;

  return {
    from: textBefore.length - cmd[0].length,
    options,
  };
}

export function latexCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const result = matchLatexCompletions({ textBefore, explicit: context.explicit });
  if (!result) return null;

  return {
    from: line.from + result.from,
    options: result.options,
  };
}
