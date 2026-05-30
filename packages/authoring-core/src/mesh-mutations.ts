import type { MeshDto, ProvenanceRecordDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";

export interface ReplaceDrawableMeshMutationResult {
  readonly session: AuthoringSession;
  readonly mesh: MeshDto;
  readonly authoringRevision: AuthoringRevision;
}

export const replaceDrawableMesh = (
  session: AuthoringSession,
  mesh: MeshDto,
  provenanceRecord?: ProvenanceRecordDto
): ReplaceDrawableMeshMutationResult => {
  const drawable = getDrawableById(session.graph, mesh.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${mesh.drawableId}`
    );
  }

  if (drawable.meshId !== mesh.meshId || getMeshById(session.graph, drawable.meshId) === undefined) {
    throw new AuthoringMutationError(
      "missing_mesh",
      `Drawable ${drawable.drawableId} references missing mesh ${drawable.meshId}.`
    );
  }

  const storedMesh = structuredClone(mesh);
  const meshIndex = session.graph.meshes.findIndex((candidate) => candidate.meshId === storedMesh.meshId);
  session.graph.meshes.splice(meshIndex, 1, storedMesh);

  if (provenanceRecord !== undefined) {
    upsertProvenanceRecord(session, provenanceRecord);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    mesh: storedMesh,
    authoringRevision: session.authoringRevision
  };
};

export const upsertProvenanceRecord = (
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
