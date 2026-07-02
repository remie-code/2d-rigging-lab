import {
  Children,
  isValidElement,
  type ReactNode
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  connectControlWindowDynamicsTuningStatusBridge,
  renderControlWindowDynamicsTuneRoute
} from "./control-window-app";
import {
  runtimePlayerEffectiveDynamicsTuningSchemaVersion,
  type RuntimePlayerDynamicsTuningActionResult,
  type RuntimePlayerDynamicsTuningApi,
  type RuntimePlayerDynamicsTuningStatus
} from "../preload/dynamics-tuning-bridge-contract";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ControlWindowApp Dynamics Tune bridge wiring", () => {
  it("requests initial dynamics tuning status and propagates status changes", async () => {
    const initialStatus = createReadyDynamicsStatus({ tuningRevision: 2 });
    const changedStatus = createReadyDynamicsStatus({ tuningRevision: 3 });
    const { bridge, emitStatusChanged, unsubscribe } =
      createDynamicsTuningBridge(initialStatus);
    const onStatus = vi.fn();
    let active = true;

    const unsubscribeBridge = connectControlWindowDynamicsTuningStatusBridge({
      runtimePlayer: {
        dynamicsTuning: bridge
      },
      isActive: () => active,
      onStatus
    });

    expect(bridge.getStatus).toHaveBeenCalledOnce();
    expect(bridge.onStatusChanged).toHaveBeenCalledOnce();

    await flushMicrotasks();

    expect(onStatus).toHaveBeenCalledWith(initialStatus);

    emitStatusChanged(changedStatus);
    expect(onStatus).toHaveBeenLastCalledWith(changedStatus);

    active = false;
    emitStatusChanged(createReadyDynamicsStatus({ tuningRevision: 4 }));
    expect(onStatus).toHaveBeenCalledTimes(2);

    unsubscribeBridge();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("wires Dynamics Tune route actions to runtimePlayer.dynamicsTuning", () => {
    const status = createReadyDynamicsStatus({
      profileStatus: {
        kind: "save-failed",
        label: "Save failed",
        warningMessages: ["Profile write failed."]
      }
    });
    const { bridge } = createDynamicsTuningBridge(status);
    const runDynamicsTuneAction = vi.fn(
      async (
        action: () => Promise<RuntimePlayerDynamicsTuningActionResult>
      ) => {
        await action();
      }
    );

    vi.stubGlobal("window", {
      runtimePlayer: {
        dynamicsTuning: bridge
      }
    });

    const tree = renderControlWindowDynamicsTuneRoute({
      dynamicsTuningStatus: status,
      runDynamicsTuneAction
    });

    changeCheckbox(tree, "Dynamics Tune Hair Dynamics Enabled", false);
    changeRange(tree, "Dynamics Tune Hair Dynamics Strength", "0.65");
    clickButton(tree, "Reset Hair Dynamics");
    clickButton(tree, "Retry");

    expect(bridge.updateGroup).toHaveBeenNthCalledWith(1, {
      groupId: "grp_hair",
      enabled: false
    });
    expect(bridge.updateGroup).toHaveBeenNthCalledWith(2, {
      groupId: "grp_hair",
      strength: 0.65
    });
    expect(bridge.resetGroup).toHaveBeenCalledWith({
      groupId: "grp_hair"
    });
    expect(bridge.retryProfileSave).toHaveBeenCalledOnce();
    expect(runDynamicsTuneAction).toHaveBeenCalledTimes(4);
  });
});

function createDynamicsTuningBridge(
  status: RuntimePlayerDynamicsTuningStatus
): {
  readonly bridge: RuntimePlayerDynamicsTuningApi;
  readonly emitStatusChanged: (
    status: RuntimePlayerDynamicsTuningStatus
  ) => void;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
} {
  let statusChangedCallback:
    | ((status: RuntimePlayerDynamicsTuningStatus) => void)
    | null = null;
  const unsubscribe = vi.fn();
  const bridge: RuntimePlayerDynamicsTuningApi = {
    getStatus: vi.fn(async () => status),
    updateGroup: vi.fn(async () => createActionResult(status)),
    resetGroup: vi.fn(async () => createActionResult(status)),
    retryProfileSave: vi.fn(async () => createActionResult(status)),
    onStatusChanged: vi.fn((callback) => {
      statusChangedCallback = callback;
      return unsubscribe;
    })
  };

  return {
    bridge,
    emitStatusChanged: (nextStatus) => {
      expect(statusChangedCallback).not.toBeNull();
      statusChangedCallback?.(nextStatus);
    },
    unsubscribe
  };
}

function createActionResult(
  status: RuntimePlayerDynamicsTuningStatus
): RuntimePlayerDynamicsTuningActionResult {
  return {
    result: "ok",
    message: "Dynamics tuning updated.",
    status
  };
}

