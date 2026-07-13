// @ts-check
/**
 * 目の器官 実機疎通 preflight（S5 Domain A・機械検証の最終段）— apps/soul/agent。
 * **自分で起動したウインドウ（メモ帳）だけを撮る**（鉄の規律: 撮ってよいのは自分で起動した窓のみ）。
 *
 *   notepad.exe を起動（一意なタイトルになるよう一時ファイルを開く）
 *     → listWindows() で一覧に現れることを確認（列挙の実機疎通）
 *     → captureWindow(title) で実 PrintWindow キャプチャ
 *     → jpegBase64 が非自明なサイズ・width/height が妥当な寸法であることを検証
 *     → 起動したメモ帳を必ず閉じる（taskkill）
 *
 * **画像は一切ディスクに書かない**（jpegBase64 はメモリ上の変数に留め、ファイルへ書き出さない。
 * ログにも先頭数十文字しか出さない）。開いた一時テキストファイルは検証用の空ファイルで、画像ではない
 * ため書き出して構わない（メモ帳のタイトルを一意化する目的のみ）。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-eyes.mjs
 *   exit 0 = PASS / exit 1 = 失敗。標準出力に RESULT: PASS / EXIT=0 を出す。
 *
 * 注意（棚卸し §3-2 の既知リスク）: PrintWindow は Win11 新メモ帳（composited描画）の本文まで撮れた
 * 実績があるが、GPU スワップチェーンで描く実ゲーム窓が撮れるかは未検証・高リスク（人間ゲートの領分）。
 * この preflight は「機構が動く」ことの確認に留まり、実ゲームでの成功を保証しない。
 */

import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { captureWindow } from "../src/eyes/window-capture.mjs";
import { listWindows } from "../src/eyes/window-list.mjs";

const log = (msg) => process.stdout.write(`[preflight-eyes] ${msg}\n`);

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let failed = false;
  const fail = (msg) => {
    log(`FAIL: ${msg}`);
    failed = true;
  };

  // タイトルを一意化するため一時テキストファイルを開く（メモ帳のタイトルバーにファイル名が乗る）。
  const marker = `eyes-preflight-${Date.now()}`;
  const tmpFile = path.join(os.tmpdir(), `${marker}.txt`);
  fs.writeFileSync(tmpFile, "preflight-eyes marker file (not an image; safe to write)\n", "utf8");

  /** @type {import("node:child_process").ChildProcess | null} */
  let notepad = null;
  let notepadTitle = "";
  // 実機観測（本 preflight で確認済み）: notepad.exe を spawn した ChildProcess.pid と、
  // listWindows() が返す実際のウインドウ所有プロセスの pid は一致しないことがある
  // （Win11 のメモ帳起動委譲によるものと推測）。後始末は listWindows で見つけた実 pid を優先し、
  // spawn 側 pid にも念のため taskkill を打つ（存在しなければ黙って失敗するだけで無害）。
  /** @type {number | null} */
  let windowOwnerPid = null;

  try {
    log(`notepad.exe 起動: ${tmpFile}`);
    notepad = spawn("notepad.exe", [tmpFile], { stdio: "ignore" });
    if (typeof notepad.unref === "function") notepad.unref();

    // 起動直後はウインドウがまだ無いことがあるため、列挙にタイトルが現れるまで有界待ち。
    const expectedTitleFragment = `${marker}.txt`;
    const deadline = Date.now() + 15000;
    /** @type {{ pid: number; processName: string; title: string } | null} */
    let found = null;
    while (Date.now() < deadline) {
      const listed = await listWindows();
      if ("error" in listed) {
        fail(`listWindows failed while polling for notepad: ${JSON.stringify(listed.error)}`);
        break;
      }
      found = listed.windows.find((w) => w.title.includes(expectedTitleFragment)) ?? null;
      if (found) break;
      await sleep(300);
    }

    if (!found) {
      fail(`notepad window not found in listWindows() within timeout (looked for "${expectedTitleFragment}")`);
    } else {
      notepadTitle = found.title;
      windowOwnerPid = found.pid;
      log(`listWindows() にメモ帳窓を確認: pid=${found.pid} title="${found.title}"`);

      const captured = await captureWindow(notepadTitle);
      if ("error" in captured) {
        fail(`captureWindow failed: ${JSON.stringify(captured.error)}`);
      } else {
        const { jpegBase64, width, height, elapsedMs } = captured;
        const approxBytes = Math.floor((jpegBase64.length * 3) / 4);
        log(
          `captureWindow OK: width=${width} height=${height} elapsedMs=${elapsedMs} ` +
            `base64Len=${jpegBase64.length} (~${approxBytes} bytes) prefix="${jpegBase64.slice(0, 24)}..."`
        );
        if (width <= 0 || height <= 0) fail(`implausible dimensions: ${width}x${height}`);
        if (jpegBase64.length < 1000) fail(`jpegBase64 implausibly small: ${jpegBase64.length} chars`);
        // JPEG SOI マーカー（base64 で先頭 "/9j/"）であることの緩い確認（デコードはしない＝ディスク非書き込み厳守）。
        if (!jpegBase64.startsWith("/9j/")) {
          log(`WARN: base64 does not start with JPEG SOI marker "/9j/" (got "${jpegBase64.slice(0, 8)}")`);
        }
      }
    }

    log(failed ? "RESULT: FAIL" : "RESULT: PASS (listWindows + captureWindow 実機疎通・画像はディスク非書き込み)");
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    // 後始末: 起動したメモ帳を必ず閉じる。spawn 側 pid と実ウインドウ所有 pid の両方に taskkill を
    // 打つ（片方が既に存在しない/無関係でも taskkill が失敗するだけで無害・kill 漏れを防ぐ側に倒す）。
    const pidsToKill = new Set(
      [windowOwnerPid, notepad?.pid].filter((pid) => typeof pid === "number" && pid > 0)
    );
    for (const pid of pidsToKill) {
      try {
        await new Promise((resolve) => {
          execFile("taskkill", ["/PID", String(pid), "/F", "/T"], () => resolve(undefined));
        });
        log(`notepad (pid=${pid}) を後始末（taskkill）`);
      } catch (killError) {
        log(`WARN: pid=${pid} の後始末に失敗: ${killError instanceof Error ? killError.message : String(killError)}`);
      }
    }
    if (pidsToKill.size === 0) {
      log("WARN: 後始末対象の pid が無い（notepad が起動していなかった可能性）");
    }
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort
    }
  }
  log(`EXIT=${failed ? 1 : 0}`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-eyes] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
