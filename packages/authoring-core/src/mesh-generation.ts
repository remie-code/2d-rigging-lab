import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";
import {
  getV6MeshGenerationCandidate,
  getV7MeshGenerationCandidate,
  isV6MeshGenerationMethod,
  isV7MeshGenerationMethod,
  type DrawableGeneratedMeshSource,
  type MeshDensityHint,
  type MeshGenerationFallbackReason,
  type MeshGenerationFallbackStep,
  type MeshGenerationMethod,
  type V6MeshGenerationCandidate
} from "./mesh-generation-contract.js";
import { createAutoOutlineV7MarginContourMesh } from "./mesh-generation-v7-margin-contour.js";
import { createAutoOutlineV6ALocalMesh } from "./mesh-generation-v6a-local.js";
import { createAutoOutlineV6BConstrainautorMesh } from "./mesh-generation-v6b-constrainautor.js";
import {
  createAutoOutlineV6CPoly2TriMesh,
  type AutoOutlineV6CPoly2TriFailureMetrics
} from "./mesh-generation-v6c-poly2tri.js";
import {
  createAutoOutlineV6EContourPoly2TriMesh,
  type AutoOutlineV6EContourPoly2TriFailureMetrics
} from "./mesh-generation-v6e-contour-poly2tri.js";
import { createAutoOutlineV6DContourConstrainautorMesh } from "./mesh-generation-v6d-contour-constrainautor.js";
import { createAutoOutlineV6DContourBandSupportRingsMesh } from "./mesh-generation-v6d-contour-band-support-rings.js";
import { createAutoOutlineV6DAdaptiveStaggeredBandMesh } from "./mesh-generation-v6d-adaptive-staggered-band.js";
import {
  createAutoOutlineV6DAdaptiveContourConstrainautorMesh
} from "./mesh-generation-v6d-adaptive-contour-constrainautor.js";
import {
  createAutoOutlineV6FCustomCdtMesh,
  type AutoOutlineV6FCustomCdtFailureMetrics
} from "./mesh-generation-v6f-custom-cdt.js";
import {
  createV6ContourCandidateInput,
  type V6ContourCandidateInput,
  type V6ContourPipelineResult
} from "./mesh-generation-v6-contour-pipeline.js";
import { createAutoOutlineMesh } from "./mesh-outline-generation.js";
import {
  createAutoOutlineV25SoftBoundaryMesh
} from "./mesh-outline-v2-5-soft-boundary-generation.js";
import {
  createAutoOutlineV26SoftApronMesh
} from "./mesh-outline-v2-6-soft-apron-generation.js";
import { createAutoOutlineV2Mesh } from "./mesh-outline-v2-generation.js";
import {
  createAutoOutlineV3EnvelopeMesh
} from "./mesh-outline-v3-envelope-generation.js";
import {
  createAutoOutlineV4ContourBandMesh
} from "./mesh-outline-v4-contour-band-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export type {
  DrawableGeneratedMeshSource,
  MeshDensityHint,
  MeshGenerationFallbackReason,
  MeshGenerationFallbackStep,
  MeshGenerationMethod
} from "./mesh-generation-contract.js";

export interface DrawableGeneratedMeshInput {
  readonly session: AuthoringSession;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly method: MeshGenerationMethod;
  readonly densityHint?: MeshDensityHint;
}

export interface DrawableGeneratedMeshResult {
  readonly mesh: MeshDto;
  readonly source: DrawableGeneratedMeshSource;
  readonly alphaBounds?: RectDto;
  readonly fallbackReason?: MeshGenerationFallbackReason;
  readonly fallbackSteps?: readonly MeshGenerationFallbackStep[];
  readonly qualityMetrics?: MeshGenerationQualityMetrics;
}

export interface AlphaAwareGridMeshInput {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly rgbaBytes: Uint8Array;
  readonly densityHint?: MeshDensityHint;
  readonly alphaThreshold?: number;
}

export const createGeneratedMesh = (input: {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly method: MeshGenerationMethod;
  readonly densityHint?: MeshDensityHint;
}): MeshDto => {
  if (input.method === "manual-empty") {
    return createManualEmptyMesh(input);
  }

  return createGridMesh(input);
};

