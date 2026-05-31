import {
  CheckIdSchema,
  RuntimeSnapshotIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeSnapshotId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import {
  createRuntimeSnapshotArtifactPath,
  ViewerRuntimeEvaluationEvidenceSchema
} from "@private-2d-rigging-lab/runtime-core";
import type {
  RuntimeSnapshotDto,
  ViewerRuntimeEvaluationEvidenceDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface ViewerRuntimeEvidenceValidationInput {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly viewerEvidence?: unknown;
  readonly requireViewerEvidence?: boolean;
}

export interface ViewerRuntimeEvidenceValidationResult {
  readonly checks: readonly ValidationCheckResultDto[];
  readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly supplementalEvidenceRefs: readonly string[];
}

export const validateViewerRuntimeEvidence = (
  input: ViewerRuntimeEvidenceValidationInput
): ViewerRuntimeEvidenceValidationResult => {
  if (input.viewerEvidence === undefined) {
    return input.requireViewerEvidence === true
      ? {
          checks: [
            createViewerEvidenceMissingCheck({
              packageDocument: input.packageDocument,
              message: "Viewer runtime evaluation evidence is required but missing.",
              evidence: [
                "viewerEvidence=missing",
                input.runtimeSnapshot === undefined
                  ? "runtimeSnapshot=missing"
                  : `snapshotId=${input.runtimeSnapshot.snapshotId}`
              ],
              ...(input.runtimeSnapshot === undefined ? {} : { runtimeSnapshot: input.runtimeSnapshot })
            })
          ],
          runtimeSnapshotIds: input.runtimeSnapshot === undefined ? [] : [input.runtimeSnapshot.snapshotId],
          supplementalEvidenceRefs: []
        }
      : {
          checks: [],
          runtimeSnapshotIds: [],
          supplementalEvidenceRefs: []
        };
  }

  const parseResult = ViewerRuntimeEvaluationEvidenceSchema.safeParse(input.viewerEvidence);
  if (!parseResult.success) {
    return {
      checks: [
        createViewerEvidenceMissingCheck({
          packageDocument: input.packageDocument,
          message: "Viewer runtime evaluation evidence cannot be parsed.",
          evidence: [
            "viewerEvidence=parse-failed",
            ...parseResult.error.issues.map((issue) =>
              `${issue.path.map(String).join(".") || "viewerEvidence"}=${issue.message}`
            )
          ],
          ...(input.runtimeSnapshot === undefined ? {} : { runtimeSnapshot: input.runtimeSnapshot })
        })
      ],
      runtimeSnapshotIds: input.runtimeSnapshot === undefined ? [] : [input.runtimeSnapshot.snapshotId],
      supplementalEvidenceRefs: []
    };
  }

  const evidence = parseResult.data;
  const runtimeSnapshotIds = createViewerRuntimeSnapshotIds(evidence, input.runtimeSnapshot);
  const supplementalEvidenceRefs = createViewerSupplementalEvidenceRefs(evidence);
  const checks = [
    ...(input.runtimeSnapshot === undefined
      ? [
          createViewerEvidenceMissingCheck({
            packageDocument: input.packageDocument,
            message: "Viewer runtime snapshot evidence is required but missing.",
            evidence: [
              `viewerSnapshotId=${evidence.snapshotId}`,
              "runtimeSnapshot=missing"
            ],
            runtimeSnapshotId: evidence.snapshotId
          })
        ]
      : validateViewerSnapshotAlignment({
          packageDocument: input.packageDocument,
          runtimeSnapshot: input.runtimeSnapshot,
          evidence
        }))
  ];

  return {
    checks,
    runtimeSnapshotIds,
    supplementalEvidenceRefs
  };
};

const validateViewerSnapshotAlignment = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot: RuntimeSnapshotDto;
  readonly evidence: ViewerRuntimeEvaluationEvidenceDto;
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const packageId = input.packageDocument.manifest.packageId;
  const packageRevision = input.packageDocument.manifest.packageRevision;

  if (input.evidence.packageId !== packageId) {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Viewer runtime evidence package id does not match the validated package.",
      evidence: [
        `packageId=${packageId}`,
        `viewerEvidencePackageId=${input.evidence.packageId}`
      ]
    }));
  }

  if (input.evidence.packageRevision !== packageRevision) {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Viewer runtime evidence package revision does not match the validated package.",
      evidence: [
        `packageRevision=${packageRevision}`,
        `viewerEvidencePackageRevision=${input.evidence.packageRevision}`
      ]
    }));
  }

  if (input.runtimeSnapshot.packageId !== packageId) {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Viewer runtime snapshot package id does not match the validated package.",
      evidence: [
        `packageId=${packageId}`,
        `snapshotPackageId=${input.runtimeSnapshot.packageId}`
      ]
    }));
  }

  if (input.runtimeSnapshot.packageRevision !== packageRevision) {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Viewer runtime snapshot package revision does not match the validated package.",
      evidence: [
        `packageRevision=${packageRevision}`,
        `snapshotPackageRevision=${input.runtimeSnapshot.packageRevision}`
      ]
    }));
  }

  if (input.runtimeSnapshot.context.source.surface !== "viewer") {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Runtime snapshot was not produced in viewer context.",
      evidence: [
        `snapshotId=${input.runtimeSnapshot.snapshotId}`,
        `snapshotSurface=${input.runtimeSnapshot.context.source.surface}`
      ]
    }));
  }

  if (input.evidence.snapshotId !== input.runtimeSnapshot.snapshotId) {
    checks.push(createViewerEvidenceStaleCheck({
      runtimeSnapshot: input.runtimeSnapshot,
      message: "Viewer runtime evidence points to a different runtime snapshot.",
      evidence: [
        `viewerSnapshotId=${input.evidence.snapshotId}`,
        `runtimeSnapshotId=${input.runtimeSnapshot.snapshotId}`
      ]
    }));
  }

  return checks;
};

