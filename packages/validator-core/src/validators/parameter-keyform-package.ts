import type { TargetRefDto } from "@private-2d-rigging-lab/contracts";
import {
  createInitializedParameterSurface,
  getPresetParameterById,
  isPresetParameterId,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type {
  KeyformSetDto,
  KeyformTargetDto,
  ParameterDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validateParameterKeyformPackage = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => [
  ...validateDuplicateParameterIds(packageDocument),
  ...validatePresetLockedParameters(packageDocument),
  ...validateDuplicateKeyformSetIds(packageDocument),
  ...validateKeyformReferences(packageDocument)
];

const validateDuplicateParameterIds = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const seen = new Map<string, number>();
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.parameters.parameters.forEach((parameter, index) => {
    const firstIndex = seen.get(parameter.parameterId);
    if (firstIndex !== undefined) {
      checks.push(createCheck({
        checkId: "parameter.duplicateId",
        phase: "package_schema",
        target: {
          kind: "parameter",
          id: parameter.parameterId,
          path: `/model/parameters/parameters/${index}`
        },
        targetPath: `/model/parameters/parameters/${index}`,
        message: `Parameter id is duplicated: ${parameter.parameterId}.`,
        evidence: [
          `parameterId=${parameter.parameterId}`,
          `firstIndex=${firstIndex}`,
          `duplicateIndex=${index}`
        ],
        impact: "Parameter references cannot be resolved deterministically when stable ids are duplicated."
      }));
    } else {
      seen.set(parameter.parameterId, index);
    }
  });

  return checks;
};

const validatePresetLockedParameters = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] =>
  packageDocument.model.parameters.parameters.flatMap((parameter, index) => {
    if (!isPresetParameterId(parameter.parameterId)) {
      return [];
    }

    const preset = getPresetParameterById(parameter.parameterId);
    if (preset === undefined) {
      return [];
    }

    const mutatedFields = listPresetLockedMutations(parameter, preset);
    if (mutatedFields.length === 0) {
      return [];
    }

    return [
      createCheck({
        checkId: "parameter.presetLockedMutation",
        phase: "package_schema",
        target: {
          kind: "parameter",
          id: parameter.parameterId,
          path: `/model/parameters/parameters/${index}`
        },
        targetPath: `/model/parameters/parameters/${index}`,
        message: `Preset parameter ${parameter.parameterId} mutates locked catalog fields.`,
        evidence: [
          `parameterId=${parameter.parameterId}`,
          `presetRole=${preset.presetRole}`,
          ...mutatedFields.map((field) => `mutatedField=${field}`)
        ],
        impact: "Preset role, group, range, and sign convention must remain stable for Parameter Manager and future facades."
      })
    ];
  });

const validateDuplicateKeyformSetIds = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const seen = new Map<string, number>();
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.keyforms.keyformSets.forEach((keyformSet, index) => {
    const firstIndex = seen.get(keyformSet.keyformSetId);
    if (firstIndex !== undefined) {
      checks.push(createCheck({
        checkId: "keyform.duplicateSetId",
        phase: "reference",
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId,
          path: `/model/keyforms/keyformSets/${index}`
        },
        targetPath: `/model/keyforms/keyformSets/${index}`,
        message: `Keyform set id is duplicated: ${keyformSet.keyformSetId}.`,
        evidence: [
          `keyformSetId=${keyformSet.keyformSetId}`,
          `firstIndex=${firstIndex}`,
          `duplicateIndex=${index}`
        ],
        impact: "Runtime sampling and operation diffs cannot address a keyform set deterministically when ids are duplicated."
      }));
    } else {
      seen.set(keyformSet.keyformSetId, index);
    }
  });

  return checks;
};

const validateKeyformReferences = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const parameters = createInitializedParameterSurface(packageDocument.model.parameters.parameters);
  const parameterById = new Map(parameters.map((parameter) => [parameter.parameterId, parameter]));
  const rigControlById = new Map(
    packageDocument.model.rigControls.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );

  return packageDocument.model.keyforms.keyformSets.flatMap((keyformSet, keyformSetIndex) => [
    ...validateKeyformParameterReferences(keyformSet, keyformSetIndex, parameterById),
    ...validateKeyformKeyPositions(keyformSet, keyformSetIndex, parameterById),
    ...validateKeyformTarget(packageDocument, keyformSet, keyformSetIndex, rigControlById),
    ...validateDuplicateLinearKeyValues(keyformSet, keyformSetIndex)
  ]);
};

