# S6 wave計画: 会話が続く(barge-in+自発発火)

> Status: **計画確定(2026-07-13)・発進待ち**。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S6 / [s6-planning-inventory.md](s6-planning-inventory.md)(棚卸し+裁定11件)。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→C→Dを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来。

## 1. ゴールとゲート

- **人間ゲート**: ①こーでぃーが喋っとる最中に君が話し始める→**声が止まり、器の口が閉じる**。次の発火で遮られた事実を踏まえた会話が続く。②「こーでぃー」と呼ぶ→返事が返る。③実況の区切りでたまに拾ってくる(全部には返さない)。④しばらく無言でいる→そのうち画面を見て一言(頻度がうるさくない)。⑤自発OFFトグルで②〜④が黙る(手動Fireは生きる)。⑥魂の声が指定デバイス(マイクが拾わん先)から出る。
- **機械ゲート**: 全テスト無退行+新規全緑・3チェック無退行・lockfile不変・新規依存ゼロ・**器コード完全不変**(口停止は契約内の既存意味論のみ)・実マイク不使用・SDK実消費は上限5 ask。

## 2. 設計の枠(裁定済み・詳細はinventory)

- **原則**: 「いつ喋るか」は機械信号のみ。LLMは「何を言うか」だけ。判断のためのaskは打たない。
- **barge-in**: `speechStart`(VAD即時)を起点に、最小持続時間の機械弁(`speechCancel` が来ずにNms持続)で確定→①プレイヤー停止 ②器へ mouth-open `intent.set`(value=0・短TTL)=speechタイムライン強制release(400ms・契約内) ③切断点記録。誤爆は起きてよい失敗(免罪符)。
- **切断点の正直記録**: モーラタイムライン×再生経過時間で「実際に声に出た文字まで」を算出。転写バッファは**append-only維持**——soul行の追記を「発話完了時(全文)または中断時(声に出た接頭辞+中断注記)」に行う形へ変更(S3の追記タイミング変更=裁定済みの意図変更としてテストで固定)。
- **発火語彙4種**(手動/呼びかけ/区切り応答/沈黙)。自発3種は**発火スケジューラ**(新モジュール・純ロジック)が機械信号だけで判定: 呼びかけ=転写照合(確実)・区切り=speechEnd後の無音X秒+不応期+確率・沈黙=Y秒+ジッター+長不応期+予算(中身はS5視覚発火)。数値は全部コード内定数(fake clock+注入RNGで決定論テスト)。
- **照合集合v0**: `コーディ(ー)/コーティ(ー)` 軸の正規化照合・データ定数(揺れ7種の実測はinventory §4-2。コーピーは誤爆リスクで見送り)。
- **プレイヤー刷新**: 常駐PowerShellを SoundPlayer(PlaySync) → **WinRT MediaPlayer**(非同期+`AudioDevice`指定+PlaybackStateポーリング)へ。停止命令とデバイス指定と再生実区間の追跡(「本当に喋っとる区間」)が一挙に手に入る(実機実証済み・依存ゼロ)。
- **自発OFFトグル**: 操縦席のモードスイッチ+永続化。手動Fireは対象外。
- **長回し(セッション使い捨て)はスコープ外**(方向性のみ台帳へ・実配信の問題駆動)。

## 3. ドメイン分割

### Domain A: 声の器官刷新(voice)

- audio-player常駐スクリプトをMediaPlayer化: `play(wavPath)` / `stop()` / 再生状態(`isPlaying()`または再生開始・終了通知)/ 出力デバイス指定(名前指定・env経由受け渡し)/ デバイス列挙 `listAudioDevices()`。プロトコルは行コマンド2種(PLAY/STOP)+状態応答。
- speak経路: wavDurationSec・再生開始時刻を捨てずに返す(切断点算出の材料)。
- テスト: fake exec/子プロセスで純部品テスト(コマンド往復・停止・状態)。実機は `scripts/preflight-voice.mjs` 拡張or新設(短いWAVで停止とデバイス列挙を検証・音は短く)。S1挙動(既定デバイス再生)の無退行。

