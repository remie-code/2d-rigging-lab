import type { PhysiologyProfileStore } from "./physiology-profile-store";
import type { RuntimePlayerPhysiologyState } from "./physiology-state";

export type PhysiologyProfileSaveOutcome =
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

export type PhysiologyProfileSaveControllerOptions = {
  readonly physiologyState: RuntimePlayerPhysiologyState;
  readonly store: PhysiologyProfileStore;
  readonly debounceMs?: number;
  readonly nowIso?: () => string;
  readonly onStatusChanged?: () => void;
};

/**
 * Physiology profile auto-save (C3 Domain C). A parallel copy of the Dynamics Tune
 * save controller (裁定4). Debounced (既定 750ms), NO Save button — the page saves
 * automatically (UX §4). scheduleSave/flush/saveNow mirror the Dynamics流儀.
 */
export class PhysiologyProfileSaveController {
  private static readonly maxFlushPasses = 10;
  private readonly physiologyState: RuntimePlayerPhysiologyState;
  private readonly store: PhysiologyProfileStore;
  private readonly debounceMs: number;
  private readonly nowIso: () => string;
  private readonly onStatusChanged: () => void;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<PhysiologyProfileSaveOutcome> | null = null;

  constructor(options: PhysiologyProfileSaveControllerOptions) {
    this.physiologyState = options.physiologyState;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 750;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.onStatusChanged = options.onStatusChanged ?? (() => {});
  }

  scheduleSave(): void {
    if (!this.physiologyState.canSaveProfile()) {
      return;
    }

    this.clearTimer();
    this.physiologyState.markProfileUnsaved();
    this.onStatusChanged();
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      void this.saveNow();
    }, this.debounceMs);
  }

  async flush(): Promise<PhysiologyProfileSaveOutcome> {
    for (
      let pass = 0;
      pass < PhysiologyProfileSaveController.maxFlushPasses;
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

      if (!this.physiologyState.needsProfileSave()) {
        return {
          result: "saved",
          message: "No pending physiology profile changes."
        };
      }

      const outcome = await this.saveNow();

      if (outcome.result !== "saved") {
        return outcome;
      }
    }

    const message =
      "Physiology profile save did not finish before the flush limit.";
    this.physiologyState.markProfileSaveFailed(message);
    this.onStatusChanged();

    return {
      result: "failed",
      message
    };
  }

  async saveNow(): Promise<PhysiologyProfileSaveOutcome> {
    this.clearTimer();

    if (this.pendingSave !== null) {
      return this.pendingSave;
    }

    const snapshot = this.physiologyState.createProfileSnapshot(this.nowIso());

    if (snapshot === null) {
      return {
        result: "unavailable",
        message: "Open a Runtime Export before saving physiology profile."
      };
    }

    this.physiologyState.markProfileSaving();
    this.onStatusChanged();
    this.pendingSave = this.store
      .saveProfile({
        identity: snapshot.identity,
        profile: snapshot.profile
      })
      .then(() => {
        this.physiologyState.markProfileSaved({
          revision: snapshot.revision,
          updatedAtIso: snapshot.profile.updatedAtIso
        });
        this.onStatusChanged();

        if (this.physiologyState.needsProfileSave()) {
          this.scheduleSave();
        }

        return {
          result: "saved" as const,
          message: "Physiology profile saved."
        };
      })
      .catch((error: unknown) => {
        const message = `Physiology profile save failed: ${toErrorMessage(error)}`;
        this.physiologyState.markProfileSaveFailed(message);
        this.onStatusChanged();

        return {
          result: "failed" as const,
          message
        };
      })
      .finally(() => {
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