const validateKeyformParameterReferences = (
  keyformSet: KeyformSetDto,
  keyformSetIndex: number,
  parameterById: ReadonlyMap<string, ParameterDto>
): readonly ValidationCheckResultDto[] => {
  const parameterRefs = keyformSet.evaluator === "linear-1d-v1"
    ? [{ field: "parameterId", parameterId: keyformSet.parameterId }]
    : [
        { field: "parameterX", parameterId: keyformSet.parameterX },
        { field: "parameterY", parameterId: keyformSet.parameterY }
      ];

  return parameterRefs
    .filter((ref) => !parameterById.has(ref.parameterId))
    .map((ref) =>
      createCheck({
        checkId: "keyform.parameterMissing",
        phase: "reference",
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId,
          path: `/model/keyforms/keyformSets/${keyformSetIndex}/${ref.field}`
        },
        targetPath: `/model/keyforms/keyformSets/${keyformSetIndex}/${ref.field}`,
        message: `Keyform set ${keyformSet.keyformSetId} references missing parameter ${ref.parameterId}.`,
        evidence: [
          `keyformSetId=${keyformSet.keyformSetId}`,
          `parameterField=${ref.field}`,
          `parameterId=${ref.parameterId}`
        ],
        impact: "Runtime cannot sample a keyform whose parameter axis is missing."
      })
    );
};

const validateKeyformKeyPositions = (
  keyformSet: KeyformSetDto,
  keyformSetIndex: number,
  parameterById: ReadonlyMap<string, ParameterDto>
): readonly ValidationCheckResultDto[] => {
  if (keyformSet.evaluator === "linear-1d-v1") {
    const parameter = parameterById.get(keyformSet.parameterId);
    if (parameter === undefined) {
      return [];
    }

    return keyformSet.keys.flatMap((key, keyIndex) =>
      key.value < parameter.min || key.value > parameter.max
        ? [
            createKeyOutOfRangeCheck({
              keyformSet,
              keyformSetIndex,
              keyIndex,
              value: key.value,
              parameterId: parameter.parameterId,
              parameterRange: `${parameter.min}..${parameter.max}`,
              coordinateField: "value"
            })
          ]
        : []
    );
  }

  const parameterX = parameterById.get(keyformSet.parameterX);
  const parameterY = parameterById.get(keyformSet.parameterY);
  return keyformSet.keys.flatMap((key, keyIndex) => [
    ...(parameterX !== undefined && (key.x < parameterX.min || key.x > parameterX.max)
      ? [
          createKeyOutOfRangeCheck({
            keyformSet,
            keyformSetIndex,
            keyIndex,
            value: key.x,
            parameterId: parameterX.parameterId,
            parameterRange: `${parameterX.min}..${parameterX.max}`,
            coordinateField: "x"
          })
        ]
      : []),
    ...(parameterY !== undefined && (key.y < parameterY.min || key.y > parameterY.max)
      ? [
          createKeyOutOfRangeCheck({
            keyformSet,
            keyformSetIndex,
            keyIndex,
            value: key.y,
            parameterId: parameterY.parameterId,
            parameterRange: `${parameterY.min}..${parameterY.max}`,
            coordinateField: "y"
          })
        ]
      : [])
  ]);
};

