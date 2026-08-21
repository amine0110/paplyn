import { describe, it, expect } from "vitest";
import {
  buildInviteUrl,
  buildProjectUrl,
  canManageSharing,
  colorForUserId,
  dedupePresenceUsers,
  formatMemberRole,
  parseCollabToken,
  roleCanEdit,
} from "@/lib/project-sharing";

describe("project sharing helpers", () => {
  it("determines edit and sharing permissions by role", () => {
    expect(roleCanEdit("owner")).toBe(true);
    expect(roleCanEdit("editor")).toBe(true);
    expect(roleCanEdit("viewer")).toBe(false);

    expect(canManageSharing("owner")).toBe(true);
    expect(canManageSharing("editor")).toBe(false);
    expect(canManageSharing("viewer")).toBe(false);
  });

  it("formats member roles for display", () => {
    expect(formatMemberRole("owner")).toBe("Owner");
    expect(formatMemberRole("editor")).toBe("Can edit");
    expect(formatMemberRole("viewer")).toBe("Can view");
  });

  it("builds project and invite URLs", () => {
    expect(buildProjectUrl("https://app.example.com/", "proj-1")).toBe(
      "https://app.example.com/project/proj-1"
    );
    expect(buildInviteUrl("https://app.example.com", "inv-9")).toBe(
      "https://app.example.com/invite/inv-9"
    );
  });

  it("parses collab token payloads", () => {
    const payload = {
      room: "room-1",
      userId: "user-1",
      userName: "Ada Lovelace",
      exp: Date.now() + 60_000,
    };
    const token = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.deadbeef`;

    expect(parseCollabToken(token)).toEqual(payload);
    expect(parseCollabToken("not-a-token")).toBeNull();
  });

  it("assigns stable colors and dedupes presence users", () => {
    expect(colorForUserId("user-a")).toBe(colorForUserId("user-a"));
    expect(colorForUserId("user-a")).not.toBe(colorForUserId("user-b"));

    expect(
      dedupePresenceUsers([
        { clientId: 1, userId: "u1", name: "Bob", color: "#000" },
        { clientId: 2, userId: "u1", name: "Bob", color: "#111" },
        { clientId: 3, userId: "u2", name: "Ada", color: "#222" },
      ])
    ).toEqual([
      { clientId: 3, userId: "u2", name: "Ada", color: "#222" },
      { clientId: 1, userId: "u1", name: "Bob", color: "#000" },
    ]);
  });
});
