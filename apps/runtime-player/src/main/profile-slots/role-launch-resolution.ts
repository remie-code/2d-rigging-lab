import {
  defaultSlotNameForRole,
  isRuntimePlayerHostRole,
  runtimePlayerDefaultSlotPreferredPorts,
  runtimePlayerHostRoles,
  runtimePlayerLegacyAdoptionSlotName,
  type RuntimePlayerHostRole
} from "./host-role";
import { deriveRuntimePlayerSlotUserDataPath } from "./slot-paths";
import { validateRuntimePlayerSlotName } from "./slot-name";

/**
 * Pure result of reading `--role` / `--profile` off the process argv.
 *
 * `no-role` is not an error: it means the process was started without a role
 * (today's plain launch, or the future picker). Domain A guarantees a `no-role`
 * launch is never implicitly bound to any role/slot; Domain B renders the role
 * picker stub for it.
 */
export type RuntimePlayerRoleArguments =
  | {
      readonly kind: "role";
      readonly role: RuntimePlayerHostRole;
      readonly profile: string | null;
    }
  | { readonly kind: "no-role" }
  | { readonly kind: "error"; readonly message: string };

const roleFlag = "--role";
const profileFlag = "--profile";

function readFlagValue(
  argv: readonly string[],
  flag: string
): { readonly present: boolean; readonly value: string | null } {
  const prefix = `${flag}=`;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (token.startsWith(prefix)) {
      return { present: true, value: token.slice(prefix.length) };
    }

    if (token === flag) {
      const next = argv[index + 1];
      return {
        present: true,
        value: next !== undefined && !next.startsWith("--") ? next : null
      };
    }
  }

  return { present: false, value: null };
}

export function parseRuntimePlayerRoleArguments(
  argv: readonly string[]
): RuntimePlayerRoleArguments {
  const roleArg = readFlagValue(argv, roleFlag);
  const profileArg = readFlagValue(argv, profileFlag);

  if (!roleArg.present) {
    if (profileArg.present) {
      return {
        kind: "error",
        message: `${profileFlag} requires ${roleFlag} to also be provided.`
      };
    }

    return { kind: "no-role" };
  }

  if (roleArg.value === null || roleArg.value.length === 0) {
    return {
      kind: "error",
      message: `${roleFlag} requires a value (${runtimePlayerHostRoles.join(" | ")}).`
    };
  }

  if (!isRuntimePlayerHostRole(roleArg.value)) {
    return {
      kind: "error",
      message: `Unknown ${roleFlag} value "${roleArg.value}" (expected ${runtimePlayerHostRoles.join(" | ")}).`
    };
  }

  if (profileArg.present && (profileArg.value === null || profileArg.value.length === 0)) {
    return {
      kind: "error",
      message: `${profileFlag} requires a value when provided.`
    };
  }

  return {
    kind: "role",
    role: roleArg.value,
    profile: profileArg.present ? profileArg.value : null
  };
}

/**
 * How the Browser Source preferred port is chosen for a resolved slot. The
 * default role slots use their fixed port; any other slot auto-assigns a free
 * loopback port on first creation (there is never a manual port UI).
 */
export type RuntimePlayerSlotPreferredPortPlan =
  | { readonly mode: "fixed"; readonly port: number }
  | { readonly mode: "auto-assign" };

/**
 * The launch resolution the composition root consumes. `role-resolved` carries
 * everything Domain A provisions (slot path, legacy-adoption flag, port plan)
 * plus the `role` Domain B uses to select the registrar set at the single
 * composition point. `no-role` is passed through untouched (no implicit
 * binding). `error` is surfaced as a dialog before any window is created.
 */
export type RuntimePlayerSlotLaunch =
  | {
      readonly kind: "role-resolved";
      readonly role: RuntimePlayerHostRole;
      readonly slotName: string;
      readonly defaultUserDataPath: string;
      readonly slotUserDataPath: string;
      readonly isDefaultSlot: boolean;
      readonly adoptsLegacyDefaults: boolean;
      readonly preferredPort: RuntimePlayerSlotPreferredPortPlan;
    }
  | { readonly kind: "no-role" }
  | { readonly kind: "error"; readonly message: string };

function resolvePreferredPortPlan(
  slotName: string
): RuntimePlayerSlotPreferredPortPlan {
  const fixedPort = runtimePlayerDefaultSlotPreferredPorts[slotName];
  return fixedPort === undefined
    ? { mode: "auto-assign" }
    : { mode: "fixed", port: fixedPort };
}

export function resolveRuntimePlayerSlotLaunch(input: {
  readonly argv: readonly string[];
  readonly defaultUserDataPath: string;
}): RuntimePlayerSlotLaunch {
  const parsed = parseRuntimePlayerRoleArguments(input.argv);

  if (parsed.kind !== "role") {
    return parsed;
  }

  const slotName =
    parsed.profile === null
      ? defaultSlotNameForRole(parsed.role)
      : parsed.profile;

  const validation = validateRuntimePlayerSlotName(slotName);
  if (!validation.ok) {
    return {
      kind: "error",
      message: `Invalid profile slot name: ${validation.reason}`
    };
  }

  return {
    kind: "role-resolved",
    role: parsed.role,
    slotName,
    defaultUserDataPath: input.defaultUserDataPath,
    slotUserDataPath: deriveRuntimePlayerSlotUserDataPath({
      defaultUserDataPath: input.defaultUserDataPath,
      slotName
    }),
    isDefaultSlot: slotName === defaultSlotNameForRole(parsed.role),
    adoptsLegacyDefaults: slotName === runtimePlayerLegacyAdoptionSlotName,
    preferredPort: resolvePreferredPortPlan(slotName)
  };
}
