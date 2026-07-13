// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createFireScheduler,
  normalizeForMatch,
  textMatchesName,
  NAME_VARIANTS_V0,
  NAME_VARIANTS_TEXT_V0,
  TURN_END_SILENCE_MS,
  TURN_END_PROBABILITY,
  TURN_END_REFRACTORY_MS,
  SILENCE_BASE_MS,
  SILENCE_JITTER_MS,
  SILENCE_REFRACTORY_MS,
  SILENCE_BUDGET_V0,
  COMMENT_REFRACTORY_MS,
  COMMENT_PROBABILITY,
  COMMENT_BUDGET_V0
} from "./fire-scheduler.mjs";

// 発火スケジューラ（自発 3 種）の決定論テスト。実 clock・実 timer・実 RNG・実 LLM は一切使わず全注入。
// blocking 基準 3「純ロジック + fake clock/注入 RNG で全分岐決定論」「LLM ask 経路が存在しない」を固定する。

/**
 * fake clock + fake timer（決定論）。now と scheduling を一体で進める。advance(ms) で期限到達タイマを
 * 時刻順（同時刻は登録順）に発火し、now を進める。nowImpl には now() を渡す（不応期計算が同期する）。
 */
function makeFakeClock() {
  let now = 0;
  let seq = 0;
  /** @type {Map<number, { fn: () => void; at: number; seq: number }>} */
  const timers = new Map();
  const setTimeoutImpl = /** @type {any} */ ((fn, ms) => {
    const id = (seq += 1);
    timers.set(id, { fn, at: now + ms, seq: id });
    return id;
  });
  const clearTimeoutImpl = /** @type {any} */ ((id) => {
    timers.delete(id);
  });
  const advance = (ms) => {
    const target = now + ms;
    for (;;) {
      /** @type {{ id: number; at: number; fn: () => void } | null} */
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (next === null || t.at < next.at || (t.at === next.at && id < next.id))) {
          next = { id, at: t.at, fn: t.fn };
        }
      }
      if (next === null) break;
      timers.delete(next.id);
      now = next.at;
      next.fn();
    }
    now = target;
  };
  return { setTimeoutImpl, clearTimeoutImpl, advance, now: () => now, pending: () => timers.size };
}

/** 定数の rng（区切り確率・沈黙ジッターの分岐を固定する）。 */
const rngHit = () => 0.0; // 区切り確率 < prob → 命中 / ジッター 0。
const rngMiss = () => 0.99; // 区切り確率 >= prob → 外れ。

/** you 発話 1 件（呼びかけ照合用）。 */
const you = (text) => ({ text, speaker: "you" });
const soul = (text) => ({ text, speaker: "soul" });
/** viewer 転写 1 件（★ handleTranscript の viewer no-op を踏ませる用）。 */
const viewer = (text, displayName) => ({ text, speaker: "viewer", displayName });

// ── 定数 ─────────────────────────────────────────────────────────────

test("scheduler: v0 定数が export される（不応期・確率・ジッター・閾値・予算・揺れ集合）", () => {
  assert.equal(typeof TURN_END_SILENCE_MS, "number");
  assert.ok(TURN_END_SILENCE_MS > 0);
  assert.ok(TURN_END_PROBABILITY > 0 && TURN_END_PROBABILITY < 1);
  assert.ok(TURN_END_REFRACTORY_MS > 0);
  assert.ok(SILENCE_BASE_MS > 0);
  assert.ok(SILENCE_JITTER_MS >= 0);
  assert.ok(SILENCE_REFRACTORY_MS > 0);
  assert.ok(Number.isInteger(SILENCE_BUDGET_V0) && SILENCE_BUDGET_V0 > 0);
  assert.ok(Array.isArray(NAME_VARIANTS_V0) && NAME_VARIANTS_V0.length > 0);
});

// ── normalizeForMatch（正規化純関数の境界）─────────────────────────────────

