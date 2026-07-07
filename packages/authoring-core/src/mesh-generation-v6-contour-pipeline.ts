import type { RectDto } from "@private-2d-rigging-lab/contracts";

import type { MeshDensityHint } from "./mesh-generation-contract.js";
import {
  createSoftAlphaMask,
  expandMask,
  resolveMaskExpansionPixels
} from "./mesh-geometry/alpha-mask.js";
import { sampleBoundaryLoop } from "./mesh-geometry/boundary-resampling.js";
import { selectOuterLoop, traceBoundaryLoops } from "./mesh-geometry/boundary-tracing.js";
import {
  countHoleLikeRegions,
  createComponentMask,
  findOpaqueComponents,
  selectMainComponent
} from "./mesh-geometry/connected-components.js";
import {
  clamp,
  type GeometryPoint,
  type PixelBounds,
  roundCoordinate
} from "./mesh-geometry/geometry-primitives.js";
import { sampleInteriorSteinerPoints } from "./mesh-geometry/interior-point-sampling.js";

export interface V6ContourPipelineInput {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly rgbaBytes: Uint8Array;
  readonly densityHint?: MeshDensityHint;
  readonly densityParameters?: V6ContourDensityParameters;
  readonly alphaThreshold?: number;
  readonly maskExpansionPixels?: number;
}

export type V6ContourPoint = GeometryPoint;

export type V6ContourPixelBounds = PixelBounds;

export type V6ContourConstraintEdge = readonly [number, number];

export type V6ContourPipelineBlockedReason =
  | "alpha-empty"
  | "v6-contour-extraction-failed";

export interface V6ContourAlphaBounds {
  readonly pixelBounds: V6ContourPixelBounds;
  readonly stageBounds: RectDto;
}

export interface V6ContourPipelineDiagnostics {
  readonly inputOpaquePixelCount: number;
  readonly softMaskOpaquePixelCount: number;
  readonly componentCount: number;
  readonly selectedComponentPixelCount: number;
  readonly contourLoopCount: number;
  readonly holeLikeRegionCount: number;
  readonly boundaryPointCount: number;
  readonly constraintEdgeCount: number;
  readonly interiorPointCount: number;
  readonly boundarySpacing: number;
  readonly interiorSpacing: number;
  readonly multiIslandHandling: "main-island-only" | "supported";
  readonly holeHandling: "unsupported-fallback" | "supported";
  readonly provenance: readonly string[];
}

export interface V6ContourCandidateInput {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly alphaBounds: V6ContourAlphaBounds;
  readonly mainMask: readonly boolean[];
  readonly boundaryLoop: readonly V6ContourPoint[];
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly constraintEdges: readonly V6ContourConstraintEdge[];
  readonly interiorPoints: readonly V6ContourPoint[];
  readonly diagnostics: V6ContourPipelineDiagnostics;
}

export type V6ContourPipelineResult =
  | {
      readonly status: "generated";
      readonly candidateInput: V6ContourCandidateInput;
    }
  | {
      readonly status: "blocked";
      readonly reason: V6ContourPipelineBlockedReason;
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: V6ContourAlphaBounds;
      readonly diagnostics?: Partial<V6ContourPipelineDiagnostics>;
    };

export interface V6ContourDensityParameters {
  readonly boundarySpacing: number;
  readonly interiorSpacing: number;
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
  readonly interiorBoundaryClearance: number;
}

const DEFAULT_ALPHA_THRESHOLD = 8;

