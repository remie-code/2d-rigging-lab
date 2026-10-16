// @ts-check
/**
 * speak-now（話し始めの判定）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/decisions/speak-now/integration.md。配信者（you）の転写が転写バッファに
 * 1 件積まれるたびに、判定エンジン（judge）に「今どう反応するのが自然か」を 4 択（待つ / 相槌 / 応答 /
 * 自発）で聞き、応答・自発なら通常の自発発火と同じ発火を要求する。fire-scheduler の**外の別部品**
 * （合意 §4）。fire-scheduler には「speak-now の間は turn-end / call / interjection を止める」スイッチ
 * だけがあり、この部品は scheduler を知らない（結線は cockpit-server）。
 *
 * ── 判定（合意 §1）────────────────────────────────────────────────────────
 *  - 問い C（scripts/probe-decisions-speak-now.mjs の `QUESTIONS.c`）の頭に、口数モードに対応した
 *    性格の 1 文（同 `PERSONAS`）を付ける。{名前} は今の頭の identity（チャッピー / コーディ）。
 *  - 選択肢 v2（同 `CHOICES_V2`）。名前は identity に合わせて差し込む。
 *  - 入力: 直近 3 分の会話（「配信者: …」「{名前}: …」）。行数の上限なし。視聴者コメントは入れない。
 *  - 結果は最大確率の選択（judge が返す choice）をそのまま使う（しきい値なし）。
 *
 * ── 動き（合意 §2）と タイミング（合意 §3）─────────────────────────────────────
 *  - 応答・自発 → onFire（結線層が通常の自発発火と同じ fire を呼ぶ）。相槌・待つ → 発火しない。
 *  - 口数ごとの不応期・確率は掛けない（口数は性格の 1 文だけで効かせる）。
 *  - 忙しい間（isBusy）は判定を呼ばず、you の転写を数えておく。忙しさが明けたとき（notifyIdle）、
 *    その間に 1 件以上あれば 1 回だけ判定する。
 *  - 判定中に次の発言が来たら、前の判定を待たずに並行して呼ぶ。結果が返った時点で空いていて
 *    応答・自発なら発火する。忙しければ捨てる（判定行は出す）。
 *  - 判定を待つ間に配信者が喋り始めても判定は捨てない（VAD はこの部品に入れない）。
 *  - isActive が偽（speak-now モードでない・自発 pill OFF・KILL 中）の間は判定を呼ばない。
 *
 * 依存（judge・バッファ・busy・identity・口数・通知先・時計）は全部注入。純ロジックとして fake で
 * 全分岐をテストする。
 */

/** 判定の入力に入れる会話の幅（直近 3 分・合意 §1）。 */
export const SPEAK_NOW_CONTEXT_MS = 180_000;

/** 会話の配信者側のラベル（合意 §1）。 */
export const SPEAK_NOW_HOST_LABEL = "配信者";

/** 選択肢の表示名（フィードの「判定: 自発 0.45」）。 */
export const SPEAK_NOW_CHOICE_LABELS = Object.freeze({
  wait: "待つ",
  backchannel: "相槌",
  respond: "応答",
  initiate: "自発"
});

/** 発火する選択（合意 §2）。 */
export const SPEAK_NOW_FIRE_CHOICES = Object.freeze(["respond", "initiate"]);

/**
 * 問い C（probe の QUESTIONS.c の「チャッピー」を {名前} にしたもの）。
 * @param {string} name
 */
export function speakNowQuestion(name) {
  return `ゲーム配信で配信者の隣にいるサポート役の AI Tuber「${name}」として、配信者の発言をここまで聞いた今、どう反応するのが自然か？ 配信者の話がまだ途中なら待ち、話し終えていればどう反応するかを選ぶ。`;
}

/**
 * 口数モードに対応した性格の 1 文（probe の PERSONAS の「チャッピー」を {名前} にしたもの）。
 * 未知の mode は normal（fire-scheduler の「未知値は normal」と同じ規律）。
 * @param {string | null | undefined} verbosity  quiet / normal / chatty
 * @param {string} name
 */
export function speakNowPersonaLine(verbosity, name) {
  switch (verbosity) {
    case "quiet":
      return `${name}は聞き役に徹する控えめな性格で、自分から話すのは本当に言いたいことがあるときだけ。`;
    case "chatty":
      return `${name}は話好きなおしゃべりな性格で、思ったことはすぐ口に出し、自分からどんどん話題を出す。`;
    default:
      return `${name}はふつうの相方で、話を振られたら答え、ときどき自分からも感想を言う。`;
  }
}

/**
 * 判定の問い（性格の 1 文 + 問い C）。
 * @param {{ name: string; verbosity?: string | null }} p
 */
