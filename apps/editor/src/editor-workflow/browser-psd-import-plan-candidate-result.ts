import type { BinaryAssetDigestDto } from "@private-2d-rigging-lab/package-format";
import type { PsdAdapterParserEvidenceDto } from "@private-2d-rigging-lab/operation-core";

import type { BrowserPsdParserBridgeSourceEvidence } from "./browser-psd-parser-bridge-result.js";

export const browserPsdImportPlanCandidateDefaultMaxSourceBytes = 32 * 1024 * 1024;
export const browserPsdImportPlanCandidateDefaultMaxLeafCandidates = 200;
export const browserPsdImportPlanCandidateDefaultMaxLeafRawRgbaBytes = 64 * 1024 * 1024;
export const browserPsdImportPlanCandidateDefaultMaxApprovedLeaves = 4;
export const browserPsdImportPlanCandidateDefaultMaxApprovedRawRgbaBytes =
  32 * 1024 * 1024;

export type BrowserPsdImportPlanCandidateStatus =
  | "candidate"
  | "hidden"
  | "unsupported"
  | "emptyZeroSize"
  | "duplicateRef"
  | "duplicateName"
  | "generatedIdCollision"
  | "generatedNameCollision"
  | "byteCapBlocked"
  | "notApproved";

export type BrowserPsdImportPlanStatus = "ready" | "blocked";

export interface BrowserPsdImportPlanCaps {
  readonly maxSourceBytes: number;
  readonly maxLeafCandidates: number;
  readonly maxLeafRawRgbaBytes: number;
  readonly maxApprovedLeaves: number;
  readonly maxApprovedRawRgbaBytes: number;
}

export interface BrowserPsdImportPlanScope {
  readonly scopeRef: string;
  readonly scopeKind: "root" | "group";
  readonly discoveryMode: "recursiveLeafCandidatePreview";
  readonly displayPath: readonly string[];
}

export interface BrowserPsdImportPlanParentGroupContext {
  readonly groupRef: string;
  readonly displayName: string;
  readonly fullPath: readonly string[];
  readonly depth: number;
}

export interface BrowserPsdImportPlanLayerBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BrowserPsdImportPlanGeneratedScaffoldPreview {
  readonly destinationKind: "generatedPartScaffold";
  readonly displayName: string;
  readonly partId: string;
  readonly drawableId: string;
  readonly textureId: string;
  readonly meshId: string;
}

export interface BrowserPsdImportPlanCandidateSelection {
  readonly default: "notApproved";
  readonly requestedApproval: boolean;
  readonly approved: boolean;
  readonly approvedOrder: number | null;
  readonly approvalBlockedReasons: readonly string[];
}

export interface BrowserPsdImportPlanLeafCandidate {
  readonly candidateId: string;
  readonly layerRef: string;
  readonly displayName: string;
  readonly normalizedName: string;
  readonly fullPath: readonly string[];
  readonly parentGroups: readonly BrowserPsdImportPlanParentGroupContext[];
  readonly bounds: BrowserPsdImportPlanLayerBounds;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly sourceOrder: number;
  readonly role: string;
  readonly rawRgbaByteEstimate: number;
  readonly statuses: readonly BrowserPsdImportPlanCandidateStatus[];
  readonly statusReasons: readonly string[];
  readonly unsupportedFeatureIds: readonly string[];
  readonly generated: BrowserPsdImportPlanGeneratedScaffoldPreview;
  readonly selection: BrowserPsdImportPlanCandidateSelection;
}

export interface BrowserPsdImportPlanCandidateDigest {
  readonly algorithm: "sha256";
  readonly hex: string;
  readonly canonicalJsonByteLength: number;
}

export interface BrowserPsdImportPlanSummary {
  readonly totalLeafCount: number;
  readonly eligibleCandidateCount: number;
  readonly hiddenCount: number;
  readonly unsupportedCount: number;
  readonly emptyZeroSizeCount: number;
  readonly duplicateRefCount: number;
  readonly duplicateNameCount: number;
  readonly generatedIdCollisionCount: number;
  readonly generatedNameCollisionCount: number;
  readonly byteCapBlockedCount: number;
  readonly notApprovedCount: number;
  readonly requestedApprovalCount: number;
  readonly approvedCount: number;
  readonly totalRawRgbaByteEstimate: number;
  readonly eligibleRawRgbaByteEstimate: number;
  readonly requestedApprovalRawRgbaByteEstimate: number;
  readonly approvedRawRgbaByteEstimate: number;
  readonly candidateEnumerationCap: {
    readonly exceeded: boolean;
    readonly totalLeafCount: number;
    readonly maxLeafCandidates: number;
  };
  readonly sourceParseCap: {
    readonly exceeded: boolean;
    readonly sourceByteLength: number;
    readonly maxSourceBytes: number;
  };
  readonly approvalCap: {
    readonly exceeded: boolean;
    readonly requestedApprovalCount: number;
    readonly maxApprovedLeaves: number;
  };
  readonly approvalRawRgbaCap: {
    readonly exceeded: boolean;
    readonly requestedApprovalRawRgbaByteEstimate: number;
    readonly maxApprovedRawRgbaBytes: number;
  };
  readonly publicDemoAsset: false;
}

export interface BrowserPsdImportPlanDiagnostic {
  readonly checkId: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly evidence: readonly string[];
}

export interface BrowserPsdImportPlanCandidatePlan {
  readonly evidenceKind: "browser-psd-import-plan-candidate-plan-v1";
  readonly planId: string;
  readonly status: BrowserPsdImportPlanStatus;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly parser?: PsdAdapterParserEvidenceDto;
  readonly scope: BrowserPsdImportPlanScope;
  readonly caps: BrowserPsdImportPlanCaps;
  readonly candidatePlanDigest: BrowserPsdImportPlanCandidateDigest;
  readonly candidates: readonly BrowserPsdImportPlanLeafCandidate[];
  readonly summary: BrowserPsdImportPlanSummary;
  readonly diagnostics: readonly BrowserPsdImportPlanDiagnostic[];
  readonly persistenceBoundary: {
    readonly rawParserObjectPersistence: "notPersisted";
    readonly sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByImportPlan";
    readonly materializedLayerBytePersistence: "notMaterializedByImportPlan";
    readonly approvalExecution: "explicitApprovedLeafRefsOnly";
    readonly publicDemoAsset: false;
  };
}
