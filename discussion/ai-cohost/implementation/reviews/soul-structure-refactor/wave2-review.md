# Wave 2 独立レビュー

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[実装と検証](../../waves/soul-structure-refactor/wave2-completion.md)

判定は合格。統合全回帰は Soul 2593/2593 件、失敗・キャンセル・skip 0。構成・境界 guard と本人記憶保護も確認した。

- 既存 Cockpit CLI モジュールの 66 個の named exports は一致。既存の 56 関数を移動先と照合し、型参照を除く本体の変更がないことを確認した。移動で切れた JSDoc の参照は実装担当が修復した。未宣言名、初期化前参照、不明な export に絞った静的検査に指摘なし。
- コメント guard の並行判定、到着順、同期判定の即時処理、ログの伏字、閉場での破棄、speak-now とコメント・視覚文脈の扱いを以前の実装と照合した。場の公開状態と結線を server に維持した。
- 変更担当とは別に発話・資料・音声、Cockpit とモデルの横断回帰 556/556 件を確認した。配信と Discord の隔離記憶保存を含む。試験前後で本人記憶 HEAD `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece`、全未追跡込みの空の状態が一致した。

通常 CLI の起動接続を Wave 4、実サービスおよび機器を全Wave後の本人確認で扱う。
