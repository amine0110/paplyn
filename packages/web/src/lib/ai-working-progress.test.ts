import { describe, expect, it } from "vitest";
import {
  AI_WORKING_PROGRESS_MAX_STEPS,
  initialProgressSteps,
  pushProgressStep,
} from "@/lib/ai-working-progress";

describe("ai-working-progress", () => {
  it("seeds an initial step from the composer loading label", () => {
    expect(initialProgressSteps("Fixing compile errors…")).toEqual(["Fixing compile errors…"]);
    expect(initialProgressSteps("")).toEqual(["Thinking…"]);
  });

  it("appends unique progress messages and skips exact duplicates", () => {
    let steps = initialProgressSteps("Thinking…");
    steps = pushProgressStep(steps, "Starting…");
    steps = pushProgressStep(steps, "Reading main.tex…");
    steps = pushProgressStep(steps, "Reading main.tex…");
    expect(steps).toEqual(["Thinking…", "Starting…", "Reading main.tex…"]);
  });

  it("caps history at AI_WORKING_PROGRESS_MAX_STEPS", () => {
    let steps = initialProgressSteps("Thinking…");
    for (let i = 0; i < AI_WORKING_PROGRESS_MAX_STEPS + 2; i += 1) {
      steps = pushProgressStep(steps, `Step ${i}…`);
    }
    expect(steps).toHaveLength(AI_WORKING_PROGRESS_MAX_STEPS);
    expect(steps[0]).toBe("Step 2…");
    expect(steps.at(-1)).toBe(`Step ${AI_WORKING_PROGRESS_MAX_STEPS + 1}…`);
  });
});
