import { describe, it, expect } from "vitest";
import { pickOrcidPublicPrimaryEmail } from "@/lib/orcid-primary-email";

describe("pickOrcidPublicPrimaryEmail", () => {
  it("returns the public primary email", () => {
    expect(
      pickOrcidPublicPrimaryEmail([
        { email: "hidden@example.com", primary: true, visibility: "private" },
        { email: "Public@Example.com", primary: true, visibility: "public" },
      ]),
    ).toEqual({ email: "public@example.com" });
  });

  it("ignores public secondary emails", () => {
    expect(
      pickOrcidPublicPrimaryEmail([
        { email: "secondary@example.com", primary: false, visibility: "public" },
        { email: "primary@example.com", primary: true, visibility: "private" },
      ]),
    ).toBeNull();
  });

  it("returns null when no emails are provided", () => {
    expect(pickOrcidPublicPrimaryEmail([])).toBeNull();
    expect(pickOrcidPublicPrimaryEmail(undefined)).toBeNull();
  });
});
