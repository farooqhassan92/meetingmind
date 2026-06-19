import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthUnconfigured } from "@/components/auth/auth-unconfigured";

type SignUpPageProps = {
  searchParams?: Promise<{
    redirect_url?: string;
  }>;
};

function safeRedirectUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const redirectUrl = safeRedirectUrl(params?.redirect_url);
  const hasClerkConfig = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (hasClerkConfig) {
    const { userId } = await auth();

    if (userId) {
      redirect(redirectUrl as Route);
    }
  }

  return (
    <AuthShell
      eyebrow="Start fresh"
      title="Create your MeetingMind account."
    >
      {hasClerkConfig ? (
        <SignUp
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          appearance={{
            elements: {
              cardBox: "shadow-sm",
              footerActionLink: "text-teal-700"
            }
          }}
        />
      ) : (
        <AuthUnconfigured />
      )}
    </AuthShell>
  );
}
