import { describe, expect, it } from "vitest";

import { contractsPackageInfo } from "./package-info.js";

describe("contracts package smoke wiring", () => {
  it("exports Wave 0 package metadata from a named source file", () => {
    expect(contractsPackageInfo).toEqual({
      moduleId: "contracts",
      wave: "wave0-foundation"
    });
  });
});
