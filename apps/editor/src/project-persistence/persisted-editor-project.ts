import type { AiCommandTranscriptDocument } from "@private-2d-rigging-lab/ai-interface";
import type { PackageFileSet } from "@private-2d-rigging-lab/package-format";

export const PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION = "editor-project-persistence-v1";

export interface PersistedEditorProjectPackageSummary {
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly formatVersion: string;
  readonly packageRevision: number;
  readonly updatedAt: string;
}

export interface PersistedEditorProjectDto {
  readonly schemaVersion: typeof PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly packageFileSet: PackageFileSet;
  readonly operationLogJsonl: string;
  readonly aiCommandTranscript: AiCommandTranscriptDocument;
  readonly generatedArtifactPaths: readonly string[];
  readonly packageSummary: PersistedEditorProjectPackageSummary;
}
