import type {
  DiagnosticDto,
  RectDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import type { NormalizedWarpLattice2dRigControl } from "./normalized-runtime-graph.js";
import { normalizeTransformNumber } from "./rig-control-transform.js";

export interface WarpLattice2dLocalState {
  readonly controlPointOffsets: readonly Vec2Dto[];
}

export type WarpLattice2dEvaluation =
  | {
      readonly evaluationStatus: "evaluated" | "disabled";
      readonly localState: WarpLattice2dLocalState;
    }
  | {
      readonly evaluationStatus: "blocked";
      readonly localState: WarpLattice2dLocalState;
    }
  | {
      readonly evaluationStatus: "unsupported";
      readonly localState: WarpLattice2dLocalState;
      readonly unsupportedReason: string;
    };

export const evaluateWarpLattice2dState = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly samples: readonly RuntimeKeyformSample[];
  readonly diagnostics: DiagnosticDto[];
}): WarpLattice2dEvaluation => {
  const config = validateWarpLattice2dConfig(input.rigControl);
  const zeroState = {
    controlPointOffsets: createZeroOffsets(input.rigControl.restControlPoints.length)
  };

  if (!config.ok) {
    input.diagnostics.push(
      createWarpLatticeDiagnostic({
        rigControl: input.rigControl,
        checkId: "rigControl.warpLatticeInvalidConfig",
        severity: "blocking",
        message: `warpLattice2d rig control ${input.rigControl.rigControlId} has invalid lattice configuration.`,
        evidence: config.evidence
      })
    );
    return {
      evaluationStatus: "blocked",
      localState: zeroState
    };
  }

  if (!input.rigControl.enabled) {
    return {
      evaluationStatus: "disabled",
      localState: zeroState
    };
  }

  let localState = zeroState;
  for (const sample of input.samples) {
    const applied = applyWarpLattice2dSample({
      rigControl: input.rigControl,
      localState,
      sample,
      expectedControlPointCount: config.expectedControlPointCount
    });

    if ("diagnostic" in applied) {
      input.diagnostics.push(applied.diagnostic);
      if (applied.evaluationStatus === "unsupported") {
        return {
          evaluationStatus: "unsupported",
          localState,
          unsupportedReason: applied.unsupportedReason
        };
      }

      return {
        evaluationStatus: "blocked",
        localState
      };
    }

    localState = applied.localState;
  }

  return {
    evaluationStatus: "evaluated",
    localState
  };
};

export const applyWarpLattice2dToVertices = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly localState: WarpLattice2dLocalState;
  readonly vertices: readonly Vec2Dto[];
}): Vec2Dto[] =>
  input.vertices.map((vertex) =>
    isPointInsideRect(vertex, input.rigControl.domainBounds)
      ? applyWarpLattice2dToVertex({
          rigControl: input.rigControl,
          localState: input.localState,
          vertex
        })
      : cloneVec2(vertex)
  );

const applyWarpLattice2dSample = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly localState: WarpLattice2dLocalState;
  readonly sample: RuntimeKeyformSample;
  readonly expectedControlPointCount: number;
}):
  | { readonly localState: WarpLattice2dLocalState }
  | {
      readonly evaluationStatus: "blocked";
      readonly diagnostic: DiagnosticDto;
    }
  | {
      readonly evaluationStatus: "unsupported";
      readonly diagnostic: DiagnosticDto;
      readonly unsupportedReason: string;
    } => {
  if (input.sample.targetMetadata.targetProperty !== "controlPointOffsets") {
    return {
      evaluationStatus: "unsupported",
      unsupportedReason: "warpLattice2dUnsupportedTargetProperty",
      diagnostic: createWarpLatticePatchDiagnostic({
        rigControl: input.rigControl,
        sample: input.sample,
        checkId: "rigControl.unsupportedTargetProperty",
        severity: "warning",
        evidence: [`targetProperty=${input.sample.targetMetadata.targetProperty}`]
      })
    };
  }

  const parsed = parseControlPointOffsets(input.sample.statePatch, input.expectedControlPointCount);
  if (!parsed.ok) {
    return {
      evaluationStatus: "blocked",
      diagnostic: createWarpLatticePatchDiagnostic({
        rigControl: input.rigControl,
        sample: input.sample,
        checkId: "rigControl.invalidPatchShape",
        severity: "blocking",
        evidence: parsed.evidence
      })
    };
  }

  if (input.sample.compositionMode === "replace") {
    return {
      localState: {
        controlPointOffsets: parsed.value
      }
    };
  }

  if (input.sample.compositionMode === "additiveDelta") {
    return {
      localState: {
        controlPointOffsets: input.localState.controlPointOffsets.map((offset, index) => {
          const patch = parsed.value[index] ?? { x: 0, y: 0 };
          return {
            x: normalizeTransformNumber(offset.x + patch.x),
            y: normalizeTransformNumber(offset.y + patch.y)
          };
        })
      }
    };
  }

  return {
    evaluationStatus: "blocked",
    diagnostic: createWarpLatticePatchDiagnostic({
      rigControl: input.rigControl,
      sample: input.sample,
      checkId: "rigControl.unsupportedCompositionMode",
      severity: "blocking",
      evidence: [
        `compositionMode=${input.sample.compositionMode}`,
        "allowedCompositionModes=replace,additiveDelta"
      ]
    })
  };
};

