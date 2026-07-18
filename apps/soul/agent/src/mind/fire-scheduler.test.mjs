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
  TURN_END_ARM_TIMEOUT_MS,
  SILENCE_BASE_MS,
  SILENCE_JITTER_MS,
  SILENCE_REFRACTORY_MS,
  SILENCE_BUDGET_V0,
  COMMENT_REFRACTORY_MS,
  COMMENT_PROBABILITY,
  COMMENT_BUDGET_V0,
  INTERJECTION_BASE_MS,
  INTERJECTION_JITTER_MS,
  INTERJECTION_REFRACTORY_MS,
  VERBOSITY_BUNDLES
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
  assert.ok(TURN_END_ARM_TIMEOUT_MS > 0, "arm タイムアウト（追撃修正）も正の数として export される");
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
function makeTurnEndScheduler(clock, { rng, isBusy, turnEndArmTimeoutMs } = {}) {
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
    turnEndArmTimeoutMs,
    // 沈黙は遠くに追いやり turn-end 分岐だけを見る。
    silenceBaseMs: 10_000_000
  });
  return { sch, reqs };
}

test("turn-end: speechEnd 後 X 秒の無音 + 確率当たりで armed に入る（即座には発火しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS - 1);
  assert.equal(reqs.length, 0); // X 未満 → まだ armed にすら入らない。
  clock.advance(1); // X 到達 → armed。
  assert.equal(reqs.length, 0, "armed 直後はまだ発火しない（追撃修正・転写到着まで待つ）");
  sch.dispose();
});

test("turn-end: armed 後、その発話の転写（you）が届いた瞬間に発火する（追撃修正の核心）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed。
  assert.equal(reqs.length, 0);
  sch.handleTranscript(you("さっきの話なんだけど")); // 引き金になった発話の転写到着。
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "turn-end");
  sch.dispose();
});

test("turn-end: armed 後、転写がタイムアウト内に届かなければ静かに解除する（発火しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed。
  clock.advance(TURN_END_ARM_TIMEOUT_MS - 1);
  assert.equal(reqs.length, 0, "タイムアウト未満はまだ armed のまま（発火もしない）");
  clock.advance(1); // タイムアウト到達 → 静かに解除。
  assert.equal(reqs.length, 0, "タイムアウトで解除・発火しない");
  // 解除後に転写が届いても、もう armed ではないので発火しない（遅れて着地した正本を拾わない）。
  sch.handleTranscript(you("遅れて届いた発話"));
  assert.equal(reqs.length, 0);
  sch.dispose();
});

test("turn-end: armed 中に転写が呼びかけ（call）に命中したら call が勝ち、pending turn-end は破棄される（二重発火しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed。
  sch.handleTranscript(you("コーディこれ見て")); // 同じ転写が呼びかけにも命中。
  assert.equal(reqs.length, 1, "call のみが出る（turn-end は破棄）");
  assert.equal(reqs[0].kind, "call");
  sch.dispose();
});

test("turn-end: armed 中に setEnabled(false) で pending は解除される（再 ON でも復活しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed。
  sch.setEnabled(false);
  sch.setEnabled(true);
  sch.handleTranscript(you("さっきの話"));
  assert.equal(reqs.length, 0, "OFF で armed は解除され、再 ON でも復活しない");
  sch.dispose();
});

test("turn-end: 確率外れ（注入 RNG）は armed にすら入らない", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngMiss });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  sch.handleTranscript(you("さっきの話"));
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
  // 次の speechEnd から測り直して armed → 転写到着で発火する（対照）。
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 0, "armed 直後はまだ発火しない");
  sch.handleTranscript(you("続きの発話"));
  assert.equal(reqs.length, 1);
  sch.dispose();
});

