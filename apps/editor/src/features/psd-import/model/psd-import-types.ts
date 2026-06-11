import type { PartId, SourceAssetId } from "@private-2d-rigging-lab/contracts";
import type {
  PsdAdapterResultDto,
  PsdStructuralScaffoldApprovalBridgeEvidenceDto,
  PsdStructuralScaffoldCapPolicyDto,
  PsdStructuralScaffoldIssueDto
} from "@private-2d-rigging-lab/operation-core";
import type { BrowserPsdMaterializedLayerBytes } from "../../../editor-workflow/browser-psd-parser-adapter";

export type PsdImportReviewRowKind = "Part Container" | "Drawable" | "Hidden Drawable";

export interface PsdImportReviewRow {
  readonly id: string;
  readonly depth: number;
  readonly kind: PsdImportReviewRowKind;
  readonly name: string;
  readonly localVisibleInSource: boolean;
  readonly effectiveVisibleInSource: boolean;
  readonly visibilityLabel?: string;
  readonly hasIssue: boolean;
  readonly issueTooltip?: string;
}

export interface PsdImportDestination {
  readonly parentPartId: PartId;
  readonly label: string;
}

export interface PsdImportPlan {
  readonly token: string;
  readonly fileName: string;
  readonly sourceAssetId: SourceAssetId;
  readonly sourceFilePath: string;
  readonly sourceContentHash: string;
  readonly adapterResult: PsdAdapterResultDto;
  readonly materializedLayerBytes: readonly BrowserPsdMaterializedLayerBytes[];
  readonly bridge: PsdStructuralScaffoldApprovalBridgeEvidenceDto;
  readonly capPolicy: PsdStructuralScaffoldCapPolicyDto;
  readonly destination: PsdImportDestination;
  readonly importRootPartId: PartId;
  readonly editorHiddenPartIds: readonly PartId[];
  readonly reviewRows: readonly PsdImportReviewRow[];
  readonly hasIssues: boolean;
  readonly issues: readonly PsdStructuralScaffoldIssueDto[];
}
