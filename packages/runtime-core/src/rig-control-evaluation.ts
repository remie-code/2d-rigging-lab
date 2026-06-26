import {
  DrawableIdSchema,
  RectDtoSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  DrawableId,
  RectDto,
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
import type { RuntimeDrawableEvaluationBase } from "./runtime-drawable-evaluation.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import { applyRigControlOpacityMultiplierSamples } from "./rig-control-opacity-keyform-state.js";
import { applyRotation2dSamples } from "./rig-control-keyform-state.js";
import {
  createRigControlTopologyEvaluation,
  sortDrawableIds,
  sortRigControlIds,
  type RigControlDrawableParentCandidate,
  type RigControlTopologyEvaluation
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
import type { RuntimeCoreEvaluationProfiler } from "./runtime-profiling.js";

export const EvaluatedRigControlSchema = z.object({
  rigControlId: RigControlIdSchema,
  kind: z.enum(["rotation2d", "warpLattice2d"]),
  enabled: z.boolean(),
  parentId: RigControlIdSchema.optional(),
  hierarchyIndex: z.number().int().nonnegative(),
  evaluationStatus: z.enum(["evaluated", "disabled", "unsupported", "blocked"]),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().min(0).max(1).default(1),
  affectedDrawableIds: z.array(DrawableIdSchema).default([]),
  affectedRigControlIds: z.array(RigControlIdSchema).default([]),
  bounds: RectDtoSchema.optional(),
  localTransform: Rotation2dTransformStateSchema.optional(),
  worldTransform: Rotation2dTransformStateSchema.optional(),
  unsupportedReason: z.string().optional()
});
export type EvaluatedRigControlDto = z.infer<typeof EvaluatedRigControlSchema>;

export interface RigControlEvaluationResult<
  TDrawable extends RuntimeDrawableEvaluationBase = RuntimeDrawableEvaluationBase
> {
  readonly drawables: readonly TDrawable[];
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

export const evaluateRigControlHierarchy = <
  TDrawable extends RuntimeDrawableEvaluationBase
>(input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly drawables: readonly TDrawable[];
  readonly referenceVerticesByDrawableId: ReadonlyMap<DrawableId, readonly Vec2Dto[]>;
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hashPrecisionDecimals: number;
  readonly topology?: RigControlTopologyEvaluation;
  readonly profiling?: RuntimeCoreEvaluationProfiler;
  readonly includeRigControls?: boolean;
}): RigControlEvaluationResult<TDrawable> => {
  const diagnostics: DiagnosticDto[] = [];
  const patchesByRigControlId = groupRigControlSamples(input.samples);
  const topology = input.topology ?? createRigControlTopologyEvaluation(input.graph);
  const hierarchy = topology.hierarchy;
  diagnostics.push(...cloneDiagnostics(hierarchy.diagnostics));
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
    const affectedDrawableIds = topology.affectedDrawableIdsByRigControlId.get(rigControl.rigControlId) ?? [];
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
    referenceVerticesByDrawableId: input.referenceVerticesByDrawableId,
    topology,
    evaluatedById,
    hashPrecisionDecimals: input.hashPrecisionDecimals,
    diagnostics,
    ...(input.profiling === undefined ? {} : { profiling: input.profiling })
  });

  return {
    drawables: transformedDrawables,
    rigControls: input.includeRigControls === false
      ? []
      : orderedRigControlIds
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
    opacityMultiplier: input.rigControl.opacityMultiplier ?? 1,
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
  const opacityMultiplier = applyRigControlOpacityMultiplierSamples({
    rigControl: input.rigControl,
    baseOpacityMultiplier: input.rigControl.opacityMultiplier ?? 1,
    samples: input.samples.filter(isOpacityMultiplierSample),
    diagnostics: input.diagnostics
  });
  const localState = applyRotation2dSamples({
    rigControl: input.rigControl,
    samples: input.samples.filter((sample) => !isOpacityMultiplierSample(sample)),
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
      opacityMultiplier,
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
  const opacityMultiplier = applyRigControlOpacityMultiplierSamples({
    rigControl: input.rigControl,
    baseOpacityMultiplier: input.rigControl.opacityMultiplier ?? 1,
    samples: input.samples.filter(isOpacityMultiplierSample),
    diagnostics: input.diagnostics
  });
  const latticeEvaluation = evaluateWarpLattice2dState({
    rigControl: input.rigControl,
    samples: input.samples.filter((sample) => !isOpacityMultiplierSample(sample)),
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
      opacityMultiplier,
      affectedDrawableIds: input.affectedDrawableIds,
      affectedRigControlIds: input.descendantRigControlIds,
      bounds: input.rigControl.domainBounds,
      ...(latticeEvaluation.evaluationStatus === "unsupported"
        ? { unsupportedReason: latticeEvaluation.unsupportedReason }
        : {})
    })
  };
};

const applyRigControlTransformsToDrawables = <
  TDrawable extends RuntimeDrawableEvaluationBase
>(input: {
  readonly drawables: readonly TDrawable[];
  readonly graph: NormalizedRuntimeGraph;
  readonly referenceVerticesByDrawableId: ReadonlyMap<DrawableId, readonly Vec2Dto[]>;
  readonly topology: RigControlTopologyEvaluation;
  readonly evaluatedById: ReadonlyMap<RigControlId, EvaluatedRigControlInternal>;
  readonly hashPrecisionDecimals: number;
  readonly diagnostics: DiagnosticDto[];
  readonly profiling?: RuntimeCoreEvaluationProfiler;
}): readonly TDrawable[] => {
  const directRigControlByDrawableId = createDirectRigControlByDrawableId({
    graph: input.graph,
    candidates: input.topology.directDrawableParentCandidates,
    evaluatedById: input.evaluatedById,
    diagnostics: input.diagnostics
  });

  return input.drawables.map((drawable) => {
    const directRigControl = directRigControlByDrawableId.get(drawable.drawableId);
    if (directRigControl === undefined) {
      return drawable;
    }

    const effects = createRigControlEffectChain({
      graph: input.graph,
      directRigControl,
      evaluatedById: input.evaluatedById,
      effectChainRigControlIds:
        input.topology.effectChainRigControlIdsByRigControlId.get(directRigControl.rigControl.rigControlId) ?? []
    });
    const opacity = applyRigControlOpacityMultiplier(drawable.opacity, effects);
    if (drawable.vertices === undefined) {
      return {
        ...drawable,
        opacity
      };
    }
    const referenceVertices = input.referenceVerticesByDrawableId.get(drawable.drawableId);
    if (referenceVertices === undefined) {
      input.diagnostics.push(createMissingReferenceVerticesDiagnostic(drawable.drawableId, directRigControl.rigControl.rigControlId));
      return {
        ...drawable,
        opacity
      };
    }

    if (referenceVertices.length !== drawable.vertices.length) {
      input.diagnostics.push(
        createVertexStreamLengthMismatchDiagnostic({
          drawableId: drawable.drawableId,
          rigControlId: directRigControl.rigControl.rigControlId,
          currentVertexCount: drawable.vertices.length,
          referenceVertexCount: referenceVertices.length
        })
      );
      return {
        ...drawable,
        opacity
      };
    }

    const transformedVertices = applyRigControlEffectChainToVertices({
      currentVertices: drawable.vertices,
      referenceVertices,
      effects,
      ...(input.profiling === undefined ? {} : { profiling: input.profiling })
    });
    return withRigControlTransformedVertices({
      drawable,
      opacity,
      vertices: transformedVertices,
      hashPrecisionDecimals: input.hashPrecisionDecimals
    });
  });
};

const withRigControlTransformedVertices = <
  TDrawable extends RuntimeDrawableEvaluationBase
>(input: {
  readonly drawable: TDrawable;
  readonly opacity: number;
  readonly vertices: readonly Vec2Dto[];
  readonly hashPrecisionDecimals: number;
}): TDrawable => {
  const nextDrawable = {
    ...input.drawable,
    opacity: input.opacity,
    vertices: input.vertices
  };

  if (!hasPublicGeometryFields(input.drawable)) {
    return nextDrawable as TDrawable;
  }

  return {
    ...nextDrawable,
    bounds: computeBoundsFromVertices(input.vertices),
    vertexHash: createStableVertexHash(input.vertices, {
      hashPrecisionDecimals: input.hashPrecisionDecimals
    })
  } as TDrawable;
};

interface RuntimeDrawableWithPublicGeometry {
  readonly bounds: RectDto;
  readonly vertexHash: string;
}

const hasPublicGeometryFields = (
  drawable: RuntimeDrawableEvaluationBase
): drawable is RuntimeDrawableEvaluationBase & RuntimeDrawableWithPublicGeometry =>
  typeof (drawable as { readonly bounds?: unknown }).bounds === "object" &&
  typeof (drawable as { readonly vertexHash?: unknown }).vertexHash === "string";

const applyRigControlOpacityMultiplier = (
  opacity: number,
  effects: readonly RigControlEffect[]
): number =>
  clamp(
    effects.reduce((currentOpacity, effect) => {
      if (!effect.rigControl.enabled || effect.evaluated.dto.evaluationStatus === "blocked") {
        return currentOpacity;
      }

      return currentOpacity * effect.evaluated.dto.opacityMultiplier;
    }, opacity),
    0,
    1
  );

const isOpacityMultiplierSample = (sample: RuntimeKeyformSample): boolean =>
  sample.targetMetadata.targetProperty === "opacityMultiplier";

const createDirectRigControlByDrawableId = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly candidates: readonly RigControlDrawableParentCandidate[];
  readonly evaluatedById: ReadonlyMap<RigControlId, EvaluatedRigControlInternal>;
  readonly diagnostics: DiagnosticDto[];
}): ReadonlyMap<DrawableId, RigControlEffect> => {
  const directRigControlByDrawableId = new Map<DrawableId, RigControlEffect>();

  for (const candidate of input.candidates) {
    const rigControl = input.graph.rigControls.get(candidate.rigControlId);
    const evaluated = input.evaluatedById.get(candidate.rigControlId);
    if (rigControl === undefined || evaluated === undefined) {
      continue;
    }
    if (evaluated.dto.evaluationStatus === "blocked") {
      continue;
    }

    if (!candidate.drawableExists) {
      input.diagnostics.push(createMissingDrawableDiagnostic(candidate.drawableId, candidate.rigControlId));
      continue;
    }

    if (directRigControlByDrawableId.has(candidate.drawableId)) {
      input.diagnostics.push(createDuplicateDrawableParentDiagnostic(candidate.drawableId, candidate.rigControlId));
      continue;
    }

    directRigControlByDrawableId.set(candidate.drawableId, { rigControl, evaluated });
  }

  return directRigControlByDrawableId;
};

