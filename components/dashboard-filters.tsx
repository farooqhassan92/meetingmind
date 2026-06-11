"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

type DashboardFilterTeam = {
  id: string;
  name: string;
  organizationId: string;
};

type DashboardFilterOrganization = {
  id: string;
  name: string;
  teams: DashboardFilterTeam[];
};

type DateRangeOption = {
  label: string;
  value: string;
};

type DashboardFiltersProps = {
  dateRangeOptions: DateRangeOption[];
  from: string;
  hasActiveFilters: boolean;
  maxDate: string;
  organizations: DashboardFilterOrganization[];
  query: string;
  range: string;
  selectedOrganizationId: string;
  selectedTeamId: string;
  to: string;
};

export function DashboardFilters({
  dateRangeOptions,
  from,
  hasActiveFilters,
  maxDate,
  organizations,
  query,
  range,
  selectedOrganizationId,
  selectedTeamId,
  to
}: DashboardFiltersProps) {
  const [organizationId, setOrganizationId] = useState(selectedOrganizationId);
  const [teamId, setTeamId] = useState(selectedTeamId);
  const selectedOrganization = useMemo(
    () =>
      organizations.find((organization) => organization.id === organizationId),
    [organizationId, organizations]
  );
  const teams = selectedOrganization
    ? selectedOrganization.teams
    : organizations.flatMap((organization) => organization.teams);

  return (
    <form
      action="/dashboard"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr]">
        <label className="relative" htmlFor="meeting-search">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Search
          </span>
          <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={query}
            id="meeting-search"
            name="query"
            placeholder="Search meetings, decisions, topics..."
            type="search"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <Tooltip content="Organizations are filtered by organization ID. Names are only labels.">
            <span>Organization</span>
          </Tooltip>
          <select
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="organizationId"
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setTeamId("");
            }}
            value={organizationId}
          >
            <option value="">All organizations</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          <Tooltip content="Teams are filtered by team ID. Duplicate team names are safe.">
            <span>Team</span>
          </Tooltip>
          <select
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="teamId"
            onChange={(event) => setTeamId(event.target.value)}
            value={teamId}
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          <Tooltip content="Date filters search by when meetings were created.">
            <span>Date</span>
          </Tooltip>
          <select
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={range}
            name="range"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={from}
            max={to || undefined}
            name="from"
            type="date"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={to}
            max={maxDate}
            min={from || undefined}
            name="to"
            type="date"
          />
        </label>
        <Button className="w-full sm:w-auto" type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Apply filters
        </Button>
        {hasActiveFilters ? (
          <Button asChild className="w-full sm:w-auto" type="button" variant="outline">
            <Link href="/dashboard">
              <X className="h-4 w-4" />
              Clear
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
