import type { Brand } from "@private-2d-rigging-lab/contracts";

export type AuthoringRevision = Brand<number, "AuthoringRevision">;

export const createInitialAuthoringRevision = (): AuthoringRevision => 0 as AuthoringRevision;

export const toAuthoringRevision = (revision: number): AuthoringRevision => {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error(`Authoring revision must be a non-negative integer: ${revision}`);
  }

  return revision as AuthoringRevision;
};

export const incrementAuthoringRevision = (revision: AuthoringRevision): AuthoringRevision =>
  toAuthoringRevision(revision + 1);
