import {
  type RuntimePlayerPlaceholderAction,
  type RuntimePlayerPlaceholderResult,
  type RuntimePlayerStageStatus,
  type RuntimePlayerStartupStatus,
  runtimePlayerPlaceholderActions
} from "../preload/runtime-player-bridge-contract";

const placeholderActionSet = new Set<string>(runtimePlayerPlaceholderActions);

const placeholderMessages: Record<RuntimePlayerPlaceholderAction, string> = {
  "open-settings": "Settings are visible as a Wave1 placeholder only.",
  "connect-input": "Input connection is handled by the Runtime Player input bridge.",
  "disconnect-input": "Input disconnection is handled by the Runtime Player input bridge.",
  "look-forward": "Look Forward calibration is reserved for tracking input work.",
  "focus-stage": "Stage Window focus was requested.",
  "reset-stage-position": "Stage Window placement reset was requested.",
  "open-debug": "Input diagnostics are available in the Control Window debug panel."
};

export function isRuntimePlayerPlaceholderAction(
  action: unknown
): action is RuntimePlayerPlaceholderAction {
  return typeof action === "string" && placeholderActionSet.has(action);
}

export function createStartupStatus(): RuntimePlayerStartupStatus {
  return {
    runtimeExport: {
      status: "empty",
      loaded: false,
      statusLabel: "No Runtime Export loaded"
    },
    input: {
      sourceLabel: "iFacialMocap",
      transportLabel: "UDP",
      receivePort: 49983,
      connectionState: "not-connected"
    },
    stage: createStageStatus()
  };
}

export function createStageStatus(): RuntimePlayerStageStatus {
  return {
    windowState: "created",
    transparent: true,
    captureTarget: true,
    placeholderLabel: "Transparent Stage placeholder"
  };
}

export function createPlaceholderResult(
  action: RuntimePlayerPlaceholderAction,
  options: {
    readonly message?: string;
    readonly handled?: boolean;
  } = {}
): RuntimePlayerPlaceholderResult {
  return {
    action,
    handled: options.handled ?? false,
    message: options.message ?? placeholderMessages[action],
    atIso: new Date(0).toISOString()
  };
}