test("normalizeForMatch: 清濁（ディ↔ティ）と かな種別 を吸収し、末尾長音は集合で吸収", () => {
  // ディ/ティ の清濁を剥がすと同一化。
  assert.equal(normalizeForMatch("コーディ"), normalizeForMatch("コーティ"));
  // ひらがな → カタカナ。
  assert.equal(normalizeForMatch("こーでぃー"), normalizeForMatch("コーディー"));
  // NFKC（半角カナ → 全角）。
  assert.equal(normalizeForMatch("ｺｰﾃﾞｨ"), normalizeForMatch("コーディ"));
});

test("normalizeForMatch: 非文字列は throw（呼び出し側のバグを黙殺しない）", () => {
  assert.throws(() => normalizeForMatch(/** @type {any} */ (123)), /text must be a string/);
});

test("textMatchesName: 採用揺れ 4 種 + かな + 連結が命中、非該当は非命中", () => {
  const needles = [...new Set(NAME_VARIANTS_V0.map(normalizeForMatch))];
  // 採用揺れ（inventory §4-2 の採用分）。
  for (const v of ["コーディ", "コーディー", "コーティー", "コーティ"]) {
    assert.equal(textMatchesName(v, needles), true, `should hit: ${v}`);
  }
  // 呼びかけ直後の読点が消えて本文と連結（実測「コーディこれどう思う?」）。
  assert.equal(textMatchesName("コーディこれどう思う?", needles), true);
  assert.equal(textMatchesName("ねえコーディーちょっと聞いて", needles), true);
  assert.equal(textMatchesName("こーでぃー", needles), true); // ひらがな。
  // 見送り・非該当（誤爆させない）。
  for (const v of ["コーピー", "コーキー", "こうて", "こうで", "コピーして", "コーヒー飲む", "全然関係ない話"]) {
    assert.equal(textMatchesName(v, needles), false, `should miss: ${v}`);
  }
});

// ── 呼びかけ（call・確実に発火・不応期/確率を掛けない）──────────────────────────

test("call: 名前照合が命中したら確実に発火要求（不応期も確率も掛けない）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: rngMiss, // 確率が外れる値でも call は影響を受けない。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  // 連続で 3 回呼びかけても（不応期を無視して）毎回発火要求。
  sch.handleTranscript(you("コーディこれ見て"));
  sch.handleTranscript(you("コーディーもう一回"));
  sch.handleTranscript(you("ねえコーディ"));
  assert.equal(reqs.length, 3);
  assert.ok(reqs.every((r) => r.kind === "call"));
  sch.dispose();
});

test("call: 非該当（コピー等）・soul 発話・空文字は発火しない（誤爆と自己応答を防ぐ）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  sch.handleTranscript(you("コピーしておいて")); // 誤爆させない。
  sch.handleTranscript(you("")); // 空文字。
  sch.handleTranscript(soul("コーディだよ")); // soul が名前を含んでも自己応答しない（除外）。
  assert.equal(reqs.length, 0);
  // you の正しい呼びかけは通る（対照）。
  sch.handleTranscript(you("コーディ"));
  assert.equal(reqs.length, 1);
  sch.dispose();
});

test("call: 自発 OFF 中・busy 中は呼びかけでも発火要求を出さない", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  let busy = false;
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: false, // OFF。
    isBusy: () => busy,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  sch.handleTranscript(you("コーディ")); // OFF → 出さない。
  assert.equal(reqs.length, 0);
  sch.setEnabled(true);
  busy = true;
  sch.handleTranscript(you("コーディ")); // busy → 出さない。
  assert.equal(reqs.length, 0);
  busy = false;
  sch.handleTranscript(you("コーディ")); // idle → 出す。
  assert.equal(reqs.length, 1);
  sch.dispose();
});

// ── 区切り応答（turn-end・speechEnd 後 X 無音 + 不応期 + 確率）──────────────────────