### Domain B: barge-in(mind+channel)

- fire-orchestrator: 再生実区間の追跡(speakの戻り値活用)+**中断の公開口**(interrupt)。中断時: プレイヤーstop→channelへmouth-open set(value=0・短TTL)→切断点算出(モーラタイムライン×経過時間)→soul行追記(声に出た接頭辞+中断注記)→診断(barge-in発生)。自然完了時: 全文追記(追記タイミング変更をテストで固定)。
- 機械弁: speechStart受信→Nms内にspeechCancelが来なければ確定(定数)。
- 結線: onVadEventの消費を(SSEと並んで)barge-in判定へ。
- テスト: 全fake(player/channel/segmenterイベント)で縦検証(中断・スパイク取り消し・自然完了・busy整合・S3/S5無退行)。

### Domain C: 発火スケジューラ(mind・純ロジック)

- 新モジュール: 入力=VADイベント・転写onAppend(soul除外)・時刻(注入clock)・自発enable状態。出力=発火要求(kind: call/turn-end/silence)。
- 呼びかけ照合(正規化+揺れ集合データ定数)・区切り応答(speechEnd後X秒無音+不応期+確率[注入RNG])・沈黙(Y秒+ジッター+長不応期+予算カウンタ)。busy中・自発OFF中は発火要求を出さない。
- orchestrator結線: kind付き発火(callとturn-endは通常Fire相当・silenceは視覚発火相当)。発火要求の衝突・busy無視は既存状態機械に従う。
- テスト: fake clock+注入RNGで全分岐決定論(不応期・確率・ジッター・予算・OFFトグル)。

### Domain D: 操縦席+実SDK確認+計測+docs

- 操縦席: 自発ON/OFFトグル(モードスイッチ・永続化)・出力デバイス選択UI(列挙→select→永続化=vision-targetの写経)・タイムライン行(barge-in中断マーカー・自発発火マーカーのkind表示・スケジューラ診断のゴースト行)。
- 実SDK確認(上限5 ask): 自発発火(区切り/沈黙)の実射+barge-in後の「遮られた事実を踏まえた」返事の実観測→ `experiments/s6-conversation.md`(barge-in停止レイテンシ・自発発火の頻度観測・usage推移)。
- docs+followup: README・人間ゲート手順書(音響環境の設営=デバイス指定込み)・s6-followup台帳(セッション使い捨ての方向性・定数の体感調整・照合集合の実人声拡張・実況長回しの計測)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile完全不変。新規依存ゼロ**(WinRT/PowerShell内蔵のみ)。手動Fire・視覚発火・S1〜S5既存挙動不変(soul行追記タイミング変更のみ裁定済み意図変更としてテスト固定)。
2. 3チェック無退行。実マイク・録音物非使用(検証音は合成のみ・scratchpad限定・残さない)。
3. スケジューラは純ロジック+fake clock/注入RNGで**全分岐決定論テスト必須**。「いつ喋るか」判断にLLM askを使うコード経路が存在しないこと。
4. barge-in経路は全fake縦検証+切断点記録の正直性(声に出とらん文字を出たことにしない)をテストで固定。転写バッファのappend-only維持。
5. SDK実消費は上限5 ask。環境変数ガード遵守。
6. 終了処理・タイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ(§1の①〜⑥)。音響設営: 操縦席で魂の声の出力先を「ヘッドホン(2- Shure MV7+)」等マイクが拾わんデバイスに指定する手順は手順書に含める。

## 6. Status

**S6 wave 実装完了・機械ゲート緑（2026-07-13）。人間ゲート待ち。** 単一 Orch-Sylph が Domain A→B→C→D を順次実行。各ドメイン Gnome 実装 + Review-Sylph 3 レーン（spec/design/test）。**全 4 ドメイン・全 12 レビューレーンで blocking 指摘ゼロ**。

### 機械ゲート生数字（Orch-Sylph が全ドメイン完了後に独立再実行・2026-07-13）

