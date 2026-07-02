import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// This app is not `pnpm install`-linked (it introduces no lockfile change), so map
// "@private-2d-rigging-lab/<pkg>" to that package's TypeScript entrypoint the same
// way the runtime resolver hook does for the spawned CLI. Vite/Vitest transpile the
// TypeScript, so no build step is required.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const packagesRoot = resolve(repoRoot, "packages");

const workspaceAliases = readdirSync(packagesRoot)
  .filter((packageName) => existsSync(resolve(packagesRoot, packageName, "src", "index.ts")))
  .map((packageName) => ({
    find: `@private-2d-rigging-lab/${packageName}`,
    replacement: resolve(packagesRoot, packageName, "src", "index.ts")
  }));

// The app declares `zod` as a dependency but is not `pnpm install`-linked, so its own
// source has no local node_modules/zod for Vite to resolve. Anchor bare `zod` on the copy
// the linked ai-interface package uses (workspace packages keep resolving their own).
const zodEntry = resolve(repoRoot, "packages", "ai-interface", "node_modules", "zod", "index.js");

export default defineConfig({
  resolve: {
    alias: [...workspaceAliases, { find: /^zod$/, replacement: zodEntry }]
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: false
  }
});
