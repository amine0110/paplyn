"use client";

import { signOutAndStartSocialSignIn } from "@/lib/auth-social";
import { Button } from "@/components/ui/button";

type OrcidSignInButtonProps = {
  callbackURL?: string;
  errorCallbackURL: string;
  className?: string;
};

/** Official ORCID iD mark (green #A6CE39) — do not flatten onto a dark box. */
function OrcidIdMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#A6CE39"
        d="M256,128c0,70.7-57.3,128-128,128C57.3,256,0,198.7,0,128C0,57.3,57.3,0,128,0C198.7,0,256,57.3,256,128z"
      />
      <path
        fill="#FFFFFF"
        d="M86.3,186.2H70.9v-63.2h15.4v63.2z M87.7,104.5c-0.5,1.4-1.2,2.7-2.2,3.8c-1,1.1-2.2,2-3.7,2.7c-1.5,0.7-3.3,1-5.4,1c-2.1,0-3.9-0.3-5.4-1s-2.7-1.6-3.7-2.7c-1-1.1-1.7-2.4-2.2-3.8C64.9,103.1,64.7,101.5,64.7,100c0-1.5,0.2-3.1,0.7-4.6c0.5-1.5,1.2-2.8,2.2-3.9c1-1.1,2.2-2,3.7-2.7c1.5-0.7,3.3-1,5.4-1c2.1,0,3.9,0.3,5.4,1c1.5,0.7,2.7,1.6,3.7,2.7c1,1.1,1.7,2.4,2.2,3.9c0.5,1.5,0.7,3,0.7,4.6C88.3,101.5,88.1,103.1,87.7,104.5z M181.6,170.6c-2.8,2.4-6.3,4.4-10.4,5.9c-4.1,1.5-8.9,2.3-14.4,2.3c-5.8,0-11.1-1-16-2.9c-4.9-2-9.1-4.8-12.6-8.5c-3.5-3.7-6.2-8.2-8.2-13.5c-2-5.3-3-11.1-3-17.5c0-6.3,1.1-12,3.2-17.1c2.1-5.1,5.1-9.4,8.8-13c3.7-3.6,8.1-6.4,13.2-8.4c5.1-2,10.7-3,16.9-3c7.4,0,13.5,1.5,18.4,4.5v15.1c-4.8-3.3-10.2-5-16.2-5c-4.1,0-7.8,0.7-11.1,2.2c-3.3,1.5-6.1,3.6-8.4,6.3c-2.3,2.7-4.1,5.9-5.4,9.6c-1.3,3.7-1.9,7.8-1.9,12.2c0,4.4,0.7,8.4,2,11.9c1.3,3.5,3.2,6.5,5.6,9c2.4,2.5,5.3,4.4,8.7,5.7c3.4,1.3,7.2,2,11.5,2c7.4,0,13.5-2.5,18.2-7.6v14.9H181.6z"
      />
    </svg>
  );
}

export function OrcidSignInButton({
  callbackURL = "/dashboard",
  errorCallbackURL,
  className,
}: OrcidSignInButtonProps) {
  async function handleOrcid() {
    await signOutAndStartSocialSignIn({
      provider: "orcid",
      callbackURL,
      errorCallbackURL,
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "w-full cursor-pointer"}
      onClick={() => void handleOrcid()}
    >
      <OrcidIdMark className="h-[18px] w-[18px] shrink-0" />
      Continue with ORCID
    </Button>
  );
}
