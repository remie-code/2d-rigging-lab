import type {
  RuntimePlayerStagePngCaptureReport,
  RuntimePlayerStagePngCaptureRequest
} from "../../preload/stage-png-capture-bridge-contract";

/**
 * Builds the Stage's answer to one capture request. `capture` runs
 * synchronously, so the redraw and the read-back stay in the task that
 * received the request.
 */
export function createStagePngCaptureReport(
  request: RuntimePlayerStagePngCaptureRequest,
  capture: () => Uint8Array
): RuntimePlayerStagePngCaptureReport {
  try {
    return {
      requestId: request.requestId,
      result: "ok",
      pngBytes: capture()
    };
  } catch (error) {
    return {
      requestId: request.requestId,
      result: "error",
      message: error instanceof Error && error.message.length > 0
        ? error.message
        : "Stage canvas could not be read."
    };
  }
}

export function createStagePngCaptureUnavailableReport(
  request: RuntimePlayerStagePngCaptureRequest
): RuntimePlayerStagePngCaptureReport {
  return {
    requestId: request.requestId,
    result: "error",
    message: "Stage renderer is unavailable."
  };
}
