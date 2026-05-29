import type { DiagnosticDto, DrawableId, TargetRefDto, Vec2Dto } from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import { computeBoundsFromVertices, createStableVertexHash } from "./drawable-geometry.js";
import type { EvaluatedDrawableDto } from "./snapshot.js";

export interface SampledKeyformTargetPatch {
  readonly keyformSetId: string;
  readonly targetKind?: string;
  readonly targetId?: string;
  readonly targetProperty?: string;
  readonly target?: string;
  readonly targetMetadata?: {
    readonly targetKind: string;
    readonly targetId: string;
    readonly targetProperty: string;
  };
  readonly compositionMode: string;
  readonly compositionOrder: number;
  readonly statePatch?: unknown;
  readonly patch?: unknown;
}

interface ResolvedSampledKeyformTargetPatch {
  readonly keyformSetId: string;
  readonly targetKind: string;
  readonly targetId: string;
  readonly targetProperty: string;
  readonly compositionMode: string;
  readonly compositionOrder: number;
  readonly statePatch?: unknown;
  readonly patch?: unknown;
}

export interface KeyformTargetApplicationResult {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly drawList: readonly DrawableId[];
  readonly diagnostics: readonly DiagnosticDto[];
}

export const applyKeyformTargetPatches = (input: {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly patches: readonly SampledKeyformTargetPatch[];
  readonly hashPrecisionDecimals?: number;
}): KeyformTargetApplicationResult => {
  const diagnostics: DiagnosticDto[] = [];
  const drawablesById = new Map<DrawableId, EvaluatedDrawableDto>(
    input.drawables.map((drawable) => [
      drawable.drawableId,
      {
        ...drawable,
        ...(drawable.vertices === undefined ? {} : { vertices: cloneVertices(drawable.vertices) }),
        diagnostics: [...drawable.diagnostics]
      }
    ])
  );

  for (const sampledPatch of sortPatches(input.patches)) {
    const resolvedPatch = resolvePatchTarget(sampledPatch);

    if (resolvedPatch.status === "invalid") {
      diagnostics.push(
        createUnresolvedPatchDiagnostic(sampledPatch, "keyformTarget.invalidPatchShape", "error", "keyform_target_application", [
          "targetKind, targetId, and targetProperty are required either directly or under targetMetadata."
        ])
      );
      continue;
    }
    const patch = resolvedPatch.patch;

    if (!Number.isFinite(patch.compositionOrder)) {
      diagnostics.push(createPatchDiagnostic(patch, "keyformTarget.invalidPatchShape", "error", "keyform_target_application", [
        "compositionOrder must be finite."
      ]));
      continue;
    }

    if (patch.targetKind === "mesh") {
      applyMeshPatch({
        patch,
        drawablesById,
        diagnostics,
        hashPrecisionDecimals: input.hashPrecisionDecimals
      });
      continue;
    }

    if (patch.targetKind === "drawable") {
      applyDrawablePatch({
        patch,
        drawablesById,
        diagnostics
      });
      continue;
    }

    diagnostics.push(
      createPatchDiagnostic(patch, "keyformTarget.unsupportedTargetKind", "warning", "keyform_target_application", [
        `targetKind=${patch.targetKind}`
      ])
    );
  }

  const drawables = sortDrawables([...drawablesById.values()]);

  return {
    drawables,
    drawList: drawables.filter((drawable) => drawable.visible).map((drawable) => drawable.drawableId),
    diagnostics
  };
};