/** turn-end 判定用のスケジューラを組む（確率は rng で制御）。 */
function makeTurnEndScheduler(clock, { rng, isBusy } = {}) {
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    isBusy,
    nowImpl: clock.now,
    rng: rng ?? rngHit,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    // 沈黙は遠くに追いやり turn-end 分岐だけを見る。
    silenceBaseMs: 10_000_000
  });
  return { sch, reqs };
}

test("turn-end: speechEnd 後 X 秒の無音 + 確率当たりで区切り応答（X 未満では出ない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS - 1);
  assert.equal(reqs.length, 0); // X 未満 → まだ出ない。
  clock.advance(1); // X 到達。
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "turn-end");
  sch.dispose();
});

test("turn-end: 確率外れ（注入 RNG）は出ない", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngMiss });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 0);
  sch.dispose();
});

test("turn-end: 無音待ち中の speechStart は区切り応答を取り消す（まだ喋っている）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS - 500);
  sch.handleVadEvent({ type: "speechStart" }); // 続けて喋り出した → 取り消し。
  clock.advance(1000);
  assert.equal(reqs.length, 0);
  // 次の speechEnd から測り直して発火する（対照）。
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 1);
  sch.dispose();
});

test("turn-end: 不応期内は出ない（直近発火からの経過が足りない）／不応期経過後は出る", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  // 直近発火を now=0 に置く（soul 発話が不応期の基点を更新する）。
  sch.handleTranscript(soul("さっき喋った"));
  // すぐ speechEnd → X 経過（now=TURN_END_SILENCE_MS < 不応期）→ 出ない。
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 0, "不応期内は出ない");
  // 不応期を跨いでから再度 speechEnd → 出る。
  clock.advance(TURN_END_REFRACTORY_MS);
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 1, "不応期経過後は出る");
  sch.dispose();
});

test("turn-end: busy 中は区切り応答を出さない", () => {
  const clock = makeFakeClock();
  let busy = true;
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit, isBusy: () => busy });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 0);
  sch.dispose();
});

// ── 沈黙（silence・Y 秒 + ジッター + 長不応期 + 予算）────────────────────────────

/** silence 判定用のスケジューラを組む（turn-end は使わない）。 */
function makeSilenceScheduler(clock, opts = {}) {
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: opts.rng ?? rngHit, // ジッター 0（rngHit）で予測可能に。
    isBusy: opts.isBusy,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceBudget: opts.silenceBudget,
    ...opts.overrides
  });
  return { sch, reqs };
}

test("silence: 最後の活動から Y + ジッター経過で沈黙発火（有効化がカウント開始）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeSilenceScheduler(clock, { rng: rngHit }); // ジッター 0。
  // enabled:true で構築 → 沈黙タイマは有効化時に武装済み。
  clock.advance(SILENCE_BASE_MS - 1);
  assert.equal(reqs.length, 0);
  clock.advance(1);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "silence");
  sch.dispose();
});

test("silence: ジッター（注入 RNG）が base に加算される", () => {
  const clock = makeFakeClock();
  // rng=0.5 → ジッター = floor(0.5 * SILENCE_JITTER_MS)。
  const { sch, reqs } = makeSilenceScheduler(clock, { rng: () => 0.5 });
  const jitter = Math.floor(0.5 * SILENCE_JITTER_MS);
  clock.advance(SILENCE_BASE_MS + jitter - 1);
  assert.equal(reqs.length, 0); // ジッターぶん遅れてまだ出ない。
  clock.advance(1);
  assert.equal(reqs.length, 1);
  sch.dispose();
});

test("silence: 活動（you/VAD）が沈黙カウントをリセットする", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeSilenceScheduler(clock, { rng: rngHit });
  clock.advance(SILENCE_BASE_MS - 1000); // あと 1000ms で発火の手前。
  sch.handleVadEvent({ type: "speechStart" }); // 活動 → カウント再武装（0 から測り直し）。
  clock.advance(1000);
  assert.equal(reqs.length, 0, "リセットされたのでまだ出ない");
  clock.advance(SILENCE_BASE_MS - 1000);
  assert.equal(reqs.length, 1, "リセット後 Y 経過で出る");
  sch.dispose();
});

