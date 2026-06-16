"use client";

import { useEffect, useRef } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/toast";

type WorkspaceNoticeToastProps = {
  notice?: string;
};

const notices = {
  "existing-member-added": {
    title: "Member added",
    description: "The member now has access to this organization."
  },
  "invite-cancelled": {
    title: "Invitation cancelled",
    description: "The invite link is no longer active."
  },
  "invite-created": {
    title: "Invitation sent",
    description: "The invitation email was sent and the link is ready."
  },
  "invite-resent": {
    title: "Invitation resent",
    description: "A fresh invitation email was sent."
  },
  "member-removed": {
    title: "Member removed",
    description: "The member no longer has organization access."
  },
  "member-role-updated": {
    title: "Member role updated",
    description: "The organization role was saved."
  },
  "organization-created": {
    title: "Organization created",
    description: "You can now add teams, members, and meetings."
  },
  "team-archived": {
    title: "Team archived",
    description: "The team is hidden from new meeting workflows."
  },
  "team-created": {
    title: "Team created",
    description: "You can now assign members to the team."
  },
  "team-member-assigned": {
    title: "Team member updated",
    description: "The team membership was saved."
  },
  "team-member-removed": {
    title: "Team member removed",
    description: "The member no longer belongs to this team."
  },
  "team-restored": {
    title: "Team restored",
    description: "The team is available for meetings again."
  }
} satisfies Record<string, { description: string; title: string }>;

export function WorkspaceNoticeToast({ notice }: WorkspaceNoticeToastProps) {
  const shownNotice = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (!notice || !(notice in notices)) {
      return;
    }

    if (shownNotice.current === notice) {
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
