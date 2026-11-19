# Wave 5 独立レビュー

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[探索と検証](../../waves/soul-structure-refactor/wave5-completion.md)

判定は合格。Soul 最終回帰 2594/2594、器 1095/1095（reference-driver 3/3）、境界 1747 ファイル、fixture 5/5 件。開発側の検証を完了し、普段の配信と Discord 通話による本人確認へ進める。

- 配信専用 YouTube に移した 8 関数を以前の実装と照合した。場の世代と接続中の器官の照合、Discord の判定前後の拒否、guard の順序、classic と speak-now の条件、状態・診断の配信を確認した。場を閉じてから遅れて到着する判定や接続は次の場に届かない。
- 資料台帳は `venue/` に移動し、相対参照の変更を確認した。通常・遠隔閉場から受付停止、受付済み作業の完了、保存と整理、資料解放への順を照合した。README の追加リンクと器側三つの reference-driver 呼出元の相対先を確認した。
- 独立対象 8 ファイルが成功。公開 CLI の隔離起動・EOF、配信と Discord の隔離実 Git、遠隔の再試行と不明保留、YouTube の遅延判定と busy、Discord での資料と VC 再参加、場の台帳を含む。本人記憶 HEAD `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece` と全未追跡込みの空の状態は前後一致。
- 変更に参加していない別の読者が README から三つの実装と回帰へ辿った。場の配信・Discord 結線、HTTP の指名操作と状態スナップショット、起動時の依存の組み立ては既存 server と runtime に残る。回答に必要な変更先への障害は再探索で見つからなかった。

リポジトリ全体の構成ガードには、起点から残る器側の barrel-only 指摘が 1 件ある。実サービスと機器を使う会話の確認は、本人が普段の配信と Discord を使う一回に残る。