const createRigControlEffectChain = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly directRigControl: RigControlEffect;
  readonly evaluatedById: ReadonlyMap<RigControlId, EvaluatedRigControlInternal>;
  readonly effectChainRigControlIds: readonly RigControlId[];
}): readonly RigControlEffect[] => {
  const effects: RigControlEffect[] = [];

  for (const rigControlId of input.effectChainRigControlIds) {
    const currentRigControl = input.graph.rigControls.get(rigControlId);
    if (currentRigControl === undefined) {
      break;
    }

    const evaluated =
      currentRigControl.rigControlId === input.directRigControl.rigControl.rigControlId
        ? input.directRigControl.evaluated
        : input.evaluatedById.get(currentRigControl.rigControlId);
    if (evaluated === undefined) {
      break;
    }

    effects.push({ rigControl: currentRigControl, evaluated });
  }

  return effects;
};

const applyRigControlEffectChainToVertices = (input: {
  readonly currentVertices: readonly Vec2Dto[];
  readonly referenceVertices: readonly Vec2Dto[];
  readonly effects: readonly RigControlEffect[];
  readonly profiling?: RuntimeCoreEvaluationProfiler;
}): Vec2Dto[] =>
  input.effects.reduce<RigControlVertexStreams>(
    (streams, effect) => applyRigControlEffectToVertices({
      effect,
      streams,
      ...(input.profiling === undefined ? {} : { profiling: input.profiling })
    }),
    {
      currentVertices: cloneVertices(input.currentVertices),
      referenceVertices: input.referenceVertices
    }
  ).currentVertices;

