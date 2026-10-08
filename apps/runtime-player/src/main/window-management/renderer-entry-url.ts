import path from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimePlayerRendererEntry = "control" | "stage";

const mainDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

export function getControlPreloadFilePath(): string {
  return path.join(mainDirectoryPath, "../preload/preload.mjs");
}

export function getStagePreloadFilePath(): string {
  return path.join(mainDirectoryPath, "../preload/stage-preload.mjs");
}

export function getRendererHtmlFilePath(
  entry: RuntimePlayerRendererEntry
): string {
  return path.join(mainDirectoryPath, "../renderer", entry, "index.html");
}

export function getRendererDevUrl(
  entry: RuntimePlayerRendererEntry,
  rendererServerUrl = process.env.ELECTRON_RENDERER_URL
): string | undefined {
  if (!rendererServerUrl) {
    return undefined;
  }

  return new URL(`/${entry}/index.html`, rendererServerUrl).toString();
}
