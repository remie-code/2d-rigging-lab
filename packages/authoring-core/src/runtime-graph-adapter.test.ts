import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ParameterId,
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { ParameterDto } from "@private-2d-rigging-lab/package-format";
import { parsePackageDocument } from "@private-2d-rigging-lab/package-format";
import {
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import type { AuthoringGraph } from "./authoring-graph.js";
import {
  createAuthoringSessionFromPackageDocument,
  createParameter,
  toRuntimeGraph,
  toRuntimeGraphFromAuthoringGraph
} from "./index.js";

describe("authoring runtime graph adapter", () => {
  it("converts an authoring session into a runtime graph accepted by runtime-core", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);

    const runtimeGraph = toRuntimeGraph(session);

    expect(runtimeGraph).toMatchObject({
      packageId: "pkg_minimal-valid-package",
      packageRevision: 0,
      coordinateSystem: "canvas-y-down-v1"
    });
    expect(runtimeGraph.parameters.get(parameter.parameterId)).toMatchObject({
      id: parameter.parameterId,
      displayName: "Face Yaw",
      min: -1,
      max: 1,
      default: 0
    });
    expect([...runtimeGraph.drawables.values()]).toEqual([
      expect.objectContaining({
        drawableId: "draw_body",
        meshId: "mesh_body",
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        vertexCount: 3
      })
    ]);
    expect(runtimeGraph.drawOrder).toEqual([{ drawableId: "draw_body", drawOrder: 0 }]);

    const initialState = createInitialRuntimeState(runtimeGraph, {
      packageId: runtimeGraph.packageId,
      packageRevision: runtimeGraph.packageRevision,
      resetReasons: ["validationRunStart"]
    });
    const result = evaluateRuntimeFrame(
      runtimeGraph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 0,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [parameter.parameterId]: 0.5
        }
      },
      initialState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(result.snapshot.drawList).toEqual(["draw_body"]);
    expect(result.snapshot.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameterId: parameter.parameterId,
          authoredValue: 0.5,
          effectiveValue: 0.5
        })
      ])
    );
  });

  it("preserves current DTO-backed runtime collections from an authoring graph", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const drawBodyId = DrawableIdSchema.parse("draw_body");
    const dynamicGroupId = DynamicsGroupIdSchema.parse("dyn_hair");
    const faceYawId = ParameterIdSchema.parse("param_face_yaw");
    const hairSwayId = ParameterIdSchema.parse("param_hair_sway");
    const keyformSetId = KeyformSetIdSchema.parse("keyset_hair_sway");
    const maskRelationId = MaskRelationIdSchema.parse("maskrel_body");
    const partRootId = PartIdSchema.parse("part_root");
    const rigHeadId = RigControlIdSchema.parse("rig_head");
    const graph: AuthoringGraph = {
      ...session.graph,
      parameters: [
        createTestParameter(faceYawId),
        {
          ...createTestParameter(hairSwayId),
          displayName: "Hair Sway",
          semanticRole: "dynamics",
          valueSource: "computedDynamics"
        }
      ],
      dynamicsGroups: [
        {
          dynamicsGroupId: dynamicGroupId,
          displayName: "Hair",
          enabled: true,
          solverKind: "scalarDampedFollowV1",
          drivers: [
            {
              driverId: "driver_yaw",
              sourceParameterId: faceYawId,
              inputScale: 1,
              inputOffset: 0,
              invert: false
            }
          ],
          output: {
            outputId: "out_hair",
            targetParameterId: hairSwayId,
            outputScale: 1,
            outputOffset: 0,
            min: -1,
            max: 1,
            clampPolicy: "clamp-to-output-range"
          },
          settings: {
            stiffness: 4,
            damping: 1
          },
          resetPolicy: "reset-on-load"
        }
      ],
      keyformSets: [
        {
          keyformSetId,
          target: { kind: "mesh", id: "mesh_body", property: "vertices" },
          parameterId: hairSwayId,
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "additiveDelta",
          compositionOrder: 10,
          keys: [
            { value: -1, statePatch: [{ x: -1, y: 0 }] },
            { value: 1, statePatch: [{ x: 1, y: 0 }] }
          ]
        }
      ],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: rigHeadId,
          displayName: "Head",
          partId: partRootId,
          childDrawableIds: [drawBodyId],
          childRigControlIds: [],
          pivot: { x: 16, y: 16 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      masks: [
        {
          maskRelationId,
          maskDrawableIds: [drawBodyId],
          targetDrawableIds: [drawBodyId],
          enabled: true
        }
      ]
    };

    const runtimeGraph = toRuntimeGraphFromAuthoringGraph(graph, {
      packageId: PackageIdSchema.parse("pkg_adapter_graph"),
      packageRevision: 3,
      packageHash: "sha256:adapter"
    });

    expect(runtimeGraph.packageHash).toBe("sha256:adapter");
    expect(runtimeGraph.dynamicsGroups.get(dynamicGroupId)).toMatchObject({
      output: { targetParameterId: "param_hair_sway" }
    });
    expect(runtimeGraph.keyformBindings).toEqual([
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        targetId: "mesh_body",
        targetKind: "mesh",
        parameterId: "param_hair_sway"
      })
    ]);
    expect(runtimeGraph.rigControls.get(rigHeadId)).toMatchObject({
      kind: "rotation2d",
      childDrawableIds: ["draw_body"]
    });
    expect(runtimeGraph.masks).toEqual([
      {
        maskRelationId: "maskrel_body",
        sourceDrawableIds: ["draw_body"],
        targetDrawableIds: ["draw_body"]
      }
    ]);
  });
});

const createTestParameter = (parameterId: string | ParameterId): ParameterDto => ({
  parameterId: ParameterIdSchema.parse(parameterId),
  displayName: toDisplayName(parameterId),
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

const toDisplayName = (parameterIdText: string): string =>
  parameterIdText
    .replace(/^param_/, "")
    .split("_")
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" ");

const loadMinimalFixturePackageDocument = () => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );
  const parsed = parsePackageDocument({
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  });

  if (!parsed.success) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }

  return parsed.data;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
