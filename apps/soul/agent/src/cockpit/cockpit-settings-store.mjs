// @ts-check
/**
 * デバイス選択 / Channel URL の file-backed 永続化（S2.5 Domain B・S3 追撃 domain-c で拡張）— apps/soul/agent。
 *
 * Domain A の SettingsStore 契約（waves/s2.5/domain-a.md §5）の **file-backed 実体**:
 *   getLastDevice(): 起動時の初期選択 / start の device 省略時フォールバック。
 *   setLastDevice(device): start 成功時に raw デバイス名を記憶。
 *   getLastChannelUrl(): 起動時の Channel URL 初期値（操縦席の後入力を次回起動で復元）。
 *   setLastChannelUrl(url): 操縦席から URL を設定/変更したときに記憶（token を含むためこのファイルは
 *     .gitignore 済み・既定 `apps/soul/agent/cockpit-settings.local.json`・コミットしない）。
 *
 * ── read-modify-write（S3 追撃 domain-c）─────────────────────────────
 *  lastDevice と lastChannelUrl は同一 JSON に同居する。set は必ず既存内容を読んでマージしてから
 *  書く（片方の set がもう片方を消さない）。読めない/壊れた JSON は空オブジェクト扱いで続行する。
 *
 * ── 失敗寛容（契約 §5）─────────────────────────────────────────────
 *  読めない/壊れた JSON → get は null。書けない（ディスク I/O 失敗）→ set は握って続行（起動を止めない）。
 *  設定は「あれば復元・無くても起動」の運用面補助であって正本ではない。
 *
 * ── テスト非汚染 ─────────────────────────────────────────────────
 *  保存パスは `options.path` で注入可能。テストは OS temp を使い、実マイク選択の実ファイルに触れない。
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
 * file-backed settings store を作る（失敗寛容・パス注入可能・read-modify-write）。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_SETTINGS_PATH]  JSON 保存先（テストは temp を注入）。
 * @returns {{
 *   getLastDevice: () => string | null;
 *   setLastDevice: (device: string | null) => void;
 *   getLastChannelUrl: () => string | null;
 *   setLastChannelUrl: (url: string | null) => void;
 * }}
 */
export function createFileSettingsStore(options = {}) {
  const filePath = options.path ?? DEFAULT_SETTINGS_PATH;

  /** 既存 JSON を丸ごと読む（未作成 / 読めない / 壊れた JSON → {}）。 */
  function readAll() {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  /** 既存内容をマージして書く（片方の set がもう片方を消さない）。書き込み失敗は握る。 */
  function writeMerged(/** @type {Record<string, any>} */ patch) {
    try {
      const merged = { ...readAll(), ...patch };
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    } catch {
      // ディスク書き込み失敗は起動を止めない（契約 §5・握って続行）。
    }
  }

  /** @param {any} value */
  const asStringOrNull = (value) => (typeof value === "string" && value.length > 0 ? value : null);

  return {
    getLastDevice() {
      return asStringOrNull(readAll().lastDevice);
    },
    /** @param {string | null} device */
    setLastDevice(device) {
      writeMerged({ lastDevice: device ?? null });
    },
    getLastChannelUrl() {
      return asStringOrNull(readAll().lastChannelUrl);
    },
    /** @param {string | null} url */
    setLastChannelUrl(url) {
      writeMerged({ lastChannelUrl: url ?? null });
    }
  };
}
