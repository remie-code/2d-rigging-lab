import { createHaasWorker } from "./haas-worker-client.mjs";
import { resolveHaasFiles } from "./local-stt-engines.mjs";
import { createLocalSttClient, planAudioTagging } from "./local-stt-client.mjs";
import { shouldTagTranscript } from "./audio-tagging.mjs";

/** Adapt the native Haas worker and the existing isolated CED worker to the ear's local STT contract. */
export function createHaasLocalSttClient(options) {
  const { files } = resolveHaasFiles(options.haasDir);
  const start = performance.now();
  let disposed = false;
  let exited = false;
  let loaded = false;
  let haas;
  let tagger;

  function fail(info) {
    if (exited || disposed) return;
    exited = true;
    haas?.dispose();
    tagger?.dispose();
    if (loaded) options.onExit?.(info);
  }

  const ready = (async () => {
    haas = createHaasWorker({
      executable: files.executable,
      model: files.model,
      device: options.haasDevice,
      timeoutMs: options.readyTimeoutMs,
      spawnImpl: options.haasSpawnImpl,
      onExit: fail
    });
    const tagPlan = planAudioTagging(options);
    if (tagPlan.init) {
      tagger = createLocalSttClient({ ...options, engine: "haas", onReady: undefined, onExit: fail });
    }
    const [, taggingInfo] = await Promise.all([haas.ready, tagger?.ready]);
    if (disposed || exited) throw new Error("Haas-ja is not available");
    const info = {
      loadMs: Math.round(performance.now() - start),
      decodingMethod: "greedy",
      hotwordsUsed: [],
      hotwordsDropped: [],
      audioTagging: taggingInfo?.audioTagging ?? { enabled: false, reason: tagPlan.reason }
    };
    loaded = true;
    options.onReady?.(info);
    return info;
  })().catch((error) => {
    fail({ code: null, signal: null });
    throw error;
  });
  ready.catch(() => {});

  return {
    ready,
    async transcribe(wavBytes) {
      const info = await ready;
      if (disposed || exited) throw new Error("Haas-ja is not available");
      const t0 = performance.now();
      const text = await haas.transcribe(wavBytes);
      const ms = Math.round(performance.now() - t0);
      if (info.audioTagging.enabled && shouldTagTranscript(text, options.audioTaggingMaxChars)) {
        const tag = await tagger.transcribe(wavBytes, text);
        return { ...tag, ms };
      }
      return { text, rawText: text, ms, tagged: false, speech: null, tagMs: null };
    },
    hasExited: () => exited,
    isDisposed: () => disposed,
    dispose() {
      if (disposed) return;
      disposed = true;
      haas?.dispose();
      tagger?.dispose();
    }
  };
}

/** One worker per group of live ears. Each ear has a disposable lease and receives only its own responses. */
export function createHaasSttPool(createClient = createHaasLocalSttClient) {
  let current;

  return function acquire(options) {
    if (!current) {
      const listeners = new Set();
      const client = createClient({
        ...options,
        onReady: undefined,
        onExit(info) {
          for (const listener of listeners) {
            try {
              listener(info);
            } catch {
              // One ear's diagnostics must not prevent the other ears from going down.
            }
          }
        }
      });
      current = { client, listeners, jobs: [], active: null };
    }
    const group = current;
    const onExit = (info) => options.onExit?.(info);
    group.listeners.add(onExit);
    let disposed = false;
    const jobs = new Set();
    const ready = group.client.ready.then((info) => {
      if (disposed || group.client.hasExited()) throw new Error("Haas-ja is not available");
      options.onReady?.(info);
      return info;
    });
    ready.catch(() => {});

    function runNext() {
      if (group.active || group.jobs.length === 0) return;
      const job = group.jobs.shift();
      group.active = job;
      group.client.transcribe(job.wavBytes).then(job.resolve, job.reject).finally(() => {
        job.jobs.delete(job);
        group.active = null;
        runNext();
      });
    }

    return {
      ready,
      async transcribe(wavBytes) {
        await ready;
        if (disposed) throw new Error("Haas-ja ear disposed");
        return new Promise((resolve, reject) => {
          const job = { wavBytes, resolve, reject, jobs };
          jobs.add(job);
          group.jobs.push(job);
          runNext();
        });
      },
      hasExited: () => group.client.hasExited(),
      isDisposed: () => disposed,
      dispose() {
        if (disposed) return;
        disposed = true;
        group.listeners.delete(onExit);
        for (const job of jobs) job.reject(new Error("Haas-ja ear disposed"));
        group.jobs = group.jobs.filter((job) => job.jobs !== jobs);
        jobs.clear();
        if (group.listeners.size === 0) {
          current = undefined;
          group.client.dispose();
        }
      }
    };
  };
}
