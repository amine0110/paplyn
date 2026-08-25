import { describe, expect, it } from "vitest";
import { integrationLogoKeyFromId } from "./logo-keys";

describe("integrationLogoKeyFromId", () => {
  it("maps plugin ids to logo keys", () => {
    expect(integrationLogoKeyFromId("cite-doi")).toBe("crossref");
    expect(integrationLogoKeyFromId("github-import")).toBe("github");
    expect(integrationLogoKeyFromId("ollama")).toBe("ollama");
    expect(integrationLogoKeyFromId("latex")).toBe("latex");
  });
});
