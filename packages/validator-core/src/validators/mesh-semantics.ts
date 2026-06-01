import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  MeshDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type {
  EvaluatedDrawableDto,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface MeshSemanticValidationInput {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly requireRuntimeEvidence?: boolean;
}

interface MeshWithIndex {
  readonly mesh: MeshDto;
  readonly index: number;
}

interface DrawableWithIndex {
  readonly drawable: DrawableDto;
  readonly index: number;
}

interface MeshSemanticIndexes {
  readonly packageDocument: PackageDocumentDto;
  readonly meshes: readonly MeshWithIndex[];
  readonly drawables: readonly DrawableWithIndex[];
  readonly drawablesByMeshId: ReadonlyMap<string, DrawableWithIndex>;
  readonly runtimeDrawablesByDrawableId: ReadonlyMap<string, EvaluatedDrawableDto>;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
}

type DegenerateTriangleReason = "repeated-index" | "zero-area";
type MeshRuntimeEvidenceReason =
  | "runtime-snapshot-missing"
  | "runtime-drawable-missing"
  | "mesh-id-mismatch"
  | "vertex-count-mismatch"
  | "runtime-mesh-evidence-missing"
  | "runtime-mesh-evidence-inconsistent";

interface RuntimeMeshEvidenceLike {
  readonly drawableId?: string;
  readonly meshId?: string;
  readonly bounds?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly vertexHash?: string;
  readonly topology?: {
    readonly vertexCount?: number;
    readonly stableVertexIdCount?: number;
    readonly uvCount?: number;
    readonly triangleCount?: number;
    readonly triangleIndexCount?: number;
    readonly hasStableVertexIds?: boolean;
    readonly hasUvProjection?: boolean;
    readonly hasTriangles?: boolean;
  };
  readonly vertices?: readonly unknown[];
}

export const validateMeshSemantics = (
  input: MeshSemanticValidationInput
): readonly ValidationCheckResultDto[] => {
  const indexes = createMeshSemanticIndexes(input.packageDocument, input.runtimeSnapshot);
  const checks: ValidationCheckResultDto[] = [];

  for (const meshEntry of indexes.meshes) {
    checks.push(...validateMeshVertexTopology(meshEntry));
    checks.push(...validateMeshTriangles(meshEntry));
  }

  checks.push(...validateRuntimeMeshEvidence(indexes, input.requireRuntimeEvidence === true));

  return checks;
};

const createMeshSemanticIndexes = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): MeshSemanticIndexes => {
  const meshes = packageDocument.model.meshes.meshes.map((mesh, index) => ({ mesh, index }));
  const drawables = packageDocument.model.drawables.drawables.map((drawable, index) => ({ drawable, index }));

  return {
    packageDocument,
    meshes,
    drawables,
    drawablesByMeshId: new Map(drawables.map((entry) => [entry.drawable.meshId, entry])),
    runtimeDrawablesByDrawableId: new Map(
      runtimeSnapshot?.drawables.map((drawable) => [drawable.drawableId, drawable]) ?? []
    ),
    ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
  };
};

const validateMeshVertexTopology = (meshEntry: MeshWithIndex): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const vertexCount = meshEntry.mesh.vertices.length;

  if (meshEntry.mesh.vertexStableIds.length !== vertexCount) {
    checks.push(createVertexStableIdsLengthMismatchCheck(meshEntry));
  }

  if (meshEntry.mesh.uvs.length !== vertexCount) {
    checks.push(createUvCountMismatchCheck(meshEntry));
  }

  return checks;
};

const validateMeshTriangles = (meshEntry: MeshWithIndex): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  meshEntry.mesh.triangles.forEach((triangle, triangleIndex) => {
    const invalidIndexes = triangle
      .map((vertexIndex, cornerIndex) => ({ vertexIndex, cornerIndex }))
      .filter(({ vertexIndex }) => vertexIndex >= meshEntry.mesh.vertices.length);

    if (invalidIndexes.length > 0) {
      checks.push(
        ...invalidIndexes.map(({ vertexIndex, cornerIndex }) =>
          createTriangleIndexOutOfRangeCheck(meshEntry, triangleIndex, cornerIndex, vertexIndex)
        )
      );
      return;
    }

    const degenerateReason = getDegenerateTriangleReason(meshEntry.mesh, triangle);
    if (degenerateReason !== undefined) {
      checks.push(createDegenerateTriangleCheck(meshEntry, triangleIndex, degenerateReason));
    }
  });

  return checks;
};

