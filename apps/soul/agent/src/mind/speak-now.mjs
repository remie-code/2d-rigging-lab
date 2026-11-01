// @ts-check
/**
 * speak-now（話し始めの判定）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/decisions/speak-now/integration.md（相槌は backchannel.md で改めた）。配信者（you）の
 * 転写が転写バッファに 1 件積まれるたびに、判定エンジン（judge）に「今どう反応するのが自然か」を 5 択（待つ /
 * 相槌 / 応答 / 自発 / 画面を見る）で聞き、待つ以外なら発火を要求する。fire-scheduler の**外の別部品**
 * （合意 §4）。fire-scheduler には「speak-now の間は turn-end / call / interjection を止める」スイッチ
 * だけがあり、この部品は scheduler を知らない（結線は cockpit-server）。
 *
 * ── 判定（合意 §1）────────────────────────────────────────────────────────
 *  - 問い C（scripts/probe-decisions-speak-now.mjs の `QUESTIONS.c`）の頭に、口数モードに対応した
 *    性格の 1 文（同 `PERSONAS`）を付ける。{名前} は今の頭の identity（チャッピー / コーディ）。
 *  - 選択肢 v2（同 `CHOICES_V2`）。名前は identity に合わせて差し込む。その後ろに「画面を見る」（look）を足す
 *    （discussion/ai-cohost/decisions/speak-now/experiments/04-look-request.md・e2・2026-10-22 採用）。チャッピーの目は
 *    発火したときにだけ画面を撮るので、「画面見て」に応えるには発火が要る。説明は「今の画面を見てから反応する。」
 *    だけで、事情の一文やキーワードのルールは足さない。
 *  - 入力: 直近 3 分の会話（「配信者: …」「{名前}: …」）。行数の上限なし。視聴者コメントは入れない。
 *  - 結果は最大確率の選択（judge が返す choice）をそのまま使う（しきい値なし）。
 *
 * ── 動き（合意 §2）と タイミング（合意 §3）─────────────────────────────────────
 *  - 応答・自発 → onFire（結線層が通常の自発発火と同じ fire を呼ぶ）。待つ → 発火しない。
 *  - 画面を見る → onFire（choice:"look"）。結線層は応答と同じく画面付き（vision:"preferred"）で発火する。追加の
 *    指示は付けず、撮れなかったときの特別扱いもしない（04-look-request.md）。after-busy・歯止めも応答と同じ扱い。
 *  - 相槌 → onFire（choice:"backchannel"）。結線層は同じ頭・同じセッションで、応答と同じく画面も見て
 *    （vision:"preferred"・2026-10-17 改め）、その 1 回だけ先頭に SPEAK_NOW_BACKCHANNEL_INSTRUCTION を付けて
 *    発火する（discussion/ai-cohost/decisions/speak-now/backchannel.md §2・§4。integration.md §2 の
 *    「相槌 → 何もしない」を改めたもの）。
 *    歯止め: 前の相槌を喋り始めてから backchannelMinIntervalMs（既定 8 秒）の間は、判定が相槌でも発火せず流す
 *    （action "skip-interval"）。相槌どうしにだけ効かせる（応答・自発は数え始めにも歯止めにも関わらない）。
 *    数え始めは結線層が markBackchannelSpoken() で知らせる（相槌の発火でチャッピーが喋り始めた時点）。
 *    相槌を喋ったあとは、その忙しさが明けても after-busy の判定をしない（積み残しは捨てる）。
 *  - 口数ごとの不応期・確率は掛けない（口数は性格の 1 文だけで効かせる）。
 *  - 忙しい間（isBusy）は判定を呼ばず、you の転写を数えておく。忙しさが明けたとき（notifyIdle）、
 *    その間に 1 件以上あれば 1 回だけ判定する。
 *  - 判定中に次の発言が来たら、前の判定を待たずに並行して呼ぶ。結果が返った時点で空いていて
 *    応答・自発・相槌・画面を見るなら発火する。忙しければ捨てる（判定行は出す）。
 *  - 判定を待つ間に配信者が喋り始めても判定は捨てない（VAD はこの部品に入れない）。
 *  - isActive が偽（speak-now モードでない・自発 pill OFF・KILL 中）の間は判定を呼ばない。
 *
 * ── きっかけの seq（操縦席の作り直し・cockpit-glance-redesign.md §9）──────────────────────────
 *  判定ごとに、きっかけになった配信者の行の seq（triggerSeq）を判定結果・失敗・発火の要求に載せる。
 *  transcript のきっかけはその転写の seq、after-busy は判定する時点で最後の配信者の行の seq（無ければ null）。
 *  発火の要求には選択の確率と判定の遅延も載せる（結線層が発火のきっかけ = cause にする）。
 *
 * ── 問いの組（Discord モード Domain C・discord-mode.md §8 の b）──────────────────────────────────
 *  問いの組み立て（問いの文・選択肢・入力の整形・you の行のラベル・相槌の発火の内部指示）は、外から questions で渡せる
 *  （体験の口の判定の組 judgeSet.speakNow。Discord の文面は DISCORD_SPEAK_NOW_QUESTIONS・Domain F）。渡さなければ今の配信の問い（STREAM_SPEAK_NOW_QUESTIONS）。
 *  忙しい間の数え・あとから（after-busy）・並行の判定・相槌の歯止めは、どの問いの組でも同じ（この部品が持つ）。
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
  initiate: "自発",
  look: "画面を見る"
});

/** 発火する選択（合意 §2・相槌は backchannel.md §2、画面を見るは 04-look-request.md で発火する側に入った）。 */
export const SPEAK_NOW_FIRE_CHOICES = Object.freeze(["respond", "initiate", "backchannel", "look"]);

