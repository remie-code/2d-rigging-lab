// @ts-check
/**
 * 合成 innertube fixture（S7 Domain A・チャット器官の機械テスト用）— apps/soul/agent。
 *
 * **これらは実 YouTube ページ由来のバイト列ではない**。s7-planning-inventory §2-2 の
 * 「取得経路の仕組み」記述と youtube-chat 系 OSS の公開情報から**手書きした合成 fixture** である
 * （鉄の規律: 機械テストは実ネットワークに一切出ない・実ページを丸写し取得しない）。
 *
 * ── watch ページ HTML の合成方針 ────────────────────────────────────────
 *  実ページの watch HTML は ytcfg（`"INNERTUBE_API_KEY":"..."` 等）と `ytInitialData = {...};`
 *  の 2 塊を持つ。抽出器（innertube.mjs）が読むのはこの 2 塊だけなので、fixture もその 2 塊を
 *  最小構成で持つ（周囲の実 HTML は再現しない）。ライブチャットの初期 continuation は
 *  `ytInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer
 *   .continuations[0].reloadContinuationData.continuation` に載る（youtube-chat 実装読みの経路）。
 *
 * ── get_live_chat レスポンス JSON の合成方針 ─────────────────────────────
 *  `continuationContents.liveChatContinuation` に continuations（次トークン + timeoutMs）と
 *  actions（addChatItemAction.item に各種 renderer）が載る。builder で組む。
 */

/** ytcfg 相当の 2 値を HTML に埋める（実ページの ytcfg 断片を模した合成文字列）。 */
function ytcfgBlock(apiKey, clientVersion) {
  return (
    `<script nonce="x">(function(){window.ytcfg={};ytcfg.set(` +
    `{"INNERTUBE_API_KEY":"${apiKey}",` +
    `"INNERTUBE_CONTEXT_CLIENT_VERSION":"${clientVersion}",` +
    `"INNERTUBE_CONTEXT":{"client":{"clientName":"WEB","clientVersion":"${clientVersion}"}},` +
    `"VIDEO_ID":"__unused__"});})();</script>`
  );
}

/** `var ytInitialData = {...};` の塊を HTML に埋める。 */
function ytInitialDataBlock(obj) {
  // 実ページは `</script>` を `<\/script>` に、`/` を `<\/` にエスケープするが、
  // 抽出器はブレースを文字列状態を見ながら数えるので、通常の JSON.stringify で十分（合成なので </script> を含めない）。
  return `<script nonce="y">var ytInitialData = ${JSON.stringify(obj)};</script>`;
}

/**
 * 生きたライブ配信の watch ページ HTML（4 点抽出成功・初期 continuation あり）。
 * @param {object} [opt]
 * @param {string} [opt.apiKey]
 * @param {string} [opt.clientVersion]
 * @param {string} [opt.videoId]
 * @param {string} [opt.continuation]
 * @returns {string}
 */
export function watchHtmlLive(opt = {}) {
  const apiKey = opt.apiKey ?? "AIzaSyTEST_synthetic_key_00000000000000";
  const clientVersion = opt.clientVersion ?? "2.20260714.00.00";
  const videoId = opt.videoId ?? "testVideoId1";
  const continuation = opt.continuation ?? "CONT_INITIAL";
  const initialData = {
    contents: {
      twoColumnWatchNextResults: {
        results: { results: { contents: [{ videoPrimaryInfoRenderer: {} }] } },
        conversationBar: {
          liveChatRenderer: {
            isReplay: false,
            continuations: [{ reloadContinuationData: { continuation } }],
            header: {}
          }
        }
      }
    },
    currentVideoEndpoint: { watchEndpoint: { videoId } }
  };
  return [
    "<!DOCTYPE html><html><head><title>synthetic</title></head><body>",
    ytcfgBlock(apiKey, clientVersion),
    ytInitialDataBlock(initialData),
    "</body></html>"
  ].join("\n");
}

/** 4 点抽出が全部外れる HTML（extractFailed）。 */
export const WATCH_HTML_NO_KEYS =
  "<!DOCTYPE html><html><head><title>nope</title></head><body>" +
  "<p>this page has neither ytcfg keys nor ytInitialData</p>" +
  "</body></html>";

/**
 * キーは取れるが liveChatRenderer が無い（conversationBarRenderer の不可用メッセージ）= 配信未開始/チャット無効 → notLive。
 */
export function watchHtmlNotLive(opt = {}) {
  const apiKey = opt.apiKey ?? "AIzaSyTEST_synthetic_key_00000000000000";
  const clientVersion = opt.clientVersion ?? "2.20260714.00.00";
  const initialData = {
    contents: {
      twoColumnWatchNextResults: {
        conversationBar: {
          conversationBarRenderer: {
            availabilityMessage: {
              messageRenderer: { text: { runs: [{ text: "Chat is disabled for this live stream." }] } }
            }
          }
        }
      }
    }
  };
  return [
    "<!DOCTYPE html><html><body>",
    ytcfgBlock(apiKey, clientVersion),
    ytInitialDataBlock(initialData),
    "</body></html>"
  ].join("\n");
}

