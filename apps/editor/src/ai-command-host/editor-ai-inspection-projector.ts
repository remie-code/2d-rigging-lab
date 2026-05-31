import type { InspectModelResult, InspectTargetResult } from "@private-2d-rigging-lab/ai-interface";
import {
  CheckIdSchema,
  type DiagnosticDto,
  type TargetKind,
  type TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetDto,
  PackageDocumentDto,
  ParameterDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { EditorSemanticState, ParameterListItemState } from "../editor-state/index.js";

export interface EditorInspectionProjectorInput {
  readonly state?: EditorSemanticState;
  readonly packageDocument?: PackageDocumentDto;
}

export interface EditorInspectModelProjection extends InspectModelResult {
  readonly schemaVersion: "editor-inspection-projection-v1";
  readonly packageRevision?: number;
  readonly targetCounts: {
    readonly parameters: number;
  };
  readonly supportedEditableTargetKinds: readonly ["parameter"];
}

export type EditorInspectTargetStatus = "ok" | "missing" | "unsupported";
type SupportedInspectionTargetKinds = readonly ["parameter", "sourceAsset"];

export interface EditorInspectTargetProjection extends InspectTargetResult {
  readonly schemaVersion: "editor-inspection-projection-v1";
  readonly status: EditorInspectTargetStatus;
  readonly reason?: "target_not_found" | "unsupported_target_kind";
  readonly supportedTargetKinds?: SupportedInspectionTargetKinds;
  readonly parameter?: ParameterInspectionDetail;
  readonly sourceAsset?: SourceAssetInspectionDetail;
  readonly diagnostics?: readonly DiagnosticDto[];
}

export interface ParameterInspectionDetail {
  readonly parameterId: string;
  readonly displayName: string;
  readonly semanticRole?: string;
  readonly projectPresetAlias?: string;
  readonly valueSource: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly recommendedUiStep: number;
}

export interface SourceAssetInspectionDetail {
  readonly sourceAssetId: string;
  readonly kind: string;
  readonly filePath: string;
  readonly importProfile: string;
  readonly layerCount: number;
  readonly flattenedDiagnostics: readonly string[];
  readonly projectionBasis: "structured-psd-profile-metadata" | "source-manifest-flattened-summary";
  readonly truthfulness: string;
  readonly structuredPsdProfile?: {
    readonly adapterName: string;
    readonly adapterEvidenceKind: string;
    readonly canvas: {
      readonly width: number;
      readonly height: number;
    };
    readonly sourceGroupCount: number;
    readonly sourceLayerCount: number;
    readonly unsupportedFeatureCount: number;
    readonly adapterDiagnosticCount: number;
    readonly compatibilityPolicy: {
      readonly structuredProfilePrecedence: string;
      readonly flattenedDiagnosticsFallback: string;
      readonly flattenedUnsupportedFeaturesFallback: string;
    };
    readonly sourceGroups: readonly {
      readonly sourceGroupId: string;
      readonly groupPath: readonly string[];
      readonly visibleInSource: boolean;
      readonly opacityInSource: number;
      readonly unsupportedFeatureIds: readonly string[];
      readonly targetPartId?: string;
    }[];
    readonly sourceLayers: readonly {
      readonly sourceLayerId: string;
      readonly groupPath: readonly string[];
      readonly bounds: SourceAssetDto["layers"][number]["bounds"];
      readonly visibleInSource: boolean;
      readonly opacityInSource: number;
      readonly role: string;
      readonly unsupportedFeatureIds: readonly string[];
      readonly texturePreviewReference?: string;
      readonly textureId?: string;
      readonly targetPartId?: string;
    }[];
    readonly adapterDiagnostics: readonly {
      readonly checkId: string;
      readonly severity: string;
      readonly message: string;
      readonly evidence: readonly string[];
    }[];
  };
}

type ParameterInspectionSource =
  | {
      readonly source: "packageDocument";
      readonly index: number;
      readonly parameter: ParameterDto;
    }
  | {
      readonly source: "editorState";
      readonly index: number;
      readonly parameter: ParameterListItemState;
    };

type SourceAssetInspectionSource =
  | {
      readonly source: "packageDocument";
      readonly index: number;
      readonly sourceAsset: SourceAssetDto;
    }
  | {
      readonly source: "editorState";
      readonly index: number;
      readonly sourceAsset: SourceAssetDto;
    };

const supportedInspectionTargetKinds = ["parameter", "sourceAsset"] as const satisfies SupportedInspectionTargetKinds;

export const projectEditorInspectModel = (
  input: EditorInspectionProjectorInput
): EditorInspectModelProjection => {
  const parameters = listParameterSources(input);
  const parameterTargets = parameters.map(({ index, parameter }) =>
    parameterTargetRef(parameter.parameterId, index)
  );

  return {
    schemaVersion: "editor-inspection-projection-v1",
    ...projectPackageRevision(input),
    targets: parameterTargets,
    editableTargets: parameterTargets,
    targetCounts: {
      parameters: parameterTargets.length
    },
    supportedEditableTargetKinds: ["parameter"]
  };
};

export const projectEditorInspectTarget = (
  input: EditorInspectionProjectorInput,
  target: TargetRefDto,
  options: { readonly includeReferences?: boolean } = {}
): EditorInspectTargetProjection => {
  if (target.kind === "sourceAsset") {
    return projectEditorInspectSourceAsset(input, target);
  }

  if (target.kind !== "parameter") {
    return {
      schemaVersion: "editor-inspection-projection-v1",
      status: "unsupported",
      reason: "unsupported_target_kind",
      target,
      references: [],
      supportedTargetKinds: supportedInspectionTargetKinds,
      diagnostics: [
        {
          checkId: CheckIdSchema.parse("ai.editor.inspectTarget.unsupportedTargetKind"),
          status: "needs_review",
          severity: "warning",
          phase: "editorInspection",
          message: `inspectTarget currently supports parameter and sourceAsset targets, not ${target.kind}.`,
          target,
          evidence: [],
          relatedAC: [],
          relatedScenarios: [],
          repairCandidateIds: []
        }
      ]
    };
  }

  const parameter = findParameterSource(input, target.id);
  if (parameter === undefined) {
    return {
      schemaVersion: "editor-inspection-projection-v1",
      status: "missing",
      reason: "target_not_found",
      target,
      references: [],
      supportedTargetKinds: supportedInspectionTargetKinds,
      diagnostics: [
        {
          checkId: CheckIdSchema.parse("ai.editor.inspectTarget.targetNotFound"),
          status: "needs_review",
          severity: "warning",
          phase: "editorInspection",
          message: `Parameter target ${target.id} was not found in the current editor model.`,
          target,
          evidence: [],
          relatedAC: [],
          relatedScenarios: [],
          repairCandidateIds: []
        }
      ]
    };
  }

  const resolvedTarget = parameterTargetRef(parameter.parameter.parameterId, parameter.index);

  return {
    schemaVersion: "editor-inspection-projection-v1",
    status: "ok",
    target: resolvedTarget,
    references:
      options.includeReferences === false
        ? []
        : listParameterReferences(input.packageDocument, parameter.parameter.parameterId),
    parameter: projectParameterDetail(parameter)
  };
};

const projectEditorInspectSourceAsset = (
  input: EditorInspectionProjectorInput,
  target: TargetRefDto
): EditorInspectTargetProjection => {
  const sourceAsset = findSourceAssetSource(input, target.id);
  if (sourceAsset === undefined) {
    return {
      schemaVersion: "editor-inspection-projection-v1",
      status: "missing",
      reason: "target_not_found",
      target,
      references: [],
      supportedTargetKinds: supportedInspectionTargetKinds,
      diagnostics: [
        {
          checkId: CheckIdSchema.parse("ai.editor.inspectTarget.sourceAssetNotFound"),
          status: "needs_review",
          severity: "warning",
          phase: "editorInspection",
          message: `Source asset target ${target.id} was not found in the current editor model.`,
          target,
          evidence: [],
          relatedAC: [],
          relatedScenarios: [],
          repairCandidateIds: []
        }
      ]
    };
  }

  return {
    schemaVersion: "editor-inspection-projection-v1",
    status: "ok",
    target: sourceAssetTargetRef(sourceAsset.sourceAsset.sourceAssetId, sourceAsset.index),
    references: [],
    sourceAsset: projectSourceAssetDetail(sourceAsset.sourceAsset)
  };
};

const listParameterSources = (
  input: EditorInspectionProjectorInput
): readonly ParameterInspectionSource[] => {
  const documentParameters = input.packageDocument?.model.parameters.parameters;
  if (documentParameters !== undefined) {
    return documentParameters.map((parameter, index) => ({
      source: "packageDocument",
      index,
      parameter
    }));
  }

  return (input.state?.parameters ?? []).map((parameter, index) => ({
    source: "editorState",
    index,
    parameter
  }));
};

const findParameterSource = (
  input: EditorInspectionProjectorInput,
  parameterId: string
): ParameterInspectionSource | undefined =>
  listParameterSources(input).find(({ parameter }) => parameter.parameterId === parameterId);

const listSourceAssetSources = (
  input: EditorInspectionProjectorInput
): readonly SourceAssetInspectionSource[] => {
  const documentSourceAssets = input.packageDocument?.assets.sourceManifest.sourceAssets;
  if (documentSourceAssets !== undefined) {
    return documentSourceAssets.map((sourceAsset, index) => ({
      source: "packageDocument",
      index,
      sourceAsset
    }));
  }

  return (input.state?.sourceAssets ?? []).map((sourceAsset, index) => ({
    source: "editorState",
    index,
    sourceAsset
  }));
};

const findSourceAssetSource = (
  input: EditorInspectionProjectorInput,
  sourceAssetId: string
): SourceAssetInspectionSource | undefined =>
  listSourceAssetSources(input).find(({ sourceAsset }) => sourceAsset.sourceAssetId === sourceAssetId);

const projectParameterDetail = (
  source: ParameterInspectionSource
): ParameterInspectionDetail => {
  if (source.source === "packageDocument") {
    const { parameter } = source;

    return {
      parameterId: parameter.parameterId,
      displayName: parameter.displayName,
      ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
      ...(parameter.projectPresetAlias === undefined
        ? {}
        : { projectPresetAlias: parameter.projectPresetAlias }),
      valueSource: parameter.valueSource,
      min: parameter.min,
      max: parameter.max,
      default: parameter.default,
      recommendedUiStep: parameter.recommendedUiStep
    };
  }

  const { parameter } = source;

  return {
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: parameter.valueSource,
    min: parameter.min,
    max: parameter.max,
    default: parameter.defaultValue,
    recommendedUiStep: parameter.recommendedUiStep
  };
};

const projectSourceAssetDetail = (
  sourceAsset: SourceAssetDto
): SourceAssetInspectionDetail => {
  const profile = sourceAsset.psdProfile;

  return {
    sourceAssetId: sourceAsset.sourceAssetId,
    kind: sourceAsset.kind,
    filePath: sourceAsset.filePath,
    importProfile: sourceAsset.importProfile,
    layerCount: sourceAsset.layers.length,
    flattenedDiagnostics: sourceAsset.diagnostics,
    projectionBasis:
      profile === undefined ? "source-manifest-flattened-summary" : "structured-psd-profile-metadata",
    truthfulness:
      profile === undefined
        ? "Projection is based on source-manifest flattened metadata."
        : "Projection is based on adapter-supplied structured PSD profile metadata; the editor did not parse PSD bytes, decode images, or extract rasters.",
    ...(profile === undefined
      ? {}
      : {
          structuredPsdProfile: {
            adapterName: profile.adapter.adapterName,
            adapterEvidenceKind: profile.adapter.evidenceKind,
            canvas: {
              width: profile.canvas.width,
              height: profile.canvas.height
            },
            sourceGroupCount: profile.sourceGroups.length,
            sourceLayerCount: profile.sourceLayers.length,
            unsupportedFeatureCount: countStructuredUnsupportedFeatures(profile),
            adapterDiagnosticCount: profile.diagnostics.length,
            compatibilityPolicy: {
              structuredProfilePrecedence: profile.compatibility.structuredProfilePrecedence,
              flattenedDiagnosticsFallback: profile.compatibility.flattenedDiagnosticsFallback,
              flattenedUnsupportedFeaturesFallback:
                profile.compatibility.flattenedUnsupportedFeaturesFallback
            },
            sourceGroups: profile.sourceGroups.map((group) => ({
              sourceGroupId: group.sourceGroupId,
              groupPath: group.groupPath,
              visibleInSource: group.visibleInSource,
              opacityInSource: group.opacityInSource,
              unsupportedFeatureIds: group.unsupportedFeatures.map((feature) => feature.featureId),
              ...(group.targetPartId === undefined ? {} : { targetPartId: group.targetPartId })
            })),
            sourceLayers: profile.sourceLayers.map((layer) => ({
              sourceLayerId: layer.sourceLayerId,
              groupPath: layer.groupPath,
              bounds: layer.bounds,
              visibleInSource: layer.visibleInSource,
              opacityInSource: layer.opacityInSource,
              role: layer.role,
              unsupportedFeatureIds: layer.unsupportedFeatures.map((feature) => feature.featureId),
              ...(layer.texturePreviewReference === undefined
                ? {}
                : { texturePreviewReference: layer.texturePreviewReference }),
              ...(layer.textureId === undefined ? {} : { textureId: layer.textureId }),
              ...(layer.targetPartId === undefined ? {} : { targetPartId: layer.targetPartId })
            })),
            adapterDiagnostics: profile.diagnostics.map((diagnostic) => ({
              checkId: diagnostic.checkId,
              severity: diagnostic.severity,
              message: diagnostic.message,
              evidence: diagnostic.evidence
            }))
          }
        })
  };
};

const countStructuredUnsupportedFeatures = (
  profile: NonNullable<SourceAssetDto["psdProfile"]>
): number =>
  profile.unsupportedFeatures.length +
  profile.sourceGroups.reduce((count, group) => count + group.unsupportedFeatures.length, 0) +
  profile.sourceLayers.reduce((count, layer) => count + layer.unsupportedFeatures.length, 0);

const listParameterReferences = (
  packageDocument: PackageDocumentDto | undefined,
  parameterId: string
): TargetRefDto[] => {
  if (packageDocument === undefined) {
    return [];
  }

  return uniqueTargetRefs([
    ...listParameterKeyformReferences(packageDocument.model.keyforms.keyformSets, parameterId),
    ...listParameterDynamicsReferences(packageDocument, parameterId)
  ]);
};

const listParameterKeyformReferences = (
  keyformSets: readonly KeyformSetDto[],
  parameterId: string
): TargetRefDto[] =>
  keyformSets.flatMap((keyformSet, index) => {
    if (!keyformSetUsesParameter(keyformSet, parameterId)) {
      return [];
    }

    const references = [keyformSetTargetRef(keyformSet.keyformSetId, index)];
    const drivenTarget = projectKeyformDrivenTargetRef(keyformSet);

    return drivenTarget === undefined ? references : [...references, drivenTarget];
  });

const listParameterDynamicsReferences = (
  packageDocument: PackageDocumentDto,
  parameterId: string
): TargetRefDto[] =>
  packageDocument.model.dynamics.dynamicsGroups.flatMap((group, index) => {
    const usesParameter =
      group.output.targetParameterId === parameterId ||
      group.drivers.some((driver) => driver.sourceParameterId === parameterId);

    return usesParameter ? [dynamicsGroupTargetRef(group.dynamicsGroupId, index)] : [];
  });

const keyformSetUsesParameter = (
  keyformSet: KeyformSetDto,
  parameterId: string
): boolean => {
  if (keyformSet.evaluator === "linear-1d-v1") {
    return keyformSet.parameterId === parameterId;
  }

  return keyformSet.parameterX === parameterId || keyformSet.parameterY === parameterId;
};

const projectKeyformDrivenTargetRef = (keyformSet: KeyformSetDto): TargetRefDto | undefined => {
  if (
    keyformSet.target.kind !== "mesh" &&
    keyformSet.target.kind !== "rigControl" &&
    keyformSet.target.kind !== "drawable"
  ) {
    return undefined;
  }

  return {
    kind: keyformSet.target.kind,
    id: keyformSet.target.id,
    path: `/model/${targetPathSegment(keyformSet.target.kind)}/${keyformSet.target.id}`
  };
};

const parameterTargetRef = (parameterId: string, index: number): TargetRefDto => ({
  kind: "parameter",
  id: parameterId,
  path: `/model/parameters/parameters/${index}`
});

const sourceAssetTargetRef = (sourceAssetId: string, index: number): TargetRefDto => ({
  kind: "sourceAsset",
  id: sourceAssetId,
  path: `/assets/sourceManifest/sourceAssets/${index}`
});

const keyformSetTargetRef = (keyformSetId: string, index: number): TargetRefDto => ({
  kind: "keyformSet",
  id: keyformSetId,
  path: `/model/keyforms/keyformSets/${index}`
});

const dynamicsGroupTargetRef = (dynamicsGroupId: string, index: number): TargetRefDto => ({
  kind: "dynamicsGroup",
  id: dynamicsGroupId,
  path: `/model/dynamics/dynamicsGroups/${index}`
});

const targetPathSegment = (targetKind: Extract<TargetKind, "drawable" | "mesh" | "rigControl">) => {
  switch (targetKind) {
    case "drawable":
      return "drawables/drawables";
    case "mesh":
      return "meshes/meshes";
    case "rigControl":
      return "rigControls/rigControls";
  }
};

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(targetRef);
  }

  return unique;
};

const resolvePackageRevision = (input: EditorInspectionProjectorInput): number | undefined =>
  input.packageDocument?.manifest.packageRevision ?? input.state?.revision.packageRevision;

const projectPackageRevision = (
  input: EditorInspectionProjectorInput
): { readonly packageRevision?: number } => {
  const packageRevision = resolvePackageRevision(input);

  return packageRevision === undefined ? {} : { packageRevision };
};
