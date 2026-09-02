/**
 * LaTeX packages known to ship in the Paplyn compiler image
 * (texlive-latex-base/recommended/extra + publishers — see packages/compiler/Dockerfile).
 *
 * Used by compile-fix to allow real \\usepackage inserts without inventing packages.
 * Regenerate or extend when the compiler image changes.
 */

/** Undefined command → package that provides it (complement to sty-not-found detection). */
export const UNDEFINED_COMMAND_PACKAGE_MAP: Readonly<Record<string, string>> = {
  citep: "natbib",
  citet: "natbib",
  citealp: "natbib",
  citeauthor: "natbib",
  citeyear: "natbib",
  citeyearpar: "natbib",
  includegraphics: "graphicx",
  rotatebox: "graphicx",
  scalebox: "graphicx",
  resizebox: "graphicx",
  SI: "siunitx",
  si: "siunitx",
  num: "siunitx",
  ang: "siunitx",
  href: "hyperref",
  url: "url",
  autoref: "hyperref",
  eqref: "amsmath",
  align: "amsmath",
  toprule: "booktabs",
  midrule: "booktabs",
  bottomrule: "booktabs",
};

/**
 * Packages available in the compiler Docker image (subset of TeX Live).
 * Not exhaustive — extend when users report false negatives via /report.
 */
export const COMPILER_IMAGE_PACKAGES: ReadonlySet<string> = new Set([
  "algorithm",
  "algorithm2e",
  "algorithmic",
  "algpseudocode",
  "amsmath",
  "amsfonts",
  "amssymb",
  "amsthm",
  "array",
  "babel",
  "biblatex",
  "bm",
  "booktabs",
  "braket",
  "calc",
  "caption",
  "cite",
  "cleveref",
  "color",
  "colortbl",
  "enumitem",
  "etoolbox",
  "fancyhdr",
  "float",
  "fontenc",
  "geometry",
  "graphicx",
  "hyperref",
  "ifthen",
  "inputenc",
  "latexsym",
  "listings",
  "longtable",
  "mathtools",
  "microtype",
  "multirow",
  "nameref",
  "natbib",
  "parskip",
  "pgfplots",
  "physics",
  "relsize",
  "rotating",
  "setspace",
  "siunitx",
  "subcaption",
  "subfig",
  "tabularx",
  "textcomp",
  "tikz",
  "titlesec",
  "tocbibind",
  "url",
  "xcolor",
  "xkeyval",
  "xparse",
]);

export function normalizeLatexPackageName(name: string): string {
  return name.trim().toLowerCase();
}

/** True when the package ships in the Paplyn compiler image. */
export function isPackageAvailableInCompiler(packageName: string): boolean {
  const normalized = normalizeLatexPackageName(packageName);
  if (!normalized) return false;
  return COMPILER_IMAGE_PACKAGES.has(normalized);
}

export function packageForUndefinedCommand(command: string): string | undefined {
  const normalized = command.replace(/^\\/, "").trim();
  if (!normalized) return undefined;
  return UNDEFINED_COMMAND_PACKAGE_MAP[normalized];
}
