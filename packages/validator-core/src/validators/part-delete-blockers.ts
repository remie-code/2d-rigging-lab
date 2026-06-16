import {
  OperationIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  OperationId,
  PartId
} from "@private-2d-rigging-lab/contracts";
import type {
  ModelPartDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface PartDeleteCandidateInput {
  readonly partId: PartId | string;
  readonly operationId?: OperationId | string;
  readonly targetPath?: string;
}

export interface PartDeleteCandidateValidationInput {
  readonly packageDocument: PackageDocumentDto;
  readonly candidates: readonly PartDeleteCandidateInput[];
}

interface PartWithIndex {
  readonly part: ModelPartDto;
  readonly index: number;
}

interface PartDeleteBlockers {
  readonly childPartIds: readonly string[];
  readonly drawableIds: readonly string[];
  readonly maskRelationIds: readonly string[];
}

export const validatePartDeleteCandidates = (
  input: PartDeleteCandidateValidationInput
): readonly ValidationCheckResultDto[] => {
  const partsById = new Map(
    input.packageDocument.model.graph.parts.map((part, index) => [part.partId, { part, index }])
  );

  return input.candidates.flatMap((candidate) => {
    const partId = PartIdSchema.parse(candidate.partId);
    const partEntry = partsById.get(partId);
    if (partEntry === undefined) {
      return [];
    }

    const blockers = collectPartDeleteBlockers(input.packageDocument, partEntry.part);
    return hasDeleteBlockers(blockers)
      ? [createPartDeleteNonEmptyCheck({ partEntry, candidate, partId, blockers })]
      : [];
  });
};

const collectPartDeleteBlockers = (
  packageDocument: PackageDocumentDto,
  part: ModelPartDto
): PartDeleteBlockers => {
  const drawableIds = uniqueSorted([
    ...part.drawableIds,
    ...packageDocument.model.drawables.drawables
      .filter((drawable) => drawable.partId === part.partId)
      .map((drawable) => drawable.drawableId)
  ]);
  const drawableIdSet = new Set(drawableIds);

  return {
    childPartIds: uniqueSorted(part.childPartIds),
    drawableIds,
    maskRelationIds: uniqueSorted(
      packageDocument.model.masks.masks
        .filter((mask) =>
          [...mask.maskDrawableIds, ...mask.targetDrawableIds].some((drawableId) => drawableIdSet.has(drawableId))
        )
        .map((mask) => mask.maskRelationId)
    )
  };
};

const hasDeleteBlockers = (blockers: PartDeleteBlockers): boolean =>
  blockers.childPartIds.length > 0 ||
  blockers.drawableIds.length > 0 ||
  blockers.maskRelationIds.length > 0;

const createPartDeleteNonEmptyCheck = (input: {
  readonly partEntry: PartWithIndex;
  readonly candidate: PartDeleteCandidateInput;
  readonly partId: PartId;
  readonly blockers: PartDeleteBlockers;
}): ValidationCheckResultDto => {
  const operationId = input.candidate.operationId === undefined
    ? undefined
    : OperationIdSchema.parse(input.candidate.operationId);
  const targetPath = input.candidate.targetPath ?? `/model/graph/parts/${input.partEntry.index}`;
  const blockerKinds = [
    ...(input.blockers.childPartIds.length === 0 ? [] : ["childPart"]),
    ...(input.blockers.drawableIds.length === 0 ? [] : ["drawable"]),
    ...(input.blockers.maskRelationIds.length === 0 ? [] : ["maskRelation"])
  ];

  return ValidationCheckResultSchema.parse({
    checkId: "part.deleteNonEmpty",
    status: "fail",
    severity: "blocking",
    phase: "reference",
    target: {
      kind: "part",
      id: input.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${input.partId} cannot be deleted because it is not an empty leaf part.`,
    evidence: [
      `partId=${input.partId}`,
      `blockerKinds=${blockerKinds.join(",")}`,
      ...createBlockerEvidence("childPartIds", input.blockers.childPartIds),
      ...createBlockerEvidence("drawableIds", input.blockers.drawableIds),
      ...createBlockerEvidence("maskRelationIds", input.blockers.maskRelationIds),
      "deleteScope=empty-leaf-only"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "Wave33 part deletion is limited to empty leaf parts; deleting this part would orphan hierarchy or layer evidence.",
    operationIds: operationId === undefined ? [] : [operationId]
  });
};

const createBlockerEvidence = (
  label: string,
  values: readonly string[]
): readonly string[] => values.length === 0 ? [] : [`${label}=${values.join(",")}`];

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));