const createViewerRuntimeSnapshotIds = (
  evidence: ViewerRuntimeEvaluationEvidenceDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): readonly RuntimeSnapshotId[] => {
  const ids = [
    evidence.baselineSnapshotId,
    evidence.snapshotId,
    ...(runtimeSnapshot === undefined ? [] : [runtimeSnapshot.snapshotId])
  ];

  return [...new Set(ids)].map((snapshotId) => RuntimeSnapshotIdSchema.parse(snapshotId));
};

const createViewerSupplementalEvidenceRefs = (
  evidence: ViewerRuntimeEvaluationEvidenceDto
): readonly string[] => [
  createRuntimeSnapshotArtifactPath(evidence.baselineSnapshotId),
  createRuntimeSnapshotArtifactPath(evidence.snapshotId),
  evidence.finalRuntimeStateRef
];

const createViewerEvidenceMissingCheck = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly message: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto => {
  const runtimeSnapshotId = input.runtimeSnapshotId ?? input.runtimeSnapshot?.snapshotId;

  return createViewerEvidenceCheck({
    checkId: "viewer.runtimeEvidenceMissing",
    target: createViewerEvidenceTarget(input.packageDocument, input.runtimeSnapshot),
    targetPath: input.runtimeSnapshot === undefined ? "/viewer/runtimeEvidence" : "context/source/surface",
    message: input.message,
    evidence: input.evidence,
    impact: "Validator cannot prove the package was evaluated through the viewer runtime context.",
    snapshotIds: runtimeSnapshotId === undefined ? [] : [runtimeSnapshotId]
  });
};

const createViewerEvidenceStaleCheck = (input: {
  readonly runtimeSnapshot: RuntimeSnapshotDto;
  readonly message: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createViewerEvidenceCheck({
    checkId: "viewer.runtimeEvidenceStale",
    target: {
      kind: "runtimeSnapshot",
      id: input.runtimeSnapshot.snapshotId,
      path: "context/source/surface"
    },
    targetPath: "context/source/surface",
    message: input.message,
    evidence: input.evidence,
    impact: "Validator cannot use stale or non-viewer runtime evidence as AI-readable viewer proof.",
    snapshotIds: [input.runtimeSnapshot.snapshotId]
  });

const createViewerEvidenceTarget = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): TargetRefDto =>
  runtimeSnapshot === undefined
    ? {
        kind: "package",
        id: packageDocument.manifest.packageId,
        path: "/viewer/runtimeEvidence"
      }
    : {
        kind: "runtimeSnapshot",
        id: runtimeSnapshot.snapshotId,
        path: "context/source/surface"
      };

const createViewerEvidenceCheck = (input: {
  readonly checkId: "viewer.runtimeEvidenceMissing" | "viewer.runtimeEvidenceStale";
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse(input.checkId),
    status: "fail",
    severity: "error",
    phase: "representative_evaluation",
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    relatedScenarios: ["SC-MVP-003", "SC-MVP-004"],
    impact: input.impact,
    snapshotIds: input.snapshotIds
  });
