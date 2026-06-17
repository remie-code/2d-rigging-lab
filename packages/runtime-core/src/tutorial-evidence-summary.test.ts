import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  RigControlIdSchema,
  RuntimeSnapshotIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type {
  NormalizedDrawable,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { buildRuntimeEvidence } from "./runtime-evidence.js";
import { RuntimeSnapshotSchema } from "./snapshot.js";
import {
  createTutorialRuntimeViewerEvidenceSummary,
  createTutorialSnapshotEvidenceSummary,
  TutorialMaskRelationEvidenceRefSchema
} from "./tutorial-evidence-summary.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("tutorial runtime/viewer evidence summary", () => {
  it("reports tutorial mini model semantic evidence without claiming rendered correctness", () => {
    const baselineGraph = createTutorialGraph({ editedFaceMesh: false });
    const finalGraph = createTutorialGraph({ editedFaceMesh: true });
    const runtimeEvidence = buildRuntimeEvidence({
      baselineGraph,
      candidateGraph: finalGraph,
      baseline: {
        frame: {
          frameIndex: 0,
          authoredParameterValues: { param_headYaw: 0 },
          targetIds: ["draw_face", "mesh_face", "rig_head", "dyn_hairSway"]
        }
      },
      candidate: {
        frame: {
          frameIndex: 1,
          authoredParameterValues: { param_headYaw: 0 },
          targetIds: ["draw_face", "mesh_face", "rig_head", "dyn_hairSway"]
        }
      },
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      context: {
        source: { surface: "validator", operationId: "op_wave30_tutorial_runtime_summary" },
        policy: { strictness: "strict" }
      },
      artifactLabel: "wave30-tutorial-runtime-summary"
    });
    const viewerResult = evaluateViewerRuntimeSnapshot(finalGraph, {
      baselineFrameIndex: 10,
      frameIndex: 11,
      baselineParameterOverrides: { param_headYaw: 0 },
      parameterOverrides: { param_headYaw: 0 },
      operationId: "op_wave30_tutorial_viewer_summary",
      strictness: "strict",
      targetIds: ["draw_face", "mesh_face", "rig_head", "dyn_hairSway"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    });

    const summary = createTutorialRuntimeViewerEvidenceSummary({ runtimeEvidence, viewerResult });

    expect(summary.semanticReadiness).toMatchObject({
      status: "ready",
      ready: true,
      missingSlices: []
    });
    expect(summary.semanticReadiness.presentSlices).toEqual([
      "parts",
      "layers",
      "drawables",
      "meshes",
      "meshEdits",
      "maskOpacity",
      "rigControls",
      "rigControlKeyforms",
      "dynamics"
    ]);
    expect(summary.runtimeSummary.meshEdits.refs).toEqual([
      {
        drawableId: "draw_face",
        meshId: "mesh_face",
        boundsChanged: true,
        vertexHashChanged: true,
        movedVertexRefs: ["mesh_face.v_face_1", "mesh_face.v_face_2"]
      }
    ]);
    expect(summary.runtimeSummary.maskOpacity).toMatchObject({
      present: true,
      maskRelationCount: 1,
      nonDefaultOpacityDrawableIds: ["draw_face"]
    });
    expect(summary.runtimeSummary.rigControls.refs).toEqual([
      expect.objectContaining({
        rigControlId: "rig_head",
        kind: "rotation2d",
        evaluationStatus: "evaluated",
        affectedDrawableIds: ["draw_eye", "draw_face", "draw_hair"]
      })
    ]);
    expect(summary.runtimeSummary.rigControlKeyforms.refs).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_headYaw",
        target: "rigControl:rig_head.angleDegrees",
        sampledCoordinates: { param_headYaw: 0 }
      })
    ]);
    expect(summary.runtimeSummary.dynamics.refs).toEqual([
      expect.objectContaining({
        dynamicsGroupId: "dyn_hairSway",
        inputParameterIds: ["param_headYaw"],
        outputParameterId: "param_hairSway"
      })
    ]);
    expect(summary.viewerSummary.source).toBe("viewer");
    expect(viewerResult.evidence.tutorialEvidenceSummary.semanticReadiness.presentSlices).toContain("rigControlKeyforms");
    expect(summary.renderedCorrectness).toEqual({
      status: "not_evaluated",
      fullRenderer: false,
      pixelOracle: false,
      textureSamplingCorrectness: false,
      basis: "semanticRuntimeEvidenceOnly"
    });
  });

  it("keeps hash-only mesh edit readiness aligned with mesh edit refs", () => {
    const drawableId = DrawableIdSchema.parse("draw_hashOnly");
    const meshId = MeshIdSchema.parse("mesh_hashOnly");
    const snapshot = RuntimeSnapshotSchema.parse({
      schemaVersion: "runtime-snapshot-v1",
      runtimeCoreVersion: "test",
      snapshotId: "snap_hashOnly_001",
      context: {
        source: { surface: "validator" },
        policy: { strictness: "strict" }
      },
      packageId: "pkg_tutorialEvidence",
      packageRevision: 3,
      dirty: false,
      evaluation: {
        snapshotDetail: "summary",
        evaluatorVersions: {}
      },
      parameters: [],
      dynamics: [],
      keyformSamples: [],
      rigControls: [],
      parts: [],
      drawables: [
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          evaluatedDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 3, height: 2 },
          vertexCount: 4,
          vertexHash: "hash_after",
          diagnostics: []
        }
      ],
      masks: [],
      drawList: [drawableId],
      disabledFutureLayers: [],
      diagnostics: []
    });

    const summary = createTutorialSnapshotEvidenceSummary({
      source: "runtime",
      snapshot,
      meshEditEvidence: {
        schemaVersion: "runtime-mesh-edit-evidence-v1",
        baselineSnapshotId: RuntimeSnapshotIdSchema.parse("snap_hashOnly_000"),
        candidateSnapshotId: RuntimeSnapshotIdSchema.parse("snap_hashOnly_001"),
        drawables: [
          {
            drawableId,
            meshId,
            boundsBefore: { x: 0, y: 0, width: 2, height: 2 },
            boundsAfter: { x: 0, y: 0, width: 3, height: 2 },
            vertexHashBefore: "hash_before",
            vertexHashAfter: "hash_after",
            boundsChanged: true,
            vertexHashChanged: true,
            topology: {
              vertexCount: 4,
              stableVertexIdCount: 0,
              uvCount: 0,
              triangleCount: 2,
              triangleIndexCount: 6,
              stableTriangleIdCount: 0,
              hasStableVertexIds: false,
              hasStableTriangleIds: false,
              hasUvProjection: false,
              hasTriangles: true
            },
            vertices: [],
            uvs: [],
            triangles: [],
            movedVertexRefs: []
          }
        ]
      }
    });

    const meshEditSlice = summary.semanticReadiness.sliceStatus.find((slice) => slice.sliceId === "meshEdits");

    expect(summary.meshEdits).toEqual({
      present: true,
      count: 1,
      refs: [
        {
          drawableId: "draw_hashOnly",
          meshId: "mesh_hashOnly",
          boundsChanged: true,
          vertexHashChanged: true,
          movedVertexRefs: []
        }
      ]
    });
    expect(meshEditSlice).toEqual({
      sliceId: "meshEdits",
      present: true,
      evidenceRefs: ["meshEdit:mesh_hashOnly"]
    });
  });

  it("rejects invalid mask relation IDs in tutorial mask refs", () => {
    expect(
      TutorialMaskRelationEvidenceRefSchema.parse({
        maskRelationId: "maskrel_valid",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_face"],
        resolved: true
      })
    ).toMatchObject({ maskRelationId: "maskrel_valid" });

    expect(() =>
      TutorialMaskRelationEvidenceRefSchema.parse({
        maskRelationId: "mask relation invalid",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_face"],
        resolved: true
      })
    ).toThrow();
  });
});