const getDegenerateTriangleReason = (
  mesh: MeshDto,
  triangle: readonly [number, number, number]
): DegenerateTriangleReason | undefined => {
  if (new Set(triangle).size < 3) {
    return "repeated-index";
  }

  const [aIndex, bIndex, cIndex] = triangle;
  const a = mesh.vertices[aIndex]!;
  const b = mesh.vertices[bIndex]!;
  const c = mesh.vertices[cIndex]!;
  const signedDoubleArea =
    (b.x - a.x) * (c.y - a.y) -
    (b.y - a.y) * (c.x - a.x);

  return signedDoubleArea === 0 ? "zero-area" : undefined;
};

const validateRuntimeMeshEvidence = (
  indexes: MeshSemanticIndexes,
  requireRuntimeEvidence: boolean
): readonly ValidationCheckResultDto[] => {
  const visibleDrawableEntries = indexes.drawables.filter((entry) => entry.drawable.runtimeVisibility);
  if (visibleDrawableEntries.length === 0) {
    return [];
  }

  const requiresMeshRuntimeEvidence =
    requireRuntimeEvidence && packageRequiresMeshRuntimeEvidence(indexes.packageDocument);

  if (indexes.runtimeSnapshot === undefined) {
    return requiresMeshRuntimeEvidence
      ? [createRuntimeSnapshotMissingCheck(indexes, visibleDrawableEntries)]
      : [];
  }

  const runtimeSnapshot = indexes.runtimeSnapshot;
  const validateSuppliedMeshEvidence =
    requiresMeshRuntimeEvidence || runtimeSnapshot.drawables.some((drawable) => getRuntimeMeshEvidence(drawable) !== undefined);
  if (!validateSuppliedMeshEvidence) {
    return [];
  }

  return visibleDrawableEntries.flatMap((drawableEntry) => {
    const meshEntry = indexes.meshes.find((entry) => entry.mesh.meshId === drawableEntry.drawable.meshId);
    if (meshEntry === undefined) {
      return [];
    }

    const runtimeDrawable = indexes.runtimeDrawablesByDrawableId.get(drawableEntry.drawable.drawableId);
    if (runtimeDrawable === undefined) {
      return requiresMeshRuntimeEvidence
        ? [
            createRuntimeMeshEvidenceCheck({
              indexes,
              meshEntry,
              drawableEntry,
              reason: "runtime-drawable-missing",
              message: `Runtime snapshot ${runtimeSnapshot.snapshotId} is missing drawable mesh evidence for ${drawableEntry.drawable.drawableId}.`,
              evidence: [
                `drawableId=${drawableEntry.drawable.drawableId}`,
                `meshId=${meshEntry.mesh.meshId}`,
                `snapshotId=${runtimeSnapshot.snapshotId}`,
                "runtimeDrawableMatch=missing"
              ],
              targetPath: "drawables"
            })
          ]
        : [];
    }

    const runtimeMesh = getRuntimeMeshEvidence(runtimeDrawable);

    if (runtimeDrawable.meshId !== meshEntry.mesh.meshId) {
      return [
        createRuntimeMeshEvidenceCheck({
          indexes,
          meshEntry,
          drawableEntry,
          reason: "mesh-id-mismatch",
          message: `Runtime snapshot ${runtimeSnapshot.snapshotId} mesh evidence disagrees for drawable ${drawableEntry.drawable.drawableId}.`,
          evidence: [
            `drawableId=${drawableEntry.drawable.drawableId}`,
            `packageMeshId=${meshEntry.mesh.meshId}`,
            `runtimeMeshId=${runtimeDrawable.meshId}`,
            `snapshotId=${runtimeSnapshot.snapshotId}`
          ],
          targetPath: `drawables/${getRuntimeDrawableIndex(runtimeSnapshot, runtimeDrawable)}`
        })
      ];
    }

    if (runtimeDrawable.vertexCount !== meshEntry.mesh.vertices.length) {
      return [
        createRuntimeMeshEvidenceCheck({
          indexes,
          meshEntry,
          drawableEntry,
          reason: "vertex-count-mismatch",
          message: `Runtime snapshot ${runtimeSnapshot.snapshotId} vertex count evidence disagrees for mesh ${meshEntry.mesh.meshId}.`,
          evidence: [
            `drawableId=${drawableEntry.drawable.drawableId}`,
            `meshId=${meshEntry.mesh.meshId}`,
            `packageVertexCount=${meshEntry.mesh.vertices.length}`,
            `runtimeVertexCount=${runtimeDrawable.vertexCount}`,
            `snapshotId=${runtimeSnapshot.snapshotId}`
          ],
          targetPath: `drawables/${getRuntimeDrawableIndex(runtimeSnapshot, runtimeDrawable)}/vertexCount`
        })
      ];
    }

    if (runtimeMesh === undefined) {
      return [
        createRuntimeMeshEvidenceCheck({
          indexes,
          meshEntry,
          drawableEntry,
          reason: "runtime-mesh-evidence-missing",
          message: `Runtime snapshot ${runtimeSnapshot.snapshotId} is missing per-drawable mesh evidence for ${meshEntry.mesh.meshId}.`,
          evidence: [
            `drawableId=${drawableEntry.drawable.drawableId}`,
            `meshId=${meshEntry.mesh.meshId}`,
            `snapshotId=${runtimeSnapshot.snapshotId}`,
            "runtimeDrawableMeshEvidence=missing"
          ],
          targetPath: `drawables/${getRuntimeDrawableIndex(runtimeSnapshot, runtimeDrawable)}/mesh`
        })
      ];
    }

    const mismatches = collectRuntimeMeshEvidenceMismatches({
      meshEntry,
      drawableEntry,
      runtimeDrawable,
      runtimeMesh
    });
    if (mismatches.length > 0) {
      return [
        createRuntimeMeshEvidenceCheck({
          indexes,
          meshEntry,
          drawableEntry,
          reason: "runtime-mesh-evidence-inconsistent",
          message: `Runtime snapshot ${runtimeSnapshot.snapshotId} per-drawable mesh evidence is inconsistent for ${meshEntry.mesh.meshId}.`,
          evidence: [
            `drawableId=${drawableEntry.drawable.drawableId}`,
            `meshId=${meshEntry.mesh.meshId}`,
            `snapshotId=${runtimeSnapshot.snapshotId}`,
            ...mismatches
          ],
          targetPath: `drawables/${getRuntimeDrawableIndex(runtimeSnapshot, runtimeDrawable)}/mesh`
        })
      ];
    }

    return [];
  });
};