test("turn-end: armed 中に新たな speechEnd が来ても据え置く（二重 arm しない）", () => {
  const clock = makeFakeClock();
  // arm タイムアウトを長めに取り、「新たな VAD タイマーが起動していない」ことを
  // TURN_END_SILENCE_MS 経過後も生きた armed で確認できるようにする。
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit, turnEndArmTimeoutMs: 60_000 });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed（1 回目の発話の転写待ち）。
  // armed 中にさらに speechStart→speechEnd が来ても、新しい VAD タイマーは起動しない（据え置き）。
  sch.handleVadEvent({ type: "speechStart" });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // もし二重に arm していればここで新たな armed が生まれてしまう。
  assert.equal(reqs.length, 0, "据え置きなので新たな armed は生まれない");
  // 最初の armed はまだ生きている（arm タイムアウトを長く取ったので健在）→ 転写到着で 1 回だけ発火する。
  sch.handleTranscript(you("ようやく届いた転写"));
  assert.equal(reqs.length, 1, "据え置かれた armed が転写到着で 1 回だけ発火する");
  sch.dispose();
});

test("turn-end: 不応期内は armed にすら入らない／不応期経過後は armed→転写到着で出る", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  // 直近発火を now=0 に置く（soul 発話が不応期の基点を更新する）。
  sch.handleTranscript(soul("さっき喋った"));
  // すぐ speechEnd → X 経過（now=TURN_END_SILENCE_MS < 不応期）→ armed にすら入らない。
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  sch.handleTranscript(you("不応期内の発話"));
  assert.equal(reqs.length, 0, "不応期内は出ない");
  // 不応期を跨いでから再度 speechEnd → armed → 転写到着で出る。
  clock.advance(TURN_END_REFRACTORY_MS);
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  assert.equal(reqs.length, 0, "armed 直後はまだ発火しない");
  sch.handleTranscript(you("不応期後の発話"));
  assert.equal(reqs.length, 1, "不応期経過後・転写到着で出る");
  sch.dispose();
});

test("turn-end: busy 中は armed にすら入らない", () => {
  const clock = makeFakeClock();
  let busy = true;
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit, isBusy: () => busy });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  sch.handleTranscript(you("busy 中の発話"));
  assert.equal(reqs.length, 0);
  sch.dispose();
});

test("turn-end: armed 成立後、転写到着までに busy になったら静かに諦める（発火しない）", () => {
  const clock = makeFakeClock();
  let busy = false;
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit, isBusy: () => busy });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed 成立時点では busy=false。
  busy = true; // armed 成立後、転写到着までの間に busy になる。
  sch.handleTranscript(you("busy 中に届いた転写"));
  assert.equal(reqs.length, 0, "転写到着時点で busy なら turn-end は出さない");
  sch.dispose();
});

