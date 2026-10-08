# S2 Domain A レビュー: 取り込み + VAD + 発話セグメンタ

> Reviewer: Review-Sylph（3レーン: spec / design / test）。2026-07-12。
> 対象実装: `apps/soul/agent/`（.gitignore + src/{wav-encode,pcm-framing,speech-segmenter,fixtures-audio,ffmpeg-capture,silero-vad}.mjs + 4 テスト + test-support/fake-ffmpeg.mjs + package.json 依存 1 行）。
> Gnome 実装報告: [../../waves/s2/domain-a.md](../../waves/s2/domain-a.md)。
> 判定基準: wave 計画 [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §3 Domain A・§4 blocking 基準 ・ 事実台帳 [../../orchestration/s2-planning-inventory.md](../../orchestration/s2-planning-inventory.md) §1/§3/§5 ・ S1 先例 `audio-player.mjs`（終了処理の型）/ `wav-duration.mjs`（逆写像の相手）/ s1-followup §8（ハング教訓）。

## 総合判定: **PASS-with-notes**

3 レーンすべて合格。**blocking 指摘ゼロ**。non-blocking の注記が数点（Domain B/C 結線時の clamp 注意・報告書の内訳数字の軽微な不一致・テスト補強候補）。

さらに重要な事実として、**レビュー時点で環境が Gnome 報告より進んでいた**: `npm install` 実施済み（`node_modules/onnxruntime-node` 存在・package-lock.json 更新）+ `vendor/models/silero_vad.onnx` 配置済み。これは choke point のユーザー作業が完了した状態と解される（要 Orch 確認）。この状態を利用し、**未検証の仮定だった Silero ONNX I/O 名を実モデルで照合し、一致を確認した**（下記検証 6）。

| レーン | 判定 |
| --- | --- |
| spec（契約整合） | **PASS** |
| design（設計・境界） | **PASS** |
| test（fixture 十分性） | **PASS-with-notes** |

---

## 検証（自分で実行した生出力）

### 1. `cd apps/soul/agent && timeout 180 node --test`

```
1..129
# tests 129
# suites 0
# pass 129
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 892.785
```

129/129 緑・ハングなし（1 秒未満で正常終了）。**install 済み環境での結果**（Gnome は未 install 環境で同数を報告。install の前後どちらでも緑 = 続行フェーズ前提 (1)「install 後の無退行」も同時に満たされた）。

新規テストの per-file 実数（各ファイル単独実行で `^ok ` 行を計数）:

```
wav-encode: 11
pcm-framing: 13
speech-segmenter: 14
ffmpeg-capture: 7
```

新規合計 45。129 − 45 = 84 = S1 baseline（S1 既存 .mjs は `git diff --name-only apps/soul/agent/src/` が空 = 1 行も変更なし）。※ Gnome 報告 §1/§5.1 の per-file 内訳（pcm-framing 14 / speech-segmenter 15）は実数と 1 ずつずれている（合計 45 と総数 129 は正しい）。non-blocking の記録訂正。

### 2. モノレポ 3 チェック（リポジトリルート・各 timeout 120s）

```
Soul zone boundary guard passed: 1285 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soul-zone EXIT=0
Dependency guard passed.
deps EXIT=0
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source EXIT=1
```

source の赤 1 件は既知 baseline（S1 followup §7・器側・S2 無関係）。**魂由来の新規赤ゼロ = 無退行**。soul-zone 1285 files は S1 レビュー時 1254 + S2 新規 11 .mjs + （S1 閉鎖後に増えた器側ファイル）で整合。**install 済み環境で 3 チェック緑** = planning-inventory §5 の予測どおり onnxruntime-node は禁止依存に非該当。

### 3. 保護対象 diff

```
$ git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json apps/runtime-player/src/main/control-channel/contract/
 apps/soul/agent/package-lock.json | 190 +++++++++++++++++++++++++++++++++++++-
 1 file changed, 186 insertions(+), 4 deletions(-)
```

- **pnpm-lock.yaml: 変更なし**（stat に現れない）。**C4 契約 fixture: 変更なし**。→ wave 計画 §4-1 の保護対象は不変。
- **apps/soul/agent/package-lock.json: +186/−4**。diff 内容は `onnxruntime-node@1.27.0` + 推移依存（onnxruntime-common / adm-zip / semver / tar 系等）の追加のみ。`node_modules/onnxruntime-node` がディスクに存在することも確認 = **`npm install` が実施済み**。これは Gnome 報告（「npm install していないので package-lock.json は変わらない」）の**後に choke point のユーザー作業が実行された**と解するのが自然（wave 計画 §5-1 の予定行動そのもの）。魂 zone の package-lock.json は §4-1 の明示保護対象（pnpm-lock.yaml・器コード・契約 fixture・S1 実装）ではなく、install の自然な帰結。→ **blocking ではない**が、実施主体の確認を Orch へ質問として残す（下記質問 1）。

### 4. vendor 非コミット

```
$ git status --porcelain apps/soul/agent/vendor
（空 = ignore 済み）
```

vendor/ には whisper 一式 + `ggml-kotoba-whisper-v2.0-q5_0.bin` + **`silero_vad.onnx`（配置済み）** が実在するが、porcelain 空 = すべて .gitignore で非コミット。§4-2 合格。

### 5. package.json diff（宣言 1 行のみか）

```
   "dependencies": {
-    "@anthropic-ai/claude-agent-sdk": "0.3.207"
+    "@anthropic-ai/claude-agent-sdk": "0.3.207",
+    "onnxruntime-node": "1.27.0"
   }
```

宣言 1 行の追加のみ。合格。

### 6. Silero VAD 実モデル照合（レビュー独自プローブ・合成データのみ）

install + モデル配置が完了していたため、scratchpad の使い捨てスクリプト（実装ファイル不変更・実マイク不使用・全ゼロ 512 サンプル + 220Hz 正弦波 512 サンプルのみ）で `createSileroVad` を実際に init→process→dispose した:

```
inputNames : ["input","state","sr"]
outputNames: ["output","stateN"]
prob(silence): 0.0005922019481658936
prob(sine)   : 0.0005965232849121094
finite&range : true true
```

- **I/O 名の仮定（silero-vad.mjs §契約コメント）は実モデルと完全一致**: 入力 `input`/`state`/`sr`、出力 `output`/`stateN`。
- `sr` の int64 スカラ（dims=[]）も実セッションで受理された。`process()` は有限の確率 [0,1] を返す（無音 ≈0.0006、非音声の純音も低確率 = もっともらしい挙動）。
- 動的 import（未 install 防御）も実経路で機能: ラッパの `init()` 内 import が agent 配下の node_modules を正しく解決。
- `dispose()` 後にプロセスは即終了（ハングなし）。
- → Gnome の続行フェーズ計画 (2)「preflight-vad で I/O 名照合」は、**本レビューのプローブで実質的に前倒し達成**。ただし再現可能な資材としての preflight-vad スクリプト自体は未作成（Domain B/C 側で回収推奨。下記質問 2）。

### 7. silero-vad.mjs のテスト非到達（推移含む）

`grep -rn "silero-vad|onnxruntime" apps/soul/agent/src/` の結果、`silero-vad.mjs` を import する文は**ゼロ**（言及はコメントのみ。onnxruntime の import は silero-vad.mjs 内の動的 import 1 箇所のみ）。4 テストファイルの import は {wav-encode, wav-duration, fixtures-audio, pcm-framing, speech-segmenter, ffmpeg-capture}.mjs と node:* のみで、これらのモジュールは互いに silero-vad.mjs を import しない。**テストから推移的にも非到達**を確認。

---

## spec レーン（契約整合）: PASS

wave 計画 §3 Domain A の 7 要求すべて充足:

1. **ffmpeg 子プロセス管理**: `createFfmpegCapture`。dshow/デバイスは `inputFormat`/`device` オプションで設定可能（ffmpeg-capture.mjs:44-70）、ffmpegPath は option→env FFMPEG_PATH→PATH の 3 段解決（:78-80）。再起動耐性あり（後述 design）。**合致**。
2. **PCM フレーム化**: `splitFrames`（純）+ `createPcmFramer`。既定 512 サンプル = Silero v5 @16kHz の要求フレーム長（pcm-framing.mjs:22,127）。**合致**。
3. **Silero VAD ラッパ**: `createSileroVad`（onnxruntime-node 直利用 = Undine 承認済み選定）。1 フレーム→1 確率の薄い層に限定し、区切り判断をセグメンタへ分離。**合致**（実モデル照合済み・検証 6）。
4. **発話セグメンタ純関数**: `createSpeechSegmenter`（ストリーミング）+ `segmentSpeech`（バッチ純関数）。語彙は `threshold / negThreshold / minSpeechMs / minSilenceMs / speechPadMs / maxSpeechMs`（speech-segmenter.mjs:32-40）= whisper-server VAD オプション相当 + Silero `get_speech_timestamps` 準拠。maxSpeechMs 既定 Infinity は Undine 承認済みの純関数契約（常駐側有限既定は Domain C 裁定）。**合致**。
5. **発話単位 WAV 組み立て**: `encodeWav` = `wavDurationSec` の逆写像。canonical 44 byte ヘッダ + data。ラウンドトリップ不変条件をテストで固定（wav-encode.test.mjs:9-30）。**合致**。
6. **合成 PCM fixture テスト**: `fixtures-audio.mjs`（正弦波 + 無音 + 確率矩形列、全て in-memory 決定論）。実マイク・実 WAV・実 ONNX 不使用のロジック層と、ONNX 要の薄い層（silero-vad.mjs）が分離されている。**合致**。
7. **依存宣言（choke point 1）**: `onnxruntime-node@1.27.0` 宣言 1 行のみの package.json diff（検証 5）。**合致**。

**VAD イベントの購読可能性と Domain B への継ぎ目**（wave 計画 §2「VAD イベントは魂の一級市民」）:

- `push`/`flush` の返り値 + `onEvent` コールバックの双方で購読可能（speech-segmenter.mjs:97,114-121）。
- 3 イベントの分業が S6/S9 の要求（即応性 vs 確定性）に整合: `speechStart`（即発火・暫定オンセット → S6 barge-in）/ `speechEnd`（{tMs,startMs,endMs,durationMs,reason} → Domain B が範囲を `encodeWav` して whisper へ・S9 相槌）/ `speechCancel`（スパイク retraction → S6 の duck 取り消し）。`reason`（silence/maxSpeech/flush）で「一区切り」と「機械的切断」を区別できるのも S9 の判断材料として妥当。
- `speechEnd.{startMs,endMs}` は ms 単位の絶対時刻で、PCM リングバッファの範囲切り出し（Domain C 結線）の入力として成立する。**継ぎ目 OK**（ただし clamp 注意 → non-blocking note 1）。

**blocking 基準 §4 の突合**:

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| (1) pnpm-lock/器/契約/S1 実装不変・S1 84 無退行 | 合格 | 検証 1・3（pnpm-lock/契約 diff 空・S1 src 変更ゼロ・129=84+45） |
| (2) 3 チェック無退行 + バイナリ/モデル/音声の非コミット | 合格 | 検証 2・4（source の赤は既知 baseline のみ・vendor porcelain 空） |
| (3) 純関数 + fixture テスト必須 | 合格 | encodeWav/splitFrames/segmentSpeech 等すべて純関数 + 45 テスト |
| (4) 録音データをリポジトリに残さない | 合格 | fixture は全て合成 in-memory。fake-ffmpeg も決定論バイトパターン。.gitignore に *.wav/*.pcm/*.raw/recordings/ の安全網 |
| (5) 子プロセス終了処理の明示設計 | 合格 | dispose = タイマ clear→kill→stdio destroy→unref（design レーン参照） |

---

## design レーン（設計・境界）: PASS

- **S1 流儀との整合**: 注入点の型（`spawnImpl`/`setTimeoutImpl`/`nowImpl`/`ortImpl`）、依存ゼロ lineReader（audio-player.mjs:166-181 と同型）、純関数切り出し（`buildFfmpegArgs`/`resolveFfmpegPath` は spawn せずテスト可能）。**S1 の手本に忠実**。
- **クリーンシャットダウン（s1-followup §8 の型）**: `dispose()` は (1) restartTimer clear、(2) disposed フラグ（exit ハンドラ早期 return で再起動封止）、(3) `child.kill()`、(4) stdio 3 本 destroy、(5) `child.unref()`、冪等（ffmpeg-capture.mjs:185-208)。audio-player.mjs:133-156 と同一の窓塞ぎ。再起動タイマも `unref()`（:165-167）で「タイマだけが event loop を生かす」ことがない。テスト実行が 1 秒未満で正常終了したこと（検証 1）が傍証。**合格**。
- **再起動耐性**: restartDelayMs(500)/maxRestarts(5)/restartResetMs(5000) の 3 点設計。「十分生きてから死んだら予算リセット」（:152-155）により、恒常的デバイス不正だけを打ち切り、稀発クラッシュの常駐は守られる。妥当。maxRestarts 到達後は `onExit({willRestart:false})` で呼び出し側へ通知され黙死しない。**合格**。
- **silero-vad.mjs の install 前防御**: onnxruntime-node は `init()` 内動的 import のみ（silero-vad.mjs:95）。モジュール評価では throw しない設計がコード上成立しており、かつ実経路でも機能（検証 6）。テスト非到達も確認済み（検証 7）。**二重防御は実証済み**。
- **エッジケース**: 半端バイト持ち越し（leftover コピー・フレームは slice コピーで内部バッファ非共有）、奇数長 throw、-32768→-1.0 正規化、tMs 単調性 throw、threshold∈(0,1]/negThreshold∈[0,threshold) 構築時検査、パディング clamp(0)、flush 時の silenceStartMs 優先（flush 中に無音候補があればそこで切る = speech-segmenter.mjs:217 の `silenceStartMs ?? tMs` は正しい選択）。見落としの明白な欠陥なし。
- **境界**: 全 .mjs の import は node:* + 自 zone 相対のみ。soul-zone guard 緑（検証 2）。魂 zone 外への書き込みゼロ（fixture も in-memory）。ルート .gitignore 不触・魂ローカル .gitignore 新設は器の領分を侵さない。**合格**。

---

## test レーン（fixture 十分性）: PASS-with-notes

45 テストを全読し、Gnome 報告 §2 の「決定したエッジケース」7 項と突合:

- **wav-encode (11)**: ラウンドトリップ 3 本（16k mono 1.0s / 正弦波 200ms / 無音+正弦波+無音 500ms = 発話セグメント相当）で `encodeWav→wavDurationSec` の逆写像性を固定。ヘッダ構造（RIFF size・data size・byteRate）・LE 書き込みの読み戻し・Uint8Array パススルー・throw 4 種。**十分**。
- **pcm-framing (13)**: ちょうど N/半端持ち越し/境界跨ぎ結合/フレーム未満/コピー非共有/不正 frameBytes、decode 逆写像・奇数長 throw、正規化 3 点、既定 512(=1024byte)、変則 3 分割投入、leftover 観測、reset。半端バイトの主張と一致。**十分**。
- **speech-segmenter (14)**: 報告 §2.3 のエッジケース 1(無音→発話→無音・padded 境界の数値固定 130/830)・2(スパイク棄却→speechCancel・startMs 検算)・3(maxSpeech 2 分割・区切り位置の数値固定)・4(ヒステリシスディップ 0.4 で割れない)・5(clamp 0)・6(単調性/非有限 throw・threshold/negThreshold 検査)・7(flush 確定) すべてテストで固定。streaming の即発火・onEvent 併用・reset 後再投入も固定。**主張と実装とテストが三点一致**。
- **ffmpeg-capture (7)**: ダミー子プロセス（`process.execPath` + fake-ffmpeg.mjs 注入）で実マイク・実 ffmpeg 非依存。合成 PCM 2048B 往復（先頭 4 byte のパターン検証）・異常終了→再起動→maxRestarts 打ち切り（exit 4 回・willRestart 列・totalBytes=64 の決定論検証）・dispose 冪等 + dispose 後 exit コールバック不着・stderr 行経路。**全 await が `withTimeout` で包まれ、dispose が finally にあり、テスト自身がハング安全**。

**補強候補（non-blocking・下記指摘一覧）**: restartResetMs の予算リセット経路が未テスト、maxSpeech 分割末尾の speechCancel 未 assert、encodeWav の channels≠1 未テスト等。

---

## 指摘一覧

### blocking

なし。

### non-blocking（notes）

1. **[design/継ぎ目] `speechEnd.endMs` はストリーム実在範囲を超え得る / maxSpeech 分割セグメントは重なる** — (a) flush 時 endMs = 終端 tMs + speechPadMs で、実際の PCM 終端より pad 分先を指す。(b) maxSpeech 分割では seg[n].endMs = t+pad / seg[n+1].startMs = t−pad で 2×pad（既定 60ms）重なる（テスト自身が {0,350},{290,670} を固定 = 意図された挙動）。どちらも純関数契約としては一貫しているが、**Domain B/C で PCM リングバッファから範囲を切り出すとき [0, 実データ末尾] への clamp が必須**。結線側の設計注記として引き継ぐこと。根拠: speech-segmenter.mjs:111-112,128-135,213-221。
2. **[記録] Gnome 報告の per-file テスト内訳が実数と不一致** — 報告は pcm-framing 14 / speech-segmenter 15、実数は 13 / 14（検証 1。合計 45・総数 129 は正しい）。実装の問題ではなく記録の軽微な誤り。domain-a.md の訂正推奨。
3. **[test] restartResetMs の予算リセット経路が未テスト** — 「restartResetMs 以上生きてから死んだら restartCount=0」（ffmpeg-capture.mjs:152-155）は nowImpl 注入で実時間なしにテスト可能だが未固定。再起動テストは 1e9 でリセットを殺して素通ししている。常駐の生命線なので続行フェーズで 1 本追加推奨。
4. **[test] maxSpeech 分割テストの末尾 speechCancel が未 assert** — 25 フレーム連続発話 + maxSpeechMs 300 の flush で、3 番目の断片（160ms < minSpeech 250）は speechCancel になるはずだが、テストは segments.length==2 のみで events 末尾を見ていない。挙動自体は正しい（手検算で確認）。
5. **[test] encodeWav の channels≠1 / int16ToFloat32 の +32767 上端が未テスト** — 既定経路(mono)は固定済みで実害なし。網羅の補強候補。
6. **[design] fake-ffmpeg の `process.stdout.write` 直後 `process.exit`** — 理論上は未 flush 打ち切りの余地がある（Windows パイプ・大きな書き込み時）。現行 16〜2048 byte では観測されず（検証 1 で決定論 pass）。--bytes を大きくする将来のテストでは write コールバック後 exit にするのが安全。
7. **[design] silero-vad.process() は出力名不一致時に throw でなく NaN を返す**（silero-vad.mjs:127-129）— NaN はセグメンタ push の有限性検査で throw するため下流で顕在化はする。I/O 名は実モデル照合済み（検証 6）なので実害なしだが、ラッパ自身で明示 throw する方が診断は速い。続行フェーズの VAD テスト追加時に回収可。

---

## install 待ち項目の確認

- **Gnome 報告時点の状態**: `silero-vad.mjs` は書いたが実行未検証・テスト非到達・依存宣言のみ、が報告の主張。テスト非到達（検証 7）・宣言 1 行のみ（検証 5）・動的 import 防御（コード読解 + 検証 6）はすべて裏取りでき、**報告は正確**（内訳数字の軽微な誤りを除く）。
- **レビュー時点の状態**: choke point のユーザー作業 2 点（npm install / silero_vad.onnx 配置）が**完了済み**と観測（検証 3・4・6）。これに伴い Gnome の続行フェーズ計画 3 項のうち、(1) install 後 3 チェック無退行 → **本レビューで確認済み（検証 2）**、(2) preflight-vad の I/O 照合 → **本レビューのプローブで実質達成（検証 6）**。残るは (3) VAD ラッパを import するテストの追加（ortImpl 注入 or 実モデル）と、再現資材としての preflight-vad スクリプト化。計画自体は妥当で、残項目は Domain B/C と地続きに回収可能。

---

## Orch-Sylph への質問

1. **install の実施主体の確認**: `node_modules/onnxruntime-node` の存在・package-lock.json +186 行・`vendor/models/silero_vad.onnx` 配置は、wave 計画 §5-1 の choke point ユーザー作業が完了した状態と解した（Gnome/レビューは install 禁止のため、実施主体はユーザーのはず）。この理解で正しいか。正しければ choke point は解消済みで、package-lock.json の diff は install の自然な帰結として受理してよい（§4-1 の明示保護対象ではない）。
2. **preflight-vad の帰属**: I/O 名照合は本レビューの使い捨てプローブで達成済みだが、再現可能な資材（`preflight-vad.mjs` 相当）と VAD ラッパ到達テストは未作成。Domain B/C のどちらの職掌に載せるか（推奨: Domain C の結線と同時。Domain B は whisper 側 preflight-asr があるため）。
3. **note 1（clamp）の引き継ぎ先**: `speechEnd.endMs` の実在範囲 clamp は Domain C の結線（リングバッファ切り出し）の設計注記として明示的に引き継ぐことを推奨する。wave 計画 §3 Domain C への注記追加は Orch の裁量でよいか。

---

## 結論

Domain A（取り込み + VAD + 発話セグメンタ）は wave 計画 §3 Domain A の 7 要求・§4 blocking 基準 5 項をすべて満たす。blocking 指摘ゼロ。129/129 緑（install 後環境で自走確認）・3 チェック無退行・保護対象不変・vendor/録音物非コミット・純関数 + fixture・終了処理は S1 の型に忠実。未検証仮定だった Silero ONNX I/O 契約は実モデル照合で一致を確認済み。**Domain B へ進める**。non-blocking note は続行フェーズ/Domain B/C で回収可能。
