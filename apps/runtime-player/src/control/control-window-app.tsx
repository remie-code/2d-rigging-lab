import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import {
  FeedbackNotice,
  type ControlFeedbackTone
} from "./control-window-components";
import {
  getInputStatusPillLabel,
  getInputStatusPillTone,
  getLiveReadinessLabel,
  getProfileStatusLabel,
  getProfileTone,
  getRuntimeExportLoadedLabel,
  getRuntimeExportTone,
  pendingStatusLabel
} from "./control-window-formatters";
import {
  ControlWindowShell,
  type ControlWindowPage
} from "./control-window-shell";
import {
  InputDiagnosticsPanel,
  type InputDiagnosticsCopyState
} from "./input-diagnostics-panel";
import { InputPage } from "./input-page";
import { MappingPage } from "./mapping-page";
import { OverviewPage } from "./overview-page";
import { StagePage } from "./stage-page";
import type {
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerInputProfileActionResult,
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerMappingActionResult,
  RuntimePlayerMappingSlotUpdateRequest,
  RuntimePlayerMappingStatus
} from "../preload/model-mapping-bridge-contract";
import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewActionResult,
  RuntimePlayerStageViewStatus,
  RuntimePlayerStartupStatus
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimeExportOpenDirectoryResult,
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";

type ControlFeedback = {
  readonly message: string;
  readonly tone: ControlFeedbackTone;
};

