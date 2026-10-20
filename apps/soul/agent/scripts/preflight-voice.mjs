// @ts-check
/**
 * 声の器官 実機疎通 preflight（S6 Domain A → 声の差し替え Wave 2 で流し込みプレイヤーへ）— apps/soul/agent。
 * 機械テストではない。**自分で合成した短い小音量サイン波だけを鳴らす**（鉄の規律: 実マイク音声・録音物は使わない）。
 *
 *   小音量サイン波の PCM をメモリ上で合成（数百ms・振幅≈8%・ファイルには書かない）
 *     → createStreamPlayer()（既定デバイス・常駐 PowerShell + C# の WASAPI 再生器）
 *     → ① 既定デバイス再生: OPEN → DATA → END → STARTED → 自然完了 ENDED を観測
 *     → ② STOP による途中停止: 長めの PCM を流し、再生途中で STOP → STOPPED（誤 ENDED なし）
 *     → ③ listAudioDevices(): アクティブな出力デバイスを列挙（{ id, name }）
 *     → プレイヤー dispose
 *
 * **音は短く小さく**（振幅≈8%・300ms/800ms）。実 SDK は使わない。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-voice.mjs
 *   exit 0 = PASS / exit 1 = 失敗。標準出力に RESULT: PASS / EXIT=0 を出す。
 *
 * 注意: 実 WASAPI を叩くため実際にスピーカーから小さく音が鳴る。既定デバイスに向く
 * （env SOUL_AUDIO_DEVICE_NAME 未指定）。デバイス指定経路そのものは列挙（③）で疎通を確認する。
 */

import { createStreamPlayer } from "../src/voice/stream-player.mjs";
import { listAudioDevices } from "../src/voice/audio-devices.mjs";

const log = (msg) => process.stdout.write(`[preflight-voice] ${msg}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SAMPLE_RATE = 24000;

/** 小音量サイン波の PCM16LE（mono）を組む。amp は 16bit フルスケールの ≈8%。 */
function buildSinePcm(ms, { sampleRate = SAMPLE_RATE, freq = 440, amp = 2600 } = {}) {
  const n = Math.round((sampleRate * ms) / 1000);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i += 1) {
    const s = Math.round(amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    data.writeInt16LE(s, i * 2);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** 事象が cond を満たすまで待つ（実プロセス往復の非同期を吸収・有界）。 */
function waitForEvent(events, cond, timeoutMs, label) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const hit = events.find(cond);
      if (hit) return resolve(hit);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`timed out waiting for ${label}; got ${JSON.stringify(events.map((e) => e.type))}`));
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

async function main() {
  let failed = false;
  const fail = (msg) => {
    log(`FAIL: ${msg}`);
    failed = true;
  };

  /** @type {ReturnType<typeof createStreamPlayer> | null} */
  let player = null;
  /** @type {any[]} */
  const events = [];
  const errLines = [];

  try {
    const t0 = Date.now();
    player = createStreamPlayer({
      onEvent: (event) => events.push(event),
      onError: (line) => errLines.push(line)
    });
    const ready = await player.whenReady();
    if (!ready) throw new Error("stream player did not become ready");
    log(`READY（spawn + C# コンパイル込み ${Date.now() - t0}ms）`);

    // ── ① 既定デバイス再生 → STARTED → 自然完了 ENDED ────────────────────────
    log("① 既定デバイス再生（300ms）");
    events.length = 0;
    const t1 = Date.now();
    player.open("preflight-short", { sampleRate: SAMPLE_RATE, channels: 1 });
    player.write("preflight-short", buildSinePcm(300));
    player.end("preflight-short");
    await waitForEvent(events, (e) => e.type === "started", 8000, "STARTED(short)");
    log(`  STARTED 観測（OPEN から ${Date.now() - t1}ms）`);
    const t2 = Date.now();
    await waitForEvent(events, (e) => e.type === "ended", 8000, "ENDED(short)");
    log(`  ENDED 観測（STARTED から ${Date.now() - t2}ms）current=${JSON.stringify(player.current())}`);
    if (player.current() !== null) fail("自然完了後も今の発話が残っている");

    // ── ② STOP による途中停止（長い音を再生途中で止める）─────────────────────
    log("② STOP 途中停止（800ms・250ms で STOP）");
    events.length = 0;
    player.open("preflight-long", { sampleRate: SAMPLE_RATE, channels: 1 });
    player.write("preflight-long", buildSinePcm(800));
    player.end("preflight-long");
    await waitForEvent(events, (e) => e.type === "started", 8000, "STARTED(long)");
    await sleep(250); // 800ms の再生途中。
    player.stop();
    await waitForEvent(events, (e) => e.type === "stopped", 8000, "STOPPED(long)");
    await sleep(300); // STOP 後に誤 ENDED が来ないことを確認する猶予。
    const sawEnded = events.some((e) => e.type === "ended");
    log(`  停止応答: ${JSON.stringify(events.map((e) => e.type))} 誤ENDED=${sawEnded}`);
    if (sawEnded) fail("STOP で止めたのに ENDED（自然完了）が誤発火した");

    // ── ③ listAudioDevices（列挙）──────────────────────────────────────────
    log("③ listAudioDevices() 列挙");
    const t3 = Date.now();
    const devices = await listAudioDevices();
    const listMs = Date.now() - t3;
    if ("error" in devices) {
      fail(`listAudioDevices error: ${JSON.stringify(devices.error)}`);
    } else {
      log(`  列挙 ${devices.devices.length} 件（${listMs}ms）:`);
      for (const d of devices.devices) {
        log(`    - ${d.name}`);
      }
      if (devices.devices.length === 0) fail("出力デバイスが 0 件（実機なら 1 件以上あるはず）");
      const bad = devices.devices.find((d) => typeof d.id !== "string" || typeof d.name !== "string");
      if (bad) fail(`列挙エントリの形が不正: ${JSON.stringify(bad)}`);
    }

    if (errLines.length > 0) log(`  (stderr 観測: ${JSON.stringify(errLines)})`);
    log(failed ? "RESULT: FAIL" : "RESULT: PASS（既定再生 + 自然完了検出 + STOP 途中停止 + 列挙 の実機疎通）");
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    try {
      player?.dispose();
    } catch {
      // best-effort
    }
  }
  log(`EXIT=${failed ? 1 : 0}`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-voice] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
