// @ts-check
/**
 * Discord モード Domain K（J の持ち越し 2）: VC に入った・移った・動かされた時点でもういる人の出来事の行（vc-people）の本文。
 * J の出来事の文と語調を揃える（「〈名前〉が入ってきた」と同じく名前の後ろに空白を置かない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { venueEventLineText, VENUE_EVENT_PEOPLE_MAX_NAMES } from "./venue-events.mjs";

/** @param {object} e */
const line = (e) => venueEventLineText({ kind: "vc-people", ...e }, { soulName: "チャッピー" });

test("Domain K もういる人の行: 1 人・複数名（「・」で並べる）・名前の分からない人は「ほか N 人」・名前が 1 人も無ければ人数だけ", () => {
  assert.equal(line({ channelName: "一般", names: ["はなこ"] }), "VC「一般」にははなこがいる");
  assert.equal(line({ channelName: "一般", names: ["たろう", "はなこ", "じろう"], others: 0 }), "VC「一般」にはたろう・はなこ・じろうがいる");
  assert.equal(line({ channelName: "雑談", names: ["じろう"], others: 2 }), "VC「雑談」にはじろうとほか 2 人がいる");
  assert.equal(line({ channelName: "雑談", names: [], others: 3 }), "VC「雑談」には 3 人がいる");
  assert.equal(line({ channelName: null, names: ["はなこ"] }), "VC にははなこがいる", "VC の名前が無いとき");
});

test("Domain K もういる人の行: 誰もいなければ行にしない（null）・名前は 1 行に詰めて上限で切る・並べる上限を超えた人は「ほか N 人」", () => {
  assert.equal(line({ channelName: "一般", names: [], others: 0 }), null);
  assert.equal(line({ channelName: "一般" }), null);
  assert.equal(line({ channelName: "一般", names: ["  ", ""], others: 0 }), null, "空白だけの名前は数えない");
  assert.equal(line({ channelName: "一般", names: ["は な\nこ"] }), "VC「一般」にはは な こがいる");
  assert.equal(line({ channelName: "一般", names: ["はなこ"], others: -1 }), "VC「一般」にははなこがいる", "形の崩れた others は 0");
  const many = Array.from({ length: VENUE_EVENT_PEOPLE_MAX_NAMES + 2 }, (_, i) => `偽の人${i + 1}`);
  const text = /** @type {string} */ (line({ channelName: "一般", names: many, others: 1 }));
  assert.ok(text.endsWith("とほか 3 人がいる"), text);
  assert.equal(text.includes(`偽の人${VENUE_EVENT_PEOPLE_MAX_NAMES + 1}`), false);
});
