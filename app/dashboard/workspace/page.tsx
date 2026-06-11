import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  CalendarDays,
  Link2,
  Mail,
  Plus,
  Users
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ensureAppUser,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

import {
  addExistingMemberAction,
  assignTeamMemberAction,
  cancelInvitationAction,
  createInvitationAction,
  createOrganizationAction,
  createTeamAction,
  removeOrganizationMemberAction,
  removeTeamMemberAction,
  updateOrganizationMemberRoleAction
} from "./actions";

type WorkspacePageProps = {
  searchParams?: Promise<{
    organizationId?: string;
    tab?: string;
  }>;
};

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "teams", label: "Teams" },
  { value: "members", label: "Members" },
  { value: "invites", label: "Invitations" }
] as const;
const organizationRoles = ["CEO", "MEMBER"];
const teamRoles = ["MANAGER", "MEMBER"];
const roleDescriptions = {
  CEO: "Can manage organization members, teams, invitations, and search every meeting in the organization.",
  MANAGER:
    "Can manage members and meetings for teams where they are assigned as manager.",
  MEMBER: "Can access meetings for teams where they are assigned as a member."
};

type WorkspaceMember = Prisma.PromiseReturnType<
  typeof getWorkspaceMembers
>[number];
type WorkspaceInvitation = Prisma.PromiseReturnType<
  typeof getWorkspaceInvitations
>[number];

function tabHref(organizationId: string, tab: string) {
  return `/dashboard/workspace?organizationId=${organizationId}&tab=${tab}`;
}

function getWorkspaceMembers(organizationId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });
}

function getWorkspaceInvitations(organizationId: string) {
  return prisma.organizationInvitation.findMany({
    where: {
      organizationId,
      acceptedAt: null
    },
    include: { team: true },
    orderBy: { createdAt: "desc" }
  });
}

export default async function WorkspacePage({
  searchParams
}: WorkspacePageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  if (!email) {
    throw new Error("Signed-in user is missing a primary email address.");
  }

  await ensureAppUser({
    clerkId: userId,
    email,
    name: clerkUser.fullName ?? clerkUser.username ?? null
  });

  const access = await getUserMeetingAccess(userId);

  if (!access || access.memberships.length === 0) {
    redirect("/onboarding" as Route);
  }

  const params = await searchParams;
  const selectedTab = tabs.some((tab) => tab.value === params?.tab)
    ? params?.tab ?? "overview"
    : "overview";
  const organizations = access.organizations;
  const selectedOrganization =
    organizations.find(
      (organization) => organization.id === params?.organizationId
    ) ?? organizations[0];
  const isSelectedCeo = access.ceoOrganizationIds.includes(
    selectedOrganization.id
  );
  const members = await getWorkspaceMembers(selectedOrganization.id);
  const invitations = await getWorkspaceInvitations(selectedOrganization.id);
  const meetingCount = await prisma.meeting.count({
    where: { organizationId: selectedOrganization.id }
  });
  const manageableTeamIds = new Set([
    ...selectedOrganization.teams
      .filter(() => isSelectedCeo)
      .map((team) => team.id),
    ...access.managedTeamIds
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Workspace</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Manage organization access without mixing every workflow together.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to history</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <form
            action="/dashboard/workspace"
            className="flex min-w-64 flex-1 flex-wrap items-end gap-2"
          >
            <label className="min-w-64 flex-1 text-sm font-medium text-slate-700">
              Organization
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                defaultValue={selectedOrganization.id}
                name="organizationId"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <input name="tab" type="hidden" value={selectedTab} />
            <Button type="submit" variant="outline">
              Switch
            </Button>
          </form>
          <Tooltip
            content={isSelectedCeo ? roleDescriptions.CEO : roleDescriptions.MEMBER}
          >
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              {isSelectedCeo ? "CEO" : "MEMBER"}
            </span>
          </Tooltip>
        </div>

        <form action={createOrganizationAction} className="mt-5 flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="name"
            placeholder="Create another organization..."
            required
          />
          <Button type="submit" variant="outline">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </form>
      </div>

      <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <Button
            asChild
            key={tab.value}
            variant={selectedTab === tab.value ? "default" : "outline"}
          >
            <Link
              href={
                tabHref(selectedOrganization.id, tab.value) as Route
              }
            >
              {tab.label}
            </Link>
          </Button>
        ))}
      </nav>

      {selectedTab === "overview" ? (
        <OverviewPanel
          invitationCount={invitations.length}
          isCeo={isSelectedCeo}
          meetingCount={meetingCount}
          memberCount={members.length}
          organizationName={selectedOrganization.name}
          teamCount={selectedOrganization.teams.length}
        />
      ) : null}

      {selectedTab === "teams" ? (
        <TeamsPanel
          canCreateTeam={isSelectedCeo}
          manageableTeamIds={manageableTeamIds}
          members={members}
          organizationId={selectedOrganization.id}
          teams={selectedOrganization.teams}
        />
      ) : null}

      {selectedTab === "members" ? (
        <MembersPanel
          canManageMembers={isSelectedCeo}
          members={members}
          organizationId={selectedOrganization.id}
        />
      ) : null}

      {selectedTab === "invites" ? (
        <InvitationsPanel
          canInvite={isSelectedCeo}
          invitations={invitations}
          organizationId={selectedOrganization.id}
          teams={selectedOrganization.teams}
        />
      ) : null}
    </section>
  );
}

