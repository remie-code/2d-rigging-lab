import type { AutoOutlineFailureReason } from "./mesh-outline-generation.js";
import type { AutoOutlineV25SoftBoundaryFailureReason } from "./mesh-outline-v2-5-soft-boundary-generation.js";
import type { AutoOutlineV26SoftApronFailureReason } from "./mesh-outline-v2-6-soft-apron-generation.js";
import type { AutoOutlineV3EnvelopeFailureReason } from "./mesh-outline-v3-envelope-generation.js";
import type { AutoOutlineV4ContourBandFailureReason } from "./mesh-outline-v4-contour-band-generation.js";

export const V6_MESH_GENERATION_METHOD_IDS = [
  "auto-outline-v6a-local",
  "auto-outline-v6b-constrainautor",
  "auto-outline-v6c-poly2tri",
  "auto-outline-v6d-contour-constrainautor",
  "auto-outline-v6d-contour-band-support-rings",
  "auto-outline-v6d-adaptive-staggered-band",
  "auto-outline-v6d-adaptive-contour-constrainautor",
  "auto-outline-v6e-contour-poly2tri",
  "auto-outline-v6f-contour-custom-cdt"
] as const;

export const V6_MESH_GENERATION_SOURCE_IDS = [
  "outline-v6a-local-rgba",
  "outline-v6b-constrainautor-rgba",
  "outline-v6c-poly2tri-rgba",
  "outline-v6d-contour-constrainautor-rgba",
  "outline-v6d-contour-band-support-rings-rgba",
  "outline-v6d-adaptive-staggered-band-rgba",
  "outline-v6d-adaptive-contour-constrainautor-rgba",
  "outline-v6e-contour-poly2tri-rgba",
  "outline-v6f-contour-custom-cdt-rgba"
] as const;

export const V6_MESH_GENERATION_BACKEND_IDS = [
  "v6a-local",
  "v6b-constrainautor",
  "v6c-poly2tri",
  "v6d-contour-constrainautor",
  "v6d-contour-band-support-rings",
  "v6d-adaptive-staggered-band",
  "v6d-adaptive-contour-constrainautor",
  "v6e-contour-poly2tri",
  "v6f-contour-custom-cdt"
] as const;

export const V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS = [
  "@kninnug/constrainautor",
  "d3-contour",
  "delaunator",
  "poly2tri",
  "simplify-js"
] as const;

export type V6MeshGenerationMethod = (typeof V6_MESH_GENERATION_METHOD_IDS)[number];
export type V6MeshGenerationSourceId = (typeof V6_MESH_GENERATION_SOURCE_IDS)[number];
export type V6MeshGenerationDependencyPackageId =
  (typeof V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS)[number];
export type V6MeshGenerationBackendId = (typeof V6_MESH_GENERATION_BACKEND_IDS)[number];
export type V6MeshGenerationDependencyGateStatus =
  | "not-required"
  | "available";
export type V6MeshGenerationBackendImplementationStatus =
  | "deferred"
  | "implemented";

export interface V6MeshGenerationCandidate {
  readonly methodId: V6MeshGenerationMethod;
  readonly sourceId: V6MeshGenerationSourceId;
  readonly backendId: V6MeshGenerationBackendId;
  readonly dependencyGateStatus: V6MeshGenerationDependencyGateStatus;
  readonly dependencyPackageIds: readonly V6MeshGenerationDependencyPackageId[];
  readonly backendImplementationStatus: V6MeshGenerationBackendImplementationStatus;
}