const packageRequiresMeshRuntimeEvidence = (packageDocument: PackageDocumentDto): boolean => {
  const editorState = packageDocument.model.editorState;
  if (editorState === undefined) {
    return false;
  }

  if (editorState.activeTool === "meshEdit") {
    return true;
  }

  const vertexStableIds = new Set(packageDocument.model.meshes.meshes.flatMap((mesh) => mesh.vertexStableIds));
  return editorState.selection.some((targetId) => vertexStableIds.has(targetId));
};

const getRuntimeMeshEvidence = (runtimeDrawable: EvaluatedDrawableDto): RuntimeMeshEvidenceLike | undefined =>
  (runtimeDrawable as EvaluatedDrawableDto & { readonly mesh?: RuntimeMeshEvidenceLike }).mesh;

const collectRuntimeMeshEvidenceMismatches = (input: {
  readonly meshEntry: MeshWithIndex;
  readonly drawableEntry: DrawableWithIndex;
  readonly runtimeDrawable: EvaluatedDrawableDto;
  readonly runtimeMesh: RuntimeMeshEvidenceLike;
}): readonly string[] => {
  const mismatches: string[] = [];
  const drawable = input.drawableEntry.drawable;
  const topology = input.runtimeMesh.topology;

  addMismatch(mismatches, "drawable-id", drawable.drawableId, input.runtimeMesh.drawableId);
  addMismatch(mismatches, "mesh-id", input.meshEntry.mesh.meshId, input.runtimeMesh.meshId);
  addRectMismatch(mismatches, "bounds", input.runtimeDrawable.bounds, input.runtimeMesh.bounds);
  addMismatch(mismatches, "vertex-hash", input.runtimeDrawable.vertexHash, input.runtimeMesh.vertexHash);

  if (topology === undefined) {
    mismatches.push("mismatch=topology:expected=present,actual=missing");
    return mismatches;
  }

  addMismatch(mismatches, "topology.vertexCount", input.runtimeDrawable.vertexCount, topology.vertexCount);
  addMismatch(mismatches, "topology.triangleIndexCount", (topology.triangleCount ?? 0) * 3, topology.triangleIndexCount);
  addMismatch(
    mismatches,
    "topology.hasStableVertexIds",
    (topology.stableVertexIdCount ?? 0) > 0,
    topology.hasStableVertexIds
  );
  addMismatch(mismatches, "topology.hasUvProjection", (topology.uvCount ?? 0) > 0, topology.hasUvProjection);
  addMismatch(mismatches, "topology.hasTriangles", (topology.triangleCount ?? 0) > 0, topology.hasTriangles);

  if (input.runtimeMesh.vertices !== undefined && input.runtimeMesh.vertices.length > 0) {
    addMismatch(mismatches, "vertices.length", topology.vertexCount, input.runtimeMesh.vertices.length);
  }

  return mismatches;
};

