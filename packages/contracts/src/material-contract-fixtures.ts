import { MaterialCandidateSchema, MaterialPackageVersionSchema } from "./material-candidate.js";
import { MaterialPlacementSchema } from "./material-coordinates.js";
import { MaterialNormalizedImageSchema } from "./material-image.js";

/** Rights-clean synthetic squares. New buffers on every call; no decoder or fs dependency. */
export const createMaterialImageFixture = (variant: "compact" | "wide" = "compact") => {
  const [width, height, x, y, size, scale, tx, ty] =
    variant === "compact" ? [4, 4, 1, 1, 2, 2, 9, 9] as const : [10, 8, 3, 2, 4, 1, 8, 9] as const;
  const rgbaBytes = new Uint8Array(width * height * 4);
  for (let row = y; row < y + size; row++) {
    for (let col = x; col < x + size; col++) rgbaBytes.set([220, 80, 40, 255], (row * width + col) * 4);
  }
  const hash = variant === "compact"
    ? "aaa07a21a7682ddf810e09c3a149d6f949c5757ade21f2a5d122c3c9bb2c2aeb"
    : "58f24d7232d6859d28c0b8fc46e084735cae14009b715aa355b6a2bfa03d66cd";
  return {
    image: MaterialNormalizedImageSchema.parse({
      descriptor: {
        schemaVersion: "material-image-v1", originalFileSha256: hash, rgbaSha256: hash,
        width, height, byteLength: rgbaBytes.length,
        pixelFormat: "rgba8", alphaMode: "straight-alpha-v1", rowOrder: "top-to-bottom", colorSpace: "srgb",
        alpha: { nonTransparentPixelCount: size * size, translucentPixelCount: 0,
          bounds: { space: "source-image-pixel-edge-v1", x, y, width: size, height: size } },
        contentInset: { left: 0, top: 0, right: 0, bottom: 0 }
      }, rgbaBytes
    }),
    placement: MaterialPlacementSchema.parse({
      from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1",
      scale, translation: { x: tx, y: ty }
    }),
    expectedStageContent: { x: 11, y: 11, width: 4, height: 4 }
  };
};
export const createMaterialCandidateFixture = () => {
  const fixture = createMaterialImageFixture();
  return MaterialCandidateSchema.parse({
    schemaVersion: "material-candidate-v1", candidateId: "material_fixture", candidateRevision: 0,
    state: "registered",
    basePackage: MaterialPackageVersionSchema.parse({
      packageId: "pkg_fixture", packageRevision: 1, contentFingerprint: "a".repeat(64),
      fingerprintVersion: "material-package-content-v1"
    }),
    image: fixture.image.descriptor, placement: fixture.placement,
    restPose: { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false },
    intent: { kind: "replace", drawableId: "draw_fixture", preserveLogicalDrawableId: true,
      geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [] },
      preserveExistingDeformers: true, sharedControlPolicy: "reject-shared-control-key-parameter-deletion" },
    provenance: { kind: "generated-material", note: "Synthetic RGBA test input, not a PNG decoder fixture." }
  });
};

