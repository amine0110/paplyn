/**
 * Resolve the plugin tool forced for the next AI request.
 * Picker selection must win over stale options; explicit options win over picker state.
 */
export function resolveComposerForcedTool(
  optionsForcedTool: string | undefined,
  selectedTool: string | null | undefined
): string | undefined {
  return optionsForcedTool ?? selectedTool ?? undefined;
}
