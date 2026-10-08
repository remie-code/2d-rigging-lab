# S2 Domain C レビュー: 常時稼働の結線 + CLI 診断 + 計測 + docs

> Reviewer: Review-Sylph（3レーン: spec / design / test）。2026-07-12。
> 対象実装: `apps/soul/agent/` 新規 8 ファイル（src/{pcm-ring-buffer,ear-pipeline,whisper-inference,ears-cli}.mjs + 4 テスト + src/silero-vad.test.mjs + scripts/{preflight-vad,preflight-ears,bench-asr}.mjs）+ 変更 5 件（src/silero-vad.mjs 3 差分・src/whisper-server.test.mjs +1 テスト・src/transcript-buffer.mjs JSDoc・apps/soul/README.md 追記・s2-followup.md §4）+ experiments/s2-ears.md + human-gate-procedure.md。
> Gnome 実装報告: [../../waves/s2/domain-c.md](../../waves/s2/domain-c.md)。
> 判定基準: wave 計画 [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §1/§3 Domain C（設計注記全部）/§4/§6 ・ 前工程 [domain-a-review.md](domain-a-review.md)（note 1/7）・[domain-b-review.md](domain-b-review.md)（notes 1〜4）・ [../../waves/s2/s2-followup.md](../../waves/s2/s2-followup.md) ・ S1 流儀 `cli.mjs`/`cli.test.mjs`。
> 特別確認事項: **silero-vad.mjs への許可超過 2 修正（Undine 事後承認済み・2026-07-12）を design/test レーンで独立検証すること**（Undine 裁定「事後承認は無条件受理ではない」）。

## 総合判定: **PASS-with-notes**

3 レーンすべて合格。**blocking 指摘ゼロ**。特別確認事項 2 件は**いずれも独立検証で妥当性を裏取りできた**（下記専用セクション）。non-blocking の注記が数点（watchdog が下層 transcribe をキャンセルしない・per-frame レイテンシ記録の方向差・ffmpeg 再起動を跨ぐ発話の接合——いずれも実害僅少で S3/followup で回収可能）。

機械検証はすべて独立再実行: 196/196 緑・3 チェック無退行・保護対象不変・preflight-vad / preflight-ears 実機 PASS（レイテンシは Gnome/Orch と同帯域）・孤児プロセスなし・フレーク抜き取り全緑。

| レーン | 判定 |
| --- | --- |
| spec（契約整合） | **PASS** |
| design（設計・境界） | **PASS-with-notes** |
| test（fixture 十分性） | **PASS-with-notes** |

---

## 特別確認事項の検証（silero-vad.mjs 許可超過 2 修正）

wave 委任の明示許可は note 7（NaN→明示 throw）のみ。Gnome は (1) v5 入力文脈 64 サンプル前置 (2) セッション既定 `intraOpNumThreads: 1` を追加実施し事後承認を求め、Undine が事後承認した。レビューは両修正を鵜呑みにせず独立検証した。

### 修正 1: v5 入力文脈 64 サンプル前置（576 入力）— **妥当・機能必然性を独立再現**

- **(a) コード読解**: silero-vad.mjs:85-87（contextSamples 既定 = 16kHz 64 / 8kHz 32・オプション上書き可）・:100-101（文脈変数）・:134-137（入力 = [文脈 | フレーム] の 576 構築）・:144-147（run 後に今フレーム末尾 64 を次文脈へ持ち回り）・:166-168（reset() で state と context を 0 化）。**実装は正しい**。ear-pipeline.mjs:336 は ffmpeg exit 時に `vad.reset()` を呼び、再帰状態と文脈を同時に仕切り直す（ストリーム境界で文脈が汚れない）。
- **(b) Web 一次情報照合（silero-vad 公式リポジトリ `src/silero_vad/utils_vad.py` OnnxWrapper）**: `context_size = 64 if sr == 16000 else 32` / `num_samples = 512 if sr == 16000 else 256` / 入力 = `torch.cat([self._context, x], dim=1)`（= batch × (64+512)=576）/ 推論後 `self._context = x[..., -context_size:]` / reset で文脈初期化。**Gnome の実装は公式 OnnxWrapper と 1:1 で一致**（既定値・前置位置・持ち回り更新・reset 挙動すべて）。
- **(c) 機能必然性の独立再現（出荷実装 `createSileroVad` を `contextSamples` 上書きで比較・使い捨てプローブ・TTS 音声のみ）**:

```
ctx=0  (512入力): n=82 max=0.1473 frames>=0.5: 0/82
ctx=64 (576入力): n=82 max=0.9999 frames>=0.5: 57/82
```

  512 単独では実音声で**閾値 0.5 を一度も超えない**（= 耳は機能不全）ことを再現。Gnome 実測（max 0.096 → 1.0）と同結論（max の絶対値差は TTS 合成の回ごとの揺れ）。**この修正なしで S2 人間ゲートは成立しない、という主張は正しい**。
- **(d) テスト固定**: silero-vad.test.mjs の fake ortImpl テストで 576 契約（dims [1,576]・初回文脈全ゼロ・後続 512 がフレーム本体）・文脈持ち回り（2 フレーム目の先頭 64 = 1 フレーム目の末尾 64）・reset 後の文脈全ゼロを固定（:72-113）。**十分**。
- **(e) 副作用（フレーム順序）**: 文脈の意味はフレームの隣接連続性に依存するが、ear-pipeline は VAD 推論を到着順 promise チェーンで直列化（ear-pipeline.mjs:314-327）し、framer は順序どおりのフレーム列を返すため、順序が乱れる経路は構造上ない。ffmpeg 再起動境界は reset で切る。→ note 6（並行呼び出し禁止の暗黙契約）参照。

### 修正 2: セッション既定 `intraOpNumThreads: 1` — **妥当・CPU 空費を独立再現**

- **(a) 上書き可能性**: `options.sessionOptions ?? { intraOpNumThreads: 1 }`（silero-vad.mjs:91）で丸ごと上書き可。テスト固定済み（silero-vad.test.mjs:115-124: 既定 {intraOpNumThreads:1} と上書き {intraOpNumThreads:4} の両方向）。
- **(b) 独立計測（使い捨てプローブ・実時間レート 31.25f/s 近似で 8s・合成無音のみ）**:

```
既定(intraOpNumThreads:1): frames=250 wall=8012ms cpu=93ms (1.2%/core) per-frame=0.642ms
ort素の既定(sessionOptions:{})  : frames=250 wall=8010ms cpu=31687ms (395.6%/core) per-frame=0.605ms
```

  onnxruntime 素の既定はアイドルで **≈396%/コア** を空費（Gnome 実測 358% と同オーダー）、1 スレッドで **≈1.2%/コア**（Gnome 1.8% と同帯域）。**修正の必然性（配信で器の二体と並走する魂として容認不能）は正しい**。
- **(c) per-frame の整合性（正直な記録）**: 私の計測では per-frame は 1 スレッドの方が**わずかに遅い**（0.642 vs 0.605ms）。Gnome の「0.20→0.18ms・悪化なし」とは絶対値も方向も一致しない（計測方法差: 私のは await/タイマ jitter 込み）。ただし差は 0.04ms で実時間予算 32ms の 0.1% 相当——**実質的な結論（劣化は無意味な水準）は変わらない**。non-blocking note 2 として記録。

### 3 差分の独立 revert 可能性 — **確認**

- 差分 (1) note 7 throw = silero-vad.mjs:148-159 / (2) 文脈 = :52-53,:62,:85-87,:100-101,:134-137,:144-147,:166-168 / (3) スレッド = :66-70,:91。**コード上の重なりなし**。`contextSamples`/`SILERO_V5_CONTEXT_SAMPLES_16K` を参照するモジュールは silero-vad.mjs のみ（grep 確認）で、ear-pipeline は process()/reset() の公開契約しか使わない。各差分の revert は対応テスト（test 2/3/4/7）の削除を伴うのみで互いに独立。

**結論: 事後承認の受理を支持する。** 両修正とも (i) S2 ゴールに対する必然性が実測で立ち、(ii) 最小変更で、(iii) テスト固定・上書き点・記録が揃い、(iv) 独立 revert 可能。

---

## 検証（自分で実行した生出力）

### 1. `cd apps/soul/agent && timeout 240 node --test`

```
1..196
# tests 196
# pass 196
# fail 0
# cancelled 0
# skipped 0
TEST_EXIT=0
```

196/196 緑・1 秒未満で正常終了（ハングなし）。per-file 実数（各ファイル単独実行の `^ok ` 計数）:

```
silero-vad: 9 / pcm-ring-buffer: 8 / ear-pipeline: 10 / whisper-inference: 3 / ears-cli: 5 / whisper-server: 11
```

新規 35 + whisper-server +1（10→11）= 36。196 − 36 = **160 = Domain B baseline 無退行**（S1 84 + A 45 + B 31）。**Gnome 報告の内訳と完全一致**。S1 tracked ソースは `git diff --name-only apps/soul/agent/src/` 空 = 不変。

### 2. モノレポ 3 チェック（リポジトリルート・timeout 120s・実 exit code）

```
Soul zone boundary guard passed: 1304 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soulzone EXIT=0
Dependency guard passed.
deps EXIT=0
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source EXIT=1
```

source の赤 1 件は既知 baseline（器側・S1 followup §7）のみ = 無退行。soul-zone 1304 = Domain B 時 1292 + 新規 12（src 9 + scripts 3）で整合。

### 3. 保護対象・非コミット・録音物

```
$ git diff --stat pnpm-lock.yaml apps/runtime-player/src/main/control-channel/contract/
（空 = 不変）
$ git status --porcelain | grep -iE '\.(wav|pcm|raw|mp3|ogg)'
（空）AUDIO_GREP_EXIT=1 = 音声ファイルの新規生成物なし
$ git status --porcelain apps/soul/agent/vendor
（空 = ignore 済み）
$ grep -rn "node:fs|writeFile|createWriteStream" apps/soul/agent/scripts/*.mjs
（空）= 全 preflight/bench はディスク不書き出し（音声はメモリ上のみ）
```

- `git diff apps/soul/README.md` は S2 節の**追記のみ**（+20 行・既存行の変更なし）。
- `git diff apps/soul/agent/package.json` は Domain A 時点の onnxruntime-node 1 行のみ = **本 domain の依存追加ゼロ**。

### 4. preflight-vad 独立再実行（timeout 300・実 ONNX + TTS）

```
[preflight-vad] io: inputs=["input","state","sr"] outputs=["output","stateN"]
[preflight-vad] io match (v5 expectation input/state/sr -> output/stateN): OK
[preflight-vad] prob(silence 512ms): n=16 max=0.0089 mean=0.0055
[preflight-vad] prob(sine 440Hz 512ms): n=16 max=0.0024 mean=0.0004
[preflight-vad] probabilities finite & in [0,1]: OK
[preflight-vad] prob(tts "こんにちは、耳のテストです" 2.56s): n=79 max=1.0000 mean=0.7022 frames>=0.5: 56/79
[preflight-vad] RESULT: PASS (io names match; probabilities sane; dispose clean)
PREFLIGHT_VAD_EXIT=0
```

### 5. preflight-ears 独立再実行（timeout 300・実 VAD + 実 whisper 縦貫通・採用既定）

```
[preflight-ears] stream: 7.60s (utt1 2.61s / utt2 2.68s)
[preflight-ears] pipeline started in 542ms (VAD init + whisper ready)
[preflight-ears] transcript[0] 0.67..2.97s latency=1465ms audio_ctx=256  "こんにちは耳のテストです"
[preflight-ears] transcript[1] 4.19..6.59s latency=1498ms audio_ctx=256  "今日はメッシュ先生の続きをやります"
[preflight-ears] RESULT: PASS (2 utterances transcribed via real VAD + real whisper; stats={"frames":237,"speechStarts":2,"speechEnds":2,"speechCancels":0,"asrDone":2,"asrFailed":0,"asrDropped":0,"asrSkipped":0,"vadErrors":0,"asrQueue":0,"asrDown":false,"buffer":{"appended":2,"discarded":0}})
PREFLIGHT_EARS_EXIT=0
$ tasklist | grep -iE "whisper|ffmpeg"
（空）ORPHAN_GREP_EXIT=1 (1 = no orphan)
```

- レイテンシ **1465/1498ms** = Gnome 報告 1475/1511ms・Orch 再実行 1474/1536ms と**同帯域**。
- **「メッシュ生成→メッシュ先生」の聞き違いを私の再実行でも再現**（followup §4-6 / domain-c.md §9-Q3 のモデル起因主張と整合。3 実行者×独立実行で全て再現 = チューニング無関係の再現性が高い）。

### 6. フレーク抜き取り

```
ear-pipeline.test.mjs 単独 ×5: pass 10 / fail 0 / cancelled 0（5/5）
silero-vad + ears-cli + whisper-server ×5: pass 25 / fail 0 / cancelled 0 / skipped 0（5/5）
```

---

## spec レーン（契約整合）: PASS

wave 計画 §3 Domain C の全要求と突合:

| 要求 | 判定 | 根拠 |
| --- | --- | --- |
| 耳パイプライン常駐の結線 | 合格 | ear-pipeline.mjs（ffmpeg→framer→VAD→segmenter→リング→WAV→ASR→バッファ）。Domain A/B 部品は 1 行も変えず結線のみ（S1 tracked diff 空 + baseline 160 無退行） |
| CLI 表示（積もる転写 + VAD イベント可視化） | 合格 | ears-cli.mjs: stdout に [vad]/[text]/[diag]・stderr に 1 行 JSON 計測（S1 cli.mjs の型と一致を確認: 依存注入・stderr JSON・SIGINT/EOF 全 dispose） |
| クリーンシャットダウン | 合格 | dispose() 一発・冪等・capture→キュー→VAD→server の順（design レーン）。テスト実行 1 秒未満正常終了 + preflight 後の孤児ゼロが傍証 |
| 有界チューニング 3 系統 + 打ち切り基準 | 合格 | (a) audio_ctx 動的（採用・品質境界表付き） (b) threads 4/6/8（中間値 1 点 = 裁定範囲内） (c) -nf/-bo 1（効果なし・不採用）。**採用構成 warm 1.5〜1.8s ≤ 基準 2〜3s で打ち切り到達**（experiments §2.4・分布 N=8 spread 81ms 外れ値なし）。組み合わせ発散なし |
| threads 常駐既定 =「最速に近い最小」 | 合格 | 6T = 8T 比 +9〜11%・4T は +26%（experiments §2.2）。裁定基準どおり計測上の最速(8T)でなく最小側に倒している |
| audio_ctx 動的式 | 合格 | `clamp(ceil(秒×50)+96, 256, 1500)`。margin 0 の反復・下限未満の劣化・全窓一致の境界が実測表で立つ（experiments §2.1）。/inference のリクエスト単位 `audio_ctx` 受理も実機照合済み（私の preflight-ears 再実行の audio_ctx=256 で経路実証） |
| 計測 → experiments/s2-ears.md | 合格 | レイテンシ（分布込み）・CPU 負荷（推論バースト/アイドル）・外れ値頻度・実マイク未計測の明示（§5）・-t が総 CPU を律しない正直な注記（§4） |
| docs + followup | 合格 | README 追記のみ・human-gate-procedure.md・followup §4 追記 |

**設計注記 6 点の回収状況**:

| 注記 | 回収 | 根拠 |
| --- | --- | --- |
| (1) リング切り出しの [0, 実データ末尾] clamp（A note 1） | **回収** | pcm-ring-buffer.mjs:95-105（保持窓先頭も clamp = 容量超過破棄にも安全・実切り出し範囲を返す）。テストで flush pad 超過・破棄済み範囲・負値・全欠落・一括容量超過を固定 |
| (2) whisper-server 監視 2 経路（B note 2） | **回収** | 経路 1 = start() 内 ready reject → 開いた分を畳んで throw・マイク不開（ear-pipeline.mjs:360-396 + テスト「起動失敗」:278-319）。経路 2 = ready 後 onExit → asrDown + キュー診断付き破棄（:339-349 + テスト「runtime 死」:259-276） |
| (3) onExit 正経路テスト（B note 3） | **回収** | whisper-server.test.mjs:235-265（ready 後に fake child を直接 kill → onExit 発火・hasExited true・isDisposed false まで assert） |
| (4) listener 例外契約の線引き + 固定テスト（B note 4） | **回収** | transcript-buffer.mjs JSDoc に「listener は throw しない契約」を明文化（コード不変 = listener ループに try/catch なしを読解確認）。結線層は自前 listener 先行登録 + append の try/catch で診断吸収（ear-pipeline.mjs:176-179,:280-293）。固定テスト 1 本（外部 throw 後も正本・onTranscript・次発話が生きる: ear-pipeline.test.mjs:321-341） |
| (5) 1 発話の外側見張り（B note 1） | **回収** | utteranceTimeoutMs 45s の watchdog（Promise.race・finally clear・unref しない: ear-pipeline.mjs:246-269）+ whisper-inference.mjs は本文読み取りまでタイマ内側（clear が try 全体の finally にのみ: :136-140・本文ハングのテスト固定: whisper-inference.test.mjs:77-92）→ 二重有界。ただし note 1（watchdog は下層をキャンセルしない） |
| (6) preflight-vad 資材化 + VAD ラッパ到達テスト（A 続行残） | **回収** | scripts/preflight-vad.mjs（I/O 照合 + 無音/正弦波/TTS・私の独立再実行 PASS）+ silero-vad.test.mjs 9 本（fake ortImpl 8 + 実モデル到達 1。実モデル到達は timeout 60s + モデル未配置なら skip = 有界かつ環境非依存） |

**常駐既定の裁定整合**: maxSpeechMs 20000 は報告の裁定範囲（15000〜30000）内・**セグメンタ純関数既定 Infinity は不変更**（speech-segmenter.mjs:39 読解 + grep 確認・結線層 EAR_DEFAULTS で与える構造）。minSilenceMs 400 は裁定外だが、(i) 純関数既定 100ms は不変、(ii) maxSpeech と同種の結線層設定という整理は筋が通る、(iii) CLI `--min-silence-ms` で上書き可 + 手順書 §5 で調整第一候補と明記——**妥当と評価**（Undine 事後承認済みの扱いに異論なし）。

**S2 ゲート（§1）への到達可能性**: 機械ゲートは成立（純関数 fixture 全緑 + S1 無退行 + 3 チェック無退行 + lockfile 不変 = 本レビューで全て独立確認）。人間ゲート手順書は「普通に喋る→[text] が数秒以内に積もる」を合格判定 §4 として一目化し、事前疎通（マイク不要）・デバイス列挙・追撃ノブ・トラブルシュート表・OBS 同時起動確認（wave 計画 §5-2）まで備える。**preflight-ears が「実マイク以外の全部品」を実証済みなので、人間ゲートの残余リスクはマイク取り込みと実環境音のみに絞られている**——手順書 §0 の整理どおりで妥当。

**blocking 基準 §4 の突合**:

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| (1) pnpm-lock/器/契約/S1 実装不変・無退行 | 合格 | 検証 1・3（diff 空・196 = 160 + 36・S1 tracked diff 空） |
| (2) 3 チェック無退行 + 非コミット | 合格 | 検証 2・3（source の赤は既知 baseline のみ・vendor porcelain 空） |
| (3) 純関数 + fixture テスト | 合格 | computeAudioCtx / normalizeDevice / parseEarsArgs / buildPipelineOptions 純関数 + リングバッファは依存ゼロ純ロジック、全てテスト付き |
| (4) 録音データ非残置 | 合格 | 検証 3（音声ファイル生成物ゼロ・scripts に node:fs ゼロ・preflight/bench/プローブ全て TTS or 合成のメモリ上のみ。本レビューも実マイク不使用） |
| (5) 子プロセス終了処理の明示設計 | 合格 | dispose 順序の明示 + テスト固定 + 私の preflight 2 種再実行後の孤児ゼロ |

---

## design レーン（設計・境界）: PASS-with-notes

- **ストリーム時計**: リング書き込み総サンプル数が唯一の時計で、フレーム tMs（書き込み前の末尾 = フレーム開始時刻: ear-pipeline.mjs:310）も speechEnd 範囲も同一由来。壁時計はレイテンシ計測のみ。**ズレが構造的に存在しない設計は正しい**。
- **リング clamp**: [保持窓先頭, 実データ末尾] の両側 clamp + `clamped` フラグ + 実切り出し範囲返し。バッファに積まれる startMs/endMs は clamp 後の実在範囲（handleSpeechEnd が cut.startMs/endMs を使う: :208-215）——時刻の意味論が一貫。**合格**。
- **ASR 直列キュー（上限 4・最古破棄）**: whisper-server が単一スレッドプールである事実に立脚した直列化は正しい。「会話追従優先 = 最古を捨てる」は S3 の消費形（新しい発話が要る）と整合し、破棄は診断 + カウンタで失われない。上限 4 の余裕度も採用レイテンシ（1.5〜1.8s ≪ 分割間隔 20s）に対し十分。**合格**。
- **死亡時方針（再起動なし・VAD 継続）**: ASR サーバの死の systemic 性・512MB ロードの配信中反復回避・S6 barge-in 土台（VAD イベント）の生存維持、の 3 論拠はいずれも筋が通る。CLI の whisperDown 表示 + 手順書のトラブルシュート表で人間の再起動へ委ねる導線も閉じている。followup §4-2 に自動復旧の再開条件を記録済み。**合格**。
- **watchdog（45s・unref しない・finally clear）**: S2 §6.1 の教訓（待機中は ref + 有界決着）に忠実。既定配線では内側 timeout（whisper-inference 30s）< 外側 45s のため、外側は「内側が壊れた場合」の保険として層になっている。→ ただし note 1（race はキャンセルでない）。
- **listener 例外吸収の登録順依存**: 「パイプライン自前 listener を construction 時に最初に登録 → 外部購読者は必ず後」という前提は、JS の Set 挿入順イテレーション（言語仕様保証）+ createEarPipeline が返るまで外部は購読できない構造、の 2 点で成立している。危うさは「暗黙の順序依存」だが、コード内コメント（:176-177）と transcript-buffer JSDoc の双方に明文があり、固定テストもある。**許容**（S3 実装者が transcript-buffer JSDoc を読めば足りる）。
- **whisper-inference.mjs の新設判断**: whisper-client（Domain B 成果・変更禁止）に注入点がない以上、新規モジュールは制約下の正解。パース純関数（parseInferenceResponse/normalizeTranscript）は import 共有で重複なし、タイムアウト規律は同一かつ note 1 を構造で改善（clear が try 全体の finally にのみ = 本文読み取りもタイマ内側であることを実コードで確認: :111-140）。統合先送りは followup §4-1 に記録済み。**合格**。
- **ears-cli**: 既存 cli.mjs 不変（tracked diff 空）。S1 の型（依存注入 runEars・stderr 1 行 JSON・SIGINT/EOF 全 dispose・純関数切り出し parseEarsArgs/buildPipelineOptions/normalizeDevice）に忠実であることを cli.mjs と突合確認。--list-devices は列挙のみで録音しない。**合格**。
- **境界**: 新規 .mjs/scripts の import は node:* + 自 zone 相対のみ（読解 + soul-zone 1304 files 緑）。新規 npm 依存ゼロ（package.json diff は Domain A の 1 行のみ）。魂 zone 外書き込みゼロ（scripts は fs 不使用）。host 127.0.0.1 既定。**合格**。
- **ffmpeg 再起動の仕切り直し**: framer.reset()（半端バイト）+ vad.reset()（再帰状態 + 文脈）は正しい。→ ただし note 3（セグメンタ状態は残る）。

---

## test レーン（fixture 十分性）: PASS-with-notes

新規 36 テストを全読し、主張された境界と突合:

- **pcm-ring-buffer (8)**: clamp 4 方向（末尾超過 = note 1 の契約そのもの・破棄済み範囲・負値・全欠落の空退化）・一括容量超過・チャンク境界非依存・コピー非共有・入力検査/reset。fixture は「値 = 絶対サンプル位置」の決定論列で、**どの範囲が返ったかをサンプル値で検算できる**設計が良い。**十分**。
- **ear-pipeline (10)**: 全部品注入（fake capture/VAD/server/transcribe）で実機ゼロ。縦貫通（WAV 尺・audioCtx 256・startMs/endMs 検算・レイテンシ meta）・maxSpeech 分割（2×pad 重なりの実確認）・ASR 失敗継続・**外側見張り**（永遠 pending の transcribe → watchdog 診断 → 次発話生還）・**直列キュー帳尻**（実行中 1 + キュー 2 + 溢れ 3 をゲート制御で決定論固定・同時実行 1 の直列性）・**2 経路監視の両方**（runtime 死 → skip + VAD 生存 / ready reject → 畳んで throw + **マイク不開**）・**listener throw 契約**・dispose 冪等 + 以後 PCM 無視・常駐既定の部品伝搬。`until()` が全て有界（3s）+ dispose が finally = **テスト自身がハング安全**。**十分**。
- **whisper-inference (3)**: 式の境界（下限/上限/式値/オプション上書き/throw）・multipart の中身（audio_ctx 有/無・file バイト列 deep-equal）・**本文ハングのタイムアウト**（ヘッダ 200 + json() 永遠 pending → abort reason で有界 reject = note 1 構造回収の直接固定）。**十分**。
- **ears-cli (5)**: fake pipeline 注入で stdout 書式・stderr JSON スキーマ（deepEqual）・EOF/abort の 2 終了経路 + dispose・start 失敗伝播・normalizeDevice 境界・引数パース→オプション組み立て（既定は EAR_DEFAULTS に任せ上書きしない、まで assert）。**十分**。
- **silero-vad (9)**: 特別確認事項セクション参照。**実 exe/実マイクはどのテストからも起動されない**。実 onnx 使用は実モデル到達テスト 1 本のみ（許可どおり）で timeout 60s + 未配置 skip = 有界。
- **whisper-server (+1)**: onExit 正経路（fake child 直接 kill）。withTimeout 包み。**十分**。
- **フレーク**: 検証 6（×5 全緑）で Gnome の安定性主張（全 ×3 + 単独 ×5）と整合。

---

## 指摘一覧

### blocking

なし。

### non-blocking（notes）

1. **[design] 外側 watchdog は下層の transcribe をキャンセルしない（Promise.race のみ）** — watchdog 発火後も transcribeAndAppend は背後で走り続け、遅延解決すれば正本へ append される（asrFailure 診断済みの発話が後から積まれ、seq と startMs の順序が食い違い得る）。既定配線では内側 timeout 30s < 外側 45s のため外側はまず発火せず実害は狭いが、S3 結線か whisper-client 統合（followup §4-1）の際に「失敗確定後のジョブは append しない」ガード（ジョブ世代トークン等)を足すのが堅い。根拠: ear-pipeline.mjs:246-269,:271-303。
2. **[記録] per-frame レイテンシの方向差** — Gnome 報告「intraOpNumThreads:1 で 0.20→0.18ms（悪化なし）」に対し、私の独立計測は 0.605→0.642ms と**わずかに悪化方向**（計測方法差あり）。差は 0.04ms = 実時間予算 32ms の 0.1% で結論（劣化は無意味な水準）は不変だが、「悪化しない」は「悪化が無意味な水準」と読むのが正確。
3. **[design] ffmpeg 再起動でセグメンタ状態をリセットしない** — 再起動を跨いで triggered 中だった発話は、ストリーム時計に空隙がない（死んでいた間は書き込みゼロ）ため、再起動前後の音声が 1 発話に接合され得る。VAD 文脈/状態は reset されるので確率は健全で、実害は「境界の 1 発話の切れ目が不自然」程度。記録のみ（気になるなら handleCaptureExit で segmenter 相当の仕切り直しを検討）。根拠: ear-pipeline.mjs:331-337。
4. **[test] makeHarness の spread 順** — `segmenter: {テスト用既定...}` の後に `...pipelineOptions` が来るため、pipelineOptions.segmenter を渡すとテスト用既定（minSpeechMs 100 等）が丸ごと置換される。現テストは全キー指定で回避しており実害なし。将来の書き手への罠として記録。根拠: ear-pipeline.test.mjs:85-91。
5. **[記録] followup §4 の項目数表記揺れ** — domain-c.md §1/§9 は「新規持ち越し 5 件」だが followup §4 は 6 項目（§4-6 は Undine 裁定の品質前提を Orch 側で追記した模様）。実装の問題ではない。整理は Orch 裁量。
6. **[design] silero-vad.process() の並行呼び出し禁止が暗黙契約** — 再帰状態に加え文脈持ち回りが増えたため、並行呼び出し時の壊れ方が広がった。ear-pipeline は直列化済み・preflight も直列で実害なしだが、silero-vad.mjs の JSDoc に「process は直列に呼ぶこと」の 1 行があると堅い。whisper-client 統合等のついでで可。

