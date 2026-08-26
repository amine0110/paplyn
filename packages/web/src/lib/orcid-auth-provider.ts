import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import type { OAuth2Tokens } from "better-auth/oauth2";
import { pickOrcidPublicPrimaryEmail, type OrcidEmailEntry } from "./orcid-primary-email";

type OAuthProviderConfig = { clientId: string; clientSecret: string };

const ORCID_DISCOVERY_URL = "https://orcid.org/.well-known/openid-configuration";
const ORCID_USERINFO_URL = "https://orcid.org/oauth/userinfo";
const ORCID_API_BASE = "https://api.orcid.org/v3.0";

/** Better Auth genericOAuth callback for providerId `orcid` (better-auth ^1.2.3): /api/auth/callback/orcid */
export const ORCID_OAUTH_CALLBACK_PATH = "/api/auth/callback/orcid";

type OrcidUserInfo = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

type OrcidEmailResponse = {
  email?: OrcidEmailEntry[];
};

/** Extract a bare ORCID iD (0000-0002-1825-0097) from userinfo `sub` or a full URI. */
export function normalizeOrcidId(value: string): string {
  const match = value.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  return match ? match[1] : value;
}

export async function fetchOrcidPublicPrimaryEmail(
  orcidId: string,
  accessToken: string,
): Promise<{ email: string } | null> {
  const response = await fetch(`${ORCID_API_BASE}/${encodeURIComponent(orcidId)}/email`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as OrcidEmailResponse;
  return pickOrcidPublicPrimaryEmail(data.email);
}

/** Better Auth genericOAuth provider config for ORCID Public API sign-in. */
export function buildOrcidGenericOAuthConfig(config: OAuthProviderConfig): GenericOAuthConfig<"orcid"> {
  return {
    providerId: "orcid",
    name: "ORCID",
    discoveryUrl: ORCID_DISCOVERY_URL,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authentication: "post",
    // openid: OIDC sign-in; /read-public: read public primary email from the ORCID record API.
    scopes: ["openid", "/read-public"],
    // ORCID Public API does not support PKCE on the token endpoint (see ORCID/ORCID-Source#5977).
    pkce: false,
    getUserInfo: async (tokens: OAuth2Tokens) => {
      const accessToken = tokens.accessToken;
      if (!accessToken) return null;

      const userInfoResponse = await fetch(ORCID_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!userInfoResponse.ok) return null;

      const userInfo = (await userInfoResponse.json()) as OrcidUserInfo;
      const sub = userInfo.sub;
      if (!sub) return null;

      const orcidId = normalizeOrcidId(sub);
      const primaryEmail = await fetchOrcidPublicPrimaryEmail(orcidId, accessToken);
      if (!primaryEmail) return null;

      const name =
        userInfo.name?.trim() ||
        [userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ").trim() ||
        orcidId;

      return {
        id: orcidId,
        sub: orcidId,
        email: primaryEmail.email,
        emailVerified: true,
        name,
      };
    },
    mapProfileToUser: (profile) => ({
      email: typeof profile.email === "string" ? profile.email : undefined,
      name: typeof profile.name === "string" ? profile.name : undefined,
    }),
  };
}
