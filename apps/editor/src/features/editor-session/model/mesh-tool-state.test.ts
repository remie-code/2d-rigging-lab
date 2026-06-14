import { describe, expect, it } from "vitest";

import {
  DEFAULT_MESH_GENERATION_BACKEND_OPTION_ID,
  DEFAULT_MESH_GENERATION_METHOD,
  MESH_GENERATION_BACKEND_OPTIONS,
  resolveMeshGenerationMethodForBackendOption
} from "./mesh-tool-state";

describe("mesh tool state", () => {
  it("keeps the temporary backend selector default on auto-outline-v2.6-soft-apron", () => {
    expect(DEFAULT_MESH_GENERATION_BACKEND_OPTION_ID).toBe("default-v2-6-soft-apron");
    expect(DEFAULT_MESH_GENERATION_METHOD).toBe("auto-outline-v2.6-soft-apron");
    expect(resolveMeshGenerationMethodForBackendOption()).toBe(
      "auto-outline-v2.6-soft-apron"
    );
    expect(resolveMeshGenerationMethodForBackendOption("default-v2-6-soft-apron")).toBe(
      "auto-outline-v2.6-soft-apron"
    );
  });

  it("exposes v6 candidates only as explicit temporary backend options", () => {
    const methods = MESH_GENERATION_BACKEND_OPTIONS.map((option) => option.method);

    expect(methods).toEqual([
      "auto-outline-v2.6-soft-apron",
      "auto-outline-v6d-contour-constrainautor",
      "auto-outline-v6e-contour-poly2tri",
      "auto-outline-v6f-contour-custom-cdt"
    ]);
    expect(methods).not.toContain("auto-outline-v6a-local");
    expect(methods).not.toContain("auto-outline-v6b-constrainautor");
    expect(methods).not.toContain("auto-outline-v6c-poly2tri");
  });
});
