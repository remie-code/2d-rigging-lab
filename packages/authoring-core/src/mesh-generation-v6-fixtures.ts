import type { RectDto } from "@private-2d-rigging-lab/contracts";

export const V6_MESH_GENERATION_CONTRACT_FIXTURE_IDS = [
  "v6-simple-rectangle",
  "v6-curved-blob",
  "v6-thin-tapered",
  "v6-hole-like",
  "v6-empty-alpha-fallback"
] as const;

export type V6MeshGenerationContractFixtureId =
  (typeof V6_MESH_GENERATION_CONTRACT_FIXTURE_IDS)[number];

export interface V6MeshGenerationContractFixture {
  readonly fixtureId: V6MeshGenerationContractFixtureId;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly opaquePixels: readonly (readonly [number, number])[];
  readonly expectedAlphaState: "non-empty" | "empty";
  readonly expectedShapeFeatures: readonly (
    | "simple-outer-boundary"
    | "curved-boundary"
    | "thin-tip"
    | "transparent-interior"
    | "fallback-alpha-empty"
  )[];
}

export const V6_MESH_GENERATION_CONTRACT_FIXTURES: readonly V6MeshGenerationContractFixture[] = [
  {
    fixtureId: "v6-simple-rectangle",
    textureSize: { width: 20, height: 16 },
    meshBounds: { x: 0, y: 0, width: 20, height: 16 },
    opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12),
    expectedAlphaState: "non-empty",
    expectedShapeFeatures: ["simple-outer-boundary"]
  },
  {
    fixtureId: "v6-curved-blob",
    textureSize: { width: 32, height: 28 },
    meshBounds: { x: 0, y: 0, width: 32, height: 28 },
    opaquePixels: createPixelsFromPredicate(32, 28, (x, y) => {
      const dx = (x - 14.5) / 9;
      const dy = (y - 13.5) / 7;
      const blob = dx * dx + dy * dy <= 1;
      const softLobe = x >= 20 && x <= 25 && y >= 11 && y <= 17;
      return blob || softLobe;
    }),
    expectedAlphaState: "non-empty",
    expectedShapeFeatures: ["curved-boundary"]
  },
  {
    fixtureId: "v6-thin-tapered",
    textureSize: { width: 28, height: 34 },
    meshBounds: { x: 0, y: 0, width: 28, height: 34 },
    opaquePixels: createPixelsFromPredicate(28, 34, (x, y) => {
      if (y < 4 || y > 30) {
        return false;
      }

      const center = 14;
      const halfWidth = Math.max(1, Math.floor((31 - y) / 5));
      return Math.abs(x - center) <= halfWidth;
    }),
    expectedAlphaState: "non-empty",
    expectedShapeFeatures: ["thin-tip"]
  },
  {
    fixtureId: "v6-hole-like",
    textureSize: { width: 30, height: 26 },
    meshBounds: { x: 0, y: 0, width: 30, height: 26 },
    opaquePixels: createPixelsFromPredicate(30, 26, (x, y) => {
      const outer = x >= 4 && x <= 25 && y >= 4 && y <= 21;
      const transparentInterior = x >= 12 && x <= 17 && y >= 10 && y <= 15;
      return outer && !transparentInterior;
    }),
    expectedAlphaState: "non-empty",
    expectedShapeFeatures: ["simple-outer-boundary", "transparent-interior"]
  },
  {
    fixtureId: "v6-empty-alpha-fallback",
    textureSize: { width: 16, height: 16 },
    meshBounds: { x: 0, y: 0, width: 16, height: 16 },
    opaquePixels: [],
    expectedAlphaState: "empty",
    expectedShapeFeatures: ["fallback-alpha-empty"]
  }
];

export const getV6MeshGenerationContractFixture = (
  fixtureId: V6MeshGenerationContractFixtureId
): V6MeshGenerationContractFixture => {
  const fixture = V6_MESH_GENERATION_CONTRACT_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixture === undefined) {
    throw new Error(`Unknown v6 mesh generation fixture: ${fixtureId}`);
  }

  return fixture;
};

export const createV6MeshGenerationFixtureRgbaBytes = (
  fixture: V6MeshGenerationContractFixture
): Uint8Array => createRgbaBytes(fixture.textureSize.width, fixture.textureSize.height, fixture.opaquePixels);

function createPixelsFromPredicate(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): readonly (readonly [number, number])[] {
  const pixels: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) {
        pixels.push([x, y]);
      }
    }
  }

  return pixels;
}

function createRgbaBytes(
  width: number,
  height: number,
  opaquePixels: readonly (readonly [number, number])[]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  for (const [x, y] of opaquePixels) {
    const index = (y * width + x) * 4;
    bytes[index] = 255;
    bytes[index + 1] = 255;
    bytes[index + 2] = 255;
    bytes[index + 3] = 255;
  }

  return bytes;
}
