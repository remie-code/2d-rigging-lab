import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  RUNTIME_EXPORT_MANIFEST_PATH,
  assertRuntimeExportV0SinglePageArtifacts,
  parseRuntimeExportAtlas,
  parseRuntimeExportManifest,
  parseRuntimeExportModel,
  type RuntimeExportAtlasDto,
  type RuntimeExportManifestDto,
  type RuntimeExportModelDto,
  type RuntimeExportRequiredCapabilityDto,
  type RuntimeExportTexturePageMetadataDto
} from "@private-2d-rigging-lab/package-format";

import type {
  RuntimeExportLoadedPayload,
  RuntimeExportSummary
} from "../../preload/runtime-export-bridge-contract";
import {
  RuntimeExportLoaderError,
  formatUnknownError
} from "./runtime-export-errors";
import { resolveRuntimeExportArtifactPath } from "./runtime-export-paths";

export type RuntimeExportDirectoryLoadResult = {
  readonly directoryPath: string;
  readonly payload: RuntimeExportLoadedPayload;
};

const requiredRuntimeExportLoadCapabilities = [
  "directory-runtime-export-v0",
  "raw-rgba8-texture-pages-v1",
  "materialized-atlas-uvs-v1",
  "transparent-background-v1"
] as const satisfies readonly RuntimeExportRequiredCapabilityDto[];

export async function loadRuntimeExportDirectory(
  runtimeExportDirectoryPath: string,
  loadedAtIso = new Date().toISOString()
): Promise<RuntimeExportDirectoryLoadResult> {
  const directoryPath = path.resolve(runtimeExportDirectoryPath);
  const manifest = await readRuntimeExportManifest(directoryPath);
  assertRequiredRuntimeExportCapabilities(manifest);
  assertSingleTexturePageArray(
    "manifest.paths.texturePages",
    manifest.paths.texturePages,
    RUNTIME_EXPORT_MANIFEST_PATH
  );
  assertSingleTexturePageArray(
    "manifest.texturePages",
    manifest.texturePages,
    RUNTIME_EXPORT_MANIFEST_PATH
  );

  const model = await readRuntimeExportModel(directoryPath, manifest.paths.model);
  const texturePageMetadata = manifest.texturePages[0];

  if (texturePageMetadata === undefined) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.unsupportedSingleTexturePage",
      "Runtime Export v0 requires one raw RGBA texture page.",
      RUNTIME_EXPORT_MANIFEST_PATH
    );
  }

  const textureBytes = await readTexturePageBytes(
    directoryPath,
    texturePageMetadata.path
  );
  const atlas = await readRuntimeExportAtlas(directoryPath, manifest.paths.atlas);
  const artifacts = assertConsistentArtifacts({ manifest, model, atlas });
  const consistentTexturePage = artifacts.manifest.texturePages[0];

  if (consistentTexturePage === undefined) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.unsupportedSingleTexturePage",
      "Runtime Export v0 requires one raw RGBA texture page.",
      RUNTIME_EXPORT_MANIFEST_PATH
    );
  }

  await assertTexturePageBytes(consistentTexturePage, textureBytes);

  const summary = createRuntimeExportSummary(artifacts.manifest, artifacts.model);

  return {
    directoryPath,
    payload: {
      artifacts,
      texturePage: {
        metadata: consistentTexturePage,
        bytes: textureBytes
      },
      summary,
      loadedAtIso
    }
  };
}

async function readRuntimeExportManifest(
  directoryPath: string
): Promise<RuntimeExportManifestDto> {
  const manifestJson = await readJsonArtifact(directoryPath, RUNTIME_EXPORT_MANIFEST_PATH);
  const result = parseRuntimeExportManifest(manifestJson);

  if (!result.success) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.invalidManifest",
      "Selected directory does not contain a valid runtime-export.json.",
      RUNTIME_EXPORT_MANIFEST_PATH,
      formatParseIssues(result.issues)
    );
  }

  return result.data;
}

async function readRuntimeExportModel(
  directoryPath: string,
  artifactPath: string
): Promise<RuntimeExportModelDto> {
  const modelJson = await readJsonArtifact(directoryPath, artifactPath);
  const result = parseRuntimeExportModel(modelJson);

  if (!result.success) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.invalidModel",
      `Runtime Export model artifact "${artifactPath}" is invalid.`,
      artifactPath,
      formatParseIssues(result.issues)
    );
  }

  return result.data;
}

async function readRuntimeExportAtlas(
  directoryPath: string,
  artifactPath: string
): Promise<RuntimeExportAtlasDto> {
  const atlasJson = await readJsonArtifact(directoryPath, artifactPath);
  const result = parseRuntimeExportAtlas(atlasJson);

  if (!result.success) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.invalidAtlas",
      `Runtime Export atlas artifact "${artifactPath}" is invalid.`,
      artifactPath,
      formatParseIssues(result.issues)
    );
  }

  return result.data;
}

async function readJsonArtifact(
  directoryPath: string,
  artifactPath: string
): Promise<unknown> {
  const text = await readTextArtifact(directoryPath, artifactPath);

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.invalidJson",
      `Runtime Export artifact "${artifactPath}" is not valid JSON.`,
      artifactPath,
      [formatUnknownError(error)]
    );
  }
}

