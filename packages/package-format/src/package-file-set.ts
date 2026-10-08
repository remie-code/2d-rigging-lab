import { PackageDocumentSchema, type PackageDocumentDto } from "./package-document.js";
import {
  PACKAGE_MANIFEST_PATH,
  PACKAGE_PROVENANCE_PATH,
  PACKAGE_RIGHTS_PATH,
  PACKAGE_TEXTURE_ATLAS_PATH,
  REQUIRED_MODEL_FILE_KEYS,
  assertPackageRelativePath,
  assertUniquePackageFilePaths,
  getAuthoredPackageFilePaths
} from "./package-file-paths.js";
import { stringifyJsonDeterministic } from "./package-json-serialization.js";
import { PackageManifestSchema, type PackageManifestDto } from "./package-manifest.js";

export interface PackageTextFileEntry {
  readonly path: string;
  readonly text: string;
}

export type PackageFileSet = readonly PackageTextFileEntry[];

export interface SerializePackageDocumentToFileSetOptions {
  readonly operationLogText?: string;
  readonly generatedArtifacts?: readonly PackageTextFileEntry[];
}

export class PackageFileSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageFileSetError";
  }
}

export function serializePackageDocumentToFileSet(
  document: PackageDocumentDto,
  options: SerializePackageDocumentToFileSetOptions = {}
): PackageFileSet {
  const parsedDocument = PackageDocumentSchema.parse(document);
  assertEditorStateManifestConsistency(parsedDocument);
  assertVariantsManifestConsistency(parsedDocument);

  const entries: PackageTextFileEntry[] = [
    createJsonFileEntry(PACKAGE_MANIFEST_PATH, parsedDocument.manifest),
    ...REQUIRED_MODEL_FILE_KEYS.map((key) => (
      createJsonFileEntry(parsedDocument.manifest.modelFiles[key], parsedDocument.model[key])
    ))
  ];

  if (parsedDocument.manifest.modelFiles.variants !== undefined) {
    entries.push(createJsonFileEntry(
      parsedDocument.manifest.modelFiles.variants,
      parsedDocument.model.variants
    ));
  }

  if (parsedDocument.manifest.modelFiles.editorState !== undefined) {
    entries.push(createJsonFileEntry(
      parsedDocument.manifest.modelFiles.editorState,
      parsedDocument.model.editorState
    ));
  }

  entries.push(
    createJsonFileEntry(parsedDocument.manifest.assetIndex, parsedDocument.assets.sourceManifest),
    ...(parsedDocument.assets.textureAtlas === undefined
      ? []
      : [createJsonFileEntry(PACKAGE_TEXTURE_ATLAS_PATH, parsedDocument.assets.textureAtlas)]),
    createJsonFileEntry(PACKAGE_PROVENANCE_PATH, parsedDocument.assets.provenance),
    createJsonFileEntry(PACKAGE_RIGHTS_PATH, parsedDocument.assets.rights)
  );

  if (options.operationLogText !== undefined) {
    entries.push(createTextFileEntry(parsedDocument.manifest.operationLog, options.operationLogText));
  }

  const generatedArtifacts = [...(options.generatedArtifacts ?? [])]
    .map((entry) => createTextFileEntry(entry.path, entry.text))
    .sort((left, right) => left.path.localeCompare(right.path));

  entries.push(...generatedArtifacts);
  assertUniquePackageFilePaths(entries.map((entry) => entry.path));

  return entries;
}

export function parsePackageDocumentFromFileSet(fileSet: PackageFileSet): PackageDocumentDto {
  const fileMap = indexPackageFileSet(fileSet);
  const manifest = PackageManifestSchema.parse(parseJsonFile(PACKAGE_MANIFEST_PATH, fileMap));
  assertUniquePackageFilePaths(getAuthoredPackageFilePaths(manifest));

  const model = {
    graph: parseJsonFile(manifest.modelFiles.graph, fileMap),
    drawables: parseJsonFile(manifest.modelFiles.drawables, fileMap),
    meshes: parseJsonFile(manifest.modelFiles.meshes, fileMap),
    parameters: parseJsonFile(manifest.modelFiles.parameters, fileMap),
    keyforms: parseJsonFile(manifest.modelFiles.keyforms, fileMap),
    rigControls: parseJsonFile(manifest.modelFiles.rigControls, fileMap),
    dynamics: parseJsonFile(manifest.modelFiles.dynamics, fileMap),
    masks: parseJsonFile(manifest.modelFiles.masks, fileMap),
    drawOrder: parseJsonFile(manifest.modelFiles.drawOrder, fileMap),
    ...(manifest.modelFiles.variants === undefined
      ? {}
      : { variants: parseJsonFile(manifest.modelFiles.variants, fileMap) }),
    ...(manifest.modelFiles.editorState === undefined
      ? {}
      : { editorState: parseJsonFile(manifest.modelFiles.editorState, fileMap) })
  };

  return PackageDocumentSchema.parse({
    manifest,
    model,
    assets: {
      sourceManifest: parseJsonFile(manifest.assetIndex, fileMap),
      ...(fileMap.has(PACKAGE_TEXTURE_ATLAS_PATH)
        ? { textureAtlas: parseJsonFile(PACKAGE_TEXTURE_ATLAS_PATH, fileMap) }
        : {}),
      provenance: parseJsonFile(PACKAGE_PROVENANCE_PATH, fileMap),
      rights: parseJsonFile(PACKAGE_RIGHTS_PATH, fileMap)
    }
  });
}

function indexPackageFileSet(fileSet: PackageFileSet): ReadonlyMap<string, string> {
  const fileMap = new Map<string, string>();

  for (const entry of fileSet) {
    const path = assertPackageRelativePath(entry.path);

    if (fileMap.has(path)) {
      throw new PackageFileSetError(`Duplicate package file path "${path}"`);
    }

    fileMap.set(path, entry.text);
  }

  return fileMap;
}

function createJsonFileEntry(path: string, value: unknown): PackageTextFileEntry {
  return createTextFileEntry(path, stringifyJsonDeterministic(value));
}

function createTextFileEntry(path: string, text: string): PackageTextFileEntry {
  return {
    path: assertPackageRelativePath(path),
    text
  };
}

function parseJsonFile(path: string, fileMap: ReadonlyMap<string, string>): unknown {
  const text = fileMap.get(path);

  if (text === undefined) {
    throw new PackageFileSetError(`Missing required package file "${path}"`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PackageFileSetError(`Invalid JSON in package file "${path}": ${message}`);
  }
}

function assertEditorStateManifestConsistency(document: PackageDocumentDto): void {
  const manifestHasEditorState = document.manifest.modelFiles.editorState !== undefined;
  const documentHasEditorState = document.model.editorState !== undefined;

  if (manifestHasEditorState !== documentHasEditorState) {
    throw new PackageFileSetError(
      "model/editor-state.json must be present in both manifest.modelFiles and document.model, or absent from both"
    );
  }
}

function assertVariantsManifestConsistency(document: PackageDocumentDto): void {
  const manifestHasVariants = document.manifest.modelFiles.variants !== undefined;
  const variantGroups = document.model.variants?.variantGroups ?? [];

  if (!manifestHasVariants && variantGroups.length > 0) {
    throw new PackageFileSetError(
      "model/variants.json must be listed in manifest.modelFiles when document.model.variants contains Variant Groups"
    );
  }
}
