// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chatStatusView,
  chatDisplayState,
  chatDisplayFromSseStatus,
  shouldRestoreChatSource,
  channelStatusView
} from "./status.mjs";

test("chatStatusView: 稼働状態は Disconnect 有効・状態別クラス（renderChatStatus 同値）", () => {
  for (const st of ["connecting", "live", "retrying"]) {
    assert.deepEqual(chatStatusView(st), {
      text: st,
      className: "chat-status " + st,
      disconnectDisabled: false
    });
  }
});

test("chatStatusView: dead は connected でも Disconnect 無効（snapshot 再送で誤再有効化しない・page test:321）", () => {
  assert.deepEqual(chatStatusView("dead"), {
    text: "dead",
    className: "chat-status dead",
    disconnectDisabled: true
  });
});

test("chatStatusView: 未接続（falsy）は not connected・Disconnect 無効", () => {
  const expected = { text: "not connected", className: "chat-status", disconnectDisabled: true };
  assert.deepEqual(chatStatusView(null), expected);
  assert.deepEqual(chatStatusView(undefined), expected);
  assert.deepEqual(chatStatusView(""), expected);
});

test("chatDisplayState: connected=false は null・true は state（無ければ connecting）（cockpit.html:314）", () => {
  assert.equal(chatDisplayState(null), null);
  assert.equal(chatDisplayState({ connected: false }), null);
  assert.equal(chatDisplayState({ connected: false, state: "live" }), null); // connected=false が優先。
  assert.equal(chatDisplayState({ connected: true, state: "live" }), "live");
  assert.equal(chatDisplayState({ connected: true }), "connecting"); // state 欠落は connecting 扱い。
  assert.equal(chatDisplayState({ connected: true, state: null }), "connecting");
});

test("chatDisplayFromSseStatus: SSE 側の既定畳み（status 欠落は connecting・cockpit.html:884）", () => {
  assert.equal(chatDisplayFromSseStatus({ status: "live" }), "live");
  assert.equal(chatDisplayFromSseStatus({ status: "dead" }), "dead");
  assert.equal(chatDisplayFromSseStatus({}), "connecting"); // status 欠落。
  assert.equal(chatDisplayFromSseStatus({ status: "" }), "connecting"); // falsy も既定へ。
  assert.equal(chatDisplayFromSseStatus(null), "connecting");
});

test("shouldRestoreChatSource: 未編集・欄が空・source ありのときだけ復元（cockpit.html:311）", () => {
  assert.equal(shouldRestoreChatSource({ edited: false, currentValue: "", source: "vid1" }), true);
  assert.equal(shouldRestoreChatSource({ edited: true, currentValue: "", source: "vid1" }), false); // 入力中は上書きしない。
  assert.equal(shouldRestoreChatSource({ edited: false, currentValue: "typed", source: "vid1" }), false); // 欄が空でない。
  assert.equal(shouldRestoreChatSource({ edited: false, currentValue: "", source: null }), false); // source なし。
  assert.equal(shouldRestoreChatSource({ edited: false, currentValue: "", source: "" }), false);
});

test("channelStatusView: 未設定は not configured（applyChannel 同値・cockpit.html:347-359）", () => {
  assert.deepEqual(channelStatusView(null), { text: "not configured", className: "channel-status" });
  assert.deepEqual(channelStatusView({}), { text: "not configured", className: "channel-status" });
  assert.deepEqual(channelStatusView({ configured: false, url: "ws://x" }), {
    text: "not configured",
    className: "channel-status"
  });
});

test("channelStatusView: 接続状態の色分け（connected=緑/error=赤/connecting=黄/他=末尾スペース）", () => {
  assert.deepEqual(channelStatusView({ configured: true, url: "ws://a/channel", connection: "connected" }), {
    text: "ws://a/channel — connected",
    className: "channel-status connected"
  });
  assert.deepEqual(channelStatusView({ configured: true, url: "ws://a/channel", connection: "error" }), {
    text: "ws://a/channel — error",
    className: "channel-status error"
  });
  assert.deepEqual(channelStatusView({ configured: true, url: "ws://a/channel", connection: "connecting" }), {
    text: "ws://a/channel — connecting",
    className: "channel-status connecting"
  });
  // connection 欠落 → idle・class は末尾スペース付き（原実装踏襲）。
  assert.deepEqual(channelStatusView({ configured: true, url: "ws://a/channel" }), {
    text: "ws://a/channel — idle",
    className: "channel-status "
  });
  // url 欠落 → "(configured)"。
  assert.deepEqual(channelStatusView({ configured: true, connection: "connected" }), {
    text: "(configured) — connected",
    className: "channel-status connected"
  });
});
