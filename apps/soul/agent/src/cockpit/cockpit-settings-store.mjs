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
 *   getVisionTarget(): 視覚発火の対象ウインドウタイトルの初期値（S5「目が開く」・operator/domain-c.md）。
 *   setVisionTarget(title): 操縦席で対象ウインドウを選んだときに記憶（次回起動で復元）。token を
 *     含まない平文タイトルだが、同一ファイル・同一マージ規律に乗せる（新キー 1 個で済む構造）。
 *   getAudioDevice(): 魂の声の出力デバイス名の初期値（S6「会話が続く」・operator/domain-d.md）。
 *   setAudioDevice(name): 操縦席で出力デバイスを選んだときに記憶（次回起動で復元）。token を含まない
 *     平文デバイス名だが、同一ファイル・同一マージ規律に乗せる（vision target と同型の新キー 1 個）。
 *   getSelfFireEnabled(): 自発発火（呼びかけ/区切り/沈黙）ON/OFF の初期値（S6・operator/domain-d.md）。
 *     未記憶（null）は「既定値にフォールバック」を呼び出し側（cockpit.mjs）に委ねる（bool の
 *     有無を区別するため asStringOrNull は使わない）。
 *   setSelfFireEnabled(enabled): 操縦席でトグルしたときに記憶（次回起動で復元）。
 *   getBargeInEnabled(): 「朗読と合いの手」barge-in トグルの初期値（既定 ON・裁定 1）。
 *     未記憶（null）は「既定値にフォールバック」を呼び出し側（cockpit.mjs）に委ねる
 *     （getSelfFireEnabled と同型・bool の有無を区別）。
 *   setBargeInEnabled(enabled): 操縦席でトグルしたときに記憶（次回起動で復元）。
 *   getChatSource(): 視聴者チャット合流の配信 URL/ID の初期値（S7「視聴者が混ざる」・waves/s7/domain-c.md）。
 *     操縦席で Connect chat した配信 source を次回起動で復元し、入力欄の既定にする。YouTube の
 *     公開 URL/ID（token を含まない平文）だが、同一ファイル・同一マージ規律に乗せる（vision target と
 *     同型の新キー 1 個）。
 *   setChatSource(source): 操縦席で Connect chat したときに記憶（次回起動で復元）。
 *   getVerbosityMode(): 口数モード（quiet/normal/chatty）の初期値（wave 計画「口数配線」§2 裁定 A）。
 *     未記憶/未知値のフォールバックは呼び出し側（cockpit.mjs の createVerbosityHooks）に委ねる
 *     （vision target と同型の文字列キー・asStringOrNull）。
 *   setVerbosityMode(mode): 操縦席で口数モードを切替えたときに記憶（次回起動で復元）。
 *   getBrainChoice(): 頭脳の選択（claude/codex）の初期値（多頭化 Domain B・brain-swap-wave-plan.md §3）。
 *     未記憶/未知値のフォールバックは呼び出し側（cockpit.mjs の createBrainHooks）に委ねる
 *     （verbosityMode と同型の文字列キー・asStringOrNull）。
 *   setBrainChoice(choice): 操縦席で頭脳を切替えたときに記憶（次回起動で復元）。
 *   getMemoryEnabled(): 配信間記憶 ON/OFF の初期値（既定 ON・stream-memory.md 裁定 1）。
 *     未記憶（null）は「既定値にフォールバック」を呼び出し側（cockpit.mjs）に委ねる（bool の
 *     有無を区別するため asStringOrNull は使わない・getBargeInEnabled と同型）。
 *   setMemoryEnabled(enabled): 操縦席でトグルしたときに記憶（次回起動で復元）。
 *
 * ── read-modify-write（S3 追撃 domain-c・S5 で visionTarget・S6 で audioDevice/selfFireEnabled・
 *    S7 で chatSource も同居）───
 *  lastDevice と lastChannelUrl（+ S5: visionTarget・S6: audioDevice/selfFireEnabled・S7: chatSource）は
 *  同一 JSON に同居する。set は必ず既存内容を読んでマージしてから書く（片方の set が他方を消さない）。
 *  読めない/壊れた JSON は空オブジェクト扱いで続行する。
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
import {
  CONVERSATION_INSTRUCTION_BRAIN_IDS,
  resolveConversationInstructionProfile
} from "../mind/fire-orchestrator.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** 既定の保存先（`apps/soul/agent/cockpit-settings.local.json`・.gitignore 対象・コミットしない）。 */
export const DEFAULT_SETTINGS_PATH = join(here, "..", "..", "cockpit-settings.local.json");

/** Additive, version-tolerant key for per-technical-brain instruction overrides. */
export const CONVERSATION_INSTRUCTIONS_SETTINGS_KEY = "conversationInstructions";