test("silence: 長不応期内は出さず再武装（直近発火から SILENCE_REFRACTORY_MS 未満）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeSilenceScheduler(clock, { rng: rngHit });
  // now=0 に直近発火（soul）。base < 長不応期 なので最初のタイマ発火時は不応期内。
  sch.handleTranscript(soul("さっき喋った")); // lastFire=0・活動で再武装。
  clock.advance(SILENCE_BASE_MS); // タイマ発火だが不応期内 → 出さず再武装。
  assert.equal(reqs.length, 0);
  // 長不応期を跨ぐまで進める（再武装で base ごとに再チェック）。
  clock.advance(SILENCE_REFRACTORY_MS);
  assert.equal(reqs.length, 1, "長不応期を過ぎたら出る");
  sch.dispose();
});

test("silence: 予算切れで出さない・予算はカウントされる", () => {
  const clock = makeFakeClock();
  // 予算 2・長不応期を base 以下にして連続発火を許す（予算だけを見る）。
  const { sch, reqs } = makeSilenceScheduler(clock, {
    rng: rngHit,
    silenceBudget: 2,
    overrides: { silenceRefractoryMs: 0 }
  });
  assert.equal(sch.silenceBudgetRemaining(), 2);
  clock.advance(SILENCE_BASE_MS); // 1 回目。
  clock.advance(SILENCE_BASE_MS); // 2 回目（予算使い切り）。
  assert.equal(reqs.length, 2);
  assert.equal(sch.silenceBudgetRemaining(), 0);
  // 予算切れ後はタイマを回さない（イベントループに残さない）＝これ以上進めても出ない。
  assert.equal(clock.pending(), 0, "予算切れで沈黙タイマは張られない");
  clock.advance(SILENCE_BASE_MS * 10);
  assert.equal(reqs.length, 2);
  sch.dispose();
});

test("silence: busy 中は出さず再武装（busy が解けたら出る）", () => {
  const clock = makeFakeClock();
  let busy = true;
  const { sch, reqs } = makeSilenceScheduler(clock, { rng: rngHit, isBusy: () => busy });
  clock.advance(SILENCE_BASE_MS); // busy → 出さず再武装。
  assert.equal(reqs.length, 0);
  busy = false;
  clock.advance(SILENCE_BASE_MS); // 再武装ぶんの周期で出る。
  assert.equal(reqs.length, 1);
  sch.dispose();
});

// ── OFF トグル ─────────────────────────────────────────────────────────

test("OFF トグル: 自発 OFF 中は 3 種とも出ずタイマも畳む（手動 Fire はスケジューラ非経由）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: rngHit,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  // 区切りタイマ・沈黙タイマを張る。
  sch.handleVadEvent({ type: "speechEnd" });
  assert.ok(clock.pending() > 0);
  // OFF → 全タイマ畳み。
  sch.setEnabled(false);
  assert.equal(clock.pending(), 0, "OFF でタイマは畳まれる");
  clock.advance(SILENCE_BASE_MS * 5);
  sch.handleTranscript(you("コーディ")); // 呼びかけも黙る。
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(SILENCE_BASE_MS * 5);
  assert.equal(reqs.length, 0);
  // 再 ON → 沈黙カウント再開。
  sch.setEnabled(true);
  clock.advance(SILENCE_BASE_MS);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "silence");
  sch.dispose();
});

// ── S7「視聴者が混ざる」: コメント応答（comment / comment-call）───────────────────────

test("scheduler: S7 v0 定数が export される（コメント不応期・確率・予算・テスト用揺れ集合）", () => {
  assert.ok(COMMENT_REFRACTORY_MS > 0);
  assert.ok(COMMENT_PROBABILITY > 0 && COMMENT_PROBABILITY < 1);
  assert.ok(Number.isInteger(COMMENT_BUDGET_V0) && COMMENT_BUDGET_V0 > 0);
  assert.ok(Array.isArray(NAME_VARIANTS_TEXT_V0) && NAME_VARIANTS_TEXT_V0.length > 0);
});

