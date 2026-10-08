# Reference-guided Rigging Map

## 最新の制作状況（2026-09-27・Body-Z両側受領）

通常衣装のFace X/Y/Z・Body X/Zの両方向の主要な姿勢造形が揃い、現行統合モデルはbody-z/package revision1967。Body-Zは承認済み片側から反対側を直接制作し、ユーザーが受領。方法・判断・成果物・残る最終確認は[Body X・Zの教訓](experiments/body-x-z-lessons.md)を参照。以下の確認待ち・未制作という記述は当時の履歴。


## 最新の到達点（2026-09-27）

下向きの合成時の崩れを受けて、ユーザー承認した弱い参照v5へ変更。下向きrigをrevision1218として再制作。詳細は[弱めた下向きrig](experiments/face-y-mild-downward-rig.md)。新しいrigの外観確認待ち。

Face-Y上向き参照v5を承認後、独立したYデフォーマによるrig候補v3を制作。上向きrigをユーザーが「完璧」と承認。下向き参照v1も承認を取得し、下向きrig候補v3 / revision1176を制作。下向きの外観判断待ち。詳細は[experiments/_map.md](experiments/_map.md)。

負方向Face-X v5の目にかかる髪の修正もユーザー承認を取得。教訓と承認範囲は[experiments/_map.md](experiments/_map.md)を参照。

正面と参照からrootが直接造形した正方向Face-Xについて、顔の動き・首に続き、帽子v20もユーザーの外観承認を取得。[experiments/_map.md](experiments/_map.md)から制作経過と帽子再造形の教訓を参照できる。craft v2への蒸留候補として保持し、他軸や全体技術検査の完了とは区別する。

以下は議論・試作の経過であり、過去の「未実施」「未承認」は当時の状態。

2026-09-25。ユーザーとAstraの議論・実験を保持し、将来のcraft v2へ蒸留する。現行craftの置換完了を意味しない。

| 文書 | 役割 | 状態 |
|---|---|---|
| [scope-and-decisions.md](scope-and-decisions.md) | 目的、対象、裁量、human gate、作業場所 | Accepted user decisions |
| [reference-generation.md](reference-generation.md) | 単一軸の目標画像を生成する考え方 | 方針合意、生成品質は探索中 |
| [deformer-transfer.md](deformer-transfer.md) | 対応関係からパーツ別格子変位への変換 | 方針合意、未実証 |
| [motion-review.md](motion-review.md) | 連続運動の目視評価と修正 | 方針合意、rig評価は未実施 |
| [optical-flow-wave-plan.md](optical-flow-wave-plan.md) | 隣接フローの2 wave計画・共通契約・委譲境界 | Wave 1・2 technical PASS、User Gate待ち |
| [landmark-warp-wave-plan.md](landmark-warp-wave-plan.md) | 点・輪郭と保存フローによる変形画像の試作、2 waves・human gate | Wave 2比較試作の技術統合PASS、自然さ未達・Gate 2待ち |
| [experiments/_map.md](experiments/_map.md) | 入力・操作・観測・判定の記録 | 継続 |

## 現在地

正面素材、Face-X中間候補と最大候補が存在する。中間候補はv2を使用。身体を基準にした全体の位置合わせを実施し、比較画像・行列を保存した（experiments/の地図から参照）。RAFTによる隣接フローと合成を2解像度で試作し、比較ビューへ接続。独立技術レビューとrootの目視確認を完了。格子への当てはめ・新しいrigキーの作成は未実施。

## 次の作業

同位置切り替え表示を見たユーザーが「これならオプティカルフローに進める」と判断。位置合わせ段階は次工程へ進む承認を取得済み。次は完成候補のフローを同位置切替でユーザーに提示し、格子へ移す手がかりとして使えそうか確認する。フローとrigのhuman gateは未実施。

## 未決

背景ハローとパーツマスク、対応推定方式、遮蔽・新しく見える面の素材、格子・階層への適用、複数軸の合成。詳細は各文書。

## 点・輪郭を補助にする試作（最新）

ユーザーは顔・眼鏡の点/輪郭を使う後段処理と、初回は変形画像の比較までとする範囲を承認。Wave 1の素材・計算描画・比較表示の実装と技術報告を受領。Cの独立browser確認は環境不可で未実施。rootが実画像指定候補-2を3画像切替で目視し、Gate 1へ提示する。次の区切りは実画像上の指定を確認するGate 1。確認前にWave 2の実画像guided変形を起動しない。詳細はlandmark-warp-wave-plan.md。

ユーザーが候補-2の対応指定を承認。承認対象とhashは計画のGate 1ユーザー確認に記録。次は実画像のflow-only/guided比較を作成しGate 2へ提示する。

最新: Wave 2 v2の4出力と比較sceneを技術受領。root目視では自然さ未達。実験完了記録と計画末尾を参照。Gate 2未承認、格子/完成rigへ進まない。

## 手動造形の試作（進行中）