const applyMeshPatch = (input: {
  readonly patch: ResolvedSampledKeyformTargetPatch;
  readonly drawablesById: Map<DrawableId, EvaluatedDrawableDto>;
  readonly diagnostics: DiagnosticDto[];
  readonly hashPrecisionDecimals: number | undefined;
}): void => {
  const { patch } = input;
  if (patch.targetProperty !== "vertices") {
    input.diagnostics.push(
      createPatchDiagnostic(patch, "keyformTarget.unsupportedTargetProperty", "warning", "mesh_evaluation", [
        `targetProperty=${patch.targetProperty}`
      ])
    );
    return;
  }

  const drawable = findDrawableByMeshId(input.drawablesById, patch.targetId);
  if (drawable === undefined) {
    input.diagnostics.push(createPatchDiagnostic(patch, "keyformTarget.missingTarget", "error", "mesh_evaluation"));
    return;
  }

  const patchValue = getPatchValue(patch);
  const parsedPatchVertices = parseVec2Array(patchValue);
  if (parsedPatchVertices.status === "missing") {
    input.diagnostics.push(
      createPatchDiagnostic(patch, "keyformTarget.invalidPatchShape", "error", "mesh_evaluation", [
        "Vertex patches require a Vec2 array."
      ])
    );
    return;
  }

  if (parsedPatchVertices.status === "invalid") {
    input.diagnostics.push(
      createPatchDiagnostic(patch, parsedPatchVertices.checkId, "error", "mesh_evaluation", parsedPatchVertices.evidence)
    );
    return;
  }

  if (patch.compositionMode === "replace") {
    input.drawablesById.set(
      drawable.drawableId,
      withUpdatedVertices(drawable, parsedPatchVertices.vertices, input.hashPrecisionDecimals)
    );
    return;
  }

  if (patch.compositionMode === "additiveDelta") {
    const baseVertices = parseVec2Array(drawable.vertices);
    if (baseVertices.status === "missing") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, "keyformTarget.missingBaseVertices", "error", "mesh_evaluation", [
          "additiveDelta requires existing drawable vertices."
        ])
      );
      return;
    }

    if (baseVertices.status === "invalid") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, baseVertices.checkId, "error", "mesh_evaluation", baseVertices.evidence)
      );
      return;
    }

    if (baseVertices.vertices.length !== parsedPatchVertices.vertices.length) {
      input.diagnostics.push(
        createPatchDiagnostic(patch, "keyformTarget.vertexLengthMismatch", "error", "mesh_evaluation", [
          `base=${baseVertices.vertices.length}`,
          `patch=${parsedPatchVertices.vertices.length}`
        ])
      );
      return;
    }

    const nextVertices = baseVertices.vertices.map((vertex, index) => {
      const delta = parsedPatchVertices.vertices[index] ?? { x: 0, y: 0 };
      return {
        x: vertex.x + delta.x,
        y: vertex.y + delta.y
      };
    });
    input.drawablesById.set(drawable.drawableId, withUpdatedVertices(drawable, nextVertices, input.hashPrecisionDecimals));
    return;
  }

  input.diagnostics.push(
    createPatchDiagnostic(patch, "keyformTarget.unsupportedCompositionMode", "warning", "mesh_evaluation", [
      `compositionMode=${patch.compositionMode}`,
      `targetProperty=${patch.targetProperty}`
    ])
  );
};

