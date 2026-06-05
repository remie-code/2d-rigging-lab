import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { wave42FocusedE2eRegistryBoundary } from "./wave42-focused-e2e-boundary.mjs";

export const focusedE2eRegistryVersion = "focused-e2e-registry-v0";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const aggregateImportSourcePath = "apps/editor/e2e/smoke-checks.mjs";
const machineIdPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*$/;
const tagPattern = /^[a-z][A-Za-z0-9]*$/;

const defaultRuntimeCaveat =
  "Requires a local browser executable and an editor Vite server. The direct script starts or reuses the server and runs its own desktop/mobile viewport loop when the script defines one.";

const includedInEditorAggregate = {
  status: "includedInEditorAggregate",
  aggregateEntryPoint: "scripts/editor-e2e-smoke.mjs",
  discoveryPath: aggregateImportSourcePath
};

const standaloneDirectVerification = {
  status: "standaloneDirectVerification",
  aggregateEntryPoint: null,
  discoveryPath: aggregateImportSourcePath
};

const focusedE2eMetadataById = {
  assetIoBoundary: {
    purpose:
      "Replay the asset I/O boundary browser workflow and assert metadata-only evidence without parser, decode, archive, renderer, pixel, or Cubism claims.",
    tags: ["assetIo", "guardrail", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  byteIntake: {
    purpose:
      "Replay browser byte intake, same-origin IndexedDB restore checks, reupload-required states, and metadata-only byte evidence.",
    tags: ["assetIo", "byteIntake", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  canvasMeshEditPersistence: {
    purpose:
      "Replay direct canvas mesh edit persistence checks for selected vertex movement and save/load reinspection.",
    tags: ["editorAuthoring", "mesh", "browserPersistence", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  codexProposalReview: {
    purpose:
      "Replay the Codex proposal review UI path for proposal validation, diff preview, rerun validation, approval controls, and no automatic commit.",
    tags: ["codexProposal", "approvalBoundary", "productPreflight", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  compositionPersistence: {
    purpose:
      "Replay composition, mask, opacity, runtime/viewer evidence, validator evidence, and browser save/load persistence.",
    tags: ["editorAuthoring", "composition", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  dynamicsPersistence: {
    purpose:
      "Replay deterministic dynamics authoring, preview, validator evidence, and browser save/load persistence.",
    tags: ["editorAuthoring", "dynamics", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  layerControls: {
    purpose:
      "Replay layer visibility and draw-order controls with operation log, preview, and save/load persistence checks.",
    tags: ["editorAuthoring", "layers", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  layerTreeDirectManipulation: {
    purpose:
      "Replay layer tree rename, reparent, delete preflight, reassignment, texture assignment, and persistence checks.",
    tags: ["editorAuthoring", "layerTree", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  meshVertex: {
    purpose:
      "Replay mesh vertex edit controls with operation log, runtime preview, and save/load reinspection checks.",
    tags: ["editorAuthoring", "mesh", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  partTextureLayerPersistence: {
    purpose:
      "Replay part hierarchy, drawable part reassignment, texture assignment, runtime/viewer evidence, validator evidence, and persistence checks.",
    tags: ["editorAuthoring", "partTextureLayer", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  portableBundleRoundtrip: {
    purpose:
      "Replay project-defined portable JSON bundle export/import roundtrip and unsupported transport boundary checks.",
    tags: ["transportBoundary", "portableBundle", "browserPersistence", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  productPreflight: {
    purpose:
      "Replay Product Preflight run/read/rerun UI checks for session-generated reports and truthful non-goal wording.",
    tags: ["productPreflight", "reporting", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  productPreflightDiff: {
    purpose:
      "Replay Product Preflight report comparison and proposal-preview diff checks without persisted/exported artifact or release gate claims.",
    tags: ["productPreflight", "reportDiff", "codexProposal", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  psdImportFocused: {
    purpose:
      "Replay explicit browser PSD file selection, sample_model.psd parse/layer-tree evidence, selected-layer texture/part intake, save/load boundary, and parser import containment.",
    tags: ["assetIo", "psdImport", "selectedLayerIntake", "browserPersistence", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  rigControlPersistence: {
    purpose:
      "Replay rig control authoring, hierarchy evidence, runtime/viewer evidence, and browser save/load persistence checks.",
    tags: ["editorAuthoring", "rigControl", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  sourceIntake: {
    purpose:
      "Replay parser-free source intake and split PNG fallback metadata checks with rights/provenance and save/load evidence.",
    tags: ["assetIo", "sourceIntake", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  topologyUvPersistence: {
    purpose:
      "Replay bounded topology and UV edit persistence checks without automatic triangulation, atlas packing, renderer, pixel, or Cubism claims.",
    tags: ["editorAuthoring", "topologyUv", "browserPersistence", "standaloneDirect"],
    aggregateInclusion: standaloneDirectVerification
  },
  tutorialMiniModelPersistence: {
    purpose:
      "Replay tutorial mini model creation, readiness, runtime/viewer evidence, validator evidence, and browser persistence checks.",
    tags: ["editorAuthoring", "tutorialMiniModel", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  viewerRuntime: {
    purpose:
      "Replay viewer/runtime semantic inspection evidence and browser persistence checks without full renderer or pixel oracle claims.",
    tags: ["viewerRuntime", "semanticEvidence", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  },
  warpLatticePersistence: {
    purpose:
      "Replay warpLattice2d rig control, keyform, runtime/viewer evidence, validator evidence, and persistence checks.",
    tags: ["editorAuthoring", "warpLattice", "browserPersistence", "aggregateIncluded"],
    aggregateInclusion: includedInEditorAggregate
  }
};

const buildFocusedE2eEntry = (boundaryEntry) => {
  const metadata = focusedE2eMetadataById[boundaryEntry.id];

  return {
    ...boundaryEntry,
    purpose: metadata?.purpose ?? "",
    tags: metadata?.tags ?? [],
    invocation: {
      command: boundaryEntry.command,
      cwd: "repoRoot",
      shell: false
    },
    aggregateInclusion: metadata?.aggregateInclusion ?? standaloneDirectVerification,
    runtimeCaveat: metadata?.runtimeCaveat ?? defaultRuntimeCaveat,
    executionCoverageClaim: "noneUntilExactCommandRuns"
  };
};

export const focusedE2eRegistry = {
  schemaVersion: focusedE2eRegistryVersion,
  sourceBoundary: "scripts/wave42-focused-e2e-boundary.mjs",
  root: wave42FocusedE2eRegistryBoundary.root,
  entryKind: wave42FocusedE2eRegistryBoundary.entryKind,
  aggregateEntryPoints: wave42FocusedE2eRegistryBoundary.aggregateEntryPoints,
  aggregateImportSourcePath,
  entries: wave42FocusedE2eRegistryBoundary.entries.map(buildFocusedE2eEntry)
};

export const getFocusedE2eEntryById = (id) =>
  focusedE2eRegistry.entries.find((entry) => entry.id === id);

export const getFocusedE2eEntryByPath = (repoPath) =>
  focusedE2eRegistry.entries.find((entry) => entry.path === normalizeRepoPath(repoPath));

export const normalizeRepoPath = (repoPath) => repoPath.split(path.sep).join("/");

export const getFocusedE2eRepoRoot = () => repoRoot;

export const checkFocusedE2eRegistry = async () => {
  const findings = [];
  const boundaryEntriesById = new Map(
    wave42FocusedE2eRegistryBoundary.entries.map((entry) => [entry.id, entry])
  );
  const registryIds = focusedE2eRegistry.entries.map((entry) => entry.id);
  const aggregateImportSource = await readRepoFile(aggregateImportSourcePath);

  validateMachineIds(findings, "focused e2e registry id", registryIds);

  for (const duplicate of findDuplicates(registryIds)) {
    findings.push(`focused e2e registry: duplicate id ${duplicate}`);
  }

  if (focusedE2eRegistry.entries.length !== wave42FocusedE2eRegistryBoundary.entries.length) {
    findings.push(
      `focused e2e registry: expected ${wave42FocusedE2eRegistryBoundary.entries.length} boundary entries, received ${focusedE2eRegistry.entries.length}`
    );
  }

  for (const entry of focusedE2eRegistry.entries) {
    const boundaryEntry = boundaryEntriesById.get(entry.id);

    if (boundaryEntry === undefined) {
      findings.push(`focused e2e registry ${entry.id}: id is missing from Wave42 boundary`);
      continue;
    }

    await validateEntry(findings, entry, boundaryEntry, aggregateImportSource);
  }

  await validateAggregateScripts(findings);

  return buildCheckReport(findings);
};

const validateEntry = async (findings, entry, boundaryEntry, aggregateImportSource) => {
  pushMissingKeys(findings, `focused e2e registry ${entry.id}`, entry, [
    "id",
    "path",
    "command",
    "category",
    "purpose",
    "tags",
    "invocation",
    "aggregateInclusion",
    "runtimeCaveat",
    "executionCoverageClaim"
  ]);

  if (entry.path !== boundaryEntry.path) {
    findings.push(`focused e2e registry ${entry.id}: path drifted from boundary`);
  }

  if (entry.command !== boundaryEntry.command) {
    findings.push(`focused e2e registry ${entry.id}: command drifted from boundary`);
  }

  if (entry.category !== boundaryEntry.category) {
    findings.push(`focused e2e registry ${entry.id}: category drifted from boundary`);
  }

  if (entry.command !== `node ${entry.path}`) {
    findings.push(`focused e2e registry ${entry.id}: command must be "node ${entry.path}"`);
  }

  if (!await repoPathExists(entry.path)) {
    findings.push(`focused e2e registry ${entry.id}: file is missing: ${entry.path}`);
  }

  if (typeof entry.purpose !== "string" || entry.purpose.trim() === "") {
    findings.push(`focused e2e registry ${entry.id}: purpose is empty`);
  }

  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    findings.push(`focused e2e registry ${entry.id}: tags must be non-empty`);
  } else {
    for (const tag of entry.tags) {
      if (!tagPattern.test(tag)) {
        findings.push(`focused e2e registry ${entry.id}: tag ${tag} is not lower-camel`);
      }
    }
  }

  validateInvocation(findings, entry);
  validateAggregateInclusion(findings, entry, aggregateImportSource);

  if (entry.executionCoverageClaim !== "noneUntilExactCommandRuns") {
    findings.push(
      `focused e2e registry ${entry.id}: executionCoverageClaim must be noneUntilExactCommandRuns`
    );
  }

  if (typeof entry.runtimeCaveat !== "string" || entry.runtimeCaveat.trim() === "") {
    findings.push(`focused e2e registry ${entry.id}: runtimeCaveat is empty`);
  }
};

const validateInvocation = (findings, entry) => {
  pushMissingKeys(findings, `focused e2e registry ${entry.id} invocation`, entry.invocation ?? {}, [
    "command",
    "cwd",
    "shell"
  ]);

  if (entry.invocation?.command !== entry.command) {
    findings.push(`focused e2e registry ${entry.id}: invocation command must match command`);
  }

  if (entry.invocation?.cwd !== "repoRoot") {
    findings.push(`focused e2e registry ${entry.id}: invocation cwd must be repoRoot`);
  }

  if (entry.invocation?.shell !== false) {
    findings.push(`focused e2e registry ${entry.id}: invocation shell must be false`);
  }
};

const validateAggregateInclusion = (findings, entry, aggregateImportSource) => {
  const aggregateInclusion = entry.aggregateInclusion ?? {};
  const status = aggregateInclusion.status;

  if (!["includedInEditorAggregate", "standaloneDirectVerification"].includes(status)) {
    findings.push(`focused e2e registry ${entry.id}: unsupported aggregate inclusion status ${status}`);
    return;
  }

  const importToken = `./${path.basename(entry.path)}`;
  const importedByAggregate = aggregateImportSource.includes(`"${importToken}"`);

  if (status === "includedInEditorAggregate") {
    if (aggregateInclusion.aggregateEntryPoint !== "scripts/editor-e2e-smoke.mjs") {
      findings.push(
        `focused e2e registry ${entry.id}: included aggregate entry point must be scripts/editor-e2e-smoke.mjs`
      );
    }

    if (!importedByAggregate) {
      findings.push(
        `focused e2e registry ${entry.id}: aggregate inclusion claims import, but ${aggregateImportSourcePath} does not import ${importToken}`
      );
    }
  }

  if (status === "standaloneDirectVerification") {
    if (aggregateInclusion.aggregateEntryPoint !== null) {
      findings.push(`focused e2e registry ${entry.id}: standalone entries must not name aggregateEntryPoint`);
    }

    if (importedByAggregate) {
      findings.push(
        `focused e2e registry ${entry.id}: standalone inclusion conflicts with ${aggregateImportSourcePath} import ${importToken}`
      );
    }
  }
};

const validateAggregateScripts = async (findings) => {
  const rootPackage = JSON.parse(await readRepoFile("package.json"));
  const editorPackage = JSON.parse(await readRepoFile("apps/editor/package.json"));

  if (rootPackage.scripts?.["test:e2e"] !== "pnpm --filter @private-2d-rigging-lab/editor test:e2e") {
    findings.push("root package test:e2e no longer delegates to the editor aggregate e2e script");
  }

  if (rootPackage.scripts?.["test:e2e:editor"] !== "node scripts/editor-e2e-smoke.mjs") {
    findings.push("root package test:e2e:editor no longer points to scripts/editor-e2e-smoke.mjs");
  }

  if (editorPackage.scripts?.["test:e2e"] !== "node ../../scripts/editor-e2e-smoke.mjs") {
    findings.push("editor package test:e2e no longer points to ../../scripts/editor-e2e-smoke.mjs");
  }
};

const buildCheckReport = (findings) => ({
  schemaVersion: "focused-e2e-registry-check-report-v0",
  registryVersion: focusedE2eRegistryVersion,
  verdict: findings.length === 0 ? "pass" : "needs_fix",
  summary: {
    entryCount: focusedE2eRegistry.entries.length,
    includedInEditorAggregateCount: focusedE2eRegistry.entries.filter(
      (entry) => entry.aggregateInclusion.status === "includedInEditorAggregate"
    ).length,
    standaloneDirectVerificationCount: focusedE2eRegistry.entries.filter(
      (entry) => entry.aggregateInclusion.status === "standaloneDirectVerification"
    ).length,
    aggregateEntryPoints: focusedE2eRegistry.aggregateEntryPoints,
    productCapabilityAdded: false
  },
  entries: focusedE2eRegistry.entries.map((entry) => ({
    id: entry.id,
    path: entry.path,
    command: entry.command,
    category: entry.category,
    aggregateInclusion: entry.aggregateInclusion.status,
    executionCoverageClaim: entry.executionCoverageClaim
  })),
  findings
});

const readRepoFile = async (repoPath) => readFile(path.join(repoRoot, repoPath), "utf8");

const repoPathExists = async (repoPath) => {
  try {
    await access(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const validateMachineIds = (findings, label, values) => {
  for (const value of values) {
    if (!machineIdPattern.test(value)) {
      findings.push(`${label}: ${value} is not a dot-separated lower-camel machine id`);
    }
  }
};

const findDuplicates = (values) => {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates];
};

const pushMissingKeys = (findings, label, value, requiredKeys) => {
  for (const key of requiredKeys) {
    if (!(key in value)) {
      findings.push(`${label}: missing required key ${key}`);
    }
  }
};