export function ControlWindowApp(): ReactElement {
  const [activePage, setActivePage] =
    useState<ControlWindowPage>("overview");
  const [startupStatus, setStartupStatus] =
    useState<RuntimePlayerStartupStatus | null>(null);
  const [runtimeExportStatus, setRuntimeExportStatus] =
    useState<RuntimeExportStatus | null>(null);
  const [inputStatus, setInputStatus] =
    useState<RuntimePlayerInputStatus | null>(null);
  const [inputDiagnostics, setInputDiagnostics] =
    useState<RuntimePlayerInputDiagnosticsSnapshot | null>(null);
  const [inputProfileStatus, setInputProfileStatus] =
    useState<RuntimePlayerInputProfileStatus | null>(null);
  const [mappingStatus, setMappingStatus] =
    useState<RuntimePlayerMappingStatus | null>(null);
  const [stageViewStatus, setStageViewStatus] =
    useState<RuntimePlayerStageViewStatus | null>(null);
  const [stageState, setStageState] =
    useState<RuntimePlayerStageStateSnapshot | null>(null);
  const [feedback, setFeedback] = useState<ControlFeedback | null>(null);
  const [receivePortInput, setReceivePortInput] = useState("49983");
  const [iphoneHostInput, setIphoneHostInput] = useState("");
  const [calibrationName, setCalibrationName] =
    useState("iFacialMocap Profile");
  const [inputBusy, setInputBusy] = useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [copyDiagnosticsState, setCopyDiagnosticsState] =
    useState<InputDiagnosticsCopyState>("idle");

  useEffect(() => {
    let active = true;

    window.runtimePlayer.getStartupStatus().then((status) => {
      if (active) {
        setStartupStatus(status);
        setRuntimeExportStatus(status.runtimeExport);
      }
    });
    window.runtimePlayer.runtimeExport.getStatus().then((status) => {
      if (active) {
        setRuntimeExportStatus(status);
      }
    });
    window.runtimePlayer.stageView.getStatus().then((status) => {
      if (active) {
        setStageViewStatus(status);
      }
    });
    window.runtimePlayer.stageView.getState().then((status) => {
      if (active) {
        setStageState(status);
        setStageViewStatus(status.stageView.renderStatus);
      }
    });
    window.runtimePlayer.input.getStatus().then((status) => {
      if (active) {
        setInputStatus(status);
        setInputDiagnostics(status.diagnostics);
        setReceivePortInput(String(status.receivePort));
        setIphoneHostInput(status.iphoneHost ?? "");
      }
    });
    window.runtimePlayer.input.getDiagnostics().then((diagnostics) => {
      if (active) {
        setInputDiagnostics(diagnostics);
      }
    });
    window.runtimePlayer.inputProfile.getStatus().then((status) => {
      if (active) {
        setInputProfileStatus(status);
        if (status.calibration !== null) {
          setCalibrationName(status.calibration.displayName);
        }
      }
    });
    window.runtimePlayer.modelMapping.getStatus().then((status) => {
      if (active) {
        setMappingStatus(status);
      }
    });

    const unsubscribeRuntimeExport =
      window.runtimePlayer.runtimeExport.onStatusChanged((status) => {
        if (active) {
          setRuntimeExportStatus(status);
        }
      });
    const unsubscribeStageView =
      window.runtimePlayer.stageView.onStatusChanged((status) => {
        if (active) {
          setStageViewStatus(status);
        }
      });
    const unsubscribeStageState =
      window.runtimePlayer.stageView.onStateChanged((status) => {
        if (active) {
          setStageState(status);
          setStageViewStatus(status.stageView.renderStatus);
        }
      });
    const unsubscribeInputStatus =
      window.runtimePlayer.input.onStatusChanged((status) => {
        if (active) {
          setInputStatus(status);
          setInputDiagnostics(status.diagnostics);
        }
      });
    const unsubscribeInputDiagnostics =
      window.runtimePlayer.input.onDiagnosticsChanged((diagnostics) => {
        if (active) {
          setInputDiagnostics(diagnostics);
        }
      });
    const unsubscribeInputProfile =
      window.runtimePlayer.inputProfile.onStatusChanged((status) => {
        if (active) {
          setInputProfileStatus(status);
          if (status.calibration !== null) {
            setCalibrationName(status.calibration.displayName);
          }
        }
      });
    const unsubscribeModelMapping =
      window.runtimePlayer.modelMapping.onStatusChanged((status) => {
        if (active) {
          setMappingStatus(status);
        }
      });

    return () => {
      active = false;
      unsubscribeRuntimeExport();
      unsubscribeStageView();
      unsubscribeStageState();
      unsubscribeInputStatus();
      unsubscribeInputDiagnostics();
      unsubscribeInputProfile();
      unsubscribeModelMapping();
    };
  }, []);

  async function runStageAction(
    action: () => Promise<RuntimePlayerStageViewActionResult>
  ): Promise<void> {
    try {
      const result = await action();
      setStageState(result.status);
      setStageViewStatus(result.status.stageView.renderStatus);
      setFeedback({
        message: result.message,
        tone: result.result === "ok" ? "success" : "error"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    }
  }

  async function openRuntimeExportDirectory(): Promise<void> {
    const result = await window.runtimePlayer.runtimeExport.openDirectory();

    setFeedback(createRuntimeExportFeedback(result));
  }

  async function connectInputSource(): Promise<void> {
    const receivePort = parseReceivePortInput(receivePortInput);

    if (receivePort === null) {
      setFeedback({
        message: "Receive port must be an integer from 1 to 65535.",
        tone: "error"
      });
      return;
    }

    setInputBusy(true);
    setFeedback(null);

    try {
      const status = await window.runtimePlayer.input.connect({
        receivePort,
        iphoneHost: iphoneHostInput.trim()
      });
      setInputStatus(status);
      setInputDiagnostics(status.diagnostics);
      setFeedback({
        message: getInputConnectFeedback(status),
        tone: status.connectionState === "error" ? "error" : "success"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    } finally {
      setInputBusy(false);
    }
  }

  async function disconnectInputSource(): Promise<void> {
    setInputBusy(true);
    setFeedback(null);

    try {
      const status = await window.runtimePlayer.input.disconnect();
      setInputStatus(status);
      setInputDiagnostics(status.diagnostics);
      setFeedback({
        message: "Input receiver stopped.",
        tone: "neutral"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    } finally {
      setInputBusy(false);
    }
  }

  async function copyInputDiagnostics(): Promise<void> {
    try {
      const payload = await window.runtimePlayer.input.copyDiagnostics();
      await writeClipboardText(JSON.stringify(payload, null, 2));
      setCopyDiagnosticsState("copied");
      setFeedback({
        message: "Input diagnostics copied.",
        tone: "success"
      });
    } catch (error) {
      setCopyDiagnosticsState("error");
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    }
  }

  async function runInputProfileAction(
    action: () => Promise<RuntimePlayerInputProfileActionResult>
  ): Promise<void> {
    try {
      const result = await action();
      setInputProfileStatus(result.status);
      setFeedback({
        message: result.message,
        tone: result.result === "ok" ? "success" : "error"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    }
  }

  async function runMappingAction(
    action: () => Promise<RuntimePlayerMappingActionResult>
  ): Promise<void> {
    try {
      const result = await action();
      setMappingStatus(result.status);
      setFeedback({
        message: result.message,
        tone: result.result === "ok" ? "success" : "error"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    }
  }

  const stageWindowStatus =
    stageState?.stageWindow.windowState === "created"
      ? "Open"
      : startupStatus?.stage.windowState === "created"
        ? "Created"
        : "Checking";
  const runtimeExportLabel =
    runtimeExportStatus?.statusLabel ?? pendingStatusLabel;
  const runtimeExportLoadedLabel =
    getRuntimeExportLoadedLabel(runtimeExportStatus);
  const lookForwardAvailable =
    inputDiagnostics?.trackingFrame !== undefined;
  const page = renderActivePage({
    activePage,
    runtimeExportStatus,
    inputStatus,
    inputProfileStatus,
    mappingStatus,
    stageViewStatus,
    stageState,
    stageWindowStatus,
    receivePortInput,
    iphoneHostInput,
    inputBusy,
    calibrationName,
    lookForwardAvailable,
    setReceivePortInput,
    setIphoneHostInput,
    setCalibrationName,
    setActivePage,
    openRuntimeExportDirectory,
    connectInputSource,
    disconnectInputSource,
    runInputProfileAction,
    runMappingAction,
    runStageAction
  });

  return (
    <ControlWindowShell
      activePage={activePage}
      runtimeExportLabel={runtimeExportLoadedLabel}
      runtimeExportTone={getRuntimeExportTone(runtimeExportStatus)}
      inputLabel={getInputStatusPillLabel(inputStatus)}
      inputTone={getInputStatusPillTone(inputStatus)}
      profileLabel={getProfileStatusLabel(inputProfileStatus)}
      profileTone={getProfileTone(inputProfileStatus)}
      liveLabel={getLiveReadinessLabel({
        runtimeExportStatus,
        inputStatus,
        profileStatus: inputProfileStatus,
        mappingStatus
      })}
      onSelectPage={setActivePage}
      onOpenRuntimeExport={() => void openRuntimeExportDirectory()}
      onLookForward={() =>
        void runInputProfileAction(() =>
          window.runtimePlayer.inputProfile.lookForward()
        )
      }
      onFocusStage={() =>
        void runStageAction(() => window.runtimePlayer.focusStage())
      }
      lookForwardDisabled={!lookForwardAvailable}
      runtimeExportBusy={runtimeExportStatus?.status === "loading"}
    >
      {page}

      <InputDiagnosticsPanel
        status={inputStatus}
        diagnostics={inputDiagnostics}
        expanded={diagnosticsExpanded}
        copyState={copyDiagnosticsState}
        onToggleExpanded={() => setDiagnosticsExpanded((value) => !value)}
        onCopyDiagnostics={() => void copyInputDiagnostics()}
      />

      <FeedbackNotice
        message={feedback?.message ?? `${runtimeExportLabel}.`}
        tone={feedback?.tone ?? "neutral"}
      />
    </ControlWindowShell>
  );
}

function renderActivePage(input: {
  readonly activePage: ControlWindowPage;
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly inputProfileStatus: RuntimePlayerInputProfileStatus | null;
  readonly mappingStatus: RuntimePlayerMappingStatus | null;
  readonly stageViewStatus: RuntimePlayerStageViewStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly stageWindowStatus: string;
  readonly receivePortInput: string;
  readonly iphoneHostInput: string;
  readonly inputBusy: boolean;
  readonly calibrationName: string;
  readonly lookForwardAvailable: boolean;
  readonly setReceivePortInput: (value: string) => void;
  readonly setIphoneHostInput: (value: string) => void;
  readonly setCalibrationName: (value: string) => void;
  readonly setActivePage: (page: ControlWindowPage) => void;
  readonly openRuntimeExportDirectory: () => Promise<void>;
  readonly connectInputSource: () => Promise<void>;
  readonly disconnectInputSource: () => Promise<void>;
  readonly runInputProfileAction: (
    action: () => Promise<RuntimePlayerInputProfileActionResult>
  ) => Promise<void>;
  readonly runMappingAction: (
    action: () => Promise<RuntimePlayerMappingActionResult>
  ) => Promise<void>;
  readonly runStageAction: (
    action: () => Promise<RuntimePlayerStageViewActionResult>
  ) => Promise<void>;
}): ReactElement {
  if (input.activePage === "input") {
    return (
      <InputPage
        inputStatus={input.inputStatus}
        profileStatus={input.inputProfileStatus}
        receivePortInput={input.receivePortInput}
        iphoneHostInput={input.iphoneHostInput}
        inputBusy={input.inputBusy}
        calibrationName={input.calibrationName}
        lookForwardAvailable={input.lookForwardAvailable}
        onReceivePortInputChange={input.setReceivePortInput}
        onIphoneHostInputChange={input.setIphoneHostInput}
        onConnectInput={() => void input.connectInputSource()}
        onDisconnectInput={() => void input.disconnectInputSource()}
        onLookForward={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.lookForward()
          )
        }
        onSetActiveProfile={(profileId) =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.setActiveProfile({ profileId })
          )
        }
        onUseTemporaryDefaults={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.useTemporaryDefaults()
          )
        }
        onStartCalibration={(request = {}) =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.startCalibration({
              displayName: input.calibrationName,
              ...request
            })
          )
        }
        onCancelCalibration={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.cancelCalibration()
          )
        }
        onRecordCalibrationSample={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.recordCalibrationSample()
          )
        }
        onAdvanceCalibrationPrompt={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.advanceCalibrationPrompt()
          )
        }
        onFinishCalibration={() =>
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.finishCalibration({
              displayName: input.calibrationName
            })
          )
        }
        onCalibrationNameChange={input.setCalibrationName}
      />
    );
  }

  if (input.activePage === "mapping") {
    return (
      <MappingPage
        runtimeExportStatus={input.runtimeExportStatus}
        inputStatus={input.inputStatus}
        profileStatus={input.inputProfileStatus}
        mappingStatus={input.mappingStatus}
        onOpenRuntimeExport={() => void input.openRuntimeExportDirectory()}
        onConnectInput={() => void input.connectInputSource()}
        onStartCalibration={() => {
          input.setActivePage("input");
          void input.runInputProfileAction(() =>
            window.runtimePlayer.inputProfile.startCalibration({
              displayName: input.calibrationName,
              mode: "full"
            })
          );
        }}
        onResetToAutoMap={() =>
          void input.runMappingAction(() =>
            window.runtimePlayer.modelMapping.resetToAutoMap()
          )
        }
        onRetryProfileSave={() =>
          void input.runMappingAction(() =>
            window.runtimePlayer.modelMapping.retryProfileSave()
          )
        }
        onUpdateSlot={(request: RuntimePlayerMappingSlotUpdateRequest) =>
          void input.runMappingAction(() =>
            window.runtimePlayer.modelMapping.updateSlot(request)
          )
        }
      />
    );
  }

  if (input.activePage === "stage") {
    return (
      <StagePage
        stageState={input.stageState}
        onFocusStage={() =>
          void input.runStageAction(() => window.runtimePlayer.focusStage())
        }
        onResetView={() =>
          void input.runStageAction(() =>
            window.runtimePlayer.stageView.resetView()
          )
        }
        onCenterModel={() =>
          void input.runStageAction(() =>
            window.runtimePlayer.stageView.centerModel()
          )
        }
      />
    );
  }

  return (
    <OverviewPage
      runtimeExportStatus={input.runtimeExportStatus}
      inputStatus={input.inputStatus}
      profileStatus={input.inputProfileStatus}
      mappingStatus={input.mappingStatus}
      stageViewStatus={input.stageViewStatus}
      stageWindowStatus={input.stageWindowStatus}
      onOpenRuntimeExport={() => void input.openRuntimeExportDirectory()}
      onConnectInput={() => void input.connectInputSource()}
      onLookForward={() =>
        void input.runInputProfileAction(() =>
          window.runtimePlayer.inputProfile.lookForward()
        )
      }
      onStartCalibration={() => {
        input.setActivePage("input");
        void input.runInputProfileAction(() =>
          window.runtimePlayer.inputProfile.startCalibration({
            displayName: input.calibrationName,
            mode: "full"
          })
        );
      }}
      onUseTemporaryDefaults={() =>
        void input.runInputProfileAction(() =>
          window.runtimePlayer.inputProfile.useTemporaryDefaults()
        )
      }
      onSelectPage={input.setActivePage}
      inputBusy={input.inputBusy}
      lookForwardAvailable={input.lookForwardAvailable}
    />
  );
}

function createRuntimeExportFeedback(
  result: RuntimeExportOpenDirectoryResult
): ControlFeedback {
  if (result.result === "canceled") {
    return {
      message: "Runtime Export selection canceled.",
      tone: "neutral"
    };
  }

  if (result.result === "loaded") {
    return {
      message: `Runtime Export loaded: ${result.runtimeExport.summary.modelDisplayName}`,
      tone: "success"
    };
  }

  return {
    message: result.runtimeExport.error.message,
    tone: "error"
  };
}

function parseReceivePortInput(value: string): number | null {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

function getInputConnectFeedback(status: RuntimePlayerInputStatus): string {
  if (status.connectionState === "error") {
    return status.errorMessage ?? "Input receiver failed to start.";
  }

  if (status.iphoneHost !== undefined) {
    const handshake = status.diagnostics.handshake;
    if (handshake?.result === "error") {
      return `Listening on UDP ${status.receivePort}; start request failed: ${handshake.errorMessage ?? "unknown error"}.`;
    }

    if (handshake?.result === "sent") {
      return `Listening on UDP ${status.receivePort}; start request sent to ${status.iphoneHost}.`;
    }

    return `Listening on UDP ${status.receivePort}; start request pending for ${status.iphoneHost}.`;
  }

  return `Listening on UDP ${status.receivePort}.`;
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard write failed.");
    }
  } finally {
    textArea.remove();
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
