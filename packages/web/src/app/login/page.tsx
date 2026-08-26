import { isGithubAuthEnabled, isGoogleAuthEnabled, isOrcidAuthEnabled } from "@/lib/auth-providers";
import { resolveInternalNextPath } from "@/lib/internal-path";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LoginPageClient } from "./login-form";

// Runtime env vars (GOOGLE/GITHUB client id+secret) must be read per request, not at Docker build.
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session?.user) {
    const { next } = await searchParams;
    redirect(resolveInternalNextPath(next));
  }

  return (
    <LoginPageClient
      googleEnabled={isGoogleAuthEnabled()}
      githubEnabled={isGithubAuthEnabled()}
      orcidEnabled={isOrcidAuthEnabled()}
    />
  );
}
