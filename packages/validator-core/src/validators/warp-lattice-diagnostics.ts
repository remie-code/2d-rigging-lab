import type {
  RectDto,
  RuntimeSnapshotId,
  TargetRefDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetDto,
  PackageDocumentDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import {
  createRuntimeSnapshotArtifactPath,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

interface RigControlEntry {
  readonly rigControl: RigControlDto;
  readonly index: number;
}

type WarpLatticeRigControl = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;
type RuntimeRigControlEvidence = RuntimeSnapshotDto["rigControls"][number];
type RuntimeKeyformSampleEvidence = RuntimeSnapshotDto["keyformSamples"][number];

interface WarpLatticeEntry {
  readonly rigControl: WarpLatticeRigControl;
  readonly index: number;
}

export const validateWarpLatticeDiagnostics = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly rigControlEntries: readonly RigControlEntry[];
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const warpEntries = input.rigControlEntries.filter(isWarpLatticeEntry);
  if (warpEntries.length === 0) {
    return [];
  }

  const warpEntriesById = new Map(
    warpEntries.map((entry) => [entry.rigControl.rigControlId, entry])
  );
  const checks: ValidationCheckResultDto[] = [];

  checks.push(...warpEntries.flatMap(validateWarpLatticeStaticShape));
  checks.push(...validateWarpLatticeKeyformPatches(input.packageDocument, warpEntriesById));

  if (
    input.runtimeSnapshot !== undefined &&
    createRuntimeSnapshotIdentityMismatchEvidence(input.packageDocument, input.runtimeSnapshot).length === 0
  ) {
    checks.push(...validateWarpLatticeRuntimeEvidence({
      warpEntries,
      rigControlsById: input.rigControlsById,
      packageDocument: input.packageDocument,
      runtimeSnapshot: input.runtimeSnapshot
    }));
  }

  return checks;
};

const validateWarpLatticeStaticShape = (
  entry: WarpLatticeEntry
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const expectedControlPointCount = getExpectedControlPointCount(entry.rigControl);

  if (entry.rigControl.restControlPoints.length !== expectedControlPointCount) {
    checks.push(createWarpLatticeCheck({
      checkId: "rigControl.warpLatticeCardinalityMismatch",
      phase: "rigControl_semantic",
      target: createRigControlTarget(entry, "restControlPoints"),
      targetPath: `${rigControlBasePath(entry.index)}/restControlPoints`,
      message: `warpLattice2d rig control ${entry.rigControl.rigControlId} has ${entry.rigControl.restControlPoints.length} rest control points for a ${entry.rigControl.latticeColumns}x${entry.rigControl.latticeRows} lattice.`,
      evidence: [
        `rigControlId=${entry.rigControl.rigControlId}`,
        `latticeColumns=${entry.rigControl.latticeColumns}`,
        `latticeRows=${entry.rigControl.latticeRows}`,
        `expectedRestControlPointCount=${expectedControlPointCount}`,
        `actualRestControlPointCount=${entry.rigControl.restControlPoints.length}`
      ],
      impact: "The warp lattice evaluator cannot deterministically map keyform offsets to control points when lattice cardinality and rest control point count disagree."
    }));
  }

  if (entry.rigControl.domainBounds.width <= 0 || entry.rigControl.domainBounds.height <= 0) {
    checks.push(createWarpLatticeCheck({
      checkId: "rigControl.warpLatticeDomainBoundsInvalid",
      phase: "rigControl_semantic",
      target: createRigControlTarget(entry, "domainBounds"),
      targetPath: `${rigControlBasePath(entry.index)}/domainBounds`,
      message: `warpLattice2d rig control ${entry.rigControl.rigControlId} has non-positive domain bounds.`,
      evidence: [
        `rigControlId=${entry.rigControl.rigControlId}`,
        `domainBounds=${formatRect(entry.rigControl.domainBounds)}`
      ],
      impact: "The warp lattice evaluator needs a positive domain rectangle to decide which drawable vertices are affected."
    }));
  }

  const outsideControlPointIndexes = entry.rigControl.restControlPoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => !isPointInsideRect(point, entry.rigControl.domainBounds))
    .map(({ index }) => index);
  if (outsideControlPointIndexes.length > 0) {
    checks.push(createWarpLatticeCheck({
      checkId: "rigControl.warpLatticeRestControlPointMismatch",
      phase: "rigControl_semantic",
      target: createRigControlTarget(entry, "restControlPoints"),
      targetPath: `${rigControlBasePath(entry.index)}/restControlPoints`,
      message: `warpLattice2d rig control ${entry.rigControl.rigControlId} has rest control points outside domainBounds.`,
      evidence: [
        `rigControlId=${entry.rigControl.rigControlId}`,
        `domainBounds=${formatRect(entry.rigControl.domainBounds)}`,
        `outsideRestControlPointIndexes=${outsideControlPointIndexes.join(",")}`
      ],
      impact: "Rest control points outside the declared domain make the project-defined bilinear lattice evidence ambiguous."
    }));
  }

  checks.push(...validateWarpDeformerMetadata(entry));

  return checks;
};

