// @ts-check
/**
 * デバイス選択の file-backed 永続化（S2.5 Domain B）— apps/soul/agent。
 *
 * Domain A の SettingsStore 契約（waves/s2.5/domain-a.md §5）の **file-backed 実体**:
 *   getLastDevice(): 起動時の初期選択 / start の device 省略時フォールバック。
 *   setLastDevice(device): start 成功時に raw デバイス名を記憶。
 *
 * ── 失敗寛容（契約 §5）─────────────────────────────────────────────
 *  読めない/壊れた JSON → getLastDevice は null。書けない（ディスク I/O 失敗）→ setLastDevice は握って
 *  続行（起動を止めない）。設定は「あれば復元・無くても起動」の運用面補助であって正本ではない。
 *
 * ── テスト非汚染 ─────────────────────────────────────────────────
 *  保存パスは `options.path` で注入可能。テストは OS temp を使い、実マイク選択の実ファイル
 *  （既定 `apps/soul/agent/cockpit-settings.local.json`・.gitignore 済み）に触れない。
 *
 * 同期実装（`node:fs` の *Sync）。Domain A サーバは get/set を await するため同期でも Promise でも動く。
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** 既定の保存先（`apps/soul/agent/cockpit-settings.local.json`・.gitignore 対象・コミットしない）。 */
export const DEFAULT_SETTINGS_PATH = join(here, "..", "..", "cockpit-settings.local.json");

/**
 * file-backed settings store を作る（失敗寛容・パス注入可能）。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_SETTINGS_PATH]  JSON 保存先（テストは temp を注入）。
 * @returns {{ getLastDevice: () => string | null; setLastDevice: (device: string | null) => void }}
 */
export function createFileSettingsStore(options = {}) {
  const filePath = options.path ?? DEFAULT_SETTINGS_PATH;
  return {
    getLastDevice() {
      try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8"));
        const value = parsed && typeof parsed === "object" ? parsed.lastDevice : null;
        return typeof value === "string" && value.length > 0 ? value : null;
      } catch {
        // 未作成 / 読めない / 壊れた JSON → 記憶なし（起動時は初期選択なしで開く）。
        return null;
      }
    },
    /** @param {string | null} device */
    setLastDevice(device) {
      try {
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, `${JSON.stringify({ lastDevice: device ?? null }, null, 2)}\n`, "utf8");
      } catch {
        // ディスク書き込み失敗は起動を止めない（契約 §5・握って続行）。
      }
    }
  };
}
