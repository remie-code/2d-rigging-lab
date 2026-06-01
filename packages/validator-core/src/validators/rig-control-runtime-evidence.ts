import type {
  RuntimeSnapshotId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type {
  PackageDocumentDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import {
  createRuntimeSnapshotArtifactPath,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import {
  createKeyformDrivenRuntimeEvidenceMismatch,
  createRequiredKeyformEvidence,
  createRigControlKeyformsById
} from "./rig-control-keyform-evidence.js";

interface RigControlEntry {
  readonly rigControl: RigControlDto;
  readonly index: number;
}

type RuntimeRigControlEvidence = RuntimeSnapshotDto["rigControls"][number];

export const validateRuntimeRigControlEvidence = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly rigControlEntries: readonly RigControlEntry[];
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const enabledRigControls = input.rigControlEntries.filter((entry) => entry.rigControl.enabled);
  if (enabledRigControls.length === 0) {
    return [];
  }

  const keyformsByRigControlId = createRigControlKeyformsById(input.packageDocument);
  if (input.runtimeSnapshot === undefined) {
    return enabledRigControls.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          `rigControlKind=${entry.rigControl.kind}`,
          "runtimeSnapshot=missing",
          ...createRequiredKeyformEvidence(keyformsByRigControlId.get(entry.rigControl.rigControlId) ?? [])
        ]
      })
    );
  }

  const runtimeSnapshot = input.runtimeSnapshot;
  const snapshotIdentityMismatchEvidence = createRuntimeSnapshotIdentityMismatchEvidence(
    input.packageDocument,
    runtimeSnapshot
  );
  if (snapshotIdentityMismatchEvidence.length > 0) {
    return enabledRigControls.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        reason: "stale",
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "runtimeSnapshotIdentity=mismatch",
          ...snapshotIdentityMismatchEvidence,
          ...createRequiredKeyformEvidence(keyformsByRigControlId.get(entry.rigControl.rigControlId) ?? [])
        ]
      })
    );
  }

  const snapshotRigControlsById = new Map(
    runtimeSnapshot.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );

  return enabledRigControls.flatMap((entry) => {
    const snapshotRigControl = snapshotRigControlsById.get(entry.rigControl.rigControlId);
    if (snapshotRigControl === undefined) {
      return [
        createRuntimeEvidenceMissingCheck({
          entry,
          runtimeSnapshotId: runtimeSnapshot.snapshotId,
          reason: "missing",
          evidence: [
            `rigControlId=${entry.rigControl.rigControlId}`,
            ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
            "snapshotRigControl=missing",
            ...createRequiredKeyformEvidence(keyformsByRigControlId.get(entry.rigControl.rigControlId) ?? [])
          ]
        })
      ];
    }

    const mismatchEvidence = [
      ...createRuntimeRigControlMismatchEvidence(entry.rigControl, snapshotRigControl),
      ...createKeyformDrivenRuntimeEvidenceMismatch({
        entry,
        rigControlsById: input.rigControlsById,
        runtimeSnapshot,
        runtimeRigControl: snapshotRigControl,
        keyforms: keyformsByRigControlId.get(entry.rigControl.rigControlId) ?? []
      })
    ];
    if (mismatchEvidence.length === 0) {
      return [];
    }

    return [
      createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        reason: "mismatch",
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "snapshotRigControl=mismatch",
          ...mismatchEvidence
        ]
      })
    ];
  });
};

const createRuntimeSnapshotIdentityMismatchEvidence = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto
): readonly string[] => {
  const evidence: string[] = [];

  if (packageDocument.manifest.packageId !== runtimeSnapshot.packageId) {
    evidence.push(`packageId=${packageDocument.manifest.packageId}`);
    evidence.push(`snapshotPackageId=${runtimeSnapshot.packageId}`);
  }

  if (packageDocument.manifest.packageRevision !== runtimeSnapshot.packageRevision) {
    evidence.push(`packageRevision=${packageDocument.manifest.packageRevision}`);
    evidence.push(`snapshotPackageRevision=${runtimeSnapshot.packageRevision}`);
  }

  return evidence;
};

const createRuntimeRigControlMismatchEvidence = (
  packageRigControl: RigControlDto,
  runtimeRigControl: RuntimeRigControlEvidence
): readonly string[] => {
  const evidence: string[] = [];

  if (packageRigControl.kind !== runtimeRigControl.kind) {
    evidence.push(`packageKind=${packageRigControl.kind}`);
    evidence.push(`runtimeKind=${runtimeRigControl.kind}`);
  }

  if (packageRigControl.enabled !== runtimeRigControl.enabled) {
    evidence.push(`packageEnabled=${packageRigControl.enabled}`);
    evidence.push(`runtimeEnabled=${runtimeRigControl.enabled}`);
  }

  if (normalizeOptionalRigControlId(packageRigControl.parentId) !== normalizeOptionalRigControlId(runtimeRigControl.parentId)) {
    evidence.push(`packageParentId=${normalizeOptionalRigControlId(packageRigControl.parentId)}`);
    evidence.push(`runtimeParentId=${normalizeOptionalRigControlId(runtimeRigControl.parentId)}`);
  }

  return evidence;
};

const createRuntimeSnapshotEvidenceBase = (runtimeSnapshot: RuntimeSnapshotDto): readonly string[] => [
  `snapshotId=${runtimeSnapshot.snapshotId}`,
  `runtimeSnapshotRef=${createRuntimeSnapshotArtifactPath(runtimeSnapshot.snapshotId)}`
];

const createRuntimeEvidenceMissingCheck = (input: {
  readonly entry: RigControlEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly reason?: "missing" | "mismatch" | "stale";
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.runtimeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "rigControl_evaluation",
    target: {
      kind: "rigControl",
      id: input.entry.rigControl.rigControlId,
      path: rigControlBasePath(input.entry.index)
    },
    targetPath: rigControlBasePath(input.entry.index),
    message: createRuntimeEvidenceMissingMessage(input),
    evidence: input.evidence,
    impact: "Validator cannot prove deterministic keyform-driven rig control runtime evaluation without matching runtime snapshot evidence.",
    snapshotIds: input.runtimeSnapshotId === undefined ? [] : [input.runtimeSnapshotId]
  });

const createRuntimeEvidenceMissingMessage = (input: {
  readonly entry: RigControlEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly reason?: "missing" | "mismatch" | "stale";
}): string => {
  if (input.runtimeSnapshotId === undefined) {
    return `Rig control ${input.entry.rigControl.rigControlId} has no runtime snapshot evidence.`;
  }

  if (input.reason === "mismatch") {
    return `Runtime snapshot ${input.runtimeSnapshotId} has mismatched rig control evidence for ${input.entry.rigControl.rigControlId}.`;
  }

  if (input.reason === "stale") {
    return `Runtime snapshot ${input.runtimeSnapshotId} is stale for rig control evidence ${input.entry.rigControl.rigControlId}.`;
  }

  return `Runtime snapshot ${input.runtimeSnapshotId} is missing rig control evidence for ${input.entry.rigControl.rigControlId}.`;
};

const createRigControlCheck = (input: {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail" | "needs_review" | "not_applicable";
  readonly severity: "info" | "warning" | "error" | "blocking";
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    relatedScenarios: ["SC-DEF-002"],
    impact: input.impact,
    snapshotIds: input.snapshotIds
  });

const normalizeOptionalRigControlId = (rigControlId: string | undefined): string =>
  rigControlId ?? "root";

const rigControlBasePath = (index: number): string =>
  `/model/rigControls/rigControls/${index}`;