const validateWarpDeformerMetadata = (
  entry: WarpLatticeEntry
): readonly ValidationCheckResultDto[] => {
  const metadata = entry.rigControl.warpDeformer;
  if (metadata === undefined) {
    return [];
  }

  const checks: ValidationCheckResultDto[] = [];
  if (
    metadata.transformGrid.columns !== entry.rigControl.latticeColumns ||
    metadata.transformGrid.rows !== entry.rigControl.latticeRows
  ) {
    checks.push(createWarpLatticeCheck({
      checkId: "rigControl.warpDeformerTransformGridMismatch",
      phase: "rigControl_semantic",
      target: createRigControlTarget(entry, "warpDeformer/transformGrid"),
      targetPath: `${rigControlBasePath(entry.index)}/warpDeformer/transformGrid`,
      message: `Warp Deformer ${entry.rigControl.rigControlId} has transformGrid values that do not match stored lattice dimensions.`,
      evidence: [
        `rigControlId=${entry.rigControl.rigControlId}`,
        `latticeColumns=${entry.rigControl.latticeColumns}`,
        `latticeRows=${entry.rigControl.latticeRows}`,
        `transformColumns=${metadata.transformGrid.columns}`,
        `transformRows=${metadata.transformGrid.rows}`
      ],
      impact: "The Editor and runtime would disagree about the Warp Deformer's transform control point grid."
    }));
  }

  const expectedBezierCount = metadata.bezierEditSurface.columns * metadata.bezierEditSurface.rows;
  const actualRestCount = metadata.bezierEditSurface.restControlPoints.length;
  const actualHandleCount = metadata.bezierEditSurface.handles.length;
  if (actualRestCount !== expectedBezierCount || actualHandleCount !== expectedBezierCount) {
    checks.push(createWarpLatticeCheck({
      checkId: "rigControl.warpDeformerBezierSurfaceCardinalityMismatch",
      phase: "rigControl_semantic",
      target: createRigControlTarget(entry, "warpDeformer/bezierEditSurface"),
      targetPath: `${rigControlBasePath(entry.index)}/warpDeformer/bezierEditSurface`,
      message: `Warp Deformer ${entry.rigControl.rigControlId} has malformed Bezier edit surface cardinality.`,
      evidence: [
        `rigControlId=${entry.rigControl.rigControlId}`,
        `bezierColumns=${metadata.bezierEditSurface.columns}`,
        `bezierRows=${metadata.bezierEditSurface.rows}`,
        `expectedBezierPointCount=${expectedBezierCount}`,
        `actualBezierRestControlPointCount=${actualRestCount}`,
        `actualBezierHandleCount=${actualHandleCount}`
      ],
      impact: "The Editor cannot deterministically map Bezier edit points and handles to the stored Warp Deformer surface."
    }));
  }

  return checks;
};

