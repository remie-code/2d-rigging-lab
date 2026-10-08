import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createPhysiologyRuntimeExportIdentity
} from "./physiology-export-identity";
import type {
  PhysiologyProfileDocument,
  PhysiologyRuntimeExportIdentity
} from "./physiology-profile-document";
import {
  parsePhysiologyProfileDocument
} from "./physiology-profile-parser";

export type PhysiologyProfileStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type PhysiologyProfileStoreLoadResult = {
  readonly identity: PhysiologyRuntimeExportIdentity;
  readonly profileFilePath: string;
  readonly profile: PhysiologyProfileDocument | null;
  readonly state: PhysiologyProfileStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type PhysiologyProfileStoreOptions = {
  readonly userDataPath?: string;
  readonly profilesRootPath?: string;
};

/**
 * Physiology profile store (C3 Domain C). A parallel copy of the Dynamics Tune
 * store shape (裁定4, not shared), simplified: the fingerprint path
 * `<userData>/physiology-profiles/<safePackageId>/<fingerprint>.json` separates
 * exports (and, since userData is already redirected into the slot in
 * runtime-player-main.ts:129, separates slots too — UX §4). Stale = schemaVersion
 * reject (in the parser) + fingerprint identity mismatch; there is NO
 * dynamicsSignatureHash (physiology is model-independent).
 */
export class PhysiologyProfileStore {
  private readonly profilesRootPath: string;

  constructor(options: PhysiologyProfileStoreOptions) {
    if (options.profilesRootPath !== undefined) {
      this.profilesRootPath = options.profilesRootPath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error(
        "PhysiologyProfileStore requires userDataPath or profilesRootPath."
      );
    }

    this.profilesRootPath = path.join(
      options.userDataPath,
      "physiology-profiles"
    );
  }

  getProfilesRootPath(): string {
    return this.profilesRootPath;
  }

  getProfileFilePath(identity: PhysiologyRuntimeExportIdentity): string {
    return path.join(
      this.profilesRootPath,
      identity.safePackageId,
      `${identity.fingerprint}.json`
    );
  }

  async loadProfile(
    payload: RuntimeExportLoadedPayload
  ): Promise<PhysiologyProfileStoreLoadResult> {
    const identity = createPhysiologyRuntimeExportIdentity(payload);
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
          `Physiology profile could not be read: ${toErrorMessage(error)}`
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
          `Physiology profile contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedProfile = parsePhysiologyProfileDocument(parsedJson);

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
          "Physiology profile identity does not match the selected Runtime Export."
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
    readonly identity: PhysiologyRuntimeExportIdentity;
    readonly profile: PhysiologyProfileDocument;
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
  identity: PhysiologyRuntimeExportIdentity,
  profile: PhysiologyProfileDocument
): boolean {
  // The fingerprint is the model-independent export identity; a mismatch means the
  // file belongs to a different export (stale) even if it somehow shares a path.
  return profile.exportIdentity.fingerprint === identity.fingerprint;
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