const applyWarpLattice2dToVertex = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly localState: WarpLattice2dLocalState;
  readonly vertex: Vec2Dto;
}): Vec2Dto => {
  const { domainBounds, latticeColumns, latticeRows } = input.rigControl;
  const normalizedX = (input.vertex.x - domainBounds.x) / domainBounds.width;
  const normalizedY = (input.vertex.y - domainBounds.y) / domainBounds.height;
  const gridX = clamp(normalizedX, 0, 1) * (latticeColumns - 1);
  const gridY = clamp(normalizedY, 0, 1) * (latticeRows - 1);
  const column = Math.min(Math.floor(gridX), latticeColumns - 2);
  const row = Math.min(Math.floor(gridY), latticeRows - 2);
  const tx = gridX - column;
  const ty = gridY - row;
  const lowerLeft = getOffset(input.localState, input.rigControl, column, row);
  const lowerRight = getOffset(input.localState, input.rigControl, column + 1, row);
  const upperLeft = getOffset(input.localState, input.rigControl, column, row + 1);
  const upperRight = getOffset(input.localState, input.rigControl, column + 1, row + 1);
  const lower = interpolateVec2(lowerLeft, lowerRight, tx);
  const upper = interpolateVec2(upperLeft, upperRight, tx);
  const displacement = interpolateVec2(lower, upper, ty);

  return {
    x: normalizeTransformNumber(input.vertex.x + displacement.x),
    y: normalizeTransformNumber(input.vertex.y + displacement.y)
  };
};

const validateWarpLattice2dConfig = (
  rigControl: NormalizedWarpLattice2dRigControl
):
  | { readonly ok: true; readonly expectedControlPointCount: number }
  | { readonly ok: false; readonly evidence: readonly string[] } => {
  const evidence: string[] = [];
  const hasValidColumns = Number.isInteger(rigControl.latticeColumns) && rigControl.latticeColumns >= 2;
  const hasValidRows = Number.isInteger(rigControl.latticeRows) && rigControl.latticeRows >= 2;
  const expectedControlPointCount = hasValidColumns && hasValidRows ? rigControl.latticeColumns * rigControl.latticeRows : 0;

  if (!hasValidColumns) {
    evidence.push(`latticeColumns=${rigControl.latticeColumns}`);
  }
  if (!hasValidRows) {
    evidence.push(`latticeRows=${rigControl.latticeRows}`);
  }
  if (rigControl.interpolationMethod !== "bilinear-grid-v1") {
    evidence.push(`interpolationMethod=${rigControl.interpolationMethod}`);
  }
  if (!isFinitePositiveRect(rigControl.domainBounds)) {
    evidence.push(
      `domainBounds=${rigControl.domainBounds.x},${rigControl.domainBounds.y},${rigControl.domainBounds.width},${rigControl.domainBounds.height}`
    );
  }
  if (hasValidColumns && hasValidRows && rigControl.restControlPoints.length !== expectedControlPointCount) {
    evidence.push(
      `restControlPoints.length=${rigControl.restControlPoints.length}`,
      `expectedRestControlPoints=${expectedControlPointCount}`
    );
  }
  const firstInvalidRestPointIndex = rigControl.restControlPoints.findIndex((point) => !isFiniteVec2(point));
  if (firstInvalidRestPointIndex >= 0) {
    evidence.push(`restControlPoints[${firstInvalidRestPointIndex}]=nonFinite`);
  }

  return evidence.length === 0
    ? { ok: true, expectedControlPointCount }
    : { ok: false, evidence };
};

