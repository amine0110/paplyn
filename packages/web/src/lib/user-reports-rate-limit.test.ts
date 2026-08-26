import { describe, expect, it } from "vitest";
import {
  clearReportRateLimitStores,
  evaluateReportRateLimits,
  IP_REPORT_LIMIT,
  IP_REPORT_WINDOW_MS,
  USER_REPORT_LIMIT,
  USER_REPORT_WINDOW_MS,
} from "@/lib/user-reports-rate-limit";

describe("user-reports-rate-limit", () => {
  it("allows submissions under IP and user limits", () => {
    clearReportRateLimitStores();
    const ipStore = new Map();
    const userStore = new Map();
    const now = Date.now();

    for (let i = 0; i < IP_REPORT_LIMIT; i += 1) {
      const result = evaluateReportRateLimits({
        ipKey: "ip-test",
        userId: "user-1",
        now,
        ipStore,
        userStore,
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = evaluateReportRateLimits({
      ipKey: "ip-test",
      userId: "user-1",
      now,
      ipStore,
      userStore,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("ip");
  });

  it("rate limits signed-in users separately from IP", () => {
    const ipStore = new Map();
    const userStore = new Map();
    const now = Date.now();

    for (let i = 0; i < USER_REPORT_LIMIT; i += 1) {
      const result = evaluateReportRateLimits({
        ipKey: `ip-${i}`,
        userId: "user-heavy",
        now,
        ipStore,
        userStore,
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = evaluateReportRateLimits({
      ipKey: "ip-new",
      userId: "user-heavy",
      now,
      ipStore,
      userStore,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("user");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(USER_REPORT_WINDOW_MS / 1000);
  });

  it("documents v1 in-memory windows", () => {
    expect(IP_REPORT_LIMIT).toBe(3);
    expect(IP_REPORT_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(USER_REPORT_LIMIT).toBe(5);
    expect(USER_REPORT_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