---

## S3 への引き継ぎの妥当性評価（domain-c.md §9）

| 引き継ぎ | 評価 |
| --- | --- |
| 消費の入口 = transcriptBuffer.onAppend + onVadEvent・listener は throw しない契約 | **妥当**。契約は JSDoc + 固定テストで立っており、違反時も正本と常駐が壊れないことをテストで確認済み |
| レイテンシ予算 ≈1.5〜2s（+minSilence 400ms） | **妥当・独立再現済み**（検証 5: 1465/1498ms）。experiments §3.2 の「体感 ≈1.9s」の注記は S3 発火判定の設計材料として正確 |
| followup §4 の持ち越し（whisper-inference 統合・再起動・-t と CPU・maxSpeech reason 伝搬・VAD 直接購読・転写品質前提） | **妥当**。特に §4-6（転写は完璧でない）は 3 実行者の独立実行で全て再現しており、S3 の設計前提として信頼できる。§4-3（-t は総 CPU を律しない）は人間ゲートの OBS 同時起動で観察すべき点として正しく残されている |
| 本レビュー note 1（watchdog 非キャンセル）を S3 結線 or 統合時の回収候補に追加推奨 | 上記 |

---

## Orch-Sylph への質問

1. **silero-vad.mjs 許可超過 2 修正の事後承認（Gnome Q1）**: 本レビューは両修正を独立検証し（機能必然性・公式仕様一致・CPU 空費・上書き可能性・テスト固定・revert 独立性）、**受理を支持する**。Undine 事後承認 + 本検証で確定でよいか。
2. **preflight-asr の分担解釈（Gnome Q2）**: preflight-asr（Domain B 成果・変更禁止・素の全窓経路）+ preflight-ears（採用既定の縦貫通）+ bench-asr（分布）の分担は、「配線 ≠ 疎通」の実証として**妥当と評価する**（採用経路の実機 PASS は私の再実行でも成立）。この解釈の確定は Orch 裁量でよいか。
3. **note 1（watchdog 非キャンセル）の回収先**: followup §4-1（whisper-client 統合）と同時に閉じるのが素直と考えるが、S3 側の設計注記として明示引き継ぎするか Orch の裁量を仰ぐ。

---

## 結論

Domain C（常時稼働の結線 + CLI 診断 + 計測 + docs）は wave 計画 §3 Domain C の全要求・設計注記 6 点・§4 blocking 基準 5 項をすべて満たす。**blocking 指摘ゼロ**。特別確認事項の許可超過 2 修正は、公式一次情報（silero-vad OnnxWrapper）との仕様一致・出荷実装での機能必然性の独立再現（512 入力では閾値超えゼロ / 396%→1.2%/コア）・テスト固定・revert 独立性まで裏取りでき、**事後承認の受理を支持する**。196/196 緑（独立実行）・3 チェック無退行・保護対象不変・preflight 2 種独立 PASS（レイテンシ同帯域・孤児ゼロ）・チューニング打ち切り基準到達（warm 1.5〜1.8s ≤ 2〜3s）。**機械ゲートは閉じた。残るは人間ゲート（実マイク・ユーザーの領分）のみ**。
