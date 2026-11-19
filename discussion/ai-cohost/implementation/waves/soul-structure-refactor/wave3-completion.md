# Wave 3 場の状態と寿命

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[Wave 2](wave2-completion.md)

- `apps/soul/agent/src/cockpit/venue/lifecycle.mjs` が場の phase、世代、開場時刻、現在の遷移を所有する。通常開場の共通手順、開始失敗時の巻き戻し、通常閉場、Ctrl+C での遷移待ちをここから追える。
- 通常閉場は新規受付を止め、会話を写してから器官を畳み、受付済みの仕事を待つ。保存と必要な整理の完了を待って、資料を解放し、閉場する。予期しない例外でも保存の依頼は最大一度。
- `apps/soul/agent/src/cockpit/venue/remote-close.mjs` が遠隔閉場の各段の確定と再試行可否を所有する。場の本体と転写・fold・drain・資料解放を共有し、遠隔の保存結果を見て未確定段を保持する。結果の確認が必要な場合は保留し、完了時の記録を遠隔 CLI に返す。
- `apps/soul/agent/src/cockpit/cockpit-server.mjs` は配信・Discord の入口、各器官・会話の正本・役割と上の状態を結ぶ。VC のみ退出する操作は場を閉じず、同じ場の世代で再参加できる。HTTP/SSE の配置は Wave 4 の対象。

## 実行記録

- 一人の実装担当が場の状態から閉場までを所有した。変更は server と `venue/` の 2 ファイル。CLI スクリプトと既存テストは維持。
- 対象回帰は 4 並列と loopback 許可で 606/606 件、失敗・キャンセル・skip 0。正常閉場、巻き戻し、同時操作、遅延した自発判定、VC のみ退出・再参加、資料の保護と解放、遠隔各段の確定と不明保留、配信と Discord の隔離実 Git を含む。独立レビューの絞り込み回帰は 71/71 件。
- ソース構成、Soul 境界 guard 1734 ファイル、`git diff --check` に成功。変更 3 ファイルの未定義識別子の追加は 0。
- 統合全回帰は `apps/soul/agent` で `node --test --test-concurrency=4` を loopback 許可で実行し、2593/2593 件、失敗・キャンセル・skip 0。Windows PowerShell、Node v24.19.0、108.288 秒。境界 fixture 5/5 件。
- 本人記憶は前後とも HEAD `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece`、全未追跡込みの作業状態が空。実 VC や外部サービスへの接続は隔離代替を使用した。
