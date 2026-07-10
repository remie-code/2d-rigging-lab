import path from "node:path";

import { validateRuntimePlayerSlotName } from "./slot-name";

/**
 * Directory (under the default userData root) that holds every named slot.
 */
export const runtimePlayerSlotsDirectoryName = "slots";

/**
 * Pure derivation of a slot's effective userData base path.
 *
 * `<defaultUserDataPath>/slots/<slotName>`. The slot name is validated here as
 * defence-in-depth so a bad name can never be joined into a path even if a
 * caller skips the resolution layer.
 */
export function deriveRuntimePlayerSlotUserDataPath(input: {
  readonly defaultUserDataPath: string;
  readonly slotName: string;
}): string {
  const validation = validateRuntimePlayerSlotName(input.slotName);
  if (!validation.ok) {
    throw new Error(
      `Cannot derive slot path for invalid slot name: ${validation.reason}`
    );
  }

  return path.join(
    input.defaultUserDataPath,
    runtimePlayerSlotsDirectoryName,
    input.slotName
  );
}