ユーザー承認により、rootが参照を見て中間姿勢一つの部品別変形を直接指定する。素材抽出・描画・独立技術レビューは委譲、造形判断はroot。詳細は [manual-midpoint-plan.md](manual-midpoint-plan.md)。外観承認は未取得。

手動試作v4を生成。rootがneck_backを後ろ襟と目視確認して衣服側へ固定し、首は描き縁を隠したまま下側の傾きを抑える形へ修正。ユーザーは同じ変形を適用する単位で分けたflat試作構造を了承。正面→今回中間の3段階画像、制御JSON、同位置切替を保存しrootが実browser確認済み。外観のユーザー判断待ち。[実験記録](experiments/manual-midpoint-completion.md) / [計画と判断](manual-midpoint-plan.md)。
## 素材を追加できる入口の調査（現在）

ユーザーはv4の首の不自然さを指摘。自然な形と素材補完を分け、不足を隠すために変形を歪めない方針で合意。造形はroot自身が担当。ユーザーの明示依頼により、EditorのPSD取り込み・既存パーツ差し替え・新素材追加の内部経路をサブエージェント1名が調査中。実装/モデル変更は行わない。詳細な方針はscope-and-decisions.md末尾。

素材取り込み調査完了：[material-ingestion-research.md](material-ingestion-research.md)。PSD→RGBA→Drawable→保存/再読込の経路と既存operationを確認。生成PNGから整合したモデル変更を一括実行する入口は未確認。同領域置換にもbytes登録・source/layer整合が必要、範囲拡張はUV/mesh/keyformの扱いが追加課題。静的調査のみ、実装・モデル変更・実動作試験は未実施。最小変更案は提案段階。
## 素材追加・置換インターフェースの開発範囲（2026-09-26）

[material-authoring-interface.md](material-authoring-interface.md): ユースケースと初回提供範囲を合意。AI向けコマンド＋画像比較、保存後Editor再読込まで。編集中Editorへの即時反映と旧rig自動保全拡張は対象外。context-checkはPlan directly、実装未着手。

[material-interface-wave-plan.md](material-interface-wave-plan.md): ユーザー了承の実装計画。共有契約準備→Wave 1 A/B並列→Wave 2統合。技術レビューとUser Gateは別。

[material-interface-contract.md](material-interface-contract.md): 共有契約をroot受領、独立技術PASS。Wave 1 A/Bを並列起動。機能統合とUser Gateは未実施。

[素材インターフェース Wave 1 A](experiments/material-interface-wave-1-a-completion.md) / [Wave 1 B](experiments/material-interface-wave-1-b-completion.md): 両domainの独立技術PASSをroot受領。Wave 2 C (/root/material_wave2) を起動し、AIコマンドから比較・候補編集・保存再読込まで統合中。実素材/User Gateは未実施。
[素材インターフェース Wave 2 completion](experiments/material-interface-wave-2-completion.md): root受領済み。独立技術PASS（headless統合・保存互換）、156 tests。AI向け10コマンドと比較・候補編集・保存を統合。Editor本体storage reader再読込は確認済み、Editor UI/比較viewer実操作・実素材/User Gateは未実施。現在の残件はwave plan末尾を参照。
[首素材補完と参照Face-Xの制作](experiments/reference-face-x-material-completion.md): 実素材をroot自身が生成・配置・riggingし、別保存モデルrevision781と同位置比較を提示。ツール実装の技術PASSと区別し、外観のユーザー判断は未取得。比較はlocalhost:8770。

- 2026-09-27: Face-Y mild-down-v2 / revision1218をユーザー承認。次工程はBody-X参照生成。既存SolのBody-Xデフォーマ構造は破棄して再制作可能。Face-X/Yは維持。候補と生成条件は second-rigging-6-sol/reference-generation/body-x/、同位置比較 http://127.0.0.1:8770/body-x/ 。Body-X参照v1は確認待ち、rig未着手。

- 2026-09-27: [Body-X参照と手作業rig試作](experiments/body-x-reference-rig.md) — 通常衣装の画面右向き、独立12デフォーマ。revision1281、ユーザー外観確認待ち。Face-X/Y保持、反対向き未制作。

- 2026-09-27: [弱いBody-Xのrig](experiments/body-x-reference-rig.md) — 参照v3承認後に最大姿勢を再造形。revision1305、外観確認待ち。

- 2026-09-27: [Body-X反対側のrig](experiments/body-x-reference-rig.md) — 参照承認後に負側を追加。revision1329、正側承認済み・負側外観確認待ち。左右連続再生あり。

- 2026-09-27: [Body-X首追従の撤回](experiments/body-x-reference-rig.md) — 左右とも首Body-Xデフォーマを除去。revision1330、確認待ち。

- 2026-09-27: Body-X revision1330をユーザー承認。[Face-Z参照のすり合わせ](experiments/face-z-reference.md)へ。画面右へ首をかしげた候補v1の確認待ち。Body-Zは後続。
