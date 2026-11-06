# エージェントの2Dモデリング craft はどう育ったか

2026-11-06の夢。問いは「エージェントによる2Dモデリング周りのcraft関連はどうだ？」。

入口は discussion/_conventions.md → discussion/_map.md → model-authoring/_map.md。実行レシピの正本、後続の制作事例、外部技法の収集と採用を区別して辿った。

## 観測と根拠

- Wave102のEditor mainline計画停止後も、[model-authoring地図](../../model-authoring/_map.md)にWave103–105の制作装備の履歴と最終報告へのリンクがある。CLI・描画・知覚・測量・健診・可視性統一は道具、その道具で工程を実行し判断する知識がcraft。technical passと制作の外観承認を分けた入口をcraft地図へ追加した。
- [craft設計](../../model-authoring/premises/craft-design.md)は、常駐地図と工程単位の遅延ロード、自己完結レシピ、実行からの書き戻しをAcceptedとしている。[craft地図](../../model-authoring/craft/_map.md)・[周回指揮書](../../model-authoring/craft/_conductor.md)が実行入口。[閉問題地図](../../model-authoring/closed-problems/_map.md)には01–19通過、2周目4項目完了、口と衣装差分の3周目追試が記録されている。
- 9月は参照画像を読む直接造形へ進んだ。[帽子](../../model-authoring/reference-guided-rigging/experiments/hat-rebuild-lessons.md)は既存変位の微修正から曲率・耳の見える面の読み直しへ移りv20を承認。[髪](../../model-authoring/reference-guided-rigging/experiments/hair-occlusion-lessons.md)は非表示診断と連続性の調整でv5を承認。[Body X/Z](../../model-authoring/reference-guided-rigging/experiments/body-x-z-lessons.md)は参照の強さや首追従を見直し、通常衣装のFace X/Y/Z・Body X/Z両方向まで受領。これらはcraft v2候補であり、全レシピへの蒸留完了ではない。
- [技法カタログ](../../model-authoring/technique-catalog/_map.md)は既存craftと独立した外部技法収集。全体像はDraftだが、[顎下の影](../../model-authoring/technique-catalog/practice/chin-underside-shadow.md)は実制作し2026-10-20ユーザー採用（r2159）。warp範囲外の裂け、粗い輪郭による筋、顔の下に隠れる濃い帯を修正したv1〜v5の経過と、首の元の影などの残課題が残る。

## 入口を直した理由

model-authoring地図は参照riggingを「位置合わせ承認済み・隣接フロー試作へ」、技法カタログを収集進行中としており、制作・採用まで辿る答えが古くなる。両行とEntry Pointsを更新した。craft地図に三系統の問い別入口、参照rigging地図に帽子・髪・Bodyと後続の顎影の入口を加えた。古い試行本文は履歴として保持し、採用範囲と残件は根拠へ委譲した。

## 見た範囲と残り

上記地図・設計・指揮書・制作教訓・顎影実践記録を確認。外部出典の再調査、外部workspaceの実物・画像・比較viewer、全レシピの現行API適合性、全機能の実行再検証は今回行っていない。通常衣装の姿勢受領と現行export・表情・物理・別衣装の網羅確認は別。strict-ref/sidecar portability、PNG再認証、現在の母音実機gateはmodel-authoring地図の残件を維持する。

## 独立読み直し

初見のSolがroot地図 → model-authoring → craftの道から、Wave103–105の装備、3周の記録、帽子v20・髪v5・Face/Bodyの受領、顎下の影r2159の採用と未検証事項を復元できた。参照制作地図の旧「現在地」見出しも、冒頭の履歴として読む案内を通して結論へ到達できた、との観測を親から受領した。
