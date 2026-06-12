import { describe, expect, it } from "vitest";
import {
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  getInitializedParameterById,
  listInitializedParameters,
  toRuntimeGraphFromAuthoringGraph
} from "./index.js";
import type { AuthoringGraph } from "./authoring-graph.js";

describe("authoring parameter initialized surface", () => {
  it("lists preset parameters even when the authored graph stores no parameters", () => {
    const graph = createEmptyGraph();

    expect(listInitializedParameters(graph).map((parameter) => parameter.parameterId)).toContain(
      "param_face_angle_x"
    );
    expect(getInitializedParameterById(graph, ParameterIdSchema.parse("param_face_angle_x"))).toMatchObject({
      kind: "preset",
      presetRole: "face.angle.x",
      min: -30,
      max: 30,
      default: 0
    });
  });

  it("projects initialized preset parameters into runtime graphs", () => {
    const runtimeGraph = toRuntimeGraphFromAuthoringGraph(createEmptyGraph(), {
      packageId: PackageIdSchema.parse("pkg_parameter_surface_test"),
      packageRevision: 0
    });

    expect(runtimeGraph.parameters.get(ParameterIdSchema.parse("param_face_angle_x"))).toMatchObject({
      id: "param_face_angle_x",
      displayName: "Face Angle X",
      min: -30,
      max: 30,
      default: 0
    });
  });
});

const createEmptyGraph = (): AuthoringGraph => ({
  coordinateSystem: "canvas-y-down-v1",
  canvasSize: { width: 512, height: 512 },
  parts: [],
  drawables: [],
  meshes: [],
  parameters: [],
  keyformSets: [],
  rigControls: [],
  dynamicsGroups: [],
  masks: [],
  drawOrder: [],
  rigControlRootIds: [],
  stableOrder: [],
  sourceAssets: [],
  provenanceRecords: [],
  rightsRecords: []
});
