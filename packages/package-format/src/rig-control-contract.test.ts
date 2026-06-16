import { describe, expect, it } from "vitest";

import { RigControlSchema } from "./index.js";

describe("rig control package-format contract", () => {
  it("parses rotation2d rig controls with legacy partId and without partId", () => {
    const legacy = RigControlSchema.parse({
      ...createRotation2dRigControl(),
      partId: "part_face"
    });
    const current = RigControlSchema.parse(createRotation2dRigControl());

    expect(legacy).toHaveProperty("partId", "part_face");
    expect(current).not.toHaveProperty("partId");
  });

  it("parses warpLattice2d rig controls with legacy partId and without partId", () => {
    const legacy = RigControlSchema.parse({
      ...createWarpLattice2dRigControl(),
      partId: "part_face"
    });
    const current = RigControlSchema.parse(createWarpLattice2dRigControl());

    expect(legacy).toHaveProperty("partId", "part_face");
    expect(current).not.toHaveProperty("partId");
  });
});

const createRotation2dRigControl = () => ({
  kind: "rotation2d",
  rigControlId: "rig_face_rotation",
  displayName: "Face Rotation",
  childDrawableIds: ["draw_face"],
  childRigControlIds: [],
  pivot: { x: 10, y: 20 },
  restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createWarpLattice2dRigControl = () => ({
  kind: "warpLattice2d",
  rigControlId: "rig_face_warp",
  displayName: "Face Warp",
  childDrawableIds: ["draw_face"],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: { x: 10, y: 20, width: 100, height: 80 },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 10, y: 100 },
    { x: 110, y: 100 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});