/**
 * 相槌の発火で、その 1 回だけ ask の先頭に付ける内部指示（backchannel.md §2）。やり方（短く・一言で等）は
 * 書かない（LLM の自主性を尊重する・手段を示すとそれに縛られるため）。
 */
export const SPEAK_NOW_BACKCHANNEL_INSTRUCTION = "今は配信者の話に相槌を打つタイミング。";

/** 相槌どうしの最小間隔の既定（前の相槌を喋り始めてから 8 秒・backchannel.md §2）。 */
export const SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS = 8_000;

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
 * 選択肢 v2（probe の CHOICES_V2 の「チャッピー」を {名前} にしたもの）+ 後ろに「画面を見る」（04-look-request.md の e2）。
 * @param {string} name
 * @returns {Array<{ value: "wait" | "backchannel" | "respond" | "initiate" | "look"; description: string }>}
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
    },
    { value: "look", description: "画面を見る: 今の画面を見てから反応する。" }
  ];
}

/**
 * you の行のラベル（「配信者」。名前があれば「配信者(名前)」・Discord モード Domain A。配信では you に名前を入れないので
 * 「配信者」のまま）。label は問いの組の hostLabel（Discord モード Domain C・既定は SPEAK_NOW_HOST_LABEL）。
 * @param {unknown} displayName
 * @param {string} [label=SPEAK_NOW_HOST_LABEL]
 * @returns {string}
 */
function hostLabel(displayName, label = SPEAK_NOW_HOST_LABEL) {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  return name.length > 0 ? `${label}(${name})` : label;
}

/**
 * 転写バッファのエントリ列 → 判定の入力（直近 windowMs の「配信者: …」「{名前}: …」）。
 * you / soul だけを使う（viewer は入れない・合意 §1）。空文字の行は捨てる。時刻は appendedAtMs
 * （you と soul を同じ実時間軸で並べる・transcript-buffer の流儀）。appendedAtMs が数でない行は
 * 窓の判定をせずに入れる（防御的）。名前のある you の行は「配信者(名前)」。soul の行はロールの名前を持っていても
 * soulName（今の頭の名前）のまま。speakerId は読まない。you の行のラベルは hostLabel（既定は SPEAK_NOW_HOST_LABEL「配信者」・
 * 問いの組から差せる・Discord モード Domain C）。
 * @param {ReadonlyArray<{ speaker?: string; text?: string; displayName?: string; appendedAtMs?: number }>} entries
 * @param {{ nowMs: number; soulName: string; windowMs?: number; hostLabel?: string }} p
 * @returns {string}
 */
