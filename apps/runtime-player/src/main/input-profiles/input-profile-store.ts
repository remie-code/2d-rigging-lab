import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createEmptyInputProfileDocument,
  type InputProfile,
  type InputProfileDocument
} from "./input-profile-document";
import { parseInputProfileDocument } from "./input-profile-document-parser";

export type InputProfileStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type InputProfileStoreSnapshot = {
  readonly document: InputProfileDocument;
  readonly state: InputProfileStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type InputProfileStoreOptions = {
  readonly userDataPath?: string;
  readonly profileFilePath?: string;
};

export class InputProfileStore {
  private readonly profileFilePath: string;
  private snapshot: InputProfileStoreSnapshot | null = null;

  constructor(options: InputProfileStoreOptions) {
    if (options.profileFilePath !== undefined) {
      this.profileFilePath = options.profileFilePath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error("InputProfileStore requires userDataPath or profileFilePath.");
    }

    this.profileFilePath = path.join(
      options.userDataPath,
      "input-profiles",
      "ifacialmocap",
      "profiles.json"
    );
  }

  getProfileFilePath(): string {
    return this.profileFilePath;
  }

  async getSnapshot(): Promise<InputProfileStoreSnapshot> {
    if (this.snapshot !== null) {
      return this.snapshot;
    }

    this.snapshot = await this.readSnapshot();
    return this.snapshot;
  }

  async saveProfile(profile: InputProfile): Promise<InputProfileStoreSnapshot> {
    const current = await this.getSnapshot();
    const profiles = [
      ...current.document.profiles.filter(
        (existingProfile) => existingProfile.profileId !== profile.profileId
      ),
      profile
    ];
    const document: InputProfileDocument = {
      schemaVersion: current.document.schemaVersion,
      activeProfileId: profile.profileId,
      profiles
    };

    await this.writeDocument(document);

    this.snapshot = {
      document,
      state: "loaded",
      warningMessages: []
    };

    return this.snapshot;
  }

  async setActiveProfileId(
    profileId: string
  ): Promise<InputProfileStoreSnapshot> {
    const current = await this.getSnapshot();
    const matchingProfile = current.document.profiles.find(
      (profile) => profile.profileId === profileId
    );

    if (matchingProfile === undefined) {
      throw new Error(`Input profile ${profileId} was not found.`);
    }

    const document: InputProfileDocument = {
      schemaVersion: current.document.schemaVersion,
      activeProfileId: profileId,
      profiles: current.document.profiles
    };

    await this.writeDocument(document);

    this.snapshot = {
      document,
      state: "loaded",
      warningMessages: []
    };

    return this.snapshot;
  }

  private async readSnapshot(): Promise<InputProfileStoreSnapshot> {
    let fileText: string;

    try {
      fileText = await readFile(this.profileFilePath, "utf8");
    } catch (error) {
      if (isNodeErrorCode(error, "ENOENT")) {
        return {
          document: createEmptyInputProfileDocument(),
          state: "missing",
          warningMessages: []
        };
      }

      return {
        document: createEmptyInputProfileDocument(),
        state: "read-failed",
        warningMessages: [
          `Input profile file could not be read: ${toErrorMessage(error)}`
        ]
      };
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(fileText);
    } catch (error) {
      return {
        document: createEmptyInputProfileDocument(),
        state: "read-failed",
        warningMessages: [
          `Input profile file contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedDocument = parseInputProfileDocument(parsedJson);

    if (!parsedDocument.ok) {
      return {
        document: createEmptyInputProfileDocument(),
        state: "read-failed",
        warningMessages: parsedDocument.warningMessages
      };
    }

    return {
      document: parsedDocument.document,
      state: "loaded",
      warningMessages: parsedDocument.warningMessages
    };
  }

  private async writeDocument(document: InputProfileDocument): Promise<void> {
    await mkdir(path.dirname(this.profileFilePath), { recursive: true });
    await writeFile(
      this.profileFilePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );
  }
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
