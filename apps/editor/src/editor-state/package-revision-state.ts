export interface PackageRevisionState {
  readonly packageRevision: number;
  readonly authoringRevision: number;
}

export interface PackageRevisionInput {
  readonly packageRevision: number;
  readonly authoringRevision?: number;
}

export const emptyPackageRevisionState = (): PackageRevisionState => ({
  packageRevision: 0,
  authoringRevision: 0
});

export const projectPackageRevision = (input: PackageRevisionInput): PackageRevisionState => ({
  packageRevision: input.packageRevision,
  authoringRevision: input.authoringRevision ?? 0
});