export function buildSpeakNowInstructions({ name, verbosity }) {
  return `${speakNowPersonaLine(verbosity, name)} ${speakNowQuestion(name)}`;
}

/**
 * 選択肢 v2（probe の CHOICES_V2 の「チャッピー」を {名前} にしたもの）。
 * @param {string} name
 * @returns {Array<{ value: "wait" | "backchannel" | "respond" | "initiate"; description: string }>}
 */
export function buildSpeakNowChoices(name) {
  return [
    {
      value: "wait",
      description: `待つ: 何もしない。配信者がまだ話しそう（言いかけ・考え中・「えーと」の途中）なときや、${name}に向けた発言ではない（独り言・ゲームへの悪態・読み上げ・視聴者への説明）とき。`
    },
    { value: "backchannel", description: "相槌を打つ: 聞いているサインだけ返す（「うん」「へー」「なるほど」）。話の主導権は取らない。" },
    {
      value: "respond",
      description: "応答する: 配信者の発言に答える必要がある（質問された・話を振られた・同意や意見を求められた）ので、ちゃんと返事をする。"
    },
    {
      value: "initiate",
      description: "自発的に話す: 答える必要はないが、自分から言いたいことがある（感想・ツッコミ・補足・話題）ので話し始める。"
    }
  ];
}

/**
 * 転写バッファのエントリ列 → 判定の入力（直近 windowMs の「配信者: …」「{名前}: …」）。
 * you / soul だけを使う（viewer は入れない・合意 §1）。空文字の行は捨てる。時刻は appendedAtMs
 * （you と soul を同じ実時間軸で並べる・transcript-buffer の流儀）。appendedAtMs が数でない行は
 * 窓の判定をせずに入れる（防御的）。
 * @param {ReadonlyArray<{ speaker?: string; text?: string; appendedAtMs?: number }>} entries
 * @param {{ nowMs: number; soulName: string; windowMs?: number }} p
 * @returns {string}
 */
export function buildSpeakNowInput(entries, { nowMs, soulName, windowMs = SPEAK_NOW_CONTEXT_MS }) {
  const from = nowMs - windowMs;
  /** @type {string[]} */
  const lines = [];
  for (const e of entries ?? []) {
    if (!e || (e.speaker !== "you" && e.speaker !== "soul" && e.speaker !== undefined)) continue;
    const text = typeof e.text === "string" ? e.text.trim() : "";
    if (text.length === 0) continue;
    if (typeof e.appendedAtMs === "number" && Number.isFinite(e.appendedAtMs) && e.appendedAtMs < from) continue;
    const label = e.speaker === "soul" ? soulName : SPEAK_NOW_HOST_LABEL;
    lines.push(`${label}: ${text}`);
  }
  return lines.join("\n");
}

/**
 * @typedef {"transcript" | "after-busy"} SpeakNowTrigger
 * @typedef {{
 *   trigger: SpeakNowTrigger;
 *   choice: string;
 *   probability: number | null;
 *   probs: Record<string, number>;
 *   latencyMs: number | null;
 *   action: "fire" | "drop-busy" | "drop-inactive" | "none";
 * }} SpeakNowJudgment
 * @typedef {{ trigger: SpeakNowTrigger; message: string; latencyMs: number | null }} SpeakNowJudgeFailure
 */

/**
 * speak-now の判定を回す部品を作る。
 * @param {object} options
 * @param {(request: { input: string; instructions: string; choices: ReadonlyArray<{ value: string; description: string }> }) =>
 *   Promise<{ choice: string; probs?: Record<string, number>; latencyMs?: number }>} options.judge  判定エンジン（差し替え可能）。
 * @param {() => ReadonlyArray<any>} options.getEntries  転写バッファの全エントリ（耳未起動なら空）。
 * @param {() => boolean} options.isBusy  チャッピーが考えて喋り終わるまでの間か。
 * @param {() => boolean} options.isActive  判定を呼んでよいか（speak-now モード・自発 ON・KILL でない）。
 * @param {() => string} options.getName  今の頭の名前（チャッピー / コーディ）。
 * @param {() => string | null | undefined} options.getVerbosity  口数モード（quiet / normal / chatty）。
 * @param {(request: { choice: string }) => void} options.onFire  応答・自発で発火を要求する。
 * @param {(judgment: SpeakNowJudgment) => void} [options.onJudgment]  判定結果（待つも含め毎回）。
 * @param {(failure: SpeakNowJudgeFailure) => void} [options.onError]  判定の失敗（キー欠落・タイムアウト等）。
 * @param {() => number} [options.nowImpl=Date.now]  入力の窓の基準時刻（appendedAtMs と同じ時計）。
 * @returns {{
 *   handleTranscript: (entry: { speaker?: string } | null) => void;
 *   notifyIdle: () => void;
 *   reset: () => void;
 *   pendingWhileBusy: () => number;
 *   inFlight: () => number;
 *   dispose: () => void;
 * }}
 */
