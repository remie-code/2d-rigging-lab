import { runtimePlayerBrowserSourceDefaultPort } from "../broadcast-source/browser-source-url";

/**
 * The two composed host roles a Runtime Player process can start as.
 *
 * The role is resolved once, at the composition-root entry, from launch
 * arguments. It is carried through as data so the composition root can select
 * which registrar set to assemble. It MUST NOT be re-tested at runtime with
 * `if (role === ...)` behavioural branches.
 */
export const runtimePlayerHostRoles = [
  "trackingHost",
  "autonomousHost"
] as const;

export type RuntimePlayerHostRole = (typeof runtimePlayerHostRoles)[number];

export function isRuntimePlayerHostRole(
  value: unknown
): value is RuntimePlayerHostRole {
  return (
    typeof value === "string" &&
    (runtimePlayerHostRoles as readonly string[]).includes(value)
  );
}

/**
 * Human-readable role vocabulary (English UI wording). Shared so that display
 * surfaces (dialog copy, later Domain B title/badge/tray) map role -> label
 * with a table lookup rather than an `if (role === ...)` branch.
 */
export const runtimePlayerHostRoleLabels = {
  trackingHost: "Tracking Host",
  autonomousHost: "Autonomous Host"
} as const satisfies Record<RuntimePlayerHostRole, string>;

/**
 * Default profile-slot name each role binds to when `--profile` is omitted.
 */
export const runtimePlayerDefaultSlotNames = {
  trackingHost: "tracking-default",
  autonomousHost: "autonomous-default"
} as const satisfies Record<RuntimePlayerHostRole, string>;

export function defaultSlotNameForRole(role: RuntimePlayerHostRole): string {
  return runtimePlayerDefaultSlotNames[role];
}

/**
 * The slot that adopts the pre-slot (legacy root userData) profile data once,
 * so today's single Tracking Host usage keeps working after the split.
 */
export const runtimePlayerLegacyAdoptionSlotName =
  runtimePlayerDefaultSlotNames.trackingHost;

/**
 * Fixed preferred Browser Source ports for the role default slots. Any other
 * (custom) slot auto-assigns a free port on first creation. Keyed by slot name
 * (data), not by role, so there is no role branch here either.
 */
export const runtimePlayerDefaultSlotPreferredPorts: Readonly<
  Record<string, number>
> = {
  [runtimePlayerDefaultSlotNames.trackingHost]:
    runtimePlayerBrowserSourceDefaultPort,
  [runtimePlayerDefaultSlotNames.autonomousHost]:
    runtimePlayerBrowserSourceDefaultPort + 1
};