/**
 * file-backed settings store を作る（失敗寛容・パス注入可能・read-modify-write）。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_SETTINGS_PATH]  JSON 保存先（テストは temp を注入）。
 * @returns {{
 *   getLastDevice: () => string | null;
 *   setLastDevice: (device: string | null) => void;
 *   getLastChannelUrl: () => string | null;
 *   setLastChannelUrl: (url: string | null) => void;
 *   getVisionTarget: () => string | null;
 *   setVisionTarget: (title: string | null) => void;
 *   getAudioDevice: () => string | null;
 *   setAudioDevice: (name: string | null) => void;
 *   getSelfFireEnabled: () => boolean | null;
 *   setSelfFireEnabled: (enabled: boolean) => void;
 *   getBargeInEnabled: () => boolean | null;
 *   setBargeInEnabled: (enabled: boolean) => void;
 *   getChatSource: () => string | null;
 *   setChatSource: (source: string | null) => void;
 *   getVerbosityMode: () => string | null;
 *   setVerbosityMode: (mode: string | null) => void;
 *   getBrainChoice: () => string | null;
 *   setBrainChoice: (choice: string | null) => void;
 *   getMemoryEnabled: () => boolean | null;
 *   setMemoryEnabled: (enabled: boolean) => void;
 *   getConversationInstructionOverrides: () => Record<string, string>;
 *   getConversationInstruction: (brainId: string) => string | null;
 *   getConversationInstructionProfile: (brainId: string) => object;
 *   setConversationInstruction: (brainId: string, instruction: string) => boolean;
 *   resetConversationInstruction: (brainId: string) => boolean;
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

  /**
   * Strict variant used by instruction persistence. Existing settings setters
   * intentionally remain failure-tolerant; instruction revisions must only
   * advance after this write has completed successfully.
   * @param {Record<string, any>} patch
   * @returns {boolean}
   */
  function writeMergedStrict(patch) {
    const merged = { ...readAll(), ...patch };
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return true;
  }

  /** @param {any} value */
  const asStringOrNull = (value) => (typeof value === "string" && value.length > 0 ? value : null);

  /**
   * Read both the current `{ version, overrides }` shape and the historical
   * direct-map shape. Unknown ids, empty strings, and malformed values are
   * ignored so an old/corrupt settings file cannot erase the default prompt.
   * @returns {Record<string, string>}
   */
  function readConversationInstructionOverrides() {
    const raw = readAll()[CONVERSATION_INSTRUCTIONS_SETTINGS_KEY];
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
    const candidate =
      raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides)
        ? raw.overrides
        : raw;
    /** @type {Record<string, string>} */
    const result = {};
    for (const id of CONVERSATION_INSTRUCTION_BRAIN_IDS) {
      const value = candidate[id];
      if (typeof value === "string" && value.trim().length > 0) {
        result[id] = value;
      }
    }
    return result;
  }

  /** @param {Record<string, string>} overrides */
  function writeConversationInstructionOverrides(overrides) {
    /** @type {Record<string, string>} */
    const normalized = {};
    for (const id of CONVERSATION_INSTRUCTION_BRAIN_IDS) {
      const value = overrides[id];
      if (typeof value === "string" && value.trim().length > 0) normalized[id] = value;
    }
    return writeMergedStrict({
      [CONVERSATION_INSTRUCTIONS_SETTINGS_KEY]: { version: 1, overrides: normalized }
    });
  }

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
    },
    getVisionTarget() {
      return asStringOrNull(readAll().visionTarget);
    },
    /** @param {string | null} title */
    setVisionTarget(title) {
      writeMerged({ visionTarget: title ?? null });
    },
    getAudioDevice() {
      return asStringOrNull(readAll().audioDevice);
    },
    /** @param {string | null} name */
    setAudioDevice(name) {
      writeMerged({ audioDevice: name ?? null });
    },
    getSelfFireEnabled() {
      const v = readAll().selfFireEnabled;
      return typeof v === "boolean" ? v : null;
    },
    /** @param {boolean} enabled */
    setSelfFireEnabled(enabled) {
      writeMerged({ selfFireEnabled: enabled === true });
    },
    getBargeInEnabled() {
      const v = readAll().bargeInEnabled;
      return typeof v === "boolean" ? v : null;
    },
    /** @param {boolean} enabled */
    setBargeInEnabled(enabled) {
      writeMerged({ bargeInEnabled: enabled === true });
    },
    getChatSource() {
      return asStringOrNull(readAll().chatSource);
    },
    /** @param {string | null} source */
    setChatSource(source) {
      writeMerged({ chatSource: source ?? null });
    },
    getVerbosityMode() {
      return asStringOrNull(readAll().verbosityMode);
    },
    /** @param {string | null} mode */
    setVerbosityMode(mode) {
      writeMerged({ verbosityMode: mode ?? null });
    },
    getBrainChoice() {
      return asStringOrNull(readAll().brainChoice);
    },
    /** @param {string | null} choice */
    setBrainChoice(choice) {
      writeMerged({ brainChoice: choice ?? null });
    },
    getMemoryEnabled() {
      const v = readAll().memoryEnabled;
      return typeof v === "boolean" ? v : null;
    },
    /** @param {boolean} enabled */
    setMemoryEnabled(enabled) {
      writeMerged({ memoryEnabled: enabled === true });
    },
    getConversationInstructionOverrides() {
      return { ...readConversationInstructionOverrides() };
    },
    /** @param {string} brainId */
    getConversationInstruction(brainId) {
      if (!CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(brainId)) return null;
      return readConversationInstructionOverrides()[brainId] ?? null;
    },
    /** @param {string} brainId */
    getConversationInstructionProfile(brainId) {
      return resolveConversationInstructionProfile(brainId, readConversationInstructionOverrides());
    },
    /** @param {string} brainId @param {string} instruction */
    setConversationInstruction(brainId, instruction) {
      if (!CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(brainId)) {
        throw new TypeError("invalid conversation instruction brain id");
      }
      if (typeof instruction !== "string" || instruction.trim().length === 0) {
        throw new TypeError("conversation instruction must be a non-empty string");
      }
      const overrides = readConversationInstructionOverrides();
      overrides[brainId] = instruction;
      return writeConversationInstructionOverrides(overrides);
    },
    /** @param {string} brainId */
    resetConversationInstruction(brainId) {
      if (!CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(brainId)) {
        throw new TypeError("invalid conversation instruction brain id");
      }
      const overrides = readConversationInstructionOverrides();
      delete overrides[brainId];
      return writeConversationInstructionOverrides(overrides);
    }
  };
}
