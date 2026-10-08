# S2 Domain C 実装記録: 常時稼働の結線 + CLI 診断 + 計測 + docs

> Status: 完了（機械ゲート全合格・preflight 3 種実機 PASS・チューニング打ち切り基準到達）（2026-07-12, Gnome）。
> スコープ: [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §3 Domain C（設計注記込み）。
> 前工程: [domain-a.md](domain-a.md)（VAD イベント契約）/ [domain-b.md](domain-b.md)（ライフサイクル・バッファ契約・レイテンシ実測）/ 各レビューの notes。
> 計測記録: [../../../experiments/s2-ears.md](../../../experiments/s2-ears.md)。人間ゲート手順: [human-gate-procedure.md](human-gate-procedure.md)。

## 0. 判定サマリ

- **魂の全テスト 196/196 緑**（baseline 160 無退行 + 新規 36）。全スイート ×3 + 新規ファイル群単独 ×5、全て fail 0・cancelled 0。
- **preflight 3 種 実機 PASS**: preflight-vad（実 ONNX・I/O 名照合 OK）/ preflight-asr（実 whisper・6T）/ **preflight-ears（実 VAD + 実 whisper の縦貫通・採用既定そのまま・発話終了→転写 1475/1511ms）**。全実行後の孤児プロセスなし。
- **チューニング打ち切り基準到達**: 採用構成（threads 6 + 動的 audio_ctx）で warm **1.5〜1.8s ≤ 2〜3s**（未チューニング 6.6〜9.5s から ≈4 倍改善・転写品質は全窓と一致）。
- 3 モノレポチェック無退行・保護対象（pnpm-lock / C4 契約 / S1 実装挙動）不変・音声ファイルの新規生成物ゼロ。
- **重大バグ発見 2 件（縦貫通で初めて顕在化・いずれも silero-vad.mjs の明示許可内で最小修正）**: §3 参照。この修正なしでは S2 人間ゲートは確実に不合格だった。

## 1. 作成/変更した全ファイル

### 新規（すべて特区 `apps/soul/agent/` + 本記録系）

| パス | 役割 | テスト |
| --- | --- | --- |
| `src/pcm-ring-buffer.mjs` | PCM リングバッファ（直近 40s 保持・ストリーム時刻範囲切り出し・**[保持窓先頭, 実データ末尾] clamp**） | `src/pcm-ring-buffer.test.mjs`（8） |
| `src/ear-pipeline.mjs` | **耳パイプライン常駐結線（本丸）**: ffmpeg→framer→VAD→segmenter→リング切り出し→WAV→ASR→転写バッファ。ライフサイクル・直列キュー・死活監視・外側見張り | `src/ear-pipeline.test.mjs`（10・全部品注入で実機非依存） |
| `src/whisper-inference.mjs` | 動的 audio_ctx 対応 /inference 呼び出し + `computeAudioCtx` 純関数（チューニングの本体） | `src/whisper-inference.test.mjs`（3） |
| `src/ears-cli.mjs` | 耳 CLI 診断（stdout: VAD/転写/診断・stderr: 1 行 JSON 計測・SIGINT/EOF 全 dispose・--list-devices） | `src/ears-cli.test.mjs`（5・fake pipeline 注入） |
| `scripts/preflight-vad.mjs` | VAD 実機疎通（I/O 名照合・無音/正弦波/TTS 確率・レビュー使い捨てプローブの再現資材化） | 実機実行 PASS（§6） |
| `scripts/preflight-ears.mjs` | **耳の縦貫通実機疎通**（fake マイクに TTS PCM を実時間注入 → 実 VAD + 実 whisper） | 実機実行 PASS（§6） |
| `scripts/bench-asr.mjs` | チューニング計測格子（threads / server-ac / request-ac / extra / runs） | 計測に使用（experiments） |
| `discussion/ai-cohost/experiments/s2-ears.md` | 計測記録 | — |
| `discussion/ai-cohost/implementation/waves/s2/human-gate-procedure.md` | 人間ゲート手順書 | — |
| 本記録（domain-c.md） | — | — |

### 既存ファイルの変更（明示許可との対応）

| パス | 変更 | 許可根拠 |
| --- | --- | --- |
| `src/silero-vad.mjs` | (1) 出力名不一致の NaN → 明示 throw（note 7 の回収そのもの） (2) **v5 入力文脈 64 サンプルの前置（576 入力）— 機能不全バグの修正**（§3.1） (3) セッション既定 `intraOpNumThreads: 1`（アイドル CPU 358%→1.8%/コア・§3.2） | wave 指示「silero-vad.mjs 変更の明示許可（note 7 回収）」。(2)(3) は同ファイルへの追加バグ修正で、S2 ゴール成立に必須のため最小変更 + 理由記録で実施（**事後承認を質問として明記・§9-Q1**） |
| `src/whisper-server.test.mjs` | onExit 正経路テスト 1 本追加（ready 後の非 dispose 死 → onExit 発火。note 3 回収） | wave 指示「whisper-server.test.mjs への追加を明示許可」 |
| `src/transcript-buffer.mjs` | JSDoc に listener 例外契約を明文化（コード変更なし・note 4 回収） | wave 指示「JSDoc 追記 = 既存ファイル変更を明示許可・最小」 |
| `apps/soul/README.md` | S2 節の追記（追記のみ） | wave 指示「明示許可・追記のみ」 |
| `waves/s2/s2-followup.md` | §4 追記（現況更新 + 新規持ち越し 5 件） | wave 指示 |
| （参考）`package.json` / `package-lock.json` の M | **本 domain では 1 バイトも触れていない**（Domain A + choke point install の受理済み差分） | — |

依存グラフ: 新規はすべて `.mjs` + `node:*` + 自 zone 相対 import のみ。**新規 npm 依存ゼロ**。S1（cli.mjs 等）と Domain A/B の他ファイル（whisper-client / speech-segmenter / ffmpeg-capture / pcm-framing / wav-encode …）は 1 行も変えていない（untracked のため git diff では証せないが、baseline 160 テストの無退行 + 本記録の変更列挙が根拠 = domain-b-review note 7 の流儀）。

## 2. 結線設計（wave 計画 §3 の設計注記への回答）

### 2.1 ストリーム時計とリングバッファ clamp（note 1 回収）

- リングに書いた**総サンプル数が唯一の時計**。セグメンタへ渡すフレーム tMs も speechEnd の範囲も同じサンプル数由来なので、壁時計とのズレが構造的に存在しない（壁時計は転写レイテンシ計測のみ）。
- 容量 40s（`ringMs` 既定）= maxSpeech 20s + pad + キュー滞留の余裕。
- `slice()` は要求範囲を **[保持窓先頭, 実データ末尾]** に必ず clamp し、実際に切り出せた範囲を返す（flush 時 pad 超過・maxSpeech 分割の 2×pad 重なり・容量超過破棄のすべてに安全）。fixture テストで clamp 境界・容量超過・コピー非共有を固定。

### 2.2 ASR 直列化（設計判断）

- **FIFO キュー + 直列ワーカー**。whisper-server は 1 つのスレッドプールなので並行に投げても速くならず、順序も守れる直列が素直。
- **キュー上限 4・溢れは最古を捨てる**（診断 `asrDropped` 付き）: 会話追従が目的なので詰まったら新しい発話を優先。採用構成の warm 1.5〜1.8s では、20s 発話の機械分割が連続しても理論上溢れない（分割間隔 20s ≫ 転写 5s）。
- テストで「実行中 1 + キュー 2 + 溢れ 3」の帳尻と直列性を固定。

### 2.3 whisper-server 監視 2 経路と死亡時方針（notes 2/3 回収）

- **経路 1**: `start()` 内の `await server.ready` の reject（spawn 失敗は onExit に乗らずここで観測される）→ 開いた分（VAD・server）を畳んで throw（マイクは開かない）。
- **経路 2**: ready 後の `onExit`（非 dispose 死）→ `asrDown` を立て、キューを診断付きで破棄。**再起動しない**（設計判断）: ASR サーバの死は systemic（ポート衝突・OOM・モデル破損）でありがちで、512MB ロードの自動リトライは配信中の CPU を荒らす。**VAD イベントは生かし続け**（S6 barge-in の土台は死なない）、CLI が whisperDown を表示して人間の再起動に委ねる。onExit 正経路は whisper-server.test.mjs の追加テスト（fake child を直接 kill）で固定。

### 2.4 1 発話の外側見張り（note 1 回収）

- `transcribe→append` 全体を `utteranceTimeoutMs`（既定 45s）の watchdog で包む（Promise.race・finally で必ず clear・unref しない規律）。タイムアウト/失敗は**その 1 発話を落として常駐続行**（診断 `asrFailure`）。
- さらに転写呼び出し自体を whisper-inference.mjs にした結果、**本文読み取りもタイマの内側**（clear は try 全体の finally にのみ）— note 1 の懸念は新経路では構造で消えている（本文ハングのテストで固定）。

### 2.5 listener 例外契約の線引き（note 4 回収）

- **契約 = 「listener は throw しない」を transcript-buffer.mjs の JSDoc に明文化**（throw は append 呼び出し元へ伝播し残り listener スキップ・正本は壊れない、という現挙動の文書化。コード不変更）。
- 結線層の吸収: パイプライン自身の onTranscript 通知は**最初に登録した自前 listener** で行う（登録順発火なので外部購読者の throw に巻き込まれない）。外部の throw は診断 `listenerError` に落として常駐続行。固定テスト 1 本（外部 listener が throw しても onTranscript 配信・正本・次発話の処理が生きる）。

### 2.6 クリーンシャットダウン

- `dispose()` 一発: capture（kill+stdio destroy+unref は部品側）→ キュー破棄 → VAD セッション release → whisper-server dispose。冪等。watchdog は各発話の finally で clear 済み。処理中の transcribe は server kill で速やかに reject → finally が回収。
- テストで固定: dispose 後の全部品 dispose フラグ・冪等・以後の PCM 無視。テストプロセスが 1 秒強で正常終了する（ハングなし）こと自体が傍証。

### 2.7 VAD 直列チェーンと ffmpeg 再起動

- VAD 推論（async）はフレーム到着順の promise チェーンで直列化（silero は再帰状態を持つため順序が意味を持つ。per-frame 0.18ms ≪ 32ms 実時間なので滞留しない）。
- ffmpeg の exit（再起動は capture 自身の耐性）で framer の半端バイトと VAD の再帰状態/文脈をリセット（ストリーム時計とリングは単調のまま）。

## 3. 縦貫通で発見した重大バグ 2 件（Domain A の潜在バグ・silero-vad.mjs で最小修正）

### 3.1 Silero v5 の入力は「64 文脈 + 512 = 576 サンプル」（機能不全）

- preflight-vad に TTS 音声検証を足したところ、**実音声に対して確率 max 0.096** しか出ないことが発覚（threshold 0.5 に一度も届かない = **耳は実音声で発話を一切検出できない**）。無音/正弦波だけを見ていた従来プローブでは見えなかった。
- 原因: Silero v5 の ONNX は各フレームの前に**直前フレーム末尾 64 サンプルの文脈**を連結した 576 入力を要求する（公式 OnnxWrapper の context_size と同じ）。512 単独でも実行は通る（動的 shape）が確率が壊れる。
- 実測照合（同一 TTS 音声）: 512 入力 max=0.0958 / **576 入力 max=1.0000・56/80 フレーム ≥0.5**。
- 修正: ラッパ内部で文脈を持ち回り（reset で 0 化・`contextSamples` 上書き可）。修正後 preflight-vad PASS（TTS max 0.9999・無音 0.0089）。fake ortImpl テストで 576 契約と文脈持ち回りを固定。

### 3.2 onnxruntime 既定セッションのアイドル CPU 空費

- VAD を実時間レートで回すだけで **≈358%/コア** を消費（onnxruntime 既定スレッドプールのスピン待ち）。配信で器の二体と並走する魂として容認できない。
- `intraOpNumThreads: 1` で **≈1.8%/コア**・per-frame 0.20ms → 0.18ms（悪化なし・実測）。silero-vad.mjs の既定に反映（`sessionOptions` で上書き可・テスト固定）。

## 4. 常駐既定とその根拠

| 既定 | 値 | 根拠 |
| --- | --- | --- |
| maxSpeechMs | **20000** | Orch 提案・Undine 裁定範囲 15000〜30000 内。whisper 30s 窓に pad 込みで収まり、長話でも 20s ごとに転写が追いつく。セグメンタ純関数の既定 Infinity は不変更（結線層で与える） |
| threads | **6** | 実測: 8T 比 +9〜11%（1673〜1780ms vs 1535ms）= 裁定基準「最速に近い最小スレッド数」。4T は +26%。※ `-t` は総 CPU を律しない実測注意（experiments §4・followup §4-3） |
| audio_ctx | **動的**: `clamp(ceil(秒×50)+96, 256, 1500)` | /inference の `audio_ctx` フィールドをリクエスト単位で受けることを実機照合。margin 0 で反復・短発話は下限 256 未満で劣化・式値で全ケース全窓一致（experiments §2.1 の品質境界表） |
| minSilenceMs | **400** | セグメンタ既定 100ms は読点程度の間で細切れになり ASR 呼び出しが増えるため、常駐は「一呼吸」の 400ms（上書き可・人間ゲートの追撃対象） |
| ringMs / queueMax / utteranceTimeoutMs | 40000 / 4 / 45000 | §2.1 / §2.2 / §2.4 |

## 5. チューニング結果（要約・全表は experiments/s2-ears.md）

- 3 系統: (a) audio_ctx 動的 = **6.7s → 1.5s @8T（4.4 倍）・品質全窓一致** → 採用 / (b) threads 4/6/8 → 6T 採用 / (c) `-nf`・`-bo 1` → 効果なし（temperature 0 の greedy では発動しない）・不採用。
- **打ち切り判定: 到達**。採用構成 warm 1.5〜1.8s（分布 N=8: min 1740 / median 1760 / max 1821ms・外れ値なし）≤ 基準 2〜3s。
- 縦貫通の発話終了→転写: **1475 / 1511ms**（preflight-ears・採用既定そのまま）。

## 6. preflight 生出力（実機・全て今回実行）

### 6.1 preflight-vad（修正後・PASS）

```
[preflight-vad] io: inputs=["input","state","sr"] outputs=["output","stateN"]
[preflight-vad] io match (v5 expectation input/state/sr -> output/stateN): OK
[preflight-vad] prob(silence 512ms): n=16 max=0.0089 mean=0.0055
[preflight-vad] prob(sine 440Hz 512ms): n=16 max=0.0024 mean=0.0004
[preflight-vad] probabilities finite & in [0,1]: OK
[preflight-vad] prob(tts "こんにちは、耳のテストです" 2.64s): n=82 max=0.9999 mean=0.6984 frames>=0.5: 58/82
[preflight-vad] RESULT: PASS (io names match; probabilities sane; dispose clean)
PREFLIGHT_EXIT=0
```

（修正前の初回実行は `prob(tts …) max=0.0925 frames>=0.5: 0/80 → RESULT: FAIL` — §3.1 のバグを掘り当てた生出力。）

### 6.2 preflight-asr（6T・PASS）

```
[preflight-asr] WAV: 84834 bytes, 2.650s
[preflight-asr] server READY in 531ms (HTTP responding = model loaded & listening)
[preflight-asr] inference #1 (cold): 7454ms  text="こんにちは耳のテストです"
[preflight-asr] inference #2 (warm): 7469ms  text="こんにちは耳のテストです"
[preflight-asr] RESULT: PASS (tts WAV; server ready 531ms; /inference round-trip OK; response structure {text} OK; buffer append OK)
PREFLIGHT_EXIT=0
```

（preflight-asr は素の全窓経路 = 未チューニング基準の再現。採用チューニング経路の実機 PASS は 6.3 と bench-asr。）

### 6.3 preflight-ears（採用既定の縦貫通・PASS）

```
[preflight-ears] stream: 7.67s (utt1 2.61s / utt2 2.75s)
[preflight-ears] pipeline started in 542ms (VAD init + whisper ready)
[preflight-ears] vad: speechEnd 0.64..2.97s (silence)
[preflight-ears] transcript[0] 0.64..2.97s latency=1475ms audio_ctx=256  "こんにちは耳のテストです"
[preflight-ears] vad: speechEnd 4.23..6.62s (silence)
[preflight-ears] transcript[1] 4.23..6.62s latency=1511ms audio_ctx=256  "今日はメッシュ生成の続きをやります"
[preflight-ears] RESULT: PASS (2 utterances transcribed via real VAD + real whisper; stats={"frames":239,"speechStarts":2,"speechEnds":2,"speechCancels":0,"asrDone":2,"asrFailed":0,"asrDropped":0,"asrSkipped":0,"vadErrors":0,"asrQueue":0,"asrDown":false,"buffer":{"appended":2,"discarded":0}})
PREFLIGHT_EXIT=0
```

### 6.4 孤児プロセス確認（全 preflight/bench 実行後・毎回）

```
$ tasklist | grep -iE "whisper|ffmpeg"
（空）GREP_EXIT=1 (1 = no orphan)
```

## 7. 機械ゲート（生出力）

### 7.1 `node --test`（魂の全スイート）

```
1..196
# tests 196
# pass 196
# fail 0
# cancelled 0
```

- 内訳: baseline 160（S1 84 + Domain A 45 + Domain B 31・無退行）+ **新規 36** = silero-vad 9 + pcm-ring-buffer 8 + ear-pipeline 10 + whisper-inference 3 + ears-cli 5 + whisper-server +1（10→11）。per-file 数は各ファイル単独実行の `^ok ` 計数（実測）。
- 安定性: 全スイート ×3 + 新規 5 ファイル単独 ×5、すべて fail 0・cancelled 0。

### 7.2 モノレポ 3 チェック（リポジトリルート・timeout 付き・実 exit code）

```
Soul zone boundary guard passed: 1304 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soul-zone EXIT=0
Dependency guard passed.
deps EXIT=0
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source EXIT=1
```

- soul-zone 1304 = Domain B レビュー時 1292 + 新規 12（src 9 + scripts 3）。source の赤 1 件は既知 baseline（器側・S1 followup §7）のみ = 無退行。

### 7.3 保護対象・触れたファイルの裏取り

```
$ git diff --stat pnpm-lock.yaml apps/runtime-player/src/main/control-channel/contract/
（空 = 不変）
$ git status --porcelain | grep -iE '\.(wav|pcm|raw|mp3|ogg)'
（空）AUDIO_GREP_EXIT=1 = 音声ファイルの新規生成物なし
$ git status --porcelain apps/soul/agent/vendor
（空 = ignore 済み・非コミット維持）
```

- tracked の M は `apps/soul/README.md`（許可された追記）と package.json/package-lock.json（Domain A/install の受理済み差分・本 domain 不触）のみ。`s2-wave-plan.md` の M は Orch の Status 更新（私ではない）。
- 音声はすべてメモリ上のみ（preflight/bench は `node:fs` 不使用の経路のみ・writeTempWav 不使用）。

## 8. 人間ゲート手順書の要約（[human-gate-procedure.md](human-gate-procedure.md)）

1. （任意）preflight-vad / preflight-ears でマイク以外の全部品を事前疎通。
2. `ears-cli --list-devices` でマイク名を調べ、`ears-cli --device "名前"` で起動。
3. 普通に喋る → speechStart / speechEnd / `[text]`（+latency）が積もるのを見る。合格 = 「発話ごとに正しい転写が数秒以内（目安 2〜3s）に積もる」。OBS 同時起動での共有キャプチャ確認も 1 回。
4. 追撃ノブ: `--threshold`（VAD 感度）/ `--min-silence-ms`（区切りの間）/ `--threads` / `--no-dynamic-audio-ctx`（品質切り分け）。
5. トラブルシュート表: 起動失敗（ready reject）・ffmpegExit 連発（デバイス名）・whisperDown（ASR 停止・VAD 継続・要 CLI 再起動）等。

## 9. 迷った設計判断・S3 への引き継ぎ・質問

### 迷った設計判断（記録）

1. **whisper-server 死亡時の再起動なし**（§2.3）— 自動復旧の需要は運用で確認してから（followup §4-2）。
2. **キュー溢れ = 最古を捨てる**（§2.2）— 「記憶の完全性」より「会話の追従」を優先。どちらでも欠落は起きる状況であり、S3 の発火判定は新しい発話を必要とする。
3. **minSilenceMs 400 の常駐既定** — 裁定があったのは maxSpeech のみだが、maxSpeech と同種の「結線層のセグメンタ設定」と判断して与えた。人間ゲートの体感で調整されるべき第一候補（手順書 §5 に明記）。
4. **audio_ctx margin を実測最小 +64 でなく +96 に** — 丸め・pad ばらつきへの保険。コスト +60ms 程度で品質側に倒した。
5. **dispose はストリーム終端の flush をしない** — 畳むときに triggered 中の言いかけを ASR へ送らない（送っても消費者がいない）。セグメンタの flush API は純関数層に残っているので、必要になれば結線に足せる。

### S3 への引き継ぎ

- **消費の入口**: `earPipeline.transcriptBuffer.onAppend`（正本）+ `onVadEvent`（speechStart/End/Cancel・S6/S9 用）。listener は throw しない契約（transcript-buffer.mjs JSDoc）。
- **レイテンシ予算**: 発話終了（無音 400ms 確定）→ 転写到着 ≈1.5〜2s。S3 の発火判定はこの遅延を織り込むこと。
- followup §4 の 5 件（whisper-inference 統合・再起動・-t と CPU・maxSpeech 分割の reason 伝搬・VAD イベントの直接購読）。

### Orch への質問

1. **silero-vad.mjs の許可範囲を超えた 2 修正の事後承認**（§3）: 明示許可は note 7（NaN→throw）のみだったが、(a) v5 576 入力バグは S2 ゴール（喋ると転写が積もる）自体を不成立にする機能不全、(b) アイドル CPU 358%/コアは配信前提で容認不能、と判断し同ファイル内の最小修正で実施した（実測根拠・テスト固定・本記録に理由明記）。この判断の受理を確認したい。受理できない場合は revert 手順も自明（該当 3 差分は独立）。
2. **preflight-asr の「採用チューニング設定での PASS」解釈**: preflight-asr は Domain B 成果（変更禁止）で audio_ctx を持たないため、素の全窓経路 @6T で PASS を取り、採用経路の実機 PASS は preflight-ears（採用既定の縦貫通）と bench-asr（分布 N=8）で証した。この分担で機械ゲート 4 を満たすという解釈でよいか。
3. **「メッシュ先生」問題（品質の限界の記録）**: 長文 TTS で「メッシュ生成→メッシュ先生」の聞き違いが**全窓でも**発生（= kotoba モデル起因・チューニング無関係）。S2 のゴールには影響しないが、S3 が転写を文脈にする際の品質前提として承知しておいてほしい。
