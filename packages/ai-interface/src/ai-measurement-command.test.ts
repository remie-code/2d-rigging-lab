import { describe, expect, it } from "vitest";

import { executeAiReadCommand, type AiReadCommandHost } from "./ai-read-command.js";
import {
  InspectEvaluatedGeometryPayloadSchema,
  InspectEvaluatedGeometryResultSchema
} from "./ai-measurement-command.js";

// Parse from plain input so the schema produces the branded id types.
const sampleResult = InspectEvaluatedGeometryResultSchema.parse({
  schemaVersion: "inspect-evaluated-geometry-result-v1",
  packageRevision: 12,
  parameterOverrides: [{ parameterId: "param_faceYaw", value: 0.5 }],
  results: [
    {
      kind: "drawable",
      drawableId: "draw_eye",
      found: true,
      bounds: { x: 1, y: 2, width: 3, height: 4 },
      vertices: [
        { x: 1, y: 2 },
        { x: 4, y: 6 }
      ]
    },
    {
      kind: "rigControl",
      rigControlId: "rig_face_warp",
      found: true,
      rigControlKind: "warpLattice2d",
      evaluationStatus: "evaluated",
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      evaluatedControlPoints: [
        { x: 0, y: 0 },
        { x: 11, y: 2 }
      ]
    },
    {
      kind: "drawable",
      drawableId: "draw_missing",
      found: false
    }
  ]
});

const createReadRequest = (payload: object, capabilities = ["read"]) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: "cmd_inspectEvaluatedGeometry",
  session: { agentId: "agent_test", capabilities },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: "inspectEvaluatedGeometry",
  payload
});

describe("inspectEvaluatedGeometry command schema", () => {
  it("defaults parameterOverrides to empty and includeVertices to false", () => {
    const parsed = InspectEvaluatedGeometryPayloadSchema.parse({
      targets: [{ kind: "drawable", drawableId: "draw_eye" }]
    });

    expect(parsed.parameterOverrides).toEqual({});
    expect(parsed.includeVertices).toBe(false);
  });

  it("rejects an empty target list", () => {
    expect(() =>
      InspectEvaluatedGeometryPayloadSchema.parse({ targets: [] })
    ).toThrow();
  });

  it("accepts drawable and rigControl targets and round-trips the result", () => {
    const parsed = InspectEvaluatedGeometryResultSchema.parse(sampleResult);
    expect(parsed).toEqual(sampleResult);
  });
});

describe("inspectEvaluatedGeometry read dispatch", () => {
  it("dispatches through the read host with read capability", async () => {
    let observedTargets: unknown;
    const host: AiReadCommandHost = {
      inspectEvaluatedGeometry: (payload) => {
        observedTargets = payload.targets;
        return sampleResult;
      }
    };

    const response = await executeAiReadCommand(
      createReadRequest({
        targets: [
          { kind: "drawable", drawableId: "draw_eye" },
          { kind: "rigControl", rigControlId: "rig_face_warp" }
        ],
        includeVertices: true
      }),
      host
    );

    expect(observedTargets).toEqual([
      { kind: "drawable", drawableId: "draw_eye" },
      { kind: "rigControl", rigControlId: "rig_face_warp" }
    ]);
    expect(response).toMatchObject({
      status: "ok",
      command: "inspectEvaluatedGeometry",
      payload: {
        schemaVersion: "inspect-evaluated-geometry-result-v1",
        packageRevision: 12
      }
    });
  });

  it("returns permission_denied without read capability", async () => {
    const host: AiReadCommandHost = {
      inspectEvaluatedGeometry: () => sampleResult
    };

    const response = await executeAiReadCommand(
      createReadRequest(
        { targets: [{ kind: "drawable", drawableId: "draw_eye" }] },
        ["dryRunEdit"]
      ),
      host
    );

    expect(response).toMatchObject({
      status: "permission_denied",
      command: "inspectEvaluatedGeometry"
    });
  });

  it("returns not_implemented when the host does not implement the command", async () => {
    const host: AiReadCommandHost = {};

    const response = await executeAiReadCommand(
      createReadRequest({ targets: [{ kind: "drawable", drawableId: "draw_eye" }] }),
      host
    );

    expect(response).toMatchObject({
      status: "not_implemented",
      command: "inspectEvaluatedGeometry",
      payload: {
        schemaVersion: "inspect-evaluated-geometry-result-v1",
        results: []
      }
    });
  });
});