function OverviewPanel({
  invitationCount,
  isCeo,
  meetingCount,
  memberCount,
  organizationName,
  teamCount
}: {
  invitationCount: number;
  isCeo: boolean;
  meetingCount: number;
  memberCount: number;
  organizationName: string;
  teamCount: number;
}) {
  const stats = [
    { icon: CalendarDays, label: "Meetings", value: meetingCount },
    { icon: Building2, label: "Teams", value: teamCount },
    { icon: Users, label: "Members", value: memberCount },
    { icon: Mail, label: "Pending invites", value: invitationCount }
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {organizationName}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isCeo
              ? "You can manage this organization and search all team meetings."
              : "You can access meetings for teams you belong to."}
          </p>
        </div>
        <Tooltip content={isCeo ? roleDescriptions.CEO : roleDescriptions.MEMBER}>
          <span className="rounded-md bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
            {isCeo ? "CEO access" : "Member access"}
          </span>
        </Tooltip>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-4"
            key={stat.label}
          >
            <stat.icon className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {stat.value}
            </p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamsPanel({
  canCreateTeam,
  manageableTeamIds,
  members,
  organizationId,
  teams
}: {
  canCreateTeam: boolean;
  manageableTeamIds: Set<string>;
  members: WorkspaceMember[];
  organizationId: string;
  teams: NonNullable<
    Awaited<ReturnType<typeof getUserMeetingAccess>>
  >["organizations"][number]["teams"];
}) {
  return (
    <section className="space-y-4">
      {canCreateTeam ? (
        <form
          action={createTeamAction}
          className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input name="organizationId" type="hidden" value={organizationId} />
          <input
            className="h-10 min-w-64 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="name"
            placeholder="New team name"
            required
          />
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Add team
          </Button>
        </form>
      ) : null}

      {teams.map((team) => (
        <div
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          key={team.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {team.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {team.members.length} member
                {team.members.length === 1 ? "" : "s"}
              </p>
            </div>
            {manageableTeamIds.has(team.id) ? (
              <form
                action={assignTeamMemberAction}
                className="flex flex-wrap gap-2"
              >
                <input name="teamId" type="hidden" value={team.id} />
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  name="userId"
                >
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.name ?? member.user.email}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  defaultValue="MEMBER"
                  name="role"
                  title={roleDescriptions.MANAGER}
                >
                  {teamRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline">
                  Assign
                </Button>
              </form>
            ) : null}
          </div>
          <div className="mt-4 space-y-2">
            {team.members.length > 0 ? (
              team.members.map((member) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  key={member.id}
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {member.user.name ?? member.user.email}
                    </p>
                    <p className="text-sm text-slate-500">
                      {member.user.email}
                    </p>
                  </div>
                  {manageableTeamIds.has(team.id) ? (
                    <div className="flex flex-wrap gap-2">
                      <form
                        action={assignTeamMemberAction}
                        className="flex items-center gap-2"
                      >
                        <input name="teamId" type="hidden" value={team.id} />
                        <input
                          name="userId"
                          type="hidden"
                          value={member.userId}
                        />
                        <select
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          defaultValue={member.role}
                          name="role"
                          title={roleDescriptions.MANAGER}
                        >
                          {teamRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline">
                          Update
                        </Button>
                      </form>
                      <form action={removeTeamMemberAction}>
                        <input name="teamId" type="hidden" value={team.id} />
                        <input
                          name="userId"
                          type="hidden"
                          value={member.userId}
                        />
                        <Button type="submit" variant="destructive">
                          Remove
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <Tooltip
                      content={
                        member.role === "MANAGER"
                          ? roleDescriptions.MANAGER
                          : roleDescriptions.MEMBER
                      }
                    >
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium">
                        {member.role}
                      </span>
                    </Tooltip>
                  )}
                </div>
              ))
            ) : (
              <span className="text-sm text-slate-500">
                No team members assigned yet.
              </span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function MembersPanel({
  canManageMembers,
  members,
  organizationId
}: {
  canManageMembers: boolean;
  members: WorkspaceMember[];
  organizationId: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-teal-700" />
        <h2 className="text-lg font-semibold text-slate-950">Members</h2>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
        {members.map((member) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 last:border-b-0"
            key={member.id}
          >
            <div>
              <p className="text-sm font-medium text-slate-950">
                {member.user.name ?? member.user.email}
              </p>
              <p className="text-sm text-slate-500">{member.user.email}</p>
            </div>
            {canManageMembers ? (
              <div className="flex flex-wrap gap-2">
                <form
                  action={updateOrganizationMemberRoleAction}
                  className="flex gap-2"
                >
                  <input
                    name="organizationId"
                    type="hidden"
                    value={organizationId}
                  />
                  <input name="userId" type="hidden" value={member.userId} />
                  <select
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={member.role}
                    name="role"
                    title={roleDescriptions.CEO}
                  >
                    {organizationRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">
                    Update
                  </Button>
                </form>
                <form action={removeOrganizationMemberAction}>
                  <input
                    name="organizationId"
                    type="hidden"
                    value={organizationId}
                  />
                  <input name="userId" type="hidden" value={member.userId} />
                  <Button type="submit" variant="destructive">
                    Remove
                  </Button>
                </form>
              </div>
            ) : (
              <Tooltip
                content={
                  member.role === "CEO"
                    ? roleDescriptions.CEO
                    : roleDescriptions.MEMBER
                }
              >
                <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">
                  {member.role}
                </span>
              </Tooltip>
            )}
          </div>
        ))}
      </div>

      {canManageMembers ? (
        <form
          action={addExistingMemberAction}
          className="mt-5 flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
        >
          <input name="organizationId" type="hidden" value={organizationId} />
          <input
            className="h-10 min-w-64 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="email"
            placeholder="Add signed-in user by email"
            required
            type="email"
          />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue="MEMBER"
            name="role"
            title={roleDescriptions.CEO}
          >
            {organizationRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function InvitationsPanel({
  canInvite,
  invitations,
  organizationId,
  teams
}: {
  canInvite: boolean;
  invitations: WorkspaceInvitation[];
  organizationId: string;
  teams: NonNullable<
    Awaited<ReturnType<typeof getUserMeetingAccess>>
  >["organizations"][number]["teams"];
}) {
  return (
    <section className="space-y-4">
      {canInvite ? (
        <form
          action={createInvitationAction}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Create invitation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Generate an invite link for a new organization or team member.
            </p>
          </div>
          <input name="organizationId" type="hidden" value={organizationId} />
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              name="email"
              placeholder="Invite email"
              required
              type="email"
            />
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue="MEMBER"
              name="organizationRole"
              title={roleDescriptions.CEO}
            >
              {organizationRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue=""
              name="teamId"
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue="MEMBER"
              name="teamRole"
              title={roleDescriptions.MANAGER}
            >
              {teamRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <Button type="submit">
              <Mail className="h-4 w-4" />
              Invite
            </Button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            CEO is organization-wide. Manager and member permissions apply to
            the selected team.
          </p>
        </form>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-teal-700" />
          <h2 className="text-lg font-semibold text-slate-950">
            Pending invitations
          </h2>
        </div>
        <div className="mt-4 space-y-2">
          {invitations.length > 0 ? (
            invitations.map((invitation) => (
              <div
                className="rounded-md border border-slate-200 px-3 py-3 text-sm"
                key={invitation.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">
                      {invitation.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {invitation.organizationRole}
                      {invitation.team
                        ? ` / ${invitation.team.name} ${invitation.teamRole}`
                        : ""}
                    </p>
                    <p className="mt-2 break-all text-xs text-teal-700">
                      /invite/{invitation.token}
                    </p>
                  </div>
                {canInvite ? (
                  <form action={cancelInvitationAction}>
                    <input
                      name="organizationId"
                      type="hidden"
                      value={organizationId}
                    />
                    <input
                      name="invitationId"
                      type="hidden"
                      value={invitation.id}
                    />
                    <Button type="submit" variant="destructive">
                      Cancel invite
                    </Button>
                  </form>
                ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No pending invitations.</p>
          )}
        </div>
      </div>
    </section>
  );
}
