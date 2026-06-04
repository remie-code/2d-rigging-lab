export const wave42QualityGateBoundaryVersion = "wave42-quality-gate-boundary-v0";

export const wave42QualityGateReportShape = {
  schemaVersion: "wave42-quality-gate-boundary-report-v0",
  verdictValues: ["pass", "needs_fix", "escalate", "blocked"],
  requiredTopLevelKeys: [
    "schemaVersion",
    "wave",
    "domain",
    "verdict",
    "summary",
    "guardCategories",
    "focusedE2eRegistry",
    "nonGoalClassificationPolicy",
    "findings",
    "forbiddenScopeRequired"
  ],
  requiredCategoryResultKeys: [
    "id",
    "ownerDomain",
    "reportKey",
    "requiredEntryPoints",
    "boundary"
  ],
  requiredFocusedE2eEntryKeys: ["id", "path", "command", "category"]
};
