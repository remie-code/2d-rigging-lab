export type RuntimePlayerLiveParameterFrame = {
  readonly schemaVersion: "runtime-player-live-parameter-frame-v1";
  readonly runtimeExport: {
    readonly packageId: string;
    readonly packageRevision: number;
    readonly loadedAtIso: string;
  };
  readonly sequence: number;
  readonly producedAtIso: string;
  readonly sourceFrameTimestampMs: number;
  readonly parameterValues: Readonly<Record<string, number>>;
};

export type RuntimePlayerLiveParameterApi = {
  readonly getLatestFrame: () => Promise<RuntimePlayerLiveParameterFrame | null>;
  readonly onFrame: (
    callback: (frame: RuntimePlayerLiveParameterFrame) => void
  ) => () => void;
  readonly onCleared: (callback: () => void) => () => void;
};
