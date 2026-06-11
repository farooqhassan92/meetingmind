import * as React from "react";

import { cn } from "@/lib/utils";

type TooltipProps = {
  children: React.ReactNode;
  className?: string;
  content: string;
};

export function Tooltip({ children, className, content }: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block"
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
