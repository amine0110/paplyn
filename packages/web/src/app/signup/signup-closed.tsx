import Link from "next/link";
import { Nav } from "@/components/nav";
import { PrivateInstanceNotice } from "@/components/private-instance-notice";

export function SignupClosedPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-md mx-auto px-4 py-20 space-y-6 text-center">
        <h1 className="font-serif text-2xl font-semibold">Registration closed</h1>
        <PrivateInstanceNotice />
        <p className="text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-navy hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
