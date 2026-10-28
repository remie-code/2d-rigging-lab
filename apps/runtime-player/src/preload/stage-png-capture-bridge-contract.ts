/**
 * Stage PNG capture bridge contract (thumbnail capture). Control asks main to
 * capture; main asks the Stage window with an id-tagged request and the Stage
 * answers with an `invoke` carrying the PNG bytes. Electron has no main →
 * renderer invoke, so the id is what correlates the answer with its request.
 *
 * This is a different thing from `RuntimePlayerStageCaptureState`, which
 * describes the Stage window as an OBS capture target.
 */

export type RuntimePlayerStagePngCaptureResult = {
  readonly result: "ok" | "error";
  readonly message: string;
  /** The saved file's name (e.g. `astra-chan-runtime-20261028-153012.png`). */
  readonly fileName: string | null;
  readonly filePath: string | null;
  readonly atIso: string;
};

export type RuntimePlayerStagePngCaptureFolderResult = {
  readonly result: "ok" | "error";
  readonly message: string;
  readonly folderPath: string | null;
  readonly atIso: string;
};

export type RuntimePlayerStagePngCaptureApi = {
  readonly capturePng: () => Promise<RuntimePlayerStagePngCaptureResult>;
  readonly openFolder: () => Promise<RuntimePlayerStagePngCaptureFolderResult>;
};

/** main → Stage: redraw the current pose and read it back as PNG now. */
export type RuntimePlayerStagePngCaptureRequest = {
  readonly requestId: string;
};

/** Stage → main: the answer to one request, matched by `requestId`. */
export type RuntimePlayerStagePngCaptureReport =
  | {
      readonly requestId: string;
      readonly result: "ok";
      readonly pngBytes: Uint8Array;
    }
  | {
      readonly requestId: string;
      readonly result: "error";
      readonly message: string;
    };

export type RuntimePlayerStagePngCaptureReporterApi = {
  readonly onCaptureRequested: (
    callback: (request: RuntimePlayerStagePngCaptureRequest) => void
  ) => () => void;
  readonly reportCapture: (
    report: RuntimePlayerStagePngCaptureReport
  ) => Promise<void>;
};
