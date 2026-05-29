import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

export const getNextPackageRevision = (basePackageRevision: number): number => {
  assertPackageRevision(basePackageRevision);
  return basePackageRevision + 1;
};

export const incrementCommittedPackageRevision = (
  session: AuthoringSession,
  basePackageRevision: number
): number => {
  assertPackageRevision(basePackageRevision);
  if (session.packageRevision !== basePackageRevision) {
    throw new Error(
      `Package revision changed before operation-core could commit it: expected ${basePackageRevision}, got ${session.packageRevision}.`
    );
  }

  const nextPackageRevision = getNextPackageRevision(basePackageRevision);
  session.packageRevision = nextPackageRevision;
  return nextPackageRevision;
};

export const applyDryRunCandidatePackageRevision = (input: {
  readonly baselineSession: AuthoringSession;
  readonly candidateSession: AuthoringSession;
  readonly basePackageRevision: number;
}): number => {
  assertPackageRevision(input.basePackageRevision);
  if (input.candidateSession === input.baselineSession) {
    throw new Error("Dry-run candidate package revision cannot be applied to the original session.");
  }

  const nextPackageRevision = getNextPackageRevision(input.basePackageRevision);
  input.candidateSession.packageRevision = nextPackageRevision;
  return nextPackageRevision;
};

const assertPackageRevision = (packageRevision: number): void => {
  if (!Number.isInteger(packageRevision) || packageRevision < 0) {
    throw new Error(`Package revision must be a non-negative integer: ${packageRevision}.`);
  }
};