export function buildSpeakNowInput(entries, { nowMs, soulName, windowMs = SPEAK_NOW_CONTEXT_MS, hostLabel: label = SPEAK_NOW_HOST_LABEL }) {
  const from = nowMs - windowMs;
  /** @type {string[]} */
  const lines = [];
  for (const e of entries ?? []) {
    if (!e || (e.speaker !== "you" && e.speaker !== "soul" && e.speaker !== undefined)) continue;
    const text = typeof e.text === "string" ? e.text.trim() : "";
    if (text.length === 0) continue;
    if (typeof e.appendedAtMs === "number" && Number.isFinite(e.appendedAtMs) && e.appendedAtMs < from) continue;
    lines.push(`${e.speaker === "soul" ? soulName : hostLabel(e.displayName, label)}: ${text}`);
  }
  return lines.join("\n");
}

/**
 * @typedef {ReadonlyArray<{ value: string; description: string }>} SpeakNowChoices
 * @typedef {{
 *   hostLabel: string;
 *   buildInstructions: (p: { name: string; verbosity?: string | null }) => string;
 *   buildChoices: (name: string) => SpeakNowChoices;
 *   buildInput: (entries: ReadonlyArray<any>, p: { nowMs: number; soulName: string; hostLabel: string }) => string;
 *   backchannelInstruction: string;
 * }} SpeakNowQuestions
 *   speak-now の問いの組（Discord モード Domain C・discord-mode.md §8 の b）。
 *   - hostLabel: 判定の入力の you の行のラベル（配信は「配信者」）。buildInput に渡る。
 *   - buildInstructions: 判定の問い（性格の 1 文 + 問い）。
 *   - buildChoices: 選択肢（value は wait / backchannel / respond / initiate / look。発火するかは value で決まる）。
 *   - buildInput: 転写 → 判定の入力（空文字なら判定しない）。
 *   - backchannelInstruction: 相槌の発火で、その 1 回だけ ask の先頭に付ける内部指示（結線層が使う）。
 */

/** 配信の問いの組（今の問い・選択肢・入力の整形・ラベル・相槌の指示）。 */
export const STREAM_SPEAK_NOW_QUESTIONS = Object.freeze({
  hostLabel: SPEAK_NOW_HOST_LABEL,
  buildInstructions: buildSpeakNowInstructions,
  buildChoices: buildSpeakNowChoices,
  buildInput: buildSpeakNowInput,
  backchannelInstruction: SPEAK_NOW_BACKCHANNEL_INSTRUCTION
});

/** 問いの組の項目（並び）。 */
export const SPEAK_NOW_QUESTION_KEYS = Object.freeze(["hostLabel", "buildInstructions", "buildChoices", "buildInput", "backchannelInstruction"]);

// ── Discord の問いの組（Discord モード Domain F・discord-mode.md §8・scope §22「誰かが話したあと、今しゃべるか」）────────────
//  体験の口の判定の組 judgeSet.speakNow に置く（src/discord/discord-experience.mjs）。配信の問いの組は変えない。
//  - 性格の 1 文（speakNowPersonaLine）・相槌 / 自発 / 画面を見るの選択肢の説明・入力の整形（buildSpeakNowInput）は配信と共有する
//    （書きっぷりを 1 か所に置く）。替えるのは「配信者」「配信」の語が入っている所だけ（問い・待つ・応答の説明・you の行のラベル・
//    相槌の内部指示）。
//  - 選択肢の値は配信と同じ 5 つ（待つ / 相槌 / 応答 / 自発 / 画面を見る）。発火するかは値で決まる（部品が持つ）。
//  - 名前を呼ばれたかどうかは判定が文脈から見る（器の側で名前の照合をして判定を飛ばさない・scope §23）。
//  - コメント反応は Discord では作らない（問いの組も無い）。

/** Discord の判定の入力の you の行のラベル（通話に入っている人。名前があれば「参加者(名前)」）。 */
export const DISCORD_SPEAK_NOW_HOST_LABEL = "参加者";

/** Discord の相槌の発火で、その 1 回だけ ask の先頭に付ける内部指示（配信の SPEAK_NOW_BACKCHANNEL_INSTRUCTION の通話の語）。 */
export const DISCORD_SPEAK_NOW_BACKCHANNEL_INSTRUCTION = "今は通話の相手の話に相槌を打つタイミング。";

