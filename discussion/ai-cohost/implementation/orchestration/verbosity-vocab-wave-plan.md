# wave計画: 口数モード実配線 + コーディ語彙登録

> Status: **計画確定(2026-07-14)・発進待ち**。
> 根拠: 棚卸し [verbosity-vocab-inventory.md](verbosity-vocab-inventory.md)(裁定+現行値+写経元)。出自: 操縦席改定followup §1 / s6-followup §12・§2。
> 位置づけ: S8前の2小タスク(独立2問題を1waveで別ドメイン)。器コード不変・新規依存ゼロ。
> 方式: 単一Orch-Sylph(opus)がDomain A→B順次。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来。

## 1. ゴールとゲート

- **人間ゲート**:
  - A(口数): 運転バーで控えめ/ふつう/おしゃべりを切替→**自発発火の頻度が体感で変わる**(区切り応答+沈黙。おしゃべり=よく拾う/控えめ=静か)。次回起動でモード復元。※コメント反応の変化はS7 YouTube実ゲート保留のため今回は体感対象外(配線はする=untested)。
  - B(コーディ): **スイープ計測結果**を見て「promptで名前正答率が上がり・幻聴混入が許容内」を判定+実発話で「コーディ」が拾われやすくなったか。
- **機械ゲート**: 全テスト無退行+新規純ロジックfixture緑・3チェック無退行・lockfile/器コード/契約/package.json完全不変・**新規依存ゼロ**・SDK実消費ゼロ。

## 2. 設計の枠(裁定済み・詳細はinventory)

- **A**: fire-schedulerの定数束を**モードで実行時差し替え**(const→let+`setVerbosity(mode)`を`setEnabled`隣に追加=既存差分最小)。3モードの定数束(inventory A-2の表・9値)をデータ定数テーブルで宣言。触るのはturn-end確率/不応期・silence基礎/ジッター/不応期/予算・comment確率/不応期/予算。**turn検出(TURN_END_SILENCE_MS)・name variants(呼びかけ/comment-call)・barge-inは不変**。setVerbosityは残予算を新モードのmaxへリセット。永続=verbosityMode(settings)。UIは運転バーのプルダウン既存(no-op→POST /api/verbosity配線)。
- **B**: whisper-inference.mjs:100の隣に`form.append("prompt", PROMPT)`1行(リクエスト毎)。PROMPTは静的コード定数(v0「こーでぃー、コーディ。」)。転写バッファ/セグメンタ/VAD不変。検証=スイープ計測スクリプト新規(bench-asr部品の再利用)。

## 3. ドメイン分割

### Domain A: 口数モード実配線

- fire-scheduler.mjs: tunable const→let化+`setVerbosity(mode)`+`getVerbosity()`を公開口に追加(setEnabled隣)。3モードの定数束を**宣言テーブル**(データ)として定義。setVerbosityは束代入+残予算を新maxへリセット。createFireSchedulerに初期mode受け口(既定"normal")。**既存の全定数export・既定挙動(mode未指定=現行値=ふつう)は不変**(S6/S7無退行)。
- cockpit-server.mjs: `POST /api/verbosity`(self-fire写経・:880後)→scheduler.setVerbosity+onSetVerbosityフック(失敗寛容)+broadcastState+snapshot返し。snapshot()に`verbosity:scheduler.getVerbosity()`(:482 selfFire隣)。orchestrator注入時のscheduler生成に初期mode配線。
- scripts/cockpit.mjs: `createVerbosityHooks`(createSelfFireHooks写経・初期resolve+onSetVerbosity)+server注入。
- cockpit-settings-store.mjs: `getVerbosityMode`/`setVerbosityMode`(getVisionTarget写経・文字列・asStringOrNull)。
- ui/control-bar.mjs: プルダウンonChangeをno-op→POST /api/verbosity(onToggleSelfFire写経・成功時applySnapshot)。verbosityをprops/snapshot駆動のcontrolledに(selfFireトグルと同型・ローカルstateの綻び回避)。title注記「実配線済み・コメント反応はYouTube時に体感」へ更新。
- テスト: setVerbosityの純ロジック(束代入・予算リセット・getVerbosity)+モード別に定数が効くことのfixture(fake clock+注入RNG=既存scheduler testの流儀)。POST /api/verbosityのserver test(self-fire test写経・503/200/snapshot)。settings永続キー。S6/S7無退行(mode未指定=現行)。

### Domain B: コーディ語彙登録

- whisper-inference.mjs: `createWhisperInference(options)`に`prompt`受け口(既定=定数)+transcribe内で`form.append("prompt", prompt)`常時注入(audio_ctx隣:100)。PROMPT定数を耳の器官に(v0「こーでぃー、コーディ。」)。ear-pipeline経由の配線(既定promptが常に乗る)。
- **スイープ計測スクリプト** `scripts/bench-name-prompt.mjs`(新規・bench-asr部品再利用): 名前入り文群+名前なし文群をTTS合成(話速/ピッチ/抑揚振り)→prompt有無で/inference直投→ ①名前正答率(揺れ集合照合) ②幻聴混入率(名前なし音声にコーディ系語が出た率) を集計出力。実マイク不使用・音声メモリ内・ディスク非書き込み。
- テスト: transcribeがpromptをform注入する純ロジック(fake fetchで送信body検証・既存whisper-inference/client testの流儀)+prompt無指定時の既定挙動+既存耳テスト無退行。**スイープ計測の実行(実whisper-server起動)は人間ゲート/計測の領分**——機械テストはfakeまで。
- docs: experiments/name-prompt.md(スイープ結果の記録先)+README追記+followup(s6-followup §2の実施記録・実マイク揺れ拡張)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile・package.json完全不変。新規依存ゼロ**。S1〜S7・操縦席既存挙動不変(口数mode未指定=現行値/prompt既定注入で転写正本の形不変)。
2. 口数: setVerbosityの束切替・予算リセットが純ロジックテストで固定。**呼びかけ(call/comment-call)・barge-in・turn検出が口数の影響を受けないこと**をテストで固定。POST経路のserver test無退行。
3. コーディ: prompt注入が転写バッファ/セグメンタ/VADを通らない(正本不変)ことをテストで固定。prompt無指定の後方互換。スイープスクリプトは実ネット/実マイク不出(TTS合成+ローカルwhisper-serverのみ・音声非保存)。
4. 3チェック無退行。SDK実消費ゼロ。終了処理・タイムアウト。

