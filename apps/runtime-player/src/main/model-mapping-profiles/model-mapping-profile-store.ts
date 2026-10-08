import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createModelMappingRuntimeExportIdentity
} from "./model-mapping-export-identity";
import type {
  ModelMappingProfileDocument,
  ModelMappingRuntimeExportIdentity
} from "./model-mapping-profile-document";
import { parseModelMappingProfileDocument } from "./model-mapping-profile-parser";

export type ModelMappingProfileStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type ModelMappingProfileStoreLoadResult = {
  readonly identity: ModelMappingRuntimeExportIdentity;
  readonly profileFilePath: string;
  readonly profile: ModelMappingProfileDocument | null;
  readonly state: ModelMappingProfileStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type ModelMappingProfileStoreOptions = {
  readonly userDataPath?: string;
  readonly profilesRootPath?: string;
};

export class ModelMappingProfileStore {
  private readonly profilesRootPath: string;

  constructor(options: ModelMappingProfileStoreOptions) {
    if (options.profilesRootPath !== undefined) {
      this.profilesRootPath = options.profilesRootPath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error(
        "ModelMappingProfileStore requires userDataPath or profilesRootPath."
      );
    }

    this.profilesRootPath = path.join(
      options.userDataPath,
      "model-mapping-profiles"
    );
  }

  getProfilesRootPath(): string {
    return this.profilesRootPath;
  }

  getProfileFilePath(identity: ModelMappingRuntimeExportIdentity): string {
    return path.join(
      this.profilesRootPath,
      identity.safePackageId,
      `${identity.fingerprint}.json`
    );
  }

  async loadProfile(
    payload: RuntimeExportLoadedPayload
  ): Promise<ModelMappingProfileStoreLoadResult> {
    const identity = createModelMappingRuntimeExportIdentity(payload);
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
          `Model mapping profile could not be read: ${toErrorMessage(error)}`
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
          `Model mapping profile contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedProfile = parseModelMappingProfileDocument(parsedJson);

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
          "Model mapping profile identity does not match the selected Runtime Export."
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
    readonly identity: ModelMappingRuntimeExportIdentity;
    readonly profile: ModelMappingProfileDocument;
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
  identity: ModelMappingRuntimeExportIdentity,
  profile: ModelMappingProfileDocument
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
