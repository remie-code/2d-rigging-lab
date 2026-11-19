# Wave 1 独立レビュー

判定は合格。実装と分離したコンテキストで、計画、ソース、本番呼出元、新規試験と結果を照合した。[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[現状と基準](../../waves/soul-structure-refactor/wave1-baseline.md)

- `scripts/cockpit-venue-memory.test.mjs` を loopback 許可で独立再実行し 2/2 件成功。両モードで本番 HTTP の開場から会話処理、通常閉場、専用ロールの実 Git までを通す。合成会話の両側が writer の入力と唯一の記録コミットに含まれた。`placeInfo()` と実保存で同じパス解決を使うことをコードで確認した。
- 本人記憶の HEAD `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece` と全未追跡込みの空の作業状態を独立して読み取り、前後結果との一致を確認した。記憶・設定・実サービスを開発試験に使っていない。
- 基準担当の全回帰結果は Soul 2593/2593、器 1095/1095（reference-driver 3 件を含む）、Soul 境界 guard 成功、fixture 5/5 件。移動候補の呼出元・相対位置・回帰・次担当を確認した。

Soul 全回帰の基準は loopback を許可した `node --test --test-concurrency=4`。既定並列度では既存の remote detached と WinRT PDF に 2 件の失敗があり、単独再試行と 4 並列で再発しなかった。原因は未確定。全リポジトリのファイル構成チェックに既存の Runtime Player barrel 違反がある。隔離試験は外部サービスと物理機器への接続を代替した。起動経路の技術検証は Wave 4、本番設定と実サービスを使った会話体験は全Wave後の本人確認に引き継ぐ。
