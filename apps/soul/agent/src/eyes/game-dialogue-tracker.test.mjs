import assert from "node:assert/strict";
import {test} from "node:test";
import {createGameDialogueTracker} from "./game-dialogue-tracker.mjs";

const row = (text, x, y, w, h = 24) => ({text, x, y, w, h});
const frame = (capturedAtMs, lines = [], strokeMask) => ({
  capturedAtMs, width: 1474, height: 829, lines, strokeMask,
});

test("a replacement closes only its own display and retains onset and overlap", () => {
  const tracker = createGameDialogueTracker();
  const upper = row("雪原の向こうから、誰かがこちらを呼んでいる。", 510, 80, 440);
  const name = row("ティフォロス", 680, 620, 114);
  const first = row("残りの祭壇を探さないと。", 598, 660, 278);
  const second = row("これ以上、進むと危ない。", 598, 660, 278);
  assert.deepEqual(tracker.update(frame(0, [upper, name, first])), []);
  assert.deepEqual(tracker.update(frame(100, [upper, name, second])), [{
    text: `${name.text}\n${first.text}`,
    displayOrder: 2, startedAt: 0, lastSeenAt: 0, closedAt: 100, closeReason: "replaced",
  }]);
  tracker.update(frame(200, [name, second]));
  const [closedUpper] = tracker.update(frame(300, [name, second]));
  assert.equal(closedUpper.text, upper.text);
  assert.equal(closedUpper.displayOrder, 1);
  assert.equal(closedUpper.lastSeenAt, 100);
  assert.equal(closedUpper.closedAt, 300);
  assert.deepEqual(tracker.pending(), [{
    text: `${name.text}\n${second.text}`,
    displayOrder: 3, startedAt: 100, lastSeenAt: 300, closedAt: null, closeReason: null,
  }]);
});

test("typewriter growth and one empty frame stay on the same display", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [row("面白", 600, 600, 40)]));
  tracker.update(frame(100, [row("面白いか……", 600, 600, 125)]));
  assert.deepEqual(tracker.update(frame(200)), []);
  assert.deepEqual(tracker.update(frame(300, [row("面白いが……同時に危険でもある。", 600, 600, 340)])), []);
  tracker.update(frame(400));
  assert.deepEqual(tracker.update(frame(500)), [{
    text: "面白いが……同時に危険でもある。",
    displayOrder: 1, startedAt: 0, lastSeenAt: 300, closedAt: 500, closeReason: "disappeared",
  }]);
});

test("adjacent centered lines keep their order and accept a long name above a one-character line", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [
    row("え", 725, 146, 19),
    row("北方遠征隊第三調査部隊の副隊長", 600, 100, 270),
  ]));
  assert.equal(tracker.pending()[0].text, "北方遠征隊第三調査部隊の副隊長\nえ");
});

test("horizontal OCR fragments reunite inside an observed row while vertical wraps keep line breaks", () => {
  const tracker = createGameDialogueTracker();
  const firstLine = row("あのとき遠くで聞こえた", 320, 400, 248);
  const secondLine = row("足音は誰のものだったんだろう。", 320, 430, 320);
  tracker.update(frame(0, [firstLine, secondLine]));
  assert.deepEqual(tracker.update(frame(100, [
    row("聞こえた", 482, 401, 86),
    secondLine,
    row("あのとき遠くで", 320, 400, 145),
  ])), []);
  assert.equal(tracker.pending().length, 1);
  assert.equal(tracker.pending()[0].text, `${firstLine.text}\n${secondLine.text}`);
});

test("one observed brief display and a later distinct repeat are kept, purely non-Japanese lines are ignored", () => {
  const tracker = createGameDialogueTracker();
  const short = row("お前が最強の敵だって？", 545, 704, 283);
  const noise = [row("7151", 110, 600, 65), row("AUTO", 600, 90, 62)];
  tracker.update(frame(0, [short, ...noise]));
  tracker.update(frame(100, noise));
  assert.equal(tracker.update(frame(200, noise)).length, 1);
  tracker.update(frame(300, [short]));
  tracker.update(frame(400));
  const [second] = tracker.update(frame(500));
  assert.equal(second.text, short.text);
  assert.equal(second.displayOrder, 2);
  assert.equal(second.startedAt, 300);
});

