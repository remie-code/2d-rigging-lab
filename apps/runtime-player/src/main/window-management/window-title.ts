import { runtimePlayerStageWindowTitle } from "../../preload/runtime-player-bridge-contract";
import {
  runtimePlayerHostRoleLabels,
  type RuntimePlayerHostRole
} from "../profile-slots/host-role";

/**
 * Title bases the composed window titles build on. Kept aligned with the
 * historical fixed titles so a role-less compose is byte-for-byte the old
 * value.
 */
export const runtimePlayerControlWindowTitleBase = "Runtime Player" as const;
export const runtimePlayerStageWindowTitleBase = runtimePlayerStageWindowTitle;

const titleSeparator = " — "; // em dash with surrounding spaces

/**
 * Compose a window title from a base plus the (optional) role label and the
 * (optional) loaded model name.
 *
 * The role is carried as data and mapped to its label with the shared lookup
 * table (never an `if (role === ...)` branch). A `null` role yields the plain
 * base (today's title), so non-role callers and tests stay unchanged.
 */
export function composeRuntimePlayerWindowTitle(input: {
  readonly base: string;
  readonly role: RuntimePlayerHostRole | null;
  readonly modelName?: string | null;
}): string {
  const segments: string[] = [input.base];

  if (input.role !== null) {
    segments.push(runtimePlayerHostRoleLabels[input.role]);
  }

  const modelName = input.modelName?.trim();
  if (modelName !== undefined && modelName.length > 0) {
    segments.push(modelName);
  }

  return segments.join(titleSeparator);
}

export function composeRuntimePlayerControlWindowTitle(input: {
  readonly role: RuntimePlayerHostRole | null;
  readonly modelName?: string | null;
}): string {
  return composeRuntimePlayerWindowTitle({
    base: runtimePlayerControlWindowTitleBase,
    role: input.role,
    modelName: input.modelName ?? null
  });
}

export function composeRuntimePlayerStageWindowTitle(input: {
  readonly role: RuntimePlayerHostRole | null;
  readonly modelName?: string | null;
}): string {
  return composeRuntimePlayerWindowTitle({
    base: runtimePlayerStageWindowTitleBase,
    role: input.role,
    modelName: input.modelName ?? null
  });
}

/**
 * Tray tooltip form (c1-role-skeleton §7.4): "Runtime Player — <role> / <model>".
 * Role uses the em-dash separator; the loaded model name uses " / ". A role dot
 * on the icon is out of scope for this wave (tooltip only).
 */
export function composeRuntimePlayerTrayTooltip(input: {
  readonly role: RuntimePlayerHostRole | null;
  readonly modelName?: string | null;
}): string {
  const roleSegment =
    input.role === null
      ? ""
      : `${titleSeparator}${runtimePlayerHostRoleLabels[input.role]}`;
  const modelName = input.modelName?.trim();
  const modelSegment =
    modelName !== undefined && modelName.length > 0 ? ` / ${modelName}` : "";

  return `${runtimePlayerControlWindowTitleBase}${roleSegment}${modelSegment}`;
}
