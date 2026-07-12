// @ts-check
/**
 * サブスク枠認証ガード（S1 Domain C）— apps/soul/agent。API 課金事故の防波堤。
 *
 * 魂は **ログイン済みマシンの `/login` サブスク OAuth 資格情報**で動かす前提（s1-planning-inventory
 * §4）。Agent SDK は環境変数（`ANTHROPIC_API_KEY` 等）が設定されていると**常に API 課金**へ切り替わる
 * （公式の認証優先順位）。サブスク枠のつもりで起動したのに知らぬ間に従量課金される事故を防ぐため、
 * 起動時にこれらの環境変数の有無を検査し、設定されていれば**理由付きで起動を拒否**する。
 *
 * ── ガード対象（設定されていたら throw）─────────────────────────────────
 *  1. `ANTHROPIC_API_KEY`   — 設定時は常に API 課金（サブスク枠を使わない）。
 *  2. `ANTHROPIC_AUTH_TOKEN` — 独自ゲートウェイ/別トークン認証への切り替え。
 *  3. `CLAUDE_CODE_USE_*`   — プレフィクス一致（例 `CLAUDE_CODE_USE_BEDROCK` / `_VERTEX`）。
 *     クラウドプロバイダ経由（Bedrock/Vertex 等）への切り替え。サブスク枠でない。
 *
 * ── ANTHROPIC_BASE_URL の扱い（warn であって throw ではない・設計判断）─────────
 *  BASE_URL は「送信先の付け替え」であって、それ自体が課金方式を切り替えるわけではない。既定値
 *  （`https://api.anthropic.com`）はサブスク OAuth が使う正規エンドポイントそのものなので、既定値に
 *  等しい場合は無害＝無言で通す。この開発環境ではハーネスが BASE_URL を既定値に設定しており、ここを
 *  throw 対象にすると本環境で SDK 動作確認が一切できなくなる（Orch 確認事項）。一方、**非既定値**は
 *  プロキシ/別ゲートウェイ経由の可能性があり、サブスク枠外の課金や送信先変更を招き得るため**警告**を
 *  返す（起動は止めない＝運用者が意図的にプロキシを挟む余地を残す）。この判断根拠は domain-c.md に記録。
 *
 * ── 純関数（テスト可能）───────────────────────────────────────────────
 *  `assertSubscriptionAuthEnv(env)` は env を引数に取る純関数（既定 process.env）。副作用は「違反時の
 *  throw」と「戻り値 { warnings }」のみ。fixture（env オブジェクト）で単体検証できる。起動経路
 *  （llm-session / CLI）はこれを必ず呼び、warnings を stderr に出す。
 */

/** 設定されていたら起動を拒否する完全一致の環境変数名。 */
const API_BILLING_ENV_VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];

/** 設定されていたら起動を拒否するプレフィクス（`CLAUDE_CODE_USE_BEDROCK` 等）。 */
const CLAUDE_CODE_USE_PREFIX = "CLAUDE_CODE_USE_";

/** サブスク OAuth が使う正規エンドポイント。BASE_URL がこれと等しければ無害。 */
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

/**
 * env 値が「設定されている」か。空文字は未設定と同義（空の API キーでは認証も課金も起きない）に扱う。
 * @param {unknown} value
 * @returns {boolean}
 */
function isSet(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * BASE_URL 比較のための正規化（前後空白除去 + 末尾スラッシュ除去）。
 * @param {unknown} value
 * @returns {string}
 */
function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

/**
 * サブスク枠で起動してよい環境かを検査する。API 課金/別認証に切り替わる環境変数が設定されていれば
 * 理由付きで throw（起動拒否）。BASE_URL の非既定値は throw せず warnings に積む。
 *
 * @param {Record<string, string | undefined>} [env]  検査対象の環境（既定 process.env）。
 * @returns {{ warnings: string[] }}  非致命的な注意（BASE_URL 非既定等）。呼び出し側が stderr に出す。
 * @throws {Error} ガード対象（API_KEY / AUTH_TOKEN / CLAUDE_CODE_USE_*）が設定されている。
 * @throws {TypeError} env がオブジェクトでない。
 */
export function assertSubscriptionAuthEnv(env = process.env) {
  if (env == null || typeof env !== "object") {
    throw new TypeError(
      "assertSubscriptionAuthEnv(env): env must be an object (e.g. process.env)."
    );
  }

  /** @type {string[]} */
  const offenders = [];
  for (const name of API_BILLING_ENV_VARS) {
    if (isSet(env[name])) {
      offenders.push(name);
    }
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith(CLAUDE_CODE_USE_PREFIX) && isSet(env[key])) {
      offenders.push(key);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      "魂の起動を拒否しました（サブスク枠認証ガード）。" +
        `API 課金・別認証に切り替わる環境変数が設定されています: ${offenders.join(", ")}。` +
        "魂は /login のサブスク OAuth 資格情報で動かす前提です（Agent SDK は ANTHROPIC_API_KEY 等が " +
        "あると常に従量課金になります。s1-planning-inventory §4）。これらを unset してから起動してください。"
    );
  }

  /** @type {string[]} */
  const warnings = [];
  const base = env.ANTHROPIC_BASE_URL;
  if (isSet(base) && normalizeBaseUrl(base) !== DEFAULT_ANTHROPIC_BASE_URL) {
    warnings.push(
      `ANTHROPIC_BASE_URL が非既定値 (${String(base)}) に設定されています。既定 ` +
        `(${DEFAULT_ANTHROPIC_BASE_URL}) 以外はプロキシ/別ゲートウェイ経由となり、サブスク枠外の課金や ` +
        "送信先の変更を招く恐れがあります。意図した設定か確認してください（起動は継続します）。"
    );
  }

  return { warnings };
}
