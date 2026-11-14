import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  parseWorkspaceReferenceImage,
  referenceImageBinaryPath,
  REFERENCE_IMAGE_STATE_PATH,
  serializeWorkspaceReferenceImage,
  verifyWorkspaceReferenceImageBytes
} from "@private-2d-rigging-lab/authoring-core";
import { REFERENCE_IMAGE_MAX_BYTES, type ReferenceImageState } from "@private-2d-rigging-lab/contracts";

import { HostError } from "./host-error.js";
import { assertNoLinkedPath } from "./package-path-guard.js";
import { decodeReferencePng, type DecodedReferencePng } from "./reference-png.js";

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

export const readReferencePngFile = async (path: string): Promise<Buffer> => {
  const info = await stat(path);
  if (!info.isFile() || info.size > REFERENCE_IMAGE_MAX_BYTES) {
    throw new HostError("invalid-reference-png", `Expected a PNG file up to 64 MiB at "${path}".`);
  }
  return readFile(path);
};

export const readReferenceImageState = async (directory: string): Promise<ReferenceImageState | null> => {
  const path = join(directory, REFERENCE_IMAGE_STATE_PATH);
  await assertNoLinkedPath(path);
  const text = await readFile(path, "utf8").catch((error: unknown) => {
    if (!isMissing(error)) throw error;
    return undefined;
  });
  return parseWorkspaceReferenceImage(text);
};

export const loadWorkspaceReferencePng = async (
  directory: string,
  state: ReferenceImageState
): Promise<DecodedReferencePng> => {
  const relativePath = referenceImageBinaryPath(state.image);
  const path = join(directory, relativePath);
  await assertNoLinkedPath(path);
  const bytes = await readReferencePngFile(path).catch((error: unknown) => {
    if (!isMissing(error)) throw error;
    return undefined;
  });
  const verified = await verifyWorkspaceReferenceImageBytes(state.image, bytes);
  const decoded = decodeReferencePng(Buffer.from(verified.buffer, verified.byteOffset, verified.byteLength));
  if (decoded.width !== state.image.width || decoded.height !== state.image.height) {
    throw new HostError("reference-dimensions-mismatch", `Reference PNG dimensions disagree with "${REFERENCE_IMAGE_STATE_PATH}".`);
  }
  return decoded;
};

const atomicWrite = async (path: string, content: string | Uint8Array): Promise<void> => {
  await assertNoLinkedPath(path);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
};

/** Publish the image first. Old content-addressed files can still be read by a concurrent Editor open. */
export const writeWorkspaceReferenceImage = async (
  directory: string,
  state: ReferenceImageState | null,
  png?: Uint8Array
): Promise<void> => {
  const entry = serializeWorkspaceReferenceImage(state);
  if (state !== null && png !== undefined) {
    const path = join(directory, referenceImageBinaryPath(state.image));
    await atomicWrite(path, png);
  }
  await atomicWrite(join(directory, entry.path), entry.text);
};