test("NAME_VARIANTS_TEXT_V0: 英字大小（Cody/cody/CODY）と日本語表記・かな・全半角が命中、コピー等は非命中", () => {
  const needles = [...new Set(NAME_VARIANTS_TEXT_V0.map(normalizeForMatch))];
  // 英字（NFKC は大小を畳まないので集合に大小を織り込んである）。
  for (const v of ["Cody", "cody", "CODY", "Codyこれ見て", "ねえcodyちょっと"]) {
    assert.equal(textMatchesName(v, needles), true, `should hit: ${v}`);
  }
  // 全角英字は NFKC で半角化 → Cody に畳まれる。
  assert.equal(textMatchesName("Ｃｏｄｙ見て", needles), true);
  // 日本語表記・かな。
  for (const v of ["コーディ", "コーディー", "こーでぃー", "ねえコーティーちょっと"]) {
    assert.equal(textMatchesName(v, needles), true, `should hit: ${v}`);
  }
  // 誤爆させない（コピー・コーヒー・無関係）。
  for (const v of ["コピーして", "コーヒー飲む", "全然関係ない話", "code review"]) {
    assert.equal(textMatchesName(v, needles), false, `should miss: ${v}`);
  }
});

/** コメント応答判定用のスケジューラ（沈黙・turn-end は遠くに追いやる）。 */
function makeCommentScheduler(clock, opts = {}) {
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: opts.enabled ?? true,
    isBusy: opts.isBusy,
    nowImpl: clock.now,
    rng: opts.rng ?? rngHit,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceBaseMs: 10_000_000, // 沈黙は遠くへ（コメント分岐だけを見る）。
    commentBudget: opts.commentBudget,
    ...opts.overrides
  });
  return { sch, reqs };
}

test("comment-call: コメント内呼びかけ命中は確実に発火（不応期・確率・予算を掛けない・連続でも返す）", () => {
  const clock = makeFakeClock();
  // 確率外れ値 + 予算 0 でも comment-call は影響を受けない。
  const { sch, reqs } = makeCommentScheduler(clock, { rng: rngMiss, commentBudget: 0 });
  sch.handleChatMessage({ text: "Cody これ見て", displayName: "Taro" });
  sch.handleChatMessage({ text: "ねえこーでぃー", displayName: "Hana" }); // 不応期無視で連続。
  sch.handleChatMessage({ text: "コーティーちょっと", displayName: "Ken" });
  assert.equal(reqs.length, 3);
  assert.ok(reqs.every((r) => r.kind === "comment-call"));
  // comment-call は予算を消費しない。
  assert.equal(sch.commentBudgetRemaining(), 0);
  sch.dispose();
});

test("comment-call: busy 中・自発 OFF 中は呼びかけコメントでも発火しない", () => {
  const clock = makeFakeClock();
  let busy = false;
  const { sch, reqs } = makeCommentScheduler(clock, { enabled: false, isBusy: () => busy });
  sch.handleChatMessage({ text: "Cody!", displayName: "A" }); // OFF → 出さない。
  assert.equal(reqs.length, 0);
  sch.setEnabled(true);
  busy = true;
  sch.handleChatMessage({ text: "Cody!", displayName: "A" }); // busy → 出さない。
  assert.equal(reqs.length, 0);
  busy = false;
  sch.handleChatMessage({ text: "Cody!", displayName: "A" }); // idle → 出す。
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "comment-call");
  sch.dispose();
});

