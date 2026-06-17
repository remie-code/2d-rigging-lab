import type { ParameterId, RuntimeSnapshotId, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import { createInitializedParameterSurface } from "@private-2d-rigging-lab/package-format";
import type {
  DynamicsGroupDto,
  DynamicsInputDto,
  InitializedParameterDto,
  PackageDocumentDto,
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

interface DynamicsGroupEntry {
  readonly group: DynamicsGroupDto;
  readonly index: number;
}

interface DynamicsInputEntry {
  readonly input: DynamicsInputDto;
  readonly index: number;
}

interface ParameterEntry {
  readonly parameter: InitializedParameterDto;
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
  const outputOwnersByParameterId = createOutputOwnerIndex(groupEntries);
  const checks: ValidationCheckResultDto[] = [];

  for (const entry of groupEntries) {
    checks.push(
      ...validateDynamicsGroupShape(entry),
      ...validateDynamicsGroupRelations({
        entry,
        parametersById
      }),
      ...validateDynamicsGroupWarnings(entry)
    );
  }

  checks.push(...validateDuplicateOutputTargets(outputOwnersByParameterId));
  if (runtimeSnapshot !== undefined) {
    checks.push(...validateRuntimeDynamicsEvidence({ groupEntries, runtimeSnapshot }));
  }

  return checks;
};

const createParameterIndex = (
  packageDocument: PackageDocumentDto
): ReadonlyMap<ParameterId, ParameterEntry> =>
  new Map(
    createInitializedParameterSurface(packageDocument.model.parameters.parameters).map((parameter, index) => [
      parameter.parameterId,
      { parameter, index }
    ])
  );

const createOutputOwnerIndex = (
  groupEntries: readonly DynamicsGroupEntry[]
): ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]> => {
  const owners = new Map<ParameterId, DynamicsGroupEntry[]>();

  for (const entry of groupEntries) {
    for (const output of entry.group.outputs) {
      const current = owners.get(output.parameterId) ?? [];
      current.push(entry);
      owners.set(output.parameterId, current);
    }
  }

  return new Map(
    [...owners.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([parameterId, entries]) => [parameterId, entries.sort(compareGroupEntries)])
  );
};

const validateDynamicsGroupShape = (entry: DynamicsGroupEntry): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  if (entry.group.inputs.length < 1) {
    checks.push(createGroupShapeCheck({
      entry,
      checkId: "dynamics.inputMissing",
      targetPath: `${groupBasePath(entry.index)}/inputs`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} has no inputs.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`, "inputs=0"],
      impact: "A Dynamics v0 group needs at least one driver input."
    }));
  }

  if (entry.group.pendulums.length !== 1) {
    checks.push(createGroupShapeCheck({
      entry,
      checkId: "dynamics.invalidPendulumCardinality",
      targetPath: `${groupBasePath(entry.index)}/pendulums`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} must have exactly one pendulum in v0.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`, `pendulumCount=${entry.group.pendulums.length}`],
      impact: "Wave81 Dynamics v0 evaluates exactly one pendulum per group."
    }));
  }

  if (entry.group.outputs.length !== 1) {
    checks.push(createGroupShapeCheck({
      entry,
      checkId: "dynamics.invalidOutputCardinality",
      targetPath: `${groupBasePath(entry.index)}/outputs`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} must have exactly one output in v0.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`, `outputCount=${entry.group.outputs.length}`],
      impact: "Wave81 Dynamics v0 applies one additive output offset per group."
    }));
  }

  for (const inputEntry of createSortedInputEntries(entry.group)) {
    const normalization = inputEntry.input.normalization;
    if (normalization.min >= normalization.center || normalization.center >= normalization.max) {
      checks.push(createNormalizationInvalidCheck(entry, inputEntry));
    }
  }

  return checks;
};

const validateDynamicsGroupRelations = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly parametersById: ReadonlyMap<ParameterId, ParameterEntry>;
}): readonly ValidationCheckResultDto[] => {
  const { entry } = input;
  const checks: ValidationCheckResultDto[] = [];

  for (const inputEntry of createSortedInputEntries(entry.group)) {
    const parameterEntry = input.parametersById.get(inputEntry.input.parameterId);
    if (parameterEntry === undefined) {
      checks.push(createDriverMissingCheck(entry, inputEntry));
    }
  }

  for (const [outputIndex, output] of entry.group.outputs.entries()) {
    const parameterEntry = input.parametersById.get(output.parameterId);
    if (parameterEntry === undefined) {
      checks.push(createOutputMissingCheck(entry, outputIndex));
    }
  }

  return checks;
};

const validateDynamicsGroupWarnings = (entry: DynamicsGroupEntry): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const output = entry.group.outputs[0];
  const pendulum = entry.group.pendulums[0];

  if (entry.group.inputs.length > 0 && entry.group.inputs.every((input) => input.influencePercent === 0)) {
    checks.push(createWarningCheck({
      entry,
      checkId: "dynamics.zeroInputInfluence",
      targetPath: `${groupBasePath(entry.index)}/inputs`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} has zero influence across all inputs.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`],
      impact: "The group is valid but cannot produce visible input-driven motion."
    }));
  }

  if (output !== undefined && output.strength === 0) {
    checks.push(createWarningCheck({
      entry,
      checkId: "dynamics.outputStrengthZero",
      targetPath: `${groupBasePath(entry.index)}/outputs/0/strength`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} output strength is zero.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`, `outputParameterId=${output.parameterId}`],
      impact: "The additive output offset will always be zero."
    }));
  }

  if (output !== undefined && output.limit <= 0.000001) {
    checks.push(createWarningCheck({
      entry,
      checkId: "dynamics.outputLimitTooSmall",
      targetPath: `${groupBasePath(entry.index)}/outputs/0/limit`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} output limit is too small to show visible motion.`,
      evidence: [`dynamicsGroupId=${entry.group.dynamicsGroupId}`, `limit=${output.limit}`],
      impact: "The additive output offset will be clamped to zero or a visually negligible range."
    }));
  }

  if (
    pendulum !== undefined &&
    (pendulum.length < 0.001 ||
      pendulum.sway > 100 ||
      pendulum.reactionSpeed > 100 ||
      pendulum.convergenceSpeed > 100)
  ) {
    checks.push(createWarningCheck({
      entry,
      checkId: "dynamics.unstableSettings",
      targetPath: `${groupBasePath(entry.index)}/pendulums/0`,
      message: `Dynamics group ${entry.group.dynamicsGroupId} has extreme pendulum coefficients.`,
      evidence: [
        `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
        `length=${pendulum.length}`,
        `sway=${pendulum.sway}`,
        `reactionSpeed=${pendulum.reactionSpeed}`,
        `convergenceSpeed=${pendulum.convergenceSpeed}`
      ],
      impact: "The group is valid but may produce unstable or hard-to-control additive motion."
    }));
  }

  return checks;
};

const validateDuplicateOutputTargets = (
  outputOwnersByParameterId: ReadonlyMap<ParameterId, readonly DynamicsGroupEntry[]>
): readonly ValidationCheckResultDto[] =>
  [...outputOwnersByParameterId.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([parameterId, entries]) => createOutputTargetDuplicateCheck(parameterId, entries));

const validateRuntimeDynamicsEvidence = (input: {
  readonly groupEntries: readonly DynamicsGroupEntry[];
  readonly runtimeSnapshot: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const snapshotDynamicsById = new Map(
    input.runtimeSnapshot.dynamics.map((dynamicsGroup) => [
      dynamicsGroup.dynamicsGroupId,
      dynamicsGroup
    ])
  );
  const checks: ValidationCheckResultDto[] = [];

  for (const entry of input.groupEntries.filter((candidate) => candidate.group.enabled)) {
    const output = entry.group.outputs[0];
    const snapshotDynamicsGroup = snapshotDynamicsById.get(entry.group.dynamicsGroupId);
    if (snapshotDynamicsGroup === undefined || output === undefined) {
      continue;
    }

    if (snapshotDynamicsGroup.outputParameterId !== output.parameterId) {
      checks.push(createRuntimeEvidenceMismatchCheck({
        entry,
        runtimeSnapshotId: input.runtimeSnapshot.snapshotId,
        message: `Runtime snapshot ${input.runtimeSnapshot.snapshotId} dynamics output target does not match package group ${entry.group.dynamicsGroupId}.`,
        evidence: [
          `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
          `packageOutputParameterId=${output.parameterId}`,
          `snapshotOutputParameterId=${snapshotDynamicsGroup.outputParameterId}`
        ]
      }));
    }
  }

  return checks;
};

