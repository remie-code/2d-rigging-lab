import { STT_ENGINES } from "../ears/ear-pipeline.mjs";

/**
 * settings の出力デバイス（audioDevice）を、cockpit-server の口（onSetAudioDevice/audioDeviceStatus）へ
 * 橋渡しする（S6「会話が続く」・Domain D。visionTarget と同型の薄い配線層）。
 *
 * **常駐プレイヤーの再起動はここでは行わない**（settings の getter/setter に閉じた層のまま）。
 * main() が返り値の `onSetAudioDevice` をラップして常駐プレイヤーの再生成トリガに使う（§createStreamPlayer 呼び出し側）。
 *
 * @param {{ getAudioDevice: () => string | null; setAudioDevice: (name: string | null) => void }} settings
 * @returns {{
 *   getAudioDevice: () => string | null;
 *   onSetAudioDevice: (name: string | null) => void;
 *   audioDeviceStatus: () => { name: string | null };
 * }}
 */
export function createAudioDeviceHooks(settings) {
  return {
    /** 起動時 / プレイヤー再生成時に読む出力デバイス名（未記憶なら null=既定デバイス）。 */
    getAudioDevice: () => settings.getAudioDevice(),
    /** cockpit-server の onSetAudioDevice（POST /api/audio-device が呼ぶ）。 */
    onSetAudioDevice: (name) => {
      try {
        settings.setAudioDevice(name ?? null); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    },
    /** cockpit-server の audioDeviceStatus（state snapshot に載せる現況）。 */
    audioDeviceStatus: () => ({ name: settings.getAudioDevice() })
  };
}

/**
 * settings の文字起こしの方式（sttEngine）を、cockpit-server の口（sttEngineInitial/onSetSttEngine）へ
 * 橋渡しする（操縦席の文字起こし選択・cockpit-stt-selection.md・createVerbosityHooks と同型の薄い配線層）。
 * 未記憶/未知値は defaultEngine（既定 "whisper"）。選択だけを記憶し、ElevenLabs のキーはここで扱わない
 * （キーは cockpit-server が Start ごとに .env.elevenlabs.local から直接読む）。
 *
 * 既知値は ear-pipeline の STT_ENGINES（whisper / elevenlabs / parakeet / zipformer）。
 *
 * @param {{ getSttEngine: () => string | null; setSttEngine: (engine: string | null) => void }} settings
 * @param {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} [defaultEngine="whisper"]
 * @returns {{
 *   resolveInitialSttEngine: () => "whisper" | "elevenlabs" | "parakeet" | "zipformer";
 *   onSetSttEngine: (engine: string) => void;
 * }}
 */
export function createSttEngineHooks(settings, defaultEngine = "whisper") {
  return {
    /** 起動時の初期選択（未記憶/未知値は defaultEngine）。 */
    resolveInitialSttEngine: () => {
      const remembered = settings.getSttEngine();
      return remembered != null && STT_ENGINES.includes(remembered)
        ? /** @type {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} */ (remembered)
        : defaultEngine;
    },
    /** cockpit-server の onSetSttEngine（耳の Start ごとに呼ぶ）。 */
    onSetSttEngine: (engine) => {
      try {
        settings.setSttEngine(engine); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Start を止めない（onSetVerbosity と同型の失敗寛容）。
      }
    }
  };
}

/** 声の方式（設定キー `ttsEngine`・cockpit-server の TTS_ENGINES と同じ語彙）。 */
const TTS_ENGINE_CHOICES = Object.freeze(["aivis", "elevenlabs"]);

/**
 * settings の声の方式（ttsEngine）を、cockpit-server の口（ttsEngineInitial/onSetTtsEngine）へ橋渡しする
 * （声の差し替え Wave 3 Domain E・createSttEngineHooks の写経）。未記憶/未知値は defaultEngine（既定 "aivis"）。
 * 選択だけを記憶し、ElevenLabs のキーはここで扱わない（キーは createVoiceEngineManager が engine を作るときに読む）。
 *
 * @param {{ getTtsEngine: () => string | null; setTtsEngine: (engine: string | null) => void }} settings
 * @param {"aivis" | "elevenlabs"} [defaultEngine="aivis"]
 * @returns {{
 *   resolveInitialTtsEngine: () => "aivis" | "elevenlabs";
 *   onSetTtsEngine: (engine: string) => void;
 * }}
 */
export function createTtsEngineHooks(settings, defaultEngine = "aivis") {
  return {
    /** 起動時の初期選択（未記憶/未知値は defaultEngine）。 */
    resolveInitialTtsEngine: () => {
      const remembered = settings.getTtsEngine();
      return TTS_ENGINE_CHOICES.includes(/** @type {any} */ (remembered))
        ? /** @type {"aivis" | "elevenlabs"} */ (remembered)
        : defaultEngine;
    },
    /** cockpit-server の onSetTtsEngine（耳の Start ごとに呼ぶ）。 */
    onSetTtsEngine: (engine) => {
      try {
        settings.setTtsEngine(engine); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Start を止めない。
      }
    }
  };
}
