/** Live progress steps shown while an assistant turn is in flight (PAP-43). */

export const AI_WORKING_PROGRESS_MAX_STEPS = 8;

export function initialProgressSteps(seed: string): string[] {
  const trimmed = seed.trim();
  return [trimmed || "Thinking…"];
}

/** Append a progress message, skipping exact duplicates and capping history length. */
export function pushProgressStep(steps: string[], message: string): string[] {
  const trimmed = message.trim();
  if (!trimmed) return steps;
  if (steps.length === 0) return [trimmed];

  const last = steps[steps.length - 1];
  if (last === trimmed) return steps;

  const next = [...steps, trimmed];
  if (next.length <= AI_WORKING_PROGRESS_MAX_STEPS) return next;
  return next.slice(next.length - AI_WORKING_PROGRESS_MAX_STEPS);
}