export const createGeneratedMeshForDrawable = (
  input: DrawableGeneratedMeshInput
): DrawableGeneratedMeshResult | undefined => {
  const drawable = getDrawableById(input.session.graph, input.drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  const existingMesh = getMeshById(input.session.graph, drawable.meshId);
  if (existingMesh === undefined) {
    return undefined;
  }

  if (input.method === "manual-empty") {
    return {
      mesh: createManualEmptyMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId
      }),
      source: "bounds-grid"
    };
  }

  const textureBytes = resolveDrawableTextureBytes(input.session, drawable.textureId, existingMesh.bounds);

  if (isV7MeshGenerationMethod(input.method)) {
    return createV7MarginContourMeshResult({
      existingMesh,
      drawableId: drawable.drawableId,
      provenanceId: input.provenanceId,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
      ...(textureBytes === undefined ? {} : { textureBytes })
    });
  }

  if (isV6MeshGenerationMethod(input.method)) {
    if (input.method === "auto-outline-v6a-local") {
      return createV6ALocalMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6b-constrainautor") {
      return createV6BConstrainautorMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6c-poly2tri") {
      return createV6CPoly2TriMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6d-contour-constrainautor") {
      return createV6DContourConstrainautorMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6d-contour-band-support-rings") {
      return createV6DContourBandSupportRingsMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6d-adaptive-staggered-band") {
      return createV6DAdaptiveStaggeredBandMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6d-adaptive-contour-constrainautor") {
      return createV6DAdaptiveContourConstrainautorMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6e-contour-poly2tri") {
      return createV6EContourPoly2TriMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    if (input.method === "auto-outline-v6f-contour-custom-cdt") {
      return createV6FCustomCdtMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(textureBytes === undefined ? {} : { textureBytes })
      });
    }

    return createV6DeferredFallbackMeshResult({
      method: input.method,
      existingMesh,
      drawableId: drawable.drawableId,
      provenanceId: input.provenanceId,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
      ...(textureBytes === undefined ? {} : { textureBytes })
    });
  }

  if (textureBytes !== undefined) {
    if (input.method === "auto-outline-v4-contour-band") {
      const outlineV4Mesh = createAutoOutlineV4ContourBandMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineV4Mesh.status === "generated") {
        return {
          mesh: outlineV4Mesh.mesh,
          source: "outline-v4-contour-band-rgba",
          alphaBounds: outlineV4Mesh.alphaBounds,
          qualityMetrics: outlineV4Mesh.qualityMetrics
        };
      }

      const outlineV26Mesh = createAutoOutlineV26SoftApronMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const fallbackSteps = [
        {
          method: "auto-outline-v4-contour-band",
          reason: outlineV4Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV26Mesh.status === "generated") {
        return {
          mesh: outlineV26Mesh.mesh,
          source: "outline-v2-6-soft-apron-rgba",
          alphaBounds: outlineV26Mesh.alphaBounds,
          fallbackReason: outlineV4Mesh.reason,
          fallbackSteps,
          qualityMetrics: {
            ...outlineV26Mesh.qualityMetrics,
            fallbackReason: outlineV4Mesh.reason
          }
        };
      }

      const outlineV25Mesh = createAutoOutlineV25SoftBoundaryMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v26FallbackSteps = [
        ...fallbackSteps,
        {
          method: "auto-outline-v2.6-soft-apron",
          reason: outlineV26Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV25Mesh.status === "generated") {
        return {
          mesh: outlineV25Mesh.mesh,
          source: "outline-v2-5-soft-boundary-rgba",
          alphaBounds: outlineV25Mesh.alphaBounds,
          fallbackReason: outlineV4Mesh.reason,
          fallbackSteps: v26FallbackSteps,
          qualityMetrics: {
            ...outlineV25Mesh.qualityMetrics,
            fallbackReason: outlineV4Mesh.reason
          }
        };
      }

      const outlineV2Mesh = createAutoOutlineV2Mesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v25FallbackSteps = [
        ...v26FallbackSteps,
        {
          method: "auto-outline-v2.5-soft-boundary",
          reason: outlineV25Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV2Mesh.status === "generated") {
        return {
          mesh: outlineV2Mesh.mesh,
          source: "outline-v2-rgba",
          alphaBounds: outlineV2Mesh.alphaBounds,
          fallbackReason: outlineV4Mesh.reason,
          fallbackSteps: v25FallbackSteps,
          qualityMetrics: {
            ...outlineV2Mesh.qualityMetrics,
            fallbackReason: outlineV4Mesh.reason
          }
        };
      }

      const outlineV1Fallback = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v2FallbackSteps = [
        ...v25FallbackSteps,
        {
          method: "auto-outline-v2",
          reason: outlineV2Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV1Fallback.status === "generated") {
        return {
          mesh: outlineV1Fallback.mesh,
          source: "outline-rgba",
          alphaBounds: outlineV1Fallback.alphaBounds,
          fallbackReason: outlineV4Mesh.reason,
          fallbackSteps: v2FallbackSteps,
          qualityMetrics: computeMeshQualityMetrics(outlineV1Fallback.mesh, {
            refinementIterationCount: 0,
            fallbackReason: outlineV4Mesh.reason,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      const fallbackAlphaBounds =
        outlineV1Fallback.alphaBounds ??
        outlineV2Mesh.alphaBounds ??
        outlineV25Mesh.alphaBounds ??
        outlineV26Mesh.alphaBounds ??
        outlineV4Mesh.alphaBounds;
      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineV4Mesh.reason,
        fallbackSteps: [
          ...v2FallbackSteps,
          {
            method: "auto-outline-v1",
            reason: outlineV1Fallback.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
      });
    }

    if (input.method === "auto-outline-v2.6-soft-apron") {
      const outlineV26Mesh = createAutoOutlineV26SoftApronMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineV26Mesh.status === "generated") {
        return {
          mesh: outlineV26Mesh.mesh,
          source: "outline-v2-6-soft-apron-rgba",
          alphaBounds: outlineV26Mesh.alphaBounds,
          qualityMetrics: outlineV26Mesh.qualityMetrics
        };
      }

      const outlineV25Mesh = createAutoOutlineV25SoftBoundaryMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const fallbackSteps = [
        {
          method: "auto-outline-v2.6-soft-apron",
          reason: outlineV26Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV25Mesh.status === "generated") {
        return {
          mesh: outlineV25Mesh.mesh,
          source: "outline-v2-5-soft-boundary-rgba",
          alphaBounds: outlineV25Mesh.alphaBounds,
          fallbackReason: outlineV26Mesh.reason,
          fallbackSteps,
          qualityMetrics: {
            ...outlineV25Mesh.qualityMetrics,
            fallbackReason: outlineV26Mesh.reason
          }
        };
      }

      const outlineV2Mesh = createAutoOutlineV2Mesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v25FallbackSteps = [
        ...fallbackSteps,
        {
          method: "auto-outline-v2.5-soft-boundary",
          reason: outlineV25Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV2Mesh.status === "generated") {
        return {
          mesh: outlineV2Mesh.mesh,
          source: "outline-v2-rgba",
          alphaBounds: outlineV2Mesh.alphaBounds,
          fallbackReason: outlineV26Mesh.reason,
          fallbackSteps: v25FallbackSteps,
          qualityMetrics: {
            ...outlineV2Mesh.qualityMetrics,
            fallbackReason: outlineV26Mesh.reason
          }
        };
      }

      const outlineV1Fallback = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v2FallbackSteps = [
        ...v25FallbackSteps,
        {
          method: "auto-outline-v2",
          reason: outlineV2Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV1Fallback.status === "generated") {
        return {
          mesh: outlineV1Fallback.mesh,
          source: "outline-rgba",
          alphaBounds: outlineV1Fallback.alphaBounds,
          fallbackReason: outlineV26Mesh.reason,
          fallbackSteps: v2FallbackSteps,
          qualityMetrics: computeMeshQualityMetrics(outlineV1Fallback.mesh, {
            refinementIterationCount: 0,
            fallbackReason: outlineV26Mesh.reason,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      const fallbackAlphaBounds =
        outlineV1Fallback.alphaBounds ??
        outlineV2Mesh.alphaBounds ??
        outlineV25Mesh.alphaBounds ??
        outlineV26Mesh.alphaBounds;
      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineV26Mesh.reason,
        fallbackSteps: [
          ...v2FallbackSteps,
          {
            method: "auto-outline-v1",
            reason: outlineV1Fallback.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
      });
    }

    if (input.method === "auto-outline-v2.5-soft-boundary") {
      const outlineV25Mesh = createAutoOutlineV25SoftBoundaryMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineV25Mesh.status === "generated") {
        return {
          mesh: outlineV25Mesh.mesh,
          source: "outline-v2-5-soft-boundary-rgba",
          alphaBounds: outlineV25Mesh.alphaBounds,
          qualityMetrics: outlineV25Mesh.qualityMetrics
        };
      }

      const outlineV2Mesh = createAutoOutlineV2Mesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const fallbackSteps = [
        {
          method: "auto-outline-v2.5-soft-boundary",
          reason: outlineV25Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV2Mesh.status === "generated") {
        return {
          mesh: outlineV2Mesh.mesh,
          source: "outline-v2-rgba",
          alphaBounds: outlineV2Mesh.alphaBounds,
          fallbackReason: outlineV25Mesh.reason,
          fallbackSteps,
          qualityMetrics: {
            ...outlineV2Mesh.qualityMetrics,
            fallbackReason: outlineV25Mesh.reason
          }
        };
      }

      const outlineV1Fallback = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v2FallbackSteps = [
        ...fallbackSteps,
        {
          method: "auto-outline-v2",
          reason: outlineV2Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV1Fallback.status === "generated") {
        return {
          mesh: outlineV1Fallback.mesh,
          source: "outline-rgba",
          alphaBounds: outlineV1Fallback.alphaBounds,
          fallbackReason: outlineV25Mesh.reason,
          fallbackSteps: v2FallbackSteps,
          qualityMetrics: computeMeshQualityMetrics(outlineV1Fallback.mesh, {
            refinementIterationCount: 0,
            fallbackReason: outlineV25Mesh.reason,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      const fallbackAlphaBounds =
        outlineV1Fallback.alphaBounds ?? outlineV2Mesh.alphaBounds ?? outlineV25Mesh.alphaBounds;
      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineV1Fallback.reason,
        fallbackSteps: [
          ...v2FallbackSteps,
          {
            method: "auto-outline-v1",
            reason: outlineV1Fallback.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
      });
    }

    if (input.method === "auto-outline-v3-envelope") {
      const outlineV3Mesh = createAutoOutlineV3EnvelopeMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineV3Mesh.status === "generated") {
        return {
          mesh: outlineV3Mesh.mesh,
          source: "outline-v3-envelope-rgba",
          alphaBounds: outlineV3Mesh.alphaBounds,
          qualityMetrics: outlineV3Mesh.qualityMetrics
        };
      }

      const outlineV2Mesh = createAutoOutlineV2Mesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const fallbackSteps = [
        {
          method: "auto-outline-v3-envelope",
          reason: outlineV3Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV2Mesh.status === "generated") {
        return {
          mesh: outlineV2Mesh.mesh,
          source: "outline-v2-rgba",
          alphaBounds: outlineV2Mesh.alphaBounds,
          fallbackReason: outlineV3Mesh.reason,
          fallbackSteps,
          qualityMetrics: {
            ...outlineV2Mesh.qualityMetrics,
            fallbackReason: outlineV3Mesh.reason
          }
        };
      }

      const outlineV1Fallback = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const v2FallbackSteps = [
        ...fallbackSteps,
        {
          method: "auto-outline-v2",
          reason: outlineV2Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV1Fallback.status === "generated") {
        return {
          mesh: outlineV1Fallback.mesh,
          source: "outline-rgba",
          alphaBounds: outlineV1Fallback.alphaBounds,
          fallbackReason: outlineV3Mesh.reason,
          fallbackSteps: v2FallbackSteps,
          qualityMetrics: computeMeshQualityMetrics(outlineV1Fallback.mesh, {
            refinementIterationCount: 0,
            fallbackReason: outlineV3Mesh.reason,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      const fallbackAlphaBounds =
        outlineV1Fallback.alphaBounds ?? outlineV2Mesh.alphaBounds ?? outlineV3Mesh.alphaBounds;
      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineV1Fallback.reason,
        fallbackSteps: [
          ...v2FallbackSteps,
          {
            method: "auto-outline-v1",
            reason: outlineV1Fallback.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
      });
    }

    if (input.method === "auto-outline-v2") {
      const outlineV2Mesh = createAutoOutlineV2Mesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineV2Mesh.status === "generated") {
        return {
          mesh: outlineV2Mesh.mesh,
          source: "outline-v2-rgba",
          alphaBounds: outlineV2Mesh.alphaBounds,
          qualityMetrics: outlineV2Mesh.qualityMetrics
        };
      }

      const outlineV1Fallback = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });
      const fallbackSteps = [
        {
          method: "auto-outline-v2",
          reason: outlineV2Mesh.reason
        }
      ] satisfies readonly MeshGenerationFallbackStep[];

      if (outlineV1Fallback.status === "generated") {
        return {
          mesh: outlineV1Fallback.mesh,
          source: "outline-rgba",
          alphaBounds: outlineV1Fallback.alphaBounds,
          fallbackReason: outlineV2Mesh.reason,
          fallbackSteps,
          qualityMetrics: computeMeshQualityMetrics(outlineV1Fallback.mesh, {
            refinementIterationCount: 0,
            fallbackReason: outlineV2Mesh.reason,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      const fallbackAlphaBounds = outlineV1Fallback.alphaBounds ?? outlineV2Mesh.alphaBounds;
      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineV1Fallback.reason,
        fallbackSteps: [
          ...fallbackSteps,
          {
            method: "auto-outline-v1",
            reason: outlineV1Fallback.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
      });
    }

    if (input.method === "auto-outline-v1") {
      const outlineMesh = createAutoOutlineMesh({
        meshId: existingMesh.meshId,
        drawableId: drawable.drawableId,
        bounds: existingMesh.bounds,
        provenanceId: input.provenanceId,
        textureSize: textureBytes.textureSize,
        rgbaBytes: textureBytes.bytes,
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
      });

      if (outlineMesh.status === "generated") {
        return {
          mesh: outlineMesh.mesh,
          source: "outline-rgba",
          alphaBounds: outlineMesh.alphaBounds,
          qualityMetrics: computeMeshQualityMetrics(outlineMesh.mesh, {
            refinementIterationCount: 0,
            triangulationMode: "ordinary-delaunay-alpha-filter"
          })
        };
      }

      return createFallbackGridMeshResult({
        existingMesh,
        drawableId: drawable.drawableId,
        provenanceId: input.provenanceId,
        fallbackReason: outlineMesh.reason,
        fallbackSteps: [
          {
            method: "auto-outline-v1",
            reason: outlineMesh.reason
          }
        ],
        ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
        ...(outlineMesh.alphaBounds === undefined ? {} : { alphaBounds: outlineMesh.alphaBounds })
      });
    }

    const alphaMesh = createAlphaAwareGridMesh({
      meshId: existingMesh.meshId,
      drawableId: drawable.drawableId,
      bounds: existingMesh.bounds,
      provenanceId: input.provenanceId,
      textureSize: textureBytes.textureSize,
      rgbaBytes: textureBytes.bytes,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });

    if (alphaMesh !== undefined) {
      return {
        mesh: alphaMesh.mesh,
        source: "alpha-aware-rgba",
        alphaBounds: alphaMesh.alphaBounds
      };
    }
  }

  return createFallbackGridMeshResult({
    existingMesh,
    drawableId: drawable.drawableId,
    provenanceId: input.provenanceId,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(textureBytes === undefined ? { fallbackReason: "texture-bytes-unavailable" } : {}),
    ...(textureBytes === undefined &&
    (input.method === "auto-outline-v2" ||
      input.method === "auto-outline-v2.5-soft-boundary" ||
      input.method === "auto-outline-v2.6-soft-apron" ||
      input.method === "auto-outline-v4-contour-band" ||
      input.method === "auto-outline-v3-envelope")
      ? {
          fallbackSteps: [
            ...(input.method === "auto-outline-v4-contour-band"
              ? [
                  {
                    method: "auto-outline-v4-contour-band" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            ...(input.method === "auto-outline-v3-envelope"
              ? [
                  {
                    method: "auto-outline-v3-envelope" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            ...(input.method === "auto-outline-v2.6-soft-apron" ||
            input.method === "auto-outline-v4-contour-band"
              ? [
                  {
                    method: "auto-outline-v2.6-soft-apron" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            ...(input.method === "auto-outline-v2.5-soft-boundary" ||
            input.method === "auto-outline-v2.6-soft-apron" ||
            input.method === "auto-outline-v4-contour-band"
              ? [
                  {
                    method: "auto-outline-v2.5-soft-boundary" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            {
              method: "auto-outline-v2",
              reason: "texture-bytes-unavailable"
            },
            ...(input.method === "auto-outline-v2.6-soft-apron" ||
            input.method === "auto-outline-v4-contour-band"
              ? [
                  {
                    method: "auto-outline-v1" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : [])
          ]
        }
      : {})
  });
};

export const createManualEmptyMesh = (input: {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
}): MeshDto => ({
  meshId: input.meshId,
  drawableId: input.drawableId,
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  triangleStableIds: [],
  topologyRevision: 0,
  bounds: structuredClone(input.bounds),
  generationProvenanceId: input.provenanceId
});

const createGridMesh = (input: {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
}): MeshDto => {
  const cells = gridCellsForDensity(input.densityHint);
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  const token = stripIdPrefix(input.drawableId, "draw_");

  for (let row = 0; row <= cells; row += 1) {
    for (let column = 0; column <= cells; column += 1) {
      const u = column / cells;
      const v = row / cells;
      vertices.push({
        x: input.bounds.x + input.bounds.width * u,
        y: input.bounds.y + input.bounds.height * v
      });
      uvs.push({ x: u, y: v });
      vertexStableIds.push(`vtx_${token}_${row}_${column}`);
    }
  }

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const topLeft = row * (cells + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + cells + 1;
      const bottomRight = bottomLeft + 1;
      triangles.push([topLeft, topRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_${row}_${column}_a` as TriangleId);
      triangles.push([topRight, bottomRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_${row}_${column}_b` as TriangleId);
    }
  }

  return {
    meshId: input.meshId,
    drawableId: input.drawableId,
    vertices,
    uvs,
    triangles,
    vertexStableIds,
    triangleStableIds,
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };
};

const createFallbackGridMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly fallbackReason?: MeshGenerationFallbackReason;
  readonly fallbackSteps?: readonly MeshGenerationFallbackStep[];
  readonly alphaBounds?: RectDto;
}): DrawableGeneratedMeshResult => ({
  mesh: createGridMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  }),
  source: "bounds-grid",
  ...(input.fallbackReason === undefined ? {} : { fallbackReason: input.fallbackReason }),
  ...(input.fallbackSteps === undefined ? {} : { fallbackSteps: input.fallbackSteps }),
  ...(input.alphaBounds === undefined ? {} : { alphaBounds: input.alphaBounds })
});

type ResolvedDrawableTextureBytes = {
  readonly bytes: Uint8Array;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
};

const createV7MarginContourMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV7MeshGenerationCandidate("auto-outline-v7-margin-contour");
  if (input.textureBytes === undefined) {
    return createV7FallbackToV6Chain({
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV7MarginContourMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  return createV7FallbackToV6Chain({
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.textureBytes === undefined ? {} : { textureBytes: input.textureBytes })
  });
};

/**
 * When v7 is blocked, connect to the existing fallback chain starting at
 * v6d-adaptive-contour-constrainautor (the current default). The v7 blocked
 * reason is recorded as the leading fallback step so provenance shows v7 was
 * attempted first.
 */
const createV7FallbackToV6Chain = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly fallbackReason: MeshGenerationFallbackReason;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const downstream = createV6DAdaptiveContourConstrainautorMeshResult({
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.textureBytes === undefined ? {} : { textureBytes: input.textureBytes })
  });
  const v7Step: MeshGenerationFallbackStep = {
    method: "auto-outline-v7-margin-contour",
    reason: input.fallbackReason
  };

  return {
    ...downstream,
    fallbackReason: input.fallbackReason,
    fallbackSteps: [v7Step, ...(downstream.fallbackSteps ?? [])]
  };
};

const createV6ALocalMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6a-local");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6ALocalMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount })
  });
};

const createV6BConstrainautorMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6b-constrainautor");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6BConstrainautorMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  if (generated.status === "fallback") {
    return {
      mesh: generated.mesh,
      source: generated.source,
      fallbackReason: generated.reason,
      fallbackSteps: generated.fallbackSteps,
      qualityMetrics: generated.qualityMetrics,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount })
  });
};

const createV6CPoly2TriMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6c-poly2tri");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6CPoly2TriMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  return createV6Poly2TriFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    textureBytes: input.textureBytes,
    fallbackReason: generated.reason,
    failureMetrics: generated.failureMetrics,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount })
  });
};

const createV6EContourPoly2TriMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6e-contour-poly2tri");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6EContourPoly2TriMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  return createV6Poly2TriFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    textureBytes: input.textureBytes,
    fallbackReason: generated.reason,
    failureMetrics: generated.failureMetrics,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount })
  });
};

const createV6Poly2TriFallbackMeshResult = (input: {
  readonly candidate: V6MeshGenerationCandidate;
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly textureBytes: ResolvedDrawableTextureBytes;
  readonly densityHint?: MeshDensityHint;
  readonly fallbackReason: MeshGenerationFallbackReason;
  readonly failureMetrics: AutoOutlineV6CPoly2TriFailureMetrics | AutoOutlineV6EContourPoly2TriFailureMetrics;
  readonly alphaBounds?: RectDto;
  readonly opaquePixelCount?: number;
}): DrawableGeneratedMeshResult => {
  const alphaMesh = createAlphaAwareGridMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });
  const mesh =
    alphaMesh?.mesh ??
    createGridMesh({
      meshId: input.existingMesh.meshId,
      drawableId: input.drawableId,
      bounds: input.existingMesh.bounds,
      provenanceId: input.provenanceId,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  const source: DrawableGeneratedMeshSource = alphaMesh === undefined ? "bounds-grid" : "alpha-aware-rgba";
  const boundaryVertexCount = countBoundaryVertices(mesh);
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: input.candidate.methodId,
      reason: input.fallbackReason
    }
  ];
  const fallbackAlphaBounds = input.alphaBounds ?? alphaMesh?.alphaBounds;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    fallbackReason: input.fallbackReason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: input.candidate.methodId,
      backendId: input.candidate.backendId,
      backendImplementationStatus: input.candidate.backendImplementationStatus,
      requestedSourceId: input.candidate.sourceId,
      actualSourceId: source,
      outputKind: alphaMesh === undefined ? "blocked" : "fallback-output",
      preset: input.densityHint ?? "medium",
      fallbackReason: input.fallbackReason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: fallbackAlphaBounds !== undefined,
      opaquePixelCount: input.opaquePixelCount ?? countOpaquePixels(input.textureBytes.bytes),
      contourLoopCount: input.failureMetrics.contourLoopCount,
      holeLikeRegionCount: input.failureMetrics.holeLikeRegionCount,
      removedTriangleCount: input.failureMetrics.removedTriangleCount,
      outsideOrCrossingTriangleCount: input.failureMetrics.outsideOrCrossingTriangleCount,
      multiIslandHandling: input.failureMetrics.multiIslandHandling,
      holeHandling: input.failureMetrics.holeHandling,
      provenance: input.failureMetrics.provenance,
      ...(!("contourPipelineDiagnostics" in input.failureMetrics) ||
      input.failureMetrics.contourPipelineDiagnostics === undefined
        ? {}
        : { contourPipelineDiagnostics: input.failureMetrics.contourPipelineDiagnostics }),
      poly2triDiagnostics: input.failureMetrics.diagnostics
    }
  });

  return {
    mesh,
    source,
    fallbackReason: input.fallbackReason,
    fallbackSteps,
    qualityMetrics,
    ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
  };
};

const createV6DContourConstrainautorMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-constrainautor");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6DContourConstrainautorMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  if (generated.status === "fallback") {
    return {
      mesh: generated.mesh,
      source: generated.source,
      fallbackReason: generated.reason,
      fallbackSteps: generated.fallbackSteps,
      qualityMetrics: generated.qualityMetrics,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount }),
    ...(generated.contourPipeline === undefined ? {} : { contourPipeline: generated.contourPipeline })
  });
};

const createV6DContourBandSupportRingsMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-band-support-rings");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6DContourBandSupportRingsMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  if (generated.status === "fallback") {
    return {
      mesh: generated.mesh,
      source: generated.source,
      fallbackReason: generated.reason,
      fallbackSteps: generated.fallbackSteps,
      qualityMetrics: generated.qualityMetrics,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount }),
    ...(generated.contourPipeline === undefined ? {} : { contourPipeline: generated.contourPipeline })
  });
};

const createV6DAdaptiveStaggeredBandMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-staggered-band");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6DAdaptiveStaggeredBandMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  if (generated.status === "fallback") {
    return {
      mesh: generated.mesh,
      source: generated.source,
      fallbackReason: generated.reason,
      fallbackSteps: generated.fallbackSteps,
      qualityMetrics: generated.qualityMetrics,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount }),
    ...(generated.contourPipeline === undefined ? {} : { contourPipeline: generated.contourPipeline })
  });
};

const createV6DAdaptiveContourConstrainautorMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  if (input.textureBytes === undefined) {
    return createV6BlockedFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6DAdaptiveContourConstrainautorMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  if (generated.status === "fallback") {
    return {
      mesh: generated.mesh,
      source: generated.source,
      fallbackReason: generated.reason,
      fallbackSteps: generated.fallbackSteps,
      qualityMetrics: generated.qualityMetrics,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
    };
  }

  return createV6BlockedFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    fallbackReason: generated.reason,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount }),
    ...(generated.contourPipeline === undefined ? {} : { contourPipeline: generated.contourPipeline })
  });
};

const createV6FCustomCdtMeshResult = (input: {
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6f-contour-custom-cdt");
  if (input.textureBytes === undefined) {
    return createV6FCustomCdtFallbackMeshResult({
      candidate,
      existingMesh: input.existingMesh,
      drawableId: input.drawableId,
      provenanceId: input.provenanceId,
      fallbackReason: "texture-bytes-unavailable",
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  }

  const generated = createAutoOutlineV6FCustomCdtMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    textureSize: input.textureBytes.textureSize,
    rgbaBytes: input.textureBytes.bytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });

  if (generated.status === "generated") {
    return {
      mesh: generated.mesh,
      source: candidate.sourceId,
      alphaBounds: generated.alphaBounds,
      qualityMetrics: generated.qualityMetrics
    };
  }

  return createV6FCustomCdtFallbackMeshResult({
    candidate,
    existingMesh: input.existingMesh,
    drawableId: input.drawableId,
    provenanceId: input.provenanceId,
    textureBytes: input.textureBytes,
    fallbackReason: generated.reason,
    failureMetrics: generated.failureMetrics,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
    ...(generated.opaquePixelCount === undefined ? {} : { opaquePixelCount: generated.opaquePixelCount })
  });
};

const createV6FCustomCdtFallbackMeshResult = (input: {
  readonly candidate: V6MeshGenerationCandidate;
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
  readonly densityHint?: MeshDensityHint;
  readonly fallbackReason: MeshGenerationFallbackReason;
  readonly failureMetrics?: AutoOutlineV6FCustomCdtFailureMetrics;
  readonly alphaBounds?: RectDto;
  readonly opaquePixelCount?: number;
}): DrawableGeneratedMeshResult => {
  const alphaMesh =
    input.textureBytes === undefined
      ? undefined
      : createAlphaAwareGridMesh({
          meshId: input.existingMesh.meshId,
          drawableId: input.drawableId,
          bounds: input.existingMesh.bounds,
          provenanceId: input.provenanceId,
          textureSize: input.textureBytes.textureSize,
          rgbaBytes: input.textureBytes.bytes,
          ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
        });
  const mesh =
    alphaMesh?.mesh ??
    createGridMesh({
      meshId: input.existingMesh.meshId,
      drawableId: input.drawableId,
      bounds: input.existingMesh.bounds,
      provenanceId: input.provenanceId,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  const source: DrawableGeneratedMeshSource = alphaMesh === undefined ? "bounds-grid" : "alpha-aware-rgba";
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: input.candidate.methodId,
      reason: input.fallbackReason
    }
  ];
  const fallbackAlphaBounds = input.alphaBounds ?? alphaMesh?.alphaBounds;
  const boundaryVertexCount = input.failureMetrics?.boundaryVertexCount ?? countBoundaryVertices(mesh);
  const interiorVertexCount =
    input.failureMetrics?.interiorVertexCount ?? Math.max(0, mesh.vertices.length - boundaryVertexCount);
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: input.failureMetrics?.diagnostics.edgeFlipCount ?? 0,
    fallbackReason: input.fallbackReason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: input.candidate.methodId,
      backendId: input.candidate.backendId,
      backendImplementationStatus: input.candidate.backendImplementationStatus,
      requestedSourceId: input.candidate.sourceId,
      actualSourceId: source,
      outputKind: alphaMesh === undefined ? "blocked" : "fallback-output",
      preset: input.densityHint ?? "medium",
      fallbackReason: input.fallbackReason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount,
      alphaBoundsAvailable: fallbackAlphaBounds !== undefined,
      ...(input.textureBytes === undefined
        ? {}
        : { opaquePixelCount: input.opaquePixelCount ?? countOpaquePixels(input.textureBytes.bytes) }),
      contourLoopCount: input.failureMetrics?.contourLoopCount ?? 0,
      holeLikeRegionCount: input.failureMetrics?.holeLikeRegionCount ?? 0,
      removedTriangleCount: input.failureMetrics?.removedTriangleCount ?? 0,
      outsideOrCrossingTriangleCount: input.failureMetrics?.outsideOrCrossingTriangleCount ?? 0,
      multiIslandHandling: input.failureMetrics?.multiIslandHandling ?? "not-evaluated",
      holeHandling: input.failureMetrics?.holeHandling ?? "not-evaluated",
      provenance: input.failureMetrics?.provenance ?? createV6BlockedFallbackProvenance(input.candidate, input.fallbackReason),
      ...(input.failureMetrics?.contourPipelineDiagnostics === undefined
        ? {}
        : { contourPipelineDiagnostics: input.failureMetrics.contourPipelineDiagnostics }),
      customCdtDiagnostics: input.failureMetrics?.diagnostics ?? {
        dependencyGateStatus: "not-required",
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        edgeFlipCount: 0,
        constraintRecoveryOperationCount: 0,
        longSpokeCandidateCount: 0,
        rejectedLocalImprovementCount: 0,
        customTriangulationFallbackReason: input.fallbackReason
      }
    }
  });

  return {
    mesh,
    source,
    fallbackReason: input.fallbackReason,
    fallbackSteps,
    qualityMetrics,
    ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds })
  };
};

