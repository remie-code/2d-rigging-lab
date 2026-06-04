import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { wave42FocusedE2eRegistryBoundary } from "./wave42-focused-e2e-boundary.mjs";
import { wave42GuardCategories } from "./wave42-guard-categories.mjs";
import { wave42NonGoalClassificationPolicy } from "./wave42-non-goal-classification-policy.mjs";
import {
  wave42QualityGateBoundaryVersion,
  wave42QualityGateReportShape
} from "./wave42-quality-gate-report-shape.mjs";

const repoRoot = process.cwd();
const machineIdPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*$/;

const toRepoPath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join("/");

const exists = async (repoPath) => {
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

const discoverFocusedSmokeScripts = async () => {
  const root = path.join(repoRoot, wave42FocusedE2eRegistryBoundary.root);
  const entries = await readdir(root, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith("-smoke.mjs"))
    .map((entry) => toRepoPath(path.join(root, entry.name)))
    .sort();
};

const hasDuplicates = (values) => {
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

const validateMachineIds = (findings, label, values) => {
  for (const value of values) {
    if (!machineIdPattern.test(value)) {
      findings.push(`${label}: ${value} is not a dot-separated lower-camel machine id`);
    }
  }
};

const validateGuardCategories = async (findings) => {
  const ids = wave42GuardCategories.map((category) => category.id);
  const reportKeys = wave42GuardCategories.map((category) => category.reportKey);

  validateMachineIds(findings, "guard category id", ids);
  validateMachineIds(findings, "guard category reportKey", reportKeys);

  for (const duplicate of hasDuplicates(ids)) {
    findings.push(`guard categories: duplicate id ${duplicate}`);
  }

  for (const category of wave42GuardCategories) {
    pushMissingKeys(
      findings,
      `guard category ${category.id}`,
      category,
      wave42QualityGateReportShape.requiredCategoryResultKeys
    );

    for (const entryPoint of category.requiredEntryPoints) {
      const match = entryPoint.match(/^node (.+)$/);
      if (match === null) {
        findings.push(`guard category ${category.id}: entry point must be direct node command: ${entryPoint}`);
        continue;
      }

      if (!await exists(match[1])) {
        findings.push(`guard category ${category.id}: entry point path is missing: ${match[1]}`);
      }
    }
  }
};

const validateFocusedE2eRegistry = async (findings) => {
  const discoveredScripts = await discoverFocusedSmokeScripts();
  const registryEntries = wave42FocusedE2eRegistryBoundary.entries;
  const registeredPaths = registryEntries.map((entry) => entry.path).sort();
  const registryIds = registryEntries.map((entry) => entry.id);
  const excludedHelpers = new Set(wave42FocusedE2eRegistryBoundary.excludedHelperFiles);
  const aggregateEntryPoints = new Set(wave42FocusedE2eRegistryBoundary.aggregateEntryPoints);

  validateMachineIds(findings, "focused e2e registry id", registryIds);

  for (const duplicate of hasDuplicates(registryIds)) {
    findings.push(`focused e2e registry: duplicate id ${duplicate}`);
  }

  for (const entry of registryEntries) {
    pushMissingKeys(
      findings,
      `focused e2e registry ${entry.id}`,
      entry,
      wave42QualityGateReportShape.requiredFocusedE2eEntryKeys
    );

    if (!entry.path.startsWith(`${wave42FocusedE2eRegistryBoundary.root}/`)) {
      findings.push(`focused e2e registry ${entry.id}: path is outside e2e root: ${entry.path}`);
    }

    if (!entry.path.endsWith("-smoke.mjs")) {
      findings.push(`focused e2e registry ${entry.id}: path does not match *-smoke.mjs: ${entry.path}`);
    }

    if (excludedHelpers.has(entry.path)) {
      findings.push(`focused e2e registry ${entry.id}: helper file must not be registered: ${entry.path}`);
    }

    if (aggregateEntryPoints.has(entry.path)) {
      findings.push(`focused e2e registry ${entry.id}: aggregate entry point must not be registered: ${entry.path}`);
    }

    if (entry.command !== `node ${entry.path}`) {
      findings.push(`focused e2e registry ${entry.id}: command must be "node ${entry.path}"`);
    }

    if (!await exists(entry.path)) {
      findings.push(`focused e2e registry ${entry.id}: file is missing: ${entry.path}`);
    }
  }

  const missingFromRegistry = discoveredScripts.filter((scriptPath) => !registeredPaths.includes(scriptPath));
  const staleRegistryEntries = registeredPaths.filter((scriptPath) => !discoveredScripts.includes(scriptPath));

  for (const scriptPath of missingFromRegistry) {
    findings.push(`focused e2e registry: discovered focused smoke is not registered: ${scriptPath}`);
  }

  for (const scriptPath of staleRegistryEntries) {
    findings.push(`focused e2e registry: registered focused smoke was not discovered: ${scriptPath}`);
  }
};

const validateReportShape = (findings, report) => {
  pushMissingKeys(findings, "quality gate boundary report", report, wave42QualityGateReportShape.requiredTopLevelKeys);

  if (report.schemaVersion !== wave42QualityGateReportShape.schemaVersion) {
    findings.push(
      `quality gate boundary report: schemaVersion must be ${wave42QualityGateReportShape.schemaVersion}`
    );
  }

  if (!wave42QualityGateReportShape.verdictValues.includes(report.verdict)) {
    findings.push(`quality gate boundary report: unsupported verdict ${report.verdict}`);
  }
};

const validateNonGoalClassificationPolicy = (findings) => {
  const classificationKinds = wave42NonGoalClassificationPolicy.classificationKinds;
  const classificationIds = classificationKinds.map((classificationKind) => classificationKind.id);
  const classificationIdSet = new Set(classificationIds);
  const nonGoalIds = wave42NonGoalClassificationPolicy.explicitNonGoals.map((nonGoal) => nonGoal.id);

  validateMachineIds(findings, "non-goal classification id", classificationIds);
  validateMachineIds(findings, "explicit non-goal id", nonGoalIds);

  for (const duplicate of hasDuplicates(classificationIds)) {
    findings.push(`non-goal classification policy: duplicate classification id ${duplicate}`);
  }

  for (const duplicate of hasDuplicates(nonGoalIds)) {
    findings.push(`non-goal classification policy: duplicate non-goal id ${duplicate}`);
  }

  const handlingValues = new Set(classificationKinds.map((classificationKind) => classificationKind.handling));
  if (!handlingValues.has("blocking")) {
    findings.push("non-goal classification policy: at least one blocking classification is required");
  }

  if (!handlingValues.has("allowed")) {
    findings.push("non-goal classification policy: at least one allowed classification is required");
  }

  for (const classificationKind of classificationKinds) {
    if (!["blocking", "allowed"].includes(classificationKind.handling)) {
      findings.push(
        `non-goal classification policy ${classificationKind.id}: handling must be blocking or allowed`
      );
    }

    if (classificationKind.description.trim() === "") {
      findings.push(`non-goal classification policy ${classificationKind.id}: description is empty`);
    }
  }

  for (const nonGoal of wave42NonGoalClassificationPolicy.explicitNonGoals) {
    if (!Array.isArray(nonGoal.terms) || nonGoal.terms.length === 0) {
      findings.push(`explicit non-goal ${nonGoal.id}: terms must be non-empty`);
    }

    for (const term of nonGoal.terms) {
      if (term.trim() === "") {
        findings.push(`explicit non-goal ${nonGoal.id}: empty term`);
      }
    }

    for (const contextId of [...nonGoal.blockingContexts, ...nonGoal.allowedContexts]) {
      if (!classificationIdSet.has(contextId)) {
        findings.push(`explicit non-goal ${nonGoal.id}: unknown classification context ${contextId}`);
      }
    }
  }
};

const buildBoundaryReport = (findings) => ({
  schemaVersion: wave42QualityGateReportShape.schemaVersion,
  wave: "Wave42",
  domain: "A.wave42-verification-registry-quality-gate-boundary-foundation",
  verdict: findings.length === 0 ? "pass" : "needs_fix",
  summary: {
    boundaryVersion: wave42QualityGateBoundaryVersion,
    guardCategoryCount: wave42GuardCategories.length,
    focusedE2eEntryCount: wave42FocusedE2eRegistryBoundary.entries.length,
    nonGoalClassificationCount: wave42NonGoalClassificationPolicy.classificationKinds.length,
    explicitNonGoalCount: wave42NonGoalClassificationPolicy.explicitNonGoals.length,
    productCapabilityAdded: false
  },
  guardCategories: wave42GuardCategories,
  focusedE2eRegistry: wave42FocusedE2eRegistryBoundary,
  nonGoalClassificationPolicy: wave42NonGoalClassificationPolicy,
  findings,
  forbiddenScopeRequired: false
});

const main = async () => {
  const findings = [];

  await validateGuardCategories(findings);
  await validateFocusedE2eRegistry(findings);
  validateNonGoalClassificationPolicy(findings);

  const report = buildBoundaryReport(findings);
  validateReportShape(findings, report);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(buildBoundaryReport(findings), null, 2));
  }

  if (findings.length > 0) {
    if (!process.argv.includes("--json")) {
      console.error("Wave42 quality gate boundary violations found:");
      for (const finding of findings) {
        console.error(`- ${finding}`);
      }
    }
    process.exit(1);
  }

  if (!process.argv.includes("--json")) {
    console.log(
      `Wave42 quality gate boundary guard passed: ${wave42GuardCategories.length} categories, ` +
        `${wave42FocusedE2eRegistryBoundary.entries.length} focused e2e entries, ` +
        `${wave42NonGoalClassificationPolicy.explicitNonGoals.length} explicit non-goals.`
    );
  }
};

await main();