test("turn-end: armed 中に soul（魂）が実際に喋ったら pending は解除される（別の発火の後に発火しない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeTurnEndScheduler(clock, { rng: rngHit });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS); // armed。
  sch.handleTranscript(soul("（何らかの経路で先に喋った）"));
  assert.equal(reqs.length, 0, "soul 発話は turn-end を出さない（不応期リセットのみ）");
  // armed は soul 発話で解除されているので、遅れて you の転写が届いても発火しない。
  sch.handleTranscript(you("遅れて届いた発話"));
  assert.equal(reqs.length, 0, "soul 発話後は pending turn-end が残っていない");
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

// ── 口数モード（wave 計画「口数配線+コーディ語彙登録」§2 裁定 A・inventory §A-2）───────────────

test("無退行: normal 束は既存 export 定数と完全同値・mode 未指定生成の既定は normal", () => {
  // normal 束は既存 export const への参照ゆえ、この等価は「値の二重管理をしていない」ことの担保
  // （mode 未指定 = 現行値 = ふつう挙動・S6/S7 無退行）。
  assert.equal(VERBOSITY_BUNDLES.normal.turnEndProbability, TURN_END_PROBABILITY);
  assert.equal(VERBOSITY_BUNDLES.normal.turnEndRefractoryMs, TURN_END_REFRACTORY_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.silenceBaseMs, SILENCE_BASE_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.silenceJitterMs, SILENCE_JITTER_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.silenceRefractoryMs, SILENCE_REFRACTORY_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.silenceBudget, SILENCE_BUDGET_V0);
  assert.equal(VERBOSITY_BUNDLES.normal.commentProbability, COMMENT_PROBABILITY);
  assert.equal(VERBOSITY_BUNDLES.normal.commentRefractoryMs, COMMENT_REFRACTORY_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.commentBudget, COMMENT_BUDGET_V0);

  const clock = makeFakeClock();
  const sch = createFireScheduler({
    onFireRequest: () => {},
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  assert.equal(sch.getVerbosity(), "normal");
  sch.dispose();
});

test("createFireScheduler: options.verbosity に未知値/非文字列を渡すと normal にフォールバックする", () => {
  for (const bad of ["bogus", 123, null, undefined, ""]) {
    const clock = makeFakeClock();
    const sch = createFireScheduler({
      onFireRequest: () => {},
      verbosity: /** @type {any} */ (bad),
      nowImpl: clock.now,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl
    });
    assert.equal(sch.getVerbosity(), "normal", `verbosity=${String(bad)} は normal にフォールバック`);
    sch.dispose();
  }
});

test("setVerbosity: モード束の turn-end 確率が実際の発火判定に反映される（境界 rng=0.5・chatty のみ命中）", () => {
  const rng05 = () => 0.5;
  /** @type {Record<string, number>} */
  const results = {};
  for (const mode of ["quiet", "normal", "chatty"]) {
    const clock = makeFakeClock();
    /** @type {any[]} */
    const reqs = [];
    const sch = createFireScheduler({
      onFireRequest: (r) => reqs.push(r),
      enabled: true,
      verbosity: mode,
      nowImpl: clock.now,
      rng: rng05,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      silenceBaseMs: 10_000_000 // 沈黙は遠くへ（turn-end 分岐だけを見る）。
    });
    sch.handleVadEvent({ type: "speechEnd" });
    clock.advance(TURN_END_SILENCE_MS); // 確率通過なら armed（まだ発火しない）。
    sch.handleTranscript(you("さっきの話")); // armed なら転写到着で発火する。
    results[mode] = reqs.length;
    sch.dispose();
  }
  assert.equal(results.quiet, 0, "quiet(確率 0.15) は rng=0.5 で確率外れ（armed にすら入らない）");
  assert.equal(results.normal, 0, "normal(確率 0.35) は rng=0.5 で確率外れ（armed にすら入らない）");
  assert.equal(results.chatty, 1, "chatty(確率 0.70) は rng=0.5 で確率命中・転写到着で発火");
});

test("setVerbosity: 実行時切替で束が即座に切り替わる（normal→chatty で turn-end 確率が変わる）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true, // mode 未指定 = normal。
    nowImpl: clock.now,
    rng: () => 0.5,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceBaseMs: 10_000_000
  });
  sch.handleVadEvent({ type: "speechEnd" });
  clock.advance(TURN_END_SILENCE_MS);
  sch.handleTranscript(you("さっきの話"));
  assert.equal(reqs.length, 0, "normal(0.35) は rng=0.5 で確率外れ（armed にすら入らない）");
  sch.setVerbosity("chatty");
  sch.handleVadEvent({ type: "speechEnd" }); // まだ発火していないので不応期は影響しない（lastFireAtMs=-Infinity）。
  clock.advance(TURN_END_SILENCE_MS); // 確率命中で armed。
  assert.equal(reqs.length, 0, "armed 直後はまだ発火しない");
  sch.handleTranscript(you("また別の話"));
  assert.equal(reqs.length, 1, "切替後 chatty(0.70) は rng=0.5 で確率命中・転写到着で発火");
  assert.equal(sch.getVerbosity(), "chatty");
  sch.dispose();
});

test("setVerbosity: 予算を新モードの満額へリセットする（消費後の残予算ではなく満額）", () => {
  const clock = makeFakeClock();
  const sch = createFireScheduler({
    onFireRequest: () => {},
    enabled: true, // mode 未指定 = normal（予算 6）。
    nowImpl: clock.now,
    rng: rngHit, // ジッター 0 で予測可能。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceRefractoryMs: 0 // 連続発火を許す（予算消費だけを見る）。
  });
  assert.equal(sch.silenceBudgetRemaining(), SILENCE_BUDGET_V0);
  clock.advance(SILENCE_BASE_MS); // 1 回消費。
  assert.equal(sch.silenceBudgetRemaining(), SILENCE_BUDGET_V0 - 1);
  sch.setVerbosity("chatty");
  assert.equal(
    sch.silenceBudgetRemaining(),
    VERBOSITY_BUNDLES.chatty.silenceBudget,
    "残予算の足し引きではなく新モードの満額へリセット"
  );
  assert.equal(sch.commentBudgetRemaining(), VERBOSITY_BUNDLES.chatty.commentBudget);
  sch.dispose();
});

