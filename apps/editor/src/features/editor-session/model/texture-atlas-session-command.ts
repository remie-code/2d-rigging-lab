import type {
  AuthoringSession,
  TextureAtlasLayoutSummaryDto,
  TextureAtlasPreview,
  TextureAtlasWarning
} from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, PartId } from "@private-2d-rigging-lab/contracts";
import {
  createOperationCore,
  OperationRequestSchema,
  type ApplyTextureAtlasPreviewPayloadDto,
  type CommitOperationOutcome
} from "@private-2d-rigging-lab/operation-core";

export type TextureAtlasEditorSessionWarning = TextureAtlasWarning | DiagnosticDto;
export type TextureAtlasEditorSessionCommandResult =
  | {
      readonly committed: true;
      readonly session: AuthoringSession;
      readonly layoutSummary: TextureAtlasLayoutSummaryDto;
      readonly operationOutcome: CommitOperationOutcome;
      readonly warnings: readonly TextureAtlasEditorSessionWarning[];
    }
  | {
      readonly committed: false;
      readonly session: AuthoringSession;
      readonly operationOutcome?: CommitOperationOutcome;
      readonly warnings: readonly TextureAtlasEditorSessionWarning[];
    };

export async function commitTextureAtlasPreview(
  session: AuthoringSession,
  preview: TextureAtlasPreview,
  options: {
    readonly editorHiddenPartIds?: Iterable<PartId>;
  } = {}
): Promise<TextureAtlasEditorSessionCommandResult> {
  if (preview.status !== "ready") {
    return {
      committed: false,
      session,
      warnings: preview.warnings
    };
  }

  const nextSession = structuredClone(session);
  const operationCore = createOperationCore();
  const request = OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: nextSession.packageRevision,
    operationType: "applyTextureAtlasPreview",
    payload: createApplyTextureAtlasPreviewPayload(preview, options)
  });
  const outcome = await operationCore.commitOperationAsync(nextSession, request);

  if (outcome.result.status === "committed") {
    const layoutSummary = nextSession.graph.textureAtlas?.layoutSummary;
    if (layoutSummary === undefined) {
      return {
        committed: false,
        session,
        operationOutcome: outcome,
        warnings: outcome.result.diagnostics
      };
    }

    return {
      committed: true,
      session: nextSession,
      layoutSummary,
      operationOutcome: outcome,
      warnings: outcome.result.diagnostics
    };
  }

  return {
    committed: false,
    session,
    operationOutcome: outcome,
    warnings: outcome.result.diagnostics
  };
}

function createApplyTextureAtlasPreviewPayload(
  preview: Extract<TextureAtlasPreview, { readonly status: "ready" }>,
  options: {
    readonly editorHiddenPartIds?: Iterable<PartId>;
  }
): ApplyTextureAtlasPreviewPayloadDto {
  return {
    settings: preview.settings,
    editorHiddenPartIds: [...(options.editorHiddenPartIds ?? [])].map(String).sort() as PartId[],
    expectedLayoutSummary: preview.layoutSummary,
    lockedTargetIds: []
  };
}

export function createTextureAtlasSessionChangedWarning(): TextureAtlasWarning {
  return {
    code: "atlas.apply.stalePreview",
    severity: "error",
    targetPath: "/assets/textureAtlas/layoutSummary",
    message: "Texture atlas preview is stale because the editor session changed before Apply completed.",
    details: ["reason=editor-session-changed"]
  };
}
