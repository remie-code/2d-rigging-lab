import type { MeshDensityHint } from "./mesh-generation-contract.js";
import type {
  V6ContourDensityParameters,
  V6ContourPixelBounds
} from "./mesh-generation-v6-contour-pipeline.js";
import type { MeshGenerationV6AdaptiveDensityDiagnostics } from "./mesh-quality-metrics.js";

export interface V6DAdaptiveDensityResolution {
  readonly parameters: V6ContourDensityParameters;
  readonly diagnostics: MeshGenerationV6AdaptiveDensityDiagnostics;
}

const ADAPTIVE_DENSITY_BASELINES: Record<MeshDensityHint, V6ContourDensityParameters> = {
  high: {
    boundarySpacing: 8,
    interiorSpacing: 7.5,
    maxBoundaryVertices: 128,
    maxInteriorVertices: 64,
    interiorBoundaryClearance: 1.1
  },
  medium: {
    boundarySpacing: 12,
    interiorSpacing: 10,
    maxBoundaryVertices: 128,
    maxInteriorVertices: 32,
    interiorBoundaryClearance: 1.1
  },
  low: {
    boundarySpacing: 30,
    interiorSpacing: 15,
    maxBoundaryVertices: 64,
    maxInteriorVertices: 16,
    interiorBoundaryClearance: 1.5
  }
};

const REFERENCE_COMPONENT_AREA = 73_936;
const REFERENCE_ALPHA_BOUNDS_AREA = 400 * 288;
const POINT_KEY_SCALE = 1_000_000;

export const resolveV6DAdaptiveDensity = (input: {
  readonly densityHint: MeshDensityHint;
  readonly selectedComponentPixelCount?: number;
  readonly alphaBounds?: V6ContourPixelBounds;
}): V6DAdaptiveDensityResolution => {
  const base = ADAPTIVE_DENSITY_BASELINES[input.densityHint];
  const componentArea = input.selectedComponentPixelCount ?? 0;
  const alphaBoundsArea =
    input.alphaBounds === undefined
      ? 0
      : Math.max(0, input.alphaBounds.right - input.alphaBounds.left) *
        Math.max(0, input.alphaBounds.bottom - input.alphaBounds.top);
  const usesComponentArea = componentArea > 0;
  const effectiveArea = Math.max(1, usesComponentArea ? componentArea : alphaBoundsArea);
  const referenceArea = usesComponentArea ? REFERENCE_COMPONENT_AREA : REFERENCE_ALPHA_BOUNDS_AREA;
  const areaRatio = effectiveArea / referenceArea;
  const clampedAreaRatio = clamp(areaRatio, 0.2, 4.0);
  const spacingScale = clamp(Math.pow(1 / Math.sqrt(clampedAreaRatio), 0.35), 0.82, 1.25);
  const vertexScale = clamp(Math.pow(clampedAreaRatio, 0.75), 0.45, 2.5);
  const boundaryCapScale = clamp(Math.sqrt(clampedAreaRatio), 0.7, 2.0);
  const parameters = {
    boundarySpacing: roundMetric(base.boundarySpacing * spacingScale),
    interiorSpacing: roundMetric(base.interiorSpacing * spacingScale),
    maxBoundaryVertices: clampInt(
      Math.round(base.maxBoundaryVertices * boundaryCapScale),
      Math.max(8, Math.round(base.maxBoundaryVertices * 0.7)),
      Math.max(8, Math.round(base.maxBoundaryVertices * 2.0))
    ),
    maxInteriorVertices: clampInt(
      Math.round(base.maxInteriorVertices * vertexScale),
      Math.max(4, Math.round(base.maxInteriorVertices * 0.45)),
      Math.max(4, Math.round(base.maxInteriorVertices * 2.5))
    ),
    interiorBoundaryClearance: base.interiorBoundaryClearance
  } satisfies V6ContourDensityParameters;

  return {
    parameters,
    diagnostics: {
      adaptiveDensityReferenceArea: referenceArea,
      adaptiveDensityEffectiveArea: effectiveArea,
      adaptiveDensityAreaRatio: roundMetric(areaRatio),
      adaptiveDensityClampedAreaRatio: roundMetric(clampedAreaRatio),
      adaptiveDensitySpacingScale: roundMetric(spacingScale),
      adaptiveDensityVertexScale: roundMetric(vertexScale),
      adaptiveDensityBoundaryCapScale: roundMetric(boundaryCapScale),
      resolvedBoundarySpacing: parameters.boundarySpacing,
      resolvedInteriorSpacing: parameters.interiorSpacing,
      resolvedMaxBoundaryVertices: parameters.maxBoundaryVertices,
      resolvedMaxInteriorVertices: parameters.maxInteriorVertices,
      resolvedInteriorBoundaryClearance: parameters.interiorBoundaryClearance
    }
  };
};

export const resolveV6DAdaptiveDensityForTest = (input: {
  readonly densityHint: MeshDensityHint;
  readonly selectedComponentPixelCount?: number;
  readonly alphaBoundsArea?: number;
}): V6DAdaptiveDensityResolution => {
  const alphaBounds =
    input.alphaBoundsArea === undefined
      ? undefined
      : {
          left: 0,
          top: 0,
          right: input.alphaBoundsArea,
          bottom: 1
        };
  return resolveV6DAdaptiveDensity({
    densityHint: input.densityHint,
    ...(input.selectedComponentPixelCount === undefined
      ? {}
      : { selectedComponentPixelCount: input.selectedComponentPixelCount }),
    ...(alphaBounds === undefined ? {} : { alphaBounds })
  });
};

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