const applyDrawablePatch = (input: {
  readonly patch: ResolvedSampledKeyformTargetPatch;
  readonly drawablesById: Map<DrawableId, EvaluatedDrawableDto>;
  readonly diagnostics: DiagnosticDto[];
}): void => {
  const { patch } = input;
  const drawable = [...input.drawablesById.values()].find((candidate) => candidate.drawableId === patch.targetId);
  if (drawable === undefined) {
    input.diagnostics.push(createPatchDiagnostic(patch, "keyformTarget.missingTarget", "error", "keyform_target_application"));
    return;
  }

  if (isOpacityProperty(patch.targetProperty)) {
    const nextOpacity = applyNumericPatch(drawable.opacity, patch);
    if (nextOpacity.status === "invalid") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, nextOpacity.checkId, "error", "opacity_visibility", nextOpacity.evidence)
      );
      return;
    }

    input.drawablesById.set(drawable.drawableId, {
      ...drawable,
      opacity: clamp(nextOpacity.value, 0, 1)
    });
    return;
  }

  if (isVisibilityProperty(patch.targetProperty)) {
    if (patch.compositionMode !== "replace") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, "keyformTarget.unsupportedCompositionMode", "warning", "opacity_visibility", [
          `compositionMode=${patch.compositionMode}`,
          `targetProperty=${patch.targetProperty}`
        ])
      );
      return;
    }

    const patchValue = getPatchValue(patch);
    if (typeof patchValue !== "boolean") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, "keyformTarget.invalidPatchShape", "error", "opacity_visibility", [
          "Visibility patches require a boolean value."
        ])
      );
      return;
    }

    input.drawablesById.set(drawable.drawableId, {
      ...drawable,
      visible: patchValue
    });
    return;
  }

  if (isDrawOrderProperty(patch.targetProperty)) {
    const currentOrder =
      patch.targetProperty === "baseDrawOrder" ? drawable.baseDrawOrder : drawable.evaluatedDrawOrder;
    const nextOrder = applyNumericPatch(currentOrder, patch);
    if (nextOrder.status === "invalid") {
      input.diagnostics.push(
        createPatchDiagnostic(patch, nextOrder.checkId, "error", "draw_order_resolution", nextOrder.evidence)
      );
      return;
    }

    if (!Number.isInteger(nextOrder.value)) {
      input.diagnostics.push(
        createPatchDiagnostic(patch, "keyformTarget.nonIntegerDrawOrder", "error", "draw_order_resolution", [
          `value=${nextOrder.value}`
        ])
      );
      return;
    }

    input.drawablesById.set(drawable.drawableId, {
      ...drawable,
      ...(patch.targetProperty === "baseDrawOrder" ? { baseDrawOrder: nextOrder.value } : {}),
      evaluatedDrawOrder: nextOrder.value
    });
    return;
  }

  input.diagnostics.push(
    createPatchDiagnostic(patch, "keyformTarget.unsupportedTargetProperty", "warning", "keyform_target_application", [
      `targetProperty=${patch.targetProperty}`
    ])
  );
};

const withUpdatedVertices = (
  drawable: EvaluatedDrawableDto,
  vertices: readonly Vec2Dto[],
  hashPrecisionDecimals: number | undefined
): EvaluatedDrawableDto => ({
  ...drawable,
  vertices: cloneVertices(vertices),
  bounds: computeBoundsFromVertices(vertices),
  vertexCount: vertices.length,
  vertexHash: createStableVertexHash(
    vertices,
    hashPrecisionDecimals === undefined ? {} : { hashPrecisionDecimals }
  )
});

const applyNumericPatch = (
  currentValue: number,
  patch: ResolvedSampledKeyformTargetPatch
):
  | { readonly status: "valid"; readonly value: number }
  | { readonly status: "invalid"; readonly checkId: string; readonly evidence: readonly string[] } => {
  const patchValue = getPatchValue(patch);
  if (typeof patchValue !== "number") {
    return {
      status: "invalid",
      checkId: "keyformTarget.invalidPatchShape",
      evidence: ["Numeric target patches require a number value."]
    };
  }

  if (!Number.isFinite(patchValue)) {
    return {
      status: "invalid",
      checkId: "keyformTarget.nonFinitePatchValue",
      evidence: [`value=${String(patchValue)}`]
    };
  }

  if (patch.compositionMode === "replace") {
    return { status: "valid", value: patchValue };
  }

  if (patch.compositionMode === "additiveDelta") {
    return { status: "valid", value: currentValue + patchValue };
  }

  if (patch.compositionMode === "multiplyOpacity" && isOpacityProperty(patch.targetProperty)) {
    return { status: "valid", value: currentValue * patchValue };
  }

  return {
    status: "invalid",
    checkId: "keyformTarget.unsupportedCompositionMode",
    evidence: [`compositionMode=${patch.compositionMode}`, `targetProperty=${patch.targetProperty}`]
  };
};