const applyRigControlEffectToVertices = (input: {
  readonly effect: RigControlEffect;
  readonly streams: RigControlVertexStreams;
  readonly profiling?: RuntimeCoreEvaluationProfiler;
}): RigControlVertexStreams => {
  if (input.effect.rigControl.kind === "rotation2d") {
    const localMatrix = input.effect.evaluated.dto.localTransform?.matrix;
    return {
      ...input.streams,
      currentVertices:
        input.effect.evaluated.dto.evaluationStatus === "evaluated" &&
          localMatrix !== undefined
          ? input.profiling?.measure(
              "rotationDeformerVertexTransformDurationMs",
              () => applyAffine2dToVertices(
                localMatrix,
                input.streams.currentVertices
              )
            ) ?? applyAffine2dToVertices(
              localMatrix,
              input.streams.currentVertices
            )
          : cloneVertices(input.streams.currentVertices)
    };
  }

  const warpRigControl = input.effect.rigControl;
  const warpLatticeState = input.effect.evaluated.warpLatticeState;

  return {
    ...input.streams,
    currentVertices:
      input.effect.evaluated.dto.evaluationStatus === "evaluated" &&
        warpLatticeState !== undefined
        ? input.profiling?.measure(
            "warpDeformerVertexTransformDurationMs",
            () => applyWarpLattice2dToVertices({
              rigControl: warpRigControl,
              localState: warpLatticeState,
              currentVertices: input.streams.currentVertices,
              referenceVertices: input.streams.referenceVertices
            })
          ) ?? applyWarpLattice2dToVertices({
            rigControl: warpRigControl,
            localState: warpLatticeState,
            currentVertices: input.streams.currentVertices,
            referenceVertices: input.streams.referenceVertices
          })
        : cloneVertices(input.streams.currentVertices)
  };
};

