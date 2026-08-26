import { describe, expect, it } from "vitest";
import { neutralizeDangerousSchemes, sanitizePlainText } from "@/lib/user-reports-sanitize";

describe("user-reports-sanitize", () => {
  it("neutralizes dangerous URL schemes", () => {
    expect(neutralizeDangerousSchemes("see javascript:alert(1)")).toBe("see javascript: alert(1)");
    expect(neutralizeDangerousSchemes("data:text/html,hi")).toBe("data: text/html,hi");
    expect(neutralizeDangerousSchemes("VBSCRIPT:run")).toBe("VBSCRIPT: run");
  });

  it("strips HTML and neutralizes schemes in plain text sanitizer", () => {
    expect(sanitizePlainText("<b>hello</b> javascript:evil")).toBe("hello javascript: evil");
  });
});
