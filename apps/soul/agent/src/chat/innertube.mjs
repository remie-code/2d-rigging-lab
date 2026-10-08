// @ts-check
/**
 * innertube 取得経路の純部品（S7 Domain A・チャット器官）— apps/soul/agent。
 *
 * 非公式 innertube 経路（s7-planning-inventory §2-2・裁定 §5）の「仕組み」を素の fetch と
 * 正規表現/JSON 走査だけで実装する純部品層。ここには**状態も常駐もない**——入力（HTML 文字列・
 * レスポンス JSON）から値を取り出す純関数と、fetchImpl 注入で往復する薄いラッパのみ。ライフサイクル
 * （状態機械・自動再接続・フック）は live-chat-client.mjs が持つ。
 *
 * 依存ゼロ（import 文なし・Node 18+ グローバル fetch/URL のみ）。魂の他部位への import は無い
 * （チャット器官は独立・plan §3 Domain A）。
 *
 * ── 取得経路（inventory §2-2）─────────────────────────────────────────
 *  1. GET watch ページ（`youtube.com/watch?v=<ID>` / `youtube.com/live/<ID>` /
 *     `/channel/<ID>/live` / `/@handle/live`）。
 *  2. HTML から 4 点抽出: INNERTUBE_API_KEY・clientVersion・初期 continuation・videoID。
 *  3. POST `youtubei/v1/live_chat/get_live_chat?key=<API_KEY>` に { context, continuation }。
 *  4. レスポンスの continuationContents から「次の continuation + timeoutMs」と actions を取り出しループ。
 *
 * ── 壊れ方の分類（純部品が返すエラー種）───────────────────────────────
 *  - extractFailed: 4 点が HTML から取れない（正規表現外れ・スキーマ変化・watch ページでない）。
 *  - notLive:       キーは取れるが liveChatRenderer 不在 / isReplay=true（配信未開始・リプレイ）。
 *  - ended:         get_live_chat が「次の continuation」を返さない（チャット終了 = ポーリング継続不能）。
 *  純部品は投げずに判別可能な戻り値（`{ ... }` | `{ error: { kind, message } }`）で返す
 *  （window-list.mjs の流儀）。network（fetch 失敗）は fetch ラッパが throw し、上位（client）が握る。
 */

/** POST 先 innertube エンドポイント。 */
const GET_LIVE_CHAT_PATH = "/youtubei/v1/live_chat/get_live_chat";

/** watch ページの基底。 */
const YOUTUBE_ORIGIN = "https://www.youtube.com";

/** innertube クライアント名（WEB 経路）。 */
export const INNERTUBE_CLIENT_NAME = "WEB";

/**
 * timeoutMs が continuation に無いときのポーリング間隔フォールバック（v0 定数）。
 * 実配信の timedContinuationData は概ね数秒。無い経路（reloadContinuationData 等）向けの下限でもある。
 */
export const DEFAULT_POLL_INTERVAL_MS = 3000;

// ── source 正規化 ───────────────────────────────────────────────────────

/**
 * watch URL / video ID / `/live/<ID>` / チャンネル `/live` / `/@handle/live` URL を受理し、
 * fetch する URL と既知 videoId を返す。
 * @param {string} source
 * @returns {
 *   { kind: "watch" | "channel"; url: string; videoId: string | null } |
 *   { error: { kind: "extractFailed"; message: string } }
 * }
 */
