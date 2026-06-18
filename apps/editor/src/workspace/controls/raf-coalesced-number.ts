import { recordLive2dPerformanceCounter } from "@private-2d-rigging-lab/render-core";
import { useCallback, useEffect, useRef } from "react";

export interface RafCoalescedNumberCommitOptions {
  readonly counterPrefix: string;
  readonly onCommit: (value: number) => void;
}

export interface RafCoalescedNumberCommit {
  readonly cancel: () => void;
  readonly flush: () => void;
  readonly schedule: (value: number) => void;
}

export function useRafCoalescedNumberCommit({
  counterPrefix,
  onCommit
}: RafCoalescedNumberCommitOptions): RafCoalescedNumberCommit {
  const onCommitRef = useRef(onCommit);
  const pendingValueRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrameIfAvailable(frameIdRef.current);
      frameIdRef.current = null;
    }
    pendingValueRef.current = null;
  }, []);

  const commitPending = useCallback(() => {
    const pendingValue = pendingValueRef.current;
    if (pendingValue === null) {
      return;
    }

    pendingValueRef.current = null;
    recordLive2dPerformanceCounter(`${counterPrefix}.appliedFrames`);
    onCommitRef.current(pendingValue);
  }, [counterPrefix]);

  const flush = useCallback(() => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrameIfAvailable(frameIdRef.current);
      frameIdRef.current = null;
    }
    commitPending();
  }, [commitPending]);

  const schedule = useCallback(
    (value: number) => {
      recordLive2dPerformanceCounter(`${counterPrefix}.rawEvents`);
      pendingValueRef.current = value;

      if (frameIdRef.current !== null) {
        recordLive2dPerformanceCounter(`${counterPrefix}.coalescedUpdates`);
        return;
      }

      frameIdRef.current = requestAnimationFrameIfAvailable(() => {
        frameIdRef.current = null;
        commitPending();
      });
    },
    [commitPending, counterPrefix]
  );

  useEffect(() => cancel, [cancel]);

  return {
    cancel,
    flush,
    schedule
  };
}

function requestAnimationFrameIfAvailable(callback: () => void): number | null {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }

  callback();
  return null;
}

function cancelAnimationFrameIfAvailable(frameId: number): void {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(frameId);
  }
}
