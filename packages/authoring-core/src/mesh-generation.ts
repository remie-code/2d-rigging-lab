import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";
import {
  createAutoOutlineMesh,
  type AutoOutlineFailureReason
} from "./mesh-outline-generation.js";
import {
  createAutoOutlineV25SoftBoundaryMesh,
  type AutoOutlineV25SoftBoundaryFailureReason
} from "./mesh-outline-v2-5-soft-boundary-generation.js";
import {
  createAutoOutlineV26SoftApronMesh,
  type AutoOutlineV26SoftApronFailureReason
} from "./mesh-outline-v2-6-soft-apron-generation.js";
import { createAutoOutlineV2Mesh } from "./mesh-outline-v2-generation.js";
import {
  createAutoOutlineV3EnvelopeMesh,
  type AutoOutlineV3EnvelopeFailureReason
} from "./mesh-outline-v3-envelope-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export type MeshGenerationMethod =
  | "manual-empty"
  | "auto-grid-v1"
  | "auto-outline-v1"
  | "auto-outline-v2"
  | "auto-outline-v2.5-soft-boundary"
  | "auto-outline-v2.6-soft-apron"
  | "auto-outline-v3-envelope";
export type MeshDensityHint = "low" | "medium" | "high";
export type DrawableGeneratedMeshSource =
  | "outline-v3-envelope-rgba"
  | "outline-v2-6-soft-apron-rgba"
  | "outline-v2-5-soft-boundary-rgba"
  | "outline-v2-rgba"
  | "outline-rgba"
  | "alpha-aware-rgba"
  | "bounds-grid";
export type MeshGenerationFallbackReason =
  | "texture-bytes-unavailable"
  | AutoOutlineV3EnvelopeFailureReason
  | AutoOutlineV26SoftApronFailureReason
  | AutoOutlineV25SoftBoundaryFailureReason
  | AutoOutlineFailureReason;

export interface MeshGenerationFallbackStep {
  readonly method:
    | "auto-outline-v3-envelope"
    | "auto-outline-v2.6-soft-apron"
    | "auto-outline-v2.5-soft-boundary"
    | "auto-outline-v2"
    | "auto-outline-v1";
  readonly reason: MeshGenerationFallbackReason;
}

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
  if (textureBytes !== undefined) {
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
      input.method === "auto-outline-v3-envelope")
      ? {
          fallbackSteps: [
            ...(input.method === "auto-outline-v3-envelope"
              ? [
                  {
                    method: "auto-outline-v3-envelope" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            ...(input.method === "auto-outline-v2.6-soft-apron"
              ? [
                  {
                    method: "auto-outline-v2.6-soft-apron" as const,
                    reason: "texture-bytes-unavailable" as const
                  }
                ]
              : []),
            ...(input.method === "auto-outline-v2.5-soft-boundary" ||
            input.method === "auto-outline-v2.6-soft-apron"
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
            ...(input.method === "auto-outline-v2.6-soft-apron"
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
