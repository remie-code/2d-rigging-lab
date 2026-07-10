import { app, dialog } from "electron";

import {
  runtimePlayerHostRoleLabels,
  runtimePlayerHostRoles,
  type RuntimePlayerHostRole
} from "../profile-slots/host-role";

/**
 * The minimal, C1-scope role selection stub for the argument-less launch.
 *
 * Contract (c1-role-skeleton §2, permanent): an argument-less launch is NEVER
 * implicitly bound to a role. It asks, and only a deliberate user choice picks a
 * role. Nothing is remembered — there is no "always use this" affordance, so the
 * stub is re-shown on every argument-less launch. The full picker (card UI /
 * Create shortcut / Autonomous-only link) is a later wave; this is only the
 * plain dialog that keeps the "no implicit binding" invariant from day one.
 */

export type RuntimePlayerRoleSelectionOutcome =
  | { readonly kind: "relaunching"; readonly role: RuntimePlayerHostRole }
  | { readonly kind: "cancelled" };

export type RuntimePlayerRoleSelectionStubIo = {
  /** Ask the user which role to launch as. `null` = cancelled / dismissed. */
  readonly chooseRole: () => Promise<RuntimePlayerHostRole | null>;
  /** Relaunch this process bound to the chosen role. */
  readonly relaunchWithRole: (role: RuntimePlayerHostRole) => void;
  /** Quit without binding to any role. */
  readonly quit: () => void;
};

/**
 * Pure orchestration of the stub: ask, then either relaunch with the chosen
 * role or quit. Deliberately holds no state and writes nothing to disk, so the
 * "no memory / no implicit binding" invariant is structural, not incidental.
 */
export async function presentRuntimePlayerRoleSelectionStub(
  io: RuntimePlayerRoleSelectionStubIo
): Promise<RuntimePlayerRoleSelectionOutcome> {
  const role = await io.chooseRole();

  if (role === null) {
    io.quit();
    return { kind: "cancelled" };
  }

  io.relaunchWithRole(role);
  return { kind: "relaunching", role };
}

/**
 * Default Electron-backed IO. The dialog buttons are derived from the role table
 * (data lookup, not a role branch); the chosen button index maps back to a role
 * through the same ordered table. A chosen role relaunches the process with
 * `--role=<role>` so the fresh start re-runs the synchronous slot/userData
 * resolution before `app` is ready.
 */
export function createRuntimePlayerRoleSelectionStubIo(): RuntimePlayerRoleSelectionStubIo {
  const orderedRoles = runtimePlayerHostRoles;
  const roleButtons = orderedRoles.map(
    (role) => runtimePlayerHostRoleLabels[role]
  );
  const cancelIndex = roleButtons.length;

  return {
    chooseRole: async () => {
      const { response } = await dialog.showMessageBox({
        type: "question",
        title: "Runtime Player",
        message: "Choose how to launch Runtime Player.",
        detail:
          "Pick a role for this launch. This choice is not remembered — you " +
          "will be asked again next time you launch without a role.",
        buttons: [...roleButtons, "Cancel"],
        defaultId: 0,
        cancelId: cancelIndex,
        noLink: true
      });

      return orderedRoles[response] ?? null;
    },
    relaunchWithRole: (role) => {
      app.relaunch({
        args: process.argv.slice(1).concat([`--role=${role}`])
      });
      app.quit();
    },
    quit: () => {
      app.quit();
    }
  };
}
