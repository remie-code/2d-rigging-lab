# 意図モーション全件記録の独立レビュー

2026-11-14。 [Wave 計画](../../orchestration/all-motion-recording-wave-plan.md)と[実装契約](../../waves/all-motion-recording/basis.md)を基準とした。

## 初回レビュー

保存失敗の運用診断に修正が必要。Soul の記録完了通知は音声終了と独立して届く。Cockpit は `fire.completed` で診断対象を解除するため、以後の `intent.recording.completed` は記録されない。次の Fire が進行中ならその Fire の診断ファイルに入る。保存を遅延・失敗させたテストは通知を検証しているが、Cockpit の実際の診断先も修正後に確認する。 [区間確定](../../../../../apps/soul/agent/src/mind/speech-intent-delivery.mjs#L22) [診断への接続](../../../../../apps/soul/agent/scripts/cockpit.mjs#L3614) [診断の寿命](../../../../../apps/soul/agent/src/mind/fire-diagnostics.mjs#L93)

- Player の Control Channel 20ファイル・259件を独立実行した。実 WebSocket を使う Player/Soul の統合、一つの起動スナップショットからの候補と再生、演技定義更新・削除後の取得、内容による重複排除、保存失敗時の再生継続が通過した。初回のサンドボックス内では WebSocket の13件が接続できず、ローカルループバックを許可した再実行で全件通過した。
- Player 型検査、Soul の Fire と意図モーション134件、および Soul 境界チェックが通過した。
- 旧 `speech-intent-none` の保存器はテストから明示注入される。Cockpit は全件記録器の既定を使い、旧ログと集計器に実装差分はない。 [Soul の記録器選択](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs#L98)
- 各要求は受付、拒否、未送信、応答不明を分け、描画の観測は `unobserved` として保存される。版参照は判定入力に使ったカタログに由来し、対応がない組には `clipId: null` を保存する。 [版参照](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs#L79) [要求結果](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs#L110)

## 修正後の再レビュー

**ソースの受入条件に合格。** 発話終了後の保存失敗は Soul の `speech-intent-recording-errors.jsonl` に、元の発火番号、世代、区間、エラーコードで記録する。次の Fire が進行中に届いた場合も専用ログへ帰属する回帰テストが通過した。接続自体に失敗した `begin` は `not-sent`、送信後に応答を失った `play` は `reply-unknown`。追加属性付き hello と旧 hello を受け付け、壊れた追加属性は候補選択を妨げない。 [遅延失敗の診断](../../../../../apps/soul/agent/src/mind/fire-diagnostics.mjs#L135) [接続前のエラー処理](../../../../../apps/soul/agent/scripts/cockpit.mjs#L446)

- Player の Control Channel 20ファイル・260件が実 WebSocket を含めて通過。Player 型検査も通過。
- Soul の Fire、意図モーション、診断、タグ、Channel client 184件と Cockpit のモーション接続2件が通過。Cockpit 全体を含めた別の試行は結果が出る前に終了し、件数に含めていない。Soul 境界チェックと `git diff --check` も通過。

## 配布後の独立レビュー

**通常版・portable ともに合格。** 普段の `dist` にある両 exe、通常版 `app.asar`、および各隔離起動で実ロードされた `app.asar` を、検証済み候補の SHA-256 と照合した。通常版の配布先は77ファイル、退避した旧版は75ファイルをハッシュ一覧と照合し、portable の配布先と退避先も照合した。最初の配布試行は稼働中の Player を検出して変更前に停止した。旧版の復元試験は隔離コピーで、最初の切替直後に失敗を注入して実施した。 [配布・バックアップ・復元証跡](../../../../../tmp/all-motion-recording/deployment-entry.md)

両配布先から各3回隔離起動し、実 WebSocket と Soul の発話経路に合成入力と再生イベントを通した。各版の4ファイルを読み返し、選択3件の要求受付、未制作1件の `clipId: null`、音声範囲完了、描画未観測を確認した。起動中編集と再接続の記録は旧版、再起動後の記録は新版を指した。元定義を削除した最後の起動では候補13組が11組になり、アーカイブ8件を維持した。4記録の版参照から取得した定義は旧版3件と新版1件に対応し、各 SHA-256 が一致した。 [通常版の実行結果](../../../../../tmp/all-motion-recording/dist-normal-86ycB8/report.json) [portable の実行結果](../../../../../tmp/all-motion-recording/dist-portable-ddF9t2/report.json)

現用の r844 Export マニフェストと7演技の JSON は試験前の SHA-256 と一致した。旧 `speech-intent-none` 452件はファイル名と SHA-256 が事前一覧に一致した。普段の会話での本人確認は [起動と確認の手順](../../waves/all-motion-recording/human-gate.md) に記録する。
