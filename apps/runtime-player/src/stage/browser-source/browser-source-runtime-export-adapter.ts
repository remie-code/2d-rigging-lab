import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerBrowserSourceRuntimeExportPayload
} from "../../preload/browser-source-transport-contract";

export function toRuntimeExportLoadedPayload(
  payload: RuntimePlayerBrowserSourceRuntimeExportPayload
): RuntimeExportLoadedPayload {
  if (payload.texturePage.encoding !== "base64") {
    throw new Error("Browser Source texture payload encoding is unsupported.");
  }

  const bytes = decodeBase64Bytes(payload.texturePage.bytesBase64);
  if (bytes.byteLength !== payload.texturePage.byteLength) {
    throw new Error("Browser Source texture payload byte length mismatch.");
  }

  return {
    artifacts: payload.artifacts,
    texturePage: {
      metadata: payload.texturePage.metadata,
      bytes
    },
    summary: payload.summary,
    loadedAtIso: payload.loadedAtIso
  };
}

function decodeBase64Bytes(base64: string): Uint8Array {
  const decode = globalThis.atob;
  if (typeof decode !== "function") {
    throw new Error("Base64 decoding is unavailable in this browser.");
  }

  const binary = decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
