import { describe, expect, it } from "vitest";

import { AiCommandExecutor } from "./ai-command-executor.js";
import { AiCapabilitySchema } from "./ai-capability.js";
import { AiCommandNameSchema } from "./ai-command-name.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";
import {
  RenderViewPayloadSchema,
  RenderViewResultSchema,
  RenderViewSidecarSchema,
  RenderViewSpecSchema
} from "./ai-render-view-command.js";

const renderHost = {
  dryRunOperation: () => {
    throw new Error("not used");
  },
  commitOperation: () => {
    throw new Error("not used");
  }
};

const baseRequest = (capabilities: readonly string[]) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: "cmd_render_view",
  session: { agentId: "agent_test", capabilities },
  basis: { packageRevision: 3, relatedAC: [], relatedScenarios: [] },
  command: "renderView",
  payload: { outDir: "renders/out" }
});

describe("renderView command schema", () => {
  it("registers the renderView command name and render capability", () => {
    expect(AiCommandNameSchema.parse("renderView")).toBe("renderView");
    expect(AiCapabilitySchema.parse("render")).toBe("render");
  });

  it("applies payload defaults (empty overrides, default output name)", () => {
    const payload = RenderViewPayloadSchema.parse({ outDir: "renders/out" });
    expect(payload.parameterOverrides).toEqual({});
    expect(payload.outputName).toBe("render");
    expect(payload.view).toBeUndefined();
  });

  it("parses each framing spec variant with defaults", () => {
    expect(RenderViewSpecSchema.parse({ kind: "modelBounds" })).toEqual({ kind: "modelBounds" });
    expect(
      RenderViewSpecSchema.parse({ kind: "drawableFocus", drawableId: "draw_eye" })
    ).toEqual({ kind: "drawableFocus", drawableId: "draw_eye", marginRatio: 0.1 });
    expect(
      RenderViewSpecSchema.parse({
        kind: "stageViewport",
        stageViewport: { minX: 0, minY: 0, width: 10, height: 5 }
      })
    ).toMatchObject({ kind: "stageViewport" });
  });

  it("accepts a sweep of at least 2 steps and rejects a 1-step sweep", () => {
    const payload = RenderViewPayloadSchema.parse({
      outDir: "renders/out",
      sweep: { parameterId: "param_eye_open", steps: 5 }
    });
    expect(payload.sweep).toEqual({ parameterId: "param_eye_open", steps: 5 });
    expect(
      RenderViewPayloadSchema.safeParse({
        outDir: "renders/out",
        sweep: { parameterId: "param_eye_open", steps: 1 }
      }).success
    ).toBe(false);
  });

  it("round-trips a full sidecar and result through their schemas", () => {
    const sidecar = RenderViewSidecarSchema.parse({
      schemaVersion: "render-view-sidecar-v1",
      packagePath: "/pkg",
      packageId: "pkg_test",
      packageRevision: 3,
      pngPath: "/pkg/out/render.png",
      parameterOverrides: [{ parameterId: "param_eye_open", value: 0.5 }],
      resolvedView: {
        stageViewport: { minX: 0, minY: 0, width: 100, height: 50 },
        outputWidth: 200,
        outputHeight: 100,
        pixelsPerStageX: 2,
        pixelsPerStageY: 2
      }
    });
    const result = RenderViewResultSchema.parse({
      schemaVersion: "render-view-result-v1",
      packageRevision: 3,
      pngPath: "/pkg/out/render.png",
      sidecarPath: "/pkg/out/render.render-view.json",
      outputWidth: 200,
      outputHeight: 100,
      sidecar
    });
    expect(result.sidecar.packageRevision).toBe(3);
  });
});

describe("renderView executor capability gate", () => {
  it("denies renderView without the render capability", async () => {
    const executor = new AiCommandExecutor({ host: renderHost });
    const response = await executor.execute(
      AiCommandRequestSchema.parse(baseRequest(["read"]))
    );
    expect(response.status).toBe("permission_denied");
    expect(response.command).toBe("renderView");
  });

  it("returns not_implemented when the render capability is present (executor does not render)", async () => {
    const executor = new AiCommandExecutor({ host: renderHost });
    const response = await executor.execute(
      AiCommandRequestSchema.parse(baseRequest(["render"]))
    );
    // The executor is renderer-free; the real render runs in the authoring-host.
    expect(response.status).toBe("not_implemented");
    expect(response.command).toBe("renderView");
  });
});
