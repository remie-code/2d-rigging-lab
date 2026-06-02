import {
  DrawableIdSchema,
  RectDtoSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  DrawableId,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import { computeBoundsFromVertices, createStableVertexHash } from "./drawable-geometry.js";
import type {
  NormalizedRigControlNode,
  NormalizedRotation2dRigControl,
  NormalizedRuntimeGraph,
  NormalizedWarpLattice2dRigControl
} from "./normalized-runtime-graph.js";
import type { EvaluatedDrawableDto } from "./snapshot.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import { applyRotation2dSamples } from "./rig-control-keyform-state.js";
import {
  createAffectedDrawableIds,
  createRigControlHierarchyEvaluation,
  sortDrawableIds,
  sortRigControlIds
} from "./rig-control-hierarchy.js";
import {
  applyAffine2dToVertices,
  composeAffine2d,
  createRotation2dTransformState,
  identityAffine2d,
  Rotation2dTransformStateSchema
} from "./rig-control-transform.js";
import type {
  Affine2dMatrixDto,
  Rotation2dTransformStateDto
} from "./rig-control-transform.js";
import {
  applyWarpLattice2dToVertices,
  evaluateWarpLattice2dState
} from "./rig-control-warp-lattice.js";
import type { WarpLattice2dLocalState } from "./rig-control-warp-lattice.js";

export const EvaluatedRigControlSchema = z.object({
  rigControlId: RigControlIdSchema,
  kind: z.enum(["rotation2d", "warpLattice2d"]),
  enabled: z.boolean(),
  parentId: RigControlIdSchema.optional(),
  hierarchyIndex: z.number().int().nonnegative(),
  evaluationStatus: z.enum(["evaluated", "disabled", "unsupported", "blocked"]),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  affectedDrawableIds: z.array(DrawableIdSchema).default([]),
  affectedRigControlIds: z.array(RigControlIdSchema).default([]),
  bounds: RectDtoSchema.optional(),
  localTransform: Rotation2dTransformStateSchema.optional(),
  worldTransform: Rotation2dTransformStateSchema.optional(),
  unsupportedReason: z.string().optional()
});
export type EvaluatedRigControlDto = z.infer<typeof EvaluatedRigControlSchema>;

export interface RigControlEvaluationResult {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly rigControls: readonly EvaluatedRigControlDto[];
  readonly diagnostics: readonly DiagnosticDto[];
}

interface EvaluatedRigControlInternal {
  readonly dto: EvaluatedRigControlDto;
  readonly worldMatrix: Affine2dMatrixDto;
  readonly warpLatticeState?: WarpLattice2dLocalState;
}

interface RigControlEffect {
  readonly rigControl: NormalizedRigControlNode;
  readonly evaluated: EvaluatedRigControlInternal;
}

export const evaluateRigControlHierarchy = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hashPrecisionDecimals: number;
}): RigControlEvaluationResult => {
  const diagnostics: DiagnosticDto[] = [];
  const patchesByRigControlId = groupRigControlSamples(input.samples);
  const hierarchy = createRigControlHierarchyEvaluation(input.graph);
  diagnostics.push(...hierarchy.diagnostics);
  const orderedRigControlIds = hierarchy.orderedRigControlIds;
  const evaluatedById = new Map<RigControlId, EvaluatedRigControlInternal>();

  for (const [hierarchyIndex, rigControlId] of orderedRigControlIds.entries()) {
    const rigControl = input.graph.rigControls.get(rigControlId);
    if (rigControl === undefined) {
      continue;
    }

    const parentWorldMatrix =
      rigControl.parentId === undefined
        ? identityAffine2d()
        : evaluatedById.get(rigControl.parentId)?.worldMatrix ?? identityAffine2d();
    const descendantRigControlIds = hierarchy.descendantRigControlIdsById.get(rigControl.rigControlId) ?? [];
    const affectedDrawableIds = createAffectedDrawableIds(
      rigControl,
      hierarchy.descendantRigControlIdsById,
      hierarchy.declaredChildDrawableIdsById
    );
    const blockedReasons = hierarchy.blockedRigControlIds.get(rigControl.rigControlId) ?? [];
    const evaluated =
      blockedReasons.length > 0
        ? evaluateBlockedRigControlNode({
            rigControl,
            descendantRigControlIds,
            affectedDrawableIds,
            hierarchyIndex
          })
        : evaluateRigControlNode({
            rigControl,
            parentWorldMatrix,
            descendantRigControlIds,
            affectedDrawableIds,
            samples: patchesByRigControlId.get(rigControl.rigControlId) ?? [],
            hierarchyIndex,
            diagnostics
          });
    evaluatedById.set(rigControl.rigControlId, evaluated);
  }

  const transformedDrawables = applyRigControlTransformsToDrawables({
    drawables: input.drawables,
    graph: input.graph,
    orderedRigControlIds,
    evaluatedById,
    hashPrecisionDecimals: input.hashPrecisionDecimals,
    diagnostics
  });

  return {
    drawables: transformedDrawables,
    rigControls: orderedRigControlIds
      .map((rigControlId) => evaluatedById.get(rigControlId)?.dto)
      .filter((rigControl): rigControl is EvaluatedRigControlDto => rigControl !== undefined),
    diagnostics
  };
};

