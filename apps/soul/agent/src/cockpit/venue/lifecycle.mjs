/**
 * Holds the phase and generation of the current Cockpit venue.
 * The server supplies the role, conversation and device operations.
 */
export function createVenueLifecycle({
  broadcastState,
  checkOpening,
  clearVenue,
  copyTranscript,
  createTaskResources,
  currentExperience,
  currentRecallDesk,
  drainVenueTasks,
  errMessage,
  foldStream,
  foldVenue,
  freezeVenue,
  hasTranscript,
  installEars,
  normalizeEntranceResult,
  nowImpl,
  openVenueTranscript,
  parkRecallDesk,
  prepareVoices,
  releaseVenueTasks,
  releaseVenueTranscript,
  reportVoiceFailure,
  resetConversation,
  resolveVoiceKind,
  runRoleHooks,
  saveRecording,
  serverClosed,
  snapshot,
  startVenueEyes,
  startVenueVoiceResources,
  stopAcceptingTasks,
  streamBusyMessage,
  unexpectedVenueErrorMessage,
  venueControlContext,
  venueEntranceContext
}) {
  /** @type {"closed" | "opening" | "open" | "closing"} */
  let streamPhase = "closed";
  /** @type {string | null} */
  let streamError = null;
  /** @type {number | null} */
  let streamOpenedAtMs = null;
  /** @type {Promise<any> | null} */
  let streamTransition = null;
  let streamGeneration = 0;

  function markClosed() {
    streamPhase = "closed";
    streamOpenedAtMs = null;
    clearVenue();
  }

  function markClosing() {
    streamPhase = "closing";
  }

  async function trackTransition(run) {
    streamTransition = run;
    try {
      return await run;
    } finally {
      if (streamTransition === run) streamTransition = null;
    }
  }

  /**
   * 配信を始める（stream-restructure.md §3）。場が閉じているときだけ。途中で失敗したら、それまでに起こしたものを畳んで
   * 閉じた状態に戻し、理由を返す（snapshot の stream.error にも残す・メイン画面から押したときにも見える）。
   * Discord モード Domain B: request.experience で体験を選ぶ（省けば配信）。Discord の口が無ければ 503 で断る（場は開かない・
   * stream.error には残さない）。知らない体験は 400。
   * @param {{ device?: string | null; sttEngine?: any; ttsEngine?: any; experience?: any; discordVenue?: any }} [request]
   * @returns {Promise<{ ok: true; state: object } | { ok: false; status: number; error: string; state: object }>}
   */
  async function openStream(request = {}) {
    if (serverClosed()) return { ok: false, status: 503, error: "cockpit server is closing.", state: snapshot() };
    if (streamPhase !== "closed") return { ok: false, status: 409, error: streamBusyMessage(), state: snapshot() };
    const checked = checkOpening(request);
    if (!checked.ok) return checked;
    const { experience } = checked;
    request = checked.request;
    // 1. ロールの一覧を固める（ここから閉じるまで POST /api/role は断る・一覧も替えない）。
    streamPhase = "opening";
    freezeVenue(experience);
    streamGeneration += 1;
    createTaskResources();
    streamError = null;
    broadcastState();
    /** @param {string} reason @param {{ ears?: boolean; session?: boolean }} started */
    const fail = async (reason, started) => {
      parkRecallDesk();
      try {
        await foldStream({ chat: false, ears: started.ears === true, session: started.session === true });
      } catch {
        // 畳むのが想定外に投げても、閉じた状態には戻す（下）。
      }
      // 会話の正本も手放す（入口を開く前・入口が開かなかったときも。場が閉じている間は正本が無い＝従来どおり）。
      releaseVenueTranscript();
      try {
        await releaseVenueTasks();
      } catch (error) {
        reason += `（${errMessage(error)}）`;
      }
      markClosed();
      streamError = reason;
      broadcastState();
      return { ok: /** @type {const} */ (false), status: 500, error: reason, state: snapshot() };
    };
    const steps = async () => {
      // 2. 場の記録を作り直す（ロールごと: この場の記憶の保存の持ち回り・頭の文脈の記録のファイル・そのロールの置き場の準備）。
      const renewed = await runRoleHooks("renewRecords");
      if (!renewed.ok) return fail(`場の記録を作り直せない（${renewed.reason}）`, {});
      // 3. KILL を解除し、判定・発火・思い出しを今回の場に切り替える。
      resetConversation();
      // 4. 会話の正本（場の共通の段が作る・Discord モード Domain A）。
      openVenueTranscript();
      // 5. 入口を開く（体験の口）。下見（配信: マイク・文字起こしと声の方式・Starting・キーとモデルの確かめ）→ 6 の前半 →
      //    開く（配信: 耳を起こす）。
      const prepared = normalizeEntranceResult(await experience.prepareEntrance(request, venueControlContext()), "入口を開けない");
      if (!prepared.ok) return fail(prepared.reason, {});
      // 6 の前半. 声の engine の用意（場の共通の段・ロールごと）。今も入口を開く前（配信: 耳を起こす前・文字起こしのキー
      //    切れの後）。用意できなければ入口を開かずに場を開かない（文字起こしのキー切れと同じ流儀・自動で AivisSpeech に戻さない）。
      const voiceKind = resolveVoiceKind(prepared);
      const voiced = await prepareVoices(voiceKind);
      if (!voiced.ok) {
        experience.abortEntrance(prepared, venueControlContext());
        reportVoiceFailure(voiceKind, voiced.reason);
        return fail(voiced.reason, {});
      }
      // 正本が無ければ入口を開かない（開く段の順の誤り・サーバを閉じた途中など。耳に自前の正本を持たせて隠さない）。
      if (!hasTranscript()) {
        experience.abortEntrance(prepared, venueControlContext());
        return fail("会話の正本が無い（入口を開けない）", {});
      }
      const opened = normalizeEntranceResult(await experience.openEntrance(prepared.plan, venueEntranceContext()), "入口を開けない");
      if (!opened.ok) return fail(opened.reason, {});
      installEars(opened.ears);
      // 6 の後半. 再生器（場の共通の段・ロールごと）。7. 目（場の共通の段）。待たない・失敗しても場は止めない。
      startVenueVoiceResources();
      startVenueEyes();
      // 8. 頭のセッション（ロールごと）。
      const session = await runRoleHooks("openSession");
      if (!session.ok) return fail(session.reason, { ears: true, session: true });
      // 9. 体があれば器（ロールごと・体なしは cockpit.mjs が何もしない）。つながらなければ場は開かない。
      const body = await runRoleHooks("connectBody");
      if (!body.ok) return fail(body.reason, { ears: true, session: true });
      streamPhase = "open";
      streamOpenedAtMs = nowImpl();
      // 10. 開いたあと（体験の口・配信は YouTube を後ろでつなぐ・待たない）。失敗しても場は開いたまま。
      try {
        experience.afterOpen();
      } catch {
        // best-effort
      }
      broadcastState();
      return { ok: /** @type {const} */ (true), state: snapshot() };
    };
    const run = (async () => {
      try {
        return await steps();
      } catch (error) {
        // 想定外の例外（工場関数・畳むの throw など）でも opening のまま固めない: 起こしたかもしれないものを全部畳んで閉じる。
        // Discord モード Domain D: 文面は体験の口から（配信は今の文面・Discord は生のエラー文を入れない文面）。
        return fail(unexpectedVenueErrorMessage(experience, "opening", error), { ears: true, session: true });
      }
    })();
    return trackTransition(run);
  }

  /**
   * 配信を終える（stream-restructure.md §3）。場が開いているときだけ（閉じていれば何もしない）。
   * @returns {Promise<{ ok: true; state: object } | { ok: false; status: number; error: string; state: object }>}
   */
  async function closeStream() {
    if (streamPhase === "closed") return { ok: true, state: snapshot() };
    if (streamPhase !== "open") return { ok: false, status: 409, error: streamBusyMessage(), state: snapshot() };
    markClosing();
    const desk = currentRecallDesk();
    stopAcceptingTasks();
    parkRecallDesk(true);
    broadcastState();
    const saveFinal = async (/** @type {ReadonlyArray<any>} */ transcript) => {
      await drainVenueTasks(desk);
      await saveRecording(transcript);
    };
    const run = (async () => {
      /** @type {{ ok: true } | { ok: false; status: number; error: string }} */
      let outcome = { ok: true };
      /** @type {ReadonlyArray<any> | null} */
      let transcript = null;
      // 記憶の最後の保存を頼んだか（想定外の例外の道で二度頼まないため）。
      let finalSaveRequested = false;
      try {
        // 1. 会話の正本の写しを取る（畳むと消える）。
        transcript = copyTranscript();
        // 2. YouTube・判定・発火の予定・目・耳・頭のセッション・器を畳む。後ろでつないでいる YouTube（始める 7）は待たない:
        //    器官はもう chatClient に入っているのでここで畳む。あとからつながっても場の世代で見分けて残さない（startChatForStream）。
        await foldVenue();
        // 3. 受付済みの仕事を待ち、会話と資料・返答を記憶の保存と整理に渡す。
        finalSaveRequested = true;
        await saveFinal(transcript);
      } catch (error) {
        // 想定外の例外でも closing のまま固めない: 畳み残しをもう一度畳んで（best-effort）から閉じる。
        // 配信の組み直し 仕上げ・Undine の追認: 記憶を落とさない側に倒す。最後の保存がまだ頼まれていなければ 1 回だけ
        // 頼む（写しが取れていなければ、耳が残っていればもう一度だけ写しを試す。取れなければ空で頼む）。
        if (transcript == null) {
          try {
            transcript = copyTranscript();
          } catch {
            transcript = [];
          }
        }
        try {
          await foldVenue();
        } catch {
          // best-effort
        }
        if (!finalSaveRequested) {
          finalSaveRequested = true;
          try {
            await saveFinal(transcript);
          } catch {
            // best-effort（保存の口を引くこと自体が投げても閉じる）。
          }
        }
        outcome = { ok: false, status: 500, error: unexpectedVenueErrorMessage(currentExperience(), "closing", error) };
      }
      try {
        // 4. 保存と整理の後で場の資料を解放する。
        await releaseVenueTasks();
      } catch (error) {
        outcome = { ok: false, status: 500, error: errMessage(error) };
        streamError = outcome.error;
      }
      // 5. 場を閉じ、ロールの一覧と体験を手放す。途中で投げても閉じる。
      markClosed();
      if (!serverClosed()) broadcastState();
      return { ...outcome, state: snapshot() };
    })();
    return trackTransition(run);
  }

  /**
   * Ctrl+C の「配信を終える」（cockpit.mjs の shutdown）。開きかけ・閉じかけなら終わるのを待ってから、開いていれば
   * 終える（HTTP の終える は途中を 409 で断るが、Ctrl+C は断らずに待つ）。
   * @returns {Promise<object>}
   */
  async function endStreamForShutdown() {
    while (streamTransition) {
      try {
        await streamTransition;
      } catch {
        // best-effort
      }
    }
    if (streamPhase === "open") await closeStream();
    return snapshot();
  }

  return {
    get phase() { return streamPhase; },
    get error() { return streamError; },
    get openedAtMs() { return streamOpenedAtMs; },
    get generation() { return streamGeneration; },
    setError(error) { streamError = error; },
    markClosing,
    markClosed,
    openStream,
    closeStream,
    endStreamForShutdown
  };
}
