// @ts-check
import { addAbortSignal } from "node:stream";
import { crc32, createInflate } from "node:zlib";
import { MAX_MATERIAL_IMAGE_BYTES } from "./discord-pdf-renderer.mjs";
import { runWinRtMaterialScript, WINRT_ASYNC, WINRT_OPEN_INPUT } from "./winrt-materials.mjs";

const MAX_EDGE = 8000;
const MAX_FRAMES = 128;
const MAX_PIXELS = 24 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const PNG_START = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_END = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const PNG_DEPTHS = new Map([[0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]], [4, [8, 16]], [6, [8, 16]]]);
const PNG_CHANNELS = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
// First column, first row, horizontal step, vertical step.
const PNG_ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

/** @param {Buffer} bytes */
function readPngData(bytes) {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_START) ||
      !bytes.subarray(-PNG_END.length).equals(PNG_END) || bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR") return "invalid";
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const [depth, color, compression, filter, interlace] = bytes.subarray(24, 29);
  const channels = PNG_CHANNELS.get(color);
  if (width < 1 || height < 1 || channels === undefined || !PNG_DEPTHS.get(color)?.includes(depth) ||
      compression !== 0 || filter !== 0 || interlace > 1) return "invalid";
  if (width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) return "limit";
  const passes = (interlace === 1 ? PNG_ADAM7 : [[0, 0, 1, 1]]).flatMap(([x, y, dx, dy]) => {
    if (width <= x || height <= y) return [];
    const columns = Math.ceil((width - x) / dx);
    return [{ rows: Math.ceil((height - y) / dy), rowSize: 1 + Math.ceil(columns * channels * depth / 8) }];
  });
  // WIC may supply placeholder pixels after a bad IDAT. Check chunk integrity
  // before passing the original bytes to the model.
  const end = bytes.length - PNG_END.length;
  let offset = 8;
  let idatEnded = false;
  const parts = [];
  while (offset < end) {
    if (end - offset < 12) return "invalid";
    const crcOffset = offset + 8 + bytes.readUInt32BE(offset);
    if (crcOffset + 4 > end || crc32(bytes.subarray(offset + 4, crcOffset)) !== bytes.readUInt32BE(crcOffset)) return "invalid";
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      if (idatEnded) return "invalid";
      parts.push(bytes.subarray(offset + 8, crcOffset));
    } else if (parts.length > 0) {
      idatEnded = true;
    }
    offset = crcOffset + 4;
  }
  return parts.length > 0 ? { compressed: Buffer.concat(parts), passes } : "invalid";
}

/**
 * Stream the inflated scanlines without retaining pixels in the agent process.
 * Scanline sizes derived from IHDR and the pass geometry bound the output.
 * @param {Buffer} compressed
 * @param {{rows:number, rowSize:number}[]} passes
 * @param {AbortSignal} signal
 */
async function validPngScanlines(compressed, passes, signal) {
  const inflater = addAbortSignal(signal, createInflate());
  let pass = 0;
  let row = 0;
  let rowStart = 0;
  let emitted = 0;
  try {
    inflater.end(compressed);
    for await (const chunk of inflater) {
      const end = emitted + chunk.length;
      while (rowStart < end) {
        const current = passes[pass];
        if (!current || chunk[rowStart - emitted] > 4) return false;
        rowStart += current.rowSize;
        row++;
        if (row === current.rows) {
          pass++;
          row = 0;
        }
      }
      emitted = end;
    }
    return pass === passes.length && emitted === rowStart && inflater.bytesWritten === compressed.length;
  } catch {
    return false;
  }
}