const groupRigControlSamples = (
  samples: readonly RuntimeKeyformSample[]
): ReadonlyMap<RigControlId, readonly RuntimeKeyformSample[]> => {
  const grouped = new Map<RigControlId, RuntimeKeyformSample[]>();

  for (const sample of samples) {
    if (sample.targetMetadata.targetKind !== "rigControl") {
      continue;
    }

    const rigControlId = RigControlIdSchema.parse(sample.targetMetadata.targetId);
    grouped.set(rigControlId, [...(grouped.get(rigControlId) ?? []), sample]);
  }

  return new Map(
    [...grouped.entries()].map(([rigControlId, rigControlSamples]) => [
      rigControlId,
      [...rigControlSamples].sort(
        (left, right) =>
          left.compositionOrder - right.compositionOrder ||
          left.keyformSetId.localeCompare(right.keyformSetId) ||
          left.targetMetadata.targetProperty.localeCompare(right.targetMetadata.targetProperty)
      )
    ])
  );
};

const evaluateRigControlNode = (input: {
  readonly rigControl: NormalizedRigControlNode;
  readonly parentWorldMatrix: Affine2dMatrixDto;
  readonly descendantRigControlIds: readonly RigControlId[];
  readonly affectedDrawableIds: readonly DrawableId[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hierarchyIndex: number;
  readonly diagnostics: DiagnosticDto[];
}): EvaluatedRigControlInternal => {
  const { rigControl } = input;
  if (rigControl.kind === "warpLattice2d") {
    return evaluateWarpLatticeRigControl({
      ...input,
      rigControl
    });
  }

  return evaluateRotation2dRigControl({
    ...input,
    rigControl
  });
};

const evaluateBlockedRigControlNode = (input: {
  readonly rigControl: NormalizedRigControlNode;
  readonly descendantRigControlIds: readonly RigControlId[];
  readonly affectedDrawableIds: readonly DrawableId[];
  readonly hierarchyIndex: number;
}): EvaluatedRigControlInternal => ({
  worldMatrix: identityAffine2d(),
  dto: EvaluatedRigControlSchema.parse({
    rigControlId: input.rigControl.rigControlId,
    kind: input.rigControl.kind,
    enabled: input.rigControl.enabled,
    ...(input.rigControl.parentId === undefined ? {} : { parentId: input.rigControl.parentId }),
    hierarchyIndex: input.hierarchyIndex,
    evaluationStatus: "blocked",
    childDrawableIds: sortDrawableIds(input.rigControl.childDrawableIds),
    childRigControlIds: sortRigControlIds(input.rigControl.childRigControlIds),
    affectedDrawableIds: input.affectedDrawableIds,
    affectedRigControlIds: input.descendantRigControlIds,
    ...(input.rigControl.kind === "warpLattice2d" ? { bounds: input.rigControl.domainBounds } : {})
  })
});

const evaluateRotation2dRigControl = (input: {
  readonly rigControl: NormalizedRotation2dRigControl;
  readonly parentWorldMatrix: Affine2dMatrixDto;
  readonly descendantRigControlIds: readonly RigControlId[];
  readonly affectedDrawableIds: readonly DrawableId[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hierarchyIndex: number;
  readonly diagnostics: DiagnosticDto[];
}): EvaluatedRigControlInternal => {
  const localState = applyRotation2dSamples({
    rigControl: input.rigControl,
    samples: input.samples,
    diagnostics: input.diagnostics
  });
  const localTransform = createRotation2dTransformState(localState);
  const worldMatrix = input.rigControl.enabled
    ? composeAffine2d(input.parentWorldMatrix, localTransform.matrix)
    : input.parentWorldMatrix;
  const worldTransform = Rotation2dTransformStateSchema.parse({
    pivot: localTransform.pivot,
    angleDegrees: input.rigControl.enabled ? extractRotationDegrees(worldMatrix) : 0,
    translation: {
      x: worldMatrix.e,
      y: worldMatrix.f
    },
    scale: extractScale(worldMatrix),
    matrix: worldMatrix
  });

  return {
    worldMatrix,
    dto: EvaluatedRigControlSchema.parse({
      rigControlId: input.rigControl.rigControlId,
      kind: input.rigControl.kind,
      enabled: input.rigControl.enabled,
      ...(input.rigControl.parentId === undefined ? {} : { parentId: input.rigControl.parentId }),
      hierarchyIndex: input.hierarchyIndex,
      evaluationStatus: input.rigControl.enabled ? "evaluated" : "disabled",
      childDrawableIds: sortDrawableIds(input.rigControl.childDrawableIds),
      childRigControlIds: sortRigControlIds(input.rigControl.childRigControlIds),
      affectedDrawableIds: input.affectedDrawableIds,
      affectedRigControlIds: input.descendantRigControlIds,
      localTransform,
      worldTransform
    })
  };
};

const evaluateWarpLatticeRigControl = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly parentWorldMatrix: Affine2dMatrixDto;
  readonly descendantRigControlIds: readonly RigControlId[];
  readonly affectedDrawableIds: readonly DrawableId[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hierarchyIndex: number;
  readonly diagnostics: DiagnosticDto[];
}): EvaluatedRigControlInternal => {
  const latticeEvaluation = evaluateWarpLattice2dState({
    rigControl: input.rigControl,
    samples: input.samples,
    diagnostics: input.diagnostics
  });

  return {
    worldMatrix: input.parentWorldMatrix,
    warpLatticeState: latticeEvaluation.localState,
    dto: EvaluatedRigControlSchema.parse({
      rigControlId: input.rigControl.rigControlId,
      kind: input.rigControl.kind,
      enabled: input.rigControl.enabled,
      ...(input.rigControl.parentId === undefined ? {} : { parentId: input.rigControl.parentId }),
      hierarchyIndex: input.hierarchyIndex,
      evaluationStatus: latticeEvaluation.evaluationStatus,
      childDrawableIds: sortDrawableIds(input.rigControl.childDrawableIds),
      childRigControlIds: sortRigControlIds(input.rigControl.childRigControlIds),
      affectedDrawableIds: input.affectedDrawableIds,
      affectedRigControlIds: input.descendantRigControlIds,
      bounds: input.rigControl.domainBounds,
      ...(latticeEvaluation.evaluationStatus === "unsupported"
        ? { unsupportedReason: latticeEvaluation.unsupportedReason }
        : {})
    })
  };
};

const applyRigControlTransformsToDrawables = (input: {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly graph: NormalizedRuntimeGraph;
  readonly orderedRigControlIds: readonly RigControlId[];
  readonly evaluatedById: ReadonlyMap<RigControlId, EvaluatedRigControlInternal>;
  readonly hashPrecisionDecimals: number;
  readonly diagnostics: DiagnosticDto[];
}): readonly EvaluatedDrawableDto[] => {
  const directRigControlByDrawableId = new Map<DrawableId, RigControlEffect>();

  for (const rigControlId of input.orderedRigControlIds) {
    const rigControl = input.graph.rigControls.get(rigControlId);
    const evaluated = input.evaluatedById.get(rigControlId);
    if (rigControl === undefined || evaluated === undefined) {
      continue;
    }
    if (evaluated.dto.evaluationStatus === "blocked") {
      continue;
    }

    for (const drawableId of sortDrawableIds(rigControl.childDrawableIds)) {
      if (!input.drawables.some((drawable) => drawable.drawableId === drawableId)) {
        input.diagnostics.push(createMissingDrawableDiagnostic(drawableId, rigControlId));
        continue;
      }

      if (directRigControlByDrawableId.has(drawableId)) {
        input.diagnostics.push(createDuplicateDrawableParentDiagnostic(drawableId, rigControlId));
        continue;
      }

      directRigControlByDrawableId.set(drawableId, { rigControl, evaluated });
    }
  }

  return input.drawables.map((drawable) => {
    const directRigControl = directRigControlByDrawableId.get(drawable.drawableId);
    if (directRigControl === undefined || drawable.vertices === undefined) {
      return drawable;
    }

    const transformedVertices = applyRigControlEffectChainToVertices({
      vertices: drawable.vertices,
      effects: createRigControlEffectChain({
        graph: input.graph,
        directRigControl,
        evaluatedById: input.evaluatedById
      })
    });
    return {
      ...drawable,
      vertices: transformedVertices,
      bounds: computeBoundsFromVertices(transformedVertices),
      vertexHash: createStableVertexHash(transformedVertices, {
        hashPrecisionDecimals: input.hashPrecisionDecimals
      })
    };
  });
};

const createRigControlEffectChain = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly directRigControl: RigControlEffect;
  readonly evaluatedById: ReadonlyMap<RigControlId, EvaluatedRigControlInternal>;
}): readonly RigControlEffect[] => {
  const effects: RigControlEffect[] = [];
  const visited = new Set<RigControlId>();
  let currentRigControl: NormalizedRigControlNode | undefined = input.directRigControl.rigControl;

  while (currentRigControl !== undefined && !visited.has(currentRigControl.rigControlId)) {
    visited.add(currentRigControl.rigControlId);
    const evaluated =
      currentRigControl.rigControlId === input.directRigControl.rigControl.rigControlId
        ? input.directRigControl.evaluated
        : input.evaluatedById.get(currentRigControl.rigControlId);
    if (evaluated === undefined) {
      break;
    }

    effects.push({ rigControl: currentRigControl, evaluated });
    currentRigControl =
      currentRigControl.parentId === undefined ? undefined : input.graph.rigControls.get(currentRigControl.parentId);
  }

  return effects;
};