test("visible strokes bridge repeated OCR misses, but returning text after disappearance starts again", () => {
  const tracker = createGameDialogueTracker();
  const data = new Uint8Array(Math.ceil(1474 * 829 / 8));
  for (let x = 101; x < 130; x += 1) {
    const index = 101 * 1474 + x;
    data[index >>> 3] |= 1 << (index & 7);
  }
  const mask = {width: 1474, height: 829, data};
  const line = row("しばらく表示される。", 100, 100, 200);
  tracker.update(frame(0, [line], mask));
  for (const time of [100, 200, 300]) assert.deepEqual(tracker.update(frame(time, [], mask)), []);
  assert.equal(tracker.pending()[0].lastSeenAt, 300);
  tracker.update(frame(400));
  assert.equal(tracker.update(frame(500))[0].closedAt, 500);
  tracker.update(frame(600, [line], mask));
  assert.equal(tracker.pending()[0].displayOrder, 2);
});

test("unchanged local pixels bridge missed OCR, and changed pixels close only their own display", () => {
  const tracker = createGameDialogueTracker();
  const left = row("北へ。", 101, 101, 100);
  const right = row("北へ。", 801, 101, 100);
  const tileSize = 8;
  const columns = Math.ceil(1474 / tileSize);
  const rows = Math.ceil(829 / tileSize);
  const original = {
    width: 1474, height: 829, tileSize, data: Buffer.alloc(columns * rows * 8, 1),
  };
  const changed = {...original, data: Buffer.from(original.data)};
  // Change one tile touching the leftmost edge of the left OCR rectangle.
  changed.data[(12 * columns + 12) * 8] = 2;
  const sample = (time, lines, pixelTiles) => ({...frame(time, lines), pixelTiles});
  tracker.update(sample(0, [right, left], original));
  assert.deepEqual(tracker.update(sample(100, [], original)), []);
  assert.deepEqual(tracker.update(sample(200, [], original)), []);
  assert.deepEqual(tracker.pending().map(({displayOrder, lastSeenAt}) => [displayOrder, lastSeenAt]), [[1, 200], [2, 200]]);
  assert.deepEqual(tracker.update(sample(300, [], changed)), []);
  const [closed] = tracker.update(sample(400, [], changed));
  assert.equal(closed.displayOrder, 1);
  assert.equal(closed.closeReason, "disappeared");
  assert.equal(closed.lastSeenAt, 200);
  assert.equal(tracker.pending()[0].displayOrder, 2);

  tracker.update(sample(500, [left], original));
  assert.deepEqual(tracker.pending().map(({displayOrder, startedAt}) => [displayOrder, startedAt]), [[2, 0], [3, 500]]);
});

test("absent or invalid pixel tile data provides no continuity evidence", () => {
  const tracker = createGameDialogueTracker();
  const pixelTiles = {width: 1474, height: 829, tileSize: 8, data: {}};
  tracker.update({...frame(0, [row("短い台詞", 100, 100, 200)]), pixelTiles});
  tracker.update({...frame(100), pixelTiles});
  assert.equal(tracker.update(frame(200))[0].text, "短い台詞");
});

test("a new body with the same ending starts a page even when its name is temporarily unreadable", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [row("ティフォロス", 680, 620, 114), row("古い本文です", 660, 660, 154)]));
  const [previous] = tracker.update(frame(100, [row("次の本文です", 660, 660, 154)]));
  assert.equal(previous.text, "ティフォロス\n古い本文です");
  assert.equal(previous.closeReason, "replaced");
  assert.equal(tracker.pending()[0].text, "次の本文です");
});

test("two different horizontal displays replacing a wide row stay separate", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [row("これが一つの長い文章です。", 320, 400, 250)]));
  const closed = tracker.update(frame(100, [row("北へ行こう", 320, 400, 100), row("右へ走れ", 470, 400, 100)]));
  assert.equal(closed.length, 1);
  assert.deepEqual(tracker.pending().map(({text}) => text), ["北へ行こう", "右へ走れ"]);
});

