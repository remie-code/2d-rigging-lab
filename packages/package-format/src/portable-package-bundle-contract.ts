import { z } from "zod";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";

import { BinaryAssetReferenceSchema } from "./binary-asset.js";
import { PackageDocumentSchema } from "./package-document.js";
import { PackageRevisionSchema } from "./package-manifest.js";

const BASE64_PADDING_CHARACTER_CODE = "=".charCodeAt(0);
const PORTABLE_BINARY_PAYLOAD_BASE64_MESSAGE =
  "Portable binary payloads must be standard base64 without data URL prefixes or whitespace.";

export const PortablePackageBundleVersionSchema = z.literal("portable-package-bundle-v0");
export type PortablePackageBundleVersionDto = z.infer<
  typeof PortablePackageBundleVersionSchema
>;
export const PortablePackageBundleVersionDtoSchema = PortablePackageBundleVersionSchema;

export const PortablePackageBundleKindSchema = z.literal("project-defined-json-bundle-v0");
export type PortablePackageBundleKindDto = z.infer<typeof PortablePackageBundleKindSchema>;
export const PortablePackageBundleKindDtoSchema = PortablePackageBundleKindSchema;

export const PortablePackageBundlePayloadEncodingSchema = z.literal("base64-v1");
export type PortablePackageBundlePayloadEncodingDto = z.infer<
  typeof PortablePackageBundlePayloadEncodingSchema
>;
export const PortablePackageBundlePayloadEncodingDtoSchema =
  PortablePackageBundlePayloadEncodingSchema;

export const PortablePackageBundleBase64PayloadSchema = z.string().refine(
  isStandardBase64Payload,
  PORTABLE_BINARY_PAYLOAD_BASE64_MESSAGE
);
export type PortablePackageBundleBase64PayloadDto = z.infer<
  typeof PortablePackageBundleBase64PayloadSchema
>;
export const PortablePackageBundleBase64PayloadDtoSchema =
  PortablePackageBundleBase64PayloadSchema;

export const PortablePackageBundleBinaryPayloadSchema = z.object({
  binaryAssetRef: BinaryAssetReferenceSchema,
  payloadEncoding: PortablePackageBundlePayloadEncodingSchema,
  payloadBase64: PortablePackageBundleBase64PayloadSchema
}).strict();
export type PortablePackageBundleBinaryPayloadDto = z.infer<
  typeof PortablePackageBundleBinaryPayloadSchema
>;
export const PortablePackageBundleBinaryPayloadDtoSchema =
  PortablePackageBundleBinaryPayloadSchema;

export const PortablePackageBundleV0Schema = z.object({
  schemaVersion: PortablePackageBundleVersionSchema,
  bundleKind: PortablePackageBundleKindSchema,
  packageId: PackageIdSchema,
  packageRevision: PackageRevisionSchema,
  packageDocument: PackageDocumentSchema,
  binaryPayloads: z.array(PortablePackageBundleBinaryPayloadSchema)
}).strict().superRefine((bundle, context) => {
  if (bundle.packageId !== bundle.packageDocument.manifest.packageId) {
    context.addIssue({
      code: "custom",
      path: ["packageId"],
      message: "Portable bundle packageId must match packageDocument.manifest.packageId."
    });
  }

  if (bundle.packageRevision !== bundle.packageDocument.manifest.packageRevision) {
    context.addIssue({
      code: "custom",
      path: ["packageRevision"],
      message: "Portable bundle packageRevision must match packageDocument.manifest.packageRevision."
    });
  }
});
export type PortablePackageBundleV0Dto = z.infer<typeof PortablePackageBundleV0Schema>;
export const PortablePackageBundleV0DtoSchema = PortablePackageBundleV0Schema;

function isStandardBase64Payload(payload: string): boolean {
  if (payload.length === 0) {
    return true;
  }

  if (payload.length % 4 !== 0) {
    return false;
  }

  const lastIndex = payload.length - 1;
  const paddingLength = payload.charCodeAt(lastIndex) === BASE64_PADDING_CHARACTER_CODE
    ? payload.charCodeAt(lastIndex - 1) === BASE64_PADDING_CHARACTER_CODE
      ? 2
      : 1
    : 0;
  const contentLength = payload.length - paddingLength;

  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64PayloadCharacterCode(payload.charCodeAt(index))) {
      return false;
    }
  }

  for (let index = contentLength; index < payload.length; index += 1) {
    if (payload.charCodeAt(index) !== BASE64_PADDING_CHARACTER_CODE) {
      return false;
    }
  }

  return true;
}

function isBase64PayloadCharacterCode(characterCode: number): boolean {
  return (characterCode >= 65 && characterCode <= 90) ||
    (characterCode >= 97 && characterCode <= 122) ||
    (characterCode >= 48 && characterCode <= 57) ||
    characterCode === 43 ||
    characterCode === 47;
}
