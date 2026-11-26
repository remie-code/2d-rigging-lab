import { createCommentIntake } from "./comment-intake.mjs";

export const CHAT_BUFFER_ABSENT_MESSAGE = "venue not open; viewer comment cannot merge into transcript buffer (no fire).";

/**
 * 配信専用の YouTube 接続とコメントの合流。Discord のチャット・資料は別経路。
 * ガードを通過した行だけを転写に積み、従来の発話スケジューラと
 * speak-now のコメント反応（忙しい場合の方針は mind/comment-react.mjs）へ渡す。
 */
export function createYouTubeComments({
  chatClientFactory, onSetChatSource, chatSourceStatus, commentGuard, currentSoulName,
  isClosed, getPhase, getGeneration, discordVenueActive, getTranscript,
  onSchedulerComment, onReactionComment, toWireEntry, nowImpl, errMessage,
  handleDiagnostic, reportComment, warnJudgeError, broadcast, broadcastState, refreshStateWarnings
}) {
  const commentIntake = createCommentIntake({
    judge: commentGuard,
    getSoulName: currentSoulName,
    now: nowImpl,
    isClosed,
    onDecision: handleCommentGuardDecision,
    onError: (error) => handleDiagnostic({ type: "chatIngestError", message: errMessage(error) })
  });
  /** @type {Set<string>} 場の間に受け付けた動画IDと投稿IDの組。 */
  const receivedComments = new Set();
  /** @type {{ start: () => Promise<void>; stop: () => void; getState: () => string; getSource: () => string } | null} */
  let chatClient = null;
  /** @type {Array<() => void>} チャット器官フックの購読解除（破棄時に全撤去）。 */
  let chatUnsubs = [];
  /** チャット器官が最後に知らせた状態（connect / 畳むときに戻す・警告の材料）。 */
  /** @type {string | null} */
  let lastChatStatus = null;
  /**
   * この起動で入れた YouTube の source（配信の組み直し 仕上げ・体験の素描 場面 3 の注記）。POST /api/chat/source で
   * 保存した値か、Connect した値。「配信を始める」はこの source へつなぐ（startForStream）。起動時に設定から読み戻した
   * だけの前回の source（chatSourceStatus の値）はここに入らない＝つなぎにいかない（配信ごとに URL が替わるため）。
   * 欄を空にして保存したとき・Disconnect を押したときは null に戻す（つながない）。
   * @type {string | null}
   */
  let chatSourceThisBoot = null;

  /**
   * YouTube（始める 7・stream-restructure.md §3）。配信の組み直し 仕上げ・Undine の追認（体験の素描 場面 3 の注記）:
   * **この起動で入れた、または Connect した URL はつなぐ。前回の起動から欄に残っているだけの URL はつながない**
   * （配信ごとに URL が替わるため）。
   *  - 場を開く前に Connect してあれば、その器官をそのまま場に持ち込む（作り直さない）。
   *  - 器官が無く、この起動で入れた source（chatSourceThisBoot）があれば、それへつなぐ（POST /api/chat/connect と同じ
   *    connectChat）。前の場で入れた source も、同じ起動の間は次の場でまたつなぐ（「配信を終える」は器官を畳むが、入れた
   *    ことは覚えている）。
   *  - 起動時に設定から読み戻しただけの前回の source（chatSourceStatus）へは、つなぎにいかない。
   *  - つながらなくても（器官の生成や start が投げても）場は開く。器官は畳み、ログのタブに 1 行（chatDiagnostic）出す。
   *
   * 配信の組み直し 人間ゲート前の直し（Undine・設計 §3 の 7「つながらなくても場は開く」）: **つなぐのは待たない**。場を
   * open にしてから後ろでつなぐ（YouTube の応答待ちで「開きかけ」が長引き、その間「配信を終える」が断られるのを防ぐ）。
   * 戻り値の Promise は reject しない（呼び出し側は await しない）。後ろでつないでいる間に:
   *  - 場が閉じた・別の場になった（世代が替わった・open でない・サーバを閉じた）→ あとからつながった器官は畳んで残さない
   *    （「配信を終える」の foldStream が先に畳んでいれば stop をもう一度呼ぶだけ・stop は冪等）。警告も出さない。
   *  - Connect / Disconnect が押された（器官が差し替わった・畳まれた）→ 押した方を優先する。後ろのつなぎは黙って捨てる
   *    （つながらなかったときも、押した方の器官を畳まない・警告を出さない）。
   * @returns {Promise<"kept" | "connected" | "none" | "failed" | "stale">}
   */
  function startForStream() {
    if (chatClient != null) return Promise.resolve("kept");
    if (chatSourceThisBoot == null || typeof chatClientFactory !== "function") return Promise.resolve("none");
    const generation = getGeneration();
    // connectChat は await の前（同期の部分）で器官を作って chatClient に入れる。後ろのつなぎが自分の器官かを見分けるため、
    // 呼んだ直後の chatClient を取っておく（工場が同期で投げたときは null のまま・connectChat は reject を返す）。
    /** @type {Promise<void>} */
    let connecting;
    try {
      connecting = connectChat(chatSourceThisBoot);
    } catch (error) {
      connecting = Promise.reject(error);
    }
    const mine = chatClient;
    /** 後ろのつなぎが片付いた時点で、まだ同じ場が開いていて、器官が自分のままか。 */
    const stillMine = () => !isClosed() && getPhase() === "open" && getGeneration() === generation && chatClient === mine;
    /** 自分の器官だけを畳む（差し替わっていれば、自分の器官の stop だけを念のため呼ぶ）。 */
    const dropMine = () => {
      if (mine != null && chatClient === mine) {
        foldChatClient();
        return;
      }
      if (mine != null) {
        try {
          mine.stop();
        } catch {
          // best-effort（既に畳まれていても冪等）。
        }
      }
    };
    return connecting.then(
      () => {
        if (!stillMine()) {
          // 場が閉じた・別の場になった・押した操作で差し替わった: あとからつながったものを残さない。
          dropMine();
          return /** @type {const} */ ("stale");
        }
        broadcastState();
        return /** @type {const} */ ("connected");
      },
      (error) => {
        if (!stillMine()) {
          dropMine();
          return /** @type {const} */ ("stale");
        }
        foldChatClient();
        broadcastChatDiagnostic({
          kind: "internalError",
          message: `配信を始めるときに YouTube につなげなかった（${errMessage(error)}・Connect でつなぎ直せる）`,
          atMs: nowImpl()
        });
        broadcastState();
        return /** @type {const} */ ("failed");
      }
    ).catch(() => /** @type {const} */ ("failed")); // 片付けの中の想定外の throw も未処理の reject にしない。
  }

  /**
   * チャット器官の 1 コメントを取り込む（Domain C の onMessage フックから呼ぶ attach 点）。best-effort
   * （throw は握って診断に落とす・器官の常駐を殺さない）。フックは戻り値を見ないので、非同期の判定の
   * 失敗もここで握る（取り込み処理へ「判定できず」として渡す）。
   * @param {{ text?: string; displayName?: string; messageId?: string | null; videoId?: string | null } | null} msg
   */
  function ingestChatMessage(msg) {
    if (isClosed()) return;
    // Discord の場（開きかけ・開いている・閉じかけ）にはコメントが無い（discord-mode.md §4.3）。場が閉じている間に Connect した
    // 器官のコメントは、弾く判定にも正本にも回さずに捨てる（ユーザーの Connect は切らない・器官は畳まない）。名前・本文を出さないため、
    // 診断もログも出さない。
    if (discordVenueActive()) return;
    try {
      const text = msg && typeof msg.text === "string" ? msg.text : "";
      const displayName = msg && typeof msg.displayName === "string" ? msg.displayName : undefined;
      if (text.trim().length === 0) return; // 空コメントは捨てる（バッファも捨てる・二度手間を避ける）。
      const buffer = getTranscript();
      if (!buffer) {
        // 合流先の正本バッファが無い。UI にゴースト行を出し、判定・append/scheduler はスキップ。
        handleDiagnostic({
          type: "chatBufferAbsent",
          message: CHAT_BUFFER_ABSENT_MESSAGE,
          reason: displayName ?? null
        });
        return;
      }
      const { videoId, messageId } = msg ?? {};
      if (typeof videoId === "string" && videoId.length > 0 && typeof messageId === "string" && messageId.length > 0) {
        const key = JSON.stringify([videoId, messageId]);
        if (receivedComments.has(key)) return;
        // ガード判定を待つ間の再着も、ここで止める。
        receivedComments.add(key);
      }
      commentIntake.submit(msg, text, displayName);
    } catch (error) {
      handleDiagnostic({ type: "chatIngestError", message: errMessage(error) });
    }
  }

  function handleCommentGuardDecision(slot) {
    const { decision } = slot;
    reportComment({
      stage: "guard",
      commentId: slot.id,
      pass: decision.pass,
      kind: decision.kind,
      verdict: decision.verdict,
      hijackProbability: decision.hijackProbability,
      latencyMs: decision.latencyMs,
      error: decision.error
    });
    if (decision.pass) commitComment(slot);
    else rejectComment(slot);
    if (!decision.pass && decision.kind === "error") warnJudgeError("comment-guard", decision.error);
  }

  /**
   * 弾いたコメントをフィードに 1 行だけ知らせる（種類と ID・本文と名前は送らない）。
   * @param {{ id: string; text: string; decision: any }} slot
   */
  function rejectComment(slot) {
    broadcast("chatDiagnostic", {
      kind: "commentRejected",
      message: null,
      atMs: nowImpl(),
      delayMs: null,
      attempt: null,
      commentId: slot.id,
      reject: slot.decision.kind,
      error: slot.decision.error,
      latencyMs: slot.decision.latencyMs
    });
  }

  /**
   * 通ったコメントを今と同じく積んで放送し、発火判定へ回す（(a)(b)(c)）。speak-now モードなら反応する判定へ（(d)）。
   * @param {{ id: string; text: string; displayName: string | undefined; arrivedAtMs: number }} slot
   */
  function commitComment(slot) {
    // 守りの 2 層目: Discord の場では積まない（ingestChatMessage の入口で捨てているので今の作りでは届かない。何も出さない）。
    if (discordVenueActive()) return;
    const { text, displayName } = slot;
    const buffer = getTranscript();
    if (!buffer) {
      // 判定を待つ間に耳が止まった = 合流先が無い（取り込み時と同じ扱い）。
      handleDiagnostic({
        type: "chatBufferAbsent",
        message: CHAT_BUFFER_ABSENT_MESSAGE,
        reason: displayName ?? null
      });
      return;
    }
    const result = buffer.append({ startMs: 0, endMs: 0, text, speaker: "viewer", displayName });
    if (!result.appended || !result.entry) return; // blank discard 等。
    // (b) viewer 行を放送（耳の onTranscript は viewer を除外＝ここが唯一の放送元）。commentId は追加フィールド。
    const stats = buffer.stats();
    broadcast("transcript", {
      ...toWireEntry(result.entry),
      latencyMs: null,
      audioCtx: null,
      appended: stats.appended,
      discarded: stats.discarded,
      commentId: slot.id
    });
    // (c) 発火スケジューラへ（従来モードは comment / comment-call 判定・speak-now モードは活動の反映だけ）。
    // scheduler 未生成なら活動反映もスキップ。
    onSchedulerComment({ text, displayName });
    // (d) 反応する判定（speak-now モード・自発 ON・KILL でないときだけ・部品内で判定）。
    onReactionComment({
      id: slot.id,
      seq: result.entry.seq,
      text,
      displayName: displayName ?? null,
      arrivedAtMs: slot.arrivedAtMs
    });
  }

  /**
   * チャット器官の状態遷移を SSE "chatStatus" に載せる口（Domain C の onStatus フックから呼ぶ）。
   * 状態表示（connecting/live/retrying/dead）は Domain C が描く。
   * @param {string} status
   */
  function broadcastChatStatus(status) {
    if (isClosed()) return;
    lastChatStatus = typeof status === "string" ? status : String(status);
    broadcast("chatStatus", { status: lastChatStatus });
    refreshStateWarnings();
  }

  /**
   * チャット器官の診断を SSE "chatDiagnostic" に載せる口（Domain C の onDiagnostic フックから呼ぶ）。
   * 取得死/抽出失敗のゴースト行は Domain C が描く。診断オブジェクトはそのまま透過（token 等は器官側で
   * 載せない前提・Domain A は URL/token を診断に含めない）。
   * @param {any} info
   */
  function broadcastChatDiagnostic(info) {
    if (isClosed()) return;
    broadcast("chatDiagnostic", {
      kind: info?.kind ?? null,
      message: info?.message ?? null,
      atMs: info?.atMs ?? null,
      delayMs: info?.delayMs ?? null,
      attempt: info?.attempt ?? null
    });
  }

  /**
   * 稼働中のチャット器官を畳む（フック購読解除 + stop()・冪等）。器官は dead へ落ち、以後の自動
   * 再接続タイマを残さない（Domain A の stop() 契約）。connect の作り直し・disconnect・close で使う。
   */
  function foldChatClient() {
    for (const unsub of chatUnsubs) {
      try {
        unsub();
      } catch {
        // best-effort（購読解除の失敗で畳みを止めない）。
      }
    }
    chatUnsubs = [];
    lastChatStatus = null;
    if (chatClient) {
      const c = chatClient;
      chatClient = null;
      try {
        c.stop();
      } catch {
        // best-effort（既に dead でも冪等）。
      }
    }
  }

  /**
   * チャット器官を生成して Connect する（POST /api/chat/connect の実体・ear-pipeline の遅延起動の流儀）。
   * 既存器官があれば先に畳んでから**新しい source で作り直す**（ended で dead に落ちた器官の restart は
   * 無い＝Connect 再操作で新器官を生成する・Domain A §7-2）。onMessage→ingestChatMessage /
   * onStatus→broadcastChatStatus / onDiagnostic→broadcastChatDiagnostic を繋ぐ（器官の外から hooks
   * 経由・逆方向 import を作らない）。start() は bootstrap + 初回 poll を await する（notLive/network は
   * 内部で retrying をスケジュールして即 return するので、ここで無限に待たされない・Domain A）。
   * @param {string} source  配信 URL / video ID / チャンネル `/live` URL。
   * @returns {Promise<void>}
   */
  async function connectChat(source) {
    // この起動で Connect した source を覚える（次の「配信を始める」でもつなぐ・配信の組み直し 仕上げ）。
    chatSourceThisBoot = source;
    foldChatClient(); // 作り直し: 既存器官を畳んでから新規生成（同一インスタンス restart は無い）。
    const client = /** @type {any} */ (chatClientFactory)({ source });
    chatClient = client;
    // フックを取り込み経路へ結線（購読解除は畳み時に全撤去）。器官のフック throw は器官側が握る（Domain A）。
    chatUnsubs.push(client.onMessage(ingestChatMessage));
    chatUnsubs.push(client.onStatus((/** @type {any} */ state) => broadcastChatStatus(state)));
    chatUnsubs.push(client.onDiagnostic((/** @type {any} */ info) => broadcastChatDiagnostic(info)));
    // 永続化（次回起動で入力欄に復元・失敗寛容）。source は YouTube 公開 URL/ID＝token を含まない。
    if (typeof onSetChatSource === "function") {
      try {
        await onSetChatSource(source);
      } catch {
        // 永続化失敗は Connect を止めない（onSetChannelUrl と同型の失敗寛容）。
      }
    }
    await client.start();
  }

  /** @param {string | null} source */
  function setSource(source) {
    chatSourceThisBoot = source;
    if (typeof onSetChatSource === "function") return persistSource(source);
  }

  async function persistSource(source) {
    try {
      await onSetChatSource(source);
    } catch {
      // 保存できなくてもこの起動の中では入力を覚える。
    }
  }

  function disconnect() {
    chatSourceThisBoot = null;
    foldChatClient();
  }

  return {
    startForStream,
    connect: connectChat,
    setSource,
    disconnect,
    fold: foldChatClient,
    ingestChatMessage,
    broadcastChatStatus,
    broadcastChatDiagnostic,
    clearPending: commentIntake.clear,
    clearReceived: () => receivedComments.clear(),
    hasPending: commentIntake.hasPending,
    getWarningStatus: () => chatClient ? (lastChatStatus ?? chatClient.getState()) : null,
    snapshot: () => ({
      source: typeof chatSourceStatus === "function" ? (chatSourceStatus()?.source ?? null) : null,
      connected: chatClient != null,
      state: chatClient ? chatClient.getState() : null,
      enteredThisBoot: chatSourceThisBoot != null
    })
  };
}
