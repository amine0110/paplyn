import { describe, it, expect } from "vitest";
import { labelConnectedProviders } from "@/lib/connected-providers";

describe("connected-providers", () => {
  it("labels known provider ids for settings display", () => {
    expect(labelConnectedProviders(["google", "credential", "github"])).toEqual([
      "Google",
      "Email and password",
      "GitHub",
    ]);
  });

  it("deduplicates repeated provider ids", () => {
    expect(labelConnectedProviders(["google", "google"])).toEqual(["Google"]);
  });
});