interface RigControlVertexStreams {
  readonly currentVertices: Vec2Dto[];
  readonly referenceVertices: readonly Vec2Dto[];
}

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

const createMissingReferenceVerticesDiagnostic = (
  drawableId: DrawableId,
  rigControlId: RigControlId
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.referenceVertexStreamMissing",
    severity: "error",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControlId },
    message: `Drawable ${drawableId} cannot be rig-evaluated because its reference vertex stream is missing.`,
    evidence: [`drawableId=${drawableId}`]
  });

const createVertexStreamLengthMismatchDiagnostic = (input: {
  readonly drawableId: DrawableId;
  readonly rigControlId: RigControlId;
  readonly currentVertexCount: number;
  readonly referenceVertexCount: number;
}): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.vertexStreamLengthMismatch",
    severity: "error",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: input.rigControlId },
    message: `Drawable ${input.drawableId} cannot be rig-evaluated because current and reference vertex streams differ in length.`,
    evidence: [
      `drawableId=${input.drawableId}`,
      `currentVertices=${input.currentVertexCount}`,
      `referenceVertices=${input.referenceVertexCount}`
    ]
  });

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const extractRotationDegrees = (matrix: Affine2dMatrixDto): number => {
  const radians = Math.atan2(matrix.b, matrix.a);
  return Number(((radians * 180) / Math.PI).toFixed(12));
};

const extractScale = (matrix: Affine2dMatrixDto): Vec2Dto => ({
  x: Number(Math.hypot(matrix.a, matrix.b).toFixed(12)),
  y: Number(Math.hypot(matrix.c, matrix.d).toFixed(12))
});

const cloneDiagnostics = (diagnostics: readonly DiagnosticDto[]): DiagnosticDto[] =>
  diagnostics.map((diagnostic) => ({
    ...diagnostic,
    target: { ...diagnostic.target },
    evidence: [...diagnostic.evidence],
    relatedAC: [...diagnostic.relatedAC],
    relatedScenarios: [...diagnostic.relatedScenarios],
    repairCandidateIds: [...diagnostic.repairCandidateIds]
  }));

const cloneVertices = (vertices: readonly Vec2Dto[]): Vec2Dto[] =>
  vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