const createV6BlockedFallbackMeshResult = (input: {
  readonly candidate: V6MeshGenerationCandidate;
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly fallbackReason: MeshGenerationFallbackReason;
  readonly alphaBounds?: RectDto;
  readonly opaquePixelCount?: number;
  readonly contourPipeline?: V6ContourPipelineResult;
}): DrawableGeneratedMeshResult => {
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: input.candidate.methodId,
      reason: input.fallbackReason
    }
  ];
  const mesh = createGridMesh({
    meshId: input.existingMesh.meshId,
    drawableId: input.drawableId,
    bounds: input.existingMesh.bounds,
    provenanceId: input.provenanceId,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
  });
  const boundaryVertexCount = countBoundaryVertices(mesh);
  const contourPipelineDiagnostics = createV6ContourPipelineDiagnostics(input.contourPipeline, input.fallbackReason);
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    fallbackReason: input.fallbackReason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: input.candidate.methodId,
      backendId: input.candidate.backendId,
      backendImplementationStatus: input.candidate.backendImplementationStatus,
      requestedSourceId: input.candidate.sourceId,
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      preset: input.densityHint ?? "medium",
      fallbackReason: input.fallbackReason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: input.alphaBounds !== undefined,
      ...(input.opaquePixelCount === undefined ? {} : { opaquePixelCount: input.opaquePixelCount }),
      contourLoopCount: 0,
      holeLikeRegionCount: 0,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      multiIslandHandling: "not-evaluated",
      holeHandling: "not-evaluated",
      provenance: createV6BlockedFallbackProvenance(input.candidate, input.fallbackReason),
      ...(contourPipelineDiagnostics === undefined ? {} : { contourPipelineDiagnostics }),
      ...createV6DeferredBackendDiagnostics(input.candidate)
    }
  });

  return {
    mesh,
    source: "bounds-grid",
    fallbackReason: input.fallbackReason,
    fallbackSteps,
    qualityMetrics,
    ...(input.alphaBounds === undefined ? {} : { alphaBounds: input.alphaBounds })
  };
};

