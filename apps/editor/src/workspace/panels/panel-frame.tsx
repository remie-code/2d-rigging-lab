import type { ReactNode } from "react";

import { cn } from "../../lib/class-name";

export function WorkspacePanel({
  children,
  className,
  title,
  overline
}: {
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
      <div className="border-b border-neutral-800 px-3 py-2">
        {overline ? (
          <div className="text-[11px] font-medium uppercase text-neutral-500">{overline}</div>
        ) : null}
        <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}
