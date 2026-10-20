import { describe, expect, it } from "vitest";
import { MaterialAbsolutePathSchema, MaterialCoordinateSidecarSchema, MaterialSourceContextSchema } from "./material-artifacts.js";
import { createMaterialImageFixture } from "./material-contract-fixtures.js";

const restPose = { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false };
const packageRef = { packageId: "pkg_fixture", packageRevision: 3 };
const placement = createMaterialImageFixture().placement;

describe("material artifacts", () => {
  it.each(["C:/artifacts/image.png", "C:\\artifacts\\image.png", "/tmp/image.png", "\\\\server\\share\\image.png"])("accepts absolute artifact path %s", (path) => {
    expect(MaterialAbsolutePathSchema.safeParse(path).success).toBe(true);
  });

  it.each(["image.png", "./image.png", "C:image.png", ""])("rejects relative artifact path %s", (path) => {
    expect(MaterialAbsolutePathSchema.safeParse(path).success).toBe(false);
  });

  it("records only package ID and revision, and requires placement evidence on a placement preview", () => {
    const sidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: "placement-alpha-preview", packageRef, restPose,
      viewport: { stageRect: { space: "rest-stage-canvas-y-down-v1", x: 0, y: 0, width: 20, height: 20 }, outputWidth: 100, outputHeight: 100 },
      imageToStage: { ...placement, scale: 0.2, translation: { x: 0, y: 0 } }, materialPlacement: placement,
      materialRgbaSha256: "a".repeat(64), coverage: "full-alpha-no-old-mesh-clip" };
    expect(MaterialCoordinateSidecarSchema.safeParse(sidecar).success).toBe(true);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, imageToStage: placement }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, materialPlacement: undefined }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, materialRgbaSha256: undefined }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, coverage: "evaluated-mesh" }).success).toBe(false);
    for (const removed of [{ candidateId: "material_x" }, { workingPackage: packageRef }, { packageRef: { ...packageRef, contentFingerprint: "b".repeat(64) } }]) {
      expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, ...removed }).success).toBe(false);
    }
  });

  it("source context names the package revision and both original texture and context artifacts", () => {
    const sourceTexture = { kind: "source-texture", imageAbsolutePath: "/tmp/source.png", sidecarAbsolutePath: "/tmp/source.json" };
    const contextComposite = { kind: "context-composite", imageAbsolutePath: "/tmp/context.png", sidecarAbsolutePath: "/tmp/context.json" };
    const sourceContext = { packageRef, drawableId: "draw_fixture", meshId: "mesh_fixture", parentPartId: "part_fixture",
      rigControlIds: [], maskRelationIds: [], variantRefs: [], relatedTargets: [], sourceTexture, contextComposite,
      sourceImageToStage: placement, sourceLayerStageBounds: { space: "rest-stage-canvas-y-down-v1", x: 9, y: 9, width: 8, height: 8 }, restPose };
    expect(MaterialSourceContextSchema.safeParse(sourceContext).success).toBe(true);
    expect(MaterialSourceContextSchema.safeParse({ ...sourceContext, sourceTexture: contextComposite }).success).toBe(false);
    expect(MaterialSourceContextSchema.safeParse({ ...sourceContext, packageRef: undefined }).success).toBe(false);
  });
});
