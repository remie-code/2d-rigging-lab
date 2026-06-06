import type { BinaryAssetDigestDto } from "@private-2d-rigging-lab/package-format";

import type { BrowserPsdParserBridgeSourceEvidence } from "./browser-psd-parser-bridge-result.js";
import type {
  SelectedPsdLayerMaterializationFailureEvidence,
  SelectedPsdLayerMaterializationFailureKind,
  SelectedPsdLayerMaterializedAssetCandidate,
  SelectedPsdLayerPrivateLocalProvenanceEvidence
} from "./selected-psd-layer-materialization-result.js";

export const selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount = 4;
export const selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes =
  32 * 1024 * 1024;

export type SelectedPsdLayerBatchMaterializationStatus =
  | "success"
  | "partialFailure"
  | "failure"
  | "preflightBlocked";

export type SelectedPsdLayerBatchMaterializationFailureKind =
  | "missingLayerSelection"
  | "duplicateSelection"
  | "batchLayerCountExceeded"
  | "batchTotalByteCapExceeded"
  | "missingCurrentSourceBytes"
  | "staleSource"
  | "sourceOversize"
  | "parserFailure"
  | "missingLayer"
  | "unsupportedLayerType"
  | "materializationFailure"
  | "materializedLayerOversize";

export interface SelectedPsdLayerBatchMaterializationFailureEvidence {
  readonly evidenceKind: "selected-psd-layer-batch-materialization-failure-evidence-v1";
  readonly failureKind: SelectedPsdLayerBatchMaterializationFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly requestIndex: number;
  readonly selectedLayerNodeRef: string;
  readonly canonicalRequestIndex?: number;
  readonly source?: BrowserPsdParserBridgeSourceEvidence;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly parser?: SelectedPsdLayerMaterializationFailureEvidence["parser"];
  readonly selectedNode?: SelectedPsdLayerMaterializationFailureEvidence["selectedNode"];
  readonly singleLayerFailureKind?: SelectedPsdLayerMaterializationFailureKind;
  readonly checks: readonly string[];
  readonly provenance: SelectedPsdLayerPrivateLocalProvenanceEvidence;
}

export interface SelectedPsdLayerBatchMaterializationSuccessEntry {
  readonly status: "materialized";
  readonly requestIndex: number;
  readonly selectedLayerNodeRef: string;
  readonly candidate: SelectedPsdLayerMaterializedAssetCandidate;
}

export interface SelectedPsdLayerBatchMaterializationFailureEntry {
  readonly status: "failed";
  readonly requestIndex: number;
  readonly selectedLayerNodeRef: string;
  readonly failure: SelectedPsdLayerBatchMaterializationFailureEvidence;
}

export type SelectedPsdLayerBatchMaterializationEntry =
  | SelectedPsdLayerBatchMaterializationSuccessEntry
  | SelectedPsdLayerBatchMaterializationFailureEntry;

export interface SelectedPsdLayerBatchMaterializationSummary {
  readonly requestedCount: number;
  readonly uniqueRequestedCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly duplicateSelectionCount: number;
  readonly unsupportedLayerTypeCount: number;
  readonly missingCurrentSourceBytesCount: number;
  readonly staleSourceCount: number;
  readonly materializationFailureCount: number;
  readonly batchLayerCountExceededCount: number;
  readonly batchTotalByteCapExceededCount: number;
  readonly maxSelectedLayerCount: number;
  readonly maxTotalRawRgbaBytes: number;
  readonly acceptedRawRgbaByteLength: number;
  readonly attemptedRawRgbaByteLength: number;
  readonly batchCap: {
    readonly exceeded: boolean;
    readonly requestedUniqueCount: number;
    readonly maxSelectedLayerCount: number;
  };
  readonly totalByteCap: {
    readonly exceeded: boolean;
    readonly acceptedRawRgbaByteLength: number;
    readonly attemptedRawRgbaByteLength: number;
    readonly maxTotalRawRgbaBytes: number;
  };
  readonly publicDemoAsset: false;
}

export interface SelectedPsdLayerBatchMaterializationDiagnostic {
  readonly checkId: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly evidence: readonly string[];
}

export interface SelectedPsdLayerBatchMaterializationResult {
  readonly evidenceKind: "selected-psd-layer-batch-materialization-result-v1";
  readonly batchId: string;
  readonly status: SelectedPsdLayerBatchMaterializationStatus;
  readonly source?: BrowserPsdParserBridgeSourceEvidence;
  readonly entries: readonly SelectedPsdLayerBatchMaterializationEntry[];
  readonly summary: SelectedPsdLayerBatchMaterializationSummary;
  readonly diagnostics: readonly SelectedPsdLayerBatchMaterializationDiagnostic[];
}
