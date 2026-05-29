import {
  createEmptyAiCommandTranscriptDocument,
  parseAiCommandTranscriptDocument,
  type AiCommandTranscriptDocument
} from "@private-2d-rigging-lab/ai-interface";
import { parseOperationLogEntriesFromJsonl } from "@private-2d-rigging-lab/operation-core";
import {
  parsePackageDocumentFromFileSet,
  type PackageFileSet
} from "@private-2d-rigging-lab/package-format";

import {
  PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION,
  type PersistedEditorProjectDto,
  type PersistedEditorProjectPackageSummary
} from "./persisted-editor-project.js";

export type PersistedEditorProjectValidationFailureReason =
  | "invalid-json"
  | "invalid-schema"
  | "invalid-package-file-set"
  | "invalid-operation-log-jsonl"
  | "invalid-ai-command-transcript";

export interface PersistedEditorProjectValidationFailure {
  readonly status: "failed";
  readonly reason: PersistedEditorProjectValidationFailureReason;
  readonly message: string;
}

export interface PersistedEditorProjectValidationSuccess {
  readonly status: "valid";
  readonly project: PersistedEditorProjectDto;
}

export type PersistedEditorProjectValidationResult =
  | PersistedEditorProjectValidationSuccess
  | PersistedEditorProjectValidationFailure;

export const parsePersistedEditorProjectJson = (
  text: string
): PersistedEditorProjectValidationResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      status: "failed",
      reason: "invalid-json",
      message: `Stored editor project is not valid JSON: ${formatErrorMessage(error)}`
    };
  }

  return validatePersistedEditorProject(parsed);
};

export const validatePersistedEditorProject = (
  input: unknown
): PersistedEditorProjectValidationResult => {
  const schemaResult = readPersistedEditorProjectShape(input);
  if (schemaResult.status === "failed") {
    return schemaResult;
  }

  try {
    const document = parsePackageDocumentFromFileSet(schemaResult.project.packageFileSet);
    if (!packageSummaryMatchesManifest(schemaResult.project.packageSummary, document.manifest)) {
      return {
        status: "failed",
        reason: "invalid-schema",
        message: "Stored editor project packageSummary does not match package manifest."
      };
    }
  } catch (error) {
    return {
      status: "failed",
      reason: "invalid-package-file-set",
      message: `Stored package file set is invalid: ${formatErrorMessage(error)}`
    };
  }

  try {
    parseOperationLogEntriesFromJsonl(schemaResult.project.operationLogJsonl);
  } catch (error) {
    return {
      status: "failed",
      reason: "invalid-operation-log-jsonl",
      message: `Stored operation log JSONL is invalid: ${formatErrorMessage(error)}`
    };
  }

  return schemaResult;
};

const readPersistedEditorProjectShape = (
  input: unknown
): PersistedEditorProjectValidationResult => {
  if (!isRecord(input)) {
    return invalidSchema("Stored editor project must be an object.");
  }

  if (input.schemaVersion !== PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION) {
    return invalidSchema(
      `Stored editor project schemaVersion must be ${PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION}.`
    );
  }

  if (typeof input.savedAt !== "string") {
    return invalidSchema("Stored editor project savedAt must be a string.");
  }

  const packageFileSet = readPackageFileSet(input.packageFileSet);
  if (packageFileSet === undefined) {
    return invalidSchema("Stored editor project packageFileSet must be package text file entries.");
  }

  if (typeof input.operationLogJsonl !== "string") {
    return invalidSchema("Stored editor project operationLogJsonl must be a string.");
  }

  const generatedArtifactPaths = readStringArray(input.generatedArtifactPaths);
  if (generatedArtifactPaths === undefined) {
    return invalidSchema("Stored editor project generatedArtifactPaths must be strings.");
  }

  const packageSummary = readPackageSummary(input.packageSummary);
  if (packageSummary === undefined) {
    return invalidSchema("Stored editor project packageSummary is invalid.");
  }

  const aiCommandTranscript = readAiCommandTranscriptDocument(input.aiCommandTranscript);
  if (aiCommandTranscript.status === "failed") {
    return aiCommandTranscript;
  }

  return {
    status: "valid",
    project: {
      schemaVersion: PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION,
      savedAt: input.savedAt,
      packageFileSet,
      operationLogJsonl: input.operationLogJsonl,
      aiCommandTranscript: aiCommandTranscript.document,
      generatedArtifactPaths,
      packageSummary
    }
  };
};

const readPackageFileSet = (input: unknown): PackageFileSet | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const entries = input.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || typeof entry.text !== "string") {
      return undefined;
    }

    return {
      path: entry.path,
      text: entry.text
    };
  });

  if (entries.some((entry) => entry === undefined)) {
    return undefined;
  }

  return entries as PackageFileSet;
};

const readPackageSummary = (
  input: unknown
): PersistedEditorProjectPackageSummary | undefined => {
  if (!isRecord(input)) {
    return undefined;
  }

  if (
    typeof input.packageId !== "string"
    || typeof input.packageDisplayName !== "string"
    || typeof input.formatVersion !== "string"
    || typeof input.packageRevision !== "number"
    || !Number.isInteger(input.packageRevision)
    || input.packageRevision < 0
    || typeof input.updatedAt !== "string"
  ) {
    return undefined;
  }

  return {
    packageId: input.packageId,
    packageDisplayName: input.packageDisplayName,
    formatVersion: input.formatVersion,
    packageRevision: input.packageRevision,
    updatedAt: input.updatedAt
  };
};

const packageSummaryMatchesManifest = (
  summary: PersistedEditorProjectPackageSummary,
  manifest: {
    readonly packageId: string;
    readonly packageDisplayName: string;
    readonly formatVersion: string;
    readonly packageRevision: number;
    readonly updatedAt: string;
  }
): boolean =>
  summary.packageId === manifest.packageId
  && summary.packageDisplayName === manifest.packageDisplayName
  && summary.formatVersion === manifest.formatVersion
  && summary.packageRevision === manifest.packageRevision
  && summary.updatedAt === manifest.updatedAt;

const readStringArray = (input: unknown): readonly string[] | undefined => {
  if (!Array.isArray(input) || input.some((entry) => typeof entry !== "string")) {
    return undefined;
  }

  return input;
};

type ReadAiCommandTranscriptDocumentResult =
  | {
    readonly status: "valid";
    readonly document: AiCommandTranscriptDocument;
  }
  | PersistedEditorProjectValidationFailure;

const readAiCommandTranscriptDocument = (
  input: unknown
): ReadAiCommandTranscriptDocumentResult => {
  if (input === undefined) {
    return {
      status: "valid",
      document: createEmptyAiCommandTranscriptDocument()
    };
  }

  try {
    return {
      status: "valid",
      document: parseAiCommandTranscriptDocument(input)
    };
  } catch (error) {
    return {
      status: "failed",
      reason: "invalid-ai-command-transcript",
      message: `Stored AI command transcript is invalid: ${formatErrorMessage(error)}`
    };
  }
};

const invalidSchema = (message: string): PersistedEditorProjectValidationFailure => ({
  status: "failed",
  reason: "invalid-schema",
  message
});

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