const createV6DeferredFallbackMeshResult = (input: {
  readonly method: Parameters<typeof getV6MeshGenerationCandidate>[0];
  readonly existingMesh: MeshDto;
  readonly drawableId: DrawableId;
  readonly provenanceId: ProvenanceId;
  readonly densityHint?: MeshDensityHint;
  readonly textureBytes?: ResolvedDrawableTextureBytes;
}): DrawableGeneratedMeshResult => {
  const candidate = getV6MeshGenerationCandidate(input.method);
  const contourPipeline =
    input.textureBytes === undefined
      ? undefined
      : createV6ContourCandidateInput({
          textureSize: input.textureBytes.textureSize,
          meshBounds: input.existingMesh.bounds,
          rgbaBytes: input.textureBytes.bytes,
          ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
        });
  const contourCandidate =
    contourPipeline?.status === "generated" ? contourPipeline.candidateInput : undefined;
  const alphaMesh =
    input.textureBytes === undefined
      ? undefined
      : createAlphaAwareGridMesh({
          meshId: input.existingMesh.meshId,
          drawableId: input.drawableId,
          bounds: input.existingMesh.bounds,
          provenanceId: input.provenanceId,
          textureSize: input.textureBytes.textureSize,
          rgbaBytes: input.textureBytes.bytes,
          ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
        });
  const fallbackReason = resolveV6DeferredFallbackReason(input.textureBytes, contourPipeline, alphaMesh);
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason: fallbackReason
    }
  ];
  const mesh =
    alphaMesh?.mesh ??
    createGridMesh({
      meshId: input.existingMesh.meshId,
      drawableId: input.drawableId,
      bounds: input.existingMesh.bounds,
      provenanceId: input.provenanceId,
      ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint })
    });
  const source: DrawableGeneratedMeshSource = alphaMesh === undefined ? "bounds-grid" : "alpha-aware-rgba";
  const fallbackAlphaBounds = contourCandidate?.alphaBounds.stageBounds ?? alphaMesh?.alphaBounds;
  const boundaryVertexCount = contourCandidate?.boundaryPoints.length ?? countBoundaryVertices(mesh);
  const interiorVertexCount =
    contourCandidate?.interiorPoints.length ?? Math.max(0, mesh.vertices.length - boundaryVertexCount);
  const outputKind = fallbackReason === "v6-backend-not-implemented" ? "fallback-output" : "blocked";
  const contourPipelineDiagnostics = createV6ContourPipelineDiagnostics(contourPipeline, fallbackReason);
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    fallbackReason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: candidate.backendImplementationStatus,
      requestedSourceId: candidate.sourceId,
      actualSourceId: source,
      outputKind,
      preset: input.densityHint ?? "medium",
      fallbackReason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount,
      alphaBoundsAvailable: fallbackAlphaBounds !== undefined,
      ...(input.textureBytes === undefined
        ? {}
        : { opaquePixelCount: contourCandidate?.diagnostics.inputOpaquePixelCount ?? countOpaquePixels(input.textureBytes.bytes) }),
      contourLoopCount: contourCandidate?.diagnostics.contourLoopCount ?? 0,
      holeLikeRegionCount: contourCandidate?.diagnostics.holeLikeRegionCount ?? 0,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      multiIslandHandling: contourCandidate?.diagnostics.multiIslandHandling ?? "not-evaluated",
      holeHandling: contourCandidate?.diagnostics.holeHandling ?? "not-evaluated",
      provenance: createV6DeferredFallbackProvenance(candidate, contourCandidate),
      ...(contourPipelineDiagnostics === undefined ? {} : { contourPipelineDiagnostics }),
      ...createV6DeferredBackendDiagnostics(candidate, contourCandidate, fallbackReason)
    }
  });

  return {
    mesh,
    source,
    ...(fallbackAlphaBounds === undefined ? {} : { alphaBounds: fallbackAlphaBounds }),
    fallbackReason,
    fallbackSteps,
    qualityMetrics
  };
};

