import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DynamicsTunePage } from "./dynamics-tune-page";
import {
  runtimePlayerEffectiveDynamicsTuningSchemaVersion,
  type RuntimePlayerDynamicsTuningGroupUpdateRequest,
  type RuntimePlayerDynamicsTuningStatus
} from "../preload/dynamics-tuning-bridge-contract";

describe("DynamicsTunePage", () => {
  it("renders clear empty states for missing Runtime Export and no dynamics groups", () => {
    const unavailableMarkup = renderDynamicsTunePageMarkup({
      dynamicsStatus: createUnavailableDynamicsStatus()
    });
    const noGroupsMarkup = renderDynamicsTunePageMarkup({
      dynamicsStatus: createReadyDynamicsStatus({
        groups: [],
        dynamicsGroupCount: 0,
        overriddenGroupCount: 0
      })
    });

    expect(unavailableMarkup).toContain("Runtime Export required");
    expect(unavailableMarkup).toContain(
      "Open a Runtime Export to tune exported Dynamics Groups in Player."
    );
    expect(noGroupsMarkup).toContain("No exported dynamics");
    expect(noGroupsMarkup).toContain(
      "This Runtime Export does not contain Dynamics Groups to tune."
    );
  });

  it("renders exported dynamics group controls from bridge state", () => {
    const markup = renderDynamicsTunePageMarkup();

    expect(markup).toContain("Dynamics Tune");
    expect(markup).toContain("Wave21 Test Model");
    expect(markup).toContain("Hair Dynamics");
    expect(markup).toContain("Enabled");
    expect(markup).toContain("Tuned");
    expect(markup).toContain("Inputs");
    expect(markup).toContain("Outputs");
    expect(markup).toContain("1 input / 1 output");
    expect(markup).toContain("Head X (angle)");
    expect(markup).toContain("Front Hair (segment 1)");
    expect(markup).toContain("Output Scale");
    expect(markup).toContain("Length Scale");
    expect(markup).toContain("Limit");
    expect(markup).toContain("Damping");
    expect(markup).toContain("Gravity Scale");
    expect(markup).not.toContain("grp_hair");
    expect(markup).not.toContain("Strength");
    expect(markup).not.toContain("Sway");
    expect(markup).not.toContain("Reaction");
    expect(markup).not.toContain("Convergence");
    expect(markup).not.toContain("Create Dynamics Group");
    expect(markup).not.toContain("Delete Dynamics Group");
    expect(markup).not.toContain("Output invert");
    expect(markup).not.toContain("Pendulum count");
  });

  it("calls updateGroup payloads with expected quick tune fields", () => {
    const onUpdateGroup = vi.fn();
    const tree = createDynamicsTunePageTree({ onUpdateGroup });

    changeCheckbox(tree, "Dynamics Tune Hair Dynamics Enabled", false);
    changeRange(tree, "Dynamics Tune Hair Dynamics Output Scale", "0.65");
    changeRange(tree, "Dynamics Tune Hair Dynamics Length Scale", "1.6");
    changeRange(tree, "Dynamics Tune Hair Dynamics Limit", "0.85");
    changeRange(tree, "Dynamics Tune Hair Dynamics Damping", "11.5");
    changeRange(tree, "Dynamics Tune Hair Dynamics Gravity Scale", "0.7");

    expect(onUpdateGroup).toHaveBeenNthCalledWith(1, {
      groupId: "grp_hair",
      enabled: false
    });
    expect(onUpdateGroup).toHaveBeenNthCalledWith(2, {
      groupId: "grp_hair",
      outputScale: 0.65
    });
    expect(onUpdateGroup).toHaveBeenNthCalledWith(3, {
      groupId: "grp_hair",
      lengthScale: 1.6
    });
    expect(onUpdateGroup).toHaveBeenNthCalledWith(4, {
      groupId: "grp_hair",
      limit: 0.85
    });
    expect(onUpdateGroup).toHaveBeenNthCalledWith(5, {
      groupId: "grp_hair",
      damping: 11.5
    });
    expect(onUpdateGroup).toHaveBeenNthCalledWith(6, {
      groupId: "grp_hair",
      gravityScale: 0.7
    });
  });

  it("calls reset and retry callbacks for group reset and save failure", () => {
    const onResetGroup = vi.fn();
    const onRetryProfileSave = vi.fn();
    const resetTree = createDynamicsTunePageTree({ onResetGroup });
    const retryTree = createDynamicsTunePageTree({
      dynamicsStatus: createReadyDynamicsStatus({
        profileStatus: {
          kind: "save-failed",
          label: "Save failed",
          warningMessages: ["Profile write failed."]
        }
      }),
      onRetryProfileSave
    });

    clickButton(resetTree, "Reset Hair Dynamics");
    clickButton(retryTree, "Retry");

    expect(onResetGroup).toHaveBeenCalledWith("grp_hair");
    expect(onRetryProfileSave).toHaveBeenCalledOnce();
  });

  it("disables group reset when the group has no override", () => {
    const onResetGroup = vi.fn();
    const tree = createDynamicsTunePageTree({
      dynamicsStatus: createReadyDynamicsStatus({
        groups: [
          createDynamicsGroupStatus({
            effectiveValues: createExportedDynamicsValues(),
            override: null,
            hasOverride: false
          })
        ],
        overriddenGroupCount: 0
      }),
      onResetGroup
    });

    const resetButton = findElementByAriaLabelOrLabel(
      tree,
      "Reset Hair Dynamics"
    );

    expect(resetButton?.disabled).toBe(true);
    expect(clickEnabledButton(tree, "Reset Hair Dynamics")).toBe(false);
    expect(onResetGroup).not.toHaveBeenCalled();
  });

  it("does not render private export paths, raw tracking data, or profile internals", () => {
    const markup = renderDynamicsTunePageMarkup({
      dynamicsStatus: createReadyDynamicsStatus({
        effectiveProfileFingerprint: "C:\\Users\\remie\\private\\model"
      })
    });

    expect(markup).not.toContain("C:\\Users\\remie\\private\\model");
    expect(markup).not.toContain("fingerprint");
    expect(markup).not.toContain("dynamicsSignatureHash");
    expect(markup).not.toContain("trackingFrame");
  });
});

