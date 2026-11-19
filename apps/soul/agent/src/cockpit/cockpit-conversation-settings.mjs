/**
 * settings の自発発火 ON/OFF トグル（selfFireEnabled）を、cockpit-server の口
 * （onSetSelfFireEnabled）へ橋渡しする（S6「会話が続く」・Domain D。visionTarget と同型の薄い配線層）。
 * 起動時の初期値解決（`resolveInitialEnabled`）は既定値（false）へのフォールバックを担う——bool の
 * 「未記憶」（null）と「明示 false」を区別する settings 契約を、呼び出し側が意識せずに使えるようにする。
 *
 * @param {{ getSelfFireEnabled: () => boolean | null; setSelfFireEnabled: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=false]  未記憶時のフォールバック（v0 は既定 OFF・wave 計画 §1 の順序どおり）。
 * @returns {{
 *   resolveInitialEnabled: () => boolean;
 *   onSetSelfFireEnabled: (enabled: boolean) => void;
 * }}
 */
export function createSelfFireHooks(settings, defaultEnabled = false) {
  return {
    /** 起動時の初期 ON/OFF（未記憶なら defaultEnabled）。 */
    resolveInitialEnabled: () => {
      const remembered = settings.getSelfFireEnabled();
      return typeof remembered === "boolean" ? remembered : defaultEnabled;
    },
    /** cockpit-server の onSetSelfFireEnabled（POST /api/self-fire が呼ぶ）。 */
    onSetSelfFireEnabled: (enabled) => {
      try {
        settings.setSelfFireEnabled(enabled === true); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    }
  };
}

/**
 * settings の barge-in ON/OFF トグル（bargeInEnabled）を、cockpit-server の口
 * （onSetBargeInEnabled）へ橋渡しする（「朗読と合いの手」裁定 1・createSelfFireHooks と同型の
 * 薄い配線層）。**既定は defaultEnabled=true**（selfFire の既定 false とは意図的に非対称・裁定 1
 * 「既定 ON」）。起動時の初期値解決（`resolveInitialEnabled`）は既定値へのフォールバックを担う——
 * bool の「未記憶」（null）と「明示 false」を区別する settings 契約を、呼び出し側が意識せずに
 * 使えるようにする（createSelfFireHooks と同じ規律）。
 *
 * @param {{ getBargeInEnabled: () => boolean | null; setBargeInEnabled: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=true]  未記憶時のフォールバック（既定 ON・「朗読と合いの手」裁定 1）。
 * @returns {{
 *   resolveInitialEnabled: () => boolean;
 *   onSetBargeInEnabled: (enabled: boolean) => void;
 * }}
 */
export function createBargeInHooks(settings, defaultEnabled = true) {
  return {
    /** 起動時の初期 ON/OFF（未記憶なら defaultEnabled）。 */
    resolveInitialEnabled: () => {
      const remembered = settings.getBargeInEnabled();
      return typeof remembered === "boolean" ? remembered : defaultEnabled;
    },
    /** cockpit-server の onSetBargeInEnabled（POST /api/barge-in が呼ぶ）。 */
    onSetBargeInEnabled: (enabled) => {
      try {
        settings.setBargeInEnabled(enabled === true); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
      }
    }
  };
}

/**
 * settings の口数モード（verbosityMode）を、cockpit-server の口（resolveInitialVerbosity/
 * onSetVerbosity）へ橋渡しする（wave 計画「口数配線」§2 裁定 A・createSelfFireHooks と同型の薄い
 * 配線層）。settings に記憶が無い、または既知3モード（quiet/normal/chatty）以外の値が入っていた
 * 場合は defaultMode（既定 "normal"）にフォールバックする（防御的・fire-scheduler.mjs 側の
 * setVerbosity/初期 mode 解決と同じ「未知値は normal」の規律）。
 *
 * @param {{ getVerbosityMode: () => string | null; setVerbosityMode: (mode: string | null) => void }} settings
 * @param {string} [defaultMode="normal"]  未記憶/未知値のフォールバック。
 * @returns {{
 *   resolveInitialVerbosity: () => string;
 *   onSetVerbosity: (mode: string) => void;
 * }}
 */
export function createVerbosityHooks(settings, defaultMode = "normal") {
  return {
    /** 起動時の初期口数モード（未記憶/未知値は defaultMode）。 */
    resolveInitialVerbosity: () => {
      const remembered = settings.getVerbosityMode();
      return remembered === "quiet" || remembered === "normal" || remembered === "chatty"
        ? remembered
        : defaultMode;
    },
    /** cockpit-server の onSetVerbosity（POST /api/verbosity が呼ぶ）。 */
    onSetVerbosity: (mode) => {
      try {
        settings.setVerbosityMode(mode); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
      }
    }
  };
}

/**
 * settings の話し始めの方式（speakStartMode）を、cockpit-server の口（speakStartModeInitial/
 * onSetSpeakStartMode）へ橋渡しする（speak-now 合意 §5・createVerbosityHooks と同型の薄い配線層）。
 * 未記憶/未知値は defaultMode（**初回既定 "speak-now"**・合意 §5）。相槌どうしの最小間隔
 * （settings の backchannelMinIntervalSec・backchannel.md §2）も cockpit-server の backchannelMinIntervalMs へ橋渡しする
 * （createCommentBusyHooks の resolveCommentHold と同型）。
 *
 * @param {{ getSpeakStartMode: () => string | null; setSpeakStartMode: (mode: string | null) => void;
 *   getBackchannelMinIntervalSec?: () => number | null }} settings
 * @param {"classic" | "speak-now"} [defaultMode="speak-now"]
 * @returns {{
 *   resolveInitialSpeakStartMode: () => "classic" | "speak-now";
 *   onSetSpeakStartMode: (mode: string) => void;
 *   resolveBackchannelMinIntervalMs: () => number | undefined;
 * }}
 */
export function createSpeakStartHooks(settings, defaultMode = "speak-now") {
  return {
    /** 起動時の話し始めの方式（未記憶/未知値は defaultMode）。 */
    resolveInitialSpeakStartMode: () => {
      const remembered = settings.getSpeakStartMode();
      return remembered === "classic" || remembered === "speak-now" ? remembered : defaultMode;
    },
    /** cockpit-server の onSetSpeakStartMode（POST /api/speak-start が呼ぶ）。 */
    onSetSpeakStartMode: (mode) => {
      try {
        settings.setSpeakStartMode(mode); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVerbosity と同型の失敗寛容）。
      }
    },
    /** 相槌どうしの最小間隔（秒 → ミリ秒）。未設定・読めなければ undefined（= cockpit-server の既定 8 秒）。 */
    resolveBackchannelMinIntervalMs: () => {
      try {
        if (typeof settings.getBackchannelMinIntervalSec !== "function") return undefined;
        const sec = settings.getBackchannelMinIntervalSec();
        return typeof sec === "number" && Number.isFinite(sec) && sec >= 0 ? sec * 1000 : undefined;
      } catch {
        return undefined; // 読めなければ既定。
      }
    }
  };
}

/**
 * settings の忙しい間のコメントの扱い（commentBusyPolicy）とあとで拾うの鮮度・件数を、cockpit-server の口
 * （commentBusyPolicyInitial / onSetCommentBusyPolicy / commentHoldMaxAgeMs / commentHoldMaxCount）へ橋渡しする
 * （コメント反応の合意 §2・createSpeakStartHooks と同型の薄い配線層）。未記憶/未知値は "hold"（あとで拾う・既定）。
 *
 * @param {{ getCommentBusyPolicy: () => string | null; setCommentBusyPolicy: (policy: string | null) => void;
 *   getCommentHold?: () => { maxAgeSec: number | null; maxCount: number | null } }} settings
 * @returns {{
 *   resolveInitialCommentBusyPolicy: () => "hold" | "drop";
 *   onSetCommentBusyPolicy: (policy: string) => void;
 *   resolveCommentHold: () => { maxAgeMs: number | undefined; maxCount: number | undefined };
 * }}
 */
export function createCommentBusyHooks(settings) {
  return {
    /** 起動時の扱い（未記憶/未知値は hold）。 */
    resolveInitialCommentBusyPolicy: () => {
      const remembered = settings.getCommentBusyPolicy();
      return remembered === "drop" ? "drop" : "hold";
    },
    /** cockpit-server の onSetCommentBusyPolicy（POST /api/comment-busy が呼ぶ）。 */
    onSetCommentBusyPolicy: (policy) => {
      try {
        settings.setCommentBusyPolicy(policy); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSpeakStartMode と同型の失敗寛容）。
      }
    },
    /** 鮮度（秒 → ミリ秒）と件数。未設定は undefined（= cockpit-server の既定 20 秒 / 3 件）。 */
    resolveCommentHold: () => {
      let hold = { maxAgeSec: null, maxCount: null };
      try {
        if (typeof settings.getCommentHold === "function") hold = settings.getCommentHold() ?? hold;
      } catch {
        // 読めなければ既定。
      }
      return {
        maxAgeMs: typeof hold.maxAgeSec === "number" ? hold.maxAgeSec * 1000 : undefined,
        maxCount: typeof hold.maxCount === "number" ? hold.maxCount : undefined
      };
    }
  };
}