const validateWarpLatticeKeyformPatches = (
  packageDocument: PackageDocumentDto,
  warpEntriesById: ReadonlyMap<string, WarpLatticeEntry>
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.keyforms.keyformSets.forEach((keyformSet, keyformSetIndex) => {
    if (keyformSet.target.kind !== "rigControl") {
      return;
    }

    const entry = warpEntriesById.get(keyformSet.target.id);
    if (entry === undefined) {
      return;
    }

    if (keyformSet.target.property !== "controlPointOffsets") {
      checks.push(createWarpLatticeCheck({
        checkId: "rigControl.warpLatticeUnsupportedProperty",
        phase: "rigControl_semantic",
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId,
          path: keyformTargetPropertyPath(keyformSetIndex)
        },
        targetPath: keyformTargetPropertyPath(keyformSetIndex),
        message: `warpLattice2d keyform ${keyformSet.keyformSetId} targets unsupported property ${keyformSet.target.property}.`,
        evidence: [
          `keyformSetId=${keyformSet.keyformSetId}`,
          `rigControlId=${entry.rigControl.rigControlId}`,
          `targetProperty=${keyformSet.target.property}`,
          "supportedProperty=controlPointOffsets"
        ],
        impact: "Wave32 warp lattice keyforms only support project-defined controlPointOffsets patches."
      }));
      return;
    }

    if (!isSupportedWarpCompositionMode(keyformSet.compositionMode)) {
      checks.push(createMalformedPatchCheck({
        entry,
        keyformSet,
        keyformSetIndex,
        keyIndex: undefined,
        evidence: [
          `compositionMode=${keyformSet.compositionMode}`,
          "supportedCompositionModes=replace,additiveDelta"
        ]
      }));
    }

    keyformSet.keys.forEach((key, keyIndex) => {
      const patchEvidence = createControlPointOffsetPatchEvidence(
        key.statePatch,
        getExpectedControlPointCount(entry.rigControl)
      );
      if (patchEvidence.length === 0) {
        return;
      }

      checks.push(createMalformedPatchCheck({
        entry,
        keyformSet,
        keyformSetIndex,
        keyIndex,
        evidence: patchEvidence
      }));
    });
  });

  return checks;
};

const validateWarpLatticeRuntimeEvidence = (input: {
  readonly warpEntries: readonly WarpLatticeEntry[];
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const runtimeRigControlsById = new Map(
    input.runtimeSnapshot.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const warpKeyformsByRigControlId = createWarpLatticeKeyformsByRigControlId(input.packageDocument);

  return input.warpEntries.flatMap((entry) => {
    if (!entry.rigControl.enabled) {
      return [];
    }

    const runtimeRigControl = runtimeRigControlsById.get(entry.rigControl.rigControlId);
    if (runtimeRigControl === undefined || runtimeRigControl.kind !== "warpLattice2d") {
      return [];
    }

    const mismatchEvidence = [
      ...createWarpRuntimeRigControlMismatchEvidence({
        entry,
        rigControlsById: input.rigControlsById,
        runtimeRigControl,
        runtimeSnapshot: input.runtimeSnapshot
      }),
      ...createWarpRuntimeKeyformPatchMismatchEvidence({
        entry,
        runtimeSnapshot: input.runtimeSnapshot,
        keyforms: warpKeyformsByRigControlId.get(entry.rigControl.rigControlId) ?? []
      })
    ];
    if (mismatchEvidence.length === 0) {
      return [];
    }

    return [
      createWarpLatticeRuntimeMismatchCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          `snapshotId=${input.runtimeSnapshot.snapshotId}`,
          `runtimeSnapshotRef=${createRuntimeSnapshotArtifactPath(input.runtimeSnapshot.snapshotId)}`,
          ...mismatchEvidence
        ]
      })
    ];
  });
};

