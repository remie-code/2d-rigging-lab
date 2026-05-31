import type { ParameterId, RuntimeSnapshotId, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import type {
  DynamicsDriverDto,
  DynamicsGroupDto,
  PackageDocumentDto,
  ParameterDto
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

interface DynamicsGroupEntry {
  readonly group: DynamicsGroupDto;
  readonly index: number;
}

interface DynamicsDriverEntry {
  readonly driver: DynamicsDriverDto;
  readonly index: number;
}

interface ParameterEntry {
  readonly parameter: ParameterDto;
  readonly index: number;
}

export const validateDynamicsSemantics = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): readonly ValidationCheckResultDto[] => {
  const parametersById = createParameterIndex(packageDocument);
  const groupEntries = packageDocument.model.dynamics.dynamicsGroups
    .map((group, index) => ({ group, index }))
    .sort(compareGroupEntries);
  const outputProducersByParameterId = createOutputProducerIndex(groupEntries);
  const checks: ValidationCheckResultDto[] = [];

  checks.push(
    ...validateComputedDynamicsProducerCoverage({
      packageDocument,
      parametersById,
      outputProducersByParameterId
    })
  );

  for (const entry of groupEntries) {
    checks.push(
      ...validateDynamicsGroupRelations({
        entry,
        parametersById,
        outputProducersByParameterId
      })
    );
  }

  checks.push(...validateDuplicateOutputTargets(outputProducersByParameterId));
  checks.push(...validateRuntimeDynamicsEvidence({
    groupEntries,
    ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
  }));

  return checks;
};

const createParameterIndex = (
  packageDocument: PackageDocumentDto
): ReadonlyMap<ParameterId, ParameterEntry> =>
  new Map(
    packageDocument.model.parameters.parameters.map((parameter, index) => [
      parameter.parameterId,
      { parameter, index }
    ])
  );

const createOutputProducerIndex = (
  groupEntries: readonly DynamicsGroupEntry[]
): ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]> => {
  const producers = new Map<ParameterId, DynamicsGroupEntry[]>();

  for (const entry of groupEntries) {
    const outputParameterId = entry.group.output.targetParameterId;
    const current = producers.get(outputParameterId) ?? [];
    current.push(entry);
    producers.set(outputParameterId, current);
  }

  return new Map(
    [...producers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([parameterId, entries]) => [parameterId, entries.sort(compareGroupEntries)])
  );
};

const validateComputedDynamicsProducerCoverage = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly parametersById: ReadonlyMap<ParameterId, ParameterEntry>;
  readonly outputProducersByParameterId: ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]>;
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const computedParameters = [...input.parametersById.values()]
    .filter((entry) => entry.parameter.valueSource === "computedDynamics")
    .sort(compareParameterEntries);

  for (const entry of computedParameters) {
    const producers = input.outputProducersByParameterId.get(entry.parameter.parameterId) ?? [];
    if (producers.length > 0) {
      continue;
    }

    checks.push(createRequiredGroupMissingCheck(entry, input.packageDocument.model.dynamics.dynamicsGroups.length));
    checks.push(createComputedParameterProducerMissingCheck(entry));
  }

  return checks;
};

