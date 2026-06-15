import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  exportAuthoringSessionPortableBundle,
  importAuthoringSessionPortableBundle
} from "@private-2d-rigging-lab/authoring-core";
import type { PartId } from "@private-2d-rigging-lab/contracts";

export type EditorProjectStorageErrorCode =
  | "digestMismatch"
  | "invalidBundle"
  | "missingBytes"
  | "portableBundle"
  | "unknown";

export interface EditorProjectStorageIssue {
  readonly code: string;
  readonly message: string;
  readonly targetPath?: string;
  readonly expected?: string;
  readonly actual?: string;
}

export class EditorProjectStorageError extends Error {
  readonly code: EditorProjectStorageErrorCode;
  readonly issues: readonly EditorProjectStorageIssue[];

  constructor(input: {
    readonly code: EditorProjectStorageErrorCode;
    readonly message: string;
    readonly issues?: readonly EditorProjectStorageIssue[];
  }) {
    super(input.message);
    this.name = "EditorProjectStorageError";
    this.code = input.code;
    this.issues = [...(input.issues ?? [])];
  }
}

export interface ExportEditorProjectBundleInput {
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly now?: () => Date;
}

export interface ExportEditorProjectBundleResult {
  readonly bundleJson: string;
  readonly packageDocument: unknown;
  readonly fileName: string;
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly packageRevision: number;
  readonly binaryPayloadCount: number;
  readonly exportedAt: string;
}

export interface ImportEditorProjectBundleInput {
  readonly bundleText: string;
}

export interface ImportEditorProjectBundleResult {
  readonly session: AuthoringSession;
  readonly packageDocument: unknown;
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly packageRevision: number;
  readonly binaryPayloadCount: number;
  readonly binaryFileCount: number;
  readonly editorHiddenPartIds: readonly PartId[];
}

export const exportEditorProjectBundle = async (
  input: ExportEditorProjectBundleInput
): Promise<ExportEditorProjectBundleResult> => {
  const exportedAt = (input.now?.() ?? new Date()).toISOString();

  try {
    const exported = await exportAuthoringSessionPortableBundle({
      session: input.session,
      ...(input.baseDocument === undefined ? {} : { baseDocument: input.baseDocument }),
      ...(input.editorHiddenPartIds === undefined
        ? {}
        : { editorHiddenPartIds: input.editorHiddenPartIds }),
      updatedAt: exportedAt
    });

    return {
      ...exported,
      fileName: createPortableProjectFileName({
        displayName: exported.packageDisplayName,
        packageRevision: exported.packageRevision
      }),
      exportedAt
    };
  } catch (error) {
    throw toEditorProjectStorageError(error, "save");
  }
};

export const importEditorProjectBundle = async (
  input: ImportEditorProjectBundleInput
): Promise<ImportEditorProjectBundleResult> => {
  try {
    return await importAuthoringSessionPortableBundle({ bundle: input.bundleText });
  } catch (error) {
    throw toEditorProjectStorageError(error, "open");
  }
};

export const createPortableProjectFileName = (input: {
  readonly displayName: string;
  readonly packageRevision: number;
}): string => {
  const slug = input.displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug.length === 0 ? "project" : slug}-rev${input.packageRevision}.portable-project.json`;
};

export const toEditorProjectStorageError = (
  error: unknown,
  action: "open" | "save"
): EditorProjectStorageError => {
  if (error instanceof EditorProjectStorageError) {
    return error;
  }

  const issues = extractStorageIssues(error);
  const code = classifyStorageError(issues);
  const fallbackMessage =
    action === "save"
      ? "Project could not be saved as a portable bundle."
      : "Project bundle could not be opened.";
  const message =
    issues[0]?.message ??
    (error instanceof Error && error.message.length > 0 ? error.message : fallbackMessage);

  return new EditorProjectStorageError({
    code,
    message,
    issues
  });
};

const classifyStorageError = (
  issues: readonly EditorProjectStorageIssue[]
): EditorProjectStorageErrorCode => {
  if (issues.some((issue) => issue.code.includes("digest") || issue.code.includes("byteLength"))) {
    return "digestMismatch";
  }

  if (issues.some((issue) => issue.code.includes("missing"))) {
    return "missingBytes";
  }

  if (issues.some((issue) => issue.code.includes("json") || issue.code.includes("schema"))) {
    return "invalidBundle";
  }

  return issues.length > 0 ? "portableBundle" : "unknown";
};

const extractStorageIssues = (error: unknown): readonly EditorProjectStorageIssue[] => {
  if (typeof error !== "object" || error === null || !("issues" in error)) {
    return [];
  }

  const rawIssues = (error as { readonly issues?: unknown }).issues;
  if (!Array.isArray(rawIssues)) {
    return [];
  }

  return rawIssues.flatMap((issue): EditorProjectStorageIssue[] => {
    if (typeof issue !== "object" || issue === null) {
      return [];
    }

    const record = issue as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "portableBundle.unknown";
    const message =
      typeof record.message === "string" ? record.message : "Portable bundle issue.";

    return [
      {
        code,
        message,
        ...(typeof record.targetPath === "string" ? { targetPath: record.targetPath } : {}),
        ...(typeof record.expected === "string" ? { expected: record.expected } : {}),
        ...(typeof record.actual === "string" ? { actual: record.actual } : {})
      }
    ];
  });
};