async function readTextArtifact(
  directoryPath: string,
  artifactPath: string
): Promise<string> {
  try {
    return await readFile(
      resolveRuntimeExportArtifactPath(directoryPath, artifactPath),
      "utf8"
    );
  } catch (error) {
    throw mapReadError(error, artifactPath);
  }
}

async function readTexturePageBytes(
  directoryPath: string,
  artifactPath: string
): Promise<Uint8Array> {
  try {
    return Uint8Array.from(await readFile(
      resolveRuntimeExportArtifactPath(directoryPath, artifactPath)
    ));
  } catch (error) {
    throw mapReadError(error, artifactPath);
  }
}

function mapReadError(error: unknown, artifactPath: string): RuntimeExportLoaderError {
  if (error instanceof RuntimeExportLoaderError) {
    return error;
  }

  if (isNodeFileNotFoundError(error)) {
    return new RuntimeExportLoaderError(
      "runtimeExport.missingArtifact",
      `Runtime Export is missing required artifact "${artifactPath}".`,
      artifactPath
    );
  }

  return new RuntimeExportLoaderError(
    "runtimeExport.unexpectedError",
    `Runtime Export artifact "${artifactPath}" could not be read.`,
    artifactPath,
    [formatUnknownError(error)]
  );
}

function isNodeFileNotFoundError(
  error: unknown
): error is NodeJS.ErrnoException {
  return error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

function assertRequiredRuntimeExportCapabilities(
  manifest: RuntimeExportManifestDto
): void {
  for (const capability of requiredRuntimeExportLoadCapabilities) {
    if (manifest.requiredCapabilities.includes(capability)) {
      continue;
    }

    throw new RuntimeExportLoaderError(
      "runtimeExport.unsupportedCapability",
      `Runtime Export is missing required capability "${capability}".`,
      RUNTIME_EXPORT_MANIFEST_PATH
    );
  }
}

function assertSingleTexturePageArray(
  label: string,
  values: readonly unknown[],
  artifactPath: string
): void {
  if (values.length === 1) {
    return;
  }

  throw new RuntimeExportLoaderError(
    "runtimeExport.unsupportedSingleTexturePage",
    `Runtime Export v0 requires exactly one texture page in ${label}.`,
    artifactPath
  );
}

function assertConsistentArtifacts(input: {
  readonly manifest: RuntimeExportManifestDto;
  readonly model: RuntimeExportModelDto;
  readonly atlas: RuntimeExportAtlasDto;
}): RuntimeExportLoadedPayload["artifacts"] {
  try {
    return assertRuntimeExportV0SinglePageArtifacts(input);
  } catch (error) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.artifactInconsistent",
      formatUnknownError(error),
      RUNTIME_EXPORT_MANIFEST_PATH
    );
  }
}

async function assertTexturePageBytes(
  metadata: RuntimeExportTexturePageMetadataDto,
  bytes: Uint8Array
): Promise<void> {
  const expectedByteLength = metadata.width * metadata.height * 4;

  if (
    bytes.byteLength !== metadata.byteLength ||
    bytes.byteLength !== expectedByteLength
  ) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.textureByteLengthMismatch",
      `Runtime Export texture page "${metadata.path}" byte length does not match its metadata.`,
      metadata.path,
      [
        `expectedByteLength=${metadata.byteLength}`,
        `expectedDimensionsByteLength=${expectedByteLength}`,
        `actualByteLength=${bytes.byteLength}`
      ]
    );
  }

  const actualDigestHex = createHash("sha256").update(bytes).digest("hex");

  if (actualDigestHex !== metadata.digest.hex) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.textureDigestMismatch",
      `Runtime Export texture page "${metadata.path}" SHA-256 digest does not match its metadata.`,
      metadata.path,
      [
        `expected=sha256:${metadata.digest.hex}`,
        `actual=sha256:${actualDigestHex}`
      ]
    );
  }
}

function createRuntimeExportSummary(
  manifest: RuntimeExportManifestDto,
  model: RuntimeExportModelDto
): RuntimeExportSummary {
  const texturePage = manifest.texturePages[0];

  if (texturePage === undefined) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.unsupportedSingleTexturePage",
      "Runtime Export v0 requires one raw RGBA texture page.",
      RUNTIME_EXPORT_MANIFEST_PATH
    );
  }

  return {
    modelDisplayName: manifest.sourcePackage.packageDisplayName,
    packageId: manifest.sourcePackage.packageId,
    packageRevision: manifest.sourcePackage.packageRevision,
    drawableCount: model.drawables.length,
    meshCount: model.meshes.length,
    parameterCount: model.parameters.length,
    maskCount: model.masks.length,
    texturePage: {
      pageId: texturePage.pageId,
      path: texturePage.path,
      width: texturePage.width,
      height: texturePage.height,
      pixelFormat: texturePage.pixelFormat,
      byteLength: texturePage.byteLength
    },
    requiredCapabilities: [...manifest.requiredCapabilities]
  };
}

function formatParseIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]
): readonly string[] {
  return issues.map((issue) => {
    const issuePath = issue.path.length === 0 ?
      "/" :
      `/${issue.path.map((segment) => String(segment)).join("/")}`;

    return `${issuePath}: ${issue.message}`;
  });
}