const validateDynamicsGroupRelations = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly parametersById: ReadonlyMap<ParameterId, ParameterEntry>;
  readonly outputProducersByParameterId: ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]>;
}): readonly ValidationCheckResultDto[] => {
  const { entry } = input;
  const checks: ValidationCheckResultDto[] = [];

  for (const driverEntry of createSortedDriverEntries(entry.group)) {
    const parameterEntry = input.parametersById.get(driverEntry.driver.sourceParameterId);
    if (parameterEntry === undefined) {
      checks.push(createDriverMissingCheck(entry, driverEntry));
      continue;
    }

    if (parameterEntry.parameter.valueSource !== "authoredInput") {
      checks.push(createDriverMustBeAuthoredInputCheck(entry, driverEntry, parameterEntry));
    }

    const producerEntries = input.outputProducersByParameterId.get(driverEntry.driver.sourceParameterId) ?? [];
    if (producerEntries.length > 0) {
      checks.push(createOutputUsedAsDriverCheck(entry, driverEntry, producerEntries));
    }
  }

  const outputParameterEntry = input.parametersById.get(entry.group.output.targetParameterId);
  if (outputParameterEntry === undefined) {
    checks.push(createOutputMissingCheck(entry));
  } else {
    if (outputParameterEntry.parameter.valueSource !== "computedDynamics") {
      checks.push(createOutputMustBeComputedParameterCheck(entry, outputParameterEntry));
    }

    checks.push(...validateOutputRange(entry, outputParameterEntry));
    checks.push(...validateUnsafeSettings(entry, outputParameterEntry));
  }

  return checks;
};

const createSortedDriverEntries = (group: DynamicsGroupDto): readonly DynamicsDriverEntry[] =>
  group.drivers
    .map((driver, index) => ({ driver, index }))
    .sort((left, right) =>
      left.driver.driverId.localeCompare(right.driver.driverId) ||
      left.driver.sourceParameterId.localeCompare(right.driver.sourceParameterId) ||
      left.index - right.index
    );

const validateOutputRange = (
  entry: DynamicsGroupEntry,
  outputParameterEntry: ParameterEntry
): readonly ValidationCheckResultDto[] => {
  const output = entry.group.output;
  const targetParameter = outputParameterEntry.parameter;
  const checks: ValidationCheckResultDto[] = [];

  if (output.min > output.max) {
    checks.push(createOutputParameterOutOfRangeCheck({
      entry,
      targetPath: groupOutputRangePath(entry.index),
      message: `Dynamics group ${entry.group.dynamicsGroupId} has output min greater than max.`,
      evidence: [
        `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
        `outputParameterId=${output.targetParameterId}`,
        `outputMin=${output.min}`,
        `outputMax=${output.max}`
      ]
    }));
  }

  if (output.min < targetParameter.min || output.max > targetParameter.max) {
    checks.push(createOutputParameterOutOfRangeCheck({
      entry,
      targetPath: groupOutputRangePath(entry.index),
      message: `Dynamics group ${entry.group.dynamicsGroupId} output range exceeds target parameter ${targetParameter.parameterId}.`,
      evidence: [
        `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
        `outputParameterId=${output.targetParameterId}`,
        `outputMin=${output.min}`,
        `outputMax=${output.max}`,
        `parameterMin=${targetParameter.min}`,
        `parameterMax=${targetParameter.max}`
      ]
    }));
  }

  return checks;
};

