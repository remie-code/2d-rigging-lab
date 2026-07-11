import type { ReactElement, ReactNode } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { RuntimePlayerStageViewStatus } from "../preload/runtime-player-bridge-contract";

export type ControlFeedbackTone = "neutral" | "success" | "error";

export function Panel({
  title,
  children
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-md border border-neutral-800 bg-[#151716] p-4">
      <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
      <div className="mt-4 grid gap-2">{children}</div>
    </section>
  );
}

export function StatusRow({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <div className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-neutral-100">
        {value}
      </dd>
    </div>
  );
}

export function StatusPill({
  children,
  tone
}: {
  readonly children: ReactNode;
  readonly tone: "amber" | "teal" | "red" | "neutral";
}): ReactElement {
  const toneClass =
    tone === "teal"
      ? "border-teal-700/60 bg-teal-950/40 text-teal-100"
      : tone === "red"
        ? "border-red-800/70 bg-red-950/40 text-red-100"
        : tone === "amber"
          ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
          : "border-neutral-700 bg-neutral-900 text-neutral-200";

  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function IconTextButton({
  icon: Icon,
  label,
  onClick,
  variant,
  disabled = false
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: "primary" | "secondary" | "ghost";
  readonly disabled?: boolean;
}): ReactElement {
  const variantClass =
    variant === "primary"
      ? "border-teal-500 bg-teal-500 text-neutral-950 hover:bg-teal-400"
      : variant === "secondary"
        ? "border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-teal-500/70 hover:text-teal-100"
        : "border-neutral-800 bg-transparent text-neutral-300 hover:border-neutral-600 hover:text-neutral-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * The one-line degraded / empty state shared across subsystem pages (C3/C4 方式):
 * a host without a given subsystem shows this品位ある一文 instead of劣化 controls.
 * Driven by subsystem-availability DATA (never a role query). Optionally carries a
 * single guidance action (e.g. Physiologyページ誘導, C4 §3).
 */
export function EmptySubsystemNotice({
  title,
  message,
  action
}: {
  readonly title: string;
  readonly message: string;
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
}): ReactElement {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200">
          <Activity aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          <p className="mt-1 text-sm text-neutral-400">{message}</p>
          {action === undefined ? null : (
            <div className="mt-3">
              <IconTextButton
                icon={Activity}
                label={action.label}
                onClick={action.onClick}
                variant="secondary"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackNotice({
  message,
  tone
}: {
  readonly message: string;
  readonly tone: ControlFeedbackTone;
}): ReactElement {
  return (
    <div
      aria-live="polite"
      className={`min-h-10 rounded-md border px-4 py-3 text-sm ${getFeedbackClass(tone)}`}
    >
      {message}
    </div>
  );
}

export function ErrorNotice({
  title,
  details
}: {
  readonly title: string;
  readonly details: readonly string[];
}): ReactElement {
  return (
    <div className="mt-2 rounded-md border border-red-900 bg-red-950/25 p-3 text-sm text-red-100">
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {details.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-xs text-red-200/80">
              {details.slice(0, 3).map((detail) => (
                <li key={detail} className="break-words">
                  {detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StageStatusNotice({
  status
}: {
  readonly status: RuntimePlayerStageViewStatus;
}): ReactElement {
  const toneClass =
    status.tone === "error"
      ? "border-red-900 bg-red-950/25 text-red-100"
      : status.tone === "warning"
        ? "border-amber-800 bg-amber-950/25 text-amber-100"
        : status.tone === "success"
          ? "border-teal-800 bg-teal-950/25 text-teal-100"
          : "border-neutral-800 bg-[#111312] text-neutral-300";

  return (
    <div className={`mt-2 rounded-md border p-3 text-sm ${toneClass}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{status.message}</p>
          {status.details.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-xs opacity-85">
              {status.details.slice(0, 4).map((detail) => (
                <li key={detail} className="break-words">
                  {detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getFeedbackClass(tone: ControlFeedbackTone): string {
  if (tone === "success") {
    return "border-teal-800 bg-teal-950/35 text-teal-100";
  }

  if (tone === "error") {
    return "border-red-900 bg-red-950/30 text-red-100";
  }

  return "border-neutral-800 bg-[#111312] text-neutral-300";
}
