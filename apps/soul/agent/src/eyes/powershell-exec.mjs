// @ts-check
/**
 * PowerShell 1 プロセス完結実行の共通層（S5 Domain A・目の器官の土台）— apps/soul/agent。
 *
 * `window-capture.mjs`（PrintWindow キャプチャ）と `window-list.mjs`（ウインドウ列挙）は、どちらも
 * 「powershell.exe をタイムアウト付きで 1 回起動し、stdout/stderr を集めて終了を待つ」という同じ骨格を
 * 必要とする。ここではその骨格だけを純部品として切り出し、スクリプト文字列の組み立て・stdout の解釈は
 * 呼び出し側（各器官）の責務として残す（ffmpeg-capture.mjs の spawnImpl 注入パターンと同型）。
 *
 * ── 契約 ─────────────────────────────────────────────────────────────
 *  runPowerShellScript(scriptText, options) は **throw しない**。結果は必ず
 *    - 正常終了: { timedOut:false, code, stdout, stderr, elapsedMs }
 *    - タイムアウト: { timedOut:true, elapsedMs }
 *  のどちらか（spawn 自体が失敗した場合も code:null + stderr にメッセージを積んで正常終了扱いに寄せ、
 *  呼び出し側が stdout 解析結果と合わせて構造化エラーに変換する）。
 *
 * ── 終了処理（S1 ハング教訓・s1-followup §8 の作法を踏襲）───────────────────
 *  タイムアウト・正常終了いずれの経路でも kill → stdio destroy → unref を一度だけ実行する。
 *  タイマ・時計は注入可能（テストで実時間を待たない）。
 */

import { spawn } from "node:child_process";

export const DEFAULT_POWERSHELL_PATH = "powershell.exe";

/**
 * powershell.exe への起動引数を組む純関数（spawn せずにテストできる）。
 * -NoProfile/-NonInteractive/-NoLogo でプロファイル読み込み・対話待ちを排し、
 * -ExecutionPolicy Bypass はこのプロセス限りの実行ポリシー上書き（システム設定は不変）。
 *
 * @param {string} scriptText PowerShell スクリプト全文（呼び出し側が組み立てる）。
 * @returns {string[]}
 */
export function buildPowerShellInvocationArgs(scriptText) {
  return ["-NoProfile", "-NonInteractive", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", scriptText];
}

/**
 * PowerShell の標準出力エンコーディングを BOM 無し UTF-8 に固定する前置き行。
 * Windows PowerShell 5.1 は既定でコンソールのコードページ（日本語環境では通常 cp932 等・環境依存）を
 * 使ってリダイレクト先 stdout をエンコードするため、Node 側で `utf8` decode すると日本語（ウインドウ
 * タイトル等）が文字化けする（実機 preflight で実際に踏んだ地雷・`eyes-preflight-....txt - ??????` の
 * ように壊れて listWindows/captureWindow のタイトル完全一致が壊滅する）。全スクリプトの先頭に必ず
 * 差し込んで stdout を決定的な UTF-8 にする。
 */
const UTF8_OUTPUT_PRELUDE = "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)";

/**
 * スクリプト全文の先頭に UTF-8 出力前置きを差し込む純関数。
 * @param {string} scriptText
 * @returns {string}
 */
export function withUtf8OutputPrelude(scriptText) {
  return `${UTF8_OUTPUT_PRELUDE}\n${scriptText}`;
}

/**
 * powershell.exe を 1 回起動してスクリプトを実行し、stdout/stderr/終了コードを集める。
 *
 * @param {string} scriptText
 * @param {object} [options]
 * @param {string} [options.powershellPath]  既定 "powershell.exe"（PATH 解決）。
 * @param {number} [options.timeoutMs=5000]
 * @param {typeof spawn} [options.spawnImpl]        spawn の差し替え（テスト用）。
 * @param {() => number} [options.nowImpl]           時計の差し替え（既定 Date.now）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {Promise<
 *   { timedOut: false; code: number|null; stdout: string; stderr: string; elapsedMs: number } |
 *   { timedOut: true; elapsedMs: number }
 * >}
 */
export function runPowerShellScript(scriptText, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const powershellPath = options.powershellPath ?? DEFAULT_POWERSHELL_PATH;
  const timeoutMs = options.timeoutMs ?? 5000;
  const nowImpl = options.nowImpl ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const args = buildPowerShellInvocationArgs(withUtf8OutputPrelude(scriptText));

  return new Promise((resolve) => {
    const start = nowImpl();
    let settled = false;
    let stdout = "";
    let stderr = "";

    const child = spawnImpl(powershellPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    // let で先に undefined 初期化してから代入する（const だと、同期発火する fake setTimeoutImpl が
    // 代入完了前に finish()→clearTimeoutImpl(timer) を呼んだ際に TDZ ReferenceError になるため）。
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    timer = setTimeoutImpl(() => {
      finish({ timedOut: true });
    }, timeoutMs);
    if (timer && typeof (/** @type {any} */ (timer).unref) === "function") {
      /** @type {any} */ (timer).unref();
    }

    function cleanupChild() {
      try {
        child.kill();
      } catch {
        // best-effort
      }
      try {
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.stdin?.destroy();
      } catch {
        // best-effort
      }
      try {
        child.unref?.();
      } catch {
        // best-effort
      }
    }

    /** @param {{ timedOut?: boolean; code?: number|null }} result */
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeoutImpl(timer);
      cleanupChild();
      const elapsedMs = nowImpl() - start;
      if (result.timedOut) {
        resolve({ timedOut: true, elapsedMs });
      } else {
        resolve({ timedOut: false, code: result.code ?? null, stdout, stderr, elapsedMs });
      }
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      stderr += `spawn error: ${err instanceof Error ? err.message : String(err)}`;
      finish({ code: null });
    });
    child.on("exit", (code) => {
      finish({ code });
    });
  });
}
