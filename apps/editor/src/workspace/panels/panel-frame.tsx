import type { ReactNode } from "react";

import { cn } from "../../lib/class-name";

export function WorkspacePanel({
  actions,
  children,
  className,
  title,
  overline
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
  overline?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#161615]",
        className
      )}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2">
        <div className="min-w-0">
          {overline ? (
            <div className="text-[11px] font-medium uppercase text-neutral-500">{overline}</div>
          ) : null}
          <h2 className="truncate text-sm font-semibold text-neutral-100">{title}</h2>
        </div>
        {actions === undefined ? null : (
          <div className="flex min-w-0 shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}
