// @ts-check
/**
 * Silero VAD ラッパ（S2 Domain A・choke point の薄い ONNX 層）— apps/soul/agent。
 *
 * PCM フレーム（Float32 [-1,1]・16kHz で 512 サンプル）を Silero VAD v5 の ONNX モデルに通し、
 * **発話確率 [0,1]** を返す薄いラッパ。得た確率列は speech-segmenter.mjs（純関数）へ渡って
 * speechStart/speechEnd に畳まれる（この分離により VAD は「1 フレーム→1 確率」だけを担い、
 * 区切りロジックは onnxruntime 非依存でテストできる）。
 *
 * ── 依存の遅延ロード（choke point・未 install でモジュール評価は落とさない）──────
 *  onnxruntime-node は **install 待ちの依存**（package.json に宣言のみ）。ここで static import
 *  すると未 install の環境でモジュール評価時に throw し、万一この .mjs を import する経路が
 *  混ざると `node --test` 全体が赤化する。よって onnxruntime-node は `init()` 内で **動的 import**
 *  する（`ortImpl` 注入で差し替え可能）。→ この .mjs 自体は install 前でも import でき、実際の
 *  native ロードは init() を呼んだときだけ起きる。VAD ラッパの実機検証（preflight-vad 等）は
 *  install 後の続行フェーズに回す（この段階では test を書かない＝機械ゲートは純関数層で固定）。
 *
 * ── Silero VAD v5 ONNX の I/O 契約（2026-07 時点・実モデル照合済み）────────────
 *  入力:
 *    - "input": float32 [batch, context+samples]  16kHz は **64 文脈 + 512 = 576**（8kHz は 32+256）。
 *      Silero v5 は各フレームの前に**直前フレーム末尾の contextSamples を連結**して食わせる仕様
 *      （公式 OnnxWrapper の context_size と同じ）。512 単独でも実行は通るが確率が壊れる——
 *      実音声（TTS 合成）で max≈0.10 にしかならず発話を一切検出できない（S2 Domain C 実測。
 *      576 なら同じ音声で max=1.00）。文脈はラッパ内部で持ち回り、reset() でゼロに戻す。
 *    - "state": float32 [2, batch, 128]   再帰状態（h/c）。初期は 0。呼び出し間で持ち回る。
 *    - "sr":    int64  スカラ            16000。
 *  出力:
 *    - "output": float32 [batch, 1]       発話確率。
 *    - "stateN": float32 [2, batch, 128]  次フレームへ渡す新状態。
 *  入出力名はモデル版で変わり得るため inputNames/outputName を上書き可能にした（既定は v5 名）。
 *
 * ── モデル入手（ユーザー作業・非コミット。Orch へ必須報告事項）──────────────────
 *  silero_vad.onnx（≈2.33MB, MIT）を別途ダウンロードし vendor/models/ に置く（vendor/ は .gitignore 済み）:
 *    https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx
 *  → 既定 modelPath は apps/soul/agent/vendor/models/silero_vad.onnx（設定で上書き可）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** 既定モデルパス（vendor/models/silero_vad.onnx・非コミット）。 */
export const DEFAULT_SILERO_MODEL_PATH = path.resolve(here, "..", "vendor", "models", "silero_vad.onnx");

/** Silero v5 の既定 I/O 名。 */
export const SILERO_V5_INPUT_NAMES = Object.freeze({ input: "input", state: "state", sr: "sr" });
export const SILERO_V5_OUTPUT_NAME = "output";
export const SILERO_V5_STATE_OUTPUT_NAME = "stateN";
/** 状態テンソル形状 [2, batch=1, 128]。 */
const STATE_DIMS = [2, 1, 128];
const STATE_LEN = 2 * 1 * 128;
/** v5 の入力文脈サンプル数（16kHz。8kHz なら 32）。公式 OnnxWrapper の context_size と同値。 */
export const SILERO_V5_CONTEXT_SAMPLES_16K = 64;

/**
 * Silero VAD ラッパを作る。
 *
 * @param {object} [options]
 * @param {string} [options.modelPath]     silero_vad.onnx の絶対パス（既定 vendor/models/…）。
 * @param {number} [options.sampleRate=16000]
 * @param {number} [options.frameSamples=512]  16kHz は 512。sampleRate と整合すること。
 * @param {number} [options.contextSamples]    入力に前置する直前フレーム文脈（既定 16kHz=64・8kHz=32）。
 * @param {{ input?: string; state?: string; sr?: string }} [options.inputNames]  ONNX 入力名の上書き。
 * @param {string} [options.outputName]        発話確率出力名の上書き（既定 "output"）。
 * @param {string} [options.stateOutputName]   新状態出力名の上書き（既定 "stateN"）。
 * @param {object} [options.sessionOptions]    ONNX セッションオプションの上書き。
 *   既定 `{ intraOpNumThreads: 1 }`: onnxruntime の既定スレッドプールはスピンで待つため、
 *   この 2.3MB モデルを実時間レート（31.25 フレーム/s）で回すだけでアイドル CPU が
 *   ≈358%/コア に膨れる（S2 Domain C 実測）。1 スレッドなら ≈1.8%/コア・per-frame
 *   レイテンシは 0.20ms → 0.18ms と悪化しない（配信中は器の二体と CPU を分け合う規律）。
 * @param {any} [options.ortImpl]  onnxruntime-node の差し替え（テスト注入用）。既定は動的 import。
 * @returns {{
 *   init: () => Promise<void>;
 *   process: (frame: Float32Array) => Promise<number>;
 *   reset: () => void;
 *   dispose: () => Promise<void>;
 *   modelPath: string;
 *   frameSamples: number;
 * }}
 */
