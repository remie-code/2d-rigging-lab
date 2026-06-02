import { defaultRuntimeEvaluationOptions } from "@private-2d-rigging-lab/runtime-core";
import {
  buildTutorialMiniModelReadinessReport,
  CANONICAL_OPERATION_LOG_PATH,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";

import {
  evaluateViewerRuntimeFromActiveSession,
  evaluateViewerRuntimeFromPackageDocument,
  type EditorSessionAdapter
} from "../editor-session/index.js";
import { projectTutorialReadinessPreflightState } from "../editor-state/index.js";

export const projectTutorialReadinessPreflightFromActiveSession = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly packageDocument: PackageDocumentDto;
  readonly now?: () => Date;
}) =>
  projectTutorialReadinessPreflightState(
    buildTutorialReadinessReport({
      packageDocument: input.packageDocument,
      ...(input.now === undefined ? {} : { createdAt: input.now().toISOString() }),
      evaluate: () =>
        evaluateViewerRuntimeFromActiveSession(input.adapter.authoringSession, {
          request: createTutorialReadinessViewerRequest(input.packageDocument)
        })
    })
  );

export const projectTutorialReadinessPreflightFromPackageDocument = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly now?: () => Date;
}) =>
  projectTutorialReadinessPreflightState(
    buildTutorialReadinessReport({
      packageDocument: input.packageDocument,
      ...(input.now === undefined ? {} : { createdAt: input.now().toISOString() }),
      evaluate: () =>
        evaluateViewerRuntimeFromPackageDocument(input.packageDocument, {
          request: createTutorialReadinessViewerRequest(input.packageDocument)
        })
    })
  );

const buildTutorialReadinessReport = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly createdAt?: string;
  readonly evaluate: () => ReturnType<typeof evaluateViewerRuntimeFromPackageDocument>;
}): ValidationReportDto => {
  const evaluation = input.evaluate();

  return buildTutorialMiniModelReadinessReport({
    packageDocument: input.packageDocument,
    runtimeSnapshot: evaluation.snapshot,
    viewerEvidence: evaluation.evidence,
    operationLogPresent: true,
    operationLogPath: CANONICAL_OPERATION_LOG_PATH,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt })
  });
};

const createTutorialReadinessViewerRequest = (
  packageDocument: PackageDocumentDto
) => ({
  targetIds: collectTutorialReadinessTargetIds(packageDocument),
  options: {
    ...defaultRuntimeEvaluationOptions(),
    snapshotDetail: "full" as const
  }
});

const collectTutorialReadinessTargetIds = (
  packageDocument: PackageDocumentDto
): string[] =>
  uniqueStrings([
    ...packageDocument.model.parameters.parameters.map((parameter) => parameter.parameterId),
    ...packageDocument.model.graph.parts.map((part) => part.partId),
    ...packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId),
    ...packageDocument.model.meshes.meshes.map((mesh) => mesh.meshId),
    ...packageDocument.model.rigControls.rigControls.map((rigControl) => rigControl.rigControlId),
    ...packageDocument.model.rigControls.rigControls.flatMap((rigControl) => rigControl.childDrawableIds),
    ...packageDocument.model.rigControls.rigControls.flatMap((rigControl) => rigControl.childRigControlIds),
    ...packageDocument.model.masks.masks.map((relation) => relation.maskRelationId),
    ...packageDocument.model.masks.masks.flatMap((relation) => relation.maskDrawableIds),
    ...packageDocument.model.masks.masks.flatMap((relation) => relation.targetDrawableIds),
    ...packageDocument.model.dynamics.dynamicsGroups.map((group) => group.dynamicsGroupId),
    ...packageDocument.model.dynamics.dynamicsGroups.map((group) => group.output.targetParameterId)
  ]);

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};
