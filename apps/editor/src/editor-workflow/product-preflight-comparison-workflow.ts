import type {
  CodexProposalRerunValidationResultDto,
  ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import { buildProductPreflightReportDiff } from "@private-2d-rigging-lab/validator-core";

import {
  createFailedProductPreflightComparisonState,
  projectProductPreflightComparisonState,
  type ProductPreflightComparisonState
} from "../editor-state/index.js";
import { createEditorProductPreflightReadDiffBridge } from "./product-preflight-read-diff-bridge.js";

export interface EditorProductPreflightComparisonWorkflowInput {
  readonly currentReport: ProductPreflightReportDto;
  readonly previousReport?: ProductPreflightReportDto | null;
  readonly proposalPreviewRerunResult?: CodexProposalRerunValidationResultDto | null;
  readonly generatedAt: string;
}

export const runEditorProductPreflightComparisonWorkflow = async (
  input: EditorProductPreflightComparisonWorkflowInput
): Promise<ProductPreflightComparisonState> => {
  try {
    const bridgeResult = await createEditorProductPreflightReadDiffBridge({
      currentReport: input.currentReport,
      previousReport: input.previousReport ?? null,
      proposalPreviewRerunResult: input.proposalPreviewRerunResult ?? null,
      generatedAt: input.generatedAt,
      diffProvider: (providerInput) =>
        buildProductPreflightReportDiff({
          beforeReport: providerInput.beforeReport,
          afterReport: providerInput.afterReport,
          ...(providerInput.rerunAffordance === undefined
            ? {}
            : { rerunAffordance: providerInput.rerunAffordance })
        })
    });

    return projectProductPreflightComparisonState({
      generatedAt: bridgeResult.generatedAt,
      currentReport: bridgeResult.current.report,
      currentRerunAffordance: bridgeResult.current.rerunAffordance,
      previousReport: bridgeResult.previous?.report ?? null,
      proposalPreviewReport: bridgeResult.proposalPreview?.report ?? null,
      proposalPreviewRerunAffordance:
        bridgeResult.proposalPreview?.rerunAffordance ?? null,
      comparisons: bridgeResult.comparisons.map((comparison) => ({
        comparisonKind: comparison.comparisonKind,
        diff: comparison.diff
      })),
      safety: bridgeResult.safety
    });
  } catch (error) {
    return createFailedProductPreflightComparisonState(
      error instanceof Error
        ? error.message
        : "Product Preflight deterministic report comparison failed."
    );
  }
};
