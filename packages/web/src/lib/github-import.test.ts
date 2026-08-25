import { describe, expect, it } from "vitest";
import { parseGitHubRepoInput } from "./github-import";

describe("github-import", () => {
  it("parses owner/repo and github.com URLs", () => {
    expect(parseGitHubRepoInput("amine0110/plicum")).toEqual({
      owner: "amine0110",
      repo: "plicum",
    });
    expect(parseGitHubRepoInput("https://github.com/latex3/latex2e")).toEqual({
      owner: "latex3",
      repo: "latex2e",
    });
    expect(parseGitHubRepoInput("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("rejects invalid input", () => {
    expect(parseGitHubRepoInput("not-a-repo")).toBeNull();
    expect(parseGitHubRepoInput("")).toBeNull();
  });
});