test("getVerbosity: 既定 normal・setVerbosity で変わる・未知 mode は no-op（現モード・束とも維持）", () => {
  const clock = makeFakeClock();
  const sch = createFireScheduler({
    onFireRequest: () => {},
    enabled: true,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  assert.equal(sch.getVerbosity(), "normal");
  sch.setVerbosity("chatty");
  assert.equal(sch.getVerbosity(), "chatty");
  assert.equal(sch.silenceBudgetRemaining(), VERBOSITY_BUNDLES.chatty.silenceBudget);
  sch.setVerbosity("bogus"); // 未知 mode。
  assert.equal(sch.getVerbosity(), "chatty", "未知 mode は no-op（現モード維持）");
  assert.equal(sch.silenceBudgetRemaining(), VERBOSITY_BUNDLES.chatty.silenceBudget, "未知 mode は束も変えない");
  sch.setVerbosity(/** @type {any} */ (null));
  assert.equal(sch.getVerbosity(), "chatty", "非文字列 mode も no-op");
  sch.dispose();
});

test("blocking: comment-call は口数（quiet）の影響を受けない（予算 0・不応期無視で確実に発火）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    verbosity: "quiet",
    nowImpl: clock.now,
    rng: rngMiss, // 確率が外れる値でも comment-call は影響を受けない。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    commentBudget: 0 // quiet 束の予算（15）を明示上書きして 0 に（予算切れでも comment-call は出る）。
  });
  sch.handleChatMessage({ text: "Cody これ見て", displayName: "A" });
  sch.handleChatMessage({ text: "ねえこーでぃー", displayName: "B" }); // 不応期無視で連続。
  assert.equal(reqs.length, 2);
  assert.ok(reqs.every((r) => r.kind === "comment-call"));
  assert.equal(sch.commentBudgetRemaining(), 0, "comment-call は予算を消費しない（0 のまま）");
  assert.equal(sch.getVerbosity(), "quiet");
  sch.dispose();
});

test("blocking: 呼びかけ（call）は口数（quiet）の影響を受けない（確率外れ値でも確実に発火）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    verbosity: "quiet",
    nowImpl: clock.now,
    rng: rngMiss,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl
  });
  sch.handleTranscript(you("コーディこれ見て"));
  sch.handleTranscript(you("コーディーもう一回")); // 不応期無視で連続。
  assert.equal(reqs.length, 2);
  assert.ok(reqs.every((r) => r.kind === "call"));
  sch.dispose();
});

