import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  toRuntimeGraph,
  TUTORIAL_MINI_MODEL_IDS
} from "../../authoring-core/src/index.js";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import { PackageDocumentSchema } from "@private-2d-rigging-lab/package-format";
import {
  applyTutorialMiniModelRecipe
} from "../../operation-core/src/index.js";
import {
  evaluateViewerRuntimeSnapshot,
  type NormalizedPart,
  type NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import type {
  ValidationCheckResultDto,
  ValidationReportDto
} from "./index.js";
import {
  buildTutorialMiniModelReadinessReport,
  validateTutorialMiniModelReadiness
} from "./validators/tutorial-readiness.js";

const CREATED_AT = "2026-06-02T00:00:00.000Z";

describe("wave30 tutorial mini model validator contract fixture", () => {
  it("pins tutorial readiness report, invalid diagnostics, and editor-state readiness evidence", () => {
    const recipeResult = applyTutorialMiniModelRecipe();
    const packageDocument = PackageDocumentSchema.parse(recipeResult.materializedPackage);
    const viewerResult = evaluateViewerRuntimeSnapshot(withRuntimeParts(toRuntimeGraph(recipeResult.session, {
      packageHash: "sha256:tutorial-mini-model-final-v1"
    }), recipeResult.session.graph.parts), {
      baselineFrameIndex: 40,
      frameIndex: 41,
      operationId: "op_wave30_tutorial_mini_model_contract_viewer",
      strictness: "strict",
      targetIds: [...tutorialRuntimeTargetIds],
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      }
    });
    const readinessReport = buildTutorialMiniModelReadinessReport({
      packageDocument,
      runtimeSnapshot: viewerResult.snapshot,
      viewerEvidence: viewerResult.evidence,
      reportId: "val_tutorial_mini_model_contract_ready",
      createdAt: CREATED_AT,
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    });

    expect(summarizeValidationReadiness({
      validReadinessReport: readinessReport,
      missingEyeChecks: validateTutorialMiniModelReadiness({
        packageDocument: withoutDrawable(packageDocument, TUTORIAL_MINI_MODEL_IDS.drawables.eye),
        runtimeSnapshot: viewerResult.snapshot,
        viewerEvidence: viewerResult.evidence
      }),
      unsupportedClaimChecks: validateTutorialMiniModelReadiness({
        packageDocument,
        runtimeSnapshot: viewerResult.snapshot,
        viewerEvidence: viewerResult.evidence,
        unsupportedClaims: [
          {
            claimId: "fullRenderer",
            status: "present",
            source: "fixture-metadata",
            evidence: ["rendererClaim=fullRenderer"]
          },
          {
            claimId: "pixelOracle",
            status: "unsupported",
            source: "fixture-metadata",
            evidence: ["pixelOracle=false"]
          }
        ]
      })
    })).toEqual(loadFixtureJson("expected/validation-readiness-summary.json"));
    expect(summarizeEditorStateReadinessEvidence({
      packageDocument,
      runtimeSnapshotId: viewerResult.snapshot.snapshotId,
      validationReportId: readinessReport.reportId
    })).toEqual(loadFixtureJson("expected/editor-state-readiness-evidence-summary.json"));
  });
});

const summarizeValidationReadiness = (input: {
  readonly validReadinessReport: ValidationReportDto;
  readonly missingEyeChecks: readonly ValidationCheckResultDto[];
  readonly unsupportedClaimChecks: readonly ValidationCheckResultDto[];
}) => ({
  schemaVersion: "wave30-tutorial-mini-model-validation-readiness-summary-v1",
  validReadinessReport: summarizeReport(input.validReadinessReport),
  invalidCases: [
    {
      caseId: "missing-eye-drawable",
      checks: summarizeChecks(input.missingEyeChecks, ["tutorial.requiredDrawableMissing"])
    },
    {
      caseId: "unsupported-renderer-claim",
      checks: summarizeChecks(input.unsupportedClaimChecks, ["tutorial.unsupportedClaim"])
    }
  ]
});

const summarizeReport = (report: ValidationReportDto) => ({
  reportId: report.reportId,
  profile: report.profile,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  operationLogPresent: report.evidence.operationLogPresent,
  operationLogPath: report.evidence.operationLogPath,
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  checks: summarizeChecks(report.checks)
});

const summarizeChecks = (
  checks: readonly ValidationCheckResultDto[],
  checkIds?: readonly string[]
) =>
  checks
    .filter((check) => checkIds === undefined || checkIds.includes(check.checkId))
    .map((check) => ({
      checkId: check.checkId,
      status: check.status,
      severity: check.severity,
      targetPath: check.targetPath ?? null,
      evidence: check.evidence
    }));

