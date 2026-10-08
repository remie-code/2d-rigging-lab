import path from "node:path";
import { fileURLToPath } from "node:url";

const mainDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

export function getEditorPreloadFilePath(): string {
  return path.join(mainDirectoryPath, "../preload/preload.mjs");
}

export function getEditorRendererHtmlFilePath(): string {
  return path.join(mainDirectoryPath, "../renderer/index.html");
}

export function getEditorRendererDevUrl(
  rendererServerUrl = process.env.ELECTRON_RENDERER_URL
): string | undefined {
  if (!rendererServerUrl) {
    return undefined;
  }

  return rendererServerUrl;
}
