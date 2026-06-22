type TimerHandle = unknown;

export type RuntimePlayerInputDiagnosticsThrottleOptions = {
  readonly minimumIntervalMs?: number;
  readonly emit: () => void;
  readonly nowMs?: () => number;
  readonly setTimeoutFn?: (
    callback: () => void,
    delayMs: number
  ) => TimerHandle;
  readonly clearTimeoutFn?: (handle: TimerHandle) => void;
};

export class RuntimePlayerInputDiagnosticsThrottle {
  private readonly minimumIntervalMs: number;
  private readonly emit: () => void;
  private readonly nowMs: () => number;
  private readonly setTimeoutFn: (
    callback: () => void,
    delayMs: number
  ) => TimerHandle;
  private readonly clearTimeoutFn: (handle: TimerHandle) => void;
  private lastEmittedAtMs: number | null = null;
  private pendingTimer: TimerHandle | null = null;

  constructor(options: RuntimePlayerInputDiagnosticsThrottleOptions) {
    this.minimumIntervalMs = options.minimumIntervalMs ?? 100;
    this.emit = options.emit;
    this.nowMs = options.nowMs ?? Date.now;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
  }

  request(): void {
    const nowMs = this.nowMs();

    if (
      this.lastEmittedAtMs === null ||
      nowMs - this.lastEmittedAtMs >= this.minimumIntervalMs
    ) {
      this.emitNow(nowMs);
      return;
    }

    if (this.pendingTimer !== null) {
      return;
    }

    const delayMs = this.minimumIntervalMs - (nowMs - this.lastEmittedAtMs);
    this.pendingTimer = this.setTimeoutFn(() => {
      this.pendingTimer = null;
      this.emitNow(this.nowMs());
    }, delayMs);
  }

  flush(): void {
    if (this.pendingTimer !== null) {
      this.clearTimeoutFn(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.emitNow(this.nowMs());
  }

  cancel(): void {
    if (this.pendingTimer === null) {
      return;
    }

    this.clearTimeoutFn(this.pendingTimer);
    this.pendingTimer = null;
  }

  private emitNow(nowMs: number): void {
    this.lastEmittedAtMs = nowMs;
    this.emit();
  }
}