const summarizeEditorStateReadinessEvidence = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshotId: string;
  readonly validationReportId: string;
}) => {
  const steps = [
    createStep("partLayerSelection", [
      { kind: "part", id: TUTORIAL_MINI_MODEL_IDS.parts.frontHair },
      { kind: "drawable", id: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair }
    ]),
    createStep("generatedDrawableMesh", [
      { kind: "drawable", id: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair },
      { kind: "mesh", id: TUTORIAL_MINI_MODEL_IDS.meshes.frontHair }
    ]),
    createStep("textureMetadata", [
      { kind: "drawable", id: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair },
      { kind: "texture", id: TUTORIAL_MINI_MODEL_IDS.textures.frontHair }
    ]),
    createStep("maskOrOpacity", [
      { kind: "maskRelation", id: TUTORIAL_MINI_MODEL_IDS.masks.eyeMaskToEye },
      { kind: "opacityKeyform", id: TUTORIAL_MINI_MODEL_IDS.keyformSets.mouthOpacity }
    ]),
    createStep("rotation2dRigKeyform", [
      { kind: "rigControl", id: TUTORIAL_MINI_MODEL_IDS.rigControls.headRotation },
      { kind: "keyformSet", id: TUTORIAL_MINI_MODEL_IDS.keyformSets.headRotationAngle }
    ]),
    createStep("dynamicsEvidence", [
      { kind: "dynamicsGroup", id: TUTORIAL_MINI_MODEL_IDS.dynamicsGroups.hairSway }
    ]),
    createStep("previewViewerValidator", [
      { kind: "runtimeEvidence", id: input.runtimeSnapshotId },
      { kind: "validationReport", id: input.validationReportId },
      { kind: "viewerRuntime", id: "viewerRuntime" }
    ]),
    createStep(
      "browserLocalSaveLoad",
      [{ kind: "package", id: input.packageDocument.manifest.packageId }],
      ["browser-local save/load reload summary is outside this fixture domain"]
    )
  ];
  const readyStepIds = steps
    .filter((step) => step.status === "ready")
    .map((step) => step.stepId);
  const missingStepIds = steps
    .filter((step) => step.status !== "ready")
    .map((step) => step.stepId);

  return {
    schemaVersion: "wave30-tutorial-mini-model-editor-state-readiness-evidence-summary-v1",
    source: "fixture-editor-semantic-state",
    recipeId: "tutorialMiniModelV0",
    packageId: input.packageDocument.manifest.packageId,
    packageRevision: input.packageDocument.manifest.packageRevision,
    selectedTarget: {
      kind: "mesh",
      id: TUTORIAL_MINI_MODEL_IDS.meshes.frontHair
    },
    readiness: {
      status: "inProgress",
      readyStepCount: readyStepIds.length,
      totalStepCount: steps.length,
      readyStepIds,
      missingStepIds
    },
    steps,
    nonGoalClaims: [
      "realAssetImport",
      "imageDecode",
      "filePicker",
      "archiveImportExport",
      "fullRenderer",
      "pixelOracle",
      "publicTutorialDistribution",
      "cubismCompatibility"
    ],
    runtimeRenderingSemanticsClaim: "none"
  };
};

const createStep = (
  stepId: string,
  evidenceRefs: readonly { readonly kind: string; readonly id: string }[],
  missingEvidence: readonly string[] = []
) => ({
  stepId,
  status: missingEvidence.length === 0 ? "ready" : "missingEvidence",
  evidenceRefs,
  missingEvidence
});

const withoutDrawable = (
  packageDocument: PackageDocumentDto,
  drawableId: string
): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...packageDocument,
    model: {
      ...packageDocument.model,
      graph: {
        ...packageDocument.model.graph,
        parts: packageDocument.model.graph.parts.map((part) => ({
          ...part,
          drawableIds: part.drawableIds.filter((candidate) => candidate !== drawableId)
        }))
      },
      drawables: {
        ...packageDocument.model.drawables,
        drawables: packageDocument.model.drawables.drawables.filter(
          (drawable) => drawable.drawableId !== drawableId
        )
      },
      drawOrder: {
        ...packageDocument.model.drawOrder,
        entries: packageDocument.model.drawOrder.entries.filter(
          (entry) => entry.drawableId !== drawableId
        )
      }
    }
  });

const withRuntimeParts = (
  graph: NormalizedRuntimeGraph,
  parts: readonly RuntimePartInput[]
): NormalizedRuntimeGraph => ({
  ...graph,
  parts: new Map(parts.map((part) => [part.partId, toNormalizedPart(part)]))
});

type RuntimePartInput = Omit<NormalizedPart, "parentPartId"> & {
  readonly parentPartId?: NormalizedPart["parentPartId"] | undefined;
};

const toNormalizedPart = (part: RuntimePartInput): NormalizedPart => ({
  partId: part.partId,
  displayName: part.displayName,
  ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
  childPartIds: [...part.childPartIds],
  drawableIds: [...part.drawableIds]
});

const tutorialRuntimeTargetIds = [
  TUTORIAL_MINI_MODEL_IDS.drawables.body,
  TUTORIAL_MINI_MODEL_IDS.drawables.head,
  TUTORIAL_MINI_MODEL_IDS.drawables.face,
  TUTORIAL_MINI_MODEL_IDS.drawables.mouth,
  TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask,
  TUTORIAL_MINI_MODEL_IDS.drawables.eye,
  TUTORIAL_MINI_MODEL_IDS.drawables.frontHair,
  TUTORIAL_MINI_MODEL_IDS.drawables.arm,
  TUTORIAL_MINI_MODEL_IDS.rigControls.headRotation,
  TUTORIAL_MINI_MODEL_IDS.dynamicsGroups.hairSway
] as const;

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave30-tutorial-mini-model-contract-fixtures"
);