/** @param {Buffer} bytes */
function jpegHasScanData(bytes) {
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8 ||
      bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return false;
  let offset = 2;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0x01) continue; // TEM has no segment length.
    if (offset + 2 > bytes.length - 2) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) return false;
    offset += length;
    if (marker !== 0xda) continue;
    // A first scan must contain an entropy-coded byte (FF is byte-stuffed).
    // WIC otherwise accepts an empty scan followed immediately by EOI.
    while (bytes[offset] === 0xff && bytes[offset + 1] === 0xff) offset++;
    return offset < bytes.length - 2 && (bytes[offset] !== 0xff || bytes[offset + 1] === 0x00);
  }
  return false;
}

const script = String.raw`
$ErrorActionPreference = 'Stop'
$status = 'invalid'
$sourceStream = $null
$inputBytes = $null
try {
  ${WINRT_ASYNC}
  $decoderType = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
  $frameType = [Windows.Graphics.Imaging.BitmapFrame,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
  $pixelsType = [Windows.Graphics.Imaging.PixelDataProvider,Windows.Graphics.Imaging,ContentType=WindowsRuntime]

  ${WINRT_OPEN_INPUT}
  $decoder = Wait-Operation ($decoderType::CreateAsync($sourceStream)) $decoderType
  if ($decoder.FrameCount -lt 1) { throw 'missing frame' }
  if ($decoder.FrameCount -gt ${MAX_FRAMES}) {
    $status = 'limit'
  } else {
    $pixelCount = 0
    for ($index = 0; $index -lt $decoder.FrameCount; $index++) {
      $frame = Wait-Operation ($decoder.GetFrameAsync([uint32]$index)) $frameType
      $width = $frame.PixelWidth
      $height = $frame.PixelHeight
      if ($width -lt 1 -or $height -lt 1) { throw 'invalid dimensions' }
      $pixelCount += [long]$width * $height
      if ($width -gt ${MAX_EDGE} -or $height -gt ${MAX_EDGE} -or $pixelCount -gt ${MAX_PIXELS}) {
        $status = 'limit'
        break
      }
      $pixels = Wait-Operation ($frame.GetPixelDataAsync()) $pixelsType
      if ($pixels.DetachPixelData().Length -lt 1) { throw 'empty pixels' }
      $status = 'ok'
    }
  }
} catch {
  $status = 'invalid'
} finally {
  if ($null -ne $sourceStream) { $sourceStream.Dispose() }
  if ($null -ne $inputBytes) { $inputBytes.Dispose() }
}
[Console]::WriteLine((@{ status = $status } | ConvertTo-Json -Compress))
`;

/**
 * Check container termination as well as decoding. Some platform decoders are
 * deliberately tolerant of truncated images. Keep the original bytes and MIME
 * after validation so model inputs retain their original quality and size.
 * @param {Buffer} bytes
 * @param {string} mediaType
 * @param {{signal?:AbortSignal}} [options]
 * @returns {Promise<"ok"|"invalid"|"limit"|"timeout"|"unavailable">}
 */
export async function decodeDiscordImage(bytes, mediaType, { signal } = {}) {
  if (bytes.length > MAX_MATERIAL_IMAGE_BYTES) return "limit";
  const startedAt = performance.now();
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const decodingSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  switch (mediaType) {
    case "image/png": {
      const png = readPngData(bytes);
      if (typeof png === "string") return png;
      if (!await validPngScanlines(png.compressed, png.passes, decodingSignal)) {
        return timeout.aborted ? "timeout" : signal?.aborted ? "unavailable" : "invalid";
      }
      break;
    }
    case "image/jpeg":
      if (!jpegHasScanData(bytes)) return "invalid";
      break;
    case "image/webp":
      if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length) return "invalid";
      break;
    default:
      return "invalid";
  }
  const timeoutMs = TIMEOUT_MS - Math.ceil(performance.now() - startedAt);
  if (timeoutMs < 1) return "timeout";
  const result = await runWinRtMaterialScript(script, bytes, { signal, maxOutputBytes: 1024, timeoutMs });
  if ("error" in result) return result.error === "invalid-output" ? "invalid" : result.error;
  return result.value?.status === "ok" || result.value?.status === "limit" ? result.value.status : "invalid";
}