const resolveV6DeferredFallbackReason = (
  textureBytes: ResolvedDrawableTextureBytes | undefined,
  contourPipeline: V6ContourPipelineResult | undefined,
  alphaMesh: { readonly mesh: MeshDto; readonly alphaBounds: RectDto } | undefined
): MeshGenerationFallbackReason => {
  if (textureBytes === undefined) {
    return "texture-bytes-unavailable";
  }

  if (contourPipeline?.status === "blocked") {
    return contourPipeline.reason;
  }

  if (alphaMesh === undefined) {
    return "alpha-empty";
  }

  return "v6-backend-not-implemented";
};

const createV6ContourPipelineDiagnostics = (
  contourPipeline: V6ContourPipelineResult | undefined,
  fallbackReason: MeshGenerationFallbackReason
): NonNullable<
  NonNullable<Parameters<typeof computeMeshQualityMetrics>[1]["v6Metrics"]>["contourPipelineDiagnostics"]
> | undefined => {
  if (contourPipeline === undefined) {
    return undefined;
  }

  if (contourPipeline.status === "generated") {
    const diagnostics = contourPipeline.candidateInput.diagnostics;
    return {
      status: "generated",
      inputOpaquePixelCount: diagnostics.inputOpaquePixelCount,
      softMaskOpaquePixelCount: diagnostics.softMaskOpaquePixelCount,
      selectedComponentPixelCount: diagnostics.selectedComponentPixelCount,
      boundaryPointCount: diagnostics.boundaryPointCount,
      constraintEdgeCount: diagnostics.constraintEdgeCount,
      steinerPointCount: diagnostics.interiorPointCount,
      alphaBoundsAvailable: true
    };
  }

  return {
    status: "blocked",
    inputOpaquePixelCount:
      contourPipeline.opaquePixelCount ?? contourPipeline.diagnostics?.inputOpaquePixelCount ?? 0,
    softMaskOpaquePixelCount: contourPipeline.diagnostics?.softMaskOpaquePixelCount ?? 0,
    selectedComponentPixelCount: contourPipeline.diagnostics?.selectedComponentPixelCount ?? 0,
    boundaryPointCount: contourPipeline.diagnostics?.boundaryPointCount ?? 0,
    constraintEdgeCount: contourPipeline.diagnostics?.constraintEdgeCount ?? 0,
    steinerPointCount: contourPipeline.diagnostics?.interiorPointCount ?? 0,
    alphaBoundsAvailable: contourPipeline.alphaBounds !== undefined,
    blockedReason: fallbackReason
  };
};