test("blocking: turn 検出（turnEndSilenceMs）は口数モードに関わらず TURN_END_SILENCE_MS で不変", () => {
  for (const mode of ["quiet", "normal", "chatty"]) {
    const clock = makeFakeClock();
    /** @type {any[]} */
    const reqs = [];
    const sch = createFireScheduler({
      onFireRequest: (r) => reqs.push(r),
      enabled: true,
      verbosity: mode,
      nowImpl: clock.now,
      rng: rngHit, // 確率は必ず命中させ、無音待ちの長さだけを見る。
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      silenceBaseMs: 10_000_000
    });
    sch.handleVadEvent({ type: "speechEnd" });
    clock.advance(TURN_END_SILENCE_MS - 1);
    assert.equal(reqs.length, 0, `${mode}: X 未満はまだ出ない（armed にも入らない）`);
    clock.advance(1);
    assert.equal(reqs.length, 0, `${mode}: TURN_END_SILENCE_MS 到達で armed（まだ発火しない）`);
    sch.handleTranscript(you("さっきの話")); // armed → 転写到着で発火（turn 検出の長さ自体はモード不変）。
    assert.equal(reqs.length, 1, `${mode}: TURN_END_SILENCE_MS 到達 + 転写到着で出る（turn 検出はモード不変）`);
    sch.dispose();
  }
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

// ── 合いの手（interjection・第 7 の語彙・「朗読と合いの手」裁定 3〜7・9）───────────────────────

test("interjection: v0 定数(base/jitter/refractory)が export される・VERBOSITY_BUNDLES は 12 値(3 モード × interjection 3 値)", () => {
  assert.ok(INTERJECTION_BASE_MS > 0);
  assert.ok(INTERJECTION_JITTER_MS >= 0);
  assert.ok(INTERJECTION_REFRACTORY_MS > 0);
  for (const mode of ["quiet", "normal", "chatty"]) {
    const b = VERBOSITY_BUNDLES[mode];
    assert.equal(typeof b.interjectionBaseMs, "number");
    assert.ok(b.interjectionBaseMs > 0, `${mode}.interjectionBaseMs > 0`);
    assert.equal(typeof b.interjectionJitterMs, "number");
    assert.ok(b.interjectionJitterMs >= 0, `${mode}.interjectionJitterMs >= 0`);
    assert.equal(typeof b.interjectionRefractoryMs, "number");
    assert.ok(b.interjectionRefractoryMs > 0, `${mode}.interjectionRefractoryMs > 0`);
  }
  // normal は既存 export 定数への参照(値の単一の源・無退行の鍵)。
  assert.equal(VERBOSITY_BUNDLES.normal.interjectionBaseMs, INTERJECTION_BASE_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.interjectionJitterMs, INTERJECTION_JITTER_MS);
  assert.equal(VERBOSITY_BUNDLES.normal.interjectionRefractoryMs, INTERJECTION_REFRACTORY_MS);
});

/** interjection 判定用のスケジューラを組む（silence/turn-end は遠くに追いやり interjection 分岐だけを見る）。 */
function makeInterjectionScheduler(clock, opts = {}) {
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    isBusy: opts.isBusy,
    nowImpl: clock.now,
    rng: opts.rng ?? rngHit, // ジッター 0(rngHit)で予測可能に。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceBaseMs: 10_000_000, // 沈黙は遠くへ。
    interjectionBaseMs: opts.interjectionBaseMs ?? 3000,
    interjectionJitterMs: opts.interjectionJitterMs ?? 0,
    interjectionRefractoryMs: opts.interjectionRefractoryMs ?? 500,
    ...opts.overrides
  });
  return { sch, reqs };
}

test("interjection: 間隙 < turnEndSilenceMs の speechStart は run を継続する（合いの手タイマーは張り替えない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    interjectionBaseMs: 5000,
    interjectionRefractoryMs: 1000
  });
  sch.handleVadEvent({ type: "speechStart" }); // t=0: run 開始・合いの手タイマー武装(満了予定 t=5000)。
  clock.advance(1000); // t=1000。
  sch.handleVadEvent({ type: "speechEnd" }); // 間隙タイマー開始(満了予定 t=3000)。
  clock.advance(1000); // t=2000(間隙 1000ms < turnEndSilenceMs=2000ms)。
  sch.handleVadEvent({ type: "speechStart" }); // run 継続(間隙タイマー取消・合いの手タイマーは張り替えない)。
  clock.advance(3000); // t=5000 → 元の合いの手タイマー(t=5000)がまだ生きていれば発火する。
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 1, "run 継続で合いの手タイマーが生き残る");
  sch.dispose();
});

test("interjection: 間隙が turnEndSilenceMs(2s) に達したら run が終了する（合いの手タイマー取消・累積リセット）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    interjectionBaseMs: 5000,
    interjectionRefractoryMs: 1000
  });
  sch.handleVadEvent({ type: "speechStart" }); // t=0: run 開始・合いの手タイマー(満了予定 t=5000)。
  clock.advance(1000); // t=1000。
  sch.handleVadEvent({ type: "speechEnd" }); // 間隙タイマー開始(満了予定 t=3000)。
  clock.advance(TURN_END_SILENCE_MS); // t=3000: 間隙タイマー満了 → run 終了(合いの手タイマー取消)。
  assert.equal(reqs.length, 0, "run 終了時点では発火しない(排他)");
  clock.advance(10_000); // 元の合いの手タイマー(t=5000)が生きていれば発火するはずだが、畳まれている。
  assert.equal(
    reqs.filter((r) => r.kind === "interjection").length,
    0,
    "run 終了で累積リセット・再開しなければ発火しない"
  );
  sch.dispose();
});

