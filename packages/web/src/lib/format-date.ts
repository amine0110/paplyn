const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

/** Normalize API/DB timestamps so naive values are treated as UTC (append Z). */
export function normalizeUtcIsoTimestamp(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return trimmed;

  if (HAS_TIMEZONE.test(trimmed)) {
    return trimmed;
  }

  if (ISO_DATE_ONLY.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (withT.includes(".")) {
    return `${withT}Z`;
  }
  return `${withT}.000Z`;
}

export function toUtcIsoString(value: Date | string | number): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return normalizeUtcIsoTimestamp(value);
  }
  return new Date(value).toISOString();
}

export function parseUtcTimestamp(iso: string): Date {
  return new Date(normalizeUtcIsoTimestamp(iso));
}

export function getViewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatRevisionTimestamp(
  iso: string,
  options?: { locale?: string; timeZone?: string }
): string {
  const date = parseUtcTimestamp(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(options?.locale, {
    timeZone: options?.timeZone ?? getViewerTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