/**
 * Discord の問い（配信の speakNowQuestion の「ゲーム配信で配信者の隣にいる…」を通話の場にしたもの）。
 * @param {string} name
 */
export function discordSpeakNowQuestion(name) {
  return `Discord のボイスチャンネルの通話にいる相方の AI「${name}」として、参加者の発言をここまで聞いた今、どう反応するのが自然か？ 参加者の話がまだ途中なら待ち、話し終えていればどう反応するかを選ぶ。`;
}

/**
 * Discord の判定の問い（性格の 1 文は配信と同じ + Discord の問い）。
 * @param {{ name: string; verbosity?: string | null }} p
 */
export function buildDiscordSpeakNowInstructions({ name, verbosity }) {
  return `${speakNowPersonaLine(verbosity, name)} ${discordSpeakNowQuestion(name)}`;
}

/**
 * Discord の選択肢（配信の選択肢 v2 + 画面を見る と同じ並び・同じ値。「配信者」の入る待つ・応答の説明だけを通話の語にする。
 * 待つには「参加者どうしのやりとり」を足し、通話に無い「視聴者への説明」を外す）。
 * @param {string} name
 * @returns {Array<{ value: "wait" | "backchannel" | "respond" | "initiate" | "look"; description: string }>}
 */
export function buildDiscordSpeakNowChoices(name) {
  return buildSpeakNowChoices(name).map((choice) => {
    if (choice.value === "wait") {
      return {
        value: choice.value,
        description: `待つ: 何もしない。参加者がまだ話しそう（言いかけ・考え中・「えーと」の途中）なときや、${name}に向けた発言ではない（独り言・参加者どうしのやりとり・ゲームへの悪態・読み上げ）とき。`
      };
    }
    if (choice.value === "respond") {
      return {
        value: choice.value,
        description: "応答する: 参加者の発言に答える必要がある（質問された・話を振られた・同意や意見を求められた）ので、ちゃんと返事をする。"
      };
    }
    return choice;
  });
}

/** Discord の問いの組（体験の口の judgeSet.speakNow）。入力の整形は配信と同じ関数を「参加者」のラベルで使う。 */
export const DISCORD_SPEAK_NOW_QUESTIONS = Object.freeze({
  hostLabel: DISCORD_SPEAK_NOW_HOST_LABEL,
  buildInstructions: buildDiscordSpeakNowInstructions,
  buildChoices: buildDiscordSpeakNowChoices,
  buildInput: buildSpeakNowInput,
  backchannelInstruction: DISCORD_SPEAK_NOW_BACKCHANNEL_INSTRUCTION
});

/**
 * 問いの組を使う形にする。null / undefined は配信の問いの組。渡された組で欠けている項目は配信の項目で埋める（hostLabel だけを
 * 替えた組なら、配信の入力の整形がそのラベルで行を作る）。項目の型が違えば TypeError（黙って配信の問いに戻さない）。
 * @param {unknown} [questions]
 * @returns {Readonly<SpeakNowQuestions>}
 */
export function resolveSpeakNowQuestions(questions) {
  if (questions == null || questions === STREAM_SPEAK_NOW_QUESTIONS) return STREAM_SPEAK_NOW_QUESTIONS;
  if (typeof questions !== "object" || Array.isArray(questions)) {
    throw new TypeError("speak-now questions must be an object.");
  }
  const q = /** @type {Record<string, unknown>} */ (questions);
  const extra = Object.keys(q).filter((k) => !SPEAK_NOW_QUESTION_KEYS.includes(k));
  if (extra.length > 0) throw new TypeError(`speak-now questions have unknown items: ${extra.join(", ")}.`);
  for (const key of ["hostLabel", "backchannelInstruction"]) {
    if (q[key] !== undefined && (typeof q[key] !== "string" || /** @type {string} */ (q[key]).trim().length === 0)) {
      throw new TypeError(`speak-now questions "${key}" must be a non-empty string.`);
    }
  }
  for (const key of ["buildInstructions", "buildChoices", "buildInput"]) {
    if (q[key] !== undefined && typeof q[key] !== "function") {
      throw new TypeError(`speak-now questions "${key}" must be a function.`);
    }
  }
  return Object.freeze({ ...STREAM_SPEAK_NOW_QUESTIONS, ...Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) });
}

