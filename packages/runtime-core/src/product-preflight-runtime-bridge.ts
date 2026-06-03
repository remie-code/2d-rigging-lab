import {
  PackageIdSchema,
  ProductPreflightEvidenceRefDtoSchema,
  type PackageId,
  type ProductPreflightCategoryDto,
  type ProductPreflightEvidenceRefDto,
  type RuntimeSnapshotId,
  type RuntimeStateArtifactRef,
  type RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";

import {
  createRuntimeSnapshotArtifactPath
} from "./runtime-snapshot-artifacts.js";
import type { RuntimeEvidenceResult } from "./runtime-evidence.js";
import type { ViewerRuntimeEvaluationEvidenceDto } from "./viewer-evaluation.js";

export interface RuntimeProductPreflightEvidenceBridgeResult {
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly category: ProductPreflightCategoryDto;
  readonly evidenceRefs: readonly ProductPreflightEvidenceRefDto[];
}

export interface CreateRuntimeEvidenceProductPreflightEvidenceInput {
  readonly evidence: RuntimeEvidenceResult;
}

export interface CreateViewerRuntimeProductPreflightEvidenceInput {
  readonly evidence: ViewerRuntimeEvaluationEvidenceDto;
}

export const createRuntimeEvidenceProductPreflightEvidence = (
  input: CreateRuntimeEvidenceProductPreflightEvidenceInput
): RuntimeProductPreflightEvidenceBridgeResult => {
  const packageId = PackageIdSchema.parse(input.evidence.candidateSnapshot.packageId);
  const packageRevision = parsePackageRevision(input.evidence.candidateSnapshot.packageRevision);
  const packageHash = input.evidence.candidateSnapshot.packageHash;
  const snapshotRefs = input.evidence.generatedRuntimeSnapshotIds.map((snapshotId, index) =>
    createRuntimeSnapshotEvidenceRef({
      evidencePrefix: "runtimeEvidenceSnapshot",
      packageId,
      packageRevision,
      snapshotId,
      role: index === 0 ? "baseline" : "candidate",
      producer: "runtimeCore"
    })
  );
  const stateRefs = input.evidence.generatedRuntimeStateRefs.map((stateRef) =>
    createRuntimeStateEvidenceRef({
      evidencePrefix: "runtimeEvidenceState",
      packageId,
      packageRevision,
      stateRef,
      producer: "runtimeCore"
    })
  );
  const sequenceRefs = input.evidence.generatedRuntimeStateSequenceRefs.map((sequenceRef) =>
    createRuntimeStateSequenceEvidenceRef({
      evidencePrefix: "runtimeEvidenceStateSequence",
      packageId,
      packageRevision,
      sequenceRef,
      producer: "runtimeCore"
    })
  );

  return {
    packageId,
    packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    category: "runtimeViewerEvidence",
    evidenceRefs: dedupeEvidenceRefs([
      ...snapshotRefs,
      ...stateRefs,
      ...sequenceRefs
    ])
  };
};

export const createViewerRuntimeProductPreflightEvidence = (
  input: CreateViewerRuntimeProductPreflightEvidenceInput
): RuntimeProductPreflightEvidenceBridgeResult => {
  const packageId = PackageIdSchema.parse(input.evidence.packageId);
  const packageRevision = parsePackageRevision(input.evidence.packageRevision);
  const packageHash = input.evidence.packageHash;
  const evidenceRefs = dedupeEvidenceRefs([
    createRuntimeSnapshotEvidenceRef({
      evidencePrefix: "viewerRuntimeBaselineSnapshot",
      packageId,
      packageRevision,
      snapshotId: input.evidence.baselineSnapshotId,
      role: "baseline",
      producer: "viewer"
    }),
    createRuntimeSnapshotEvidenceRef({
      evidencePrefix: "viewerRuntimeSnapshot",
      packageId,
      packageRevision,
      snapshotId: input.evidence.snapshotId,
      role: "current",
      producer: "viewer"
    }),
    createRuntimeStateEvidenceRef({
      evidencePrefix: "viewerRuntimeState",
      packageId,
      packageRevision,
      stateRef: input.evidence.finalRuntimeStateRef,
      producer: "viewer"
    })
  ]);

  return {
    packageId,
    packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    category: "runtimeViewerEvidence",
    evidenceRefs
  };
};

const createRuntimeSnapshotEvidenceRef = (input: {
  readonly evidencePrefix: string;
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly snapshotId: RuntimeSnapshotId;
  readonly role: string;
  readonly producer: "runtimeCore" | "viewer";
}): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId(
      input.evidencePrefix,
      input.packageId,
      `r${input.packageRevision}`,
      input.snapshotId
    ),
    artifactRef: {
      artifactKind: "runtimeSnapshot",
      path: createRuntimeSnapshotArtifactPath(input.snapshotId),
      snapshotId: input.snapshotId
    },
    target: {
      kind: "runtimeSnapshot",
      id: input.snapshotId
    },
    summary: [
      `${input.role} runtime snapshot ${input.snapshotId} for package ${input.packageId} revision ${input.packageRevision}.`,
      "Semantic runtime evidence only; no renderer or pixel oracle is implied."
    ].join(" "),
    producer: input.producer
  });

const createRuntimeStateEvidenceRef = (input: {
  readonly evidencePrefix: string;
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly stateRef: RuntimeStateArtifactRef;
  readonly producer: "runtimeCore" | "viewer";
}): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId(
      input.evidencePrefix,
      input.packageId,
      `r${input.packageRevision}`,
      input.stateRef
    ),
    artifactRef: {
      artifactKind: "runtimeState",
      path: input.stateRef
    },
    target: {
      kind: "package",
      id: input.packageId,
      path: input.stateRef
    },
    summary: [
      `Runtime state artifact for package ${input.packageId} revision ${input.packageRevision}.`,
      "State evidence is semantic replay data, not renderer or pixel evidence."
    ].join(" "),
    producer: input.producer
  });

const createRuntimeStateSequenceEvidenceRef = (input: {
  readonly evidencePrefix: string;
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly sequenceRef: RuntimeStateSequenceArtifactRef;
  readonly producer: "runtimeCore" | "viewer";
}): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId(
      input.evidencePrefix,
      input.packageId,
      `r${input.packageRevision}`,
      input.sequenceRef
    ),
    artifactRef: {
      artifactKind: "runtimeStateSequence",
      path: input.sequenceRef
    },
    target: {
      kind: "package",
      id: input.packageId,
      path: input.sequenceRef
    },
    summary: [
      `Runtime state sequence artifact for package ${input.packageId} revision ${input.packageRevision}.`,
      "Sequence evidence preserves deterministic semantic state progression only."
    ].join(" "),
    producer: input.producer
  });

const parsePackageRevision = (value: number): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Package revision must be a nonnegative integer; got ${value}.`);
  }

  return value;
};

const dedupeEvidenceRefs = (
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): readonly ProductPreflightEvidenceRefDto[] => {
  const byEvidenceId = new Map<string, ProductPreflightEvidenceRefDto>();

  for (const evidenceRef of evidenceRefs) {
    if (!byEvidenceId.has(evidenceRef.evidenceId)) {
      byEvidenceId.set(evidenceRef.evidenceId, evidenceRef);
    }
  }

  return [...byEvidenceId.values()];
};

const createEvidenceId = (...parts: readonly string[]): string =>
  `evidence_${sanitizeIdToken(parts.join("_"))}`;

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "runtimeEvidence";
