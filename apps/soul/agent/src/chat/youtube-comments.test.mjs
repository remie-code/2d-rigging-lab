import { test } from "node:test";
import assert from "node:assert/strict";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createYouTubeComments } from "./youtube-comments.mjs";

test("YouTube 再配信: 場が同じなら耳の停止・再開をまたいで受け付けた投稿を覚える", () => {
  const buffer = createTranscriptBuffer();
  let transcript = null;
  const judged = [];
  const scheduled = [];
  const reactions = [];
  const broadcastRows = [];
  const comments = createYouTubeComments({
    isClosed: () => false,
    discordVenueActive: () => false,
    getTranscript: () => transcript,
    currentSoulName: () => "チャッピー",
    nowImpl: () => 100,
    commentGuard: ({ text }) => {
      judged.push(text);
      return { pass: true, kind: "ok" };
    },
    reportComment() {},
    handleDiagnostic() {},
    toWireEntry: (entry) => entry,
    broadcast: (event, row) => {
      if (event === "transcript") broadcastRows.push(row.text);
    },
    onSchedulerComment: (comment) => scheduled.push(comment.text),
    onReactionComment: (comment) => reactions.push(comment.id)
  });

  const first = { videoId: "video", messageId: "m1", text: "最初の投稿" };
  const second = { videoId: "video", messageId: "m2", text: "耳が止まっている間の投稿" };
  comments.ingestChatMessage(first);
  assert.deepEqual(judged, [], "正本ができるまでは受け付けない");
  transcript = buffer;
  comments.ingestChatMessage(first);
  assert.deepEqual(judged, [first.text]);
  transcript = null;
  comments.clearPending();
  comments.ingestChatMessage(second);
  assert.deepEqual(judged, [first.text]);
  transcript = buffer;
  comments.ingestChatMessage(first);
  comments.ingestChatMessage(second);
  assert.deepEqual(judged, [first.text, second.text]);
  assert.deepEqual(broadcastRows, [first.text, second.text]);
  assert.deepEqual(scheduled, [first.text, second.text]);
  assert.deepEqual(reactions, ["m1", "m2"]);
});
