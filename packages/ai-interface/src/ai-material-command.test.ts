import { describe, expect, it } from "vitest";
import { createMaterialImageFixture } from "@private-2d-rigging-lab/contracts";
import { AiCommandNameSchema } from "./ai-command-name.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";
import { AiCommandResponseSchema } from "./ai-command-response.js";
import { AiCommandExecutor } from "./ai-command-executor.js";
import { PreviewMaterialPlacementPayloadSchema } from "./ai-material-command.js";

const fixture = createMaterialImageFixture();
const viewport = { stageRect: { space: "rest-stage-canvas-y-down-v1", x: 0, y: 0, width: 20, height: 20 }, outputWidth: 20, outputHeight: 20 };
const packageRef = { packageId: "pkg_fixture", packageRevision: 2 };
const artifact = (kind: string, name: string) => ({ kind, imageAbsolutePath: `/tmp/${name}.png`, sidecarAbsolutePath: `/tmp/${name}.json` });
const restPose = { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false };
const previewResult = {
  packageRef, placement: fixture.placement,
  preview: { artifact: artifact("placement-alpha-preview", "preview"), sidecar: { schemaVersion: "material-coordinate-sidecar-v1",
    kind: "placement-alpha-preview", packageRef, viewport, imageToStage: { ...fixture.placement, scale: 1, translation: { x: 0, y: 0 } },
    materialPlacement: fixture.placement, materialRgbaSha256: fixture.image.descriptor.rgbaSha256, restPose, coverage: "full-alpha-no-old-mesh-clip" } },
  context: artifact("context-composite", "context"),
  artifacts: [artifact("placement-alpha-preview", "preview"), artifact("context-composite", "context")]
};
const response = (command: string, payload: unknown, status = "ok") => ({ schemaVersion: "ai-command-response-v1", commandId: "test", status, command, payload });
const previewPayload = {
  image: { imagePath: "C:/materials/shadow.png", rgbaSha256: fixture.image.descriptor.rgbaSha256, width: 4, height: 4 },
  alignment: { placement: fixture.placement },
  intent: { kind: "add", drawableId: "draw_new", displayName: "New", parentPartId: "part_root", insertion: { position: "last" },
    rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1 },
  viewport
};
const request = (command: string, payload: unknown, capabilities: string[]) => AiCommandRequestSchema.parse({ schemaVersion: "ai-command-request-v1",
  commandId: "test", session: { agentId: "test", capabilities }, command, payload });

describe("read-only material commands", () => {
  it("names only the two read-only commands", () => {
    for (const name of ["extractMaterialSource", "previewMaterialPlacement"]) expect(AiCommandNameSchema.safeParse(name).success).toBe(true);
    for (const name of ["registerMaterialCandidate", "buildMaterialCandidate", "approveMaterialCandidate", "applyMaterialCandidate",
      "previewMaterialCandidate", "editMaterialCandidate", "discardMaterialCandidate", "inspectMaterialCandidate", "setMaterialPlacement"]) {
      expect(AiCommandNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

  it("accepts an image file reference with explicit placement or correspondences, never both", () => {
    expect(request("previewMaterialPlacement", previewPayload, ["render"]).command).toBe("previewMaterialPlacement");
    const pair = (x: number, sx: number) => ({ pixel: { space: "source-image-pixel-edge-v1", x, y: x }, stage: { space: "rest-stage-canvas-y-down-v1", x: sx, y: sx } });
    expect(() => request("previewMaterialPlacement", { ...previewPayload, alignment: { correspondences: [pair(0, 1), pair(2, 5)] } }, ["render"])).not.toThrow();
    expect(() => request("previewMaterialPlacement", { ...previewPayload, alignment: { placement: fixture.placement, correspondences: [pair(0, 1), pair(2, 5)] } }, ["render"])).toThrow();
    // The payload schema is strict; the request envelope's intersection does not report nested unknown keys.
    expect(PreviewMaterialPlacementPayloadSchema.safeParse({ ...previewPayload, candidateId: "material_x" }).success).toBe(false);
    expect(() => request("previewMaterialPlacement", { ...previewPayload, image: { ...previewPayload.image, imagePath: "shadow.png" } }, ["render"])).toThrow();
  });

  it("carries a result exactly when the command completed", () => {
    expect(AiCommandResponseSchema.safeParse(response("previewMaterialPlacement", { result: previewResult })).success).toBe(true);
    expect(AiCommandResponseSchema.safeParse(response("previewMaterialPlacement", {})).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("previewMaterialPlacement", { result: previewResult }, "rejected")).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("previewMaterialPlacement", {}, "rejected")).success).toBe(true);
    expect(AiCommandResponseSchema.safeParse(response("extractMaterialSource", { result: previewResult })).success).toBe(false);
  });

  it("executor requires render and leaves the command to the authoring host", async () => {
    const executor = new AiCommandExecutor({ host: { dryRunOperation: () => { throw new Error("must not run"); }, commitOperation: () => { throw new Error("must not run"); } } });
    const extract = request("extractMaterialSource", { drawableId: "draw_target", viewport }, []);
    expect((await executor.execute(extract)).status).toBe("permission_denied");
    expect((await executor.execute({ ...extract, session: { agentId: "test", capabilities: ["render"] } })).status).toBe("not_implemented");
  });
});
