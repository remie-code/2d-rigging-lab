import type { RenderMesh } from "@private-2d-rigging-lab/render-core";

export interface WebGl2MeshUpload {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly indexElementType: "uint16" | "uint32";
}

export const createWebGl2MeshUpload = (mesh: RenderMesh): WebGl2MeshUpload | undefined => {
  const vertexCount = Math.min(mesh.vertices.length, mesh.uvs.length);
  if (vertexCount === 0 || mesh.triangles.length === 0) {
    return undefined;
  }

  const vertices = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    const position = mesh.vertices[index];
    const uv = mesh.uvs[index];
    if (position === undefined || uv === undefined) {
      return undefined;
    }

    const offset = index * 4;
    vertices[offset] = position.x;
    vertices[offset + 1] = position.y;
    vertices[offset + 2] = uv.x;
    vertices[offset + 3] = uv.y;
  }

  const validIndices: number[] = [];
  for (const triangle of mesh.triangles) {
    if (
      triangle[0] < 0 ||
      triangle[1] < 0 ||
      triangle[2] < 0 ||
      triangle[0] >= vertexCount ||
      triangle[1] >= vertexCount ||
      triangle[2] >= vertexCount
    ) {
      continue;
    }

    validIndices.push(triangle[0], triangle[1], triangle[2]);
  }

  if (validIndices.length === 0) {
    return undefined;
  }

  return vertexCount > 65535
    ? {
        vertices,
        indices: new Uint32Array(validIndices),
        indexElementType: "uint32"
      }
    : {
        vertices,
        indices: new Uint16Array(validIndices),
        indexElementType: "uint16"
      };
};
