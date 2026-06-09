"use client";

import { UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export function UserMenu() {
  const isMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return <span aria-hidden className="block h-8 w-8" />;
  }

  return <UserButton />;
}
