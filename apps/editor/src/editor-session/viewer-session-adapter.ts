import {
  createAuthoringSessionFromPackageDocument,
  toRuntimeGraph,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import {
  evaluateViewerRuntimeSnapshot,
  type ViewerRuntimeEvaluationRequestInput,
  type ViewerRuntimeEvaluationResult
} from "@private-2d-rigging-lab/runtime-core";

export interface EditorViewerRuntimeEvaluationOptions {
  readonly packageHash?: string;
  readonly request?: ViewerRuntimeEvaluationRequestInput;
}

export const evaluateViewerRuntimeFromActiveSession = (
  session: AuthoringSession,
  options: EditorViewerRuntimeEvaluationOptions = {}
): ViewerRuntimeEvaluationResult =>
  evaluateViewerRuntimeSnapshot(
    toRuntimeGraph(session, {
      ...(options.packageHash === undefined ? {} : { packageHash: options.packageHash })
    }),
    options.request
  );

export const evaluateViewerRuntimeFromPackageDocument = (
  packageDocument: PackageDocumentDto,
  options: EditorViewerRuntimeEvaluationOptions = {}
): ViewerRuntimeEvaluationResult =>
  evaluateViewerRuntimeFromActiveSession(
    createAuthoringSessionFromPackageDocument(packageDocument),
    options
  );
