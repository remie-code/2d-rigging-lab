# Wave 2 機能の実装先

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[Wave 1 の基準](wave1-baseline.md)

## 配置

パスは `apps/soul/agent/` 起点。

- `src/chat/comment-intake.mjs` がコメントの guard の並行判定、到着順の確定、伏字、ID を扱う。`src/cockpit/cockpit-server.mjs` が場の転写・SSE・閉場時の初期化と結ぶ。
- `src/mind/self-fire-request.mjs` が予定した発話、speak-now、コメント反応の発火依頼データを作る。現在の場・busy・KILL の状態は server が所有する。
- 記憶は `src/memory/role-memory-places.mjs` がロール別の場所を解決し、`src/mind/venue-memory-recorder.mjs` が記録と checkpoint、`src/mind/venue-memory-organiser.mjs` が整理を調整する。場の閉場時に呼ぶ順序は Wave 3 の対象。
- 会話の指示、セッション代行、Codex/圧縮の設定は `src/mind/{conversation-instructions,conversation-session-proxy,codex-conversation-settings,conversation-compaction-settings}.mjs`。モデルの判定を `src/mind/brains.mjs` に揃え、ロール編集と適用は `src/roles/cockpit-roles.mjs` が扱う。小タスクは既存の `src/mind/local-task.mjs` に本体があり、`main` は環境依存を渡す。
- 身体接続は `src/channel/cockpit-channel.mjs`、視覚対象は `src/eyes/cockpit-vision-target.mjs`、声のエンジン管理は `src/voice/cockpit-voice-engines.mjs`。Discord のアダプターと再生先は `src/discord/{cockpit-discord-experience,venue-player-slot}.mjs`、配信のコメント元は `src/chat/cockpit-chat-source.mjs`。設定への接続は `src/cockpit/{cockpit-conversation-settings,cockpit-device-settings}.mjs`。
- `scripts/cockpit.mjs` は従来の export を再公開し、本番 `main` で同じ依存を組み立てる。追加 16 ファイルと既存 `brains.mjs` を一人の担当が所有し、発話・コメント担当が server と新規 2 ファイルを所有した。JSDoc の型参照は移動先を明示する import 型に修復した。

## 実行記録

- 発話・コメントを担当した実装者が対象 8 ファイルを loopback 許可で検証し、373/373 件成功。Soul 範囲のソース構成チェックと `git diff --check` に成功。テスト変更はなし。
- Cockpit の機能を担当した実装者が対象回帰を 266/266 件実行し、既存の本番結線検査と隔離記憶 2 件を確認した。独立レビューの別パネルは 556/556 件。記憶保存試験前後の本人 HEAD と全未追跡込み状態が一致した。
- 統合担当が `apps/soul/agent` で `node --test --test-concurrency=4` を loopback 許可で実行。2593/2593 件成功、失敗・キャンセル・skip 0、Windows PowerShell、Node v24.19.0、108.235 秒。Discord VC への発声・2 話者の実耳処理・資料処理中の会話と再入場配達、モデル選択・小タスク・最終保存、思い出し途中の次の発火、配信の身体チャネルと体なし、両モードの隔離実 Git 保存を確認した。
- 本人記憶 HEAD は前後とも `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece`、全未追跡込みの作業状態は空。Discord・物理音声・外部 API は Wave 1 と同じ隔離代替を使用した。
- Soul 範囲ソース構成、境界 guard 1732 ファイルと fixture 5/5、`git diff --check` が成功した。TypeScript の診断を未定義識別子に絞って変更した 22 ファイルと起点を比較し、追加診断は 0 件。
