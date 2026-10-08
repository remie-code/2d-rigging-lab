# Experiments

## 最新の制作状況（2026-09-27・Body-Z両側受領）

通常衣装のFace X/Y/Z・Body X/Zの両方向の主要な姿勢造形が揃い、現行統合モデルはbody-z/package revision1967。Body-Zは承認済み片側から反対側を直接制作し、ユーザーが受領。方法・判断・成果物・残る最終確認は[Body X・Zの教訓](body-x-z-lessons.md)を参照。以下の確認待ち・未制作という記述は当時の履歴。


## 現在の到達点（2026-09-27）

- [弱めたFace-Y下向きrig](face-y-mild-downward-rig.md)：新参照v5承認後、revision1218を制作。X・上向きと独立性を保持。左右斜めとZ/Bodyの代表合成を確認、今回の外観判断待ち。

- [Face-Y下向き参照の再検討](face-y-downward-reference.md)：Editorで他変位と合成した際の崩れを受け、俯きを弱めたv3を生成。新参照の確認待ち。モデルrevision1176は保持。

- [Face-Y下向きrig](face-y-downward-rig.md)：参照v1を承認後、候補v3 / revision1176。垂れる前の房と後ろ髪の追随を修正し、髪全体の同位置比較を追加。Xと上向きを保持。外観判断待ち。

- [Face-Y下向き参照](face-y-downward-reference.md)：v1を生成。正面・下向き候補・承認済み上向きrigの同位置比較を提示。ユーザー承認後、下向きrig制作へ進んだ。

- [Face-Y上向きrig](face-y-upward-rig.md)：v3 / revision1112。Xとは独立したYデフォーマで制作、X保持を確認。上向きと斜めを同位置比較・再生で提示し、ユーザーが「完璧」と承認。次は下向き。

- [Face-Y上向き参照の初回試行](face-y-reference-generation.md)：v2は上向きすぎ、v4はもう少し上を向けたいとのユーザー判断。v4から少し上向きを増したv5を提示。正面・v5・v4の同位置比較あり。v5を上向き最大姿勢の目標としてユーザー承認。承認後の位置合わせと制作はFace-Y上向きrig記録へ。

- [目にかかる髪の調整の教訓](hair-occlusion-lessons.md)：負方向v5 / revision1036の修正をユーザーが「完璧」と評価。左右の明示、非表示による原因特定、目の露出と毛束の連続性を記録。

- [帽子再造形の教訓](hat-rebuild-lessons.md)：v20 / revision967の帽子をユーザーが高く評価。曲率・耳の見える面・旧変位からの再制作・滑らかさを、実装事実と考察に分けて記録。
- [首素材補完と参照Face-X](reference-face-x-material-completion.md)：顔の動き・首・帽子の外観承認を取得。対象は通常衣装・閉じ口・正方向Face-X。技術全体PASSと他軸の完成は含まない。

以下の「現在」「進行中」「未判定」は各段階での履歴。最新判断は上記記録を優先する。

| 記録 | 内容 | 状態 |
|---|---|---|
| [face-x-reference-generation.md](face-x-reference-generation.md) | 元素材、最大、中間v1/v2、ユーザー評価、未解決 | 記録済み |
| [face-x-registration.md](face-x-registration.md) | 身体を基準にした位置・大きさ合わせ、比較と変換行列 | 同位置切り替え表示後、次工程へ進むユーザー承認済み |

実験ごとに入力・再現方法・観測・エージェント判断・ユーザー判断を分離する。隣接フロー候補を提示する段階。二つの生成参照をrigへ適用した実験はまだない。

## Wave記録

- [Wave 2 completion](optical-flow-wave-2-completion.md): 実参照2条件・統合・独立technical review PASS、root目視済み、User Gate待ち。

- [Wave 1 A completion](optical-flow-wave-1-a-completion.md): 環境・計算基盤・独立CUDA/技術review PASS。

- [Wave 1 B completion](optical-flow-wave-1-b-completion.md): 人工fixtureの比較ビュー・独立review PASS。実参照のUser Gateは未実施。

## 進行中

[隣接フローのwave計画](../optical-flow-wave-plan.md)に従い、Wave 1 A/B・Wave 2 Cのtechnical PASSを受領。実画像ビューをユーザーへ提示。User Gateは未判定。