const createSortedInputEntries = (group: DynamicsGroupDto): readonly DynamicsInputEntry[] =>
  group.inputs
    .map((input, index) => ({ input, index }))
    .sort((left, right) =>
      left.input.parameterId.localeCompare(right.input.parameterId) ||
      left.input.kind.localeCompare(right.input.kind) ||
      left.index - right.index
    );

const createDriverMissingCheck = (
  entry: DynamicsGroupEntry,
  inputEntry: DynamicsInputEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.driverMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: inputEntry.input.parameterId,
      path: groupInputParameterPath(entry.index, inputEntry.index)
    },
    targetPath: groupInputParameterPath(entry.index, inputEntry.index),
    message: `Dynamics group ${entry.group.dynamicsGroupId} references missing driver parameter ${inputEntry.input.parameterId}.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `inputIndex=${inputEntry.index}`,
      `parameterId=${inputEntry.input.parameterId}`,
      "parameterMatch=missing"
    ],
    impact: "The dynamics group cannot be evaluated because one input parameter is absent."
  });

const createOutputMissingCheck = (
  entry: DynamicsGroupEntry,
  outputIndex: number
): ValidationCheckResultDto => {
  const output = entry.group.outputs[outputIndex];

  return createDynamicsCheck({
    checkId: "dynamics.outputMissing",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "parameter",
      id: output?.parameterId ?? entry.group.dynamicsGroupId,
      path: groupOutputParameterPath(entry.index, outputIndex)
    },
    targetPath: groupOutputParameterPath(entry.index, outputIndex),
    message: `Dynamics group ${entry.group.dynamicsGroupId} targets missing output parameter ${output?.parameterId ?? "<missing>"}.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `outputIndex=${outputIndex}`,
      `parameterId=${output?.parameterId ?? "<missing>"}`,
      "parameterMatch=missing"
    ],
    impact: "The dynamics group cannot apply its additive output offset to a package parameter."
  });
};

