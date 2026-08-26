import { isGithubAuthEnabled, isGoogleAuthEnabled } from "@/lib/auth-providers";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { SignupPageClient } from "./signup-form";

// Runtime env vars (GOOGLE/GITHUB client id+secret) must be read per request, not at Docker build.
export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const session = await getSession();
  if (session?.user) {
    const { next } = await searchParams;
    const destination = next?.startsWith("/") ? next : "/dashboard";
    redirect(destination);
  }

  return (
    <SignupPageClient
      googleEnabled={isGoogleAuthEnabled()}
      githubEnabled={isGithubAuthEnabled()}
    />
  );
}
