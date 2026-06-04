import {
  createProductPreflightRerunAffordanceResponse,
  diffProductPreflightReports,
  readProductPreflightReport,
  type ProductPreflightReportDiffProvider,
  type ReadProductPreflightReportResult
} from "@private-2d-rigging-lab/ai-interface";
import {
  CodexProposalRerunValidationResultDtoSchema,
  ProductPreflightReportDtoSchema,
  type CodexProposalRerunValidationResultDto,
  type ProductPreflightReportDiffDto,
  type ProductPreflightReportDto,
  type ProductPreflightRerunAffordanceResponseDto
} from "@private-2d-rigging-lab/contracts";

export interface EditorProductPreflightReadDiffBridgeInput {
  readonly currentReport: ProductPreflightReportDto;
  readonly previousReport?: ProductPreflightReportDto | null;
  readonly proposalPreviewRerunResult?: CodexProposalRerunValidationResultDto | null;
  readonly diffProvider: ProductPreflightReportDiffProvider;
  readonly generatedAt?: string;
}

export interface EditorProductPreflightReadDiffBridgeReportRead {
  readonly report: ProductPreflightReportDto;
  readonly observation: ReadProductPreflightReportResult;
}

export interface EditorProductPreflightReadDiffBridgeCurrentRead
  extends EditorProductPreflightReadDiffBridgeReportRead {
  readonly rerunAffordance: ProductPreflightRerunAffordanceResponseDto;
}

export interface EditorProductPreflightReadDiffBridgeProposalPreviewRead
  extends EditorProductPreflightReadDiffBridgeReportRead {
  readonly rerunValidationResult: CodexProposalRerunValidationResultDto;
  readonly rerunAffordance: ProductPreflightRerunAffordanceResponseDto;
}

export type EditorProductPreflightReadDiffBridgeComparisonKind =
  | "previousToCurrent"
  | "currentToProposalPreview";

export interface EditorProductPreflightReadDiffBridgeComparison {
  readonly comparisonKind: EditorProductPreflightReadDiffBridgeComparisonKind;
  readonly beforeReportId: string;
  readonly afterReportId: string;
  readonly diff: ProductPreflightReportDiffDto;
}

export interface EditorProductPreflightReadDiffBridgeSafety {
  readonly sessionGeneratedReportsOnly: true;
  readonly persistedArtifactCreated: false;
  readonly automaticRerunAllowed: false;
  readonly autoFixAllowed: false;
  readonly automaticCommitAllowed: false;
}

export interface EditorProductPreflightReadDiffBridgeResult {
  readonly schemaVersion: "editor-product-preflight-read-diff-bridge-v0";
  readonly generatedAt: string;
  readonly current: EditorProductPreflightReadDiffBridgeCurrentRead;
  readonly previous: EditorProductPreflightReadDiffBridgeReportRead | null;
  readonly proposalPreview: EditorProductPreflightReadDiffBridgeProposalPreviewRead | null;
  readonly comparisons: readonly EditorProductPreflightReadDiffBridgeComparison[];
  readonly safety: EditorProductPreflightReadDiffBridgeSafety;
}

export const createEditorProductPreflightReadDiffBridge = async (
  input: EditorProductPreflightReadDiffBridgeInput
): Promise<EditorProductPreflightReadDiffBridgeResult> => {
  const generatedAt = input.generatedAt ?? "1970-01-01T00:00:00.000Z";
  const currentReport = ProductPreflightReportDtoSchema.parse(input.currentReport);
  const previousReport =
    input.previousReport === undefined || input.previousReport === null
      ? null
      : ProductPreflightReportDtoSchema.parse(input.previousReport);
  const proposalPreviewRerunResult =
    input.proposalPreviewRerunResult === undefined ||
    input.proposalPreviewRerunResult === null
      ? null
      : CodexProposalRerunValidationResultDtoSchema.parse(
          input.proposalPreviewRerunResult
        );
  const proposalPreviewReport =
    proposalPreviewRerunResult?.productPreflightReport === undefined
      ? null
      : ProductPreflightReportDtoSchema.parse(
          proposalPreviewRerunResult.productPreflightReport
        );
  const currentRerunAffordance = createProductPreflightRerunAffordanceResponse({
    report: currentReport,
    generatedAt
  });
  const proposalPreviewRerunAffordance =
    proposalPreviewReport === null
      ? null
      : createProductPreflightRerunAffordanceResponse({
          report: proposalPreviewReport,
          generatedAt
        });
  const comparisons: EditorProductPreflightReadDiffBridgeComparison[] = [];

  if (previousReport !== null) {
    const diff = await diffProductPreflightReports({
      beforeReport: previousReport,
      afterReport: currentReport,
      diffProvider: input.diffProvider,
      rerunAffordance: currentRerunAffordance
    });
    comparisons.push({
      comparisonKind: "previousToCurrent",
      beforeReportId: previousReport.reportId,
      afterReportId: currentReport.reportId,
      diff
    });
  }

  if (proposalPreviewReport !== null && proposalPreviewRerunAffordance !== null) {
    const diff = await diffProductPreflightReports({
      beforeReport: currentReport,
      afterReport: proposalPreviewReport,
      diffProvider: input.diffProvider,
      rerunAffordance: proposalPreviewRerunAffordance
    });
    comparisons.push({
      comparisonKind: "currentToProposalPreview",
      beforeReportId: currentReport.reportId,
      afterReportId: proposalPreviewReport.reportId,
      diff
    });
  }

  return {
    schemaVersion: "editor-product-preflight-read-diff-bridge-v0",
    generatedAt,
    current: {
      report: currentReport,
      observation: readProductPreflightReport({ report: currentReport }),
      rerunAffordance: currentRerunAffordance
    },
    previous: previousReport === null
      ? null
      : {
          report: previousReport,
          observation: readProductPreflightReport({ report: previousReport })
        },
    proposalPreview:
      proposalPreviewReport === null ||
      proposalPreviewRerunResult === null ||
      proposalPreviewRerunAffordance === null
        ? null
        : {
            rerunValidationResult: proposalPreviewRerunResult,
            report: proposalPreviewReport,
            observation: readProductPreflightReport({ report: proposalPreviewReport }),
            rerunAffordance: proposalPreviewRerunAffordance
          },
    comparisons,
    safety: {
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false,
      automaticRerunAllowed: false,
      autoFixAllowed: false,
      automaticCommitAllowed: false
    }
  };
};