function changeRange(
  node: ReactNode,
  ariaLabel: string,
  value: string
): void {
  const props = findElementByAriaLabelOrLabel(node, ariaLabel);

  expect(props?.onChange).toBeTypeOf("function");
  props?.onChange?.({
    currentTarget: {
      value,
      checked: false
    }
  });
}

function changeCheckbox(
  node: ReactNode,
  ariaLabel: string,
  checked: boolean
): void {
  const props = findElementByAriaLabelOrLabel(node, ariaLabel);

  expect(props?.onChange).toBeTypeOf("function");
  props?.onChange?.({
    currentTarget: {
      value: "",
      checked
    }
  });
}

function clickButton(node: ReactNode, label: string): void {
  const props = findElementByAriaLabelOrLabel(node, label);

  expect(props?.onClick).toBeTypeOf("function");
  expect(props?.disabled).not.toBe(true);
  props?.onClick?.();
}

function findElementByAriaLabelOrLabel(
  node: ReactNode,
  label: string
): ElementProps | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;
  if (props["aria-label"] === label || props.label === label) {
    return props;
  }

  if (typeof node.type === "function") {
    return findElementByAriaLabelOrLabel(
      (node.type as ComponentFunction)(node.props),
      label
    );
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementByAriaLabelOrLabel(child, label);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createReadyDynamicsStatus(
  patch: Partial<RuntimePlayerDynamicsTuningStatus> & {
    readonly effectiveProfileFingerprint?: string;
  } = {}
): RuntimePlayerDynamicsTuningStatus {
  const groups = patch.groups ?? [createDynamicsGroupStatus()];
  const dynamicsGroupCount = patch.dynamicsGroupCount ?? groups.length;
  const overriddenGroupCount = patch.overriddenGroupCount ??
    groups.filter((group) => group.hasOverride).length;
  const fingerprint = patch.effectiveProfileFingerprint ?? "profile-fixture";

  return {
    status: "ready",
    statusLabel: `Dynamics groups ${overriddenGroupCount} / ${dynamicsGroupCount} tuned`,
    runtimeExport: {
      packageId: "wave21-test-package",
      packageRevision: 3,
      loadedAtIso: "2026-07-01T00:00:00.000Z",
      modelDisplayName: "Wave21 Test Model"
    },
    profileStatus: {
      kind: "saved",
      label: "Saved",
      warningMessages: [],
      updatedAtIso: "2026-07-01T00:01:00.000Z"
    },
    groups,
    dynamicsGroupCount,
    overriddenGroupCount,
    dynamicsSignatureHash: "dynamics-signature-fixture",
    tuningRevision: 2,
    effectiveProfile: {
      schemaVersion: runtimePlayerEffectiveDynamicsTuningSchemaVersion,
      revision: 2,
      fingerprint,
      updatedAtIso: "2026-07-01T00:01:00.000Z",
      exportIdentity: {
        packageId: "wave21-test-package",
        packageRevision: 3,
        packageHash: "package-hash-fixture",
        parameterSignatureHash: "parameter-signature-fixture"
      },
      dynamicsSignatureHash: "dynamics-signature-fixture",
      groups: {
        grp_hair: {
          strength: 0.5,
          reactionSpeed: 10
        }
      }
    },
    updatedAtIso: "2026-07-01T00:01:00.000Z",
    ...patch
  };
}

function createDynamicsGroupStatus(): RuntimePlayerDynamicsTuningStatus["groups"][number] {
  return {
    groupId: "grp_hair",
    displayName: "Hair Dynamics",
    inputSummary: [
      {
        parameterId: "ParamAngleX",
        kind: "angle",
        displayName: "Head X"
      }
    ],
    outputSummary: [
      {
        parameterId: "ParamHairFront",
        kind: "angle",
        displayName: "Front Hair"
      }
    ],
    exportedValues: {
      enabled: true,
      strength: 1,
      limit: 0.4,
      length: 1.2,
      sway: 0.3,
      reactionSpeed: 8,
      convergenceSpeed: 12
    },
    effectiveValues: {
      enabled: true,
      strength: 0.5,
      limit: 0.7,
      length: 1.4,
      sway: 0.6,
      reactionSpeed: 10,
      convergenceSpeed: 14
    },
    override: {
      strength: 0.5,
      limit: 0.7,
      length: 1.4,
      sway: 0.6,
      reactionSpeed: 10,
      convergenceSpeed: 14
    },
    hasOverride: true,
    warningMessages: []
  };
}

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly label?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly onChange?: (event: {
    readonly currentTarget: {
      readonly value: string;
      readonly checked: boolean;
    };
  }) => void;
};
