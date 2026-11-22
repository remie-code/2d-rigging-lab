import { readFile } from "node:fs/promises";
import { runPowerShellScript } from "./powershell-exec.mjs";

export const DEFAULT_OCR_TIMEOUT_MS = 10_000;

let scriptPromise;
function loadScript() {
  scriptPromise ??= Promise.all([
    readFile(new URL("./windows-ocr.ps1", import.meta.url), "utf8"),
    readFile(new URL("./windows-ocr-image.cs", import.meta.url), "utf8")
  ]).then(([script, imageSource]) => script.replace("/* IMAGE_SOURCE */", () => imageSource))
    .catch((error) => {
      scriptPromise = undefined;
      throw error;
    });
  return scriptPromise;
}

function failure(kind, message) {
  return { error: { kind, message } };
}

function isLine(line) {
  return typeof line?.text === "string" && line.text.length > 0 &&
    [line.x, line.y, line.w, line.h].every(Number.isFinite) && line.w > 0 && line.h > 0;
}

/**
 * Read one image with Windows Japanese OCR. Coordinates are decoded-image
 * pixels. A successful frame with no readable text still has `lines: []`.
 * The visual mask uses row-major pixels, least-significant bit first.
 * @param {{imageBase64?: string, jpegBase64?: string, capturedAtMs: number}} frame
 * @param {{signal?: AbortSignal, timeoutMs?: number, powershellPath?: string, spawnImpl?: typeof import("node:child_process").spawn}} [options]
 */
export async function recognizeScreenText(frame, options = {}) {
  const { capturedAtMs } = frame;
  const imageBase64 = frame.imageBase64 ?? frame.jpegBase64;
  if (typeof imageBase64 !== "string" || !imageBase64 || !Number.isFinite(capturedAtMs)) {
    throw new TypeError("recognizeScreenText requires a base64 image and a finite capturedAtMs");
  }

  const { signal, timeoutMs = DEFAULT_OCR_TIMEOUT_MS, powershellPath, spawnImpl } = options;
  if (signal?.aborted) return failure("aborted", "Windows OCR was cancelled");
  try {
    const result = await runPowerShellScript(await loadScript(), {
      signal, timeoutMs, powershellPath, spawnImpl, input: imageBase64
    });
    if (result.timedOut) return failure("timeout", `Windows OCR exceeded ${timeoutMs}ms`);
    if (result.aborted) return failure("aborted", "Windows OCR was cancelled");
    if (result.code !== 0) {
      return failure("failed", `Windows OCR exited ${result.code}: ${result.stderr.trim().slice(0, 500)}`);
    }

    const { width, height, lines, damageExclusions, strokeMask, pixelTiles, tileSize, unavailable } = JSON.parse(result.stdout);
    if (unavailable === true) return failure("unavailable", "Windows Japanese OCR language pack is unavailable");
    if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
        !Array.isArray(lines) || !lines.every(isLine) ||
        !Array.isArray(damageExclusions) ||
        !damageExclusions.every((line) => isLine(line) && /^[0-9]{3,}$/.test(line.rereadText)) ||
        typeof strokeMask !== "string") {
      return failure("failed", "Windows OCR returned an invalid frame");
    }
    const data = Buffer.from(strokeMask, "base64");
    if (data.length !== Math.ceil(width * height / 8)) {
      return failure("failed", "Windows OCR returned an invalid visual mask");
    }
    const frameResult = { capturedAtMs, width, height, lines, damageExclusions, strokeMask: { width, height, data } };
    if (typeof pixelTiles === "string" && Number.isSafeInteger(tileSize) && tileSize > 0) {
      const hashes = Buffer.from(pixelTiles, "base64");
      if (hashes.length === Math.ceil(width / tileSize) * Math.ceil(height / tileSize) * 8) {
        frameResult.pixelTiles = { width, height, tileSize, data: hashes };
      }
    }
    return frameResult;
  } catch (error) {
    return failure("failed", `Windows OCR failed: ${error.message}`);
  }
}
