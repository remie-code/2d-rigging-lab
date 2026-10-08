import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { shouldRenderInputDiagnosticsPanel } from "./control-window-app";
import {
  ControlWindowShell,
  type ControlWindowPage
} from "./control-window-shell";
import { LiveControllerPage } from "./live-controller-page";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import {
  runtimePlayerStageViewCoordinateSpace,
  runtimePlayerStageWindowTitle,
  type RuntimePlayerStageMotionSettingsUpdate,
  type RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus
} from "../preload/runtime-variant-bridge-contract";

describe("LiveControllerPage", () => {
  it("renders Variant controls first with compact live quick actions", () => {
    const markup = renderLiveControllerMarkup();

    expect(markup).toContain("Status");
    expect(markup).toContain("Variants");
    expect(markup).toContain("Expression");
    expect(markup).toContain("Default");
    expect(markup).toContain("Smile");
    expect(markup).toContain("Accessory");
    expect(markup).toContain("Glasses");
    expect(markup).toContain("Cat ears");
    expect(markup).toContain("Reset to Model Default");
    expect(markup).toContain("Look Forward");
    expect(markup).toContain("Stage Motion Off");
    expect(markup).toContain("Center Model");
    expect(markup.indexOf("Variants")).toBeLessThan(
      markup.indexOf("Recenter")
    );
    expect(markup).not.toContain("Runtime Parameter");
    expect(markup).not.toContain("Raw");
    expect(markup).not.toContain("Calibration");
  });

  it("wires singleSelect, multiToggle, reset, and quick actions", () => {
    const onSelectSingleVariant = vi.fn();
    const onToggleMultiVariant = vi.fn();
    const onResetVariants = vi.fn();
    const onLookForward = vi.fn();
    const onCenterModel = vi.fn();
    const onUpdateStageMotionSettings = vi.fn();
    const tree = createLiveControllerTree({
      onSelectSingleVariant,
      onToggleMultiVariant,
      onResetVariants,
      onLookForward,
      onCenterModel,
      onUpdateStageMotionSettings
    });

    clickButton(tree, "Expression Smile");
    clickButton(tree, "Accessory Cat ears");
    clickButton(tree, "Reset to Model Default");
    clickButton(tree, "Look Forward");
    clickButton(tree, "Center Model");
    clickButton(tree, "Toggle Stage Motion");

    expect(onSelectSingleVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        variantGroupId: "vgrp_expression"
      }),
      "var_smile"
    );
    expect(onToggleMultiVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        variantGroupId: "vgrp_accessory"
      }),
      "var_cat_ears",
      true
    );
    expect(onResetVariants).toHaveBeenCalledOnce();
    expect(onLookForward).toHaveBeenCalledOnce();
    expect(onCenterModel).toHaveBeenCalledOnce();
    expect(onUpdateStageMotionSettings).toHaveBeenCalledWith({
      enabled: true
    });
  });

  it("shows no-variants and legacy states without enabling switching", () => {
    const noVariantsMarkup = renderLiveControllerMarkup({
      variantStatus: createVariantStatus({
        state: "no-variants",
        controlsEnabled: false,
        groups: []
      })
    });
    const legacyMarkup = renderLiveControllerMarkup({
      variantStatus: createVariantStatus({
        state: "legacy-export",
        controlsEnabled: false,
        statusLabel: "Re-export required for Variant switching",
        guidance:
          "This Runtime Export is missing base visibility data. Re-export the model from the current Editor to enable live Variant switching."
      })
    });

    expect(noVariantsMarkup).toContain("No Variants in Runtime Export");
    expect(legacyMarkup).toContain("Re-export required");
    expect(legacyMarkup).toContain("disabled");
  });
});

