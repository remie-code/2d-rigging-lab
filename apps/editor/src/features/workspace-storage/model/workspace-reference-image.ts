import {
  createReferenceImageState,
  describeReferenceImageBytes,
  readReferencePngDimensions
} from "@private-2d-rigging-lab/authoring-core";
import { REFERENCE_IMAGE_MAX_BYTES, type ReferenceImageState } from "@private-2d-rigging-lab/contracts";

export interface EditorReferenceImage {
  readonly state: ReferenceImageState;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export async function decodeEditorReferenceImage(bytes: EditorReferenceImage["bytes"]): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes], { type: "image/png" }));
}

export async function importEditorReferenceImage(file: File): Promise<EditorReferenceImage> {
  if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
    throw new Error("The reference PNG exceeds 64 MiB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = readReferencePngDimensions(bytes);
  const bitmap = await decodeEditorReferenceImage(bytes);
  try {
    if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) {
      throw new Error("Decoded reference PNG dimensions do not match the PNG header.");
    }
  } finally {
    bitmap.close();
  }
  return { state: createReferenceImageState(await describeReferenceImageBytes(bytes, dimensions)), bytes };
}