const applyRigControlEffectChainToVertices = (input: {
  readonly vertices: readonly Vec2Dto[];
  readonly effects: readonly RigControlEffect[];
}): Vec2Dto[] =>
  input.effects.reduce<Vec2Dto[]>((vertices, effect) => applyRigControlEffectToVertices(effect, vertices), [
    ...input.vertices
  ]);

const applyRigControlEffectToVertices = (
  effect: RigControlEffect,
  vertices: readonly Vec2Dto[]
): Vec2Dto[] => {
  if (effect.rigControl.kind === "rotation2d") {
    const localMatrix = effect.evaluated.dto.localTransform?.matrix;
    return effect.evaluated.dto.evaluationStatus === "evaluated" && localMatrix !== undefined
      ? applyAffine2dToVertices(localMatrix, vertices)
      : [...vertices];
  }

  return effect.evaluated.dto.evaluationStatus === "evaluated" && effect.evaluated.warpLatticeState !== undefined
    ? applyWarpLattice2dToVertices({
        rigControl: effect.rigControl,
        localState: effect.evaluated.warpLatticeState,
        vertices
      })
    : [...vertices];
};

const createMissingDrawableDiagnostic = (
  drawableId: DrawableId,
  rigControlId: RigControlId
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.childDrawableMissing",
    severity: "blocking",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControlId },
    message: `Rig control references missing drawable child ${drawableId}.`,
    evidence: [`drawableId=${drawableId}`]
  });

const createDuplicateDrawableParentDiagnostic = (
  drawableId: DrawableId,
  rigControlId: RigControlId
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.drawableMultipleParents",
    severity: "warning",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControlId },
    message: `Drawable ${drawableId} is referenced by more than one rig control; first parent wins deterministically.`,
    evidence: [`drawableId=${drawableId}`]
  });

const extractRotationDegrees = (matrix: Affine2dMatrixDto): number => {
  const radians = Math.atan2(matrix.b, matrix.a);
  return Number(((radians * 180) / Math.PI).toFixed(12));
};

const extractScale = (matrix: Affine2dMatrixDto): Vec2Dto => ({
  x: Number(Math.hypot(matrix.a, matrix.b).toFixed(12)),
  y: Number(Math.hypot(matrix.c, matrix.d).toFixed(12))
});
