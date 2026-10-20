import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { HostError } from "./host-error.js";
import { assertOutsidePackage } from "./package-path-guard.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("assertOutsidePackage", () => {
  it("rejects the package directory itself and anything under it; accepts siblings and other trees", async () => {
    const root = await mkdtemp(join(tmpdir(), "package-path-guard-"));
    roots.push(root);
    const packageDirectory = join(root, "package");
    await mkdir(join(packageDirectory, "assets"), { recursive: true });
    const isInside = (error: unknown) => error instanceof HostError && error.code === "artifacts-inside-package";
    for (const destination of [packageDirectory, join(packageDirectory, "assets"), join(packageDirectory, "not-yet", "artifacts")]) {
      await expect(assertOutsidePackage(packageDirectory, destination), destination).rejects.toSatisfy(isInside);
    }
    for (const destination of [join(root, "state", "material-artifacts"), join(root, "package-artifacts"), join(tmpdir(), "elsewhere")]) {
      await expect(assertOutsidePackage(packageDirectory, destination), destination).resolves.toBeUndefined();
    }
  });
});
