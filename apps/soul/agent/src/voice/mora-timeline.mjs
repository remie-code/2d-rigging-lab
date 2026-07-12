// @ts-check
/**
 * モーラ写像純関数（S1 Domain A・裁定2）— apps/soul/agent の中核。
 *
 * AivisSpeech `/audio_query` の moras 列（種類の並び）と合成 WAV の実長から、器へ送る
 * intent.speech payload の timeline（`{timeMs, vowel, s}[]`）を組む。依存ゼロ（node 組み込み
 * のみ）・純関数（同じ入力→同じ出力、副作用なし）。契約の正は
 * `apps/runtime-player/src/main/control-channel/contract/channel-intent-speech-payload-schema.json`。
 *
 * ── 時間材料の事実（実機実測・裁定2の前提）─────────────────────────────
 *  audio_query の各モーラの consonant_length / vowel_length は AivisSpeech 実機で全零
 *  （実測。s1-planning-inventory §3）。よって個別モーラ長は使えない。使えるのは合成 WAV の
 *  実長のみ。→ 発話実体尺を moras の全要素数で均等配置する（裁定2「均等割り」）。
 *
 * ── 決定した規則（fixture で固定・報告に記載）─────────────────────────
 *  1. 均等割り: 発話実体尺 bodyDurationSec = wavDurationSec - prePhonemeSec - postPhonemeSec を
 *     moras.length（pau/N/cl 等 enum 外も含む生の並びの長さ）で割り、i 番目のモーラの開始を
 *     prePhonemeSec + i * (bodyDurationSec / moras.length) 秒に置く。
 *  2. pre 無音オフセット（既定・推奨）: timeMs は WAV 実時間軸（先頭無音込み）。t=0 = WAV 先頭
 *     = 器がインテントを受理した瞬間。合成 WAV は先頭に prePhonemeSec の無音を持つため、最初の
 *     発声モーラは prePhonemeSec 分だけオフセットされる（Domain B の同期方針＝accepted 受領→
 *     即再生・先頭無音が器の口の立ち上がりと相殺、と整合。s1-wave-plan §3 Domain B）。
 *  3. enum 外の脱落 + 時間ギャップ保持: vowel を小文字化して a/i/u/e/o 以外（pau・N・cl・
 *     長音・無効値等）は timeline 要素を出さない。ただしその時間スロットは消費する（均等割りは
 *     全モーラ位置で行い、脱落位置に要素を作らないだけ）→ 前後の母音モーラの間隔が空き「間」になる。
 *  4. vowel 正規化: AivisSpeech は無声化母音を大文字（A/I/U/E/O）で返し得る。小文字化してから
 *     写像。小文字化後に a/i/u/e/o 以外は脱落（出力に残る vowel は必ず 5 値のいずれか）。
 *  5. timeMs 整数化 + 厳密単調保証: 出力 timeMs は整数・非負・厳密単調増加（器は同時刻も拒否）。
 *     四捨五入で隣接が同値以下になった場合は「最小 1ms 間隔を強制して押し出す」
 *     （timeMs[k] = max(round(raw), timeMs[k-1] + 1)）。要素数に対し尺が短すぎても壊れず単調を保つ。
 *  6. s 値: 母音ラベル→s を決定論的に与える（sConfig で母音別マップを差し替え可能）。既定は
 *     参照ドライバ（reference-driver.mjs speechTimelineMoras / 手書き 0.5〜0.9）の流儀を踏襲した
 *     母音別マップ。s は必ず 0..1 域内（sConfig が域外値を含めば throw）。
 *  7. 512 上限: 出力 timeline 要素数 > 512 は throw（切詰めず。文分割は S4 以降の前提）。
 */

/** 出力に残り得る母音ラベル（契約 enum と一致）。 */
const VOWEL_LABELS = new Set(["a", "i", "u", "e", "o"]);

/** 器契約 timeline の maxItems（裁定4）。超過は throw。 */
export const MAX_TIMELINE_ITEMS = 512;

/**
 * 既定の母音別 s（PRE-scale の開き強度 0..1）。参照ドライバの手書き値（0.5〜0.9）の
 * 母音別平均相当。a=広い開き / i=狭い、の直感に沿う。全て 0..1 域内。
 * @type {{ a: number; i: number; u: number; e: number; o: number }}
 */
export const DEFAULT_S_BY_VOWEL = Object.freeze({
  a: 0.85,
  i: 0.5,
  u: 0.55,
  e: 0.7,
  o: 0.65
});

/**
 * 有限な number か。
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * mora.vowel を小文字化し、a/i/u/e/o のいずれかならそれを、そうでなければ null を返す。
 * @param {unknown} rawVowel
 * @returns {"a"|"i"|"u"|"e"|"o"|null}
 */
function normalizeVowel(rawVowel) {
  if (typeof rawVowel !== "string") {
    return null;
  }
  const lower = rawVowel.toLowerCase();
  return VOWEL_LABELS.has(lower) ? /** @type {any} */ (lower) : null;
}

/**
 * sConfig を解決して母音別 s マップを返す。sConfig 省略時は DEFAULT_S_BY_VOWEL。
 * sConfig.vowelMap があれば既定に上書きマージする。解決後の各値が有限で 0..1 域内で
 * なければ throw（出力 s の 0..1 不変条件を構築時に保証する）。
 * @param {undefined | { vowelMap?: Record<string, number> }} sConfig
 * @returns {Record<"a"|"i"|"u"|"e"|"o", number>}
 */
