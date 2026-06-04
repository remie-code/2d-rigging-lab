export const wave42GuardCategories = [
  {
    id: "sourceOrganization",
    ownerDomain: "B",
    reportKey: "sourceOrganization",
    requiredEntryPoints: ["node scripts/check-source-organization.mjs"],
    boundary:
      "barrel-only entrypoints, catch-all file names, and authored source responsibility checks only"
  },
  {
    id: "focusedE2eRegistry",
    ownerDomain: "C",
    reportKey: "focusedE2eRegistry",
    requiredEntryPoints: ["node scripts/check-wave42-quality-gate-boundary.mjs"],
    boundary:
      "focused smoke scripts are directly listed or replayed without expanding aggregate e2e runtime"
  },
  {
    id: "dependencyForbiddenScope",
    ownerDomain: "D",
    reportKey: "dependencyForbiddenScope",
    requiredEntryPoints: ["node scripts/check-dependencies.mjs"],
    boundary:
      "forbidden dependency, forbidden asset, and non-goal claim containment without dependency additions"
  },
  {
    id: "documentationTraceability",
    ownerDomain: "E",
    reportKey: "documentationTraceability",
    requiredEntryPoints: [],
    boundary:
      "narrow documentation and traceability registration of implemented quality gate surfaces only"
  },
  {
    id: "integrationReview",
    ownerDomain: "F",
    reportKey: "integrationReview",
    requiredEntryPoints: [],
    boundary:
      "final verification, clean integration review, map synchronization, and final report only"
  }
];
