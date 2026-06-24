import type {
  VariantDefaultActiveSelectionDto,
  VariantGroupIdDto,
  VariantGroupModeDto,
  VariantIdDto
} from "@private-2d-rigging-lab/package-format";

export const runtimePlayerActiveVariantSelectionSchemaVersion =
  "runtime-player-active-variant-selection-v1" as const;

export const runtimePlayerVariantControllerStatusSchemaVersion =
  "runtime-player-variant-controller-status-v1" as const;

export type RuntimePlayerActiveVariantSelectionEntry = {
  readonly variantGroupId: VariantGroupIdDto;
  readonly activeSelection: VariantDefaultActiveSelectionDto;
};

export type RuntimePlayerActiveVariantSelectionState = {
  readonly schemaVersion: typeof runtimePlayerActiveVariantSelectionSchemaVersion;
  readonly state: "disabled" | "ready";
  readonly activeSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly updatedAtIso: string | null;
};

export type RuntimePlayerVariantControllerState =
  | "no-model"
  | "no-variants"
  | "legacy-export"
  | "ready";

export type RuntimePlayerVariantControlOption = {
  readonly variantId: VariantIdDto;
  readonly displayName: string;
  readonly active: boolean;
};

export type RuntimePlayerVariantControlGroup = {
  readonly variantGroupId: VariantGroupIdDto;
  readonly displayName: string;
  readonly mode: VariantGroupModeDto;
  readonly variants: readonly RuntimePlayerVariantControlOption[];
};

export type RuntimePlayerVariantControllerStatus = {
  readonly schemaVersion: typeof runtimePlayerVariantControllerStatusSchemaVersion;
  readonly state: RuntimePlayerVariantControllerState;
  readonly statusLabel: string;
  readonly guidance: string | null;
  readonly controlsEnabled: boolean;
  readonly groups: readonly RuntimePlayerVariantControlGroup[];
  readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
  readonly defaultActiveSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly updatedAtIso: string;
};

export type RuntimePlayerVariantSingleSelectRequest = {
  readonly variantGroupId: VariantGroupIdDto;
  readonly variantId: VariantIdDto;
};

export type RuntimePlayerVariantMultiToggleRequest = {
  readonly variantGroupId: VariantGroupIdDto;
  readonly variantId: VariantIdDto;
  readonly active?: boolean;
};

export type RuntimePlayerVariantActionResult = {
  readonly result: "ok" | "error";
  readonly message: string;
  readonly status: RuntimePlayerVariantControllerStatus;
  readonly atIso: string;
};

export type RuntimePlayerVariantControllerApi = {
  readonly getStatus: () => Promise<RuntimePlayerVariantControllerStatus>;
  readonly selectSingle: (
    request: RuntimePlayerVariantSingleSelectRequest
  ) => Promise<RuntimePlayerVariantActionResult>;
  readonly toggleMulti: (
    request: RuntimePlayerVariantMultiToggleRequest
  ) => Promise<RuntimePlayerVariantActionResult>;
  readonly resetToDefault: () => Promise<RuntimePlayerVariantActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerVariantControllerStatus) => void
  ) => () => void;
};
