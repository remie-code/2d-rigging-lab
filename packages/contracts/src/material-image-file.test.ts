import { describe, expect, it } from "vitest";
import { MaterialImageFileRefSchema } from "./material-image-file.js";
import { MaterialPackageRefSchema, materialPackageRefsEqual } from "./material-package-ref.js";

const ref = { imagePath: "C:/materials/shadow.png", rgbaSha256: "a".repeat(64), width: 4, height: 3 };

describe("material image file reference", () => {
  it("defaults content inset to none and keeps only path, hash and dimensions", () => {
    expect(MaterialImageFileRefSchema.parse(ref)).toEqual({ ...ref, contentInset: { left: 0, top: 0, right: 0, bottom: 0 } });
    expect(MaterialImageFileRefSchema.safeParse({ ...ref, imagePath: "/abs/shadow.png" }).success).toBe(true);
  });

  it.each([
    ["relative path", { ...ref, imagePath: "shadow.png" }],
    ["uppercase hash", { ...ref, rgbaSha256: "A".repeat(64) }],
    ["zero width", { ...ref, width: 0 }],
    ["inset consumes width", { ...ref, contentInset: { left: 2, top: 0, right: 2, bottom: 0 } }],
    ["bytes are not part of a payload", { ...ref, rgbaBytes: [0, 0, 0, 0] }]
  ])("rejects %s", (_, value) => {
    expect(MaterialImageFileRefSchema.safeParse(value).success).toBe(false);
  });
});

describe("material package reference", () => {
  it("records package identity and revision without a fingerprint", () => {
    const value = { packageId: "pkg_fixture", packageRevision: 3 };
    expect(MaterialPackageRefSchema.parse(value)).toEqual(value);
    expect(MaterialPackageRefSchema.safeParse({ ...value, contentFingerprint: "a".repeat(64) }).success).toBe(false);
    expect(MaterialPackageRefSchema.safeParse({ ...value, packageRevision: -1 }).success).toBe(false);
    expect(materialPackageRefsEqual(MaterialPackageRefSchema.parse(value), MaterialPackageRefSchema.parse({ ...value, packageRevision: 4 }))).toBe(false);
  });
});
