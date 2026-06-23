import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewTransform,
  RuntimePlayerWindowBounds
} from "../../preload/runtime-player-bridge-contract";
import {
  normalizeRuntimePlayerStageAlwaysOnTop,
  normalizeRuntimePlayerStageViewTransform,
  normalizeWindowBounds,
  type RuntimePlayerWindowKey,
  type RuntimePlayerWindowStateDocument
} from "./window-state-document";
import {
  RuntimePlayerWindowStateStore,
  type RuntimePlayerWindowStateStoreSnapshot
} from "./window-state-store";

export type RuntimePlayerWindowStateControllerOptions = {
  readonly store: RuntimePlayerWindowStateStore;
  readonly snapshot: RuntimePlayerWindowStateStoreSnapshot;
  readonly debounceMs?: number;
  readonly nowIso?: () => string;
};

export type RuntimePlayerWindowStateControllerListener = () => void;

export class RuntimePlayerWindowStateController {
  private document: RuntimePlayerWindowStateDocument;
  private saveStatus: RuntimePlayerStageStateSnapshot["persistence"]["status"] =
    "saved";
  private warningMessages: readonly string[];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners =
    new Set<RuntimePlayerWindowStateControllerListener>();
  private readonly debounceMs: number;
  private readonly nowIso: () => string;

  constructor(
    private readonly options: RuntimePlayerWindowStateControllerOptions
  ) {
    this.document = options.snapshot.document;
    this.warningMessages = options.snapshot.warningMessages;
    this.debounceMs = options.debounceMs ?? 500;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
  }

  getDocument(): RuntimePlayerWindowStateDocument {
    return this.document;
  }

  getStageViewTransform(): RuntimePlayerStageViewTransform {
    return this.document.stageView.transform;
  }

  getStageAlwaysOnTop(): boolean {
    return this.document.stageEnvironment.alwaysOnTop;
  }

  getPersistenceSnapshot(): RuntimePlayerStageStateSnapshot["persistence"] {
    return {
      status: this.saveStatus,
      statusLabel: getPersistenceStatusLabel(this.saveStatus),
      storageLabel: "window-state/runtime-player.json",
      updatedAtIso: this.document.updatedAtIso,
      warningMessages: this.warningMessages
    };
  }

  subscribe(
    listener: RuntimePlayerWindowStateControllerListener
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  updateWindowBounds(
    windowKey: RuntimePlayerWindowKey,
    bounds: RuntimePlayerWindowBounds
  ): void {
    const normalizedBounds = normalizeWindowBounds(bounds);

    this.document = {
      ...this.document,
      updatedAtIso: this.nowIso(),
      windows: {
        ...this.document.windows,
        [windowKey]: {
          bounds: normalizedBounds
        }
      }
    };

    this.scheduleSave();
  }

  updateStageViewTransform(transform: unknown): RuntimePlayerStageViewTransform {
    const normalizedTransform =
      normalizeRuntimePlayerStageViewTransform(transform);

    this.document = {
      ...this.document,
      updatedAtIso: this.nowIso(),
      stageView: {
        transform: normalizedTransform
      }
    };

    this.scheduleSave();
    return normalizedTransform;
  }

  updateStageAlwaysOnTop(value: unknown): boolean {
    const alwaysOnTop = normalizeRuntimePlayerStageAlwaysOnTop(value);

    this.document = {
      ...this.document,
      updatedAtIso: this.nowIso(),
      stageEnvironment: {
        alwaysOnTop
      }
    };

    this.scheduleSave();
    return alwaysOnTop;
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    await this.writeCurrentDocument();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    this.setSaveStatus("saving");

    if (this.debounceMs <= 0) {
      void this.flush();
      return;
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.writeCurrentDocument();
    }, this.debounceMs);
  }

  private async writeCurrentDocument(): Promise<void> {
    this.setSaveStatus("saving");

    try {
      await this.options.store.saveDocument(this.document);
      this.warningMessages = [];
      this.setSaveStatus("saved");
    } catch (error) {
      this.warningMessages = [
        `Window state file could not be saved: ${toErrorMessage(error)}`
      ];
      this.setSaveStatus("save-failed");
    }
  }

  private setSaveStatus(
    status: RuntimePlayerStageStateSnapshot["persistence"]["status"]
  ): void {
    this.saveStatus = status;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function getPersistenceStatusLabel(
  status: RuntimePlayerStageStateSnapshot["persistence"]["status"]
): string {
  if (status === "saving") {
    return "Saving";
  }

  if (status === "save-failed") {
    return "Save failed";
  }

  return "Saved";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