const parseControlPointOffsets = (
  value: unknown,
  expectedControlPointCount: number
):
  | { readonly ok: true; readonly value: readonly Vec2Dto[] }
  | { readonly ok: false; readonly evidence: readonly string[] } => {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      evidence: ["expected=Vec2[]", `expectedLength=${expectedControlPointCount}`]
    };
  }

  const firstInvalidOffsetIndex = value.findIndex((candidate) => !isFiniteVec2(candidate));
  if (firstInvalidOffsetIndex >= 0) {
    return {
      ok: false,
      evidence: [
        "expected=Vec2[]",
        `expectedLength=${expectedControlPointCount}`,
        `controlPointOffsets[${firstInvalidOffsetIndex}]=nonFinite`
      ]
    };
  }

  if (value.length !== expectedControlPointCount) {
    return {
      ok: false,
      evidence: [
        "expected=Vec2[]",
        `actualLength=${value.length}`,
        `expectedLength=${expectedControlPointCount}`
      ]
    };
  }

  return {
    ok: true,
    value: value.map((offset) => ({
      x: normalizeTransformNumber(offset.x),
      y: normalizeTransformNumber(offset.y)
    }))
  };
};

const getOffset = (
  localState: WarpLattice2dLocalState,
  rigControl: NormalizedWarpLattice2dRigControl,
  column: number,
  row: number
): Vec2Dto => localState.controlPointOffsets[row * rigControl.latticeColumns + column] ?? { x: 0, y: 0 };

const createWarpLatticePatchDiagnostic = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly sample: RuntimeKeyformSample;
  readonly checkId: string;
  readonly severity: "warning" | "blocking";
  readonly evidence: readonly string[];
}): DiagnosticDto =>
  createWarpLatticeDiagnostic({
    rigControl: input.rigControl,
    checkId: input.checkId,
    severity: input.severity,
    message: `warpLattice2d rig control keyform patch could not be applied for ${input.rigControl.rigControlId}.`,
    evidence: [
      `keyformSetId=${input.sample.keyformSetId}`,
      `targetProperty=${input.sample.targetMetadata.targetProperty}`,
      `compositionMode=${input.sample.compositionMode}`,
      ...input.evidence
    ]
  });

const createWarpLatticeDiagnostic = (input: {
  readonly rigControl: NormalizedWarpLattice2dRigControl;
  readonly checkId: string;
  readonly severity: "warning" | "blocking";
  readonly message: string;
  readonly evidence: readonly string[];
}): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: input.checkId,
    severity: input.severity,
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: input.rigControl.rigControlId },
    message: input.message,
    evidence: input.evidence
  });

const isPointInsideRect = (point: Vec2Dto, rect: RectDto): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const isFinitePositiveRect = (rect: RectDto): boolean =>
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  Number.isFinite(rect.width) &&
  Number.isFinite(rect.height) &&
  rect.width > 0 &&
  rect.height > 0;

const isFiniteVec2 = (value: unknown): value is Vec2Dto =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "x" in value &&
  "y" in value &&
  typeof value.x === "number" &&
  Number.isFinite(value.x) &&
  typeof value.y === "number" &&
  Number.isFinite(value.y);

const createZeroOffsets = (count: number): readonly Vec2Dto[] =>
  Array.from({ length: count }, () => ({ x: 0, y: 0 }));

const interpolateVec2 = (left: Vec2Dto, right: Vec2Dto, t: number): Vec2Dto => ({
  x: normalizeTransformNumber(left.x + (right.x - left.x) * t),
  y: normalizeTransformNumber(left.y + (right.y - left.y) * t)
});

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: normalizeTransformNumber(value.x),
  y: normalizeTransformNumber(value.y)
});

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
