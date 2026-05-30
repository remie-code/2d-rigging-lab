import type { CheckStatus, DiagnosticDto, Severity } from "@private-2d-rigging-lab/contracts";

import type { EditorPreviewDiagnosticsSummaryDto } from "./preview-dto.js";

const severityKeys: readonly Severity[] = ["info", "warning", "error", "blocking"];
const statusKeys: readonly CheckStatus[] = ["pass", "warning", "fail", "needs_review", "not_applicable"];

export const summarizePreviewDiagnostics = (
  diagnostics: readonly DiagnosticDto[]
): EditorPreviewDiagnosticsSummaryDto => {
  const bySeverity = createZeroRecord(severityKeys);
  const byStatus = createZeroRecord(statusKeys);

  for (const diagnostic of diagnostics) {
    bySeverity[diagnostic.severity] += 1;
    byStatus[diagnostic.status] += 1;
  }

  return {
    totalCount: diagnostics.length,
    bySeverity,
    byStatus,
    blockingCount: bySeverity.blocking,
    errorCount: bySeverity.error,
    warningCount: bySeverity.warning,
    items: diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      status: diagnostic.status,
      phase: diagnostic.phase,
      target: diagnostic.target,
      message: diagnostic.message
    }))
  };
};

const createZeroRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
