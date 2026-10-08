// @ts-check
/**
 * 声の器官 実機疎通 preflight（S6 Domain A・機械テストではない）— apps/soul/agent。
 * **自分で合成した短い小音量 WAV だけを鳴らす**（鉄の規律: 実マイク音声・録音物は使わない）。
 *
 *   小音量サイン波 WAV を temp に合成（数百ms・振幅≈8%）
 *     → createAudioPlayer()（既定デバイス・実 WinRT MediaPlayer 常駐 PowerShell）
 *     → ① 既定デバイス再生: PLAY → STARTED → 自然完了 ENDED を観測（再生実区間の追跡）
 *     → ② STOP による途中停止: 長め WAV を PLAY → 再生途中で STOP → STOPPED（誤 ENDED なし）・isPlaying false
 *     → ③ listAudioDevices(): アクティブな出力デバイスを列挙（{ id, name }）
 *     → プレイヤー dispose・合成 WAV を必ず削除（temp ディレクトリごと rm）
 *
 * **音は短く小さく**（振幅≈8%・300ms/800ms）。合成 WAV は temp のみ・終了時に必ず消す。実 SDK は使わない。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-voice.mjs
 *   exit 0 = PASS / exit 1 = 失敗。標準出力に RESULT: PASS / EXIT=0 を出す。
 *
 * 注意: 実 WinRT MediaPlayer を叩くため実際にスピーカーから小さく音が鳴る。既定デバイスに向く
 * （env SOUL_AUDIO_DEVICE_NAME 未指定＝S1 挙動）。デバイス指定経路そのものは列挙（③）で疎通を確認する。
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAudioPlayer, listAudioDevices } from "../src/voice/audio-player.mjs";

const log = (msg) => process.stdout.write(`[preflight-voice] ${msg}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 小音量サイン波 WAV（44100Hz mono 16bit）を組む。amp は 16bit フルスケールの ≈8%。 */
function buildSineWav(ms, { sampleRate = 44100, freq = 440, amp = 2600 } = {}) {
  const n = Math.round((sampleRate * ms) / 1000);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i += 1) {
    const s = Math.round(amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    data.writeInt16LE(s, i * 2);
  }
  const buf = Buffer.alloc(44 + data.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  return buf;
}

/** onOutput 行が cond を満たすまで待つ（実プロセス往復の非同期を吸収・有界）。 */
function waitForLine(lines, cond, timeoutMs, label) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond(lines)) return resolve(undefined);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`timed out waiting for ${label}; got ${JSON.stringify(lines)}`));
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

  const dir = mkdtempSync(path.join(tmpdir(), "voice-preflight-"));
  const shortWav = path.join(dir, "short.wav");
  const longWav = path.join(dir, "long.wav");
  writeFileSync(shortWav, buildSineWav(300));
  writeFileSync(longWav, buildSineWav(800));

  /** @type {ReturnType<typeof createAudioPlayer> | null} */
  let player = null;
  const outLines = [];
  const errLines = [];

  try {
    player = createAudioPlayer({
      onOutput: (line) => outLines.push(line),
      onError: (line) => errLines.push(line)
    });

    // ── ① 既定デバイス再生 → STARTED → 自然完了 ENDED ────────────────────────
    log("① 既定デバイス再生（短 WAV 300ms）");
    const t1 = Date.now();
    player.play(shortWav);
    await waitForLine(outLines, (ls) => ls.some((l) => l.startsWith("STARTED")), 8000, "STARTED(short)");
    log(`  STARTED 観測 (spawn+WinRT ロード込み ${Date.now() - t1}ms)`);
    const t2 = Date.now();
    await waitForLine(outLines, (ls) => ls.some((l) => l.startsWith("ENDED")), 8000, "ENDED(short)");
    const endedMs = Date.now() - t2;
    log(`  ENDED 観測（自然完了検出・STARTED から ${endedMs}ms）isPlaying=${player.isPlaying()}`);
    if (player.isPlaying() !== false) fail("自然完了後 isPlaying が false でない");

    // ── ② STOP による途中停止（長 WAV を再生途中で止める）─────────────────────
    log("② STOP 途中停止（長 WAV 800ms・250ms で STOP）");
    outLines.length = 0;
    player.play(longWav);
    await waitForLine(outLines, (ls) => ls.some((l) => l.startsWith("STARTED")), 8000, "STARTED(long)");
    await sleep(250); // 800ms の再生途中。
    const midPlaying = player.isPlaying();
    player.stop();
    await waitForLine(outLines, (ls) => ls.some((l) => l.startsWith("STOPPED")), 8000, "STOPPED(long)");
    await sleep(300); // STOP 後に誤 ENDED が来ないことを確認する猶予。
    const sawEnded = outLines.some((l) => l.startsWith("ENDED"));
    log(
      `  停止応答: ${JSON.stringify(outLines)} midPlaying=${midPlaying} 誤ENDED=${sawEnded} isPlaying=${player.isPlaying()}`
    );
    if (midPlaying !== true) fail("STOP 前に isPlaying が true でない（再生していない？）");
    if (sawEnded) fail("STOP で止めたのに ENDED（自然完了）が誤発火した");
    if (player.isPlaying() !== false) fail("STOP 後 isPlaying が false でない");

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
    // 合成 WAV を temp ディレクトリごと必ず削除（検証音をディスクに残さない）。
    try {
      rmSync(dir, { recursive: true, force: true });
      log("合成 WAV を削除（temp ディレクトリごと rm）");
    } catch (rmError) {
      log(`WARN: WAV 削除に失敗: ${rmError instanceof Error ? rmError.message : String(rmError)}`);
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
