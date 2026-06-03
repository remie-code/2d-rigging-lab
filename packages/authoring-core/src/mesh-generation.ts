import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

export type MeshGenerationMethod = "manual-empty" | "auto-grid-v1";
export type MeshDensityHint = "low" | "medium" | "high";

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