const parseVec2Array = (
  value: unknown
):
  | { readonly status: "valid"; readonly vertices: readonly Vec2Dto[] }
  | { readonly status: "missing" }
  | { readonly status: "invalid"; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (value === undefined) {
    return { status: "missing" };
  }

  if (!Array.isArray(value)) {
    return {
      status: "invalid",
      checkId: "keyformTarget.invalidPatchShape",
      evidence: ["Vertex patches require a Vec2 array."]
    };
  }

  const vertices: Vec2Dto[] = [];
  for (const [index, candidate] of value.entries()) {
    if (!isVec2(candidate)) {
      return {
        status: "invalid",
        checkId: "keyformTarget.invalidPatchShape",
        evidence: [`vertexIndex=${index}`]
      };
    }

    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
      return {
        status: "invalid",
        checkId: "keyformTarget.nonFinitePatchValue",
        evidence: [`vertexIndex=${index}`]
      };
    }

    vertices.push({
      x: candidate.x,
      y: candidate.y
    });
  }

  return {
    status: "valid",
    vertices
  };
};

const findDrawableByMeshId = (
  drawablesById: ReadonlyMap<DrawableId, EvaluatedDrawableDto>,
  meshId: string
): EvaluatedDrawableDto | undefined =>
  [...drawablesById.values()]
    .filter((drawable) => drawable.meshId === meshId)
    .sort((left, right) => left.drawableId.localeCompare(right.drawableId))[0];

const getPatchValue = (patch: ResolvedSampledKeyformTargetPatch): unknown => {
  if (patch.statePatch !== undefined) {
    return unwrapPatchValue(patch.statePatch);
  }

  return unwrapPatchValue(patch.patch);
};

const unwrapPatchValue = (value: unknown): unknown => {
  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return (value as { readonly value: unknown }).value;
  }

  return value;
};

const isVec2 = (value: unknown): value is Vec2Dto =>
  typeof value === "object" &&
  value !== null &&
  "x" in value &&
  "y" in value &&
  typeof (value as { readonly x: unknown }).x === "number" &&
  typeof (value as { readonly y: unknown }).y === "number";

const isOpacityProperty = (targetProperty: string): boolean =>
  targetProperty === "opacity" || targetProperty === "defaultOpacity";

const isVisibilityProperty = (targetProperty: string): boolean =>
  targetProperty === "visible" || targetProperty === "visibility" || targetProperty === "runtimeVisibility";

const isDrawOrderProperty = (targetProperty: string): boolean =>
  targetProperty === "drawOrder" || targetProperty === "baseDrawOrder" || targetProperty === "evaluatedDrawOrder";

const resolvePatchTarget = (
  patch: SampledKeyformTargetPatch
):
  | { readonly status: "valid"; readonly patch: ResolvedSampledKeyformTargetPatch }
  | { readonly status: "invalid" } => {
  const targetKind = patch.targetKind ?? patch.targetMetadata?.targetKind;
  const targetId = patch.targetId ?? patch.targetMetadata?.targetId;
  const targetProperty = patch.targetProperty ?? patch.targetMetadata?.targetProperty;

  if (targetKind === undefined || targetId === undefined || targetProperty === undefined) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    patch: {
      keyformSetId: patch.keyformSetId,
      targetKind,
      targetId,
      targetProperty,
      compositionMode: patch.compositionMode,
      compositionOrder: patch.compositionOrder,
      ...(patch.statePatch === undefined ? {} : { statePatch: patch.statePatch }),
      ...(patch.patch === undefined ? {} : { patch: patch.patch })
    }
  };
};

const sortPatches = (patches: readonly SampledKeyformTargetPatch[]): readonly SampledKeyformTargetPatch[] =>
  [...patches].sort(
    (left, right) =>
      getSortOrder(left.compositionOrder) - getSortOrder(right.compositionOrder) ||
      left.keyformSetId.localeCompare(right.keyformSetId) ||
      getSortableTargetKind(left).localeCompare(getSortableTargetKind(right)) ||
      getSortableTargetId(left).localeCompare(getSortableTargetId(right)) ||
      getSortableTargetProperty(left).localeCompare(getSortableTargetProperty(right))
  );

const sortDrawables = (drawables: readonly EvaluatedDrawableDto[]): readonly EvaluatedDrawableDto[] =>
  [...drawables].sort(
    (left, right) => left.evaluatedDrawOrder - right.evaluatedDrawOrder || left.drawableId.localeCompare(right.drawableId)
  );