test("interjection: run 中に base+jitter 満了で発火・lastFireAtMs 更新・次の一巡が再武装され再発火しうる（累積→発火→リセット→再累積）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    interjectionBaseMs: 3000,
    interjectionRefractoryMs: 500
  });
  sch.handleVadEvent({ type: "speechStart" }); // run 開始(以降 speechEnd を送らず run を継続させる)。
  clock.advance(2999);
  assert.equal(reqs.length, 0);
  clock.advance(1); // t=3000 → 1 回目発火。
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "interjection");
  clock.advance(2999);
  assert.equal(reqs.length, 1, "次周期未満はまだ出ない");
  clock.advance(1); // t=6000 → 2 回目発火(累積リセット後の再武装)。
  assert.equal(reqs.length, 2);
  sch.dispose();
});

test("interjection: 不応期に弾かれても累積は殺されず再武装し、不応期明けに再判定で発火する（全く発火しなくなる状態を作らない）", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    interjectionBaseMs: 3000,
    interjectionRefractoryMs: 2000
  });
  sch.handleVadEvent({ type: "speechStart" }); // t=0: run 開始。
  clock.advance(2500);
  sch.handleTranscript(soul("何かの経路の発火実績")); // lastFireAtMs = 2500(不応期の基点)。
  clock.advance(500); // t=3000: 合いの手タイマー満了 → 不応期内(3000-2500=500<2000) → 弾かれ再武装(次周期 t=6000)。
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0, "不応期内は emit しない");
  clock.advance(2999);
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0);
  clock.advance(1); // t=6000: 6000-2500=3500>=2000 → 不応期クリア → 発火。
  assert.equal(
    reqs.filter((r) => r.kind === "interjection").length,
    1,
    "再武装後、不応期明けに再判定して発火する(全く発火しなくなる状態を作らない)"
  );
  sch.dispose();
});

test("interjection: busy に弾かれても累積は殺されず再武装し、busy が明けたら発火する", () => {
  const clock = makeFakeClock();
  let busy = false;
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    isBusy: () => busy,
    interjectionBaseMs: 3000,
    interjectionRefractoryMs: 0
  });
  sch.handleVadEvent({ type: "speechStart" }); // run 開始。
  busy = true;
  clock.advance(3000); // t=3000: busy → 弾かれ・再武装(次周期 t=6000)。
  assert.equal(reqs.length, 0);
  busy = false;
  clock.advance(2999);
  assert.equal(reqs.length, 0);
  clock.advance(1); // t=6000。
  assert.equal(reqs.length, 1, "busy が明けたら再武装後の周期で発火する");
  sch.dispose();
});

test("interjection: setVerbosity は run を仕切り直し(畳む)、以後の run は新モードの値で武装する", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    verbosity: "normal",
    nowImpl: clock.now,
    rng: rngHit, // ジッター 0。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    silenceBaseMs: 10_000_000
  });
  sch.handleVadEvent({ type: "speechStart" }); // run 開始(normal: base=INTERJECTION_BASE_MS=60_000)。
  sch.setVerbosity("chatty"); // run 仕切り直し(畳む)。
  clock.advance(VERBOSITY_BUNDLES.normal.interjectionBaseMs); // 旧 run は畳まれているので発火しない。
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0, "setVerbosity で run は畳まれる");
  sch.handleVadEvent({ type: "speechStart" }); // 新モード(chatty)で run 再開。
  // setVerbosity は silence の基礎/不応期も chatty へ切り替えるため、そのままだと silence が
  // interjection の満了直前(chatty: silenceBase=25000 < interjectionBase=30000)に発火して
  // lastFireAtMs を更新し、interjection の不応期(chatty=15000)に誤って抵触しうる(差 5000<15000)。
  // soul 発話で不応期の基点をこの時点(silence 無関係)へ揃え、検証を decisive に保つ
  // (このテストの主眼は「新モードの base+jitter で武装される」ことであり、不応期の相互作用は
  // 別テスト「不応期に弾かれても…」で既に固定済み)。
  sch.handleTranscript(soul("基点をここに揃える"));
  clock.advance(VERBOSITY_BUNDLES.chatty.interjectionBaseMs - 1);
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0);
  clock.advance(1);
  assert.equal(
    reqs.filter((r) => r.kind === "interjection").length,
    1,
    "新モード(chatty)の base+jitter(jitter=0) で発火する"
  );
  sch.dispose();
});