/**
 * @typedef {"transcript" | "after-busy"} SpeakNowTrigger
 * @typedef {{
 *   trigger: SpeakNowTrigger;
 *   triggerSeq: number | null;
 *   choice: string;
 *   probability: number | null;
 *   probs: Record<string, number>;
 *   latencyMs: number | null;
 *   action: "fire" | "drop-busy" | "drop-inactive" | "skip-interval" | "none";
 * }} SpeakNowJudgment
 * @typedef {{ trigger: SpeakNowTrigger; triggerSeq: number | null; message: string; latencyMs: number | null; errorKind?: string; errorStatus?: number }} SpeakNowJudgeFailure
 * @typedef {{ choice: string; probability: number | null; trigger: SpeakNowTrigger; triggerSeq: number | null; latencyMs: number | null }} SpeakNowFireRequest
 */

/**
 * エントリ列の最後の配信者（you）の行の seq（after-busy のきっかけ）。無ければ null。
 * @param {ReadonlyArray<{ speaker?: string; seq?: number }>} entries
 * @returns {number | null}
 */
function lastHostSeq(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i];
    if (e && (e.speaker ?? "you") === "you" && typeof e.seq === "number" && Number.isFinite(e.seq)) return e.seq;
  }
  return null;
}

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
 * @param {(request: SpeakNowFireRequest) => void} options.onFire  応答・自発・相槌・画面を見るで発火を要求する（choice で
 *   結線層が発火の仕方を分ける: 相槌は内部指示付き・ほかは指示なし。どれも画面付き）。確率・きっかけの seq・判定の遅延も載る。
 * @param {(judgment: SpeakNowJudgment) => void} [options.onJudgment]  判定結果（待つも含め毎回）。
 * @param {(failure: SpeakNowJudgeFailure) => void} [options.onError]  判定の失敗（キー欠落・タイムアウト等）。
 * @param {() => number} [options.nowImpl=Date.now]  入力の窓の基準時刻（appendedAtMs と同じ時計）。相槌の
 *   間隔の数え始めと判定もこの時計で測る。
 * @param {number} [options.backchannelMinIntervalMs=SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS]  相槌どうしの最小間隔
 *   （前の相槌を喋り始めてから、次の相槌を喋らせない時間）。0 なら歯止めなし。負・非数は既定。
 * @param {unknown} [options.questions]  問いの組（Discord モード Domain C・resolveSpeakNowQuestions）。渡さなければ今の配信の問い。
 *   作るときに 1 回だけ読む（場を開くたびに部品を作り直すので、その場の体験の問いになる）。
 * @returns {{
 *   handleTranscript: (entry: { speaker?: string; seq?: number } | null) => void;
 *   notifyIdle: () => void;
 *   markBackchannelSpoken: () => void;
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
  const questions = resolveSpeakNowQuestions(options.questions);
  const backchannelMinIntervalMs =
    typeof options.backchannelMinIntervalMs === "number" &&
    Number.isFinite(options.backchannelMinIntervalMs) &&
    options.backchannelMinIntervalMs >= 0
      ? options.backchannelMinIntervalMs
      : SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS;

  let disposed = false;
  /** 忙しい間に積まれた you の転写の数（明けたときに 1 回判定するかの材料）。 */
  let pending = 0;
  /** 返事待ちの判定の数（診断・テスト用）。 */
  let inFlight = 0;
  /** 前の相槌を喋り始めた時刻（nowImpl の時計・まだ無ければ null）。相槌どうしの歯止めの数え始め。 */
  /** @type {number | null} */
  let lastBackchannelSpokenAtMs = null;
  /** 相槌を喋った忙しさの間か（明けたときの after-busy の判定をしない・積み残しは捨てる）。 */
  let skipAfterBusy = false;

  /** 通知先の throw で判定経路を壊さない。 */
  const safe = (/** @type {() => void} */ fn) => {
    try {
      fn();
    } catch {
      // best-effort。
    }
  };

  /**
   * @param {SpeakNowTrigger} trigger
   * @param {number | null} [seqHint]  きっかけの転写の seq（transcript のとき）。
   */
  const runJudge = (trigger, seqHint = null) => {
    const name = getName();
    const entries = getEntries() ?? [];
    const input = questions.buildInput(entries, { nowMs: nowImpl(), soulName: name, hostLabel: questions.hostLabel });
    if (typeof input !== "string" || input.length === 0) return; // 窓に会話が無い（判定する材料が無い）。
    const triggerSeq = typeof seqHint === "number" && Number.isFinite(seqHint) ? seqHint : lastHostSeq(entries);
    const request = {
      input,
      instructions: questions.buildInstructions({ name, verbosity: getVerbosity() }),
      choices: questions.buildChoices(name)
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
          else if (
            choice === "backchannel" &&
            lastBackchannelSpokenAtMs != null &&
            nowImpl() - lastBackchannelSpokenAtMs < backchannelMinIntervalMs
          ) {
            // 相槌どうしの歯止め（backchannel.md §2）: 前の相槌を喋り始めてから間もないので流す。
            action = "skip-interval";
          } else action = "fire";
        }
        safe(() => onJudgment({ trigger, triggerSeq, choice, probability, probs, latencyMs, action }));
        if (action === "fire") safe(() => onFire({ choice, probability, trigger, triggerSeq, latencyMs }));
      },
      (error) => {
        inFlight -= 1;
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        const latencyMs = error && typeof error.latencyMs === "number" ? error.latencyMs : null;
        // Discord モード Domain H（discord-mode.md §13.7）: 判定の記録に書く失敗の種類（SpeakNowJudgeError の kind・
        // status）。持っている失敗のときだけ足す（無ければ今の形のまま・判定のふるまいは変えない）。
        const errorKind = error && typeof error.kind === "string" ? error.kind : null;
        const errorStatus = error && typeof error.status === "number" ? error.status : null;
        safe(() =>
          onError({
            trigger,
            triggerSeq,
            message,
            latencyMs,
            ...(errorKind != null ? { errorKind } : {}),
            ...(errorStatus != null ? { errorStatus } : {})
          })
        );
      }
    );
  };

  return {
    /**
     * 転写バッファへの append を 1 件食わせる（you 以外は無視）。忙しい間は数えるだけ。
     * @param {{ speaker?: string; seq?: number } | null} entry
     */
    handleTranscript(entry) {
      if (disposed || entry == null || typeof entry !== "object") return;
      if ((entry.speaker ?? "you") !== "you") return;
      if (!isActive()) return;
      if (isBusy()) {
        pending += 1;
        return;
      }
      runJudge("transcript", typeof entry.seq === "number" ? entry.seq : null);
    },
    /**
     * 忙しさが明けたかもしれないときに呼ぶ（orchestrator が idle に戻った・発火の Promise が片付いた）。
     * 本当に空いていて、忙しい間に you の転写が 1 件以上あったら 1 回だけ判定する。
     */
    notifyIdle() {
      if (disposed || isBusy()) return;
      if (skipAfterBusy) {
        // 相槌のあとは after-busy の判定をしない（backchannel.md §2: 相槌は短く、配信者は話し続けているので
        // 次の発言で判定が回る）。相槌を喋った忙しさの間の積み残しは捨てる。
        skipAfterBusy = false;
        pending = 0;
        return;
      }
      if (pending === 0) return;
      pending = 0;
      if (!isActive()) return;
      runJudge("after-busy");
    },
    /**
     * 相槌の発火でチャッピーが喋り始めたことを知らせる（結線層が orchestrator の speaking で呼ぶ）。
     * 相槌どうしの歯止めの数え始めになり、この忙しさが明けたときの after-busy の判定を止める。
     */
    markBackchannelSpoken() {
      if (disposed) return;
      lastBackchannelSpokenAtMs = nowImpl();
      skipAfterBusy = true;
    },
    /** 忙しい間の積み残しを捨てる（モード切替時）。 */
    reset() {
      pending = 0;
      skipAfterBusy = false;
    },
    pendingWhileBusy: () => pending,
    inFlight: () => inFlight,
    /** 畳む（以後の入力・返ってきた結果は無視）。 */
    dispose() {
      disposed = true;
      pending = 0;
      skipAfterBusy = false;
    }
  };
}