/** キーは取れるが liveChatRenderer.isReplay=true（終了配信のリプレイチャット）→ notLive。 */
export function watchHtmlReplay(opt = {}) {
  const apiKey = opt.apiKey ?? "AIzaSyTEST_synthetic_key_00000000000000";
  const clientVersion = opt.clientVersion ?? "2.20260714.00.00";
  const initialData = {
    contents: {
      twoColumnWatchNextResults: {
        conversationBar: {
          liveChatRenderer: {
            isReplay: true,
            continuations: [{ reloadContinuationData: { continuation: "REPLAY_CONT" } }]
          }
        }
      }
    }
  };
  return [
    "<!DOCTYPE html><html><body>",
    ytcfgBlock(apiKey, clientVersion),
    ytInitialDataBlock(initialData),
    "</body></html>"
  ].join("\n");
}

// ── get_live_chat レスポンス builder ────────────────────────────────────

/**
 * テキストメッセージ action（liveChatTextMessageRenderer）を組む。
 * runs は文字列（→ {text}）または {emoji} オブジェクトをそのまま渡せる。
 * @param {{ author: string; runs: Array<string | object>; id?: string; timestampUsec?: string; channelId?: string }} m
 */
export function textAction(m) {
  const runs = m.runs.map((r) => (typeof r === "string" ? { text: r } : r));
  return {
    addChatItemAction: {
      item: {
        liveChatTextMessageRenderer: {
          message: { runs },
          authorName: { simpleText: m.author },
          authorExternalChannelId: m.channelId ?? "UC_synthetic_author",
          id: m.id ?? "MSG_id",
          timestampUsec: m.timestampUsec ?? "1700000000000000"
        }
      }
    }
  };
}

/**
 * 有料メッセージ action（liveChatPaidMessageRenderer）。runs 省略時は本文なし（拾わない対象）。
 * @param {{ author: string; runs?: Array<string | object>; amount?: string; id?: string }} m
 */
export function paidAction(m) {
  const renderer = {
    authorName: { simpleText: m.author },
    authorExternalChannelId: "UC_synthetic_paid",
    id: m.id ?? "PAID_id",
    timestampUsec: "1700000000000001",
    purchaseAmountText: { simpleText: m.amount ?? "¥500" }
  };
  if (m.runs) {
    renderer.message = { runs: m.runs.map((r) => (typeof r === "string" ? { text: r } : r)) };
  }
  return { addChatItemAction: { item: { liveChatPaidMessageRenderer: renderer } } };
}

/**
 * 無視すべき renderer の action（種別名を指定）。例: liveChatMembershipItemRenderer / liveChatViewerEngagementMessageRenderer。
 * @param {string} rendererKey
 */
export function ignoredAction(rendererKey) {
  return { addChatItemAction: { item: { [rendererKey]: { dummy: true } } } };
}

/**
 * get_live_chat レスポンス JSON を組む。
 * @param {object} opt
 * @param {string} [opt.continuation]  次の continuation トークン。省略/null = 終了（ended）シグナル。
 * @param {number} [opt.timeoutMs]     timedContinuationData.timeoutMs。
 * @param {"timed"|"invalidation"|"reload"} [opt.continuationKind]  continuation オブジェクトの種別。
 * @param {Array<object>} [opt.actions]  addChatItem 系 action の配列。
 * @param {boolean} [opt.noLiveChatContinuation]  liveChatContinuation ごと欠落させる（ended/スキーマ変化）。
 * @param {boolean} [opt.noContinuationContents]  continuationContents ごと欠落させる（ended）。
 * @returns {object}
 */
export function liveChatResponse(opt = {}) {
  if (opt.noContinuationContents) {
    return { responseContext: {} };
  }
  if (opt.noLiveChatContinuation) {
    return { continuationContents: {} };
  }
  const continuations = [];
  if (opt.continuation) {
    const kind = opt.continuationKind ?? "timed";
    const dataKey =
      kind === "invalidation"
        ? "invalidationContinuationData"
        : kind === "reload"
          ? "reloadContinuationData"
          : "timedContinuationData";
    const data = { continuation: opt.continuation };
    if (opt.timeoutMs !== undefined) {
      data.timeoutMs = opt.timeoutMs;
    }
    continuations.push({ [dataKey]: data });
  }
  return {
    continuationContents: {
      liveChatContinuation: {
        continuations,
        actions: opt.actions ?? []
      }
    }
  };
}
