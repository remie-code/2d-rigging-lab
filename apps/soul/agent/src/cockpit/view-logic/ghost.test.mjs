// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  discardGhostLabel,
  diagnosticGhostLabel,
  selfFireGhostLabel,
  chatDiagnosticGhostLabel
} from "./ghost.mjs";

test("discardGhostLabel: (discarded)（cockpit.html:828）", () => {
  assert.equal(discardGhostLabel(), "(discarded)");
});

test("diagnosticGhostLabel: 表示する型のラベル（cockpit.html:831-849）", () => {
  assert.equal(diagnosticGhostLabel({ type: "asrFailure" }), "(asr failed)");
  assert.equal(diagnosticGhostLabel({ type: "fireEmptyReply" }), "(fire: empty reply)");
  assert.equal(diagnosticGhostLabel({ type: "fireError", message: "boom" }), "(fire error: boom)");
  assert.equal(diagnosticGhostLabel({ type: "fireError" }), "(fire error: unknown)"); // message 欠落。
  assert.equal(diagnosticGhostLabel({ type: "expressionUnknownTag", tag: "wink" }), "(unknown tag: wink)");
  assert.equal(diagnosticGhostLabel({ type: "expressionUnknownTag" }), "(unknown tag: ?)");
  // fireVisionError: kind 必須・message は任意（あれば — で続ける）。
  assert.equal(
    diagnosticGhostLabel({ type: "fireVisionError", kind: "vision-no-target" }),
    "(vision fire: vision-no-target)"
  );
  assert.equal(
    diagnosticGhostLabel({ type: "fireVisionError", kind: "vision-capture-failed", message: "PrintWindow" }),
    "(vision fire: vision-capture-failed — PrintWindow)"
  );
  assert.equal(diagnosticGhostLabel({ type: "fireVisionError" }), "(vision fire: ?)");
  // barge-in の付随的失敗系。
  assert.equal(
    diagnosticGhostLabel({ type: "bargeInStopError", message: "x" }),
    "(barge-in: player.stop failed — x)"
  );
  assert.equal(diagnosticGhostLabel({ type: "bargeInStopError" }), "(barge-in: player.stop failed — ?)");
  assert.equal(diagnosticGhostLabel({ type: "bargeInMouthCloseRejected" }), "(barge-in: mouth-close rejected)");
  assert.equal(
    diagnosticGhostLabel({ type: "bargeInMouthCloseError", message: "y" }),
    "(barge-in: mouth-close failed — y)"
  );
  assert.equal(
    diagnosticGhostLabel({ type: "chatBufferAbsent" }),
    "(chat: ears not running — comment did not merge)"
  );
});

test("diagnosticGhostLabel: 意図的非表示リストは null（page test:244-246 が根拠）", () => {
  // 演出診断の非表示 3 種（演出行の ✗N が伝える・壊れ括弧の除去痕はノイズ）。
  assert.equal(diagnosticGhostLabel({ type: "expressionBrokenTag" }), null);
  assert.equal(diagnosticGhostLabel({ type: "expressionRejected" }), null);
  assert.equal(diagnosticGhostLabel({ type: "expressionSendError" }), null);
  // bargeIn（type=="bargeIn"）は専用マーカー行へ回るのでゴーストとしては null。
  assert.equal(diagnosticGhostLabel({ type: "bargeIn" }), null);
  // 未知型・型欠落も拡張予約で非表示。
  assert.equal(diagnosticGhostLabel({ type: "somethingNew" }), null);
  assert.equal(diagnosticGhostLabel({}), null);
});

test("selfFireGhostLabel: (self-fire: kind not fired — reason)（cockpit.html:877）", () => {
  assert.equal(
    selfFireGhostLabel({ kind: "silence", reason: "busy" }),
    "(self-fire: silence not fired — busy)"
  );
  assert.equal(selfFireGhostLabel({}), "(self-fire: ? not fired — ?)");
});

test("chatDiagnosticGhostLabel: 取得死分類のみ表示・観測補助は null（cockpit.html:888-897）", () => {
  assert.equal(chatDiagnosticGhostLabel({ kind: "notLive" }), "(chat: notLive)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "ended" }), "(chat: ended)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "network", message: "ECONNRESET" }), "(chat: network — ECONNRESET)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "extractFailed" }), "(chat: extractFailed)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "internalError" }), "(chat: internalError)");
  // 観測補助の内部診断は非表示（過剰表示を避ける）。
  assert.equal(chatDiagnosticGhostLabel({ kind: "connected" }), null);
  assert.equal(chatDiagnosticGhostLabel({ kind: "stopped" }), null);
  assert.equal(chatDiagnosticGhostLabel({ kind: "ignoredRenderers" }), null);
  assert.equal(chatDiagnosticGhostLabel({ kind: "listenerError" }), null);
  assert.equal(chatDiagnosticGhostLabel({}), null); // kind 欠落 → "?" は白名簿外 → null。
});