export const createV6ContourCandidateInput = (
  input: V6ContourPipelineInput
): V6ContourPipelineResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "blocked", reason: "v6-contour-extraction-failed" };
  }

  const softMask = createSoftAlphaMask(
    input.rgbaBytes,
    width,
    height,
    input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD
  );
  if (softMask.inputOpaquePixelCount === 0) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: 0,
      diagnostics: {
        inputOpaquePixelCount: 0,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount
      }
    };
  }

  const components = findOpaqueComponents(softMask.mask, width, height);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: 0
      }
    };
  }

  const componentMask = createComponentMask(mainComponent, width, height);
  const maskExpansionPixels = resolveMaskExpansionPixels(input.maskExpansionPixels);
  const mainMask =
    maskExpansionPixels <= 0
      ? componentMask
      : expandMask(componentMask, width, height, maskExpansionPixels);
  const boundaryLoops = traceBoundaryLoops(mainMask, width, height);
  const outerLoop = selectOuterLoop(boundaryLoops);
  const alphaBounds = {
    pixelBounds: mainComponent.bounds,
    stageBounds: pixelBoundsToStageRect(mainComponent.bounds, input.meshBounds, width, height)
  };
  if (outerLoop === undefined || outerLoop.length < 3) {
    return {
      status: "blocked",
      reason: "v6-contour-extraction-failed",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBounds,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: components.length,
        selectedComponentPixelCount: mainComponent.pixelIndices.length,
        contourLoopCount: boundaryLoops.length
      }
    };
  }

  const density = input.densityHint ?? "medium";
  const densityParameters = input.densityParameters ?? getDensityParameters(density);
  const boundaryPoints = sampleBoundaryLoop(outerLoop, densityParameters);
  const constraintEdges = createConstraintEdges(boundaryPoints);
  if (boundaryPoints.length < 3 || constraintEdges.length < 3) {
    return {
      status: "blocked",
      reason: "v6-contour-extraction-failed",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBounds,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: components.length,
        selectedComponentPixelCount: mainComponent.pixelIndices.length,
        contourLoopCount: boundaryLoops.length,
        boundaryPointCount: boundaryPoints.length,
        constraintEdgeCount: constraintEdges.length
      }
    };
  }

  const interiorPoints = sampleInteriorSteinerPoints({
    mainMask,
    width,
    component: mainComponent,
    boundaryPoints,
    parameters: densityParameters
  });
  const holeLikeRegionCount = countHoleLikeRegions(mainMask, width, height, mainComponent.bounds);
  const diagnostics: V6ContourPipelineDiagnostics = {
    inputOpaquePixelCount: softMask.inputOpaquePixelCount,
    softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
    componentCount: components.length,
    selectedComponentPixelCount: mainComponent.pixelIndices.length,
    contourLoopCount: boundaryLoops.length,
    holeLikeRegionCount,
    boundaryPointCount: boundaryPoints.length,
    constraintEdgeCount: constraintEdges.length,
    interiorPointCount: interiorPoints.length,
    boundarySpacing: densityParameters.boundarySpacing,
    interiorSpacing: densityParameters.interiorSpacing,
    multiIslandHandling: components.length > 1 ? "main-island-only" : "supported",
    holeHandling: holeLikeRegionCount > 0 ? "unsupported-fallback" : "supported",
    provenance: createV6ContourPipelineProvenance({
      componentCount: components.length,
      holeLikeRegionCount
    })
  };

  return {
    status: "generated",
    candidateInput: {
      textureSize: { width, height },
      meshBounds: structuredClone(input.meshBounds),
      alphaBounds,
      mainMask,
      boundaryLoop: outerLoop,
      boundaryPoints,
      constraintEdges,
      interiorPoints,
      diagnostics
    }
  };
};

export const mapV6ContourPointToStagePoint = (
  point: V6ContourPoint,
  bounds: RectDto,
  textureWidth: number,
  textureHeight: number
): V6ContourPoint => ({
  x: roundCoordinate(bounds.x + bounds.width * (point.x / textureWidth)),
  y: roundCoordinate(bounds.y + bounds.height * (point.y / textureHeight))
});

export const mapV6ContourPointToUv = (
  point: V6ContourPoint,
  textureWidth: number,
  textureHeight: number
): V6ContourPoint => ({
  x: roundCoordinate(clamp(point.x / textureWidth, 0, 1)),
  y: roundCoordinate(clamp(point.y / textureHeight, 0, 1))
});

const createConstraintEdges = (
  boundaryPoints: readonly V6ContourPoint[]
): readonly V6ContourConstraintEdge[] => {
  if (boundaryPoints.length < 3) {
    return [];
  }

  return boundaryPoints.map((_point, index) => [index, (index + 1) % boundaryPoints.length] as const);
};

const getDensityParameters = (densityHint: MeshDensityHint): V6ContourDensityParameters => {
  switch (densityHint) {
    case "high":
      return {
        boundarySpacing: 10,
        interiorSpacing: 7.5,
        maxBoundaryVertices: 96,
        maxInteriorVertices: 64,
        interiorBoundaryClearance: 1.1
      };
    case "medium":
      return {
        boundarySpacing: 15,
        interiorSpacing: 10,
        maxBoundaryVertices: 96,
        maxInteriorVertices: 32,
        interiorBoundaryClearance: 1.1
      };
    case "low":
      return {
        boundarySpacing: 30,
        interiorSpacing: 15,
        maxBoundaryVertices: 64,
        maxInteriorVertices: 16,
        interiorBoundaryClearance: 1.5
      };
  }
};

const createV6ContourPipelineProvenance = (input: {
  readonly componentCount: number;
  readonly holeLikeRegionCount: number;
}): readonly string[] => [
  "v6-contour-soft-alpha-mask",
  "v6-contour-main-component-selection",
  "v6-contour-boundary-loop-trace",
  "v6-contour-outer-loop-selection",
  "v6-contour-boundary-sampling",
  "v6-contour-constraint-edge-contract",
  "v6-contour-farthest-interior-steiner-sampling",
  ...(input.componentCount > 1 ? ["limitation-main-island-only"] : []),
  ...(input.holeLikeRegionCount > 0 ? ["limitation-hole-regions-reported"] : [])
];

const pixelBoundsToStageRect = (
  pixelBounds: V6ContourPixelBounds,
  textureBounds: RectDto,
  textureWidth: number,
  textureHeight: number
): RectDto => ({
  x: roundCoordinate(textureBounds.x + textureBounds.width * (pixelBounds.left / textureWidth)),
  y: roundCoordinate(textureBounds.y + textureBounds.height * (pixelBounds.top / textureHeight)),
  width: roundCoordinate(textureBounds.width * ((pixelBounds.right - pixelBounds.left) / textureWidth)),
  height: roundCoordinate(textureBounds.height * ((pixelBounds.bottom - pixelBounds.top) / textureHeight))
});
