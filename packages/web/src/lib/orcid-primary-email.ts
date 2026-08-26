export type OrcidEmailEntry = {
  email: string;
  primary?: boolean;
  visibility?: string | null;
};

/**
 * Pick the ORCID record holder's primary email when it is publicly visible.
 * Secondary emails and non-public primaries are ignored (fail closed).
 */
export function pickOrcidPublicPrimaryEmail(
  emails: OrcidEmailEntry[] | null | undefined,
): { email: string } | null {
  if (!emails?.length) return null;

  const primary = emails.find(
    (entry) => entry.primary === true && entry.visibility === "public" && entry.email,
  );
  if (!primary?.email) return null;

  return { email: primary.email.toLowerCase() };
}