const addMismatch = (
  mismatches: string[],
  field: string,
  expected: string | number | boolean | undefined,
  actual: string | number | boolean | undefined
): void => {
  if (expected !== actual) {
    mismatches.push(`mismatch=${field}:expected=${expected ?? "missing"},actual=${actual ?? "missing"}`);
  }
};

const addRectMismatch = (
  mismatches: string[],
  field: string,
  expected: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  actual: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined
): void => {
  if (
    actual === undefined ||
    expected.x !== actual.x ||
    expected.y !== actual.y ||
    expected.width !== actual.width ||
    expected.height !== actual.height
  ) {
    mismatches.push(
      `mismatch=${field}:expected=${formatRect(expected)},actual=${actual === undefined ? "missing" : formatRect(actual)}`
    );
  }
};

const formatRect = (
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): string => `${rect.x},${rect.y},${rect.width},${rect.height}`;

const getRuntimeDrawableIndex = (
  runtimeSnapshot: RuntimeSnapshotDto,
  runtimeDrawable: EvaluatedDrawableDto
): number =>
  runtimeSnapshot.drawables.findIndex((drawable) => drawable.drawableId === runtimeDrawable.drawableId);

const createVertexStableIdsLengthMismatchCheck = (meshEntry: MeshWithIndex): ValidationCheckResultDto => {
  const targetPath = `/model/meshes/meshes/${meshEntry.index}/vertexStableIds`;

  return ValidationCheckResultSchema.parse({
    checkId: "mesh.vertexStableIdsLengthMismatch",
    status: "fail",
    severity: "error",
    phase: "mesh_semantic",
    target: {
      kind: "mesh",
      id: meshEntry.mesh.meshId,
      path: targetPath
    },
    targetPath,
    message: `Mesh ${meshEntry.mesh.meshId} vertexStableIds length does not match vertices length.`,
    evidence: [
      `meshId=${meshEntry.mesh.meshId}`,
      `vertexCount=${meshEntry.mesh.vertices.length}`,
      `vertexStableIdsCount=${meshEntry.mesh.vertexStableIds.length}`,
      "reason=vertex-stable-id-count-mismatch"
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "Mesh edit operations cannot map authored vertices to stable vertex references until every vertex has one stable ID."
  });
};

const createUvCountMismatchCheck = (meshEntry: MeshWithIndex): ValidationCheckResultDto => {
  const targetPath = `/model/meshes/meshes/${meshEntry.index}/uvs`;

  return ValidationCheckResultSchema.parse({
    checkId: "mesh.uvCountMismatch",
    status: "fail",
    severity: "error",
    phase: "mesh_semantic",
    target: {
      kind: "mesh",
      id: meshEntry.mesh.meshId,
      path: targetPath
    },
    targetPath,
    message: `Mesh ${meshEntry.mesh.meshId} UV count does not match vertices length.`,
    evidence: [
      `meshId=${meshEntry.mesh.meshId}`,
      `vertexCount=${meshEntry.mesh.vertices.length}`,
      `uvCount=${meshEntry.mesh.uvs.length}`,
      "reason=uv-count-mismatch"
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "The validator cannot prove deterministic texture projection while mesh vertex and UV counts disagree."
  });
};

const createTriangleIndexOutOfRangeCheck = (
  meshEntry: MeshWithIndex,
  triangleIndex: number,
  cornerIndex: number,
  vertexIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/meshes/meshes/${meshEntry.index}/triangles/${triangleIndex}/${cornerIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "mesh.triangleIndexOutOfRange",
    status: "fail",
    severity: "blocking",
    phase: "mesh_semantic",
    target: {
      kind: "mesh",
      id: meshEntry.mesh.meshId,
      path: targetPath
    },
    targetPath,
    message: `Mesh ${meshEntry.mesh.meshId} triangle ${triangleIndex} references missing vertex index ${vertexIndex}.`,
    evidence: [
      `meshId=${meshEntry.mesh.meshId}`,
      `triangleIndex=${triangleIndex}`,
      `triangle=${meshEntry.mesh.triangles[triangleIndex]!.join(",")}`,
      `cornerIndex=${cornerIndex}`,
      `vertexIndex=${vertexIndex}`,
      `vertexCount=${meshEntry.mesh.vertices.length}`
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "Runtime mesh evaluation cannot safely read triangle vertices while a triangle index is out of range."
  });
};

const createDegenerateTriangleCheck = (
  meshEntry: MeshWithIndex,
  triangleIndex: number,
  reason: DegenerateTriangleReason
): ValidationCheckResultDto => {
  const targetPath = `/model/meshes/meshes/${meshEntry.index}/triangles/${triangleIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "mesh.degenerateTriangle",
    status: "warning",
    severity: "warning",
    phase: "mesh_semantic",
    target: {
      kind: "mesh",
      id: meshEntry.mesh.meshId,
      path: targetPath
    },
    targetPath,
    message: `Mesh ${meshEntry.mesh.meshId} triangle ${triangleIndex} is degenerate.`,
    evidence: [
      `meshId=${meshEntry.mesh.meshId}`,
      `triangleIndex=${triangleIndex}`,
      `triangle=${meshEntry.mesh.triangles[triangleIndex]!.join(",")}`,
      `reason=${reason}`
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "The mesh may still load, but a zero-area triangle cannot contribute stable renderable surface evidence."
  });
};

const createRuntimeSnapshotMissingCheck = (
  indexes: MeshSemanticIndexes,
  visibleDrawableEntries: readonly DrawableWithIndex[]
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "mesh.runtimeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "representative_evaluation",
    target: {
      kind: "package",
      id: indexes.packageDocument.manifest.packageId,
      path: "/runtime/snapshots"
    },
    targetPath: "/runtime/snapshots",
    message: "Runtime snapshot mesh evidence is required but missing.",
    evidence: [
      "runtimeSnapshot=missing",
      `runtimeVisibleDrawableCount=${visibleDrawableEntries.length}`,
      `drawableIds=${visibleDrawableEntries.map((entry) => entry.drawable.drawableId).join(",")}`,
      "reason=runtime-snapshot-missing"
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "Validator cannot prove runtime/viewer mesh renderability without snapshot drawable mesh evidence."
  });

const createRuntimeMeshEvidenceCheck = (input: {
  readonly indexes: MeshSemanticIndexes;
  readonly meshEntry: MeshWithIndex;
  readonly drawableEntry: DrawableWithIndex;
  readonly reason: MeshRuntimeEvidenceReason;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly targetPath: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "mesh.runtimeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "representative_evaluation",
    target: {
      kind: "runtimeSnapshot",
      id: input.indexes.runtimeSnapshot!.snapshotId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...input.evidence,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-MESH-006", "SC-MVP-004"],
    impact: "Validator cannot prove runtime/viewer mesh renderability while runtime drawable mesh evidence is absent or inconsistent.",
    snapshotIds: [input.indexes.runtimeSnapshot!.snapshotId as RuntimeSnapshotId]
  });