export function normalizeSource(source) {
  if (typeof source !== "string" || source.trim().length === 0) {
    return { error: { kind: "extractFailed", message: "source must be a non-empty string." } };
  }
  const s = source.trim();

  // 素の video ID（11 文字 [A-Za-z0-9_-]）。
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) {
    return { kind: "watch", url: `${YOUTUBE_ORIGIN}/watch?v=${s}`, videoId: s };
  }

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    return { error: { kind: "extractFailed", message: `source is neither a video ID nor a URL: ${s}` } };
  }

  // youtu.be/<ID>
  if (parsed.hostname === "youtu.be") {
    const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { kind: "watch", url: `${YOUTUBE_ORIGIN}/watch?v=${id}`, videoId: id };
    }
    return { error: { kind: "extractFailed", message: `youtu.be URL has no video ID: ${s}` } };
  }

  const isYouTubeHost = /(^|\.)youtube\.com$/.test(parsed.hostname);
  if (!isYouTubeHost) {
    return { error: { kind: "extractFailed", message: `not a youtube.com URL: ${parsed.hostname}` } };
  }

  // /watch?v=<ID>
  const v = parsed.searchParams.get("v");
  if (parsed.pathname === "/watch" && v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
    return { kind: "watch", url: `${YOUTUBE_ORIGIN}/watch?v=${v}`, videoId: v };
  }

  // /live/<ID> （末尾 11 文字が動画 ID = /watch?v=<id> と等価。クエリは pathname に含まれないため
  // ?feature=share 等が付いていても自然に無視される）。
  const liveMatch = /^\/live\/([A-Za-z0-9_-]{11})\/?$/.exec(parsed.pathname);
  if (liveMatch) {
    return { kind: "watch", url: `${YOUTUBE_ORIGIN}/watch?v=${liveMatch[1]}`, videoId: liveMatch[1] };
  }

  // /channel/<ID>/live （canonical を watch ページ側で追う。videoId は未知）
  const channelMatch = /^\/channel\/([A-Za-z0-9_-]+)\/live\/?$/.exec(parsed.pathname);
  if (channelMatch) {
    return { kind: "channel", url: `${YOUTUBE_ORIGIN}/channel/${channelMatch[1]}/live`, videoId: null };
  }

  // /@handle/live （ハンドル型ライブ URL。/channel/<id>/live と同一の解決経路——videoId は未知のまま
  // HTML の currentVideoEndpoint.watchEndpoint.videoId に委ねる。handle の文字クラスは厳密検証せず
  // YouTube 側に委ねる = v0 方針。空ハンドル /@/live は非空セグメント要件で弾かれる）。
  const handleLiveMatch = /^\/@([^/]+)\/live\/?$/.exec(parsed.pathname);
  if (handleLiveMatch) {
    return { kind: "channel", url: `${YOUTUBE_ORIGIN}/@${handleLiveMatch[1]}/live`, videoId: null };
  }

  // /watch なしのその他の短縮は v0 未対応（extractFailed で正直に返す）。
  return {
    error: {
      kind: "extractFailed",
      message: `unsupported youtube URL shape (want /watch?v=, youtu.be/<id>, /live/<id>, /@handle/live, /channel/<id>/live): ${s}`
    }
  };
}

// ── HTML からの 4 点抽出 ────────────────────────────────────────────────

/**
 * text の openIndex（'{' を指す）から、文字列状態を尊重してバランスした JSON オブジェクトを切り出す。
 * 実ページの `ytInitialData = {...};` を貪欲/怠惰 regex では取り切れない（ネスト・`}` を含む文字列）ため、
 * ブレースを数えつつ `"` エスケープを追う小走査で確実に閉じを見つける。
 * @param {string} text
 * @param {number} openIndex
 * @returns {string | null}
 */
function sliceBalancedObject(text, openIndex) {
  if (text[openIndex] !== "{") {
    return null;
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex, i + 1);
      }
    }
  }
  return null;
}

/**
 * watch ページ HTML から `ytInitialData` オブジェクトを取り出す純関数。取れなければ null。
 * @param {string} html
 * @returns {any | null}
 */
export function extractInitialData(html) {
  if (typeof html !== "string") {
    return null;
  }
  const marker = /ytInitialData\s*=\s*/.exec(html);
  if (!marker) {
    return null;
  }
  const openIndex = html.indexOf("{", marker.index + marker[0].length);
  if (openIndex < 0) {
    return null;
  }
  const jsonText = sliceBalancedObject(html, openIndex);
  if (jsonText === null) {
    return null;
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

/**
 * ytInitialData から live chat の初期 continuation と配信状態を読む純関数。
 * @param {any} initialData
 * @returns {{ continuation: string } | { notLive: string }}
 */
function readLiveChatBootstrap(initialData) {
  const conversationBar =
    initialData?.contents?.twoColumnWatchNextResults?.conversationBar;
  const liveChatRenderer = conversationBar?.liveChatRenderer;
  if (!liveChatRenderer) {
    // conversationBarRenderer（不可用メッセージ）か、そもそも live chat が無い = 未開始/無効。
    const msg =
      conversationBar?.conversationBarRenderer?.availabilityMessage?.messageRenderer?.text?.runs?.[0]
        ?.text;
    return { notLive: msg ? String(msg) : "no liveChatRenderer in conversationBar (stream not live)" };
  }
  if (liveChatRenderer.isReplay === true) {
    return { notLive: "liveChatRenderer.isReplay is true (replay chat, not live)" };
  }
  const cont = liveChatRenderer?.continuations?.[0];
  const token =
    cont?.reloadContinuationData?.continuation ??
    cont?.invalidationContinuationData?.continuation ??
    cont?.timedContinuationData?.continuation;
  if (typeof token !== "string" || token.length === 0) {
    return { notLive: "liveChatRenderer has no initial continuation token" };
  }
  return { continuation: token };
}

/**
 * watch ページ HTML から 4 点（apiKey・clientVersion・continuation・videoId）を抽出する純関数。
 * @param {string} html
 * @param {object} [opt]
 * @param {string | null} [opt.knownVideoId]  URL から既知の videoId（あれば優先）。
 * @returns {
 *   { apiKey: string; clientVersion: string; continuation: string; videoId: string } |
 *   { error: { kind: "extractFailed" | "notLive"; message: string } }
 * }
 */
export function extractBootstrap(html, opt = {}) {
  if (typeof html !== "string" || html.length === 0) {
    return { error: { kind: "extractFailed", message: "empty html" } };
  }

  const apiKey = /"INNERTUBE_API_KEY":\s*"([^"]+)"/.exec(html)?.[1];
  const clientVersion =
    /"INNERTUBE_CONTEXT_CLIENT_VERSION":\s*"([^"]+)"/.exec(html)?.[1] ??
    /"clientVersion":\s*"([\d.]+)"/.exec(html)?.[1];

  if (!apiKey || !clientVersion) {
    return {
      error: {
        kind: "extractFailed",
        message: `missing ytcfg keys (apiKey=${Boolean(apiKey)}, clientVersion=${Boolean(clientVersion)})`
      }
    };
  }

  const initialData = extractInitialData(html);
  if (initialData === null) {
    return { error: { kind: "extractFailed", message: "ytInitialData not found or not parseable" } };
  }

  const boot = readLiveChatBootstrap(initialData);
  if ("notLive" in boot) {
    return { error: { kind: "notLive", message: boot.notLive } };
  }

  const videoId =
    opt.knownVideoId ??
    initialData?.currentVideoEndpoint?.watchEndpoint?.videoId ??
    /"videoId":\s*"([A-Za-z0-9_-]{11})"/.exec(html)?.[1] ??
    null;
  if (!videoId) {
    return { error: { kind: "extractFailed", message: "could not determine videoId" } };
  }

  return { apiKey, clientVersion, continuation: boot.continuation, videoId };
}

