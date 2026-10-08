// Node ESM module-customization hooks that let the headless CLI run directly from
// TypeScript source across the pnpm workspace without a build step or installed
// node_modules symlinks. Two responsibilities:
//   1. Map bare "@private-2d-rigging-lab/<pkg>" specifiers to that package's
//      src/index.ts entrypoint (the package.json "exports" target).
//   2. Rewrite relative "./x.js" specifiers to "./x.ts" when the TypeScript source
//      exists, matching the NodeNext "TS with .js specifiers" convention.
// Node's --experimental-transform-types flag then executes the TypeScript directly.
//
// This is test/dev tooling only. It adds no dependencies and touches no lockfile.
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKSPACE_SCOPE = "@private-2d-rigging-lab/";
// This file lives at <repoRoot>/apps/authoring-host/workspace-source-resolver.mjs,
// so the repo root is three directory levels up.
const repoRootUrl = pathToFileURL(
  `${dirname(dirname(dirname(fileURLToPath(import.meta.url))))}/`
);

// The authoring-host app package declares `zod` as a dependency but is not
// `pnpm install`-linked (introduces no lockfile change), so its own source files have
// no local node_modules/zod to resolve. Redirect bare `zod` specifiers originating in
// the app source to the workspace-hoisted copy that the linked workspace packages use.
// Workspace packages themselves keep resolving zod through their own node_modules.
const zodPackageUrl = findWorkspaceZodPackageUrl();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(WORKSPACE_SCOPE)) {
    const packageName = specifier.slice(WORKSPACE_SCOPE.length);
    const indexUrl = new URL(`packages/${packageName}/src/index.ts`, repoRootUrl);
    if (existsSync(fileURLToPath(indexUrl))) {
      return { url: indexUrl.href, shortCircuit: true };
    }
  }

  if (specifier === "zod" && zodPackageUrl !== undefined) {
    return { url: zodPackageUrl.href, shortCircuit: true };
  }

  if (
    context.parentURL !== undefined &&
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    specifier.endsWith(".js")
  ) {
    const typescriptUrl = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(typescriptUrl))) {
      return { url: typescriptUrl.href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

function findWorkspaceZodPackageUrl() {
  // ai-interface always depends on zod, so its linked node_modules/zod is a stable
  // resolution anchor. Point at the ESM entry (package.json exports["."].import) so the
  // app source resolves the same zod build as the workspace packages.
  const candidate = new URL(
    "packages/ai-interface/node_modules/zod/index.js",
    repoRootUrl
  );
  return existsSync(fileURLToPath(candidate)) ? candidate : undefined;
}
