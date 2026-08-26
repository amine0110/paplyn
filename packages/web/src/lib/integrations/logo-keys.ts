/** Logo keys for official integration marks on the landing strip. */
export type IntegrationLogoKey =
  | "latex"
  | "groq"
  | "openai"
  | "openai-compatible"
  | "semantic-scholar"
  | "crossref"
  | "arxiv"
  | "zotero"
  | "github"
  | "ollama";

export function integrationLogoKeyFromId(id: string): IntegrationLogoKey {
  switch (id) {
    case "cite-doi":
      return "crossref";
    case "github-import":
      return "github";
    default:
      return id as IntegrationLogoKey;
  }
}