const validateKeyformTarget = (
  packageDocument: PackageDocumentDto,
  keyformSet: KeyformSetDto,
  keyformSetIndex: number,
  rigControlById: ReadonlyMap<string, RigControlDto>
): readonly ValidationCheckResultDto[] => {
  const targetMissing = !keyformTargetExists(packageDocument, keyformSet.target);
  const unsupported = !isSupportedKeyformTargetProperty(keyformSet.target, rigControlById);
  const targetPath = `/model/keyforms/keyformSets/${keyformSetIndex}/target`;

  return [
    ...(targetMissing
      ? [
          createCheck({
            checkId: "keyform.targetMissing",
            phase: "reference",
            target: createKeyformSetTarget(keyformSet, targetPath),
            targetPath,
            message: `Keyform set ${keyformSet.keyformSetId} references missing target ${formatTarget(keyformSet.target)}.`,
            evidence: [
              `keyformSetId=${keyformSet.keyformSetId}`,
              `target=${formatTarget(keyformSet.target)}`
            ],
            impact: "Runtime cannot apply a keyform when the target object is missing."
          })
        ]
      : []),
    ...(!targetMissing && unsupported
      ? [
          createCheck({
            checkId: "keyform.unsupportedTargetProperty",
            phase: "reference",
            target: createKeyformSetTarget(keyformSet, targetPath),
            targetPath,
            message: `Keyform set ${keyformSet.keyformSetId} targets unsupported property ${keyformSet.target.kind}.${keyformSet.target.property}.`,
            evidence: [
              `keyformSetId=${keyformSet.keyformSetId}`,
              `targetKind=${keyformSet.target.kind}`,
              `targetId=${keyformSet.target.id}`,
              `targetProperty=${keyformSet.target.property}`
            ],
            impact: "Runtime and operation contracts do not support this keyform target/property pair."
          })
        ]
      : [])
  ];
};

const validateDuplicateLinearKeyValues = (
  keyformSet: KeyformSetDto,
  keyformSetIndex: number
): readonly ValidationCheckResultDto[] => {
  if (keyformSet.evaluator !== "linear-1d-v1") {
    return [];
  }

  const seen = new Map<number, number>();
  const checks: ValidationCheckResultDto[] = [];
  keyformSet.keys.forEach((key, keyIndex) => {
    const firstIndex = seen.get(key.value);
    if (firstIndex !== undefined) {
      checks.push(createCheck({
        checkId: "keyform.linear1dDuplicateKey",
        phase: "reference",
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId,
          path: `/model/keyforms/keyformSets/${keyformSetIndex}/keys/${keyIndex}`
        },
        targetPath: `/model/keyforms/keyformSets/${keyformSetIndex}/keys/${keyIndex}`,
        message: `Linear keyform set ${keyformSet.keyformSetId} has duplicate key value ${key.value}.`,
        evidence: [
          `keyformSetId=${keyformSet.keyformSetId}`,
          `value=${key.value}`,
          `firstIndex=${firstIndex}`,
          `duplicateIndex=${keyIndex}`
        ],
        impact: "Linear interpolation cannot choose between duplicate key positions without deterministic loss."
      }));
    } else {
      seen.set(key.value, keyIndex);
    }
  });

  return checks;
};

const listPresetLockedMutations = (
  parameter: ParameterDto,
  preset: ParameterDto
): readonly string[] => {
  const fields: string[] = [];
  compareOptionalLockedField(fields, parameter, preset, "kind");
  compareOptionalLockedField(fields, parameter, preset, "parameterType");
  compareOptionalLockedField(fields, parameter, preset, "group");
  compareOptionalLockedField(fields, parameter, preset, "semanticRole");
  compareOptionalLockedField(fields, parameter, preset, "projectPresetAlias");
  compareOptionalLockedField(fields, parameter, preset, "presetRole");
  compareLockedField(fields, parameter, preset, "valueSource");
  compareLockedField(fields, parameter, preset, "min");
  compareLockedField(fields, parameter, preset, "max");
  compareLockedField(fields, parameter, preset, "default");
  compareLockedField(fields, parameter, preset, "recommendedUiStep");
  compareOptionalLockedField(fields, parameter, preset, "signConvention");

  return fields;
};

const compareLockedField = <TField extends keyof ParameterDto>(
  fields: string[],
  parameter: ParameterDto,
  preset: ParameterDto,
  field: TField
): void => {
  if (JSON.stringify(parameter[field]) !== JSON.stringify(preset[field])) {
    fields.push(field);
  }
};

