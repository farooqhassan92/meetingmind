import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Pencil,
  UserRound
} from "lucide-react";
import Link from "next/link";

import {
  toggleActionItemAction,
  updateActionItemAction
} from "@/app/dashboard/action-items/actions";
import { Button } from "@/components/ui/button";

export type ActionItemWorkflowItem = {
  assignedUser: {
    email: string;
    id: string;
    name: string | null;
  } | null;
  assignee: string | null;
  canManage?: boolean;
  completed: boolean;
  completedAt: Date | null;
  deadline: string | null;
  id: string;
  meetingId: string;
  meetingTitle?: string;
  title: string;
};

export type ActionItemAssignee = {
  email: string;
  id: string;
  name: string | null;
};

type ActionItemWorkflowProps = {
  assignees: ActionItemAssignee[];
  canManage: boolean;
  emptyMessage?: string;
  items: ActionItemWorkflowItem[];
  returnTo: string;
  showMeetingTitle?: boolean;
};

function assigneeLabel(assignee: ActionItemAssignee) {
  return assignee.name ? `${assignee.name} (${assignee.email})` : assignee.email;
}

function itemAssigneeLabel(item: ActionItemWorkflowItem) {
  if (item.assignedUser) {
    return item.assignedUser.name ?? item.assignedUser.email;
  }

  return item.assignee ?? "Unassigned";
}

function statusStyles(completed: boolean) {
  return completed
    ? "bg-teal-50 text-teal-700 ring-teal-100"
    : "bg-amber-50 text-amber-700 ring-amber-100";
}

export function ActionItemWorkflow({
  assignees,
  canManage,
  emptyMessage = "No action items were detected for this meeting.",
  items,
  returnTo,
  showMeetingTitle = false
}: ActionItemWorkflowProps) {
  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => {
        const itemCanManage = item.canManage ?? canManage;

        return (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={item.id}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${statusStyles(
                      item.completed
                    )}`}
                  >
                    {item.completed ? "Completed" : "Open"}
                  </span>
                  {showMeetingTitle && item.meetingTitle ? (
                    <Link
                      className="min-w-0 truncate text-xs font-medium text-teal-700 hover:text-teal-900"
                      href={`/dashboard/${item.meetingId}`}
                    >
                      {item.meetingTitle}
                    </Link>
                  ) : null}
                </div>
                <p
                  className={
                    item.completed
                      ? "mt-3 font-medium leading-6 text-slate-500 line-through"
                      : "mt-3 font-medium leading-6 text-slate-950"
                  }
                >
                  {item.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                    <UserRound className="h-3.5 w-3.5" />
                    {itemAssigneeLabel(item)}
                  </span>
                  {item.deadline ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {item.deadline}
                    </span>
                  ) : null}
                  {item.completedAt ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-500">
                      Done {item.completedAt.toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
              <form action={toggleActionItemAction}>
                <input name="actionItemId" type="hidden" value={item.id} />
                <input
                  name="completed"
                  type="hidden"
                  value={item.completed ? "false" : "true"}
                />
                <input name="returnTo" type="hidden" value={returnTo} />
                <Button
                  className="w-full lg:w-auto"
                  type="submit"
                  variant={item.completed ? "outline" : "default"}
                >
                  {item.completed ? (
                    <Circle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {item.completed ? "Reopen" : "Complete"}
                </Button>
              </form>
            </div>

          {itemCanManage ? (
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950">
                <Pencil className="h-4 w-4" />
                Edit details
              </summary>
              <form
                action={updateActionItemAction}
                className="mt-3 grid min-w-0 gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.65fr)_auto]"
              >
                <input name="actionItemId" type="hidden" value={item.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-1">
                  Action
                  <input
                    className="mt-2 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={item.title}
                    name="title"
                    required
                  />
                </label>
                <label className="min-w-0 text-sm font-medium text-slate-700">
                  Owner
                  <select
                    className="mt-2 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={item.assignedUser?.id ?? ""}
                    name="assigneeUserId"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assigneeLabel(assignee)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-slate-700">
                  Deadline
                  <input
                    className="mt-2 h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={item.deadline ?? ""}
                    name="deadline"
                    placeholder="No deadline"
                  />
                </label>
                <Button
                  className="w-full self-end xl:w-auto"
                  type="submit"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                  Save
                </Button>
              </form>
            </details>
          ) : null}
          </div>
        );
      })}
    </div>
  );
}
