import { createHash } from "node:crypto";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const capturePngEvidence = async (page, label) => {
  const result = await page.client.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });

  if (typeof result.data !== "string" || result.data.length === 0) {
    throw new Error(`Screenshot capture for ${label} returned no PNG data.`);
  }

  const bytes = Buffer.from(result.data, "base64");
  const dimensions = parsePngDimensions(bytes, label);

  return {
    label,
    format: "png",
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    dimensions
  };
};

const parsePngDimensions = (bytes, label) => {
  if (bytes.byteLength < 33 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Screenshot capture for ${label} was not a valid PNG.`);
  }

  const firstChunkType = bytes.subarray(12, 16).toString("ascii");
  if (firstChunkType !== "IHDR") {
    throw new Error(`Screenshot capture for ${label} did not start with a PNG IHDR chunk.`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
};
