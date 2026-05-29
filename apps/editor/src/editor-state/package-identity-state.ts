export interface LoadedPackageIdentityState {
  readonly packageId: string;
  readonly displayName: string;
  readonly formatVersion: string;
}

export interface LoadedPackageIdentityInput {
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly formatVersion: string;
}

export const projectLoadedPackageIdentity = (
  input: LoadedPackageIdentityInput
): LoadedPackageIdentityState => ({
  packageId: input.packageId,
  displayName: input.packageDisplayName,
  formatVersion: input.formatVersion
});
