import { afterEach, describe, expect, it, vi } from "vitest";

import { stagePngCaptureBridgeChannels } from "../../preload/stage-png-capture-bridge-channels";
import {
  StagePngCaptureRequestBroker,
  type StagePngCaptureTargetWebContents
} from "./stage-png-capture-request-broker";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01
]);

afterEach(() => {
  vi.useRealTimers();
});

describe("StagePngCaptureRequestBroker", () => {
  it("sends an id-tagged request and resolves with the matching answer", async () => {
    const broker = createBroker();
    const webContents = createWebContents(7);

    const pending = broker.request(webContents);

    expect(webContents.send).toHaveBeenCalledWith(
      stagePngCaptureBridgeChannels.captureRequested,
      { requestId: "request_1" }
    );
    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes
    });

    await expect(pending).resolves.toBe(pngBytes);
    expect(broker.getPendingRequestCount()).toBe(0);
  });

  it("keeps two requests apart by id", async () => {
    const broker = createBroker();
    const webContents = createWebContents(7);
    const first = broker.request(webContents);
    const second = broker.request(webContents);
    const secondBytes = new Uint8Array([...pngBytes, 0x02]);

    broker.handleReport({ id: 7 }, {
      requestId: "request_2",
      result: "ok",
      pngBytes: secondBytes
    });
    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes
    });

    await expect(first).resolves.toBe(pngBytes);
    await expect(second).resolves.toBe(secondBytes);
  });

  it("ignores answers from another webContents and unknown ids", () => {
    const broker = createBroker();
    void broker.request(createWebContents(7));

    broker.handleReport({ id: 8 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes
    });
    broker.handleReport({ id: 7 }, {
      requestId: "request_unknown",
      result: "ok",
      pngBytes
    });
    broker.handleReport({ id: 7 }, null);

    expect(broker.getPendingRequestCount()).toBe(1);
  });

  it("fails with the Stage's message when the Stage reports an error", async () => {
    const broker = createBroker();
    const pending = broker.request(createWebContents(7));

    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "error",
      message: "Stage renderer is unavailable."
    });

    await expect(pending).rejects.toThrow("Stage renderer is unavailable.");
  });

  it("rejects bytes that are not a PNG", async () => {
    const broker = createBroker();
    const pending = broker.request(createWebContents(7));

    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes: new Uint8Array([1, 2, 3])
    });

    await expect(pending).rejects.toThrow("not a PNG");
  });

  it("times out when the Stage never answers, and drops a late answer", async () => {
    vi.useFakeTimers();
    const broker = createBroker({ timeoutMs: 500 });
    const pending = broker.request(createWebContents(7));
    const settled = pending.then(
      () => "resolved",
      (error: unknown) => (error as Error).message
    );

    await vi.advanceTimersByTimeAsync(500);

    await expect(settled).resolves.toBe("Stage Window did not answer in time.");
    expect(broker.getPendingRequestCount()).toBe(0);
    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes
    });
    expect(broker.getPendingRequestCount()).toBe(0);
  });

  it("fails at once when the Stage Window is destroyed mid-capture", async () => {
    vi.useFakeTimers();
    const broker = createBroker({ timeoutMs: 10_000 });
    const webContents = createWebContents(7);
    const pending = broker.request(webContents);
    const settled = pending.then(
      () => "resolved",
      (error: unknown) => (error as Error).message
    );

    webContents.destroy();

    await expect(settled).resolves.toBe(
      "Stage Window closed before the capture finished."
    );
    expect(broker.getPendingRequestCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses without sending when the Stage webContents is already destroyed", async () => {
    const broker = createBroker();
    const webContents = createWebContents(7, { destroyed: true });

    await expect(broker.request(webContents)).rejects.toThrow(
      "Stage Window is not available."
    );
    expect(webContents.send).not.toHaveBeenCalled();
    expect(broker.getPendingRequestCount()).toBe(0);
  });

  it("stops listening for destroyed once a request settles", async () => {
    const broker = createBroker();
    const webContents = createWebContents(7);
    const pending = broker.request(webContents);

    expect(webContents.getDestroyedListenerCount()).toBe(1);
    broker.handleReport({ id: 7 }, {
      requestId: "request_1",
      result: "ok",
      pngBytes
    });
    await pending;

    expect(webContents.getDestroyedListenerCount()).toBe(0);
  });

  it("fails at once when the request cannot be sent", async () => {
    const broker = createBroker();
    const webContents = createWebContents(7);
    webContents.send.mockImplementation(() => {
      throw new Error("Render frame was disposed.");
    });

    await expect(broker.request(webContents)).rejects.toThrow(
      "Stage Window could not be asked: Render frame was disposed."
    );
    expect(broker.getPendingRequestCount()).toBe(0);
  });
});

function createBroker(options: { readonly timeoutMs?: number } = {}) {
  let sequence = 0;

  return new StagePngCaptureRequestBroker({
    timeoutMs: options.timeoutMs ?? 1_000,
    createRequestId: () => {
      sequence += 1;
      return `request_${sequence}`;
    }
  });
}

function createWebContents(id: number, options: { readonly destroyed?: boolean } = {}) {
  const destroyedListeners = new Set<() => void>();

  return {
    id,
    isDestroyed: vi.fn(() => options.destroyed ?? false),
    send: vi.fn<StagePngCaptureTargetWebContents["send"]>(),
    once: vi.fn((_event: "destroyed", listener: () => void) => {
      destroyedListeners.add(listener);
    }),
    removeListener: vi.fn((_event: "destroyed", listener: () => void) => {
      destroyedListeners.delete(listener);
    }),
    destroy: () => {
      for (const listener of [...destroyedListeners]) {
        destroyedListeners.delete(listener);
        listener();
      }
    },
    getDestroyedListenerCount: () => destroyedListeners.size
  };
}
