import { describe, expect, it } from "vitest";
import { encodeAiStreamEvent, parseAiStreamLine } from "./ai-stream";

describe("ai-stream", () => {
  it("encodes and parses progress events", () => {
    const encoded = encodeAiStreamEvent({
      type: "progress",
      message: "Reading main.tex (line 12)…",
    });
    const parsed = parseAiStreamLine(new TextDecoder().decode(encoded));
    expect(parsed).toEqual({
      type: "progress",
      message: "Reading main.tex (line 12)…",
    });
  });

  it("encodes and parses done events", () => {
    const encoded = encodeAiStreamEvent({
      type: "done",
      content: "Fixed the bracket.",
      actions: [],
    });
    const parsed = parseAiStreamLine(new TextDecoder().decode(encoded));
    expect(parsed).toEqual({
      type: "done",
      content: "Fixed the bracket.",
      actions: [],
    });
  });
});
