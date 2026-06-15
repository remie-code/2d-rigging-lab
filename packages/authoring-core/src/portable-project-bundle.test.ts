import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  type BinaryAssetReferenceDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createInitialAuthoringRevision,
  exportAuthoringSessionPortableBundle,
  importAuthoringSessionPortableBundle,
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession
} from "./index.js";

const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("authoring portable project bundle adapter", () => {
  it("round-trips texture bytes, mesh, warp and rotation deformers, parameters, and keyforms", async () => {
    const textureBinaryAssetRef = createTextureBinaryAssetReference();
    const session = createRiggedTextureSession(textureBinaryAssetRef);

    registerAuthoringSessionBinaryBytes(session, {
      binaryAssetRef: textureBinaryAssetRef,
      bytes: TEXTURE_BYTES,
      role: "texture-raster-v1",
      sourceAssetId: SourceAssetIdSchema.parse("src_layered_fixture"),
      textureId: TextureIdSchema.parse("tex_head")
    });

    const exported = await exportAuthoringSessionPortableBundle({
      session,
      updatedAt: "2026-06-15T01:00:00.000Z"
    });
    const imported = await importAuthoringSessionPortableBundle({
      bundle: exported.bundleJson
    });
    const exportedDocument = PackageDocumentSchema.parse(exported.packageDocument);

    expect(exported.binaryPayloadCount).toBe(1);
    expect(exportedDocument.assets.textureAtlas?.textures[0]?.binaryAssetRef).toEqual(
      textureBinaryAssetRef
    );
    expect(imported.session.graph.meshes).toEqual(session.graph.meshes);
    expect(imported.session.graph.rigControls).toEqual(session.graph.rigControls);
    expect(imported.session.graph.parameters).toEqual(session.graph.parameters);
    expect(imported.session.graph.keyformSets).toEqual(session.graph.keyformSets);
    expect(imported.session.graph.textureAtlas).toEqual(session.graph.textureAtlas);
    expect(imported.session.binaryAssets?.fileEntries).toHaveLength(1);
    expect(Array.from(imported.session.binaryAssets?.fileEntries[0]?.bytes ?? [])).toEqual([
      0x61,
      0x62,
      0x63
    ]);
    expect(imported.session.binaryAssets?.binaryAssetIndex.assets[0]).toMatchObject({
      binaryAssetId: textureBinaryAssetRef.binaryAssetId,
      role: "texture-raster-v1",
      packageRelativePath: textureBinaryAssetRef.packageRelativePath,
      textureId: "tex_head"
    });
    expect(imported.session.dirty).toBe(false);
  });
});

function createTextureBinaryAssetReference(): BinaryAssetReferenceDto {
  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_texture_head",
    packageRelativePath: "assets/textures/head.png",
    digest: {
      algorithm: "sha256",
      hex: TEXTURE_BYTES_SHA256_HEX
    },
    byteLength: TEXTURE_BYTES.byteLength,
    mediaType: "image/png; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_texture_head"),
    rightsAssetId: "rights_texture_head"
  });
}