function renderDynamicsTunePageMarkup(
  input: DynamicsTunePageTestInput = {}
): string {
  return renderToStaticMarkup(createDynamicsTunePageTree(input));
}

function createDynamicsTunePageTree(
  input: DynamicsTunePageTestInput = {}
): ReactElement {
  return createElement(DynamicsTunePage, {
    dynamicsStatus: input.dynamicsStatus ?? createReadyDynamicsStatus(),
    onUpdateGroup: input.onUpdateGroup ?? noopUpdateGroup,
    onResetGroup: input.onResetGroup ?? noopResetGroup,
    onRetryProfileSave: input.onRetryProfileSave ?? noop
  });
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

function clickEnabledButton(node: ReactNode, label: string): boolean {
  const props = findElementByAriaLabelOrLabel(node, label);

  expect(props?.onClick).toBeTypeOf("function");
  if (props?.disabled === true) {
    return false;
  }

  props?.onClick?.();
  return true;
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

function createUnavailableDynamicsStatus(): RuntimePlayerDynamicsTuningStatus {
  return {
    status: "unavailable",
    statusLabel: "Runtime Export required",
    runtimeExport: null,
    profileStatus: {
      kind: "unavailable",
      label: "Runtime Export required",
      warningMessages: []
    },
    groups: [],
    dynamicsGroupCount: 0,
    overriddenGroupCount: 0,
    dynamicsSignatureHash: null,
    tuningRevision: 0,
    effectiveProfile: null,
    updatedAtIso: "2026-07-01T00:00:00.000Z"
  };
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
          outputScale: 0.5,
          damping: 10
        }
      }
    },
    updatedAtIso: "2026-07-01T00:01:00.000Z",
    ...patch
  };
}

function createDynamicsGroupStatus(
  patch: Partial<RuntimePlayerDynamicsTuningStatus["groups"][number]> = {}
): RuntimePlayerDynamicsTuningStatus["groups"][number] {
  const exportedValues = createExportedDynamicsValues();

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
        kind: "segment 1",
        displayName: "Front Hair"
      }
    ],
    exportedValues,
    effectiveValues: {
      enabled: true,
      outputScale: 0.5,
      limit: 0.7,
      damping: 3.5,
      gravityScale: 0.6,
      lengthScale: 1.4
    },
    override: {
      outputScale: 0.5,
      limit: 0.7,
      damping: 3.5,
      gravityScale: 0.6,
      lengthScale: 1.4
    },
    hasOverride: true,
    warningMessages: [],
    ...patch
  };
}

function createExportedDynamicsValues(): RuntimePlayerDynamicsTuningStatus["groups"][number]["exportedValues"] {
  return {
    enabled: true,
    outputScale: 1,
    limit: 0.4,
    damping: 2.5,
    gravityScale: 1,
    lengthScale: 1
  };
}

function noop(): void {
  return undefined;
}

function noopUpdateGroup(
  _request: RuntimePlayerDynamicsTuningGroupUpdateRequest
): void {
  return undefined;
}

function noopResetGroup(_groupId: string): void {
  return undefined;
}

type DynamicsTunePageTestInput = {
  readonly dynamicsStatus?: RuntimePlayerDynamicsTuningStatus;
  readonly onUpdateGroup?: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => void;
  readonly onResetGroup?: (groupId: string) => void;
  readonly onRetryProfileSave?: () => void;
};

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
