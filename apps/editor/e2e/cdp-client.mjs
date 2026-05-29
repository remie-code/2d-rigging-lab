export class CdpClient {
  static async connect(webSocketUrl) {
    if (typeof WebSocket === "undefined") {
      throw new Error("This e2e smoke requires a Node.js runtime with global WebSocket support.");
    }

    const socket = new WebSocket(webSocketUrl);
    const client = new CdpClient(socket);

    await client.opened;

    return client;
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.opened = new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => this.rejectPending(new Error("CDP websocket closed.")));
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }

  handleMessage(event) {
    const message = JSON.parse(String(event.data));

    if (message.id === undefined) {
      this.resolveEventWaiters(message.method, message.params);
      return;
    }

    const pending = this.pending.get(message.id);
    if (pending === undefined) {
      return;
    }

    this.pending.delete(message.id);

    if (message.error !== undefined) {
      pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
      return;
    }

    pending.resolve(message.result);
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }

    this.pending.clear();

    for (const waiters of this.eventWaiters.values()) {
      for (const waiter of waiters) {
        waiter.reject(error);
      }
    }

    this.eventWaiters.clear();
  }

  waitForEvent(method, timeoutMs = 5_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.eventWaiters.get(method)?.filter((waiter) => waiter.reject !== reject);
        if (waiters === undefined || waiters.length === 0) {
          this.eventWaiters.delete(method);
        } else {
          this.eventWaiters.set(method, waiters);
        }
        reject(new Error(`Timed out waiting for CDP event ${method}.`));
      }, timeoutMs);
      const waiter = {
        resolve: (params) => {
          clearTimeout(timeout);
          resolve(params);
        },
        reject
      };
      this.eventWaiters.set(method, [...(this.eventWaiters.get(method) ?? []), waiter]);
    });
  }

  resolveEventWaiters(method, params) {
    if (method === undefined) {
      return;
    }

    const waiters = this.eventWaiters.get(method);
    if (waiters === undefined) {
      return;
    }

    this.eventWaiters.delete(method);
    for (const waiter of waiters) {
      waiter.resolve(params);
    }
  }
}