function resolveSByVowel(sConfig) {
  const merged = { ...DEFAULT_S_BY_VOWEL };
  if (sConfig !== undefined && sConfig !== null) {
    if (typeof sConfig !== "object") {
      throw new TypeError("sConfig must be an object (or omitted).");
    }
    const vowelMap = sConfig.vowelMap;
    if (vowelMap !== undefined && vowelMap !== null) {
      if (typeof vowelMap !== "object") {
        throw new TypeError("sConfig.vowelMap must be an object.");
      }
      for (const vowel of VOWEL_LABELS) {
        if (Object.prototype.hasOwnProperty.call(vowelMap, vowel)) {
          merged[vowel] = vowelMap[vowel];
        }
      }
    }
  }
  for (const vowel of VOWEL_LABELS) {
    const s = merged[vowel];
    if (!isFiniteNumber(s) || s < 0 || s > 1) {
      throw new RangeError(
        `sConfig produced s=${String(s)} for vowel "${vowel}"; s must be a finite number in 0..1.`
      );
    }
  }
  return merged;
}

/**
 * moras + WAV 実長 → intent.speech timeline（`{ timeline }`）を組む純関数。
 *
 * @param {ReadonlyArray<{ vowel?: unknown }>} moras
 *   audio_query のモーラ列（種類の並び）。pau/N/cl 等 enum 外も含む生の並び。
 * @param {number} wavDurationSec  合成 WAV の実秒（先頭/末尾無音込み）。有限・正。
 * @param {number} prePhonemeSec   WAV 先頭無音秒（audio_query の prePhonemeLength）。有限・非負。
 * @param {number} postPhonemeSec  WAV 末尾無音秒（audio_query の postPhonemeLength）。有限・非負。
 * @param {undefined | { vowelMap?: Record<string, number> }} [sConfig]
 *   母音別 s の差し替え設定（省略時 DEFAULT_S_BY_VOWEL）。
 * @returns {{ timeline: Array<{ timeMs: number; vowel: "a"|"i"|"u"|"e"|"o"; s: number }> }}
 * @throws {TypeError|RangeError} 入力不正・発話尺が非正・生成 0 要素・512 超過・s 域外設定。
 */
export function buildSpeechTimeline(
  moras,
  wavDurationSec,
  prePhonemeSec,
  postPhonemeSec,
  sConfig
) {
  if (!Array.isArray(moras)) {
    throw new TypeError("moras must be an array.");
  }
  if (moras.length === 0) {
    throw new RangeError("moras is empty; nothing to speak.");
  }
  if (!isFiniteNumber(wavDurationSec) || wavDurationSec <= 0) {
    throw new RangeError(
      `wavDurationSec must be a finite positive number; got ${String(wavDurationSec)}.`
    );
  }
  if (!isFiniteNumber(prePhonemeSec) || prePhonemeSec < 0) {
    throw new RangeError(
      `prePhonemeSec must be a finite non-negative number; got ${String(prePhonemeSec)}.`
    );
  }
  if (!isFiniteNumber(postPhonemeSec) || postPhonemeSec < 0) {
    throw new RangeError(
      `postPhonemeSec must be a finite non-negative number; got ${String(postPhonemeSec)}.`
    );
  }

  const bodyDurationSec = wavDurationSec - prePhonemeSec - postPhonemeSec;
  if (!(bodyDurationSec > 0)) {
    throw new RangeError(
      `utterance body duration (wavDurationSec - pre - post) must be positive; got ${bodyDurationSec}s ` +
        `(wav=${wavDurationSec}, pre=${prePhonemeSec}, post=${postPhonemeSec}).`
    );
  }

  const sByVowel = resolveSByVowel(sConfig);
  const slotSec = bodyDurationSec / moras.length;

  /** @type {Array<{ timeMs: number; vowel: "a"|"i"|"u"|"e"|"o"; s: number }>} */
  const timeline = [];
  let previousTimeMs = -1; // 最初の要素が 0 を取れるよう -1 起点（厳密単調 = prev+1 で押し出す）。

  for (let index = 0; index < moras.length; index += 1) {
    const mora = moras[index];
    const vowel = normalizeVowel(mora == null ? undefined : mora.vowel);
    if (vowel === null) {
      // enum 外 = 脱落。ただし時間スロット index は消費済み（gap として残る）。
      continue;
    }
    const rawTimeMs = (prePhonemeSec + index * slotSec) * 1000;
    // 整数化 + 厳密単調保証（最小 1ms 間隔で押し出す）。非負は previousTimeMs 起点 -1 が保証。
    const timeMs = Math.max(Math.round(rawTimeMs), previousTimeMs + 1);
    timeline.push({ timeMs, vowel, s: sByVowel[vowel] });
    previousTimeMs = timeMs;
  }

  if (timeline.length === 0) {
    throw new RangeError(
      "no voiced moras (a/i/u/e/o) after normalization; timeline would be empty (contract minItems=1)."
    );
  }
  if (timeline.length > MAX_TIMELINE_ITEMS) {
    throw new RangeError(
      `timeline has ${timeline.length} items, exceeding the contract maxItems ${MAX_TIMELINE_ITEMS} ` +
        "(裁定4). Sentence splitting is an S4+ concern; do not truncate."
    );
  }

  return { timeline };
}
