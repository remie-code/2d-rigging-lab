# S2 Domain A 実装記録: 取り込み + VAD + 発話セグメンタ（choke point 到達）

> Status: choke point 到達（install 待ち）・純関数層 + 子プロセス層は全緑（2026-07-12, Gnome）。
> スコープ: [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §3 Domain A。
> 事実台帳: [../../orchestration/s2-planning-inventory.md](../../orchestration/s2-planning-inventory.md)（§1 whisper.cpp・§3 周辺・§5 裁定）。
> 流儀の手本: [../s1/domain-a.md](../s1/domain-a.md)（純関数 + fixture + spawn 差し替えテスト）/ [../s1/s1-followup.md](../s1/s1-followup.md) §8（緑後ハング教訓）。

## 0. 判定サマリ

- **緑で裏取り済み（install 不要の層）**: 純関数 3 種（WAV エンコーダ・PCM フレーマ・発話セグメンタ）+ ffmpeg 子プロセス管理。魂の全テスト **129/129 緑**（S1 84 無退行 + 新規 45）。3 モノレポチェック無退行。lockfile/器/契約 不変。
- **install 待ちで blocked（choke point）**: Silero VAD ラッパ（`silero-vad.mjs`）は `onnxruntime-node` を要し、未 install では実機検証できない。コードは書いたが **VAD を import するテストは書いていない**（未 install で `node --test` 全体が赤化するのを防ぐため。動的 import + 注入で二重に防御）。依存は package.json に**宣言のみ**。
- **ユーザー作業（Orch へ）**: (a) `cd apps/soul/agent && npm install`、(b) `silero_vad.onnx`（≈2.33MB）を `vendor/models/` に配置。

## 1. 作成した全ファイル

すべて特区 `apps/soul/agent/` 内（pnpm workspace glob 対象外＝pnpm-lock.yaml 不変）。S1 既存ファイルは 1 行も変えていない（package.json のみ依存 1 行追加）。

| パス | 役割 | install 依存 |
| --- | --- | --- |
| `apps/soul/agent/.gitignore` | 魂 zone ローカル .gitignore（新設）。`vendor/`（whisper バイナリ + kotoba/silero モデル）と録音物（`*.wav`/`*.pcm`/`*.raw`/`recordings/`）を非コミット化。ルート .gitignore（器の領分）には触れない。 | なし |
| `src/wav-encode.mjs` | WAV エンコーダ純関数 `encodeWav(pcm, {sampleRate,channels,bitsPerSample})`。`wav-duration.mjs` の逆写像。 | なし |
| `src/pcm-framing.mjs` | PCM フレーム化 `splitFrames`（純）+ `createPcmFramer`（常駐）+ `decodeInt16LE`/`int16ToFloat32`（純変換）。 | なし |
| `src/speech-segmenter.mjs` | 発話セグメンタ `createSpeechSegmenter`（ストリーミング状態機械）+ `segmentSpeech`（バッチ純関数）。VAD 確率列 → speechStart/speechEnd/speechCancel イベント。 | なし |
| `src/fixtures-audio.mjs` | 合成 PCM fixture（`sinePcm`/`silencePcm`/`concatInt16`/`int16ToBytesLE`/`probSequence`）。実マイク・実 WAV 不使用。 | なし |
| `src/ffmpeg-capture.mjs` | ffmpeg 常駐マイク取り込み `createFfmpegCapture` + `buildFfmpegArgs`（純）+ `resolveFfmpegPath`（純）。再起動耐性 + クリーンシャットダウン。 | なし（実 ffmpeg は任意） |
| `src/silero-vad.mjs` | **Silero VAD v5 ONNX ラッパ**（PCM フレーム → 発話確率）。onnxruntime-node を **init() 内で動的 import**。 | **onnxruntime-node（install 待ち）** |
| `src/test-support/fake-ffmpeg.mjs` | 合成 PCM を吐くダミー ffmpeg（機械テスト用・spawn 差し替え注入点）。 | なし |
| `src/wav-encode.test.mjs` | WAV エンコーダの node:test（11 ケース・wavDurationSec とのラウンドトリップ）。 | なし |
| `src/pcm-framing.test.mjs` | フレーマ/変換の node:test（13 ケース・半端バイト持ち越し）。 | なし |
| `src/speech-segmenter.test.mjs` | セグメンタの node:test（14 ケース・境界固定）。 | なし |
| `src/ffmpeg-capture.test.mjs` | ffmpeg キャプチャの node:test（7 ケース・合成 PCM 往復 / 再起動 / シャットダウン）。 | なし |

依存グラフ: すべて `.mjs`（自 zone 相対 import）+ `node:*` のみ。器コードの相対 import ゼロ（soul-zone check 緑）。**どのテスト到達モジュールも `silero-vad.mjs` / `onnxruntime-node` を import しない**（`node --test` で VAD 層は一切ロードされない＝純関数層だけで緑を固定）。

## 2. 純関数の契約と決定したエッジケース

### 2.1 `encodeWav(pcm, options)` — `wav-duration.mjs` の逆

- **入力**: `Int16Array`（s16 サンプル列・LE で書く）または `Uint8Array`（既にシリアライズ済み生バイト列）。`options` = `sampleRate`(既定 16000)・`channels`(1)・`bitsPerSample`(16)。
- **出力**: canonical 44 byte ヘッダ（RIFF + fmt(16,PCM) + data）+ PCM 本体の `Uint8Array`。
- **不変条件（テスト固定）**: `encodeWav(pcm)` を `wavDurationSec` に通すと尺 =(サンプル数/channels)/sampleRate が復元（ラウンドトリップ）。書く側は寛容パーサ（wav-duration）と違い最も素直な canonical 形のみ出す。
- **throw**: 非 typed-array / Int16Array で bitsPerSample≠16 / Uint8Array 長が blockAlign 非倍数 / sampleRate・channels・bitsPerSample 非正（bits は 8 の倍数）。

### 2.2 `pcm-framing.mjs` — バイトストリーム → 固定長フレーム

- `splitFrames(leftover, chunk, frameBytes)` → `{ frames: Uint8Array[], leftover }`（純）。OS パイプがサンプル境界を無視して割る前提で、**半端バイトを leftover へ持ち越す**。返すフレームは `slice` コピー（内部バッファと非共有）。leftover 空時は連結を省いて割当回避。
- `createPcmFramer({ frameSamples=512, bytesPerSample=2 })` → `push(chunk)→Int16Array[]` / `leftoverBytes()` / `reset()`。`splitFrames` を状態で畳んだ薄い層。**既定 frameSamples=512 = Silero v5 @16kHz の必須フレーム長**（1024 byte）。
- `decodeInt16LE(bytes)`（奇数長 throw）・`int16ToFloat32(int16)`（/32768 正規化・-32768→-1.0）。VAD 入力の Float32 化を純変換で提供し、ONNX には触れない。

### 2.3 `speech-segmenter.mjs` — VAD 確率列 → 発話イベント（Domain A の心臓）

Silero `get_speech_timestamps` 準拠の語彙のヒステリシス状態機械。**onnxruntime 非依存の純ロジック**なので合成確率列で境界を完全固定できる。

- **オプション（whisper-server VAD 相当の語彙）**: `threshold`(既定 0.5・立ち上げ)・`negThreshold`(既定 threshold-0.15=0.35・立ち下げ)・`minSpeechMs`(250・これ未満は棄却)・`minSilenceMs`(100・無音確定に要する継続)・`speechPadMs`(30・前後膨らませ)・`maxSpeechMs`(既定 Infinity・超えたら無音を待たず強制区切り)。バッチ API は `frameMs`(既定 32)。
- **決定したエッジケース（fixture 固定）**:
  1. **無音→発話→無音**: threshold 跨ぎで発話開始、negThreshold を割って minSilence 継続で終了。padded な `{startMs,endMs}` を出す。
  2. **スパイク棄却**: 発話長 < minSpeech は `speechEnd` を出さず `speechCancel`（暫定オンセットの retraction）。segments から除外。
  3. **長発話の分割**: maxSpeech 超過で無音を待たず区切り（`reason:"maxSpeech"`）。同一発話としてその場から次セグメントを継続（新規オンセット扱いにしない）。
  4. **ヒステリシス**: threshold 未満でも negThreshold 以上のディップでは区切らない（無音候補をリセット）。
  5. **パディング clamp**: padded 開始は `max(0, raw-pad)`（0ms 未満に食い込まない）。
  6. **時刻の単調性**: `push` の tMs は非減少必須（後退は throw）。probability/tMs 非有限は throw。threshold∈(0,1]・negThreshold∈[0,threshold) を構築時に検査。
  7. **flush**: ストリーム終端で triggered 中なら endRaw=最終時刻で確定 or 棄却（`reason:"flush"`）。

## 3. 子プロセス管理と終了処理設計（S1 ハング教訓の適用）

### 3.1 ffmpeg キャプチャ（`ffmpeg-capture.mjs`）

- **設定可能点**: `ffmpegPath`（既定 PATH の "ffmpeg" → env `FFMPEG_PATH` → option の順で上書き。魂は ffmpeg パスを設定で上書きできる）・`inputFormat`（win32 既定 dshow）・`device`・`sampleRate`/`channels`・`args`（丸ごと上書き＝テスト注入点）。
- **再起動耐性（クラッシュループ・バックオフ）**: dispose していなければ `restartDelayMs`(既定 500) 後に再 spawn。`maxRestarts`(既定 5) で無限ループ打ち切り。プロセスが `restartResetMs`(既定 5000) 以上生きてから死んだら「一度は正常稼働」とみなし restart 予算をリセット（起動直後に死に続けるデバイス不正だけを打ち切る）。**タイマ・時計は注入可能**（`setTimeoutImpl`/`nowImpl`）でテストは実時間を待たない。再起動タイマは `unref()`。
- **クリーンシャットダウン（s1-followup §8 の型）**: `dispose()` は (1) 再起動タイマ clear、(2) 再起動停止（disposed フラグで exit ハンドラ早期 return）、(3) `child.kill()`、(4) **stdio パイプ destroy**、(5) `child.unref()`。「kill したが OS 未 reap の子 / 未 destroy のパイプが event loop を生かす」窓を塞ぐ。冪等。
- **テスト（実 ffmpeg・実マイク不要）**: `ffmpegPath=process.execPath` + `args=[fake-ffmpeg.mjs,…]` で**合成 PCM を吐くダミー子プロセス**を注入し、(a) PCM の stdout 往復、(b) 異常終了→再起動→maxRestarts 打ち切り、(c) dispose での畳み込みと冪等、(d) stderr 経路を検証。実 ffmpeg の疎通は人間ゲート／任意 preflight の領分（実マイク録音は禁止）。

### 3.2 Silero VAD ラッパ（`silero-vad.mjs`・choke point）

- **依存の遅延ロード**: onnxruntime-node は `init()` 内で**動的 import**（`ortImpl` 注入可）。→ この .mjs 自体は install 前でも import でき、native ロードは init() 呼び出し時のみ。万一この .mjs を import する経路が混ざっても、モジュール評価では throw しない（`node --test` を守る二重防御）。
- **セッションのクリーンシャットダウン**: `dispose()` で `session.release()`（best-effort）。`reset()` で再帰状態を 0 に戻す（無音後 / ffmpeg 再起動時）。
- **Silero v5 ONNX I/O 契約（要 install 後実機確認）**: 入力 `input`(float32 [1,512])・`state`(float32 [2,1,128])・`sr`(int64 スカラ 16000)、出力 `output`(確率)・`stateN`(新状態)。入出力名はモデル版で変わり得るため上書き可能（既定は v5 名）。**この契約は install + モデル配置後の preflight-vad で実検証する続行フェーズの前提**（配線 ≠ 疎通）。

## 4. VAD イベントの形と将来消費の継ぎ目（S6 barge-in / S9 相槌）

セグメンタが出す 3 イベント（`createSpeechSegmenter` の `push`/`flush` 返り値 + `onEvent` コールバックの双方で購読可能）:

| type | いつ | payload | 購読者 |
| --- | --- | --- | --- |
| `speechStart` | 確率が threshold を跨いだ**瞬間**（即発火・暫定オンセット） | `{ tMs }`（padded 開始） | **S6 barge-in**（喋り出しを最短で知り AI をダック/停止） |
| `speechEnd` | minSilence 分の無音確定 かつ 発話長 ≥ minSpeech | `{ tMs, startMs, endMs, durationMs, reason }` | **Domain B ASR**（この範囲を WAV に切って whisper へ）/ **S9 相槌**（一区切りを知る） |
| `speechCancel` | 暫定オンセットが minSpeech 未満で消えた（スパイク棄却） | `{ tMs, startMs }` | **S6**（speechStart で始めた duck を取り消す） |

- **設計意図**: barge-in は「即応性」、相槌/ASR は「確定性」を要求する。両者を分離した 3 イベントで、S6 は `speechStart`/`speechCancel` を、S9/Domain B は `speechEnd` を購読すればよい。`speechEnd.reason`（`silence`/`maxSpeech`/`flush`）で「ユーザーが一区切りついた」と「長すぎるので機械的に切った」を区別できる（S9 は `silence` のみ相槌を打つ、等の判断材料）。
- **継ぎ目の形**: `speechEnd` の `{startMs, endMs}` が Domain B/C で「PCM リングバッファのこの範囲を `encodeWav` して whisper-server へ」の入力になる。VAD 確率は `silero-vad.mjs.process()` → `speech-segmenter` の `push(prob, tMs)` へ流す（Domain C で結線）。

## 5. 機械ゲート（生出力）

### 5.1 `node --test`（魂の全スイート・S1 無退行 + 新規）

```
1..129
# tests 129
# suites 0
# pass 129
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
内訳: S1 baseline 84（着手前に単独確認・84/84）+ 新規 45（wav-encode 11 + pcm-framing 13 + speech-segmenter 14 + ffmpeg-capture 7。per-file 数はレビュー実測で訂正済み—domain-a-review.md 検証 1・note 2）。`silero-vad.mjs` は import されずロードされない（VAD 層は install 後の続行フェーズで検証）。

### 5.2 モノレポ 3 チェック（実 exit code）

```
soul-zone EXIT=0  Soul zone boundary guard passed: 1285 source files scanned; no 器→魂 imports and no 魂→器 code imports.
deps      EXIT=0  Dependency guard passed.（onnxruntime-node 宣言は禁止依存パターンに非該当）
source    EXIT=1  apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
```
- soul-zone: 1285 files（baseline 1274 + 新規 11 .mjs）。緑。
- deps: 緑。onnxruntime-node は live2d/cubism 等の禁止パターンに一致しない。
- source: **EXIT=1 だが baseline と同一の既存の器側違反 1 件のみ**（着手前から EXIT=1・S1 followup §7・task_c46e0820）。**私の魂ファイルは新規違反ゼロ＝無退行**。

### 5.3 git status / 保護対象不変（生出力）

```
 M apps/soul/agent/package.json      ← onnxruntime-node 1 行追加のみ
?? apps/soul/agent/.gitignore
?? apps/soul/agent/src/{wav-encode,pcm-framing,speech-segmenter,fixtures-audio,ffmpeg-capture,silero-vad}.mjs
?? apps/soul/agent/src/{wav-encode,pcm-framing,speech-segmenter,ffmpeg-capture}.test.mjs
?? apps/soul/agent/src/test-support/fake-ffmpeg.mjs
```
- `git diff --stat`: pnpm-lock.yaml / apps/soul/agent/package-lock.json / 器 C4 契約 fixture すべて**空（不変）**。npm install していないので package-lock.json は変わらない。
- vendor: `git status --porcelain apps/soul/agent/vendor` **空**（.gitignore で ignore・kotoba/silero モデルもコミット候補に出ない。`git check-ignore` で vendor/・537MB kotoba・将来の silero_vad.onnx の 3 パスが ignored であることを確認済み）。

## 6. ONNX モデル入手経路の調査結果（Orch → ユーザー必須事項）

**VAD 採用の設計判断 = onnxruntime-node 直利用**（既製 `@ricky0123/vad` 不採用）。理由: (1) 依存最小 — @ricky0123/vad-node も内部で onnxruntime-node を引くため抽象層が増えるだけ、(2) モデルを vendor ファイルとして扱う既存パターン（whisper バイナリ + kotoba モデルの非コミット配置）と一致し、モデル版を明示制御できる、(3) Silero v5 の ONNX I/O は素直で薄いラッパで足りる（§3.2）。

| 品目 | 事実 | 出所 |
| --- | --- | --- |
| npm 依存 | `onnxruntime-node@1.27.0`（onnxruntime-common@1.27.0 に依存・os: win32/darwin/linux・プリビルド CPU バイナリ）。package.json に**宣言のみ**。 | npm registry `onnxruntime-node/latest`（2026-07 実取得） |
| ONNX モデル | **同梱されない → 別途ダウンロード要**。onnxruntime-node は実行時のみで、モデルは持たない。 | 設計判断（直利用） |
| モデルファイル | `silero_vad.onnx` / **2,327,524 byte（≈2.33MB）** / MIT | GitHub API `snakers4/silero-vad` contents（2026-07 実取得） |
| ダウンロード URL | `https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx` | 同上 |
| 配置先 | `apps/soul/agent/vendor/models/silero_vad.onnx`（`silero-vad.mjs` の既定 `DEFAULT_SILERO_MODEL_PATH`・設定で上書き可・vendor/ は .gitignore 済み非コミット） | 本実装 |

> 補足: whisper.cpp vendor 一式には `whisper-vad-speech-segments.exe` / `test-vad*.exe` はあるが、これは whisper.cpp 内蔵 VAD（GGML 形式 silero）用で、**魂側 onnxruntime-node が食う ONNX 形式の silero_vad.onnx とは別物**。現状 vendor/ に ONNX 版 silero は無いため、上記の別 DL が必要。

## 7. choke point 状態と続行フェーズの前提

- **緑で確定（この段階で機械ゲート合格）**: 純関数 3 種 + fixture + ffmpeg 子プロセス管理。129/129・3 チェック無退行・保護対象不変。
- **install 待ちで blocked**: `silero-vad.mjs` の実機検証。続行フェーズで (1) `npm install` 後に `check:soul-zone/deps/source` 無退行を再確認（S1 domain-a §5 の予測どおりか）、(2) `silero_vad.onnx` 配置後に **preflight-vad**（固定合成 PCM フレーム → 確率が出るか・§3.2 の I/O 名が v5 実物と一致するか）を書いて疎通、(3) VAD ラッパを import するテストを追加（動的 import + `ortImpl` 注入 or 実モデル）。これらは Domain B/C（whisper クライアント + 常駐結線）と地続き。