- [棄却前推定の表示](optical-flow-raw-view-completion.md): source・関連試験・実artifactの独立レビューPASS。rootが両解像度を目視。独立browser検証は環境不可。推定採用/User Gateは未判定。

## 点・輪郭による変形試作（最新）

- [Wave 1 A completion](landmark-warp-wave-1-a-completion.md): 素材抽出・指定契約の独立技術PASS。rootの実画像指定候補-2を目視済み、Gate 1未承認。
- [Wave 1 B completion](landmark-warp-wave-1-b-completion.md): 計算・描画の人工試験と独立レビューPASS。実画像guided未実行。
- [Wave 1 C completion](landmark-warp-wave-1-c-completion.md): 比較表示の内部19試験PASS。独立browserは環境不可、rootの実scene目視とは区別。

次は指定候補を同位置切替で提示するGate 1。[計画](../landmark-warp-wave-plan.md)に従い、承認前にWave 2を起動しない。
- [Wave 2 D進捗](landmark-warp-wave-2-completion.md): 承認入力から4出力・比較sceneまで技術PASS。初回失敗を保持、v2主提示。root目視で自然さ未達、Gate 2未承認。
- [manual-midpoint-completion.md](manual-midpoint-completion.md): root指定の部品別手動変形v4。首・後ろ襟を修正、3段階画像と同位置比較。ユーザー外観判断待ち。

- [material-interface-contract-completion.md](material-interface-contract-completion.md): 素材インターフェース共有契約、独立Review PASS、root受領済み。Wave 1 A/B開始。

- [material-interface-wave-1-a-completion.md](material-interface-wave-1-a-completion.md): 素材取得・PNG・位置合わせ・候補保存・配置比較、独立技術PASS Loop 2、56 tests。root受領済み。
- [material-interface-wave-1-b-completion.md](material-interface-wave-1-b-completion.md): 素材追加/置換・再mesh・共有参照guard、独立技術PASS、関連を含む101 tests。root受領済み。Wave 2統合中、User Gate未実施。
- [material-interface-wave-2-completion.md](material-interface-wave-2-completion.md): root受領済み。素材コマンド統合・保存互換の独立技術PASS、156 tests。Editor UI/比較viewer実操作・実素材/User Gateは未実施。

- [首素材補完・参照Face-X](reference-face-x-material-completion.md): rootが素材生成、新APIで置換し、保存モデルの中間/最大キーを制作。31頭部姿勢＋7全身、同位置比較の実操作確認。ユーザー外観判断待ち、strict検査には残件あり。


## 反対向きの制作開始（2026-09-27）

- [反対向きFace-Xの参照](negative-face-x-reference.md)：参照v1をユーザー承認。顔rig候補v5 / revision1036を制作し、同位置切替と途中姿勢を提示。中央の前髪に続き、キャラクター右目を覆う長い毛束を調整。修正前比較あり。目にかかる髪の修正はユーザー承認済み。帽子等は仮配置を含む。

- 2026-09-27: Face-Y mild-down-v2 / revision1218をユーザー承認。次工程はBody-X参照生成。既存SolのBody-Xデフォーマ構造は破棄して再制作可能。Face-X/Yは維持。候補と生成条件は second-rigging-6-sol/reference-generation/body-x/、同位置比較 http://127.0.0.1:8770/body-x/ 。Body-X参照v1は確認待ち、rig未着手。

- 2026-09-27: [Body-X参照と手作業rig試作](body-x-reference-rig.md) — 通常衣装の画面右向き、独立12デフォーマ。revision1281、ユーザー外観確認待ち。Face-X/Y保持、反対向き未制作。

- 2026-09-27: [弱いBody-Xのrig](body-x-reference-rig.md) — 参照v3承認後に最大姿勢を再造形。revision1305、外観確認待ち。

- 2026-09-27: [Body-X反対側のrig](body-x-reference-rig.md) — 参照承認後に負側を追加。revision1329、正側承認済み・負側外観確認待ち。左右連続再生あり。

- 2026-09-27: [Body-X首追従の撤回](body-x-reference-rig.md) — 左右とも首Body-Xデフォーマを除去。revision1330、確認待ち。

- 2026-09-27: Body-X revision1330をユーザー承認。[Face-Z参照のすり合わせ](face-z-reference.md)へ。画面右へ首をかしげた候補v1の確認待ち。Body-Zは後続。