describe("ControlWindowShell navigation", () => {
  it("shows Runtime Player pages in accepted navigation order", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ControlWindowShell,
        {
          activePage: "live-controller",
          runtimeExportLabel: "Loaded",
          runtimeExportTone: "teal",
          inputLabel: "Input Live",
          inputTone: "teal",
          profileLabel: "Profile Ready",
          profileTone: "teal",
          liveLabel: "Ready",
          onSelectPage: noopPage,
          onOpenRuntimeExport: noop,
          onLookForward: noop,
          onFocusStage: noop,
          lookForwardDisabled: false,
          runtimeExportBusy: false,
          children: createElement("div", null, "Current page")
        }
      )
    );

    const overviewNavIndex = markup.indexOf(">Overview<");
    const liveControllerNavIndex = markup.indexOf(">Live Controller<");
    const inputNavIndex = markup.indexOf(">Input<");
    const mappingNavIndex = markup.indexOf(">Mapping<");
    const dynamicsTuneNavIndex = markup.indexOf(">Dynamics Tune<");
    const stageNavIndex = markup.indexOf(">Stage<");
    const diagnosticsNavIndex = markup.indexOf(">Performance Diagnostics<");

    expect(overviewNavIndex).toBeGreaterThanOrEqual(0);
    expect(liveControllerNavIndex).toBeGreaterThan(overviewNavIndex);
    expect(inputNavIndex).toBeGreaterThan(liveControllerNavIndex);
    expect(mappingNavIndex).toBeGreaterThan(inputNavIndex);
    expect(dynamicsTuneNavIndex).toBeGreaterThan(mappingNavIndex);
    expect(stageNavIndex).toBeGreaterThan(dynamicsTuneNavIndex);
    expect(diagnosticsNavIndex).toBeGreaterThan(stageNavIndex);
  });
});

describe("ControlWindowApp diagnostics panel policy", () => {
  it("hides raw input diagnostics on Live Controller and Performance Diagnostics pages", () => {
    const pages: readonly ControlWindowPage[] = [
      "overview",
      "live-controller",
      "input",
      "mapping",
      "dynamics-tune",
      "stage",
      "performance-diagnostics"
    ];

    expect(pages.map((page) => [
      page,
      shouldRenderInputDiagnosticsPanel(page)
    ])).toEqual([
      ["overview", true],
      ["live-controller", false],
      ["input", true],
      ["mapping", true],
      ["dynamics-tune", false],
      ["stage", true],
      ["performance-diagnostics", false]
    ]);
  });
});

function renderLiveControllerMarkup(input: LiveControllerTestInput = {}): string {
  return renderToStaticMarkup(createLiveControllerTree(input));
}

function createLiveControllerTree(
  input: LiveControllerTestInput = {}
): ReactElement {
  return createElement(LiveControllerPage, {
    variantStatus: input.variantStatus ?? createVariantStatus(),
    runtimeExportStatus: null,
    inputStatus: input.inputStatus ?? createInputStatus(),
    browserSourceStatus: null,
    stageState: input.stageState ?? createStageState(),
    lookForwardAvailable: input.lookForwardAvailable ?? true,
    onSelectSingleVariant: input.onSelectSingleVariant ?? noopVariantAction,
    onToggleMultiVariant: input.onToggleMultiVariant ?? noopVariantToggle,
    onResetVariants: input.onResetVariants ?? noop,
    onLookForward: input.onLookForward ?? noop,
    onCenterModel: input.onCenterModel ?? noop,
    onUpdateStageMotionSettings:
      input.onUpdateStageMotionSettings ?? noopStageMotionUpdate
  });
}

function clickButton(node: ReactNode, ariaLabel: string): void {
  const props = findElementByAriaLabel(node, ariaLabel);

  expect(props?.onClick).toBeTypeOf("function");
  props?.onClick?.();
}