const createV6DeferredFallbackProvenance = (
  candidate: V6MeshGenerationCandidate,
  contourCandidate?: V6ContourCandidateInput
): readonly string[] => [
  "v6-contract-surface",
  candidate.dependencyGateStatus === "available"
    ? "dependency-available"
    : "dependency-not-required",
  ...(contourCandidate === undefined ? [] : ["shared-v6-contour-pipeline"]),
  "backend-implementation-deferred",
  `${candidate.backendId}-domain-deferred`
];

const createV6BlockedFallbackProvenance = (
  candidate: V6MeshGenerationCandidate,
  fallbackReason: MeshGenerationFallbackReason
): readonly string[] => [
  "v6-contract-surface",
  candidate.backendImplementationStatus === "implemented"
    ? "backend-implementation-implemented"
    : "backend-implementation-deferred",
  `${candidate.backendId}-blocked`,
  `fallback-${fallbackReason}`
];

const createV6DeferredBackendDiagnostics = (
  candidate: V6MeshGenerationCandidate,
  contourCandidate?: V6ContourCandidateInput,
  fallbackReason?: MeshGenerationFallbackReason
): Pick<
  NonNullable<Parameters<typeof computeMeshQualityMetrics>[1]["v6Metrics"]>,
  | "constrainautorDiagnostics"
  | "supportRingDiagnostics"
  | "adaptiveDensityDiagnostics"
  | "adaptiveStaggeredBandDiagnostics"
  | "poly2triDiagnostics"
  | "customCdtDiagnostics"
> => {
  const constraintEdgeCount = contourCandidate?.constraintEdges.length ?? 0;
  if (candidate.backendId === "v6b-constrainautor") {
    return {
      constrainautorDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      }
    };
  }

  if (candidate.backendId === "v6d-contour-constrainautor") {
    return {
      constrainautorDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: constraintEdgeCount,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      }
    };
  }

  if (candidate.backendId === "v6d-contour-band-support-rings") {
    return {
      constrainautorDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: constraintEdgeCount,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      },
      supportRingDiagnostics: {
        boundaryRingPointCount: 0,
        alphaBoundaryRingPointCount: 0,
        outerRingPointCount: 0,
        innerRingPointCount: 0,
        skippedRingPointCount: 0,
        mergedRingPointCount: 0,
        ringSelfIntersectionCount: 0,
        bridgeConstraintCount: 0,
        supportBandTriangleCount: 0,
        alphaBoundaryBandTriangleCount: 0,
        interiorTriangleCount: 0,
        verticesExtendOutsideLayerBounds: false,
        maxOutsideLayerDistance: 0,
        outerRingOffset: 0,
        innerRingOffset: 0,
        outerRingUvPolicy: "projected-to-alpha-boundary"
      }
    };
  }

  if (candidate.backendId === "v6d-adaptive-staggered-band") {
    return {
      constrainautorDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: constraintEdgeCount,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      },
      supportRingDiagnostics: {
        boundaryRingPointCount: 0,
        alphaBoundaryRingPointCount: 0,
        outerRingPointCount: 0,
        innerRingPointCount: 0,
        skippedRingPointCount: 0,
        mergedRingPointCount: 0,
        ringSelfIntersectionCount: 0,
        bridgeConstraintCount: 0,
        supportBandTriangleCount: 0,
        alphaBoundaryBandTriangleCount: 0,
        interiorTriangleCount: 0,
        verticesExtendOutsideLayerBounds: false,
        maxOutsideLayerDistance: 0,
        outerRingOffset: 0,
        innerRingOffset: 0,
        outerRingUvPolicy: "projected-to-alpha-boundary"
      },
      adaptiveStaggeredBandDiagnostics: {
        adaptiveDensityReferenceArea: 0,
        adaptiveDensityEffectiveArea: 0,
        adaptiveDensityAreaRatio: 0,
        adaptiveDensityClampedAreaRatio: 0,
        adaptiveDensitySpacingScale: 0,
        adaptiveDensityVertexScale: 0,
        adaptiveDensityBoundaryCapScale: 0,
        resolvedBoundarySpacing: 0,
        resolvedInteriorSpacing: 0,
        resolvedMaxBoundaryVertices: 0,
        resolvedMaxInteriorVertices: 0,
        resolvedInteriorBoundaryClearance: 0,
        staggeredInnerPointCount: 0,
        skippedStaggeredInnerPointCount: 0,
        explicitAlphaInnerStripTriangleCount: 0,
        degenerateExplicitStripTriangleCount: 0,
        interiorPointCountBeforeInnerFilter: 0,
        interiorPointCountAfterInnerFilter: 0,
        directAlphaToInteriorEdgeCount: 0,
        interiorFillUsesStaggeredInnerBoundary: false
      }
    };
  }

  if (candidate.backendId === "v6d-adaptive-contour-constrainautor") {
    return {
      constrainautorDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: constraintEdgeCount,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      },
      adaptiveDensityDiagnostics: {
        adaptiveDensityReferenceArea: 0,
        adaptiveDensityEffectiveArea: 0,
        adaptiveDensityAreaRatio: 0,
        adaptiveDensityClampedAreaRatio: 0,
        adaptiveDensitySpacingScale: 0,
        adaptiveDensityVertexScale: 0,
        adaptiveDensityBoundaryCapScale: 0,
        resolvedBoundarySpacing: 0,
        resolvedInteriorSpacing: 0,
        resolvedMaxBoundaryVertices: 0,
        resolvedMaxInteriorVertices: 0,
        resolvedInteriorBoundaryClearance: 0
      }
    };
  }

  if (candidate.backendId === "v6c-poly2tri") {
    return {
      poly2triDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        outerPointCount: 0,
        holeCount: 0,
        steinerPointCount: 0,
        polygonValidationFailed: false,
        holeValidationFailed: false,
        triangulationThrown: false,
        boundaryEdgePreservedCount: 0,
        boundaryEdgeMissingCount: 0,
        mainIslandOnlyFallback: false
      }
    };
  }

  if (candidate.backendId === "v6e-contour-poly2tri") {
    return {
      poly2triDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        outerPointCount: contourCandidate?.boundaryPoints.length ?? 0,
        holeCount: contourCandidate?.diagnostics.holeLikeRegionCount ?? 0,
        steinerPointCount: contourCandidate?.interiorPoints.length ?? 0,
        polygonValidationFailed: false,
        holeValidationFailed: false,
        triangulationThrown: false,
        boundaryEdgePreservedCount: 0,
        boundaryEdgeMissingCount: constraintEdgeCount,
        mainIslandOnlyFallback: contourCandidate?.diagnostics.multiIslandHandling === "main-island-only"
      }
    };
  }

  if (candidate.backendId === "v6f-contour-custom-cdt") {
    return {
      customCdtDiagnostics: {
        dependencyGateStatus: candidate.dependencyGateStatus,
        constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: constraintEdgeCount,
        edgeFlipCount: 0,
        constraintRecoveryOperationCount: 0,
        longSpokeCandidateCount: 0,
        rejectedLocalImprovementCount: 0,
        ...(fallbackReason === undefined
          ? {}
          : { customTriangulationFallbackReason: fallbackReason })
      }
    };
  }

  return {};
};