test("★ 2 秒境界の排他: 間隙 2s で turn-end は armed に入るが interjection は emit しない（両語彙同時発火なし）", () => {
  const clock = makeFakeClock();
  /** @type {any[]} */
  const reqs = [];
  const sch = createFireScheduler({
    onFireRequest: (r) => reqs.push(r),
    enabled: true,
    nowImpl: clock.now,
    rng: rngHit, // turn-end 確率も命中させる。
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    interjectionBaseMs: 30_000, // 2s 境界よりずっと長い → interjection タイマーはこの境界で満了しない。
    interjectionJitterMs: 0,
    silenceBaseMs: 10_000_000
  });
  sch.handleVadEvent({ type: "speechStart" }); // run 開始(合いの手タイマー満了予定 t=30000)。
  sch.handleVadEvent({ type: "speechEnd" }); // 間隙タイマー(2000ms) + turnEndTimer(2000ms) 両方起動。
  clock.advance(TURN_END_SILENCE_MS); // t=2000: 両方満了。
  assert.equal(
    reqs.length,
    0,
    "2s 境界では turn-end も interjection も emit しない(turn-end は armed へ・interjection は run 終了のみ)"
  );
  // turn-end は armed に入っているので、転写到着で turn-end が発火する(interjection ではない)。
  sch.handleTranscript(you("さっきの話"));
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].kind, "turn-end", "この境界で発火するのは turn-end のみ(interjection は run 終了しただけ)");
  // run は 2s 境界で終了済みなので、旧合いの手タイマー(t=30000)は既に畳まれている。
  clock.advance(30_000);
  assert.equal(
    reqs.filter((r) => r.kind === "interjection").length,
    0,
    "run は 2s 境界で終了済みなので interjection タイマーは既に畳まれている"
  );
  sch.dispose();
});

test("interjection: setEnabled(false) で run は畳まれ、割り込みも起きない。ON 復帰では run は未開始のまま(speechStart 待ち)", () => {
  const clock = makeFakeClock();
  const { sch, reqs } = makeInterjectionScheduler(clock, {
    interjectionBaseMs: 3000,
    interjectionRefractoryMs: 0
  });
  sch.handleVadEvent({ type: "speechStart" }); // run 開始。
  sch.setEnabled(false); // OFF → run は畳まれる。
  clock.advance(3000);
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0, "OFF で run は畳まれ発火しない");
  sch.setEnabled(true); // ON 復帰。
  clock.advance(3000); // speechStart が来ていないので run は未開始のまま。
  assert.equal(
    reqs.filter((r) => r.kind === "interjection").length,
    0,
    "ON 復帰だけでは run は開始しない(speechStart 待ち)"
  );
  sch.handleVadEvent({ type: "speechStart" }); // 新規発話で run 開始。
  clock.advance(2999);
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 0);
  clock.advance(1);
  assert.equal(reqs.filter((r) => r.kind === "interjection").length, 1, "ON 復帰後の新規 speechStart で run が開始し発火する");
  sch.dispose();
});

test("interjection: LLM 非依存の担保に抵触しない(fire-scheduler は import ゼロのまま・回帰確認)", () => {
  const src = readFileSync(new URL("./fire-scheduler.mjs", import.meta.url), "utf8");
  assert.equal(/^\s*import\s.+from\s/m.test(src), false, "interjection 追加後も fire-scheduler は import ゼロ");
});
