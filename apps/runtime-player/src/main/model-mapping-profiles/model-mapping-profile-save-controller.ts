import type { RuntimePlayerLiveMappingState } from "../live-mapping/live-mapping-state";
import type { ModelMappingProfileStore } from "./model-mapping-profile-store";

export type ModelMappingProfileSaveOutcome =
  | {
      readonly result: "saved";
      readonly message: string;
    }
  | {
      readonly result: "unavailable";
      readonly message: string;
    }
  | {
      readonly result: "failed";
      readonly message: string;
    };

export type ModelMappingProfileSaveControllerOptions = {
  readonly mappingState: RuntimePlayerLiveMappingState;
  readonly store: ModelMappingProfileStore;
  readonly debounceMs?: number;
  readonly nowIso?: () => string;
  readonly onStatusChanged?: () => void;
};

export class ModelMappingProfileSaveController {
  private static readonly maxFlushPasses = 10;
  private readonly mappingState: RuntimePlayerLiveMappingState;
  private readonly store: ModelMappingProfileStore;
  private readonly debounceMs: number;
  private readonly nowIso: () => string;
  private readonly onStatusChanged: () => void;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<ModelMappingProfileSaveOutcome> | null = null;

  constructor(options: ModelMappingProfileSaveControllerOptions) {
    this.mappingState = options.mappingState;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 750;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.onStatusChanged = options.onStatusChanged ?? (() => {});
  }

  scheduleSave(): void {
    if (!this.mappingState.canSaveMappingProfile()) {
      return;
    }

    this.clearTimer();
    this.mappingState.markMappingProfileUnsaved();
    this.onStatusChanged();
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      void this.saveNow();
    }, this.debounceMs);
  }

  async flush(): Promise<ModelMappingProfileSaveOutcome> {
    for (
      let pass = 0;
      pass < ModelMappingProfileSaveController.maxFlushPasses;
      pass += 1
    ) {
      this.clearTimer();

      if (this.pendingSave !== null) {
        const outcome = await this.pendingSave;

        if (outcome.result !== "saved") {
          return outcome;
        }

        continue;
      }

      if (!this.mappingState.needsMappingProfileSave()) {
        return {
          result: "saved",
          message: "No pending mapping profile changes."
        };
      }

      const outcome = await this.saveNow();

      if (outcome.result !== "saved") {
        return outcome;
      }
    }

    const message =
      "Mapping profile save did not finish before the flush limit.";
    this.mappingState.markMappingProfileSaveFailed(message);
    this.onStatusChanged();

    return {
      result: "failed",
      message
    };
  }

  async saveNow(): Promise<ModelMappingProfileSaveOutcome> {
    this.clearTimer();

    if (this.pendingSave !== null) {
      return this.pendingSave;
    }

    const snapshot = this.mappingState.createMappingProfileSnapshot(
      this.nowIso()
    );

    if (snapshot === null) {
      return {
        result: "unavailable",
        message: "Open a Runtime Export before saving mapping profile."
      };
    }

    this.mappingState.markMappingProfileSaving();
    this.onStatusChanged();
    this.pendingSave = this.store.saveProfile({
      identity: snapshot.identity,
      profile: snapshot.profile
    }).then(() => {
      this.mappingState.markMappingProfileSaved({
        revision: snapshot.revision,
        updatedAtIso: snapshot.profile.updatedAtIso
      });
      this.onStatusChanged();

      if (this.mappingState.needsMappingProfileSave()) {
        this.scheduleSave();
      }

      return {
        result: "saved" as const,
        message: "Mapping profile saved."
      };
    }).catch((error: unknown) => {
      const message =
        `Mapping profile save failed: ${toErrorMessage(error)}`;
      this.mappingState.markMappingProfileSaveFailed(message);
      this.onStatusChanged();

      return {
        result: "failed" as const,
        message
      };
    }).finally(() => {
      this.pendingSave = null;
    });

    return this.pendingSave;
  }

  private clearTimer(): void {
    if (this.pendingTimer === null) {
      return;
    }

    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
