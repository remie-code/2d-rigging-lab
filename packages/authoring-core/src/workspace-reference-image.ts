import {
  ReferenceImageSourceSchema,
  ReferenceImageStateSchema,
  type ReferenceImageSource,
  type ReferenceImageState
} from "@private-2d-rigging-lab/contracts";
import { computePackageBinarySha256Digest } from "@private-2d-rigging-lab/package-format";

export const REFERENCE_IMAGE_STATE_PATH = "authoring/reference-image.json";
const REFERENCE_IMAGE_SCHEMA_VERSION = "reference-image-workspace-v1";

export const referenceImageBinaryPath = (image: ReferenceImageSource): string =>
  `authoring/reference-images/${ReferenceImageSourceSchema.parse(image).sha256}.png`;

export const parseWorkspaceReferenceImage = (text: string | undefined): ReferenceImageState | null => {
  if (text === undefined) return null;
  try {
    const file = JSON.parse(text) as { schemaVersion?: unknown; reference?: unknown } | null;
    if (file?.schemaVersion !== REFERENCE_IMAGE_SCHEMA_VERSION) {
      throw new Error("Unsupported reference image schema version.");
    }
    return ReferenceImageStateSchema.nullable().parse(file.reference);
  } catch (error) {
    throw new Error(`Cannot read workspace reference state "${REFERENCE_IMAGE_STATE_PATH}": ${String(error)}`, { cause: error });
  }
};

export const serializeWorkspaceReferenceImage = (reference: ReferenceImageState | null) => ({
  path: REFERENCE_IMAGE_STATE_PATH,
  text: `${JSON.stringify({
    schemaVersion: REFERENCE_IMAGE_SCHEMA_VERSION,
    reference: ReferenceImageStateSchema.nullable().parse(reference)
  }, null, 2)}\n`
});

export const describeReferenceImageBytes = async (
  bytes: Uint8Array,
  { width, height }: Pick<ReferenceImageSource, "width" | "height">
): Promise<ReferenceImageSource> => {
  const result = await computePackageBinarySha256Digest(bytes);
  if (result.status !== "computed") throw new Error("SHA-256 verification is unavailable for the reference PNG.");
  return ReferenceImageSourceSchema.parse({ width, height, byteLength: bytes.byteLength, sha256: result.digest.hex });
};

export const verifyWorkspaceReferenceImageBytes = async (
  image: ReferenceImageSource,
  bytes: Uint8Array | undefined
): Promise<Uint8Array> => {
  const path = referenceImageBinaryPath(image);
  if (bytes === undefined) throw new Error(`Missing workspace reference PNG "${path}".`);
  if (bytes.byteLength !== image.byteLength) throw new Error(`Incorrect byte length for workspace reference PNG "${path}".`);
  const actual = await describeReferenceImageBytes(bytes, image);
  if (actual.sha256 !== image.sha256) throw new Error(`SHA-256 mismatch for workspace reference PNG "${path}".`);
  return bytes;
};
