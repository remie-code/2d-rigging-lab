import type { BinaryAssetDigestDto } from "@private-2d-rigging-lab/package-format";
import type { PsdAdapterParserEvidenceDto } from "@private-2d-rigging-lab/operation-core";

import type {
  BrowserPsdParserBridgeSourceEvidence
} from "./browser-psd-parser-bridge-result.js";
import type {
  BrowserSelectedPsdLayerExtractionOptions
} from "./browser-psd-parser-adapter.js";

export const selectedPsdLayerMaterializedAssetMediaType =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

export const selectedPsdLayerMaterializationDefaultMaxRawRgbaBytes = 64 * 1024 * 1024;

export type SelectedPsdLayerMaterializationFailureKind =
  | "sourceOversize"
  | "sourceMismatch"
  | "parserFailure"
  | "missingLayer"
  | "unsupportedLayerType"
  | "materializationFailure"
  | "materializedLayerOversize";

export interface SelectedPsdLayerMaterializationDiagnostic {
  readonly checkId: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly evidence: readonly string[];
}

export interface SelectedPsdLayerPrivateLocalProvenanceEvidence {
  readonly sourceInput: "explicit-user-selected-private-local-psd-v1";
  readonly privacyLabel: "private/local";
  readonly publicDemoAsset: false;
  readonly materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1";
}

export interface SelectedPsdLayerSourcePsdEvidence {
  readonly sourceAssetId: string;
  readonly fileName: string;
  readonly declaredMediaType?: string;
  readonly byteLength: number;
  readonly digest: BinaryAssetDigestDto;
}

export interface SelectedPsdLayerSourceLayerEvidence {
  readonly sourceLayerId: string;
  readonly sourceLayerPath: readonly string[];
  readonly originalName: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly visibleInSource: boolean;
}

export interface SelectedPsdLayerMaterializedAssetEvidence {
  readonly evidenceKind: "selected-psd-layer-materialized-asset-candidate-evidence-v1";
  readonly candidateId: string;
  readonly materializationId: string;
  readonly mediaType: typeof selectedPsdLayerMaterializedAssetMediaType;
  readonly pixelFormat: "rgba8";
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly digest: BinaryAssetDigestDto;
  readonly sourcePsd: SelectedPsdLayerSourcePsdEvidence;
  readonly sourceLayer: SelectedPsdLayerSourceLayerEvidence;
  readonly parser: PsdAdapterParserEvidenceDto;
  readonly extraction: BrowserSelectedPsdLayerExtractionOptions;
  readonly provenance: SelectedPsdLayerPrivateLocalProvenanceEvidence;
  readonly storageBoundary: SelectedPsdLayerMaterializedAssetStorageBoundaryEvidence;
}

export interface SelectedPsdLayerMaterializedAssetStorageBoundaryEvidence {
  readonly storageScope: "editor-local-candidate-only-v1";
  readonly packageStorageIdentity: "not-assigned-domain-c-d-owned-v1";
  readonly persistentBinaryAssetRef: "not-created-by-domain-b-v1";
}

export interface SelectedPsdLayerMaterializedAssetCandidate {
  readonly bytes: Uint8Array;
  readonly evidence: SelectedPsdLayerMaterializedAssetEvidence;
}

export interface SelectedPsdLayerMaterializationFailureEvidence {
  readonly evidenceKind: "selected-psd-layer-materialization-failure-evidence-v1";
  readonly failureKind: SelectedPsdLayerMaterializationFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly selectedLayerNodeRef: string;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly parser?: PsdAdapterParserEvidenceDto;
  readonly selectedNode?: {
    readonly nodeRef: string;
    readonly nodeType: "group";
    readonly sourceNodePath: readonly string[];
    readonly originalName: string;
  };
  readonly checks: readonly string[];
  readonly provenance: SelectedPsdLayerPrivateLocalProvenanceEvidence;
}

export interface SelectedPsdLayerMaterializationSuccessResult {
  readonly status: "materialized";
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly candidate: SelectedPsdLayerMaterializedAssetCandidate;
  readonly diagnostics: readonly SelectedPsdLayerMaterializationDiagnostic[];
}

export interface SelectedPsdLayerMaterializationFailureResult {
  readonly status: "failed";
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly failure: SelectedPsdLayerMaterializationFailureEvidence;
  readonly diagnostics: readonly SelectedPsdLayerMaterializationDiagnostic[];
}

export type SelectedPsdLayerMaterializationResult =
  | SelectedPsdLayerMaterializationSuccessResult
  | SelectedPsdLayerMaterializationFailureResult;

export type SelectedPsdLayerMaterializedAssetFreshnessStatus =
  | "current"
  | "missing"
  | "stale";

export interface SelectedPsdLayerMaterializedAssetFreshnessEvidence {
  readonly evidenceKind: "selected-psd-layer-materialized-asset-freshness-evidence-v1";
  readonly status: SelectedPsdLayerMaterializedAssetFreshnessStatus;
  readonly staleReasons: readonly string[];
  readonly candidateId: string;
  readonly materializationId: string;
  readonly publicDemoAsset: false;
}

export interface SelectedPsdLayerMaterializedAssetFreshnessResult {
  readonly status: SelectedPsdLayerMaterializedAssetFreshnessStatus;
  readonly evidence: SelectedPsdLayerMaterializedAssetFreshnessEvidence;
  readonly actualDigest?: BinaryAssetDigestDto;
  readonly actualByteLength?: number;
}

export interface SelectedPsdLayerMaterializationSourceExpectation {
  readonly digest?: BinaryAssetDigestDto;
  readonly byteLength?: number;
}

export interface SelectedPsdLayerMaterializedAssetFreshnessExpectation {
  readonly candidateId?: string;
  readonly materializationId?: string;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly sourceByteLength?: number;
  readonly sourceLayerId?: string;
  readonly sourceLayerPath?: readonly string[];
  readonly sourceLayerName?: string;
  readonly mediaType?: string;
  readonly materializedDigest?: BinaryAssetDigestDto;
  readonly materializedByteLength?: number;
  readonly parserPackageName?: string;
  readonly parserVersion?: string;
  readonly parserPrivateShapePolicy?: string;
  readonly extraction?: BrowserSelectedPsdLayerExtractionOptions;
  readonly storageBoundary?: {
    readonly storageScope?: string;
    readonly packageStorageIdentity?: string;
    readonly persistentBinaryAssetRef?: string;
  };
}

export const createSelectedPsdLayerPrivateLocalProvenanceEvidence =
  (): SelectedPsdLayerPrivateLocalProvenanceEvidence => ({
    sourceInput: "explicit-user-selected-private-local-psd-v1",
    privacyLabel: "private/local",
    publicDemoAsset: false,
    materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
  });
