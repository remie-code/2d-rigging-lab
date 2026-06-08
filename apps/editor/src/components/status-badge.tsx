import type { ReactNode } from "react";

import { cn } from "../lib/class-name";

type StatusBadgeTone = "neutral" | "ready";

const toneClassName: Record<StatusBadgeTone, string> = {
  neutral: "border-neutral-700 bg-neutral-950 text-neutral-300",
  ready: "border-emerald-700/70 bg-emerald-950/40 text-emerald-200"
};

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: StatusBadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-44 items-center truncate border px-3 text-xs font-medium",
        toneClassName[tone]
      )}
    >
      {children}
    </span>
  );
}