const countBoundaryVertices = (mesh: MeshDto): number => {
  const edgeCounts = new Map<string, { readonly edge: readonly [number, number]; count: number }>();

  for (const [a, b, c] of mesh.triangles) {
    addCountedEdge(edgeCounts, a, b);
    addCountedEdge(edgeCounts, b, c);
    addCountedEdge(edgeCounts, c, a);
  }

  const boundaryIndices = new Set<number>();
  for (const countedEdge of edgeCounts.values()) {
    if (countedEdge.count !== 1) {
      continue;
    }

    boundaryIndices.add(countedEdge.edge[0]);
    boundaryIndices.add(countedEdge.edge[1]);
  }

  return boundaryIndices.size;
};

const addCountedEdge = (
  edgeCounts: Map<string, { readonly edge: readonly [number, number]; count: number }>,
  left: number,
  right: number
): void => {
  const edge: readonly [number, number] = left < right ? [left, right] : [right, left];
  const key = `${edge[0]}:${edge[1]}`;
  const current = edgeCounts.get(key);
  if (current === undefined) {
    edgeCounts.set(key, { edge, count: 1 });
    return;
  }

  current.count += 1;
};

const countOpaquePixels = (rgbaBytes: Uint8Array): number => {
  let count = 0;
  for (let index = 3; index < rgbaBytes.byteLength; index += 4) {
    if ((rgbaBytes[index] ?? 0) > 8) {
      count += 1;
    }
  }

  return count;
};

export const createAlphaAwareGridMesh = (
  input: AlphaAwareGridMeshInput
): { readonly mesh: MeshDto; readonly alphaBounds: RectDto } | undefined => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return undefined;
  }

  const alphaBoundsPixels = findAlphaBoundsPixels(input.rgbaBytes, width, height, input.alphaThreshold ?? 8);
  if (alphaBoundsPixels === undefined) {
    return undefined;
  }

  const cells = gridCellsForDensity(input.densityHint);
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  const token = stripIdPrefix(input.drawableId, "draw_");
  const vertexIndexByGridPoint = new Map<string, number>();
  const alphaBounds = pixelBoundsToStageRect(alphaBoundsPixels, input.bounds, width, height);

  const addVertex = (row: number, column: number): number => {
    const key = `${row}:${column}`;
    const existingIndex = vertexIndexByGridPoint.get(key);
    if (existingIndex !== undefined) {
      return existingIndex;
    }

    const pixelX = lerp(alphaBoundsPixels.left, alphaBoundsPixels.right, column / cells);
    const pixelY = lerp(alphaBoundsPixels.top, alphaBoundsPixels.bottom, row / cells);
    const uv = {
      x: roundCoordinate(pixelX / width),
      y: roundCoordinate(pixelY / height)
    };
    const vertex = {
      x: roundCoordinate(input.bounds.x + input.bounds.width * uv.x),
      y: roundCoordinate(input.bounds.y + input.bounds.height * uv.y)
    };
    const vertexIndex = vertices.length;
    vertices.push(vertex);
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_${row}_${column}`);
    vertexIndexByGridPoint.set(key, vertexIndex);
    return vertexIndex;
  };

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const cellPixels = {
        left: Math.floor(lerp(alphaBoundsPixels.left, alphaBoundsPixels.right, column / cells)),
        top: Math.floor(lerp(alphaBoundsPixels.top, alphaBoundsPixels.bottom, row / cells)),
        right: Math.ceil(lerp(alphaBoundsPixels.left, alphaBoundsPixels.right, (column + 1) / cells)),
        bottom: Math.ceil(lerp(alphaBoundsPixels.top, alphaBoundsPixels.bottom, (row + 1) / cells))
      };
      if (!cellHasAlpha(input.rgbaBytes, width, height, cellPixels, input.alphaThreshold ?? 8)) {
        continue;
      }

      const topLeft = addVertex(row, column);
      const topRight = addVertex(row, column + 1);
      const bottomLeft = addVertex(row + 1, column);
      const bottomRight = addVertex(row + 1, column + 1);
      triangles.push([topLeft, topRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_${row}_${column}_a` as TriangleId);
      triangles.push([topRight, bottomRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_${row}_${column}_b` as TriangleId);
    }
  }

  if (vertices.length === 0 || triangles.length === 0) {
    return undefined;
  }

  return {
    alphaBounds,
    mesh: {
      meshId: input.meshId,
      drawableId: input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.bounds),
      generationProvenanceId: input.provenanceId
    }
  };
};

const gridCellsForDensity = (densityHint: MeshDensityHint | undefined): number => {
  switch (densityHint) {
    case "medium":
      return 2;
    case "high":
      return 4;
    case "low":
    case undefined:
      return 1;
  }
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const resolveDrawableTextureBytes = (
  session: AuthoringSession,
  textureId: string,
  bounds: RectDto
): { readonly bytes: Uint8Array; readonly textureSize: { readonly width: number; readonly height: number } } | undefined => {
  const texture = session.graph.textureAtlas?.textures.find((candidate) => candidate.textureId === textureId);
  const binaryAssetRef = texture?.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    return undefined;
  }

  const binaryEntry = session.binaryAssets?.fileEntries.find(
    (entry) => entry.path === binaryAssetRef.packageRelativePath
  );
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  if (
    binaryEntry === undefined ||
    width <= 0 ||
    height <= 0 ||
    binaryEntry.bytes.byteLength !== width * height * 4
  ) {
    return undefined;
  }

  return {
    bytes: binaryEntry.bytes,
    textureSize: {
      width,
      height
    }
  };
};

interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const findAlphaBoundsPixels = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): PixelBounds | undefined => {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgbaBytes[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= alphaThreshold) {
        continue;
      }

      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return right < left || bottom < top
    ? undefined
    : {
        left,
        top,
        right,
        bottom
      };
};

const cellHasAlpha = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  cell: PixelBounds,
  alphaThreshold: number
): boolean => {
  const left = clampInt(cell.left, 0, width);
  const top = clampInt(cell.top, 0, height);
  const right = clampInt(Math.max(cell.right, left + 1), 0, width);
  const bottom = clampInt(Math.max(cell.bottom, top + 1), 0, height);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if ((rgbaBytes[(y * width + x) * 4 + 3] ?? 0) > alphaThreshold) {
        return true;
      }
    }
  }

  return false;
};

const pixelBoundsToStageRect = (
  pixelBounds: PixelBounds,
  textureBounds: RectDto,
  textureWidth: number,
  textureHeight: number
): RectDto => ({
  x: roundCoordinate(textureBounds.x + textureBounds.width * (pixelBounds.left / textureWidth)),
  y: roundCoordinate(textureBounds.y + textureBounds.height * (pixelBounds.top / textureHeight)),
  width: roundCoordinate(textureBounds.width * ((pixelBounds.right - pixelBounds.left) / textureWidth)),
  height: roundCoordinate(textureBounds.height * ((pixelBounds.bottom - pixelBounds.top) / textureHeight))
});

const lerp = (left: number, right: number, ratio: number): number =>
  left + (right - left) * ratio;

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
