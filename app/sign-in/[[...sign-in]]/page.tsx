import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthUnconfigured } from "@/components/auth/auth-unconfigured";

export default async function SignInPage() {
  const hasClerkConfig = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (hasClerkConfig) {
    const { userId } = await auth();

    if (userId) {
      redirect("/dashboard");
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to analyze and revisit your meetings."
    >
      {hasClerkConfig ? (
        <SignIn
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
