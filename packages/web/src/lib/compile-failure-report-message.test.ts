import { describe, expect, it } from "vitest";
import { COMPILE_FIX_USER_MESSAGE } from "@/lib/ai-compile-fix-intent";
import {
  buildCompileFailureReportMessage,
  buildCompileFixUserMessage,
  COMPILE_FIX_MESSAGE_LEAD_IN,
  resolveReportWhatHappenedMessage,
} from "@/lib/compile-failure-report-message";

describe("buildCompileFailureReportMessage", () => {
  it("formats on-screen compile errors instead of the compile-fix AI chip prompt", () => {
    const message = buildCompileFailureReportMessage({
      errors: [
        { severity: "error", line: 42, message: "Undefined control sequence \\foo" },
        { severity: "warning", line: 10, message: "ignored warning" },
      ],
      log: "ignored log",
    });

    expect(message).toBe("L42: Undefined control sequence \\foo");
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });

  it("falls back to a compile log excerpt when only generic failure copy exists", () => {
    const message = buildCompileFailureReportMessage({
      errors: [{ severity: "error", message: "Compilation failed — see log for details" }],
      log: ["first line", "! Undefined control sequence.", "l.18 \\badmacro", "last line"].join(
        "\n",
      ),
    });

    expect(message).toContain("Compile log excerpt:");
    expect(message).toContain("Undefined control sequence");
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });

  it("never returns the compile-fix AI chip prompt", () => {
    const message = buildCompileFailureReportMessage({
      errors: [{ severity: "error", message: COMPILE_FIX_USER_MESSAGE }],
      log: "! Emergency stop.",
    });

    expect(message).toContain("Compile log excerpt:");
    expect(message).not.toContain(COMPILE_FIX_USER_MESSAGE);
  });
});

describe("buildCompileFixUserMessage", () => {
  it("quotes on-screen compile errors in the Fix-with-AI chat message", () => {
    const message = buildCompileFixUserMessage({
      errors: [{ severity: "error", line: 18, message: "Undefined control sequence \\foo" }],
    });

    expect(message).toBe(
      `${COMPILE_FIX_MESSAGE_LEAD_IN}\n- L18: Undefined control sequence \\foo`,
    );
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });
});

describe("resolveReportWhatHappenedMessage", () => {
  it("rejects the compile-fix AI prompt and uses a fallback error", () => {
    expect(
      resolveReportWhatHappenedMessage(
        COMPILE_FIX_USER_MESSAGE,
        "L18: Undefined control sequence \\badmacro",
      ),
    ).toBe("L18: Undefined control sequence \\badmacro");
  });

  it("returns null when only the compile-fix AI prompt is available", () => {
    expect(resolveReportWhatHappenedMessage(COMPILE_FIX_USER_MESSAGE)).toBeNull();
  });
});
