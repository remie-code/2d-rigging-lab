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

計画確定・発進待ち。