export function createSpeakNowController(options) {
  if (options == null || typeof options !== "object") {
    throw new TypeError("createSpeakNowController: options is required.");
  }
  const { judge, getEntries, isBusy, isActive, getName, getVerbosity, onFire } = options;
  for (const [k, v] of Object.entries({ judge, getEntries, isBusy, isActive, getName, getVerbosity, onFire })) {
    if (typeof v !== "function") throw new TypeError(`createSpeakNowController: options.${k} must be a function.`);
  }
  const onJudgment = typeof options.onJudgment === "function" ? options.onJudgment : () => {};
  const onError = typeof options.onError === "function" ? options.onError : () => {};
  const nowImpl = options.nowImpl ?? Date.now;

  let disposed = false;
  /** 忙しい間に積まれた you の転写の数（明けたときに 1 回判定するかの材料）。 */
  let pending = 0;
  /** 返事待ちの判定の数（診断・テスト用）。 */
  let inFlight = 0;

  /** 通知先の throw で判定経路を壊さない。 */
  const safe = (/** @type {() => void} */ fn) => {
    try {
      fn();
    } catch {
      // best-effort。
    }
  };

  /** @param {SpeakNowTrigger} trigger */
  const runJudge = (trigger) => {
    const name = getName();
    const input = buildSpeakNowInput(getEntries() ?? [], { nowMs: nowImpl(), soulName: name });
    if (input.length === 0) return; // 窓に会話が無い（判定する材料が無い）。
    const request = {
      input,
      instructions: buildSpeakNowInstructions({ name, verbosity: getVerbosity() }),
      choices: buildSpeakNowChoices(name)
    };
    /** @type {Promise<any>} */
    let p;
    try {
      p = Promise.resolve(judge(request));
    } catch (error) {
      p = Promise.reject(error);
    }
    inFlight += 1;
    p.then(
      (result) => {
        inFlight -= 1;
        if (disposed) return;
        const choice = result && typeof result.choice === "string" ? result.choice : "";
        const probs = result && result.probs && typeof result.probs === "object" ? result.probs : {};
        const probability = typeof probs[choice] === "number" ? probs[choice] : null;
        const latencyMs = result && typeof result.latencyMs === "number" ? result.latencyMs : null;
        /** @type {SpeakNowJudgment["action"]} */
        let action = "none";
        if (SPEAK_NOW_FIRE_CHOICES.includes(choice)) {
          // 結果が返った時点で判断する（合意 §3）。忙しければ捨てる・モード外/OFF/KILL も捨てる。
          if (!isActive()) action = "drop-inactive";
          else if (isBusy()) action = "drop-busy";
          else action = "fire";
        }
        safe(() => onJudgment({ trigger, choice, probability, probs, latencyMs, action }));
        if (action === "fire") safe(() => onFire({ choice }));
      },
      (error) => {
        inFlight -= 1;
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        const latencyMs = error && typeof error.latencyMs === "number" ? error.latencyMs : null;
        safe(() => onError({ trigger, message, latencyMs }));
      }
    );
  };

  return {
    /**
     * 転写バッファへの append を 1 件食わせる（you 以外は無視）。忙しい間は数えるだけ。
     * @param {{ speaker?: string } | null} entry
     */
    handleTranscript(entry) {
      if (disposed || entry == null || typeof entry !== "object") return;
      if ((entry.speaker ?? "you") !== "you") return;
      if (!isActive()) return;
      if (isBusy()) {
        pending += 1;
        return;
      }
      runJudge("transcript");
    },
    /**
     * 忙しさが明けたかもしれないときに呼ぶ（orchestrator が idle に戻った・発火の Promise が片付いた）。
     * 本当に空いていて、忙しい間に you の転写が 1 件以上あったら 1 回だけ判定する。
     */
    notifyIdle() {
      if (disposed || pending === 0 || isBusy()) return;
      pending = 0;
      if (!isActive()) return;
      runJudge("after-busy");
    },
    /** 忙しい間の積み残しを捨てる（モード切替時）。 */
    reset() {
      pending = 0;
    },
    pendingWhileBusy: () => pending,
    inFlight: () => inFlight,
    /** 畳む（以後の入力・返ってきた結果は無視）。 */
    dispose() {
      disposed = true;
      pending = 0;
    }
  };
}