const createWarpRuntimeRigControlMismatchEvidence = (input: {
  readonly entry: WarpLatticeEntry;
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly runtimeRigControl: RuntimeRigControlEvidence;
  readonly runtimeSnapshot: RuntimeSnapshotDto;
}): readonly string[] => {
  const evidence: string[] = [];
  const expectedAffectedDrawableIds = collectAffectedDrawableIds(input.entry, input.rigControlsById);
  const expectedAffectedRigControlIds = collectDescendantRigControlIds(input.entry, input.rigControlsById);

  if (input.runtimeRigControl.evaluationStatus !== "evaluated") {
    evidence.push("expectedEvaluationStatus=evaluated");
    evidence.push(`runtimeEvaluationStatus=${input.runtimeRigControl.evaluationStatus}`);
  }

  if (input.runtimeRigControl.unsupportedReason !== undefined) {
    evidence.push(`runtimeUnsupportedReason=${input.runtimeRigControl.unsupportedReason}`);
  }

  if (input.runtimeRigControl.bounds === undefined) {
    evidence.push("runtimeDomainBounds=missing");
  } else if (!sameRect(input.entry.rigControl.domainBounds, input.runtimeRigControl.bounds)) {
    evidence.push(`expectedDomainBounds=${formatRect(input.entry.rigControl.domainBounds)}`);
    evidence.push(`runtimeDomainBounds=${formatRect(input.runtimeRigControl.bounds)}`);
  }

  if (!sameStringList(input.entry.rigControl.childDrawableIds, input.runtimeRigControl.childDrawableIds)) {
    evidence.push(`expectedChildDrawableIds=${formatIdList(input.entry.rigControl.childDrawableIds)}`);
    evidence.push(`runtimeChildDrawableIds=${formatIdList(input.runtimeRigControl.childDrawableIds)}`);
  }

  if (!sameStringList(expectedAffectedDrawableIds, input.runtimeRigControl.affectedDrawableIds)) {
    evidence.push(`expectedAffectedDrawableIds=${formatIdList(expectedAffectedDrawableIds)}`);
    evidence.push(`runtimeAffectedDrawableIds=${formatIdList(input.runtimeRigControl.affectedDrawableIds)}`);
  }

  if (!sameStringList(expectedAffectedRigControlIds, input.runtimeRigControl.affectedRigControlIds)) {
    evidence.push(`expectedAffectedRigControlIds=${formatIdList(expectedAffectedRigControlIds)}`);
    evidence.push(`runtimeAffectedRigControlIds=${formatIdList(input.runtimeRigControl.affectedRigControlIds)}`);
  }

  const runtimeDrawableIds = new Set(input.runtimeSnapshot.drawables.map((drawable) => drawable.drawableId));
  const missingDrawableEvidenceIds = input.runtimeRigControl.affectedDrawableIds.filter(
    (drawableId) => !runtimeDrawableIds.has(drawableId)
  );
  if (missingDrawableEvidenceIds.length > 0) {
    evidence.push(`runtimeAffectedDrawableEvidenceMissing=${formatIdList(missingDrawableEvidenceIds)}`);
  }

  return evidence;
};

const createWarpRuntimeKeyformPatchMismatchEvidence = (input: {
  readonly entry: WarpLatticeEntry;
  readonly runtimeSnapshot: RuntimeSnapshotDto;
  readonly keyforms: readonly KeyformSetDto[];
}): readonly string[] => {
  const evidence: string[] = [];
  const expectedControlPointCount = getExpectedControlPointCount(input.entry.rigControl);

  for (const keyform of input.keyforms) {
    const sample = input.runtimeSnapshot.keyformSamples.find(
      (candidate) => candidate.keyformSetId === keyform.keyformSetId
    );
    if (sample === undefined) {
      continue;
    }

    const patchEvidence = createControlPointOffsetPatchEvidence(
      readUnknownProperty(sample, "statePatch"),
      expectedControlPointCount
    );
    if (patchEvidence.length === 0) {
      continue;
    }

    evidence.push(`keyformSetId=${keyform.keyformSetId}`);
    evidence.push(...patchEvidence.map((item) => `runtime${capitalizeEvidenceKey(item)}`));
  }

  return evidence;
};

