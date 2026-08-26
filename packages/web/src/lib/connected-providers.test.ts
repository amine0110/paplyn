import { describe, it, expect } from "vitest";
import { labelConnectedProviders } from "@/lib/connected-providers";

describe("connected-providers", () => {
  it("labels known provider ids for settings display", () => {
    expect(labelConnectedProviders(["google", "credential", "github", "orcid"])).toEqual([
      "Google",
      "Email and password",
      "GitHub",
      "ORCID",
    ]);
  });

  it("deduplicates repeated provider ids", () => {
    expect(labelConnectedProviders(["google", "google"])).toEqual(["Google"]);
  });
});
