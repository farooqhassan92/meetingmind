"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";

type ActionItemNoticeToastProps = {
  notice?: string;
};

const notices = {
  "action-completed": {
    title: "Action item completed",
    description: "The item was marked complete."
  },
  "action-reopened": {
    title: "Action item reopened",
    description: "The item is back in the open list."
  },
  "action-updated": {
    title: "Action item updated",
    description: "The assignment details were saved."
  }
} satisfies Record<string, { description: string; title: string }>;

export function ActionItemNoticeToast({ notice }: ActionItemNoticeToastProps) {
  const shownNotice = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (!notice || !(notice in notices) || shownNotice.current === notice) {
      return;
    }

    shownNotice.current = notice;
    showToast({
      ...notices[notice as keyof typeof notices],
      variant: "success"
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("notice");
    const query = nextParams.toString();

    router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
      scroll: false
    });
  }, [notice, pathname, router, searchParams, showToast]);

  return null;
}
