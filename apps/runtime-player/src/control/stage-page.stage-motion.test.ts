import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StagePage } from "./stage-page";
import type {
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import {
  runtimePlayerStageViewCoordinateSpace,
  runtimePlayerStageWindowTitle,
  type RuntimePlayerStageMotionSettingsUpdate,
  type RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

describe("StagePage Stage Motion", () => {
  it("renders compact Stage Motion controls with auto-save status", () => {
    const markup = renderStagePageMarkup({
      inputProfileStatus: createInputProfileStatus("ready")
    });

    expect(markup).toContain("Stage Motion");
    expect(markup).toContain("Enabled");
    expect(markup).toContain("Horizontal Follow");
    expect(markup).toContain("Depth Scale");
    expect(markup).toContain("Stabilization");
    expect(markup).toContain("Auto Save");
    expect(markup).toContain("Saved");
    expect(markup).toContain("80 px");
    expect(markup).toContain("120 px");
    expect(markup).toContain("6%");
    expect(markup).toContain("10%");
    expect(markup).toContain("0.03");
    expect(markup).toContain("8");
  });

  it("keeps Stage Motion above Browser Source without moving fallback before Browser Source", () => {
    const markup = renderStagePageMarkup({
      inputProfileStatus: createInputProfileStatus("ready")
    });

    const stageMotionIndex = markup.indexOf("Stage Motion");
    const browserSourceIndex = markup.indexOf("Browser Source Output");
    const fallbackIndex = markup.indexOf("Local Preview / Fallback");

    expect(stageMotionIndex).toBeGreaterThanOrEqual(0);
    expect(browserSourceIndex).toBeGreaterThan(stageMotionIndex);
    expect(fallbackIndex).toBeGreaterThan(browserSourceIndex);
  });

  it("calls the Stage Motion update handler with partial setting updates", () => {
    const onUpdate = vi.fn();
    const tree = createStagePageTree({
      inputProfileStatus: createInputProfileStatus("ready"),
      onUpdateStageMotionSettings: onUpdate
    });

    changeCheckbox(tree, "Stage Motion Enabled", true);
    changeRange(tree, "Stage Motion Horizontal Follow Strength", "140");
    changeRange(tree, "Stage Motion Horizontal Follow Limit", "180");
    changeCheckbox(tree, "Stage Motion Horizontal Follow Invert", true);
    changeRange(tree, "Stage Motion Depth Scale Strength", "0.09");
    changeRange(tree, "Stage Motion Depth Scale Limit", "0.12");
    changeCheckbox(tree, "Stage Motion Depth Scale Invert", true);
    changeRange(tree, "Stage Motion Stabilization Dead Zone", "0.05");
    changeRange(tree, "Stage Motion Stabilization Reaction", "12.5");

    expect(onUpdate).toHaveBeenNthCalledWith(1, { enabled: true });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      horizontal: {
        strengthPx: 140
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(3, {
      horizontal: {
        limitPx: 180
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(4, {
      horizontal: {
        invert: true
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(5, {
      scale: {
        strength: 0.09
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(6, {
      scale: {
        limit: 0.12
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(7, {
      scale: {
        invert: true
      }
    });
    expect(onUpdate).toHaveBeenNthCalledWith(8, { deadZone: 0.05 });
    expect(onUpdate).toHaveBeenNthCalledWith(9, { reaction: 12.5 });
  });

  it("represents missing near/far calibration and wires the Input calibration route", () => {
    const onStartDepthScaleCalibration = vi.fn();
    const tree = createStagePageTree({
      inputProfileStatus: createInputProfileStatus("missing"),
      onStartDepthScaleCalibration
    });
    const markup = renderStagePageMarkup({
      inputProfileStatus: createInputProfileStatus("missing"),
      onStartDepthScaleCalibration
    });

    expect(markup).toContain("Depth Scale");
    expect(markup).toContain("Missing");
    expect(markup).toContain("Calibrate in Input");

    clickButton(tree, "Calibrate Depth Scale in Input");

    expect(onStartDepthScaleCalibration).toHaveBeenCalledOnce();
  });

  it("does not introduce mapping/editor controls or runtime parameter sliders", () => {
    const markup = renderStagePageMarkup({
      inputProfileStatus: createInputProfileStatus("ready")
    });

    expect(markup).not.toContain("Semantic Slots");
    expect(markup).not.toContain("Mapping Profile");
    expect(markup).not.toContain("Runtime Parameter");
    expect(markup).not.toContain("Face Angle");
  });
});

function renderStagePageMarkup(input: StagePageTestInput = {}): string {
  return renderToStaticMarkup(createStagePageTree(input));
}

function createStagePageTree(input: StagePageTestInput = {}): ReactElement {
  return createElement(StagePage, {
    stageState: input.stageState ?? createStageState(),
    inputProfileStatus: input.inputProfileStatus ?? null,
    runtimeExportStatus: null,
    browserSourceStatus: null,
    onFocusStage: noop,
    onResetView: noop,
    onCenterModel: noop,
    onUpdateStageMotionSettings:
      input.onUpdateStageMotionSettings ?? noopStageMotionUpdate,
    onStartDepthScaleCalibration:
      input.onStartDepthScaleCalibration ?? noop,
    onSetArrangeMode: noop,
    onSetClickThrough: noop,
    onSetAlwaysOnTop: noop,
    onCopyBrowserSourceUrl: noop,
    onCopyWindowTitle: noop,
    onOpenRuntimeExport: noop,
    onRetryRuntimeExportRestore: noop
  });
}

function changeRange(
  node: ReactNode,
  ariaLabel: string,
  value: string
): void {
  const props = findElementByAriaLabel(node, ariaLabel);

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
  const props = findElementByAriaLabel(node, ariaLabel);

  expect(props?.onChange).toBeTypeOf("function");
  props?.onChange?.({
    currentTarget: {
      value: "",
      checked
    }
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

  if (typeof node.type === "function") {
    return findElementByAriaLabel(
      (node.type as ComponentFunction)(node.props),
      ariaLabel
    );
  }

  const props = node.props as ElementProps;

  if (props["aria-label"] === ariaLabel) {
    return props;
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementByAriaLabel(child, ariaLabel);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function noop(): void {
  return undefined;
}

function noopStageMotionUpdate(
  _update: RuntimePlayerStageMotionSettingsUpdate
): void {
  return undefined;
}

function createStageState(): RuntimePlayerStageStateSnapshot {
  return {
    stageWindow: {
      windowState: "created",
      bounds: {
        x: 10,
        y: 20,
        width: 1280,
        height: 720
      }
    },
    stageView: {
      renderStatus: {
        status: "ready",
        statusLabel: "Ready",
        message: "Stage ready",
        details: [],
        tone: "success",
        updatedAtIso: "2026-06-23T00:00:00.000Z"
      },
      transform: {
        zoomScale: 1,
        pan: {
          x: 0,
          y: 0
        },
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
      updatedAtIso: "2026-06-23T00:00:00.000Z",
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

function createInputProfileStatus(
  nearFarStatus: "ready" | "missing"
): RuntimePlayerInputProfileStatus {
  const activeProfile = {
    profileId: "profile-1",
    displayName: "Desk Profile",
    source: "ifacialmocap" as const,
    transport: "udp" as const,
    createdAtIso: "2026-06-23T00:00:00.000Z",
    updatedAtIso: "2026-06-23T00:00:00.000Z",
    rangeStatus: "calibrated" as const,
    calibrationSections: [
      {
        key: "head-rotation" as const,
        label: "Head rotation",
        status: "ready" as const
      },
      {
        key: "eyes-mouth" as const,
        label: "Eyes / mouth",
        status: "ready" as const
      },
      {
        key: "head-position-left-right" as const,
        label: "Head position left/right",
        status: "ready" as const
      },
      {
        key: "head-position-near-far" as const,
        label: "Head position near/far",
        status: nearFarStatus
      }
    ]
  };

  return {
    source: "ifacialmocap",
    transport: "udp",
    profileMode: "saved",
    activeProfileId: activeProfile.profileId,
    activeProfile,
    profiles: [activeProfile],
    storage: {
      state: "loaded",
      warningMessages: []
    },
    temporaryDefaultsActive: false,
    sessionNeutral: null,
    calibration: null
  };
}

type StagePageTestInput = {
  readonly stageState?: RuntimePlayerStageStateSnapshot;
  readonly inputProfileStatus?: RuntimePlayerInputProfileStatus | null;
  readonly onUpdateStageMotionSettings?: (
    update: RuntimePlayerStageMotionSettingsUpdate
  ) => void;
  readonly onStartDepthScaleCalibration?: () => void;
};

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly onChange?: (event: {
    readonly currentTarget: {
      readonly value: string;
      readonly checked: boolean;
    };
  }) => void;
};