test("later OCR coverage combines earlier related fragments and preserves their earliest onset", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [row("聞こえた声だ。", 475, 400, 100)]));
  tracker.update(frame(100, [row("遠くから", 320, 400, 110), row("聞こえた声だ。", 475, 400, 100)]));
  assert.deepEqual(tracker.update(frame(200, [row("遠くから聞こえた声だ。", 320, 400, 255)])), []);
  assert.deepEqual(tracker.pending(), [{
    text: "遠くから聞こえた声だ。",
    displayOrder: 1, startedAt: 0, lastSeenAt: 200, closedAt: null, closeReason: null,
  }]);
});

test("a visually continuous same-place row rejoins its block when OCR reads the whole line again", () => {
  const tracker = createGameDialogueTracker();
  const body = row("これほど古いアーツの造物となれば、早めに北へ届ける必要がある。", 380, 719, 706, 19);
  const fullName = row("ァイフロス", 681, 679, 111, 17);
  const otherName = row(fullName.text, 1140, 679, 111, 17);
  const data = new Uint8Array(Math.ceil(1474 * 829 / 8));
  for (let x = 696; x < 790; x += 1) {
    const index = 685 * 1474 + x;
    data[index >>> 3] |= 1 << (index & 7);
  }
  const mask = {width: 1474, height: 829, data};
  tracker.update(frame(0, [body, row("ロ~ズ", 767, 678, 26, 19), otherName], mask));
  tracker.update(frame(100, [{...body, text: "これほど古いアーツの造物となれば", w: 565}, fullName, otherName], mask));
  assert.equal(tracker.pending().length, 3);
  const currentName = row("イフ-・ス", 694, 675, 98, 23);
  assert.deepEqual(tracker.update(frame(200, [body, currentName, otherName], mask)), []);
  assert.equal(tracker.pending().length, 2);
  assert.equal(tracker.pending()[0].text, `${currentName.text}\n${body.text}`);
  assert.equal(tracker.pending()[1].text, otherName.text);
});

test("repeated readings win over later competing OCR of the same length", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [row("テ ィ フ ォ ロ ス .", 680, 620, 120)]));
  tracker.update(frame(100, [row("テ ィ フ ォ ロ ス", 680, 620, 114)]));
  tracker.update(frame(200, [row("テ ィ フ ォ ロ ス", 680, 620, 114)]));
  tracker.update(frame(300, [row("テ ィ フ ォ ロ 又", 680, 620, 114)]));
  assert.equal(tracker.pending()[0].text, "ティフォロス");
});

test("Japanese OCR gaps close while Latin word boundaries and display rows remain", () => {
  const tracker = createGameDialogueTracker();
  tracker.update(frame(0, [
    row("テ ィ フ ォ ロ ス", 680, 620, 114),
    row("残 り 2 つ 。 Blue Team の 祭 壇 。", 630, 660, 214),
  ]));
  assert.equal(tracker.pending()[0].text, "ティフォロス\n残り2つ。Blue Teamの祭壇。");
});

test("strong visual replacement distinguishes similar non-prefix text", () => {
  const tracker = createGameDialogueTracker();
  const markStrokes = (y) => {
    const data = new Uint8Array(Math.ceil(1474 * 829 / 8));
    for (let x = 665; x < 800; x += 2) {
      const index = y * 1474 + x;
      data[index >>> 3] |= 1 << (index & 7);
    }
    return {width: 1474, height: 829, data};
  };
  const name = row("ティフォロス", 680, 620, 114);
  const first = row("次は北の祭壇へ向かいます。", 660, 660, 154);
  const second = row("次は南の祭壇へ向かいます。", 660, 660, 154);
  tracker.update(frame(0, [name, first], markStrokes(663)));
  const [previous] = tracker.update(frame(100, [name, second], markStrokes(674)));
  assert.equal(previous.text, `${name.text}\n${first.text}`);
  assert.equal(previous.closeReason, "replaced");
  assert.equal(tracker.pending()[0].text, `${name.text}\n${second.text}`);
});
