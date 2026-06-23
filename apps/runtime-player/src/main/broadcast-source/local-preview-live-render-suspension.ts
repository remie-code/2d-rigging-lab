export type LocalPreviewLiveRenderSuspensionTimers = {
  readonly setTimeout: (
    callback: () => void,
    delayMs: number
  ) => LocalPreviewLiveRenderSuspensionTimerHandle;
  readonly clearTimeout: (
    handle: LocalPreviewLiveRenderSuspensionTimerHandle
  ) => void;
};

export type LocalPreviewLiveRenderSuspensionTimerHandle =
  | number
  | ReturnType<typeof globalThis.setTimeout>;

export type LocalPreviewLiveRenderSuspensionState = {
  readonly connectedClientCount: number;
  readonly suspended: boolean;
  readonly resumePending: boolean;
};

export type LocalPreviewLiveRenderSuspensionPolicyOptions = {
  readonly resumeGraceMs?: number;
  readonly timers?: LocalPreviewLiveRenderSuspensionTimers;
  readonly onStateChanged?: (
    state: LocalPreviewLiveRenderSuspensionState
  ) => void;
};

const DEFAULT_RESUME_GRACE_MS = 2000;

export class LocalPreviewLiveRenderSuspensionPolicy {
  readonly #resumeGraceMs: number;
  readonly #timers: LocalPreviewLiveRenderSuspensionTimers;
  readonly #onStateChanged:
    | ((state: LocalPreviewLiveRenderSuspensionState) => void)
    | undefined;
  #connectedClientCount = 0;
  #suspended = false;
  #resumeTimer: LocalPreviewLiveRenderSuspensionTimerHandle | null = null;

  constructor(options: LocalPreviewLiveRenderSuspensionPolicyOptions = {}) {
    this.#resumeGraceMs = options.resumeGraceMs ?? DEFAULT_RESUME_GRACE_MS;
    this.#timers = options.timers ?? defaultTimers;
    this.#onStateChanged = options.onStateChanged;
  }

  getState(): LocalPreviewLiveRenderSuspensionState {
    return this.#createState();
  }

  isSuspended(): boolean {
    return this.#suspended;
  }

  updateConnectedClientCount(connectedClientCount: number): void {
    this.#connectedClientCount = Math.max(0, connectedClientCount);

    if (this.#connectedClientCount > 0) {
      this.#cancelPendingResume();
      if (!this.#suspended) {
        this.#suspended = true;
        this.#emitStateChanged();
      }
      return;
    }

    if (!this.#suspended || this.#resumeTimer !== null) {
      return;
    }

    this.#resumeTimer = this.#timers.setTimeout(() => {
      this.#resumeTimer = null;
      if (this.#connectedClientCount > 0 || !this.#suspended) {
        return;
      }

      this.#suspended = false;
      this.#emitStateChanged();
    }, this.#resumeGraceMs);
    this.#emitStateChanged();
  }

  dispose(): void {
    this.#cancelPendingResume();
  }

  #cancelPendingResume(): void {
    if (this.#resumeTimer === null) {
      return;
    }

    this.#timers.clearTimeout(this.#resumeTimer);
    this.#resumeTimer = null;
    this.#emitStateChanged();
  }

  #emitStateChanged(): void {
    this.#onStateChanged?.(this.#createState());
  }

  #createState(): LocalPreviewLiveRenderSuspensionState {
    return {
      connectedClientCount: this.#connectedClientCount,
      suspended: this.#suspended,
      resumePending: this.#resumeTimer !== null
    };
  }
}

const defaultTimers: LocalPreviewLiveRenderSuspensionTimers = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  }
};
