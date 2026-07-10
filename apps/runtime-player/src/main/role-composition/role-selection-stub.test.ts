import { describe, expect, it, vi } from "vitest";

import { presentRuntimePlayerRoleSelectionStub } from "./role-selection-stub";

describe("Runtime Player role selection stub", () => {
  it("relaunches with the chosen role (no implicit binding)", async () => {
    const relaunchWithRole = vi.fn();
    const quit = vi.fn();

    const outcome = await presentRuntimePlayerRoleSelectionStub({
      chooseRole: async () => "autonomousHost",
      relaunchWithRole,
      quit
    });

    expect(outcome).toEqual({ kind: "relaunching", role: "autonomousHost" });
    expect(relaunchWithRole).toHaveBeenCalledWith("autonomousHost");
    expect(quit).not.toHaveBeenCalled();
  });

  it("quits without binding any role when cancelled", async () => {
    const relaunchWithRole = vi.fn();
    const quit = vi.fn();

    const outcome = await presentRuntimePlayerRoleSelectionStub({
      chooseRole: async () => null,
      relaunchWithRole,
      quit
    });

    expect(outcome).toEqual({ kind: "cancelled" });
    expect(quit).toHaveBeenCalledTimes(1);
    expect(relaunchWithRole).not.toHaveBeenCalled();
  });

  it("binds no role until the user deliberately chooses one", async () => {
    const chooseRole = vi.fn(async () => null);
    const relaunchWithRole = vi.fn();
    const quit = vi.fn();

    await presentRuntimePlayerRoleSelectionStub({
      chooseRole,
      relaunchWithRole,
      quit
    });

    // The stub asks first and never picks a role on the user's behalf.
    expect(chooseRole).toHaveBeenCalledTimes(1);
    expect(relaunchWithRole).not.toHaveBeenCalled();
  });
});
