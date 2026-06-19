"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function OnboardingActions() {
  const { signOut } = useClerk();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  function refreshInvitations() {
    setIsRefreshing(true);
    router.refresh();
    window.setTimeout(() => setIsRefreshing(false), 600);
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={isRefreshing}
        onClick={refreshInvitations}
        type="button"
        variant="outline"
      >
        <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {isRefreshing ? "Checking..." : "Check invitations again"}
      </Button>
      <Button
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
        variant="outline"
      >
        <LogOut className="h-4 w-4" />
        {isSigningOut ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}
