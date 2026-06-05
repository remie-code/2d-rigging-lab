import type {
  PsdAdapterDiagnosticDto,
  PsdAdapterParserEvidenceDto,
  PsdAdapterResultDto
} from "@private-2d-rigging-lab/operation-core";

export const browserPsdParserBridgeAdapterName = "wave45-browser-explicit-psd-import-adapter";
export const browserPsdParserBridgeAdapterVersion = "0.1.0";
export const browserPsdParserBridgeDefaultSizeCapBytes = 32 * 1024 * 1024;
export const browserPsdParserBridgeDefaultSourceAssetId = "src_browser_psd_import";

export type BrowserPsdParserBridgeIntakeKind = "explicitFile" | "explicitArrayBuffer";
export type BrowserPsdParserBridgeStatus = "parsed" | "rejected" | "failed";
export type BrowserPsdParserBridgeFailureKind =
  | "sizeLimitExceeded"
  | "parserFailure"
  | "materializationFailure";

export interface BrowserPsdParserBridgeSourceEvidence {
  readonly evidenceKind: "browser-psd-source-evidence-v1";
  readonly intakeKind: BrowserPsdParserBridgeIntakeKind;
  readonly sourceAssetId: string;
  readonly fileName: string;
  readonly declaredMediaType?: string;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
  readonly privacy: {
    readonly privacyLabel: "packageLocalAsset";
    readonly publicDistribution: "notPublicDistributable";
    readonly rawBytesPersistence: "notPersistedByParserBridge";
  };
}

export interface BrowserPsdParserBridgeErrorEvidence {
  readonly evidenceKind: "psd-parser-error-evidence-v1";
  readonly errorId: string;
  readonly failureKind: BrowserPsdParserBridgeFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly parser?: PsdAdapterParserEvidenceDto;
}

export interface BrowserPsdParserBridgeThreadingEvidence {
  readonly evidenceKind: "psd-parser-threading-evidence-v1";
  readonly execution: "main-thread";
  readonly workerDecision: "not-implemented-wave45-domain-b-bounded-scope";
  readonly risk: "large-psd-parse-may-block-ui-size-cap-required";
}

export interface BrowserPsdParserBridgeTreeSummary {
  readonly groupCount: number;
  readonly layerCount: number;
  readonly visibleLayerCount: number;
  readonly hiddenLayerCount: number;
  readonly rasterCandidateLayerCount: number;
  readonly maxDepth: number;
}

export interface BrowserPsdParserBridgeParsedResult {
  readonly status: "parsed";
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly threading: BrowserPsdParserBridgeThreadingEvidence;
  readonly treeSummary: BrowserPsdParserBridgeTreeSummary;
  readonly adapterResult: PsdAdapterResultDto;
  readonly diagnostics: readonly PsdAdapterDiagnosticDto[];
  readonly errorEvidence: readonly BrowserPsdParserBridgeErrorEvidence[];
}

export interface BrowserPsdParserBridgeRejectedResult {
  readonly status: "rejected";
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly threading: BrowserPsdParserBridgeThreadingEvidence;
  readonly diagnostics: readonly PsdAdapterDiagnosticDto[];
  readonly errorEvidence: readonly BrowserPsdParserBridgeErrorEvidence[];
}

export interface BrowserPsdParserBridgeFailedResult {
  readonly status: "failed";
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly threading: BrowserPsdParserBridgeThreadingEvidence;
  readonly diagnostics: readonly PsdAdapterDiagnosticDto[];
  readonly errorEvidence: readonly BrowserPsdParserBridgeErrorEvidence[];
}

export type BrowserPsdParserBridgeResult =
  | BrowserPsdParserBridgeParsedResult
  | BrowserPsdParserBridgeRejectedResult
  | BrowserPsdParserBridgeFailedResult;

export const createBrowserPsdSourceEvidence = (input: {
  readonly intakeKind: BrowserPsdParserBridgeIntakeKind;
  readonly sourceAssetId: string;
  readonly fileName: string;
  readonly declaredMediaType?: string;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
}): BrowserPsdParserBridgeSourceEvidence => ({
  evidenceKind: "browser-psd-source-evidence-v1",
  intakeKind: input.intakeKind,
  sourceAssetId: input.sourceAssetId,
  fileName: input.fileName,
  ...(input.declaredMediaType === undefined || input.declaredMediaType.trim().length === 0
    ? {}
    : { declaredMediaType: input.declaredMediaType.trim() }),
  byteLength: input.byteLength,
  sizeCapBytes: input.sizeCapBytes,
  privacy: {
    privacyLabel: "packageLocalAsset",
    publicDistribution: "notPublicDistributable",
    rawBytesPersistence: "notPersistedByParserBridge"
  }
});

export const createBrowserPsdThreadingEvidence = (): BrowserPsdParserBridgeThreadingEvidence => ({
  evidenceKind: "psd-parser-threading-evidence-v1",
  execution: "main-thread",
  workerDecision: "not-implemented-wave45-domain-b-bounded-scope",
  risk: "large-psd-parse-may-block-ui-size-cap-required"
});

export const createBrowserPsdParserErrorEvidence = (input: {
  readonly errorId: string;
  readonly failureKind: BrowserPsdParserBridgeFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly parser?: PsdAdapterParserEvidenceDto;
}): BrowserPsdParserBridgeErrorEvidence => ({
  evidenceKind: "psd-parser-error-evidence-v1",
  errorId: input.errorId,
  failureKind: input.failureKind,
  severity: input.severity,
  message: input.message,
  source: input.source,
  ...(input.parser === undefined ? {} : { parser: input.parser })
});
