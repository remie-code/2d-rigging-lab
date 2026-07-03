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

## 運用面の記録

- ワークスペース外パッケージ（`--package-dir` 絶対パス指定）で全コマンド動作。コード変更ゼロ。
- ランナー: `apply-op.mjs`（dry-run → 自動承認確認 → commit の 2 プロセス、state-dir 共有で承認が持続）。全リクエスト/レスポンスは commands/ に保存。
- reject 2 回（duplicateParameter / unsupportedTargetProperty）はいずれも**無傷 reject → 原因調査 → 設計修正 → 再実行**で回復。dry-run ゲートが工程事故を完全に防いだ。
- TS 実行は `npx -y tsx`（リポジトリ非汚染）。
