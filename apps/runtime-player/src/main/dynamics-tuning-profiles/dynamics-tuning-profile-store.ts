import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createDynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-export-identity";
import type {
  DynamicsTuningProfileDocument,
  DynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-profile-document";
import {
  parseDynamicsTuningProfileDocument
} from "./dynamics-tuning-profile-parser";

export type DynamicsTuningProfileStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type DynamicsTuningProfileStoreLoadResult = {
  readonly identity: DynamicsTuningRuntimeExportIdentity;
  readonly profileFilePath: string;
  readonly profile: DynamicsTuningProfileDocument | null;
  readonly state: DynamicsTuningProfileStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type DynamicsTuningProfileStoreOptions = {
  readonly userDataPath?: string;
  readonly profilesRootPath?: string;
};

export class DynamicsTuningProfileStore {
  private readonly profilesRootPath: string;

  constructor(options: DynamicsTuningProfileStoreOptions) {
    if (options.profilesRootPath !== undefined) {
      this.profilesRootPath = options.profilesRootPath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error(
        "DynamicsTuningProfileStore requires userDataPath or profilesRootPath."
      );
    }

    this.profilesRootPath = path.join(
      options.userDataPath,
      "dynamics-tuning-profiles"
    );
  }

  getProfilesRootPath(): string {
    return this.profilesRootPath;
  }

  getProfileFilePath(identity: DynamicsTuningRuntimeExportIdentity): string {
    return path.join(
      this.profilesRootPath,
      identity.safePackageId,
      `${identity.fingerprint}.json`
    );
  }

  async loadProfile(
    payload: RuntimeExportLoadedPayload
  ): Promise<DynamicsTuningProfileStoreLoadResult> {
    const identity = createDynamicsTuningRuntimeExportIdentity(payload);
    const profileFilePath = this.getProfileFilePath(identity);
    let fileText: string;

    try {
      fileText = await readFile(profileFilePath, "utf8");
    } catch (error) {
      if (isNodeErrorCode(error, "ENOENT")) {
        return {
          identity,
          profileFilePath,
          profile: null,
          state: "missing",
          warningMessages: []
        };
      }

      return {
        identity,
        profileFilePath,
        profile: null,
        state: "read-failed",
        warningMessages: [
          `Dynamics tuning profile could not be read: ${toErrorMessage(error)}`
        ]
      };
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(fileText);
    } catch (error) {
      return {
        identity,
        profileFilePath,
        profile: null,
        state: "read-failed",
        warningMessages: [
          `Dynamics tuning profile contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedProfile = parseDynamicsTuningProfileDocument(parsedJson);

    if (!parsedProfile.ok) {
      return {
        identity,
        profileFilePath,
        profile: null,
        state: "read-failed",
        warningMessages: parsedProfile.warningMessages
      };
    }

    if (!isMatchingIdentity(identity, parsedProfile.profile)) {
      return {
        identity,
        profileFilePath,
        profile: null,
        state: "read-failed",
        warningMessages: [
          "Dynamics tuning profile identity does not match the selected Runtime Export."
        ]
      };
    }

    return {
      identity,
      profileFilePath,
      profile: parsedProfile.profile,
      state: "loaded",
      warningMessages: parsedProfile.warningMessages
    };
  }

  async saveProfile(input: {
    readonly identity: DynamicsTuningRuntimeExportIdentity;
    readonly profile: DynamicsTuningProfileDocument;
  }): Promise<string> {
    const profileFilePath = this.getProfileFilePath(input.identity);
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(
      profileFilePath,
      `${JSON.stringify(input.profile, null, 2)}\n`,
      "utf8"
    );

    return profileFilePath;
  }
}

function isMatchingIdentity(
  identity: DynamicsTuningRuntimeExportIdentity,
  profile: DynamicsTuningProfileDocument
): boolean {
  if (
    identity.packageHash !== undefined &&
    profile.exportIdentity.packageHash !== undefined
  ) {
    return profile.exportIdentity.packageHash === identity.packageHash;
  }

  return (
    profile.exportIdentity.packageId === identity.packageId &&
    profile.exportIdentity.packageRevision === identity.packageRevision &&
    profile.exportIdentity.packageHash === undefined &&
    identity.packageHash === undefined &&
    profile.exportIdentity.parameterSignatureHash ===
      identity.parameterSignatureHash
  );
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
