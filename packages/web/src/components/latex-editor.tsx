"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, bracketMatching, StreamLanguage } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import { HighlightStyle } from "@codemirror/language";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";

const latexHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#2d6a6a" },
  { tag: t.comment, color: "#8a8278", fontStyle: "italic" },
  { tag: t.string, color: "#6b2d3a" },
  { tag: t.bracket, color: "#4a4540" },
]);

const latexLang = StreamLanguage.define({
  token(stream) {
    if (stream.match(/^\\[a-zA-Z@]+/)) return "keyword";
    if (stream.match(/^%.*$/)) return "comment";
    if (stream.match(/^[{}[\]$&%#_^~\\]/)) return "bracket";
    if (stream.match(/^\$/)) return "string";
    stream.next();
    return null;
  },
});

const LATEX_ENVIRONMENTS = [
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
];

const LATEX_COMMANDS: Completion[] = [
  // Document structure
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
  // Title & metadata
  { label: "\\title", detail: "Document title", type: "keyword" },
  { label: "\\author", detail: "Document author", type: "keyword" },
  { label: "\\date", detail: "Document date", type: "keyword" },
  { label: "\\maketitle", detail: "Render title block", type: "keyword" },
  { label: "\\abstract", detail: "Abstract environment", type: "keyword" },
  // Text formatting
  { label: "\\textbf", detail: "Bold text", type: "keyword" },
  { label: "\\textit", detail: "Italic text", type: "keyword" },
  { label: "\\textrm", detail: "Roman text", type: "keyword" },
  { label: "\\texttt", detail: "Monospace text", type: "keyword" },
  { label: "\\textsf", detail: "Sans-serif text", type: "keyword" },
  { label: "\\emph", detail: "Emphasized text", type: "keyword" },
  { label: "\\underline", detail: "Underlined text", type: "keyword" },
  { label: "\\textsc", detail: "Small caps", type: "keyword" },
  // References & citations
  { label: "\\label", detail: "Set a reference label", type: "keyword" },
  { label: "\\ref", detail: "Reference by label", type: "keyword" },
  { label: "\\eqref", detail: "Equation reference", type: "keyword" },
  { label: "\\pageref", detail: "Page reference", type: "keyword" },
  { label: "\\cite", detail: "Bibliography citation", type: "keyword" },
  { label: "\\citep", detail: "Parenthetical citation", type: "keyword" },
  { label: "\\citet", detail: "Textual citation", type: "keyword" },
  { label: "\\bibliography", detail: "Bibliography file", type: "keyword" },
  { label: "\\bibliographystyle", detail: "Bibliography style", type: "keyword" },
  // Figures & tables
  { label: "\\includegraphics", detail: "Include image", type: "keyword" },
  { label: "\\caption", detail: "Figure/table caption", type: "keyword" },
  { label: "\\centering", detail: "Center content", type: "keyword" },
  { label: "\\hline", detail: "Horizontal rule in table", type: "keyword" },
  { label: "\\multicolumn", detail: "Span table columns", type: "keyword" },
  { label: "\\multirow", detail: "Span table rows", type: "keyword" },
  // Lists
  { label: "\\item", detail: "List item", type: "keyword" },
  // Cross-references & footnotes
  { label: "\\footnote", detail: "Footnote", type: "keyword" },
  { label: "\\url", detail: "URL link", type: "keyword" },
  { label: "\\href", detail: "Hyperlink", type: "keyword" },
  // Spacing & breaks
  { label: "\\newline", detail: "Line break", type: "keyword" },
  { label: "\\newpage", detail: "New page", type: "keyword" },
  { label: "\\clearpage", detail: "Clear page", type: "keyword" },
  { label: "\\vspace", detail: "Vertical space", type: "keyword" },
  { label: "\\hspace", detail: "Horizontal space", type: "keyword" },
  { label: "\\noindent", detail: "Suppress paragraph indent", type: "keyword" },
  // Includes
  { label: "\\input", detail: "Include file", type: "keyword" },
  { label: "\\include", detail: "Include file (new page)", type: "keyword" },
  { label: "\\includeonly", detail: "Compile subset of files", type: "keyword" },
  // Environments
  { label: "\\begin", detail: "Begin environment", type: "keyword" },
  { label: "\\end", detail: "End environment", type: "keyword" },
  // Math — environments & symbols
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
  // Greek letters
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

function latexCompletionSource(context: CompletionContext): CompletionResult | null {
  const envBegin = context.matchBefore(/\\begin\{[a-zA-Z*]*$/);
  if (envBegin) {
    const typed = envBegin.text.slice(7);
    return {
      from: envBegin.from + 7,
      options: LATEX_ENVIRONMENTS.filter((env) => env.startsWith(typed)).map((env) => ({
        label: env,
        type: "variable",
        detail: "environment",
      })),
    };
  }

  const envEnd = context.matchBefore(/\\end\{[a-zA-Z*]*$/);
  if (envEnd) {
    const typed = envEnd.text.slice(5);
    return {
      from: envEnd.from + 5,
      options: LATEX_ENVIRONMENTS.filter((env) => env.startsWith(typed)).map((env) => ({
        label: env,
        type: "variable",
        detail: "environment",
      })),
    };
  }

  const cmd = context.matchBefore(/\\[a-zA-Z@]*$/);
  if (!cmd || (cmd.from === cmd.to && !context.explicit)) return null;

  const typed = cmd.text.slice(1).toLowerCase();
  const options = LATEX_COMMANDS.filter((c) =>
    c.label.slice(1).toLowerCase().startsWith(typed)
  );

  if (options.length === 0) return null;

  return { from: cmd.from, options };
}

interface LatexEditorProps {
  filePath: string;
  projectId: string;
  initialContent: string;
  collabToken: string | null;
  collabBaseUrl: string;
  canEdit: boolean;
  onChange: (content: string) => void;
  onEditorReady?: (view: EditorView) => void;
  jumpToLine?: number | null;
}

export function LatexEditor({
  filePath,
  projectId,
  initialContent,
  collabToken,
  collabBaseUrl,
  canEdit,
  onChange,
  onEditorReady,
  jumpToLine,
}: LatexEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const saveContent = useCallback(
    (content: string) => onChange(content),
    [onChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(filePath);

    let provider: WebsocketProvider | null = null;
    if (collabToken) {
      provider = new WebsocketProvider(collabBaseUrl, projectId, ydoc, {
        params: { token: collabToken },
      });
      provider.on("sync", () => {
        if (ytext.length === 0 && initialContent) {
          ytext.insert(0, initialContent);
        }
      });
    } else if (initialContent) {
      ytext.insert(0, initialContent);
    }

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      bracketMatching(),
      latexLang,
      syntaxHighlighting(latexHighlight),
      autocompletion({
        override: [latexCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 24,
      }),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.editable.of(canEdit),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          saveContent(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent" },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "15px",
          lineHeight: "1.65",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "none",
          color: "#a39e94",
        },
        ".cm-activeLineGutter": { backgroundColor: "rgba(45, 106, 106, 0.06)" },
        ".cm-activeLine": { backgroundColor: "rgba(45, 106, 106, 0.04)" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 8px" },
        ".cm-content": { padding: "24px 16px 32px 8px" },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          backgroundColor: "rgba(45, 106, 106, 0.15) !important",
        },
      }),
    ];

    if (provider) {
      extensions.push(yCollab(ytext, provider.awareness));
    }

    const state = EditorState.create({
      doc: ytext.toString() || initialContent,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onEditorReady?.(view);

    return () => {
      view.destroy();
      provider?.destroy();
      ydoc.destroy();
    };
  }, [filePath, projectId, collabToken, collabBaseUrl, canEdit]);

  useEffect(() => {
    if (jumpToLine && viewRef.current && jumpToLine > 0) {
      const doc = viewRef.current.state.doc;
      const lineNum = Math.min(jumpToLine, doc.lines);
      const line = doc.line(lineNum);
      viewRef.current.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    }
  }, [jumpToLine]);

  return <div ref={containerRef} className="h-full overflow-hidden manuscript-editor" />;
}