const createTutorialGraph = (input: { readonly editedFaceMesh: boolean }): NormalizedRuntimeGraph => {
  const paramHeadYaw = ParameterIdSchema.parse("param_headYaw");
  const paramHairSway = ParameterIdSchema.parse("param_hairSway");
  const bodyPart = PartIdSchema.parse("part_body");
  const headPart = PartIdSchema.parse("part_head");
  const facePart = PartIdSchema.parse("part_face");
  const hairPart = PartIdSchema.parse("part_frontHair");
  const rigHead = RigControlIdSchema.parse("rig_head");
  const dynHairSway = DynamicsGroupIdSchema.parse("dyn_hairSway");
  const drawBody = DrawableIdSchema.parse("draw_body");
  const drawFace = DrawableIdSchema.parse("draw_face");
  const drawEye = DrawableIdSchema.parse("draw_eye");
  const drawHair = DrawableIdSchema.parse("draw_hair");
  const drawMask = DrawableIdSchema.parse("draw_mask");

  return {
    packageId: "pkg_tutorialEvidence",
    packageRevision: input.editedFaceMesh ? 2 : 1,
    packageHash: input.editedFaceMesh ? "sha256:tutorial-final" : "sha256:tutorial-baseline",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        paramHeadYaw,
        {
          id: paramHeadYaw,
          displayName: "Head Yaw",
          semanticRole: "face",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ],
      [
        paramHairSway,
        {
          id: paramHairSway,
          displayName: "Hair Sway",
          semanticRole: "dynamics",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    parts: new Map([
      [
        bodyPart,
        {
          partId: bodyPart,
          displayName: "Body",
          childPartIds: [headPart],
          drawableIds: [drawBody]
        }
      ],
      [
        headPart,
        {
          partId: headPart,
          displayName: "Head",
          parentPartId: bodyPart,
          childPartIds: [facePart, hairPart],
          drawableIds: [drawMask]
        }
      ],
      [
        facePart,
        {
          partId: facePart,
          displayName: "Face",
          parentPartId: headPart,
          childPartIds: [],
          drawableIds: [drawFace, drawEye]
        }
      ],
      [
        hairPart,
        {
          partId: hairPart,
          displayName: "Front Hair",
          parentPartId: headPart,
          childPartIds: [],
          drawableIds: [drawHair]
        }
      ]
    ]),
    dynamicsGroups: new Map([
      [
        dynHairSway,
        {
          dynamicsGroupId: dynHairSway,
          displayName: "Hair Sway",
          enabled: true,
          inputs: [
            {
              parameterId: paramHeadYaw,
              kind: "angle",
              influencePercent: 35,
              invert: false,
              normalization: {
                min: -1,
                center: 0,
                max: 1
              }
            }
          ],
          pendulums: [
            {
              length: 1,
              sway: 0.35,
              reactionSpeed: 8,
              convergenceSpeed: 4
            }
          ],
          outputs: [
            {
              parameterId: paramHairSway,
              kind: "angle",
              strength: 1,
              invert: false,
              limit: 1
            }
          ]
        }
      ]
    ]),
    drawables: new Map([
      createDrawable(drawBody, "mesh_body", bodyPart, 0, 1, [
        { x: 40, y: 120 },
        { x: 160, y: 120 },
        { x: 160, y: 220 },
        { x: 40, y: 220 }
      ]),
      createDrawable(drawFace, "mesh_face", facePart, 20, 0.82, input.editedFaceMesh
        ? [
            { x: 70, y: 58 },
            { x: 132, y: 54 },
            { x: 132, y: 120 },
            { x: 70, y: 120 }
          ]
        : [
            { x: 70, y: 58 },
            { x: 130, y: 58 },
            { x: 130, y: 120 },
            { x: 70, y: 120 }
          ], ["v_face_0", "v_face_1", "v_face_2", "v_face_3"]),
      createDrawable(drawEye, "mesh_eye", facePart, 30, 1, [
        { x: 82, y: 78 },
        { x: 118, y: 78 },
        { x: 118, y: 90 },
        { x: 82, y: 90 }
      ]),
      createDrawable(drawHair, "mesh_hair", hairPart, 40, 1, [
        { x: 58, y: 34 },
        { x: 142, y: 34 },
        { x: 154, y: 78 },
        { x: 46, y: 78 }
      ]),
      createDrawable(drawMask, "mesh_mask", headPart, 10, 1, [
        { x: 64, y: 52 },
        { x: 136, y: 52 },
        { x: 136, y: 124 },
        { x: 64, y: 124 }
      ])
    ]),
    rigControls: new Map([
      [
        rigHead,
        {
          kind: "rotation2d",
          rigControlId: rigHead,
          childDrawableIds: [drawFace, drawEye, drawHair],
          childRigControlIds: [],
          pivot: { x: 100, y: 96 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_headYaw"),
        targetId: rigHead,
        targetKind: "rigControl",
        targetProperty: "angleDegrees",
        parameterId: paramHeadYaw,
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: -1, statePatch: -12 },
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: 12 }
        ]
      }
    ],
    masks: [
      {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_faceClip"),
        sourceDrawableIds: [drawMask],
        targetDrawableIds: [drawFace]
      }
    ],
    drawOrder: [
      { drawableId: drawBody, drawOrder: 0 },
      { drawableId: drawMask, drawOrder: 10 },
      { drawableId: drawFace, drawOrder: 20 },
      { drawableId: drawEye, drawOrder: 30 },
      { drawableId: drawHair, drawOrder: 40 }
    ],
    disabledFutureLayers: []
  };
};

const createDrawable = (
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  meshId: string,
  partId: ReturnType<typeof PartIdSchema.parse>,
  baseDrawOrder: number,
  opacity: number,
  vertices: readonly { readonly x: number; readonly y: number }[],
  vertexStableIds = ["v0", "v1", "v2", "v3"]
): readonly [ReturnType<typeof DrawableIdSchema.parse>, NormalizedDrawable] => {
  const parsedMeshId = MeshIdSchema.parse(meshId);
  return [
    drawableId,
    {
      drawableId,
      meshId: parsedMeshId,
      partId,
      texture: {
        status: "resolved",
        textureId: TextureIdSchema.parse(`tex_${drawableId.replace(/^draw_/, "")}`),
        sourceAssetId: SourceAssetIdSchema.parse("src_tutorialSynthetic"),
        sourceLayerId: `layer_${drawableId.replace(/^draw_/, "")}`,
        projection: { kind: "bounds_fit" }
      },
      visible: true,
      opacity,
      baseDrawOrder,
      bounds: boundsFromVertices(vertices),
      vertices,
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
      vertexStableIds,
      vertexCount: vertices.length
    }
  ];
};

const boundsFromVertices = (vertices: readonly { readonly x: number; readonly y: number }[]) => {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};
