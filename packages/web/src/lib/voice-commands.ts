/** Map spoken phrases to AI sidebar actions (client-safe). */

export interface ParsedVoiceCommand {
  message: string;
  action?: string;
}

const VOICE_COMMANDS: { patterns: RegExp[]; action?: string; message: string }[] = [
  {
    patterns: [/^find papers?\b/i, /^search (for )?papers?\b/i, /^literature search\b/i],
    action: "find-papers",
    message: "Find papers related to my document",
  },
  {
    patterns: [/^rephrase\b/i, /^rephrase (the )?selection\b/i],
    action: "rephrase",
    message: "Rephrase the selected text",
  },
  {
    patterns: [/^improve\b/i, /^improve (the )?selection\b/i, /^make (it )?better\b/i],
    action: "improve",
    message: "Improve the selected text",
  },
  {
    patterns: [
      /^fix errors?\b/i,
      /^fix compile errors?\b/i,
      /^explain errors?\b/i,
      /^fix (the )?latex\b/i,
    ],
    action: "explain-errors",
    message: "Fix the compile errors",
  },
  {
    patterns: [
      /^add (a )?citation\b/i,
      /^cite\b/i,
      /^add citation\b/i,
    ],
    action: "citation",
    message: "Add a citation for the selected text",
  },
  {
    patterns: [/^tighten\b/i, /^tighten (the )?selection\b/i],
    action: "tighten",
    message: "Tighten the selected text",
  },
  {
    patterns: [/^shorten\b/i],
    action: "shorten",
    message: "Shorten the selected text",
  },
  {
    patterns: [/^expand\b/i],
    action: "expand",
    message: "Expand the selected text",
  },
];

export function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  const trimmed = transcript.trim();
  if (!trimmed) return { message: "" };

  for (const entry of VOICE_COMMANDS) {
    if (entry.patterns.some((pattern) => pattern.test(trimmed))) {
      return { message: entry.message, action: entry.action };
    }
  }

  return { message: trimmed };
}

export function speechStatusMessage(
  status: "unsupported" | "idle" | "listening" | "denied" | "error"
): string | null {
  switch (status) {
    case "unsupported":
      return "Voice input is not supported in this browser.";
    case "denied":
      return "Microphone permission denied. Enable it in browser settings to use voice.";
    case "error":
      return "Voice recognition failed. Try again or type your message.";
    default:
      return null;
  }
}