test("comment: 呼びかけ無しコメントは 不応期 + 確率 + 予算 を満たしたときだけ発火", () => {
  const clock = makeFakeClock();
  // 確率当たり（rngHit）・予算 5・不応期を跨がせる。
  const { sch, reqs } = makeCommentScheduler(clock, { rng: rngHit, commentBudget: 5 });
  // 1 通目: lastFire=-Inf ゆえ不応期通過・確率当たり → comment 発火（予算 1 消費）。
  sch.handleChatMessage({ text: "おもしろい配信だね", displayName: "A" });
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "comment");
  assert.equal(sch.commentBudgetRemaining(), 4);
  // 2 通目: 直後 = 不応期内 → 出ない。
  sch.handleChatMessage({ text: "うんうん", displayName: "B" });
  assert.equal(reqs.length, 1, "不応期内は出ない");
  // 不応期を跨ぐと再び出る。
  clock.advance(COMMENT_REFRACTORY_MS);
  sch.handleChatMessage({ text: "なるほどね", displayName: "C" });
  assert.equal(reqs.length, 2, "不応期経過後は出る");
  sch.dispose();
});

test("comment: 確率外れ（注入 RNG）は出ない（予算も消費しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeCommentScheduler(clock, { rng: rngMiss, commentBudget: 5 });
  sch.handleChatMessage({ text: "こんばんは", displayName: "A" });
  assert.equal(reqs.length, 0);
  assert.equal(sch.commentBudgetRemaining(), 5); // 外れは予算を減らさない。
  sch.dispose();
});

test("comment: 予算切れで出さない（comment-call は予算に無関係で出続ける）", () => {
  const clock = makeFakeClock();
  // 予算 1・不応期 0 で連発を許す（予算だけを見る）。
  const { sch, reqs } = makeCommentScheduler(clock, {
    rng: rngHit,
    commentBudget: 1,
    overrides: { commentRefractoryMs: 0 }
  });
  sch.handleChatMessage({ text: "コメント1", displayName: "A" }); // comment（予算使い切り）。
  sch.handleChatMessage({ text: "コメント2", displayName: "B" }); // 予算切れ → 出ない。
  assert.equal(reqs.filter((r) => r.kind === "comment").length, 1);
  assert.equal(sch.commentBudgetRemaining(), 0);
  // 予算切れでも呼びかけ（comment-call）は確実に返る。
  sch.handleChatMessage({ text: "cody!", displayName: "C" });
  assert.equal(reqs.filter((r) => r.kind === "comment-call").length, 1);
  sch.dispose();
});

test("comment: 空文字・busy・OFF は出さない", () => {
  const clock = makeFakeClock();
  let busy = false;
  const { sch, reqs } = makeCommentScheduler(clock, { rng: rngHit, isBusy: () => busy, commentBudget: 5 });
  sch.handleChatMessage({ text: "", displayName: "A" }); // 空文字。
  busy = true;
  sch.handleChatMessage({ text: "本文あり", displayName: "B" }); // busy。
  assert.equal(reqs.length, 0);
  busy = false;
  sch.setEnabled(false);
  sch.handleChatMessage({ text: "本文あり", displayName: "C" }); // OFF。
  assert.equal(reqs.length, 0);
  sch.dispose();
});

test("★ 二重発火の断ち: handleTranscript(viewer) は no-op（you 経路の call 照合/armSilence を誤起動しない）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: rngHit,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  // 沈黙タイマの残時間を計るため一旦掴む: enabled:true で構築済み → 沈黙タイマ武装済み。
  const pendingBefore = clock.pending();
  // 名前を含む viewer 転写を handleTranscript に食わせても（★ 転写バッファ経由で通る経路）call は出ない。
  sch.handleTranscript(viewer("コーディこれ見て", "Taro"));
  sch.handleTranscript(viewer("Cody!!", "Hana"));
  assert.equal(reqs.length, 0, "viewer は handleTranscript では発火しない（handleChatMessage が担う）");
  // no-op ゆえ armSilence による沈黙タイマ張り替えも起きない（pending 数が増減しない）。
  assert.equal(clock.pending(), pendingBefore, "viewer 転写で沈黙タイマを張り替えない（no-op）");
  // 対照: 同じ本文を handleChatMessage に入れれば comment-call が出る。
  sch.handleChatMessage({ text: "コーディこれ見て", displayName: "Taro" });
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "comment-call");
  sch.dispose();
});

