import { isTurnstileConfigured } from "@/lib/user-reports-config";

type TurnstileVerifyResponse = {
  success?: boolean;
};

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!isTurnstileConfigured()) {
    return true;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;

  if (!token?.trim()) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as TurnstileVerifyResponse;
  return data.success === true;
}