const validateUnsafeSettings = (
  entry: DynamicsGroupEntry,
  outputParameterEntry: ParameterEntry
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const { settings } = entry.group;

  if (settings.stiffness > 0 && settings.damping === 0) {
    checks.push(createUnstableSettingsCheck(entry, [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `stiffness=${settings.stiffness}`,
      `damping=${settings.damping}`,
      "reason=positive-stiffness-with-zero-damping"
    ]));
  }

  if (settings.maxAmplitude !== undefined) {
    const outputRangeWidth = entry.group.output.max - entry.group.output.min;
    const parameterRangeWidth = outputParameterEntry.parameter.max - outputParameterEntry.parameter.min;
    const boundedWidth = Math.min(outputRangeWidth, parameterRangeWidth);

    if (boundedWidth >= 0 && settings.maxAmplitude > boundedWidth) {
      checks.push(createExcessiveAmplitudeCheck(entry, [
        `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
        `maxAmplitude=${settings.maxAmplitude}`,
        `outputRangeWidth=${outputRangeWidth}`,
        `parameterRangeWidth=${parameterRangeWidth}`
      ]));
    }
  }

  return checks;
};

const validateDuplicateOutputTargets = (
  outputProducersByParameterId: ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]>
): readonly ValidationCheckResultDto[] =>
  [...outputProducersByParameterId.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([parameterId, entries]) => createOutputTargetDuplicateCheck(parameterId, entries));

const validateRuntimeDynamicsEvidence = (input: {
  readonly groupEntries: readonly DynamicsGroupEntry[];
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const enabledGroupEntries = input.groupEntries.filter((entry) => entry.group.enabled);
  if (enabledGroupEntries.length === 0) {
    return [];
  }

  if (input.runtimeSnapshot === undefined) {
    return enabledGroupEntries.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        message: `Dynamics group ${entry.group.dynamicsGroupId} has no runtime snapshot evidence.`,
        evidence: createRuntimeEvidenceBase(entry, ["runtimeSnapshot=missing"])
      })
    );
  }

  const snapshotDynamicsById = new Map(
    input.runtimeSnapshot.dynamics.map((dynamicsGroup) => [
      dynamicsGroup.dynamicsGroupId,
      dynamicsGroup
    ])
  );
  const snapshotParametersById = new Map(
    input.runtimeSnapshot.parameters.map((parameter) => [
      parameter.parameterId,
      parameter
    ])
  );
  const checks: ValidationCheckResultDto[] = [];

  for (const entry of enabledGroupEntries) {
    const snapshotDynamicsGroup = snapshotDynamicsById.get(entry.group.dynamicsGroupId);
    if (snapshotDynamicsGroup === undefined) {
      checks.push(createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        message: `Runtime snapshot ${input.runtimeSnapshot.snapshotId} is missing dynamics evidence for ${entry.group.dynamicsGroupId}.`,
        evidence: createRuntimeEvidenceBase(entry, [
          `snapshotId=${input.runtimeSnapshot.snapshotId}`,
          "snapshotDynamicsGroup=missing"
        ])
      }));
      continue;
    }

    if (snapshotDynamicsGroup.outputParameterId !== entry.group.output.targetParameterId) {
      checks.push(createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        message: `Runtime snapshot ${input.runtimeSnapshot.snapshotId} dynamics output target does not match package group ${entry.group.dynamicsGroupId}.`,
        evidence: createRuntimeEvidenceBase(entry, [
          `snapshotId=${input.runtimeSnapshot.snapshotId}`,
          `snapshotOutputParameterId=${snapshotDynamicsGroup.outputParameterId}`
        ])
      }));
    }

    const outputParameter = snapshotParametersById.get(entry.group.output.targetParameterId);
    if (outputParameter === undefined || outputParameter.valueSource !== "computedDynamics") {
      checks.push(createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        message: `Runtime snapshot ${input.runtimeSnapshot.snapshotId} is missing computed parameter evidence for ${entry.group.output.targetParameterId}.`,
        evidence: createRuntimeEvidenceBase(entry, [
          `snapshotId=${input.runtimeSnapshot.snapshotId}`,
          `snapshotParameter=${outputParameter === undefined ? "missing" : outputParameter.valueSource}`
        ])
      }));
    }

    if (snapshotDynamicsGroup.outputValue < entry.group.output.min || snapshotDynamicsGroup.outputValue > entry.group.output.max) {
      checks.push(createOutputParameterOutOfRangeCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        targetPath: `${groupBasePath(entry.index)}/runtimeEvidence/outputValue`,
        message: `Runtime snapshot ${input.runtimeSnapshot.snapshotId} output for ${entry.group.dynamicsGroupId} is outside the group output range.`,
        evidence: createRuntimeEvidenceBase(entry, [
          `snapshotId=${input.runtimeSnapshot.snapshotId}`,
          `outputValue=${snapshotDynamicsGroup.outputValue}`,
          `outputMin=${entry.group.output.min}`,
          `outputMax=${entry.group.output.max}`
        ])
      }));
    }

    if (snapshotDynamicsGroup.debug?.outputClamped === true) {
      checks.push(createOutputClampedCheck(entry, input.runtimeSnapshot.snapshotId));
    }
  }

  return checks;
};

const createRequiredGroupMissingCheck = (
  parameterEntry: ParameterEntry,
  dynamicsGroupCount: number
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.requiredGroupMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: parameterEntry.parameter.parameterId,
      path: parameterPath(parameterEntry.index)
    },
    targetPath: parameterPath(parameterEntry.index),
    message: `Computed dynamics parameter ${parameterEntry.parameter.parameterId} has no required dynamics group.`,
    evidence: [
      `parameterId=${parameterEntry.parameter.parameterId}`,
      "valueSource=computedDynamics",
      `dynamicsGroupCount=${dynamicsGroupCount}`
    ],
    impact: "The package declares a computed dynamics parameter without a dynamics group that can produce it."
  });

const createComputedParameterProducerMissingCheck = (
  parameterEntry: ParameterEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.computedParameterProducerMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: parameterEntry.parameter.parameterId,
      path: parameterPath(parameterEntry.index)
    },
    targetPath: parameterPath(parameterEntry.index),
    message: `Computed dynamics parameter ${parameterEntry.parameter.parameterId} has no producer group.`,
    evidence: [
      `parameterId=${parameterEntry.parameter.parameterId}`,
      "valueSource=computedDynamics",
      "producerGroup=missing"
    ],
    impact: "Runtime cannot resolve the computed parameter from package dynamics relations."
  });

const createDriverMissingCheck = (
  entry: DynamicsGroupEntry,
  driverEntry: DynamicsDriverEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.driverMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: driverEntry.driver.sourceParameterId,
      path: groupDriverSourcePath(entry.index, driverEntry.index)
    },
    targetPath: groupDriverSourcePath(entry.index, driverEntry.index),
    message: `Dynamics group ${entry.group.dynamicsGroupId} references missing driver parameter ${driverEntry.driver.sourceParameterId}.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `driverId=${driverEntry.driver.driverId}`,
      `sourceParameterId=${driverEntry.driver.sourceParameterId}`,
      "parameterMatch=missing"
    ],
    impact: "The dynamics group cannot be evaluated because one driver parameter is absent."
  });

const createDriverMustBeAuthoredInputCheck = (
  entry: DynamicsGroupEntry,
  driverEntry: DynamicsDriverEntry,
  parameterEntry: ParameterEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.driverMustBeAuthoredInput",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: parameterEntry.parameter.parameterId,
      path: groupDriverSourcePath(entry.index, driverEntry.index)
    },
    targetPath: groupDriverSourcePath(entry.index, driverEntry.index),
    message: `Dynamics driver ${driverEntry.driver.driverId} must reference an authoredInput parameter.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `driverId=${driverEntry.driver.driverId}`,
      `sourceParameterId=${parameterEntry.parameter.parameterId}`,
      `valueSource=${parameterEntry.parameter.valueSource}`,
      `parameterPath=${parameterPath(parameterEntry.index)}`
    ],
    impact: "Computed or debug-only parameters cannot be used as deterministic dynamics drivers."
  });

const createOutputUsedAsDriverCheck = (
  entry: DynamicsGroupEntry,
  driverEntry: DynamicsDriverEntry,
  producerEntries: readonly DynamicsGroupEntry[]
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.outputUsedAsDriver",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: driverEntry.driver.sourceParameterId,
      path: groupDriverSourcePath(entry.index, driverEntry.index)
    },
    targetPath: groupDriverSourcePath(entry.index, driverEntry.index),
    message: `Dynamics driver ${driverEntry.driver.driverId} uses a computed dynamics output parameter.`,
    evidence: [
      `consumerGroupId=${entry.group.dynamicsGroupId}`,
      `driverId=${driverEntry.driver.driverId}`,
      `sourceParameterId=${driverEntry.driver.sourceParameterId}`,
      ...producerEntries.map((producer) => `producerGroupId=${producer.group.dynamicsGroupId}`).sort()
    ],
    impact: "Dynamics output parameters cannot feed another dynamics driver in Minimum Open Dynamics v1."
  });

const createOutputMissingCheck = (entry: DynamicsGroupEntry): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.outputMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: entry.group.output.targetParameterId,
      path: groupOutputTargetPath(entry.index)
    },
    targetPath: groupOutputTargetPath(entry.index),
    message: `Dynamics group ${entry.group.dynamicsGroupId} targets missing output parameter ${entry.group.output.targetParameterId}.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `outputId=${entry.group.output.outputId}`,
      `targetParameterId=${entry.group.output.targetParameterId}`,
      "parameterMatch=missing"
    ],
    impact: "The dynamics group cannot write its computed output into the package parameter graph."
  });