test("comment: コメント到着は活動として沈黙タイマを再武装する（lastFire は発火時のみ更新）", () => {
  const clock = makeFakeClock();
  // comment 確率を 0 に落とし「コメント到着が沈黙を再武装する」効果だけを純粋に見る（発火は起こさない）。
  const { sch, reqs } = makeSilenceScheduler(clock, {
    rng: rngHit,
    overrides: { commentProbability: 0 }
  });
  clock.advance(SILENCE_BASE_MS - 1000); // あと 1000ms で沈黙発火の手前。
  sch.handleChatMessage({ text: "わいわい", displayName: "A" }); // 活動 → 沈黙タイマ再武装（0 から測り直し）。
  assert.equal(reqs.length, 0, "確率 0 ゆえコメント発火は無し");
  clock.advance(1000);
  // 沈黙がリセットされたので、元の SILENCE_BASE_MS 手前では沈黙発火しない。
  assert.equal(reqs.filter((r) => r.kind === "silence").length, 0, "コメント活動で沈黙はリセットされた");
  clock.advance(SILENCE_BASE_MS - 1000);
  assert.equal(reqs.filter((r) => r.kind === "silence").length, 1, "再武装後 base 経過で沈黙が出る");
  sch.dispose();
});

// ── 決定論 ─────────────────────────────────────────────────────────────

/** 決定論確認用の seed 付き RNG（線形合同法・実 Math.random を使わない）。 */
function makeSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test("決定論: 同じ入力列 + 同じ注入 RNG 列 → 同じ発火要求列", () => {
  const run = () => {
    const clock = makeFakeClock();
    /** @type {any[]} */
    const reqs = [];
    const sch = createFireScheduler({
      onFireRequest: (r) => reqs.push({ kind: r.kind, at: clock.now() }),
      enabled: true,
      nowImpl: clock.now,
      rng: makeSeededRng(42),
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl
    });
    // 同一の入力列（VAD・転写・時間送り）。
    sch.handleTranscript(you("やっほー"));
    clock.advance(3000);
    sch.handleVadEvent({ type: "speechEnd" });
    clock.advance(TURN_END_SILENCE_MS);
    sch.handleTranscript(you("コーディ見て"));
    clock.advance(SILENCE_BASE_MS + SILENCE_JITTER_MS);
    sch.handleVadEvent({ type: "speechEnd" });
    clock.advance(TURN_END_REFRACTORY_MS + TURN_END_SILENCE_MS);
    clock.advance(SILENCE_REFRACTORY_MS + SILENCE_BASE_MS + SILENCE_JITTER_MS);
    sch.dispose();
    return reqs;
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b);
  assert.ok(a.length > 0, "何らかの発火要求が出る入力列であること");
});

// ── LLM 非依存の担保（blocking 基準 3）──────────────────────────────────────

test("LLM 非依存: fire-scheduler は import ゼロ = LLM/SDK/session への到達経路が構造的に存在しない", () => {
  const src = readFileSync(new URL("./fire-scheduler.mjs", import.meta.url), "utf8");
  // 純ロジック = 依存ゼロ。import 文が 1 つも無いことで「いつ喋るか」判定に LLM が混入しえない。
  assert.equal(/^\s*import\s.+from\s/m.test(src), false, "fire-scheduler must have zero imports");
  // 念のため ask 呼び出し・session/SDK 参照がソースに無いことも固定。
  assert.equal(/\.ask\s*\(/.test(src), false, "must not call .ask(");
  assert.equal(/createLlmSession|llm-session|claude-agent-sdk|session\.ask/.test(src), false);
});

test("dispose: 以後のイベントは無視・タイマは残さない（ハングしない）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: rngHit,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  sch.handleVadEvent({ type: "speechEnd" });
  sch.dispose();
  assert.equal(clock.pending(), 0);
  clock.advance(SILENCE_BASE_MS * 5);
  sch.handleTranscript(you("コーディ"));
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(SILENCE_BASE_MS * 5);
  assert.equal(reqs.length, 0);
});
