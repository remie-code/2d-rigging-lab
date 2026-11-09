import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readWavPcm } from "../src/voice/wav-pcm.mjs";

// speech.cpp v0.10.1 protocol 4. The child only receives in-memory PCM over stdio.
export function createHaasExperimentWorker({
  executable, model, device, timeoutMs = 120_000, spawnImpl = spawn
}) {
  const child = spawnImpl(executable, ["worker", model, ...(device ? ["--device", device] : [])], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });
  child.stderr.setEncoding("utf8");
  let stderrTail = "";
  child.stderr.on("data", (text) => { stderrTail = (stderrTail + text).slice(-2000); });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const { promise: ready, resolve: setReady, reject: rejectReady } = Promise.withResolvers();
  ready.catch(() => {});
  let loaded = false;
  let closed = false;
  let nextId = 0;
  let pending;
  const startupTimer = setTimeout(() => stop(new Error("Haas worker startup timed out")), timeoutMs);

  function stop(error = new Error("Haas worker closed")) {
    if (closed) return;
    closed = true;
    clearTimeout(startupTimer);
    rejectReady(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
    lines.close();
    child.stdin.destroy();
    child.kill();
  }

  child.on("error", stop);
  child.stdin.on("error", stop);
  child.on("exit", (code, signal) => {
    const startupDetail = loaded ? "" : `: ${stderrTail.trim()}`;
    stop(new Error(`Haas worker exited (${code ?? signal})${startupDetail}`));
  });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      stop(new Error("Haas worker returned invalid JSON"));
      return;
    }
    if (message?.type === "ready" && !loaded && message.protocol === 4) {
      loaded = true;
      clearTimeout(startupTimer);
      setReady(message);
      return;
    }
    if (!loaded) {
      stop(new Error(message?.type === "fatal"
        ? `Haas worker could not start: ${message.error?.message ?? "unknown error"}`
        : "Haas worker did not report protocol 4 readiness"));
      return;
    }
    if (!pending || message?.id !== pending.id || message.type === "progress") return;
    const request = pending;
    pending = undefined;
    clearTimeout(request.timer);
    if (message.type === "end" && typeof message.text === "string" && message.stop === "complete") {
      request.resolve(message.text.trim());
    } else {
      // Error bodies can include user input. Record only the protocol code.
      request.reject(new Error(`Haas request failed: ${message.error?.code ?? message.stop ?? message.type}`));
    }
  });

  async function transcribe(wavBytes) {
    await ready;
    if (closed || pending) throw new Error("Haas worker unavailable");
    const { pcm, sampleRate, channels } = readWavPcm(wavBytes);
    if (sampleRate !== 16000 || channels !== 1) throw new Error("Haas experiment needs 16 kHz mono PCM16 WAV");
    const id = String(++nextId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop(new Error("Haas request timed out")), timeoutMs);
      pending = { id, resolve, reject, timer };
      const chunk = JSON.stringify({ type: "chunk", id, seq: 0, pcm: Buffer.from(pcm).toString("base64") });
      const request = JSON.stringify({ type: "transcribe", id, sample_rate: sampleRate });
      child.stdin.write(`${chunk}\n${request}\n`);
    });
  }

  return { ready, transcribe, dispose: () => stop() };
}