function findElementByAriaLabel(
  node: ReactNode,
  ariaLabel: string
): ElementProps | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;
  if (props["aria-label"] === ariaLabel || props.label === ariaLabel) {
    return props;
  }

  if (typeof node.type === "function") {
    return findElementByAriaLabel(
      (node.type as ComponentFunction)(node.props),
      ariaLabel
    );
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementByAriaLabel(child, ariaLabel);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function createVariantStatus(input: {
  readonly state?: RuntimePlayerVariantControllerStatus["state"];
  readonly controlsEnabled?: boolean;
  readonly statusLabel?: string;
  readonly guidance?: string | null;
  readonly groups?: RuntimePlayerVariantControllerStatus["groups"];
} = {}): RuntimePlayerVariantControllerStatus {
  const groups = input.groups ?? [
    {
      variantGroupId: "vgrp_expression",
      displayName: "Expression",
      mode: "singleSelect",
      variants: [
        {
          variantId: "var_expression_default",
          displayName: "Default",
          active: true
        },
        {
          variantId: "var_smile",
          displayName: "Smile",
          active: false
        }
      ]
    },
    {
      variantGroupId: "vgrp_accessory",
      displayName: "Accessory",
      mode: "multiToggle",
      variants: [
        {
          variantId: "var_glasses",
          displayName: "Glasses",
          active: true
        },
        {
          variantId: "var_cat_ears",
          displayName: "Cat ears",
          active: false
        }
      ]
    }
  ];
  const state = input.state ?? "ready";
  const controlsEnabled = input.controlsEnabled ?? state === "ready";

  return {
    schemaVersion: "runtime-player-variant-controller-status-v1",
    state,
    statusLabel: input.statusLabel ??
      (state === "ready"
        ? "Variant switching ready"
        : "No Variants in Runtime Export"),
    guidance: input.guidance ?? (state === "ready" ? null : "No Variants."),
    controlsEnabled,
    groups,
    activeVariantSelection: {
      schemaVersion: "runtime-player-active-variant-selection-v1",
      state: controlsEnabled ? "ready" : "disabled",
      updatedAtIso: "2026-06-24T00:00:00.000Z",
      activeSelections: controlsEnabled
        ? [
            {
              variantGroupId: "vgrp_expression",
              activeSelection: {
                kind: "singleSelect",
                variantId: "var_expression_default"
              }
            },
            {
              variantGroupId: "vgrp_accessory",
              activeSelection: {
                kind: "multiToggle",
                variantIds: ["var_glasses"]
              }
            }
          ]
        : []
    },
    defaultActiveSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: "var_expression_default"
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        activeSelection: {
          kind: "multiToggle",
          variantIds: ["var_glasses"]
        }
      }
    ],
    updatedAtIso: "2026-06-24T00:00:00.000Z"
  };
}

function createInputStatus(): RuntimePlayerInputStatus {
  return {
    source: "ifacialmocap",
    sourceLabel: "iFacialMocap",
    transport: "udp",
    transportLabel: "UDP",
    receivePort: 49983,
    connectionState: "receiving",
    localIpCandidates: [],
    packetCount: 10,
    estimatedFps: 60,
    diagnostics: {}
  };
}

function createStageState(): RuntimePlayerStageStateSnapshot {
  return {
    stageWindow: {
      windowState: "created",
      bounds: null
    },
    stageView: {
      renderStatus: {
        status: "ready",
        statusLabel: "Ready",
        message: "Stage ready",
        details: [],
        tone: "success",
        updatedAtIso: "2026-06-24T00:00:00.000Z"
      },
      transform: {
        zoomScale: 1,
        pan: { x: 0, y: 0 },
        coordinateSpace: runtimePlayerStageViewCoordinateSpace
      }
    },
    stageMotion: {
      settings: {
        enabled: false,
        horizontal: {
          strengthPx: 80,
          limitPx: 120,
          invert: false
        },
        scale: {
          strength: 0.06,
          limit: 0.1,
          invert: false
        },
        deadZone: 0.03,
        reaction: 8
      }
    },
    persistence: {
      status: "saved",
      statusLabel: "Saved",
      storageLabel: "window-state/runtime-player.json",
      updatedAtIso: "2026-06-24T00:00:00.000Z",
      warningMessages: []
    },
    capture: {
      arrangeModeEnabled: false,
      clickThroughEnabled: false,
      alwaysOnTopEnabled: false,
      windowTitle: runtimePlayerStageWindowTitle,
      background: "transparent",
      stageUi: "hidden"
    }
  };
}

function noop(): void {
  return undefined;
}

function noopPage(): void {
  return undefined;
}

function noopVariantAction(): void {
  return undefined;
}

function noopVariantToggle(): void {
  return undefined;
}

function noopStageMotionUpdate(
  _update: RuntimePlayerStageMotionSettingsUpdate
): void {
  return undefined;
}

type LiveControllerTestInput = {
  readonly variantStatus?: RuntimePlayerVariantControllerStatus;
  readonly inputStatus?: RuntimePlayerInputStatus;
  readonly stageState?: RuntimePlayerStageStateSnapshot;
  readonly lookForwardAvailable?: boolean;
  readonly onSelectSingleVariant?: LiveControllerProps["onSelectSingleVariant"];
  readonly onToggleMultiVariant?: LiveControllerProps["onToggleMultiVariant"];
  readonly onResetVariants?: () => void;
  readonly onLookForward?: () => void;
  readonly onCenterModel?: () => void;
  readonly onUpdateStageMotionSettings?: (
    update: RuntimePlayerStageMotionSettingsUpdate
  ) => void;
};

type LiveControllerProps = Parameters<typeof LiveControllerPage>[0];

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly label?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
};