const getSortOrder = (value: number): number => (Number.isFinite(value) ? value : Number.POSITIVE_INFINITY);

const getSortableTargetKind = (patch: SampledKeyformTargetPatch): string =>
  patch.targetKind ?? patch.targetMetadata?.targetKind ?? "";

const getSortableTargetId = (patch: SampledKeyformTargetPatch): string =>
  patch.targetId ?? patch.targetMetadata?.targetId ?? "";

const getSortableTargetProperty = (patch: SampledKeyformTargetPatch): string =>
  patch.targetProperty ?? patch.targetMetadata?.targetProperty ?? "";

const createPatchDiagnostic = (
  patch: ResolvedSampledKeyformTargetPatch,
  checkId: string,
  severity: "warning" | "error",
  phase: string,
  evidence: readonly string[] = []
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId,
    severity,
    phase,
    target: createPatchTargetRef(patch),
    message: createPatchDiagnosticMessage(checkId, patch),
    evidence: [
      `keyformSetId=${patch.keyformSetId}`,
      `targetKind=${patch.targetKind}`,
      `targetId=${patch.targetId}`,
      `targetProperty=${patch.targetProperty}`,
      `compositionMode=${patch.compositionMode}`,
      ...evidence
    ]
  });

const createUnresolvedPatchDiagnostic = (
  patch: SampledKeyformTargetPatch,
  checkId: string,
  severity: "warning" | "error",
  phase: string,
  evidence: readonly string[] = []
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId,
    severity,
    phase,
    target: { kind: "keyformSet", id: patch.keyformSetId },
    message: "Keyform target patch shape is incompatible with the target property.",
    evidence: [
      `keyformSetId=${patch.keyformSetId}`,
      `targetKind=${patch.targetKind ?? patch.targetMetadata?.targetKind ?? "missing"}`,
      `targetId=${patch.targetId ?? patch.targetMetadata?.targetId ?? "missing"}`,
      `targetProperty=${patch.targetProperty ?? patch.targetMetadata?.targetProperty ?? "missing"}`,
      `compositionMode=${patch.compositionMode}`,
      ...evidence
    ]
  });

const createPatchTargetRef = (patch: ResolvedSampledKeyformTargetPatch): TargetRefDto => {
  if (patch.targetKind === "mesh" || patch.targetKind === "drawable" || patch.targetKind === "rigControl") {
    return {
      kind: patch.targetKind,
      id: patch.targetId
    };
  }

  return {
    kind: "keyformSet",
    id: patch.keyformSetId
  };
};

const createPatchDiagnosticMessage = (checkId: string, patch: ResolvedSampledKeyformTargetPatch): string => {
  switch (checkId) {
    case "keyformTarget.unsupportedTargetKind":
      return `Unsupported keyform target kind: ${patch.targetKind}.`;
    case "keyformTarget.unsupportedTargetProperty":
      return `Unsupported keyform target property: ${patch.targetProperty}.`;
    case "keyformTarget.unsupportedCompositionMode":
      return `Unsupported keyform composition mode ${patch.compositionMode} for ${patch.targetProperty}.`;
    case "keyformTarget.missingTarget":
      return `Keyform target was not found: ${patch.targetId}.`;
    case "keyformTarget.nonFinitePatchValue":
      return "Keyform target patch contains a non-finite value.";
    case "keyformTarget.vertexLengthMismatch":
      return "Keyform mesh additiveDelta patch length does not match existing vertices.";
    case "keyformTarget.missingBaseVertices":
      return "Keyform mesh additiveDelta patch cannot apply without existing vertices.";
    case "keyformTarget.nonIntegerDrawOrder":
      return "Keyform draw order patch must produce an integer draw order.";
    default:
      return "Keyform target patch shape is incompatible with the target property.";
  }
};

const cloneVertices = (vertices: readonly Vec2Dto[]): Vec2Dto[] => vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
