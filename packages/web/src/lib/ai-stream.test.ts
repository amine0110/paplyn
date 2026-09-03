import { describe, expect, it } from "vitest";
import { consumeAiStream, encodeAiStreamEvent, parseAiStreamLine } from "./ai-stream";

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

  it("throws AbortError when the signal aborts mid-stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encodeAiStreamEvent({
            type: "progress",
            message: "Reading main.tex…",
          })
        );
      },
      pull() {
        return new Promise(() => {});
      },
    });
    const response = new Response(stream, {
      headers: { "content-type": "application/x-ndjson" },
    });
    const abortController = new AbortController();
    const pending = consumeAiStream(
      response,
      () => {},
      abortController.signal
    );
    abortController.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
