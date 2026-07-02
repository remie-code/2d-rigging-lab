import type {
  RuntimePlayerDynamicsTuningState
} from "./dynamics-tuning-state";
import type {
  DynamicsTuningProfileStore
} from "./dynamics-tuning-profile-store";

export type DynamicsTuningProfileSaveOutcome =
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

export type DynamicsTuningProfileSaveControllerOptions = {
  readonly tuningState: RuntimePlayerDynamicsTuningState;
  readonly store: DynamicsTuningProfileStore;
  readonly debounceMs?: number;
  readonly nowIso?: () => string;
  readonly onStatusChanged?: () => void;
};

export class DynamicsTuningProfileSaveController {
  private static readonly maxFlushPasses = 10;
  private readonly tuningState: RuntimePlayerDynamicsTuningState;
  private readonly store: DynamicsTuningProfileStore;
  private readonly debounceMs: number;
  private readonly nowIso: () => string;
  private readonly onStatusChanged: () => void;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<DynamicsTuningProfileSaveOutcome> | null = null;

  constructor(options: DynamicsTuningProfileSaveControllerOptions) {
    this.tuningState = options.tuningState;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 750;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.onStatusChanged = options.onStatusChanged ?? (() => {});
  }

  scheduleSave(): void {
    if (!this.tuningState.canSaveTuningProfile()) {
      return;
    }

    this.clearTimer();
    this.tuningState.markTuningProfileUnsaved();
    this.onStatusChanged();
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      void this.saveNow();
    }, this.debounceMs);
  }

  async flush(): Promise<DynamicsTuningProfileSaveOutcome> {
    for (
      let pass = 0;
      pass < DynamicsTuningProfileSaveController.maxFlushPasses;
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

      if (!this.tuningState.needsTuningProfileSave()) {
        return {
          result: "saved",
          message: "No pending dynamics tuning profile changes."
        };
      }

      const outcome = await this.saveNow();

      if (outcome.result !== "saved") {
        return outcome;
      }
    }

    const message =
      "Dynamics tuning profile save did not finish before the flush limit.";
    this.tuningState.markTuningProfileSaveFailed(message);
    this.onStatusChanged();

    return {
      result: "failed",
      message
    };
  }

  async saveNow(): Promise<DynamicsTuningProfileSaveOutcome> {
    this.clearTimer();

    if (this.pendingSave !== null) {
      return this.pendingSave;
    }

    const snapshot = this.tuningState.createTuningProfileSnapshot(
      this.nowIso()
    );

    if (snapshot === null) {
      return {
        result: "unavailable",
        message: "Open a Runtime Export before saving dynamics tuning profile."
      };
    }

    this.tuningState.markTuningProfileSaving();
    this.onStatusChanged();
    this.pendingSave = this.store.saveProfile({
      identity: snapshot.identity,
      profile: snapshot.profile
    }).then(() => {
      this.tuningState.markTuningProfileSaved({
        revision: snapshot.revision,
        updatedAtIso: snapshot.profile.updatedAtIso
      });
      this.onStatusChanged();

      if (this.tuningState.needsTuningProfileSave()) {
        this.scheduleSave();
      }

      return {
        result: "saved" as const,
        message: "Dynamics tuning profile saved."
      };
    }).catch((error: unknown) => {
      const message =
        `Dynamics tuning profile save failed: ${toErrorMessage(error)}`;
      this.tuningState.markTuningProfileSaveFailed(message);
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
