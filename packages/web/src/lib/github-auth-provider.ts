import { pickGithubPrimaryEmail, type GithubEmailEntry } from "./github-primary-email";

type OAuthProviderConfig = { clientId: string; clientSecret: string };

type GithubProfile = {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
};

type GithubOAuthTokens = {
  accessToken?: string;
};

const GITHUB_USER_AGENT = "paplyn-auth";

/** Better Auth GitHub provider options: identity uses primary email only. */
export function buildGithubSocialProviderOptions(config: OAuthProviderConfig) {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    getUserInfo: async (token: GithubOAuthTokens) => {
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

      return {
        user: {
          name: profile.name || profile.login || "",
          email: primary.email,
          image: profile.avatar_url ?? undefined,
          emailVerified: primary.verified,
        },
        data: {
          ...profile,
          email: primary.email,
        },
      };
    },
  };
}