const createControlPointOffsetPatchEvidence = (
  statePatch: unknown,
  expectedControlPointCount: number
): readonly string[] => {
  if (!Array.isArray(statePatch)) {
    return [
      "statePatchShape=malformed",
      "expectedStatePatch=Vec2[]",
      `expectedControlPointOffsetCount=${expectedControlPointCount}`,
      `actualStatePatchType=${getValueType(statePatch)}`
    ];
  }

  if (!statePatch.every(isVec2)) {
    return [
      "statePatchShape=malformed",
      "expectedStatePatch=Vec2[]",
      `expectedControlPointOffsetCount=${expectedControlPointCount}`,
      "actualStatePatchElement=nonVec2"
    ];
  }

  if (statePatch.length !== expectedControlPointCount) {
    return [
      "statePatchShape=malformed",
      "expectedStatePatch=Vec2[]",
      `expectedControlPointOffsetCount=${expectedControlPointCount}`,
      `actualControlPointOffsetCount=${statePatch.length}`
    ];
  }

  return [];
};

const createWarpLatticeKeyformsByRigControlId = (
  packageDocument: PackageDocumentDto
): ReadonlyMap<string, readonly KeyformSetDto[]> => {
  const keyformsByRigControlId = new Map<string, KeyformSetDto[]>();

  for (const keyformSet of packageDocument.model.keyforms.keyformSets) {
    if (keyformSet.target.kind !== "rigControl" || keyformSet.target.property !== "controlPointOffsets") {
      continue;
    }

    keyformsByRigControlId.set(keyformSet.target.id, [
      ...(keyformsByRigControlId.get(keyformSet.target.id) ?? []),
      keyformSet
    ]);
  }

  return new Map(
    [...keyformsByRigControlId.entries()].map(([rigControlId, keyforms]) => [
      rigControlId,
      [...keyforms].sort(compareKeyformSets)
    ])
  );
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

const createMalformedPatchCheck = (input: {
  readonly entry: WarpLatticeEntry;
  readonly keyformSet: KeyformSetDto;
  readonly keyformSetIndex: number;
  readonly keyIndex: number | undefined;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createWarpLatticeCheck({
    checkId: "rigControl.warpLatticeMalformedPatch",
    phase: "rigControl_semantic",
    target: {
      kind: "keyformSet",
      id: input.keyformSet.keyformSetId,
      path: input.keyIndex === undefined
        ? `/model/keyforms/keyformSets/${input.keyformSetIndex}`
        : keyformStatePatchPath(input.keyformSetIndex, input.keyIndex)
    },
    targetPath: input.keyIndex === undefined
      ? `/model/keyforms/keyformSets/${input.keyformSetIndex}`
      : keyformStatePatchPath(input.keyformSetIndex, input.keyIndex),
    message: `warpLattice2d keyform ${input.keyformSet.keyformSetId} has a malformed controlPointOffsets patch.`,
    evidence: [
      `keyformSetId=${input.keyformSet.keyformSetId}`,
      `rigControlId=${input.entry.rigControl.rigControlId}`,
      "targetProperty=controlPointOffsets",
      ...input.evidence
    ],
    impact: "The warp lattice evaluator cannot deterministically apply a controlPointOffsets keyform unless every key stores one Vec2 offset per rest control point."
  });

const createWarpLatticeRuntimeMismatchCheck = (input: {
  readonly entry: WarpLatticeEntry;
  readonly runtimeSnapshotId: RuntimeSnapshotId;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createWarpLatticeCheck({
    checkId: "rigControl.warpLatticeRuntimeEvidenceMismatch",
    phase: "rigControl_evaluation",
    target: createRigControlTarget(input.entry),
    targetPath: rigControlBasePath(input.entry.index),
    message: `Runtime snapshot ${input.runtimeSnapshotId} has mismatched warpLattice2d evidence for ${input.entry.rigControl.rigControlId}.`,
    evidence: input.evidence,
    impact: "Validator cannot prove project-defined warp lattice evaluation when runtime evidence disagrees with the package lattice shape, domain, affected drawables, or keyform patch evidence.",
    snapshotIds: [input.runtimeSnapshotId]
  });

const createWarpLatticeCheck = (input: {
  readonly checkId:
    | "rigControl.warpLatticeCardinalityMismatch"
    | "rigControl.warpLatticeDomainBoundsInvalid"
    | "rigControl.warpLatticeRestControlPointMismatch"
    | "rigControl.warpLatticeUnsupportedProperty"
    | "rigControl.warpLatticeMalformedPatch"
    | "rigControl.warpLatticeRuntimeEvidenceMismatch"
    | "rigControl.warpDeformerInvalidDivisions"
    | "rigControl.warpDeformerTransformGridMismatch"
    | "rigControl.warpDeformerBezierSurfaceCardinalityMismatch";
  readonly phase: "rigControl_semantic" | "rigControl_evaluation";
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds?: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: "error",
    phase: input.phase,
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-DEF-001", "SC-MVP-002"],
    impact: input.impact,
    snapshotIds: input.snapshotIds ?? []
  });

const isWarpLatticeEntry = (entry: RigControlEntry): entry is WarpLatticeEntry =>
  entry.rigControl.kind === "warpLattice2d";

const createRigControlTarget = (
  entry: WarpLatticeEntry,
  field?: string
): TargetRefDto => ({
  kind: "rigControl",
  id: entry.rigControl.rigControlId,
  path: field === undefined ? rigControlBasePath(entry.index) : `${rigControlBasePath(entry.index)}/${field}`
});

const getExpectedControlPointCount = (rigControl: WarpLatticeRigControl): number =>
  rigControl.latticeColumns * rigControl.latticeRows;

const isSupportedWarpCompositionMode = (compositionMode: string): boolean =>
  compositionMode === "replace" || compositionMode === "additiveDelta";

const collectAffectedDrawableIds = (
  entry: WarpLatticeEntry,
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
  entry: WarpLatticeEntry,
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

const isPointInsideRect = (point: Vec2Dto, rect: RectDto): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const isVec2 = (value: unknown): value is Vec2Dto => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y);
};

const readUnknownProperty = (value: unknown, property: string): unknown =>
  isRecord(value) ? value[property] : undefined;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const sameRect = (left: RectDto, right: RectDto): boolean =>
  sameFiniteNumber(left.x, right.x) &&
  sameFiniteNumber(left.y, right.y) &&
  sameFiniteNumber(left.width, right.width) &&
  sameFiniteNumber(left.height, right.height);

const sameFiniteNumber = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9;

const sameStringList = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(sortStringList(left)) === JSON.stringify(sortStringList(right));

const sortStringList = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const formatIdList = (ids: readonly string[]): string =>
  ids.length === 0 ? "none" : sortStringList(ids).join(",");

const formatRect = (rect: RectDto): string =>
  `x=${formatNumber(rect.x)},y=${formatNumber(rect.y)},width=${formatNumber(rect.width)},height=${formatNumber(rect.height)}`;

const formatNumber = (value: number): string =>
  Number(value.toFixed(12)).toString();

const getValueType = (value: unknown): string =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;

const capitalizeEvidenceKey = (item: string): string => {
  const [key, ...rest] = item.split("=");
  const evidenceKey = key ?? "";
  const value = rest.length === 0 ? "" : `=${rest.join("=")}`;
  return `${evidenceKey.charAt(0).toUpperCase()}${evidenceKey.slice(1)}${value}`;
};

const compareKeyformSets = (left: KeyformSetDto, right: KeyformSetDto): number =>
  left.compositionOrder - right.compositionOrder ||
  left.keyformSetId.localeCompare(right.keyformSetId);

const rigControlBasePath = (index: number): string =>
  `/model/rigControls/rigControls/${index}`;

const keyformTargetPropertyPath = (keyformSetIndex: number): string =>
  `/model/keyforms/keyformSets/${keyformSetIndex}/target/property`;

const keyformStatePatchPath = (keyformSetIndex: number, keyIndex: number): string =>
  `/model/keyforms/keyformSets/${keyformSetIndex}/keys/${keyIndex}/statePatch`;
