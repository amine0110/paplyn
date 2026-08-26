import type { GithubOptions, GithubProfile } from "better-auth/social-providers";
import type { OAuth2Tokens } from "better-auth/oauth2";
import { pickGithubPrimaryEmail, type GithubEmailEntry } from "./github-primary-email";

type OAuthProviderConfig = { clientId: string; clientSecret: string };

const GITHUB_USER_AGENT = "paplyn-auth";

/** Better Auth GitHub provider options: identity uses primary email only. */
export function buildGithubSocialProviderOptions(config: OAuthProviderConfig): GithubOptions {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    getUserInfo: async (token: OAuth2Tokens) => {
      const accessToken = token.accessToken;
      if (!accessToken) return null;

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": GITHUB_USER_AGENT,
      };

      const profileResponse = await fetch("https://api.github.com/user", { headers });
      if (!profileResponse.ok) return null;
      const profile = (await profileResponse.json()) as GithubProfile;

      const emailsResponse = await fetch("https://api.github.com/user/emails", { headers });
      if (!emailsResponse.ok) return null;
      const emails = (await emailsResponse.json()) as GithubEmailEntry[];

      const primary = pickGithubPrimaryEmail(emails);
      if (!primary) return null;

      const data: GithubProfile = {
        ...profile,
        email: primary.email,
      };

      return {
        user: {
          name: profile.name || profile.login || "",
          email: primary.email,
          image: profile.avatar_url ?? undefined,
          emailVerified: primary.verified,
        },
        data,
      };
    },
  };
}
