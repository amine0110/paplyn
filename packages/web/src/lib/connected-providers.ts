export const CONNECTED_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  credential: "Email and password",
};

export function labelConnectedProvider(providerId: string): string {
  return CONNECTED_PROVIDER_LABELS[providerId] ?? providerId;
}

export function labelConnectedProviders(providerIds: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const providerId of providerIds) {
    if (seen.has(providerId)) continue;
    seen.add(providerId);
    labels.push(labelConnectedProvider(providerId));
  }
  return labels;
}
