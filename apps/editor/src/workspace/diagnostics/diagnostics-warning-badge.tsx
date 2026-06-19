import { cn } from "../../lib/class-name";

export function DiagnosticsWarningBadge({
  className,
  count
}: {
  readonly className?: string;
  readonly count: number;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} validation warning${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full border border-amber-400/80 bg-amber-500 px-1.5 text-[10px] font-bold leading-5 text-neutral-950 shadow",
        className
      )}
      data-testid="diagnostics-warning-badge"
    >
      {count}
    </span>
  );
}
