import type {
  RuntimeExportManifestDto,
  RuntimeExportModelDto,
  RuntimeExportParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";

export function createModelMappingProfileTestPayload(input: {
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly packageHash?: string;
  readonly parameters?: readonly RuntimeExportParameterDto[];
  readonly manifestExternalIds?: readonly string[];
  readonly computedIds?: readonly string[];
  readonly hiddenIds?: readonly string[];
} = {}): RuntimeExportLoadedPayload {
  const parameters = input.parameters ?? [
    createModelMappingProfileTestParameter(
      "param_face_angle_x",
      "Face Angle X",
      "face.angle.x"
    ),
    createModelMappingProfileTestParameter(
      "param_body_angle_x",
      "Body Angle X",
      "body.angle.x",
      {
        semanticRole: "body",
        min: -10,
        max: 10
      }
    ),
    createModelMappingProfileTestParameter(
      "param_body_angle_z",
      "Body Angle Z",
      "body.angle.z",
      {
        semanticRole: "body",
        min: -10,
        max: 10
      }
    )
  ];
  const sourcePackage = {
    packageId: input.packageId ?? "pkg_mapping_profile_test",
    packageDisplayName: "Mapping Profile Test",
    packageRevision: input.packageRevision ?? 1,
    ...(input.packageHash === undefined ? {} : { packageHash: input.packageHash })
  };

  return {
    artifacts: {
      manifest: {
        sourcePackage
      } as unknown as RuntimeExportManifestDto,
      model: {
        sourcePackage,
        parameters,
        inputManifest: {
          externalInputParameterIds:
            input.manifestExternalIds ?? parameters
              .filter((parameter) => parameter.runtimeRole === "external-input")
              .map((parameter) => parameter.parameterId),
          computedDynamicsOutputParameterIds: input.computedIds ?? [],
          hiddenDirectControlParameterIds: input.hiddenIds ?? []
        }
      } as unknown as RuntimeExportModelDto,
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array()
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName,
      drawableCount: 0,
      meshCount: 0,
      parameterCount: parameters.length,
      maskCount: 0,
      texturePage: {
        pageId: "page",
        path: "page.raw",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      requiredCapabilities: []
    },
    loadedAtIso: "2026-06-23T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

export function createModelMappingProfileTestParameter(
  parameterId: string,
  displayName: string,
  projectPresetAlias: string,
  options: Partial<RuntimeExportParameterDto> = {}
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName,
    semanticRole: options.semanticRole ?? "face",
    projectPresetAlias,
    valueSource: options.valueSource ?? "authoredInput",
    runtimeRole: options.runtimeRole ?? "external-input",
    externalInput: options.externalInput ?? true,
    readOnly: options.readOnly ?? false,
    min: options.min ?? -30,
    max: options.max ?? 30,
    default: options.default ?? 0
  } as unknown as RuntimeExportParameterDto;
}
