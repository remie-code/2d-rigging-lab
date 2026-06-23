import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const browserSourceStageAssetRoutePrefix = "/browser-source-assets/";
export const browserSourceStageDevAssetRoutePrefix =
  "/browser-source-dev-assets/";

export type BrowserSourceStageClientAssets = {
  readonly modulePreloadHrefs: readonly string[];
  readonly stylesheetHrefs: readonly string[];
  readonly reactRefreshPreambleSrc: string | null;
  readonly scriptSrcs: readonly string[];
};

export type BrowserSourceStageStaticAsset = {
  readonly contentType: string;
  readonly bytes: Buffer;
};

export type BrowserSourceStageDevAsset = {
  readonly statusCode: number;
  readonly contentType: string;
  readonly bytes: Buffer;
};

export type BrowserSourceStageDevAssetFetch = (
  url: string
) => Promise<{
  readonly status: number;
  readonly headers: {
    readonly get: (name: string) => string | null;
  };
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type BrowserSourceStageClientAssetOptions = {
  readonly tokenQuery: string;
  readonly rendererDirectoryPath?: string;
  readonly rendererServerUrl?: string;
};

const mainDirectoryPath = path.dirname(fileURLToPath(import.meta.url));
const workspaceRootPath = findWorkspaceRoot(process.cwd()) ??
  findWorkspaceRoot(mainDirectoryPath) ??
  path.resolve(mainDirectoryPath, "../../../../..");
// Dev proxy support for Vite-linked workspace packages. Keep this list narrow:
// Browser Source should never become a general local-file proxy.
const allowedViteFsSourceDirectories = [
  "packages/contracts/src",
  "packages/package-format/src",
  "packages/render-core/src",
  "packages/render-webgl2/src",
  "packages/runtime-core/src"
].map((relativePath) => path.resolve(workspaceRootPath, relativePath));
const allowedRuntimePlayerViteDepsDirectory = path.resolve(
  workspaceRootPath,
  "apps/runtime-player/node_modules/.vite/deps"
);
const allowedViteClientEnvFilePaths =
  resolveAllowedViteClientEnvFilePaths(workspaceRootPath);
const defaultRendererDirectoryPath = path.join(
  mainDirectoryPath,
  "../renderer"
);
const browserSourceStageEntryPath = "stage/browser-source/index.html";
const browserSourceStageDevEntryPath =
  "/stage/browser-source/browser-source-stage-entry.tsx";

export function readBrowserSourceStageClientAssets(
  options: BrowserSourceStageClientAssetOptions
): BrowserSourceStageClientAssets {
  if (options.rendererServerUrl !== undefined && options.rendererServerUrl !== "") {
    return {
      modulePreloadHrefs: [],
      stylesheetHrefs: [],
      reactRefreshPreambleSrc: `${browserSourceStageDevAssetRoutePrefix}@react-refresh`,
      scriptSrcs: [
        `${browserSourceStageDevAssetRoutePrefix}${
          browserSourceStageDevEntryPath.slice(1)
        }`
      ]
    };
  }

  const rendererDirectoryPath =
    options.rendererDirectoryPath ?? defaultRendererDirectoryPath;
  const htmlPath = path.join(rendererDirectoryPath, browserSourceStageEntryPath);

  if (!existsSync(htmlPath)) {
    return {
      modulePreloadHrefs: [],
      stylesheetHrefs: [],
      reactRefreshPreambleSrc: null,
      scriptSrcs: []
    };
  }

  const html = readFileSync(htmlPath, "utf8");
  return {
    modulePreloadHrefs: extractAssetPaths(html, "href", "modulepreload")
      .map((assetPath) => toRoutedAssetPath(assetPath, options.tokenQuery)),
    stylesheetHrefs: extractAssetPaths(html, "href", "stylesheet")
      .map((assetPath) => toRoutedAssetPath(assetPath, options.tokenQuery)),
    reactRefreshPreambleSrc: null,
    scriptSrcs: extractAssetPaths(html, "src")
      .map((assetPath) => toRoutedAssetPath(assetPath, options.tokenQuery))
  };
}

export async function readBrowserSourceStageDevAsset(input: {
  readonly requestPath: string;
  readonly requestSearch: string;
  readonly rendererServerUrl: string | undefined;
  readonly fetcher?: BrowserSourceStageDevAssetFetch;
}): Promise<BrowserSourceStageDevAsset | null> {
  const viteRequestPath = toAllowedViteDevAssetRequestPath(input.requestPath);
  if (
    viteRequestPath === null ||
    input.rendererServerUrl === undefined ||
    input.rendererServerUrl === ""
  ) {
    return null;
  }

  const url = new URL(viteRequestPath, input.rendererServerUrl);
  url.search = input.requestSearch;
  const response = await (input.fetcher ?? defaultFetch)(url.toString());
  const contentType =
    response.headers.get("content-type") ??
    "application/octet-stream";
  const bytes = Buffer.from(await response.arrayBuffer());

  return {
    statusCode: response.status,
    contentType,
    bytes: shouldRewriteViteDevAsset(contentType)
      ? Buffer.from(rewriteViteDevAssetImports(bytes.toString("utf8")), "utf8")
      : bytes
  };
}

export function readBrowserSourceStageStaticAsset(input: {
  readonly requestPath: string;
  readonly rendererDirectoryPath?: string;
}): BrowserSourceStageStaticAsset | null {
  if (!input.requestPath.startsWith(browserSourceStageAssetRoutePrefix)) {
    return null;
  }

  const fileName = input.requestPath.slice(
    browserSourceStageAssetRoutePrefix.length
  );
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    return null;
  }

  const contentType = toAssetContentType(fileName);
  if (contentType === null) {
    return null;
  }

  const rendererDirectoryPath =
    input.rendererDirectoryPath ?? defaultRendererDirectoryPath;
  const assetPath = path.join(rendererDirectoryPath, "assets", fileName);
  const resolvedAssetsDirectory = path.resolve(rendererDirectoryPath, "assets");
  const resolvedAssetPath = path.resolve(assetPath);
  if (
    !resolvedAssetPath.startsWith(`${resolvedAssetsDirectory}${path.sep}`) ||
    !existsSync(resolvedAssetPath)
  ) {
    return null;
  }

  return {
    contentType,
    bytes: readFileSync(resolvedAssetPath)
  };
}