// ── get_live_chat レスポンスの解析 ───────────────────────────────────────

/**
 * message.runs（[{text}|{emoji}]）を 1 本の文字列に結合する純関数。
 * emoji は unicode（emojiId が絵文字そのもの）ならその文字、カスタム絵文字なら shortcut を採る。
 * @param {any} runs
 * @returns {string}
 */
export function joinRuns(runs) {
  if (!Array.isArray(runs)) {
    return "";
  }
  let out = "";
  for (const run of runs) {
    if (run && typeof run.text === "string") {
      out += run.text;
      continue;
    }
    const emoji = run?.emoji;
    if (emoji) {
      if (emoji.isCustomEmoji) {
        out += emoji.shortcuts?.[0] ?? "";
      } else {
        out += emoji.emojiId ?? emoji.shortcuts?.[0] ?? "";
      }
    }
  }
  return out;
}

/**
 * addChatItemAction.item（各種 renderer）を 1 件のメッセージに解く純関数。
 * @param {any} item
 * @returns {
 *   { message: { text: string; displayName: string; messageId: string | null; kind: "text" | "paid"; timestampUsec: string | null; channelId: string | null } } |
 *   { ignored: string } |
 *   null
 * }
 */
export function parseMessageItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const textRenderer = item.liveChatTextMessageRenderer;
  if (textRenderer) {
    const text = joinRuns(textRenderer.message?.runs);
    const displayName = String(textRenderer.authorName?.simpleText ?? "");
    return {
      message: {
        text,
        displayName,
        messageId: textRenderer.id != null ? String(textRenderer.id) : null,
        kind: "text",
        timestampUsec: textRenderer.timestampUsec != null ? String(textRenderer.timestampUsec) : null,
        channelId:
          textRenderer.authorExternalChannelId != null
            ? String(textRenderer.authorExternalChannelId)
            : null
      }
    };
  }

  const paidRenderer = item.liveChatPaidMessageRenderer;
  if (paidRenderer) {
    // 有料メッセージは本文 (message.runs) が無いことがある（金額だけ）。本文があれば text と同格に拾う。
    const text = joinRuns(paidRenderer.message?.runs);
    if (text.length === 0) {
      return { ignored: "liveChatPaidMessageRenderer(no-body)" };
    }
    return {
      message: {
        text,
        displayName: String(paidRenderer.authorName?.simpleText ?? ""),
        messageId: paidRenderer.id != null ? String(paidRenderer.id) : null,
        kind: "paid",
        timestampUsec: paidRenderer.timestampUsec != null ? String(paidRenderer.timestampUsec) : null,
        channelId:
          paidRenderer.authorExternalChannelId != null
            ? String(paidRenderer.authorExternalChannelId)
            : null
      }
    };
  }

  // その他 renderer（membership・placeholder・viewerEngagement 等）は無視 + 種別を返す（診断へ）。
  const keys = Object.keys(item);
  return { ignored: keys.length > 0 ? keys[0] : "unknown-item" };
}

