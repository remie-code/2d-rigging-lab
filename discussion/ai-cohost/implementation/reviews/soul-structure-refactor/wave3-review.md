# Wave 3 独立レビュー

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[実装と検証](../../waves/soul-structure-refactor/wave3-completion.md)

判定は合格。統合全回帰は 2593/2593 件、独立回帰は 71/71 件。構成・境界 guard と本人記憶の保護を確認した。

- `venue/lifecycle.mjs` が phase、エラー、開場時刻、世代、遷移待ちを所有する。開場のロール確定から、資料、耳・声・頭・体の準備、open への移行、失敗時の巻き戻しを起点と照合した。VC 単体、YouTube、遅れて返る結果に適用される phase と世代の条件を確認した。
- 通常閉場の一度だけの保存依頼と保存後の資料解放、遠隔閉場の完了段の確定と再試行、結果不明での保留、receipt とプロセス終了の順を確認した。読解経路は `cockpit-server.mjs` の HTTP 操作から `venue/{lifecycle,remote-close}.mjs`、`saveRecording` の結線、`scripts/cockpit.mjs` の `saveFinal`、記憶担当へ続く。
- 配信・Discord、通常・遠隔閉場、場の資料を含む対象 71/71 件を独立再実行し、skip 0。実サービスと実 VC を使用せず、試験後に本人記憶の HEAD と全未追跡込みの作業状態を読み取りで確認した。