function createRiggedTextureSession(
  textureBinaryAssetRef: BinaryAssetReferenceDto
): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_wave72_portable_roundtrip"),
      packageDisplayName: "Wave72 Portable Roundtrip",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 4,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: true,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 256, height: 256 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_head")],
          children: [
            {
              kind: "drawable",
              drawableId: DrawableIdSchema.parse("draw_head")
            }
          ]
        }
      ],
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_head"),
          displayName: "Head",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_layered_fixture"),
          textureId: TextureIdSchema.parse("tex_head"),
          meshId: MeshIdSchema.parse("mesh_head"),
          defaultOpacity: 0.9,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_texture_head")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_head"),
          drawableId: DrawableIdSchema.parse("draw_head"),
          vertices: [
            { x: 0, y: 0 },
            { x: 64, y: 0 },
            { x: 64, y: 64 },
            { x: 0, y: 64 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 }
          ],
          triangles: [
            [0, 1, 2],
            [0, 2, 3]
          ],
          vertexStableIds: ["vtx_head_0", "vtx_head_1", "vtx_head_2", "vtx_head_3"],
          triangleStableIds: [
            TriangleIdSchema.parse("tri_head_0"),
            TriangleIdSchema.parse("tri_head_1")
          ],
          topologyRevision: 2,
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_texture_head")
        }
      ],
      parameters: [
        {
          parameterId: ParameterIdSchema.parse("param_angle_x"),
          displayName: "Angle X",
          valueSource: "authoredInput",
          min: -1,
          default: 0,
          max: 1,
          recommendedUiStep: 0.01
        }
      ],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_rotate_angle_x"),
          target: {
            kind: "rigControl",
            id: RigControlIdSchema.parse("rig_head_rotate"),
            property: "angleDegrees"
          },
          parameterId: ParameterIdSchema.parse("param_angle_x"),
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            { value: -1, statePatch: -20 },
            { value: 1, statePatch: 20 }
          ]
        },
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_warp_angle_x"),
          target: {
            kind: "rigControl",
            id: RigControlIdSchema.parse("rig_head_warp"),
            property: "controlPointOffsets"
          },
          parameterId: ParameterIdSchema.parse("param_angle_x"),
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 1,
          keys: [
            {
              value: -1,
              statePatch: [
                { x: -2, y: 0 },
                { x: -1, y: 0 },
                { x: -2, y: 1 },
                { x: -1, y: 1 }
              ]
            },
            {
              value: 1,
              statePatch: [
                { x: 2, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: -1 },
                { x: 1, y: -1 }
              ]
            }
          ]
        },
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_draw_head_opacity"),
          target: {
            kind: "drawable",
            id: DrawableIdSchema.parse("draw_head"),
            property: "opacity"
          },
          parameterId: ParameterIdSchema.parse("param_angle_x"),
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 2,
          keys: [
            { value: -1, statePatch: 0.5 },
            { value: 1, statePatch: 1 }
          ]
        }
      ],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_head_rotate"),
          displayName: "Head Rotate",
          partId: PartIdSchema.parse("part_root"),
          childDrawableIds: [],
          childRigControlIds: [RigControlIdSchema.parse("rig_head_warp")],
          opacityMultiplier: 0.95,
          pivot: { x: 32, y: 32 },
          restAngleDegrees: 5,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        },
        {
          kind: "warpLattice2d",
          rigControlId: RigControlIdSchema.parse("rig_head_warp"),
          displayName: "Head Warp",
          partId: PartIdSchema.parse("part_root"),
          parentId: RigControlIdSchema.parse("rig_head_rotate"),
          childDrawableIds: [DrawableIdSchema.parse("draw_head")],
          childRigControlIds: [],
          opacityMultiplier: 0.85,
          bindSpace: "rigControlLocalRest",
          domainBounds: { x: 0, y: 0, width: 64, height: 64 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: [
            { x: 0, y: 0 },
            { x: 64, y: 0 },
            { x: 0, y: 64 },
            { x: 64, y: 64 }
          ],
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: DrawableIdSchema.parse("draw_head"),
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [RigControlIdSchema.parse("rig_head_rotate")],
      stableOrder: [
        "part_root",
        "draw_head",
        "mesh_head",
        "param_angle_x",
        "rig_head_rotate",
        "rig_head_warp"
      ],
      sourceAssets: [
        {
          sourceAssetId: SourceAssetIdSchema.parse("src_layered_fixture"),
          kind: "generated-fixture-v1",
          filePath: "assets/sources/layered-fixture.json",
          contentHash: "sha256:layered-fixture",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: []
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_head"),
            filePath: "assets/textures/head.png",
            contentHash: `sha256:${TEXTURE_BYTES_SHA256_HEX}`,
            sourceAssetId: SourceAssetIdSchema.parse("src_layered_fixture"),
            sourceLayerId: "layer_head",
            provenanceId: ProvenanceIdSchema.parse("prov_texture_head"),
            binaryAssetRef: textureBinaryAssetRef
          }
        ]
      },
      provenanceRecords: [
        {
          provenanceId: ProvenanceIdSchema.parse("prov_texture_head"),
          assetId: "tex_head",
          assetKind: "texture",
          filePath: "assets/textures/head.png",
          contentHash: `sha256:${TEXTURE_BYTES_SHA256_HEX}`,
          creator: "test fixture",
          license: "private-local",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ],
      rightsRecords: [
        {
          assetId: "rights_texture_head",
          rightsStatus: "cleared",
          license: "private-local",
          redistributionAllowed: false
        }
      ]
    }
  };
}
