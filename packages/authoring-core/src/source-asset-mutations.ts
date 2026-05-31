import type { OperationId, ProvenanceId, SourceAssetId } from "@private-2d-rigging-lab/contracts";
import type {
  ProvenanceRecordDto,
  RightsRecordDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { normalizeSourceAssetBinaryAssetReference } from "./binary-asset-references.js";
import { getSourceAssetById } from "./drawable-selectors.js";

export interface ImportSourceAssetMetadataMutationResult {
  readonly session: AuthoringSession;
  readonly sourceAsset: SourceAssetDto;
  readonly provenanceRecord: ProvenanceRecordDto;
  readonly rightsRecord: RightsRecordDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface SetRightsMetadataMutationResult {
  readonly session: AuthoringSession;
  readonly rightsBefore?: RightsRecordDto;
  readonly rightsRecord: RightsRecordDto;
  readonly provenanceBefore?: ProvenanceRecordDto;
  readonly provenanceRecord?: ProvenanceRecordDto;
  readonly authoringRevision: AuthoringRevision;
}

export const importSourceAssetMetadata = (
  session: AuthoringSession,
  input: {
    readonly sourceAsset: SourceAssetDto;
    readonly provenanceRecord: ProvenanceRecordDto;
    readonly rightsRecord: RightsRecordDto;
  }
): ImportSourceAssetMetadataMutationResult => {
  assertCanImportSourceAssetMetadata(session, input);

  const sourceAsset = structuredClone(input.sourceAsset);
  const provenanceRecord = structuredClone(input.provenanceRecord);
  const rightsRecord = structuredClone(input.rightsRecord);
  const binaryAssetRef = normalizeSourceAssetBinaryAssetReference({
    sourceAsset,
    provenanceRecord,
    rightsRecord
  });
  if (binaryAssetRef !== undefined) {
    sourceAsset.binaryAssetRef = binaryAssetRef;
  }

  session.graph.sourceAssets.push(sourceAsset);
  upsertProvenanceRecord(session, provenanceRecord);
  upsertRightsRecord(session, rightsRecord);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    sourceAsset,
    provenanceRecord,
    rightsRecord,
    authoringRevision: session.authoringRevision
  };
};

export const setRightsMetadata = (
  session: AuthoringSession,
  input: {
    readonly rightsRecord: RightsRecordDto;
    readonly provenanceId?: ProvenanceId;
    readonly relatedOperationId?: OperationId;
  }
): SetRightsMetadataMutationResult => {
  const sourceAssetId = input.rightsRecord.assetId as SourceAssetId;
  if (getSourceAssetById(session.graph, sourceAssetId) === undefined) {
    throw new AuthoringMutationError(
      "missing_source_asset",
      `Source asset does not exist: ${input.rightsRecord.assetId}.`
    );
  }

  if (input.rightsRecord.rightsStatus === "blocked") {
    throw new AuthoringMutationError(
      "blocked_rights",
      `Blocked rights cannot be applied to source asset ${input.rightsRecord.assetId}.`
    );
  }

  const rightsBefore = findRightsRecord(session, input.rightsRecord.assetId);
  const provenanceBefore = findProvenanceRecord(session, {
    assetId: input.rightsRecord.assetId,
    ...(input.provenanceId === undefined ? {} : { provenanceId: input.provenanceId })
  });
  const rightsRecord = structuredClone(input.rightsRecord);
  const provenanceRecord =
    provenanceBefore === undefined
      ? undefined
      : appendRelatedOperationId(provenanceBefore, input.relatedOperationId);

  upsertRightsRecord(session, rightsRecord);

  if (provenanceRecord !== undefined) {
    upsertProvenanceRecord(session, provenanceRecord);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    ...(rightsBefore === undefined ? {} : { rightsBefore }),
    rightsRecord,
    ...(provenanceBefore === undefined ? {} : { provenanceBefore }),
    ...(provenanceRecord === undefined ? {} : { provenanceRecord }),
    authoringRevision: session.authoringRevision
  };
};

const assertCanImportSourceAssetMetadata = (
  session: AuthoringSession,
  input: {
    readonly sourceAsset: SourceAssetDto;
    readonly provenanceRecord: ProvenanceRecordDto;
    readonly rightsRecord: RightsRecordDto;
  }
): void => {
  if (getSourceAssetById(session.graph, input.sourceAsset.sourceAssetId) !== undefined) {
    throw new AuthoringMutationError(
      "duplicate_source_asset",
      `Source asset already exists: ${input.sourceAsset.sourceAssetId}.`
    );
  }

  if (input.rightsRecord.rightsStatus === "blocked") {
    throw new AuthoringMutationError(
      "blocked_rights",
      `Blocked rights cannot be imported for source asset ${input.sourceAsset.sourceAssetId}.`
    );
  }

  if (input.provenanceRecord.assetId !== input.sourceAsset.sourceAssetId) {
    throw new AuthoringMutationError(
      "provenance_asset_mismatch",
      `Provenance asset ${input.provenanceRecord.assetId} does not match source asset ${input.sourceAsset.sourceAssetId}.`
    );
  }

  if (input.rightsRecord.assetId !== input.sourceAsset.sourceAssetId) {
    throw new AuthoringMutationError(
      "rights_asset_mismatch",
      `Rights asset ${input.rightsRecord.assetId} does not match source asset ${input.sourceAsset.sourceAssetId}.`
    );
  }

  const sourceLayerIds = new Set<string>();
  for (const layer of input.sourceAsset.layers) {
    if (layer.sourceAssetId !== input.sourceAsset.sourceAssetId) {
      throw new AuthoringMutationError(
        "source_layer_asset_mismatch",
        `Source layer ${layer.sourceLayerId} does not belong to source asset ${input.sourceAsset.sourceAssetId}.`
      );
    }

    if (sourceLayerIds.has(layer.sourceLayerId)) {
      throw new AuthoringMutationError(
        "duplicate_source_layer",
        `Source layer appears more than once: ${layer.sourceLayerId}.`
      );
    }

    sourceLayerIds.add(layer.sourceLayerId);
  }
};

const findRightsRecord = (
  session: AuthoringSession,
  assetId: string
): RightsRecordDto | undefined => {
  const record = session.graph.rightsRecords.find((candidate) => candidate.assetId === assetId);
  return record === undefined ? undefined : structuredClone(record);
};

const findProvenanceRecord = (
  session: AuthoringSession,
  input: {
    readonly assetId: string;
    readonly provenanceId?: ProvenanceId;
  }
): ProvenanceRecordDto | undefined => {
  const record =
    input.provenanceId === undefined
      ? session.graph.provenanceRecords.find((candidate) => candidate.assetId === input.assetId)
      : session.graph.provenanceRecords.find(
          (candidate) =>
            candidate.provenanceId === input.provenanceId && candidate.assetId === input.assetId
        );

  return record === undefined ? undefined : structuredClone(record);
};

const appendRelatedOperationId = (
  provenanceRecord: ProvenanceRecordDto,
  operationId: OperationId | undefined
): ProvenanceRecordDto => {
  const storedRecord = structuredClone(provenanceRecord);
  if (operationId !== undefined && !storedRecord.relatedOperationIds.includes(operationId)) {
    storedRecord.relatedOperationIds.push(operationId);
  }

  return storedRecord;
};

const upsertProvenanceRecord = (
  session: AuthoringSession,
  provenanceRecord: ProvenanceRecordDto
): void => {
  const storedRecord = structuredClone(provenanceRecord);
  const existingIndex = session.graph.provenanceRecords.findIndex(
    (candidate) => candidate.provenanceId === storedRecord.provenanceId
  );

  if (existingIndex === -1) {
    session.graph.provenanceRecords.push(storedRecord);
    return;
  }

  session.graph.provenanceRecords.splice(existingIndex, 1, storedRecord);
};

const upsertRightsRecord = (
  session: AuthoringSession,
  rightsRecord: RightsRecordDto
): void => {
  const storedRecord = structuredClone(rightsRecord);
  const existingIndex = session.graph.rightsRecords.findIndex(
    (candidate) => candidate.assetId === storedRecord.assetId
  );

  if (existingIndex === -1) {
    session.graph.rightsRecords.push(storedRecord);
    return;
  }

  session.graph.rightsRecords.splice(existingIndex, 1, storedRecord);
};