const createOutputMustBeComputedParameterCheck = (
  entry: DynamicsGroupEntry,
  parameterEntry: ParameterEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.outputMustBeComputedParameter",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: parameterEntry.parameter.parameterId,
      path: groupOutputTargetPath(entry.index)
    },
    targetPath: groupOutputTargetPath(entry.index),
    message: `Dynamics output ${entry.group.output.outputId} must target a computedDynamics parameter.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `outputId=${entry.group.output.outputId}`,
      `targetParameterId=${parameterEntry.parameter.parameterId}`,
      `valueSource=${parameterEntry.parameter.valueSource}`,
      `parameterPath=${parameterPath(parameterEntry.index)}`
    ],
    impact: "Dynamics output must be separated from authored input and debug override parameters."
  });

const createOutputTargetDuplicateCheck = (
  parameterId: ParameterId,
  entries: readonly DynamicsGroupEntry[]
): ValidationCheckResultDto => {
  const sortedEntries = [...entries].sort(compareGroupEntries);
  const firstEntry = sortedEntries[0];

  return createDynamicsCheck({
    checkId: "dynamics.outputTargetDuplicate",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: parameterId,
      path: firstEntry === undefined ? "/model/dynamics/dynamicsGroups" : groupOutputTargetPath(firstEntry.index)
    },
    targetPath: firstEntry === undefined ? "/model/dynamics/dynamicsGroups" : groupOutputTargetPath(firstEntry.index),
    message: `Multiple dynamics groups target computed output parameter ${parameterId}.`,
    evidence: [
      `targetParameterId=${parameterId}`,
      ...sortedEntries.map((entry) => `producerGroupId=${entry.group.dynamicsGroupId}`)
    ],
    impact: "Minimum Open Dynamics v1 allows only one producer group per computed output parameter."
  });
};

const createOutputParameterOutOfRangeCheck = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.outputParameterOutOfRange",
    status: "fail",
    severity: "error",
    phase: "dynamics_evaluation",
    target: {
      kind: "parameter",
      id: input.entry.group.output.targetParameterId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    impact: "Dynamics output can exceed the declared parameter range and cannot be accepted as deterministic replay evidence.",
    snapshotIds: input.runtimeSnapshotId === undefined ? [] : [input.runtimeSnapshotId]
  });

const createUnstableSettingsCheck = (
  entry: DynamicsGroupEntry,
  evidence: readonly string[]
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.unstableSettings",
    status: "needs_review",
    severity: "warning",
    phase: "dynamics_semantic",
    target: {
      kind: "dynamicsGroup",
      id: entry.group.dynamicsGroupId,
      path: `${groupBasePath(entry.index)}/settings`
    },
    targetPath: `${groupBasePath(entry.index)}/settings`,
    message: `Dynamics group ${entry.group.dynamicsGroupId} has unsafe scalar damped follow settings.`,
    evidence,
    impact: "The validator can determine that these settings are likely to produce unstable or non-useful dynamics output."
  });

const createExcessiveAmplitudeCheck = (
  entry: DynamicsGroupEntry,
  evidence: readonly string[]
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.excessiveAmplitude",
    status: "needs_review",
    severity: "warning",
    phase: "dynamics_evaluation",
    target: {
      kind: "dynamicsGroup",
      id: entry.group.dynamicsGroupId,
      path: `${groupBasePath(entry.index)}/settings/maxAmplitude`
    },
    targetPath: `${groupBasePath(entry.index)}/settings/maxAmplitude`,
    message: `Dynamics group ${entry.group.dynamicsGroupId} maxAmplitude exceeds its output range.`,
    evidence,
    impact: "The declared amplitude can push the computed output beyond the safe authored range."
  });

const createRuntimeEvidenceMissingCheck = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly message: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.runtimeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "representative_evaluation",
    target: {
      kind: "dynamicsGroup",
      id: input.entry.group.dynamicsGroupId,
      path: groupBasePath(input.entry.index)
    },
    targetPath: groupBasePath(input.entry.index),
    message: input.message,
    evidence: input.evidence,
    impact: "Validator cannot prove deterministic dynamics replay without runtime dynamics evidence.",
    snapshotIds: input.runtimeSnapshotId === undefined ? [] : [input.runtimeSnapshotId]
  });

const createOutputClampedCheck = (
  entry: DynamicsGroupEntry,
  runtimeSnapshotId: RuntimeSnapshotId
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.outputClamped",
    status: "needs_review",
    severity: "warning",
    phase: "dynamics_evaluation",
    target: {
      kind: "dynamicsGroup",
      id: entry.group.dynamicsGroupId,
      path: `${groupBasePath(entry.index)}/runtimeEvidence/outputClamped`
    },
    targetPath: `${groupBasePath(entry.index)}/runtimeEvidence/outputClamped`,
    message: `Runtime snapshot ${runtimeSnapshotId} clamped dynamics output for ${entry.group.dynamicsGroupId}.`,
    evidence: createRuntimeEvidenceBase(entry, [
      `snapshotId=${runtimeSnapshotId}`,
      "outputClamped=true"
    ]),
    impact: "The runtime output is deterministic but may need review because it hit the declared output clamp.",
    snapshotIds: [runtimeSnapshotId]
  });

const createDynamicsCheck = (input: {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail" | "needs_review" | "not_applicable";
  readonly severity: "info" | "warning" | "error" | "blocking";
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds?: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-010", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-MVP-002", "SC-MVP-003", "SC-MVP-004"],
    impact: input.impact,
    snapshotIds: input.snapshotIds ?? []
  });

const createRuntimeEvidenceBase = (
  entry: DynamicsGroupEntry,
  additionalEvidence: readonly string[]
): readonly string[] => [
  `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
  `outputParameterId=${entry.group.output.targetParameterId}`,
  ...additionalEvidence
];

const compareGroupEntries = (left: DynamicsGroupEntry, right: DynamicsGroupEntry): number =>
  left.group.dynamicsGroupId.localeCompare(right.group.dynamicsGroupId) || left.index - right.index;

const compareParameterEntries = (left: ParameterEntry, right: ParameterEntry): number =>
  left.parameter.parameterId.localeCompare(right.parameter.parameterId) || left.index - right.index;

const groupBasePath = (groupIndex: number): string =>
  `/model/dynamics/dynamicsGroups/${groupIndex}`;

const groupDriverSourcePath = (groupIndex: number, driverIndex: number): string =>
  `${groupBasePath(groupIndex)}/drivers/${driverIndex}/sourceParameterId`;

const groupOutputTargetPath = (groupIndex: number): string =>
  `${groupBasePath(groupIndex)}/output/targetParameterId`;

const groupOutputRangePath = (groupIndex: number): string =>
  `${groupBasePath(groupIndex)}/output`;

const parameterPath = (parameterIndex: number): string =>
  `/model/parameters/parameters/${parameterIndex}`;