function extractAssetPaths(
  html: string,
  attribute: "href" | "src",
  rel?: "modulepreload" | "stylesheet"
): readonly string[] {
  const tagPattern = attribute === "src"
    ? /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g
    : /<link\b[^>]*\bhref="([^"]+)"[^>]*>/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const assetPath = match[1];
    if (assetPath === undefined) {
      continue;
    }
    if (rel !== undefined && !tag.includes(`rel="${rel}"`)) {
      continue;
    }
    paths.push(assetPath);
  }

  return paths;
}

function toRoutedAssetPath(assetPath: string, tokenQuery: string): string {
  const fileName = path.posix.basename(assetPath);
  return `${browserSourceStageAssetRoutePrefix}${encodeURIComponent(fileName)}${tokenQuery}`;
}

function toAllowedViteDevAssetRequestPath(requestPath: string): string | null {
  if (!requestPath.startsWith(browserSourceStageDevAssetRoutePrefix)) {
    return null;
  }

  const viteRequestPath =
    `/${requestPath.slice(browserSourceStageDevAssetRoutePrefix.length)}`;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(viteRequestPath);
  } catch {
    return null;
  }

  if (
    decodedPath.includes("\\") ||
    decodedPath.includes("..") ||
    decodedPath.includes("\0")
  ) {
    return null;
  }

  return isAllowedViteDevAssetPath(decodedPath) ? decodedPath : null;
}

function isAllowedViteDevAssetPath(pathname: string): boolean {
  return (
    pathname === "/@vite/client" ||
    pathname === "/@vite/env" ||
    pathname === "/@react-refresh" ||
    pathname.startsWith("/@id/") ||
    isAllowedViteFsDevAssetPath(pathname) ||
    isAllowedViteNodeModulesDevAssetPath(pathname) ||
    pathname.startsWith("/stage/browser-source/") ||
    pathname.startsWith("/stage/stage-renderer/") ||
    pathname.startsWith("/stage/runtime-evaluation/") ||
    pathname.startsWith("/styles/") ||
    pathname.startsWith("/preload/browser-source-") ||
    pathname === "/preload/runtime-player-bridge-contract.ts" ||
    pathname === "/preload/live-parameter-bridge-contract.ts" ||
    pathname === "/preload/runtime-export-bridge-contract.ts"
  );
}

function isAllowedViteNodeModulesDevAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/node_modules/.vite/deps/") ||
    pathname.startsWith("/node_modules/@vite/") ||
    pathname.startsWith("/node_modules/vite/") ||
    pathname.startsWith("/node_modules/react/") ||
    pathname.startsWith("/node_modules/react-dom/") ||
    pathname.startsWith("/node_modules/scheduler/")
  );
}

function isAllowedViteFsDevAssetPath(pathname: string): boolean {
  if (!pathname.startsWith("/@fs/")) {
    return false;
  }

  const fsPath = path.resolve(pathname.slice("/@fs/".length));
  return (
    allowedViteClientEnvFilePaths.some((filePath) =>
      isSamePath(filePath, fsPath)
    ) ||
    isPathInside(allowedRuntimePlayerViteDepsDirectory, fsPath) ||
    allowedViteFsSourceDirectories.some((directoryPath) =>
      isPathInside(directoryPath, fsPath)
    )
  );
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
  );
}

function resolveAllowedViteClientEnvFilePaths(
  workspaceRootPath: string
): readonly string[] {
  const resolvedPaths = new Set<string>();
  const resolutionBasePaths = [
    path.join(workspaceRootPath, "apps/runtime-player/package.json"),
    path.join(workspaceRootPath, "package.json")
  ];

  for (const resolutionBasePath of resolutionBasePaths) {
    try {
      const viteClientEnvPath = createRequire(resolutionBasePath)
        .resolve("vite/dist/client/env.mjs");
      const allowedPath = toAllowedWorkspaceViteClientEnvPath(
        workspaceRootPath,
        viteClientEnvPath
      );
      if (allowedPath !== null) {
        resolvedPaths.add(allowedPath);
      }
    } catch {
      // Vite is a dev dependency. If it is absent, keep the dev proxy closed.
    }
  }

  return [...resolvedPaths];
}

function toAllowedWorkspaceViteClientEnvPath(
  workspaceRootPath: string,
  filePath: string
): string | null {
  const resolvedFilePath = path.resolve(filePath);
  const pnpmStorePath = path.resolve(workspaceRootPath, "node_modules/.pnpm");
  if (!isPathInside(pnpmStorePath, resolvedFilePath)) {
    return null;
  }

  const relativePath = path.relative(pnpmStorePath, resolvedFilePath);
  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  if (
    !/^vite@[^/]+\/node_modules\/vite\/dist\/client\/env\.mjs$/.test(
      normalizedRelativePath
    )
  ) {
    return null;
  }

  return resolvedFilePath;
}

function isSamePath(leftPath: string, rightPath: string): boolean {
  return path.relative(leftPath, rightPath) === "";
}

function shouldRewriteViteDevAsset(contentType: string): boolean {
  return (
    contentType.includes("javascript") ||
    contentType.includes("typescript") ||
    contentType.includes("text/css")
  );
}

function rewriteViteDevAssetImports(source: string): string {
  return source
    .replace(
      /(["'`])\/(@vite\/client|@vite\/env|@react-refresh|@id\/[^"'`()\s]+|@fs\/[^"'`()\s]+|node_modules\/(?:\.vite\/deps\/|@vite\/|vite\/|react\/|react-dom\/|scheduler\/)[^"'`()\s]+|stage\/[^"'`()\s]+|styles\/[^"'`()\s]+|preload\/[^"'`()\s]+)/g,
      `$1${browserSourceStageDevAssetRoutePrefix}$2`
    )
    .replace(
      /(url\(\s*)\/(@vite\/client|@vite\/env|@react-refresh|@id\/[^"'`()\s]+|@fs\/[^"'`()\s]+|node_modules\/(?:\.vite\/deps\/|@vite\/|vite\/|react\/|react-dom\/|scheduler\/)[^"'`()\s]+|stage\/[^"'`()\s]+|styles\/[^"'`()\s]+|preload\/[^"'`()\s]+)(\s*\))/g,
      `$1${browserSourceStageDevAssetRoutePrefix}$2$3`
    );
}

function defaultFetch(url: string): ReturnType<BrowserSourceStageDevAssetFetch> {
  return fetch(url);
}

function findWorkspaceRoot(startPath: string): string | null {
  let currentPath = path.resolve(startPath);

  while (true) {
    if (existsSync(path.join(currentPath, "pnpm-workspace.yaml"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
}

function toAssetContentType(fileName: string): string | null {
  if (fileName.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (fileName.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  return null;
}
