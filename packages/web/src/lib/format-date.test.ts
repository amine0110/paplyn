import { describe, it, expect } from "vitest";
import {
  formatRevisionTimestamp,
  normalizeUtcIsoTimestamp,
  parseUtcTimestamp,
  toUtcIsoString,
} from "@/lib/format-date";

describe("normalizeUtcIsoTimestamp", () => {
  it("appends Z to naive ISO datetimes", () => {
    expect(normalizeUtcIsoTimestamp("2026-08-21T20:08:00")).toBe(
      "2026-08-21T20:08:00.000Z"
    );
    expect(normalizeUtcIsoTimestamp("2026-08-21T20:08:00.123")).toBe(
      "2026-08-21T20:08:00.123Z"
    );
  });

  it("normalizes space-separated naive timestamps", () => {
    expect(normalizeUtcIsoTimestamp("2026-08-21 20:08:00")).toBe(
      "2026-08-21T20:08:00.000Z"
    );
  });

  it("leaves UTC and offset timestamps unchanged", () => {
    expect(normalizeUtcIsoTimestamp("2026-08-21T20:08:00.000Z")).toBe(
      "2026-08-21T20:08:00.000Z"
    );
    expect(normalizeUtcIsoTimestamp("2026-08-21T22:08:00+02:00")).toBe(
      "2026-08-21T22:08:00+02:00"
    );
  });
});

describe("toUtcIsoString", () => {
  it("serializes Date values as UTC ISO strings", () => {
    expect(toUtcIsoString(new Date("2026-08-21T20:08:00.000Z"))).toBe(
      "2026-08-21T20:08:00.000Z"
    );
  });
});

describe("formatRevisionTimestamp", () => {
  it("formats UTC instants in the viewer timezone", () => {
    const formatted = formatRevisionTimestamp("2026-08-21T20:08:00.000Z", {
      locale: "en-US",
      timeZone: "Europe/Brussels",
    });

    expect(formatted).toMatch(/Aug 21, 2026/);
    expect(formatted).toMatch(/10:08/);
  });

  it("treats naive timestamps as UTC before formatting", () => {
    const fromNaive = formatRevisionTimestamp("2026-08-21T20:08:00", {
      locale: "en-US",
      timeZone: "Europe/Brussels",
    });
    const fromUtc = formatRevisionTimestamp("2026-08-21T20:08:00.000Z", {
      locale: "en-US",
      timeZone: "Europe/Brussels",
    });

    expect(fromNaive).toBe(fromUtc);
  });

  it("parses normalized timestamps as the same instant", () => {
    const naive = parseUtcTimestamp("2026-08-21T20:08:00");
    const explicit = parseUtcTimestamp("2026-08-21T20:08:00.000Z");

    expect(naive.getTime()).toBe(explicit.getTime());
  });
});
