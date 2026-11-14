import { createRequire } from "node:module";
import { readReferencePngDimensions } from "@private-2d-rigging-lab/authoring-core";
import { HostError } from "./host-error.js";

export interface DecodedReferencePng {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const { PNG } = createRequire(import.meta.url)("pngjs") as {
  PNG: { sync: { read(bytes: Buffer, options: { checkCRC: boolean }): DecodedReferencePng } };
};

export const decodeReferencePng = (bytes: Buffer): DecodedReferencePng => {
  try {
    const { width, height } = readReferencePngDimensions(bytes);
    const decoded = PNG.sync.read(bytes, { checkCRC: true });
    if (decoded.width !== width || decoded.height !== height || decoded.data.byteLength !== width * height * 4) {
      throw new Error("Decoded PNG raster disagrees with the header.");
    }
    return decoded;
  } catch (error) {
    throw new HostError("invalid-reference-png", `Cannot decode reference PNG: ${String(error)}`);
  }
};