const createNormalizationInvalidCheck = (
  entry: DynamicsGroupEntry,
  inputEntry: DynamicsInputEntry
): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.normalizationInvalid",
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "dynamicsGroup",
      id: entry.group.dynamicsGroupId,
      path: `${groupInputBasePath(entry.index, inputEntry.index)}/normalization`
    },
    targetPath: `${groupInputBasePath(entry.index, inputEntry.index)}/normalization`,
    message: `Dynamics group ${entry.group.dynamicsGroupId} has invalid input normalization.`,
    evidence: [
      `dynamicsGroupId=${entry.group.dynamicsGroupId}`,
      `inputIndex=${inputEntry.index}`,
      `min=${inputEntry.input.normalization.min}`,
      `center=${inputEntry.input.normalization.center}`,
      `max=${inputEntry.input.normalization.max}`
    ],
    impact: "Dynamics input normalization must satisfy min < center < max."
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
      path: firstEntry === undefined ? "/model/dynamics/dynamicsGroups" : groupOutputParameterPath(firstEntry.index, 0)
    },
    targetPath: firstEntry === undefined ? "/model/dynamics/dynamicsGroups" : groupOutputParameterPath(firstEntry.index, 0),
    message: `Multiple dynamics groups target additive output parameter ${parameterId}.`,
    evidence: [
      `targetParameterId=${parameterId}`,
      ...sortedEntries.map((entry) => `ownerGroupId=${entry.group.dynamicsGroupId}`)
    ],
    impact: "Dynamics v0 allows only one group to own an output parameter."
  });
};

const createGroupShapeCheck = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly checkId: string;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: input.checkId,
    status: "fail",
    severity: "error",
    phase: "dynamics_semantic",
    target: {
      kind: "dynamicsGroup",
      id: input.entry.group.dynamicsGroupId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    impact: input.impact
  });

const createWarningCheck = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly checkId: string;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: input.checkId,
    status: "needs_review",
    severity: "warning",
    phase: "dynamics_semantic",
    target: {
      kind: "dynamicsGroup",
      id: input.entry.group.dynamicsGroupId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    impact: input.impact
  });

const createRuntimeEvidenceMismatchCheck = (input: {
  readonly entry: DynamicsGroupEntry;
  readonly runtimeSnapshotId: RuntimeSnapshotId;
  readonly message: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createDynamicsCheck({
    checkId: "dynamics.runtimeEvidenceMismatch",
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
    impact: "Provided runtime dynamics evidence disagrees with the package Dynamics group.",
    snapshotIds: [input.runtimeSnapshotId]
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

const compareGroupEntries = (left: DynamicsGroupEntry, right: DynamicsGroupEntry): number =>
  left.group.dynamicsGroupId.localeCompare(right.group.dynamicsGroupId) || left.index - right.index;

const groupBasePath = (groupIndex: number): string =>
  `/model/dynamics/dynamicsGroups/${groupIndex}`;

const groupInputBasePath = (groupIndex: number, inputIndex: number): string =>
  `${groupBasePath(groupIndex)}/inputs/${inputIndex}`;

const groupInputParameterPath = (groupIndex: number, inputIndex: number): string =>
  `${groupInputBasePath(groupIndex, inputIndex)}/parameterId`;

const groupOutputParameterPath = (groupIndex: number, outputIndex: number): string =>
  `${groupBasePath(groupIndex)}/outputs/${outputIndex}/parameterId`;
