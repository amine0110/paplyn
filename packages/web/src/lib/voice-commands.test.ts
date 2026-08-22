import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./voice-commands";

describe("voice-commands", () => {
  it("maps find papers phrase", () => {
    expect(parseVoiceCommand("find papers")).toEqual({
      message: "Find papers related to my document",
      action: "find-papers",
    });
  });

  it("maps fix errors phrase", () => {
    expect(parseVoiceCommand("fix compile errors")).toEqual({
      message: "Fix the compile errors",
      action: "explain-errors",
    });
  });

  it("passes through free-form text", () => {
    expect(parseVoiceCommand("add a paragraph about methods")).toEqual({
      message: "add a paragraph about methods",
    });
  });
});