- **`cd apps/soul/agent && node --test`（タイムアウト 300s）**: `tests 507 / pass 507 / fail 0 / cancelled 0 / skipped 0 / todo 0`。S6 前ベースライン 411 → 507（**+96**）。内訳: Domain A +14（411→425）・Domain B +27（425→452）・Domain C +27（452→479）・Domain D +28（479→507）。
- **3 チェック**: `check:deps` **passed** / `check:soul-zone` **passed**（1342 files・器↔魂 越境 import なし）/ `check:source` **exit 1 = 既知ベースライン赤 1 件のみ**（`apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反・S5 以前からの器側 pre-existing・本 wave で不変＝無退行）。
- **器コード完全不変**: `git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json` は**出力ゼロ**（器コード・契約 JSON・lockfile・soul package.json すべて不変）。`pnpm-lock.yaml` の sha256 はベースラインと完全一致（`d65a7643…b25fb`）。**新規依存ゼロ**（WinRT/PowerShell 内蔵 + Node 組み込みのみ）。
- **変更範囲**: `apps/soul/**` と `discussion/**` のみ。範囲外の変更ゼロ。`.tmp/facex-*`（別セッション領分）不可侵。

### 各ドメインの成果（契約成果物）

- **Domain A**（[waves/s6/domain-a.md](../waves/s6/domain-a.md)）: 声の器官の WinRT MediaPlayer 化（`play`/`stop`/`isPlaying`/`listAudioDevices`/`deviceName` env 経由）・`speak()` が `playbackStartedAtMs` を返す。preflight-voice 実機 PASS（既定再生/STOP 途中停止/列挙 5 件・日本語名無劣化）。
- **Domain B**（[waves/s6/domain-b.md](../waves/s6/domain-b.md)）: barge-in（`interrupt()`・切断点算出 `computeSpokenPrefix`＝過大評価しない保守設計・soul 追記タイミングを完了時/中断時へ変更・append-only 維持）。口停止は器契約内の `intent.set`（mouth-open, value=0）のみ使用（`sendSet` を soul 側 channel-client に追加・器/契約不変）。全 fake 縦検証。
- **Domain C**（[waves/s6/domain-c.md](../waves/s6/domain-c.md)）: 発火スケジューラ（純ロジック・**import ゼロ＝「いつ喋るか」に LLM ask 経路が構造的に存在しない**）。自発 3 種（呼びかけ照合/区切り応答/沈黙）を機械信号 + fake clock/注入 RNG で全分岐決定論テスト。
- **Domain D**（[waves/s6/domain-d.md](../waves/s6/domain-d.md)）: 操縦席（自発 ON/OFF トグル・出力デバイス選択 UI・barge-in/自発発火のタイムラインマーカー・永続化）+ 実 SDK 確認（**5 ask ちょうど**・env ガード通過・自発 3 種と barge-in 続きを実射・[experiments/s6-conversation.md](../../experiments/s6-conversation.md)）+ docs（[human-gate-procedure.md](../waves/s6/human-gate-procedure.md)・[s6-followup.md](../waves/s6/s6-followup.md)）。

### 主要な non-blocking 申し送り（人間ゲート・followup）

- **`fire()` が再生実区間を await する設計変更**（Domain B §8-1）: POST /api/fire の HTTP 応答が「発話完了 or barge-in 中断」まで返らなくなった（従来は play 送出直後に即 resolve）。機械テストは全 fake `wavDurationSec:0` で無退行。実配信 UX（早期 resolve へ倒すか）は人間ゲート/followup で裁定。
- **observe-conversation.mjs の 5-ask ハードガードがリトライを数えない**（Domain D spec/design レビュー）: `askCount` は ask() 呼び出し回数を数え、内部リトライ（最大 3/ask）を数えないため、理論上は再実行時に 5 ask を超えうる。**今回の実測はリトライ 0 回で実消費 5 ask（usage 表で裏取り済み）**だが、将来の再実行に備えた修正を s6-followup へ推奨。
- 定数の体感調整（不応期/確率/ジッター/X=2000/Y=45000/予算=6）・呼びかけ照合の既知誤爆「コーディネート」（構造的・受容）・実人声への照合集合拡張・silenceBudget のリセットなし（長回し）・口閉じの実機の見え方・barge-in 体感レイテンシ（実マイク要）は人間ゲート/followup の領分（[s6-followup.md](../waves/s6/s6-followup.md) に集約）。

### 人間ゲート（choke point・ユーザーの作業）

手順書: [waves/s6/human-gate-procedure.md](../waves/s6/human-gate-procedure.md)（音響設営＝魂の声の出力先をマイクが拾わんデバイス指定込み・§1 ①〜⑥の確認手順）。**初回ゲート実施済み: ①②③⑤⑥合格・④（沈黙発火）は未確認＝追撃 Domain E 後の再ゲートで確認**（手順書 §9-1）。

### 追撃 Domain E: 自発発火に画像同乗（人間ゲートフィードバック・ユーザー裁定 3 点・2026-07-13）

初回人間ゲートのフィードバックにより追撃実施。**Gnome 実装 + Review-Sylph 3 レーン全 PASS（blocking ゼロ）**。契約成果物: [waves/s6/domain-e.md](../waves/s6/domain-e.md) / レビュー: `reviews/s6/domain-e-review-{spec,design,test}.md`。

- **裁定①格上げ**: call/turn-end の自発発火を `fire({vision:"preferred"})`（第三モード新設）へ。視覚対象設定済みなら画像付き（S5 経路）・未設定なら画像なし通常発火（中止しない）。**silence（`fire({vision:true})`＝見えなければ中止）・手動 Fire・手動視覚 Fire は 1 ビット不変**（既存 ask 本体を `askWithVision`/`fireNormalCore` へ抽出して再利用＝構造的無退行。design レーンが diff の実物で純移動を確認）。
- **裁定②盲目劣化**: preferred のキャプチャ失敗は中止せず画像なし通常発火へ静かに劣化 + `fireVisionDegraded {kind,message}` 診断（ゴースト行の痕跡・既存 diagnostic 相乗り）。
- **裁定③**: トークン増は usage 計器で見張る前提で受容。劣化/未設定時は `vision:false` で正直に通知（見ていないのに true と言わない）＝画像付き/なしを計器で区別可能。
- **docs 追記 2 件**: [s6-followup.md](../waves/s6/s6-followup.md) §12「口数（反応確率）の Cockpit 可変化」（ユーザー裁定の記録: 配信中に Cockpit から切替・CLI 不可・生スライダーでなくモード切替[控えめ/ふつう/おしゃべり]・会話メイン時はおしゃべり側/ゲーム集中時は現行程度・実装時期は今後の課題）/ [human-gate-procedure.md](../waves/s6/human-gate-procedure.md) §9-1 再ゲート手順（放置 45〜75 秒→沈黙発火が画面に言及＝④確認兼用 + 区切り/呼びかけの返事が画面に触れることがある）。
- **機械ゲート（Orch-Sylph 独立再実行）**: `node --test` **518/518 pass**（507 → +11。fire-orchestrator.test.mjs 39→50・cockpit-server.test.mjs 60（call 格上げの 1 アサーションのみ意図的更新））・3 チェック無退行（deps/soul-zone pass・source は既知ベースライン赤 1 件のみ）・器/契約/lockfile/package.json 完全不変（lockfile sha256 ベースライン一致）・**SDK 実消費ゼロ**（全 fake）。
- 申し送り（non-blocking）: 劣化フォールバックは受理 emit（vision:true）後に画像なしへ落ちる一瞬の齟齬あり（反応即時性を優先した設計判断・UI 体感は再ゲートで確認）/ preferred 発火中の barge-in 専用テストなし（共通経路ゆえ構造上無退行・test レーン申し送り）/ turn-end 結線は call と同一 else 分岐（static read で確認・timer 依存ゆえ結合テストは構造的制約）。
- **再ゲート（ユーザーの作業・未実施）**: 手順書 §9-1 の一点確認（④沈黙発火の確認を兼ねる）。
