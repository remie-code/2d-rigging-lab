import type {
  KeyformSetDto,
  PackageDocumentDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import type {
  Affine2dMatrixDto,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

interface RigControlEntry {
  readonly rigControl: RigControlDto;
  readonly index: number;
}

export interface RigControlKeyformEvidence {
  readonly keyformSetId: string;
  readonly targetId: string;
  readonly targetProperty: string;
  readonly expectedTarget: string;
  readonly compositionMode: string;
  readonly compositionOrder: number;
}

type RuntimeRigControlEvidence = RuntimeSnapshotDto["rigControls"][number];
type RuntimeKeyformSampleEvidence = RuntimeSnapshotDto["keyformSamples"][number];

export const createRigControlKeyformsById = (
  packageDocument: PackageDocumentDto
): ReadonlyMap<string, readonly RigControlKeyformEvidence[]> => {
  const keyformsByRigControlId = new Map<string, RigControlKeyformEvidence[]>();

  for (const keyformSet of packageDocument.model.keyforms.keyformSets) {
    if (keyformSet.target.kind !== "rigControl") {
      continue;
    }

    const evidence = createRigControlKeyformEvidence(keyformSet);
    keyformsByRigControlId.set(evidence.targetId, [
      ...(keyformsByRigControlId.get(evidence.targetId) ?? []),
      evidence
    ]);
  }

  return new Map(
    [...keyformsByRigControlId.entries()].map(([rigControlId, keyforms]) => [
      rigControlId,
      [...keyforms].sort(compareRigControlKeyforms)
    ])
  );
};

export const createRequiredKeyformEvidence = (
  keyforms: readonly RigControlKeyformEvidence[]
): readonly string[] =>
  keyforms.length === 0
    ? []
    : [
        `requiredKeyformSetIds=${keyforms.map((keyform) => keyform.keyformSetId).join(",")}`,
        `expectedKeyformTargets=${keyforms.map((keyform) => keyform.expectedTarget).join(",")}`
      ];

export const createKeyformDrivenRuntimeEvidenceMismatch = (input: {
  readonly entry: RigControlEntry;
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly runtimeSnapshot: RuntimeSnapshotDto;
  readonly runtimeRigControl: RuntimeRigControlEvidence;
  readonly keyforms: readonly RigControlKeyformEvidence[];
}): readonly string[] => {
  if (input.keyforms.length === 0) {
    return [];
  }

  const evidence: string[] = [];
  for (const keyform of input.keyforms) {
    const sample = findRuntimeKeyformSample(input.runtimeSnapshot, keyform.keyformSetId);
    if (sample === undefined) {
      evidence.push(`missingKeyformSetId=${keyform.keyformSetId}`);
      evidence.push(`expectedKeyformTarget=${keyform.expectedTarget}`);
      continue;
    }

    evidence.push(...createRuntimeKeyformSampleMismatchEvidence(keyform, sample));
  }

  evidence.push(...createKeyformTransformEvidenceMismatch(input.entry.rigControl, input.runtimeRigControl, input.keyforms, input.runtimeSnapshot));
  evidence.push(...createAffectedTargetEvidenceMismatch(input.entry, input.rigControlsById, input.runtimeRigControl));

  return evidence.length === 0
    ? []
    : [
        ...createRequiredKeyformEvidence(input.keyforms),
        ...evidence
      ];
};

const createRigControlKeyformEvidence = (keyformSet: KeyformSetDto): RigControlKeyformEvidence => ({
  keyformSetId: keyformSet.keyformSetId,
  targetId: keyformSet.target.id,
  targetProperty: keyformSet.target.property,
  expectedTarget: `rigControl:${keyformSet.target.id}.${keyformSet.target.property}`,
  compositionMode: keyformSet.compositionMode,
  compositionOrder: keyformSet.compositionOrder
});

const createRuntimeKeyformSampleMismatchEvidence = (
  keyform: RigControlKeyformEvidence,
  sample: RuntimeKeyformSampleEvidence
): readonly string[] => {
  const evidence: string[] = [];
  const metadata = readRecordProperty(sample, "targetMetadata");

  if (sample.target !== keyform.expectedTarget) {
    evidence.push(`keyformSetId=${keyform.keyformSetId}`);
    evidence.push(`expectedKeyformTarget=${keyform.expectedTarget}`);
    evidence.push(`runtimeKeyformTarget=${sample.target}`);
  }

  if (metadata === undefined) {
    evidence.push(`keyformSetId=${keyform.keyformSetId}`);
    evidence.push("runtimeKeyformTargetMetadata=missing");
  } else {
    const targetKind = readStringProperty(metadata, "targetKind");
    const targetId = readStringProperty(metadata, "targetId");
    const targetProperty = readStringProperty(metadata, "targetProperty");
    if (targetKind !== "rigControl" || targetId !== keyform.targetId || targetProperty !== keyform.targetProperty) {
      evidence.push(`keyformSetId=${keyform.keyformSetId}`);
      evidence.push("runtimeKeyformTargetMetadata=mismatch");
      evidence.push("expectedTargetKind=rigControl");
      evidence.push(`runtimeTargetKind=${targetKind ?? "missing"}`);
      evidence.push(`expectedTargetId=${keyform.targetId}`);
      evidence.push(`runtimeTargetId=${targetId ?? "missing"}`);
      evidence.push(`expectedTargetProperty=${keyform.targetProperty}`);
      evidence.push(`runtimeTargetProperty=${targetProperty ?? "missing"}`);
    }
  }

  const compositionMode = readStringProperty(sample, "compositionMode");
  if (compositionMode !== keyform.compositionMode) {
    evidence.push(`keyformSetId=${keyform.keyformSetId}`);
    evidence.push(`expectedCompositionMode=${keyform.compositionMode}`);
    evidence.push(`runtimeCompositionMode=${compositionMode ?? "missing"}`);
  }

  const compositionOrder = readNumberProperty(sample, "compositionOrder");
  if (compositionOrder !== keyform.compositionOrder) {
    evidence.push(`keyformSetId=${keyform.keyformSetId}`);
    evidence.push(`expectedCompositionOrder=${keyform.compositionOrder}`);
    evidence.push(`runtimeCompositionOrder=${compositionOrder ?? "missing"}`);
  }

  return evidence;
};

const createKeyformTransformEvidenceMismatch = (
  packageRigControl: RigControlDto,
  runtimeRigControl: RuntimeRigControlEvidence,
  keyforms: readonly RigControlKeyformEvidence[],
  runtimeSnapshot: RuntimeSnapshotDto
): readonly string[] => {
  const evidence: string[] = [];

  if (packageRigControl.kind === "warpLattice2d") {
    return [];
  }

  if (runtimeRigControl.evaluationStatus !== "evaluated") {
    evidence.push("expectedEvaluationStatus=evaluated");
    evidence.push(`runtimeEvaluationStatus=${runtimeRigControl.evaluationStatus}`);
  }

  if (runtimeRigControl.localTransform === undefined) {
    evidence.push("runtimeLocalTransform=missing");
  }

  if (runtimeRigControl.worldTransform === undefined) {
    evidence.push("runtimeWorldTransform=missing");
  }

  if (runtimeRigControl.localTransform !== undefined) {
    evidence.push(...createSingleAngleTransformMismatchEvidence(packageRigControl, runtimeRigControl, keyforms, runtimeSnapshot));
  }

  if (runtimeRigControl.localTransform !== undefined && runtimeRigControl.worldTransform !== undefined) {
    evidence.push(...createWorldTransformMismatchEvidence(packageRigControl, runtimeRigControl, runtimeSnapshot));
  }

  return evidence;
};

const createSingleAngleTransformMismatchEvidence = (
  packageRigControl: Extract<RigControlDto, { readonly kind: "rotation2d" }>,
  runtimeRigControl: RuntimeRigControlEvidence,
  keyforms: readonly RigControlKeyformEvidence[],
  runtimeSnapshot: RuntimeSnapshotDto
): readonly string[] => {
  const angleKeyforms = keyforms.filter((keyform) =>
    keyform.targetProperty === "angleDegrees" || keyform.targetProperty === "restAngleDegrees"
  );
  if (angleKeyforms.length !== 1) {
    return [];
  }

  const keyform = angleKeyforms[0];
  if (keyform === undefined) {
    return [];
  }

  const sample = findRuntimeKeyformSample(runtimeSnapshot, keyform.keyformSetId);
  if (sample === undefined) {
    return [];
  }

  const patchValue = readNumericStatePatch(sample, keyform.targetProperty);
  if (patchValue === undefined) {
    return [
      `keyformSetId=${keyform.keyformSetId}`,
      `targetProperty=${keyform.targetProperty}`,
      "runtimeStatePatch=missing",
      "expectedStatePatch=finiteNumber"
    ];
  }

  const expectedLocalAngle = createExpectedLocalAngleDegrees(packageRigControl, keyform, patchValue);
  if (expectedLocalAngle === undefined) {
    return [];
  }

  const runtimeLocalAngle = runtimeRigControl.localTransform?.angleDegrees;
  if (runtimeLocalAngle === undefined || sameFiniteNumber(runtimeLocalAngle, expectedLocalAngle)) {
    return [];
  }

  return [
    `keyformSetId=${keyform.keyformSetId}`,
    `expectedLocalAngleDegrees=${formatNumber(expectedLocalAngle)}`,
    `runtimeLocalAngleDegrees=${formatNumber(runtimeLocalAngle)}`
  ];
};

const createExpectedLocalAngleDegrees = (
  packageRigControl: Extract<RigControlDto, { readonly kind: "rotation2d" }>,
  keyform: RigControlKeyformEvidence,
  patchValue: number
): number | undefined => {
  if (keyform.compositionMode === "replace") {
    return patchValue;
  }

  if (keyform.compositionMode === "additiveDelta") {
    return packageRigControl.restAngleDegrees + patchValue;
  }

  return undefined;
};

const createWorldTransformMismatchEvidence = (
  packageRigControl: Extract<RigControlDto, { readonly kind: "rotation2d" }>,
  runtimeRigControl: RuntimeRigControlEvidence,
  runtimeSnapshot: RuntimeSnapshotDto
): readonly string[] => {
  const localTransform = runtimeRigControl.localTransform;
  const worldTransform = runtimeRigControl.worldTransform;
  if (localTransform === undefined || worldTransform === undefined) {
    return [];
  }

  const parentWorldTransform = packageRigControl.parentId === undefined
    ? undefined
    : findRuntimeRigControl(runtimeSnapshot, packageRigControl.parentId)?.worldTransform;
  if (packageRigControl.parentId !== undefined && parentWorldTransform === undefined) {
    return [
      `parentRigControlId=${packageRigControl.parentId}`,
      "runtimeParentWorldTransform=missing"
    ];
  }

  const expectedWorldMatrix = parentWorldTransform === undefined
    ? localTransform.matrix
    : composeAffine2d(parentWorldTransform.matrix, localTransform.matrix);
  const expectedWorldAngle = extractRotationDegrees(expectedWorldMatrix);
  const evidence: string[] = [];

  if (!sameFiniteNumber(worldTransform.angleDegrees, expectedWorldAngle)) {
    evidence.push(`expectedWorldAngleDegrees=${formatNumber(expectedWorldAngle)}`);
    evidence.push(`runtimeWorldAngleDegrees=${formatNumber(worldTransform.angleDegrees)}`);
  }

  if (!sameAffine2dMatrix(worldTransform.matrix, expectedWorldMatrix)) {
    evidence.push(`expectedWorldMatrix=${formatAffine2dMatrix(expectedWorldMatrix)}`);
    evidence.push(`runtimeWorldMatrix=${formatAffine2dMatrix(worldTransform.matrix)}`);
  }

  return evidence;
};

const createAffectedTargetEvidenceMismatch = (
  entry: RigControlEntry,
  rigControlsById: ReadonlyMap<string, RigControlEntry>,
  runtimeRigControl: RuntimeRigControlEvidence
): readonly string[] => {
  const evidence: string[] = [];
  const expectedAffectedDrawableIds = collectAffectedDrawableIds(entry, rigControlsById);
  const expectedAffectedRigControlIds = collectDescendantRigControlIds(entry, rigControlsById);

  if (!sameStringList(expectedAffectedDrawableIds, runtimeRigControl.affectedDrawableIds)) {
    evidence.push(`expectedAffectedDrawableIds=${formatIdList(expectedAffectedDrawableIds)}`);
    evidence.push(`runtimeAffectedDrawableIds=${formatIdList(runtimeRigControl.affectedDrawableIds)}`);
  }

  if (!sameStringList(expectedAffectedRigControlIds, runtimeRigControl.affectedRigControlIds)) {
    evidence.push(`expectedAffectedRigControlIds=${formatIdList(expectedAffectedRigControlIds)}`);
    evidence.push(`runtimeAffectedRigControlIds=${formatIdList(runtimeRigControl.affectedRigControlIds)}`);
  }

  return evidence;
};

const collectAffectedDrawableIds = (
  entry: RigControlEntry,
  rigControlsById: ReadonlyMap<string, RigControlEntry>
): readonly string[] => {
  const drawableIds = new Set<string>(entry.rigControl.childDrawableIds);
  for (const childRigControlId of collectDescendantRigControlIds(entry, rigControlsById)) {
    const childEntry = rigControlsById.get(childRigControlId);
    for (const drawableId of childEntry?.rigControl.childDrawableIds ?? []) {
      drawableIds.add(drawableId);
    }
  }

  return sortStringList([...drawableIds]);
};

const collectDescendantRigControlIds = (
  entry: RigControlEntry,
  rigControlsById: ReadonlyMap<string, RigControlEntry>
): readonly string[] => {
  const descendantIds = new Set<string>();
  const visit = (rigControl: RigControlDto): void => {
    for (const childRigControlId of sortStringList(rigControl.childRigControlIds)) {
      if (descendantIds.has(childRigControlId)) {
        continue;
      }

      const childEntry = rigControlsById.get(childRigControlId);
      if (childEntry === undefined) {
        continue;
      }

      descendantIds.add(childRigControlId);
      visit(childEntry.rigControl);
    }
  };

  visit(entry.rigControl);
  return sortStringList([...descendantIds]);
};

const findRuntimeKeyformSample = (
  runtimeSnapshot: RuntimeSnapshotDto,
  keyformSetId: string
): RuntimeKeyformSampleEvidence | undefined =>
  runtimeSnapshot.keyformSamples.find((sample) => sample.keyformSetId === keyformSetId);

const findRuntimeRigControl = (
  runtimeSnapshot: RuntimeSnapshotDto,
  rigControlId: string
): RuntimeRigControlEvidence | undefined =>
  runtimeSnapshot.rigControls.find((rigControl) => rigControl.rigControlId === rigControlId);

const readNumericStatePatch = (
  sample: RuntimeKeyformSampleEvidence,
  targetProperty: string
): number | undefined => {
  const statePatch = readUnknownProperty(sample, "statePatch");
  if (typeof statePatch === "number" && Number.isFinite(statePatch)) {
    return statePatch;
  }

  if (!isRecord(statePatch)) {
    return undefined;
  }

  const propertyPatch = statePatch[targetProperty];
  return typeof propertyPatch === "number" && Number.isFinite(propertyPatch)
    ? propertyPatch
    : undefined;
};

const readUnknownProperty = (value: unknown, property: string): unknown =>
  isRecord(value) ? value[property] : undefined;

const readRecordProperty = (value: unknown, property: string): Readonly<Record<string, unknown>> | undefined => {
  const propertyValue = readUnknownProperty(value, property);
  return isRecord(propertyValue) ? propertyValue : undefined;
};

const readStringProperty = (value: unknown, property: string): string | undefined => {
  const propertyValue = readUnknownProperty(value, property);
  return typeof propertyValue === "string" ? propertyValue : undefined;
};

const readNumberProperty = (value: unknown, property: string): number | undefined => {
  const propertyValue = readUnknownProperty(value, property);
  return typeof propertyValue === "number" && Number.isFinite(propertyValue) ? propertyValue : undefined;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const compareRigControlKeyforms = (
  left: RigControlKeyformEvidence,
  right: RigControlKeyformEvidence
): number =>
  left.compositionOrder - right.compositionOrder ||
  left.keyformSetId.localeCompare(right.keyformSetId) ||
  left.targetProperty.localeCompare(right.targetProperty);

const sameFiniteNumber = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9;

const sameStringList = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(sortStringList(left)) === JSON.stringify(sortStringList(right));

const sameAffine2dMatrix = (left: Affine2dMatrixDto, right: Affine2dMatrixDto): boolean =>
  sameFiniteNumber(left.a, right.a) &&
  sameFiniteNumber(left.b, right.b) &&
  sameFiniteNumber(left.c, right.c) &&
  sameFiniteNumber(left.d, right.d) &&
  sameFiniteNumber(left.e, right.e) &&
  sameFiniteNumber(left.f, right.f);

const composeAffine2d = (parent: Affine2dMatrixDto, local: Affine2dMatrixDto): Affine2dMatrixDto => ({
  a: parent.a * local.a + parent.c * local.b,
  b: parent.b * local.a + parent.d * local.b,
  c: parent.a * local.c + parent.c * local.d,
  d: parent.b * local.c + parent.d * local.d,
  e: parent.a * local.e + parent.c * local.f + parent.e,
  f: parent.b * local.e + parent.d * local.f + parent.f
});

const extractRotationDegrees = (matrix: Affine2dMatrixDto): number => {
  const radians = Math.atan2(matrix.b, matrix.a);
  return Number(((radians * 180) / Math.PI).toFixed(12));
};

const sortStringList = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const formatIdList = (ids: readonly string[]): string =>
  ids.length === 0 ? "none" : sortStringList(ids).join(",");

const formatNumber = (value: number): string =>
  Number(value.toFixed(12)).toString();

const formatAffine2dMatrix = (matrix: Affine2dMatrixDto): string =>
  `a=${formatNumber(matrix.a)},b=${formatNumber(matrix.b)},c=${formatNumber(matrix.c)},d=${formatNumber(matrix.d)},e=${formatNumber(matrix.e)},f=${formatNumber(matrix.f)}`;
