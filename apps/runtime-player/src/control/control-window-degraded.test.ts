import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { InputPage } from "./input-page";
import { MappingPage } from "./mapping-page";
import { LiveControllerPage } from "./live-controller-page";
import { StageMotionPanel } from "./stage-motion-panel";
import { OverviewPage } from "./overview-page";
import {
  getControlWindowHeaderInputLabel,
  getControlWindowHeaderInputTone
} from "./control-window-app";
import {
  getInputStatusPillLabel,
  getInputStatusPillTone
} from "./control-window-formatters";
import type { PhysiologyStatus } from "../preload/physiology-bridge-contract";
import type { RuntimePlayerInputStatus } from "../preload/input-bridge-contract";
import type {
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";

const noop = (): void => undefined;

describe("Degraded解消 (autonomous host, DATA-driven empty states)", () => {
  it("Input page shows the no-tracking empty state, not connection controls", () => {
    const trackingMarkup = renderToStaticMarkup(
      createElement(InputPage, { ...inputPageProps(), drivenByPhysiology: false })
    );
    const autonomousMarkup = renderToStaticMarkup(
      createElement(InputPage, { ...inputPageProps(), drivenByPhysiology: true })
    );

    expect(autonomousMarkup).toContain(
      "This host has no tracking input; the body is driven by physiology and the channel."
    );
    // Tracking controls are gone on the autonomous host.
    expect(autonomousMarkup).not.toContain("Receive port");
    expect(trackingMarkup).toContain("Receive port");
  });

  it("Mapping page shows the no-tracking empty state, not the slot editor", () => {
    const autonomousMarkup = renderToStaticMarkup(
      createElement(MappingPage, {
        ...mappingPageProps(),
        drivenByPhysiology: true
      })
    );
    expect(autonomousMarkup).toContain(
      "This host has no tracking input; the body is driven by physiology and the channel."
    );
    expect(autonomousMarkup).not.toContain("Semantic Slots");
  });

  it("Live Controller Motion Safety routes to Physiology instead of the inert toggle", () => {
    const autonomousMarkup = renderToStaticMarkup(
      createElement(LiveControllerPage, {
        ...liveControllerProps(),
        drivenByPhysiology: true
      })
    );
    expect(autonomousMarkup).toContain(
      "Stage presence is driven by Physiology on this host."
    );
    expect(autonomousMarkup).toContain("Open Physiology");
    // The inert Stage Motion On/Off toggle is replaced.
    expect(autonomousMarkup).not.toContain("Toggle Stage Motion");
  });

  it("Stage Motion panel shows the physiology-driven empty state", () => {
    const autonomousMarkup = renderToStaticMarkup(
      createElement(StageMotionPanel, {
        settings: null,
        persistenceLabel: "Checking",
        inputProfileStatus: null,
        drivenByPhysiology: true,
        onUpdateSettings: noop,
        onStartDepthScaleCalibration: noop
      })
    );
    expect(autonomousMarkup).toContain(
      "Stage presence is driven by Physiology on this host."
    );
    expect(autonomousMarkup).not.toContain("Horizontal Follow");
  });
});

describe("Header Input pill degraded替え (DATA-driven, no role query)", () => {
  it("reads Drive: Physiology (tone teal) on the Autonomous Host", () => {
    expect(
      getControlWindowHeaderInputLabel({
        drivenByPhysiology: true,
        inputStatus: null
      })
    ).toBe("Drive: Physiology");
    expect(
      getControlWindowHeaderInputTone({
        drivenByPhysiology: true,
        inputStatus: null
      })
    ).toBe("teal");
  });

  it("keeps the existing input-status header on the Tracking Host (no退行)", () => {
    // A receiving tracking host: the header must delegate to the existing formatter,
    // never showing the autonomous Drive label.
    const inputStatus = {
      connectionState: "receiving",
      estimatedFps: 60
    } as unknown as RuntimePlayerInputStatus;

    const label = getControlWindowHeaderInputLabel({
      drivenByPhysiology: false,
      inputStatus
    });
    const tone = getControlWindowHeaderInputTone({
      drivenByPhysiology: false,
      inputStatus
    });

    expect(label).not.toBe("Drive: Physiology");
    // Unchanged delegation to the pre-C4 formatters.
    expect(label).toBe(getInputStatusPillLabel(inputStatus));
    expect(tone).toBe(getInputStatusPillTone(inputStatus));
  });
});

describe("OverviewPage subsystem-availability layout", () => {
  it("renders Model / Physiology / Channel cards on the Autonomous Host", () => {
    const markup = renderToStaticMarkup(
      createElement(OverviewPage, {
        ...overviewProps(),
        providesPhysiology: true,
        providesChannel: true,
        physiologyStatus: { status: "ready" } as unknown as PhysiologyStatus,
        channelStatus: {
          connection: { kind: "open" },
          activeOverlays: []
        } as unknown as RuntimePlayerControlChannelStatus
      })
    );

    expect(markup).toContain("Model");
    expect(markup).toContain("Physiology");
    expect(markup).toContain("Channel");
    expect(markup).toContain("Open Physiology");
    expect(markup).toContain("Open Channel");
    // The tracking-only Input panels are absent.
    expect(markup).not.toContain("Input Source");
    expect(markup).not.toContain("Connect Input");
  });

  it("keeps the tracking 4-panel layout (no Channel card) on the Tracking Host", () => {
    const markup = renderToStaticMarkup(
      createElement(OverviewPage, {
        ...overviewProps(),
        providesPhysiology: false,
        providesChannel: false,
        physiologyStatus: null,
        channelStatus: null
      })
    );

    expect(markup).toContain("Input Source");
    expect(markup).toContain("Input Profile");
    expect(markup).not.toContain("Open Channel");
  });
});

function inputPageProps() {
  return {
    inputStatus: null,
    profileStatus: null,
    receivePortInput: "49983",
    iphoneHostInput: "",
    inputBusy: false,
    calibrationName: "Profile",
    lookForwardAvailable: false,
    onReceivePortInputChange: noop,
    onIphoneHostInputChange: noop,
    onConnectInput: noop,
    onDisconnectInput: noop,
    onLookForward: noop,
    onSetActiveProfile: noop,
    onUseTemporaryDefaults: noop,
    onStartCalibration: noop,
    onCancelCalibration: noop,
    onRecordCalibrationSample: noop,
    onAdvanceCalibrationPrompt: noop,
    onFinishCalibration: noop,
    onCalibrationNameChange: noop
  };
}

function mappingPageProps() {
  return {
    runtimeExportStatus: null,
    inputStatus: null,
    profileStatus: null,
    mappingStatus: null,
    onOpenRuntimeExport: noop,
    onConnectInput: noop,
    onStartCalibration: noop,
    onResetToAutoMap: noop,
    onRetryProfileSave: noop,
    onUpdateSlot: noop,
    onSetVowelLipsyncEnabled: noop
  };
}

function liveControllerProps() {
  return {
    variantStatus: null,
    runtimeExportStatus: null,
    inputStatus: null,
    browserSourceStatus: null,
    stageState: null,
    lookForwardAvailable: false,
    onSelectSingleVariant: noop,
    onToggleMultiVariant: noop,
    onResetVariants: noop,
    onLookForward: noop,
    onCenterModel: noop,
    onUpdateStageMotionSettings: noop,
    onOpenPhysiology: vi.fn()
  };
}

function overviewProps() {
  return {
    runtimeExportStatus: null,
    inputStatus: null,
    profileStatus: null,
    mappingStatus: null,
    stageViewStatus: null,
    stageWindowStatus: "Checking",
    onOpenRuntimeExport: noop,
    onRetryRuntimeExportRestore: noop,
    onConnectInput: noop,
    onLookForward: noop,
    onStartCalibration: noop,
    onUseTemporaryDefaults: noop,
    onSelectPage: noop,
    inputBusy: false,
    lookForwardAvailable: false
  };
}
