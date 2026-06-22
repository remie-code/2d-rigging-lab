import type {
  RuntimeExportAtlasDto,
  RuntimeExportManifestDto,
  RuntimeExportModelDto,
  RuntimeExportRequiredCapabilityDto,
  RuntimeExportTexturePageMetadataDto
} from "@private-2d-rigging-lab/package-format";

export type RuntimeExportLoadErrorCode =
  | "runtimeExport.missingArtifact"
  | "runtimeExport.invalidJson"
  | "runtimeExport.invalidManifest"
  | "runtimeExport.invalidModel"
  | "runtimeExport.invalidAtlas"
  | "runtimeExport.pathTraversal"
  | "runtimeExport.unsupportedCapability"
  | "runtimeExport.unsupportedSingleTexturePage"
  | "runtimeExport.textureByteLengthMismatch"
  | "runtimeExport.textureDigestMismatch"
  | "runtimeExport.artifactInconsistent"
  | "runtimeExport.unexpectedError";

export type RuntimeExportLoadError = {
  readonly code: RuntimeExportLoadErrorCode;
  readonly message: string;
  readonly artifactPath?: string;
  readonly details: readonly string[];
};

export type RuntimeExportSummary = {
  readonly modelDisplayName: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly drawableCount: number;
  readonly meshCount: number;
  readonly parameterCount: number;
  readonly maskCount: number;
  readonly texturePage: {
    readonly pageId: string;
    readonly path: string;
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: "rgba8";
    readonly byteLength: number;
  };
  readonly requiredCapabilities: readonly RuntimeExportRequiredCapabilityDto[];
};

export type RuntimeExportLoadedPayload = {
  readonly artifacts: {
    readonly manifest: RuntimeExportManifestDto;
    readonly model: RuntimeExportModelDto;
    readonly atlas: RuntimeExportAtlasDto;
  };
  readonly texturePage: {
    readonly metadata: RuntimeExportTexturePageMetadataDto;
    readonly bytes: Uint8Array;
  };
  readonly summary: RuntimeExportSummary;
  readonly loadedAtIso: string;
};

export type RuntimeExportEmptyStatus = {
  readonly status: "empty";
  readonly loaded: false;
  readonly statusLabel: "No Runtime Export loaded";
};

export type RuntimeExportLoadingStatus = {
  readonly status: "loading";
  readonly loaded: false;
  readonly statusLabel: "Loading Runtime Export";
  readonly directoryPath: string;
};

export type RuntimeExportLoadedStatus = {
  readonly status: "loaded";
  readonly loaded: true;
  readonly statusLabel: "Runtime Export loaded";
  readonly directoryPath: string;
  readonly loadedAtIso: string;
  readonly summary: RuntimeExportSummary;
};

export type RuntimeExportErrorStatus = {
  readonly status: "error";
  readonly loaded: false;
  readonly statusLabel: "Runtime Export load failed";
  readonly directoryPath: string;
  readonly failedAtIso: string;
  readonly error: RuntimeExportLoadError;
};

export type RuntimeExportStatus =
  | RuntimeExportEmptyStatus
  | RuntimeExportLoadingStatus
  | RuntimeExportLoadedStatus
  | RuntimeExportErrorStatus;

export type RuntimeExportOpenDirectoryResult =
  | {
      readonly result: "canceled";
      readonly runtimeExport: RuntimeExportStatus;
    }
  | {
      readonly result: "loaded";
      readonly runtimeExport: RuntimeExportLoadedStatus;
    }
  | {
      readonly result: "error";
      readonly runtimeExport: RuntimeExportErrorStatus;
    };

export type RuntimeExportApi = {
  readonly getStatus: () => Promise<RuntimeExportStatus>;
  readonly openDirectory: () => Promise<RuntimeExportOpenDirectoryResult>;
  readonly getLoadedPayload: () => Promise<RuntimeExportLoadedPayload | null>;
  readonly onStatusChanged: (
    callback: (status: RuntimeExportStatus) => void
  ) => () => void;
  readonly onLoadedPayload: (
    callback: (payload: RuntimeExportLoadedPayload) => void
  ) => () => void;
};