/**
 * @typedef {{ text: string; displayName: string; messageId: string | null; kind: "text" | "paid"; timestampUsec: string | null; channelId: string | null }} ChatMessage
 */

/**
 * get_live_chat レスポンス JSON を解く純関数。
 *  - 次の continuation が取れなければ ended（チャット終了 = ポーリング継続不能）。
 *  - continuationContents が無い（スキーマ全欠）も ended として扱う（死んだら診断 + 上位で dead）。
 * actions が空（新着なし）は正常——`{ messages: [] }` で返す（エラーではない）。
 * @param {any} json
 * @returns {
 *   { continuation: string; timeoutMs: number | null; messages: ChatMessage[]; ignored: string[] } |
 *   { error: { kind: "ended" | "extractFailed"; message: string } }
 * }
 */
export function parseLiveChatResponse(json) {
  if (json == null || typeof json !== "object") {
    return { error: { kind: "extractFailed", message: `response is not an object; got ${typeof json}` } };
  }
  const liveChat = json.continuationContents?.liveChatContinuation;
  if (!liveChat) {
    // continuationContents 欠落 = チャット終了（もう続けられない）。スキーマ変化も観測上ここに落ちる。
    return { error: { kind: "ended", message: "no continuationContents.liveChatContinuation (chat ended)" } };
  }

  const contArray = Array.isArray(liveChat.continuations) ? liveChat.continuations : [];
  let continuation = null;
  let timeoutMs = null;
  for (const c of contArray) {
    const data =
      c?.timedContinuationData ??
      c?.invalidationContinuationData ??
      c?.reloadContinuationData ??
      c?.liveChatReplayContinuationData ??
      null;
    if (data?.continuation) {
      continuation = String(data.continuation);
      if (typeof data.timeoutMs === "number") {
        timeoutMs = data.timeoutMs;
      } else if (typeof data.timeoutMs === "string" && /^\d+$/.test(data.timeoutMs)) {
        timeoutMs = Number(data.timeoutMs);
      }
      break;
    }
  }
  if (continuation === null) {
    // 次トークン無し = ポーリング終了 = チャット終了。
    return { error: { kind: "ended", message: "no next continuation token (chat ended)" } };
  }

  const actions = Array.isArray(liveChat.actions) ? liveChat.actions : [];
  /** @type {ChatMessage[]} */
  const messages = [];
  /** @type {string[]} */
  const ignored = [];
  for (const action of actions) {
    const item = action?.addChatItemAction?.item ?? action?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item;
    const parsed = parseMessageItem(item);
    if (parsed === null) {
      continue;
    }
    if ("ignored" in parsed) {
      ignored.push(parsed.ignored);
    } else {
      messages.push(parsed.message);
    }
  }

  return { continuation, timeoutMs, messages, ignored };
}

// ── fetch ラッパ（fetchImpl 注入・実ネット非依存でテスト可能）─────────────────

/**
 * watch ページを GET して HTML 文字列を返す。非 2xx や fetch 失敗は throw（上位が network 分類で握る）。
 * @param {object} args
 * @param {string} args.url
 * @param {typeof fetch} args.fetchImpl
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<string>}
 */
export async function fetchWatchPage(args) {
  const { url, fetchImpl, signal } = args;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      // 実ページと同等の言語・UA ヒント（合成テストでは検査されないが実疎通のため付ける）。
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    signal
  });
  if (!res.ok) {
    throw new Error(`watch page fetch failed: HTTP ${res.status} ${res.statusText ?? ""}`.trim());
  }
  return await res.text();
}

/**
 * get_live_chat を POST してレスポンス JSON を返す。非 2xx や fetch 失敗は throw。
 * @param {object} args
 * @param {string} args.apiKey
 * @param {string} args.clientVersion
 * @param {string} args.continuation
 * @param {typeof fetch} args.fetchImpl
 * @param {AbortSignal} [args.signal]
 * @param {string} [args.origin]  既定 https://www.youtube.com（テスト用に差し替え可）。
 * @returns {Promise<any>}
 */
export async function fetchLiveChat(args) {
  const { apiKey, clientVersion, continuation, fetchImpl, signal } = args;
  const origin = args.origin ?? YOUTUBE_ORIGIN;
  const url = `${origin}${GET_LIVE_CHAT_PATH}?key=${encodeURIComponent(apiKey)}`;
  const body = {
    context: {
      client: {
        clientName: INNERTUBE_CLIENT_NAME,
        clientVersion,
        hl: "en",
        gl: "US"
      }
    },
    continuation
  };
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    throw new Error(`get_live_chat fetch failed: HTTP ${res.status} ${res.statusText ?? ""}`.trim());
  }
  return await res.json();
}