export function createSileroVad(options = {}) {
  const modelPath = options.modelPath ?? DEFAULT_SILERO_MODEL_PATH;
  const sampleRate = options.sampleRate ?? 16000;
  const frameSamples = options.frameSamples ?? 512;
  // v5 は入力の先頭に直前フレーム末尾の contextSamples を連結する（8kHz は半分の 32）。
  const contextSamples =
    options.contextSamples ?? (sampleRate === 8000 ? 32 : SILERO_V5_CONTEXT_SAMPLES_16K);
  const inputNames = { ...SILERO_V5_INPUT_NAMES, ...(options.inputNames ?? {}) };
  const outputName = options.outputName ?? SILERO_V5_OUTPUT_NAME;
  const stateOutputName = options.stateOutputName ?? SILERO_V5_STATE_OUTPUT_NAME;
  const sessionOptions = options.sessionOptions ?? { intraOpNumThreads: 1 };
  const ortImpl = options.ortImpl;

  /** @type {any} */
  let ort = null;
  /** @type {any} */
  let session = null;
  /** 再帰状態 [2,1,128]。呼び出し間で持ち回る。 */
  let state = new Float32Array(STATE_LEN);
  /** 直前フレーム末尾の文脈（v5 入力の前置分）。呼び出し間で持ち回る。 */
  let context = new Float32Array(contextSamples);

  return {
    modelPath,
    frameSamples,

    /**
     * ONNX セッションを開く（native 依存はここで初めてロードされる）。
     * @throws init 前に process を呼ぶと throw。onnxruntime-node 未 install ならここで throw。
     */
    async init() {
      // 動的 import: 未 install の環境ではこの呼び出しで初めて失敗する（モジュール評価では落ちない）。
      ort = ortImpl ?? (await import("onnxruntime-node")).default ?? (await import("onnxruntime-node"));
      session = await ort.InferenceSession.create(modelPath, sessionOptions);
    },

    /**
     * 1 フレームを推論し発話確率を返す。状態は内部で持ち回る。
     * **契約: process() は直列に呼ぶこと（並行呼び出し禁止）**——再帰状態 + 入力文脈を呼び出し間で
     * 持ち回るため、並行呼び出しは state/context の読み書きが交錯して確率を壊す（結線層
     * ear-pipeline.mjs はフレーム到着順の promise チェーンで直列化済み・domain-c-review note 6）。
     * @param {Float32Array} frame  長さ frameSamples の正規化 PCM。
     * @returns {Promise<number>}  発話確率 [0,1]。
     */
    async process(frame) {
      if (!session) {
        throw new Error("createSileroVad: init() must be awaited before process().");
      }
      if (!(frame instanceof Float32Array) || frame.length !== frameSamples) {
        throw new TypeError(
          `createSileroVad.process: frame must be a Float32Array of length ${frameSamples}; got ${
            frame instanceof Float32Array ? frame.length : typeof frame
          }.`
        );
      }
      const Tensor = ort.Tensor;
      // v5 入力 = [直前フレーム末尾の文脈 | 今フレーム]（contextSamples + frameSamples）。
      const input = new Float32Array(contextSamples + frameSamples);
      input.set(context, 0);
      input.set(frame, contextSamples);
      const feeds = {
        [inputNames.input]: new Tensor("float32", input, [1, input.length]),
        [inputNames.state]: new Tensor("float32", state, STATE_DIMS),
        [inputNames.sr]: new Tensor("int64", BigInt64Array.from([BigInt(sampleRate)]), [])
      };
      const results = await session.run(feeds);
      // 次フレームへ持ち回る文脈 = 今フレームの末尾 contextSamples。
      if (contextSamples > 0) {
        context = frame.slice(frameSamples - contextSamples);
      }
      // 出力名不一致は NaN を返さず明示 throw する（S2 Domain C・domain-a-review note 7 回収）。
      // NaN は下流（セグメンタの有限性検査）でも顕在化するが、原因（モデル版と I/O 名の不一致）
      // から遠い場所で落ちるため、ラッパ自身で診断可能なエラーにする。
      const out = results[outputName];
      const nextState = results[stateOutputName];
      if (!out || !out.data || !nextState || !nextState.data) {
        throw new Error(
          `createSileroVad.process: model outputs "${outputName}"/"${stateOutputName}" not found ` +
            `(actual outputs: ${Object.keys(results).join(", ")}). ` +
            "Check options.outputName/stateOutputName against the model version."
        );
      }
      // 新状態を持ち回る（次フレームの再帰入力）。
      state = Float32Array.from(nextState.data);
      return Number(out.data[0]);
    },

    /** 再帰状態と入力文脈を 0 に戻す（無音区間の後や ffmpeg 再起動時に呼ぶ）。 */
    reset() {
      state = new Float32Array(STATE_LEN);
      context = new Float32Array(contextSamples);
    },

    /** セッションを解放する（常駐クリーンシャットダウン）。 */
    async dispose() {
      if (session && typeof session.release === "function") {
        try {
          await session.release();
        } catch {
          // best-effort
        }
      }
      session = null;
    }
  };
}