## 5. choke point(ユーザーの作業)

- A: 全器官起動→口数を切替えて自発頻度の体感差を見る(コメントはYouTube保留)。
- B: スイープ計測を回す(手順書用意)→正答率↑・幻聴許容内を確認+実発話で呼びかけ改善を体感。

## 6. Status

**実装完了・機械ゲート緑・全レビュー PASS（2026-07-14）。人間ゲート待ち。** 実行: 単一 Orch-Sylph が Domain A→B 順次・各ドメイン Gnome(sonnet)実装 + Review-Sylph(sonnet) 3レーン(spec/design/test)。

### 機械ゲート生数字（Orch が独立再実行・タイムアウト付き）

- `cd apps/soul/agent && node --test`: **724/724/0**（ベースライン 679 → Domain A 後 706〔+27〕→ Domain B 後 724〔+18〕。合計 +45）。
  - Domain A 追加内訳(+27): fire-scheduler +9 / cockpit-server +5 / cockpit(scripts) +6 / settings-store +4 / control(view-logic) +2 / cockpit-ui +1。
  - Domain B 追加内訳(+18): whisper-inference +5 / ear-pipeline +1〔本数 10→11〕/ bench-name-prompt(新規) +12。
- 3チェック（repo ルート）: check-dependencies **EXIT=0 passed** / check-soul-zone-boundary **EXIT=0（1379 files・器↔魂 越境ゼロ）** / check-source-organization は**唯一の違反 `apps/runtime-player/src/main/physiology/index.ts`（器側 barrel-only・ブランチ既存ベースライン=本 wave 不変）**のみ＝無退行。
- `git diff --stat`: **器コード(apps/runtime-player・packages)・契約 JSON・pnpm-lock.yaml・apps/soul/agent/package.json・cockpit.html 完全不変**（全体 diff の空集合で包括確認）。**新規依存ゼロ**。SDK/実マイク/実ネット/実 whisper-server/実 TTS 消費ゼロ。

### ドメイン判定

- **Domain A（口数モード実配線）: pass**。fire-scheduler の const→let 化 + VERBOSITY_BUNDLES(9値×3モード・normal=既存 export const 参照) + setVerbosity/getVerbosity、POST /api/verbosity、createVerbosityHooks、getVerbosityMode/setVerbosityMode、運転バーの controlled 化。呼びかけ(call/comment-call)・barge-in・turn 検出が口数非依存であることをテストで固定（blocking §4-2 充足）。3レーン全 PASS。
- **Domain B（コーディ語彙登録）: pass**。whisper-inference.mjs に DEFAULT_WHISPER_PROMPT 定数 + options.prompt 受け口 + transcribe への form.append("prompt") 常時注入。ear-pipeline.mjs 無改変で既定 prompt が本番経路に自動注入。正本不変(prompt は request form のみ・戻り値はサーバ応答由来)をテストで固定（blocking §4-3 充足）。スイープ計測スクリプト scripts/bench-name-prompt.mjs は**書くだけ・未実走**（direct-execution ガード + fs 書き込みなし）。3レーン全 PASS。

### 成果物

- 完了報告: waves/verbosity-vocab/domain-{a,b}.md。レビュー: reviews/verbosity-vocab/domain-{a,b}-review-{spec,design,test}.md（計6本）。

### 非blocking申し送り（人間ゲート/将来 followup）

- **口数の armSilence 体感遅延**: モード切替直後の 1 回目の沈黙発火は新モードの silenceBase+jitter を最初から待つ（quiet≈90s〜/normal≈45s〜/chatty≈25s〜）。人間ゲート案内に「切替直後の 1 回目はやや時間がかかることがある」旨を添えると誤解が減る（design レーン Q1）。turn-end 確率(区切り応答)はイベント駆動ゆえ即座に体感が変わる。
- **コメント反応は untested**: comment 系(確率/予算/不応期)は口数束に含めて実装済みだが体感確認は S7 YouTube 実ゲート保留（wave 計画既定方針どおり）。
- **コーディのスイープ計測は未実走**: `node apps/soul/agent/scripts/bench-name-prompt.mjs [--runs N] [--port N] [--synthetic]`（前提: whisper-server + AivisSpeech 起動）。記録先 `discussion/ai-cohost/experiments/name-prompt.md` §4（現状空欄）。実走前に AivisSpeech の audioQuery フィールド名(speedScale/pitchScale/intonationScale)の実在確認が要る（未検証・Gnome §質問3）。実走コストは TTS 42回・inference 84回相当（--runs 既定 1）。
- **軽微**: (1) fire-scheduler と cockpit-server の口数モード妥当性検証の重複（v0 3モード固定で実害なし）。(2) bench-name-prompt の NAME_MATCH_VARIANTS_V0 と fire-scheduler の NAME_VARIANTS_V0 の値二重管理（独立性優先の裁量）。(3) domain-b.md §4 表の ear-pipeline 本数セル誤記(11→12)は Orch が 10→11 に訂正済み。