export const V6_MESH_GENERATION_CANDIDATES = [
  {
    methodId: "auto-outline-v6a-local",
    sourceId: "outline-v6a-local-rgba",
    backendId: "v6a-local",
    dependencyGateStatus: "not-required",
    dependencyPackageIds: [],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6b-constrainautor",
    sourceId: "outline-v6b-constrainautor-rgba",
    backendId: "v6b-constrainautor",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["d3-contour", "simplify-js", "delaunator", "@kninnug/constrainautor"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6c-poly2tri",
    sourceId: "outline-v6c-poly2tri-rgba",
    backendId: "v6c-poly2tri",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["d3-contour", "simplify-js", "poly2tri"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6d-contour-constrainautor",
    sourceId: "outline-v6d-contour-constrainautor-rgba",
    backendId: "v6d-contour-constrainautor",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6d-contour-band-support-rings",
    sourceId: "outline-v6d-contour-band-support-rings-rgba",
    backendId: "v6d-contour-band-support-rings",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6d-adaptive-staggered-band",
    sourceId: "outline-v6d-adaptive-staggered-band-rgba",
    backendId: "v6d-adaptive-staggered-band",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
    sourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
    backendId: "v6d-adaptive-contour-constrainautor",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6e-contour-poly2tri",
    sourceId: "outline-v6e-contour-poly2tri-rgba",
    backendId: "v6e-contour-poly2tri",
    dependencyGateStatus: "available",
    dependencyPackageIds: ["poly2tri"],
    backendImplementationStatus: "implemented"
  },
  {
    methodId: "auto-outline-v6f-contour-custom-cdt",
    sourceId: "outline-v6f-contour-custom-cdt-rgba",
    backendId: "v6f-contour-custom-cdt",
    dependencyGateStatus: "not-required",
    dependencyPackageIds: [],
    backendImplementationStatus: "implemented"
  }
] as const satisfies readonly V6MeshGenerationCandidate[];

export const MESH_GENERATION_METHOD_IDS = [
  "manual-empty",
  "auto-grid-v1",
  "auto-outline-v1",
  "auto-outline-v2",
  "auto-outline-v2.5-soft-boundary",
  "auto-outline-v2.6-soft-apron",
  "auto-outline-v3-envelope",
  "auto-outline-v4-contour-band",
  ...V6_MESH_GENERATION_METHOD_IDS
] as const;

export type MeshGenerationMethod = (typeof MESH_GENERATION_METHOD_IDS)[number];
export type MeshDensityHint = "low" | "medium" | "high";

export const DRAWABLE_GENERATED_MESH_SOURCE_IDS = [
  ...V6_MESH_GENERATION_SOURCE_IDS,
  "outline-v4-contour-band-rgba",
  "outline-v3-envelope-rgba",
  "outline-v2-6-soft-apron-rgba",
  "outline-v2-5-soft-boundary-rgba",
  "outline-v2-rgba",
  "outline-rgba",
  "alpha-aware-rgba",
  "bounds-grid"
] as const;

export type DrawableGeneratedMeshSource = (typeof DRAWABLE_GENERATED_MESH_SOURCE_IDS)[number];

export const GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS = [
  "auto-grid-v1",
  "auto-outline-v1",
  "auto-outline-v2",
  "auto-outline-v2.5-soft-boundary",
  "auto-outline-v2.6-soft-apron",
  "auto-outline-v3-envelope",
  "auto-outline-v4-contour-band",
  ...V6_MESH_GENERATION_METHOD_IDS
] as const;

export type GeneratedMeshPreviewCommitMethod =
  (typeof GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS)[number];

export type MeshGenerationV6FallbackReason =
  | "v6-backend-not-implemented"
  | "v6-contour-extraction-failed"
  | "v6a-local-generation-failed"
  | "v6b-constrainautor-generation-failed"
  | "v6b-invalid-constraints"
  | "v6b-constraint-recovery-failed"
  | "v6b-backend-threw"
  | "v6b-unsupported-hole-region"
  | "v6c-poly2tri-generation-failed"
  | "v6c-poly2tri-polygon-invalid"
  | "v6c-poly2tri-hole-unsupported"
  | "v6c-poly2tri-multi-island-unsupported"
  | "v6c-poly2tri-triangulation-threw"
  | "v6c-poly2tri-boundary-missing"
  | "v6d-constrainautor-generation-failed"
  | "v6d-invalid-constraint-input"
  | "v6d-untriangulated-points"
  | "v6d-constraint-recovery-failed"
  | "v6d-backend-threw"
  | "v6d-support-ring-geometry-invalid"
  | "v6d-support-ring-constraint-recovery-failed"
  | "v6d-adaptive-staggered-band-geometry-invalid"
  | "v6d-adaptive-staggered-band-constraint-recovery-failed"
  | "v6e-poly2tri-generation-failed"
  | "v6e-poly2tri-polygon-invalid"
  | "v6e-poly2tri-triangulation-threw"
  | "v6f-custom-cdt-generation-failed"
  | "v6f-custom-cdt-constraint-recovery-failed"
  | "v6f-custom-cdt-local-improvement-rejected";

export type MeshGenerationFallbackReason =
  | "texture-bytes-unavailable"
  | MeshGenerationV6FallbackReason
  | AutoOutlineV4ContourBandFailureReason
  | AutoOutlineV3EnvelopeFailureReason
  | AutoOutlineV26SoftApronFailureReason
  | AutoOutlineV25SoftBoundaryFailureReason
  | AutoOutlineFailureReason;

export type MeshGenerationFallbackMethod =
  | V6MeshGenerationMethod
  | "auto-outline-v4-contour-band"
  | "auto-outline-v3-envelope"
  | "auto-outline-v2.6-soft-apron"
  | "auto-outline-v2.5-soft-boundary"
  | "auto-outline-v2"
  | "auto-outline-v1";

export interface MeshGenerationFallbackStep {
  readonly method: MeshGenerationFallbackMethod;
  readonly reason: MeshGenerationFallbackReason;
}

export const isV6MeshGenerationMethod = (method: string): method is V6MeshGenerationMethod =>
  (V6_MESH_GENERATION_METHOD_IDS as readonly string[]).includes(method);

export const getV6MeshGenerationCandidate = (
  method: V6MeshGenerationMethod
): V6MeshGenerationCandidate => {
  const candidate = V6_MESH_GENERATION_CANDIDATES.find((entry) => entry.methodId === method);
  if (candidate === undefined) {
    throw new Error(`Unknown v6 mesh generation method: ${method}`);
  }

  return candidate;
};

export const isGeneratedMeshPreviewCommitMethod = (
  method: string
): method is GeneratedMeshPreviewCommitMethod =>
  (GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS as readonly string[]).includes(method);
