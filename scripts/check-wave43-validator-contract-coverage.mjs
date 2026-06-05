import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const readRepositoryFile = async (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

const files = {
  catalog: "packages/validator-core/src/check-catalog.ts",
  productPreflightBuilder: "packages/validator-core/src/product-preflight-report.ts",
  productPreflightContract: "packages/contracts/src/product-preflight-report.ts",
  productPreflightDiffContract: "packages/contracts/src/product-preflight-report-diff.ts",
  validatorContract: "discussion/design/module-contracts/validator-contract.md",
  diagnosticPolicy: "discussion/development_convention/diagnostic-policy.md",
  schemaConventions: "discussion/development_convention/schema-and-id-conventions.md",
  traceabilityMatrix: "discussion/tests/traceability/test-traceability-matrix.md",
  fixtureManifest: "discussion/tests/fixtures/fixture-manifest.md",
  domainAMatrix:
    "discussion/implementation/waves/wave43/domain-a-validator-evidence-coverage-matrix.md"
};

const addMissingTokenFindings = (findings, label, relativePath, text, tokens) => {
  for (const token of tokens) {
    if (!text.includes(token)) {
      findings.push(`${label}: ${relativePath} is missing ${JSON.stringify(token)}.`);
    }
  }
};

const addMissingAnyTokenFinding = (
  findings,
  label,
  fileTexts,
  tokens
) => {
  const combinedText = Object.values(fileTexts).join("\n");
  for (const token of tokens) {
    if (!combinedText.includes(token)) {
      findings.push(`${label}: docs are missing ${JSON.stringify(token)}.`);
    }
  }
};

const extractCheckIds = (catalogSource) =>
  new Set(
    [...catalogSource.matchAll(/checkId:\s*"([^"]+)"/g)].map((match) => match[1])
  );

const addMissingCatalogIdFindings = (findings, checkIds, ids) => {
  for (const id of ids) {
    if (!checkIds.has(id)) {
      findings.push(`check-catalog.ts is missing representative check ID ${id}.`);
    }
  }
};

const representativeCatalogIds = [
  "byteAvailability.currentSessionBytes.missing",
  "byteAvailability.digest.unsupported",
  "persistentByteStorage.backend.unavailable",
  "persistentByteStorage.bytes.missing",
  "portableBundle.schemaInvalid",
  "portableBundle.digestMismatch",
  "transportCapability.evidenceMissing",
  "transportCapability.unsupported",
  "mesh.uvCountMismatch",
  "mesh.runtimeEvidenceMismatch",
  "rigControl.warpLatticeCardinalityMismatch",
  "rigControl.warpLatticeRuntimeEvidenceMismatch"
];

const requiredDomainATokens = [
  "byteAvailability.*",
  "persistentByteStorage.*",
  "portableBundle.*",
  "transportCapability.*",
  "meshTopologyUv",
  "rigControlDynamics",
  "Product Preflight",
  "Codex proposal",
  "D should not require `codexProposal.*` to be in `check-catalog.ts`",
  "no persisted/exported artifact",
  "parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport work"
];

const requiredStableDocTokens = [
  "byteAvailability.*",
  "persistentByteStorage.*",
  "portableBundle.*",
  "transportCapability.*",
  "mesh.uvCountMismatch",
  "rigControl.warpLatticeRuntimeEvidenceMismatch",
  "TC-WAVE31-BYTE-SAMPLE-CHARACTERIZATION-001",
  "TC-WAVE32-WARP-LATTICE2D-CONTRACT-001",
  "TC-WAVE34-BYTE-AVAILABILITY-DIRECT-CALL-001",
  "TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001",
  "TC-WAVE38-TOPOLOGY-UV-E2E-001",
  "TC-WAVE39-PRODUCT-PREFLIGHT-STATES-001",
  "TC-WAVE40-CODEX-PROPOSAL-FIXTURES-001",
  "TC-WAVE41-PRODUCT-PREFLIGHT-DIFF-FIXTURES-001",
  "ProductPreflightReportDto",
  "modelStructure",
  "authoringWorkflowEvidence",
  "runtimeViewerEvidence",
  "meshTopologyUv",
  "composition",
  "rigControlDynamics",
  "assetBytes",
  "persistenceTransport",
  "tutorialDemoReadiness",
  "unsupportedClaims",
  "not_supported",
  "not_evaluated",
  "release gate",
  "demo gate",
  "operation catalog",
  "diff preview",
  "rerun validation",
  "approval",
  "repo-side proposal generation",
  "LLM/provider",
  "auto-fix",
  "external transport"
];

const requiredProductPreflightContractTokens = [
  "modelStructure",
  "authoringWorkflowEvidence",
  "runtimeViewerEvidence",
  "meshTopologyUv",
  "composition",
  "rigControlDynamics",
  "assetBytes",
  "persistenceTransport",
  "tutorialDemoReadiness",
  "unsupportedClaims",
  "pass",
  "warn",
  "fail",
  "not_supported",
  "not_evaluated",
  "byteAvailability",
  "persistentByteStorage",
  "portableBundle",
  "transportCapability",
  "product-preflight-report-v0"
];

const requiredProductPreflightDiffContractTokens = [
  "ProductPreflightReportDiffDtoSchema",
  "product-preflight-report-diff-v0"
];

const requiredProductPreflightBuilderTokens = [
  'checkId.startsWith("byteAvailability.")',
  'checkId.startsWith("persistentByteStorage.")',
  'return "assetBytes";',
  'checkId.startsWith("transportCapability.")',
  'checkId.startsWith("portableBundle.")',
  'return "persistenceTransport";',
  'return "meshTopologyUv";',
  'return "rigControlDynamics";'
];

const requiredFocusedE2eBoundaryTokens = [
  "node scripts/check-focused-e2e-registry.mjs",
  "Registry consistency only.",
  "Does not run browser e2e.",
  "Listing is no execution coverage.",
  "dryRunOnlyNoCoverage",
  "Exact selected command is coverage only when non-dry execution exits zero.",
  "Does not claim aggregate coverage"
];

const main = async () => {
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, relativePath]) => [
      key,
      await readRepositoryFile(relativePath)
    ])
  );
  const textByKey = Object.fromEntries(entries);
  const findings = [];

  const checkIds = extractCheckIds(textByKey.catalog);
  addMissingCatalogIdFindings(findings, checkIds, representativeCatalogIds);

  addMissingTokenFindings(
    findings,
    "Domain A coverage matrix",
    files.domainAMatrix,
    textByKey.domainAMatrix,
    requiredDomainATokens
  );

  addMissingAnyTokenFinding(
    findings,
    "Wave43 representative documentation",
    {
      validatorContract: textByKey.validatorContract,
      diagnosticPolicy: textByKey.diagnosticPolicy,
      schemaConventions: textByKey.schemaConventions,
      traceabilityMatrix: textByKey.traceabilityMatrix,
      fixtureManifest: textByKey.fixtureManifest
    },
    requiredStableDocTokens
  );

  addMissingTokenFindings(
    findings,
    "Product Preflight contract",
    files.productPreflightContract,
    textByKey.productPreflightContract,
    requiredProductPreflightContractTokens
  );

  addMissingTokenFindings(
    findings,
    "Product Preflight diff contract",
    files.productPreflightDiffContract,
    textByKey.productPreflightDiffContract,
    requiredProductPreflightDiffContractTokens
  );

  addMissingTokenFindings(
    findings,
    "Product Preflight category mapping",
    files.productPreflightBuilder,
    textByKey.productPreflightBuilder,
    requiredProductPreflightBuilderTokens
  );

  addMissingTokenFindings(
    findings,
    "Wave42 focused e2e coverage boundary",
    files.traceabilityMatrix,
    textByKey.traceabilityMatrix,
    requiredFocusedE2eBoundaryTokens
  );

  const docsClassifyCodexProposalAsProposalLocal =
    textByKey.diagnosticPolicy.includes(
      "not catalog-backed formal validator diagnostics"
    ) ||
    textByKey.schemaConventions.includes(
      "proposal-local or result-local vocabulary"
    );
  const catalogHasCodexProposalIds = [...checkIds].some((id) =>
    id.startsWith("codexProposal.")
  );

  if (docsClassifyCodexProposalAsProposalLocal && catalogHasCodexProposalIds) {
    findings.push(
      "codexProposal.* is registered in check-catalog.ts while current docs classify it as proposal-local/result-local vocabulary."
    );
  }

  if (findings.length > 0) {
    console.error("Wave43 validator contract coverage drift found:");
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Wave43 validator contract coverage checker passed: ` +
      `${representativeCatalogIds.length} representative catalog IDs, ` +
      `${requiredStableDocTokens.length} stable documentation tokens, ` +
      `${requiredFocusedE2eBoundaryTokens.length} focused e2e boundary tokens.`
  );
};

await main();