const compareOptionalLockedField = <TField extends keyof ParameterDto>(
  fields: string[],
  parameter: ParameterDto,
  preset: ParameterDto,
  field: TField
): void => {
  if (
    parameter[field] !== undefined &&
    JSON.stringify(parameter[field]) !== JSON.stringify(preset[field])
  ) {
    fields.push(field);
  }
};

const createKeyOutOfRangeCheck = (input: {
  readonly keyformSet: KeyformSetDto;
  readonly keyformSetIndex: number;
  readonly keyIndex: number;
  readonly value: number;
  readonly parameterId: string;
  readonly parameterRange: string;
  readonly coordinateField: string;
}): ValidationCheckResultDto =>
  createCheck({
    checkId: "keyform.keyOutOfRange",
    phase: "reference",
    target: {
      kind: "keyformSet",
      id: input.keyformSet.keyformSetId,
      path: `/model/keyforms/keyformSets/${input.keyformSetIndex}/keys/${input.keyIndex}/${input.coordinateField}`
    },
    targetPath: `/model/keyforms/keyformSets/${input.keyformSetIndex}/keys/${input.keyIndex}/${input.coordinateField}`,
    message: `Keyform key position ${input.value} is outside parameter ${input.parameterId} range.`,
    evidence: [
      `keyformSetId=${input.keyformSet.keyformSetId}`,
      `parameterId=${input.parameterId}`,
      `coordinate=${input.coordinateField}`,
      `value=${input.value}`,
      `parameterRange=${input.parameterRange}`
    ],
    impact: "Authoring operations must not create key positions outside the referenced parameter range."
  });

const keyformTargetExists = (
  packageDocument: PackageDocumentDto,
  target: KeyformTargetDto
): boolean => {
  if (target.kind === "mesh") {
    return packageDocument.model.meshes.meshes.some((mesh) => mesh.meshId === target.id);
  }
  if (target.kind === "rigControl") {
    return packageDocument.model.rigControls.rigControls.some((rigControl) => rigControl.rigControlId === target.id);
  }
  if (target.kind === "drawable" || target.kind === "opacity" || target.kind === "visibility") {
    return packageDocument.model.drawables.drawables.some((drawable) => drawable.drawableId === target.id);
  }

  return packageDocument.model.drawOrder.entries.some((entry) => entry.drawableId === target.id);
};

const isSupportedKeyformTargetProperty = (
  target: KeyformTargetDto,
  rigControlById: ReadonlyMap<string, RigControlDto>
): boolean => {
  if (target.kind === "mesh") {
    return target.property === "vertices";
  }
  if (target.kind === "drawable") {
    return [
      "opacity",
      "defaultOpacity",
      "visibility",
      "runtimeVisibility",
      "drawOrder",
      "baseDrawOrder"
    ].includes(target.property);
  }
  if (target.kind === "opacity") {
    return target.property === "opacity" || target.property === "defaultOpacity";
  }
  if (target.kind === "visibility") {
    return target.property === "visibility" || target.property === "runtimeVisibility";
  }
  if (target.kind === "drawOrder") {
    return target.property === "drawOrder" || target.property === "baseDrawOrder";
  }

  const rigControl = rigControlById.get(target.id);
  if (rigControl?.kind === "rotation2d") {
    return [
      "angleDegrees",
      "restAngleDegrees",
      "translation",
      "restTranslation",
      "scale",
      "restScale",
      "opacityMultiplier"
    ].includes(target.property);
  }
  if (rigControl?.kind === "warpLattice2d") {
    return target.property === "controlPointOffsets" || target.property === "opacityMultiplier";
  }

  return false;
};

const createKeyformSetTarget = (
  keyformSet: KeyformSetDto,
  targetPath: string
): TargetRefDto => ({
  kind: "keyformSet",
  id: keyformSet.keyformSetId,
  path: targetPath
});

const formatTarget = (target: KeyformTargetDto): string =>
  `${target.kind}:${target.id}.${target.property}`;

const createCheck = (input: {
  readonly checkId: string;
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: "error",
    phase: input.phase,
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-013"],
    relatedScenarios: [],
    impact: input.impact
  });
