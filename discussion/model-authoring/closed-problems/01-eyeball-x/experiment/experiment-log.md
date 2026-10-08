# 閉問題 01 実験ログ — 眼球 X rigging 初実走（2026-07-03）

> 実行者: Fable（L0 直接、委任なし）。対象: `C:/workspace/remie/rigging/llm-rigging`（ユーザーが Editor で PSD インポート・保存・git init 済みの新規ワークスペース。ref と同一 PSD ソース）。

## 結果サマリ

**6 操作すべて headless CLI 経由で committed（revision 5 → 18、git 原子コミット 13 個）。**
検証は三段: スキーマ（dry-run 自動承認ゲート）/ 数値（inspectEvaluatedGeometry、設計値と小数点一致）/ 視覚（sweep コンタクトシート + 高倍率静止画、Fable 自身の目視）。
残るはユーザー gate（Editor スライダーでの動き確認）。

## 実行列（コマンドは commands/、レンダは renders/）

| # | 操作 | 対象 | rev | 備考 |
|---|---|---|---|---|
| 0 | validatePackage strict | — | 5 | **pass / error 0**（ref の 97 と対照的。新規インポートはクリーン） |
| 0 | renderView 全身 | — | 5 | **完全透明 391×1024** — 未リグ状態の正確な知覚（下記発見①） |
| 1 | generateMesh ×7 | irides-l/r, eyewhite-l/r（スコープ）+ face, eyelash-l/r（文脈用・スコープ拡張） | 6–12 | method `auto-outline-v6d-adaptive-contour-constrainautor` + `medium`（= Editor「Standard」プリセット） |
| 2 | createWarpDeformer ×2 | `rig_eyeball_l_warp` / `rig_eyeball_r_warp`、5×4 格子 | 13–14 | domain = 白目 bbox + 振幅16/上下5 のマージン |
| 3 | createParameter | ~~param_eyeball_x~~ | — | **reject（重複）→ 発見②: preset 常在**。無傷、やり直し不要 |
| 4 | editKeyformKey createEndsCenter ×2 | 両デフォーマ `controlPointOffsets` on `param_eyeball_x` | 15–16 | **移動±11 + 横幅×0.92 を一つの patch に畳み込み**（発見③） |
| 6 | setMaskRelation ×2 | eyewhite-l→irides-l, eyewhite-r→irides-r | 17–18 | 名前で対象同定。maskRelationId 自動導出 |

工程5（反対の眼）は 1/2/4/6 の中で両眼同時に消化。

## 設計値の導出（巻尺 → 行動の実例）

rest 実測: 虹彩 w53、白目 w70(L)/75(R)。遊び = 白目と虹彩の幅差 → **振幅 ±11 stage units**（はみ出しはクリッピングが刈る前提の審美設計）。横幅スケール 0.92（極値での遠近squash）。
オフセット計算式: `offset(p) = { x: T + (s−1)·(p.x − cx), y: 0 }`（cx = domain中心、p = restControlPoints の各点。**保存順に依存しない**）。

数値検証（inspectEvaluatedGeometry, overrides ±1）: 左端 1029.8 = 1073 − 0.92×35 − 11（理論値一致）、幅 52.44 = 0.92×57（一致）、y 不変、両眼同挙動。

## 発見（craft 蒸留候補）

1. **PSD インポート直後の全 drawable はプレースホルダメッシュ**（bounds のみ、頂点0）。全身レンダが完全透明になるのは正しい知覚。generateMesh が事実上の必須第一工程。
2. **標準パラメータは preset カタログに常在**（`packages/package-format/src/parameter-presets.ts`）。`param_eyeball_x`("Eyeball X", centered, max=画面右) 等はディスクの parameters.json が空でも存在する。createParameter はカスタム専用。**semantics（min=画面左）もカタログが定義済み** — 方向設計はカタログに従う。
3. **warpLattice2d に translation keyform は打てない**（`rigControl.translation` は rotation2d 専用。`linear-keyform-editing.ts:396`）。ワープデフォーマの平行移動は **controlPointOffsets への一様オフセット**として表現する。横幅スケールも同じ patch に線形合成できるので、**移動+スケールは 1 keyform set で済む**。api-requirements.md 工程4 の想定をここで訂正。
4. **マスクの効果は低倍率目視では弁別できないことがある**（まつげ遮蔽下のはみ出し）。検証はピクセル差分（今回 30,913 px 差で効果確定）か高倍率ズームで行う。目測に頼らない原則の実例。
5. Editor「標準プリセット」の実体 = `auto-outline-v6d-adaptive-contour-constrainautor` + `densityHint: medium`（`mesh-tool-state.ts:70`）。
6. 計測の bounds は rest では mesh.bounds（宣言値）、変形時は評価済み頂点範囲を返す（rest w53 vs 変形時基底 w57）。数値比較は同種同士で行うこと。

## 追記: 半目セットへの2周目再走（2026-07-03、閉問題02の前哨）

閉問題02（目の開閉）の準備として、半目セット（`表情 > 半目`、サフィックス2）に craft レシピ 01-03 を再適用 + 表示切替の足場（新レシピ 04）。

- **18 operations（足場6 + メッシュ6 + デフォーマ2 + キー2 + マスク2）、reject ゼロ、一発完走**（rev 18→36）。1周目の罠2件（preset パラメータ / translation 不可）はレシピの罠警告が事前回避——**自己完結性テストの実地合格**
- 部品構造の発見: Parts Container に PSD グループ名が残存（`表情 > 通常/半目/閉じ目/微笑み/微笑み閉じ/驚き/困り/上向き/下向き/怒り` の10表情）。part → partId → drawables.json フィルタで配下列挙可能
- `setRuntimeVisibility` は既存 operation（衣装差分6枚がインポート時から hidden という前例もパッケージ内に発見）
- 不変量の初適用: **視線の一致**（半目の振幅も ±11。眼窩の狭さはクリッピングに任せる）
- 数値検証: +1 で左端 1047.92 / 909.84 = 理論値一致、幅 53.36 = 0.92×58 両眼一致
- 実行系改善: run-batch.mjs（basePackageRevision を manifest から自動充填、revision 手動追跡を廃止）
- 終了状態: **半目が可視・通常の目6枚が hidden**（ユーザーの Editor 確認向け。gate 後にデフォルト表情へ復元予定）

## 運用面の記録

- ワークスペース外パッケージ（`--package-dir` 絶対パス指定）で全コマンド動作。コード変更ゼロ。
- ランナー: `apply-op.mjs`（dry-run → 自動承認確認 → commit の 2 プロセス、state-dir 共有で承認が持続）。全リクエスト/レスポンスは commands/ に保存。
- reject 2 回（duplicateParameter / unsupportedTargetProperty）はいずれも**無傷 reject → 原因調査 → 設計修正 → 再実行**で回復。dry-run ゲートが工程事故を完全に防いだ。
- TS 実行は `npx -y tsx`（リポジトリ非汚染）。
