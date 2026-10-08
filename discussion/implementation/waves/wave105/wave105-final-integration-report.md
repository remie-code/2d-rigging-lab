# Wave105 最終統合報告書（Orch-Sylph / Domain B: Final Integration / Clean Review / Map Closeout）

Verdict: **pass**

- Wave: Wave105 `variant-visibility-gate-perception`
- Domain B id: `wave105-final-integration-clean-review-map-closeout`
- 完遂役: Orch-Sylph（opus、Undine（L0）から委任）
- Source of truth: `discussion/implementation/orchestration/wave105-plan.md` §7 / §9 / §10
- 前提: Domain A は pass で完遂済み（`wave105-domain-a-variant-visibility-gate-report.md`）

## 1. Wave の二重目的とその達成

Wave105 は二重目的の小 wave であり、両方を達成した:

1. **Variant 可視性ゲートの知覚経路への組み込み**（機能目的）: 知覚評価（renderView / 測量 / フレーミング）に `base visible AND variantVisibilityPredicate(activeSelections)` の二層合成を snapshot レベルで適用。目（render）・巻尺（測量）・枠（framing）が単一の gated snapshot を共有する構成を実現し、wave104 の仕様伝達漏れ（Fable の視覚とユーザーの視覚の不一致）を解消した。
2. **Artifact-Wait プロトコルの実戦実証**（統制実験目的）: Orch-Sylph が L0（Undine）中継なしでドメインループを完走できるか、成果物待ちプロトコルで実測。**L0 中継 0 回**で Domain A ループ全体（引き継ぎ → レビュー3レーン並列 → 判定 → 修正委任 → 再検証 → 報告）を単一の在席継続で完走。Domain B（本ドメイン）でも最終クリーンレビュー委任を待機ループ1回・張り直しゼロで回収。プロトコルの設計目標を実証した（詳細は §5）。

## 2. Domain A 成果の要約（統合視点）

- 実装頂点: `apps/authoring-host/src/perception/evaluation-adapter.ts` の `applyVariantVisibilityGate` が `base visible && predicate(drawableId)` を合成した新規 snapshot（drawables re-map + drawList 再導出、runtime-core 結果は非破壊）を返す。
- authoring-core の純関数 `createVariantVisibilityPredicate` / `resolveDefaultVariantActiveSelections` を消費（再実装なし）。runtime-core は variant 非認知のまま（設計通り）。
- `renderView` / `inspectEvaluatedGeometry` に optional `variantSelections` payload（共有 zod shape）を追加。省略時 = defaultActive、不正参照（未知 group / variant、mode 不一致）は決定論的 reject。
- 解決済み selection を render サイドカー・測量コマンド結果に記録。測量結果は per-drawable の gated `visible` フラグも載せる。
- ref 目視 gate PNG 3枚を Default 衣装で再生成（wave104 の約9 drawable 余分描画を含む不完全版を置換）。

## 3. Required checks 結果（Domain B、自己実行 + 独立レビュー再現）

| Check | 結果 | 判定 |
|---|---|---|
| Domain A report 存在・verdict | `wave105-domain-a-variant-visibility-gate-report.md` = **pass** | pass |
| Gnome 報告 2本 | `wave105-domain-a-gnome-report.md`（complete）/ `-gnome-fix-report.md`（P5 修正） 存在 | pass |
| Domain A レビュー3本 | spec-compliance = pass / design-development = pass / test-adequacy = needs_fix→修正後 pass | pass |
| focused テスト | `npx vitest run apps/authoring-host packages/ai-interface packages/render-software` = **40 files / 241 passed / 0 failed**（ref e2e の 6/9 ゲート・Rodos override・reject・決定論2回バイト一致含む） | pass |
| root tsc | `npx tsc --noEmit` = **exit 0**（出力空） | pass |
| app tsc | `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` = **exit 0**（出力空） | pass |
| check-source-organization | `Source organization guard passed.`（exit 0） | pass |
| check-dependencies | cmo3（pnpm-lock.yaml）**1件のみ** = 既知先行偽陽性（分類1）。lockfile 無変更につき wave105 由来の新規 finding ゼロ | pass |
| git diff --check | whitespace error **0件**（LF→CRLF 警告のみ、無視対象） | pass |
| Forbidden-scope diff | runtime-core / authoring-core / render-software / render-webgl2 / operation-core / validator-core / package-format / apps/editor / apps/runtime-player / ref/ = git status **空** | pass |
| boundary 非緩和 / 新規依存ゼロ | ai-interface package.json / pnpm-lock.yaml / root package.json 無変更。ai-variant-selection.ts は package-format を import せず（id パターンをインライン宣言） | pass |
| §3.2 プロトコル観測記録 | Domain A 報告 §5 に L0 中継 0 回・二重チャネル確認・張り直しコスト等が記録済み | pass |
| 最終クリーン統合レビュー | 独立 Review-Sylph（opus）= **pass**（ブロッカーゼロ、Required checks を独立自己実行で再現） | pass |

テスト数 241 = Domain A 報告の 239（元 80+122+37）+ P5 修正の +2（`evaluated-bounds.test.ts`）。整合。

## 4. Undine 確定済み分類の適用

本 Domain B は Undine（L0）確定済みの分類を判定に適用した（これらを違反として蒸し返していない）:

1. **cmo3 finding** = pnpm-lock.yaml line 2486 の既知先行偽陽性。Wave105 由来の新規 finding ゼロ（lockfile 無変更を git status/diff で実証）。
2. **clean HEAD 起因の先行 fail**（runtime-core 2 failed 等）= 既知の無関係失敗。本 wave のスコープ外（focused スイートは全 pass）。
3. **`.claude/skills/implementation-orchestration/SKILL.md` / `discussion/model-authoring/research/delegation-calibration-log.md` の working-tree 変更、および `discussion/model-authoring/**` の地図・research 更新** = Undine（L0）の運用文書（待機プロトコル統制実験の記録）。wave スコープ外・非ブロッキング。Domain A の scope 逸脱ではない。
4. **wave104 由来の未コミット変更が working tree に共存**。git status で wave104 由来と wave105 由来が混在していても違反ではない（Domain A レビューが wave105 由来分の scope 遵守を確認済み）。

## 5. Artifact-Wait プロトコル観測（Domain B 分の追加データ）

Domain A の観測記録（報告 §5）に加え、Domain B での観測:

- **最終クリーンレビュー委任**: Review-Sylph（opus）を起動後、PowerShell フォアグラウンド待機ループ（20 秒間隔ポーリング、8 分デッドライン）で在席。**待機ループ1回・張り直しゼロ**でレポートファイル（`wave105-final-clean-integration-review.md`、14881 bytes）の出現をターン内検知して回収、同一の在席継続でレビュー verdict を判定。
- **L0（Undine）中継は 0 回**（Domain B でも）。
- 二重チャネル: フォアグラウンド待機ループのファイル出現検知が機能。子の completion notification も配達され、どちらか一方が欠けてもデッドロックしない構成を Domain B でも再確認。
- 想定外挙動: なし。プロトコルは想定通り機能した。

**プロトコル実戦の総括**: Wave105 全体（Domain A + Domain B）を通じて L0 中継 0 回、死亡推定 0 回、沈黙・遅延を理由とする再起動・代替作業 0 回。artifact-wait プロトコル（SKILL.md 規則 1-3 最新版）は実戦で機能し、Orch-Sylph が L0 中継なしでドメインループを完走できることを二度（Domain A・Domain B）実証した。

## 6. 残リスク

- **ブロッカーはゼロ。**
- 非ブロッキング（最終クリーンレビュー §5-1）: `ref-measurement-gate.json` について、Domain A 報告 §4 / Gnome 報告 §5 は「measurement-gate.json も variantSelections を記録」と述べるが、実ファイル（スキーマ `ref-measurement-gate-v1`）にはトップレベル `variantSelections` フィールドが存在しない。計画 §3.1 の「測量にゲート後可視性フラグを含める」要件は per-drawable `visible` フラグの追加（3箇所）で artifact レベルに実証されており、「測量結果に解決済み selection を記録」要件は `inspectEvaluatedGeometry` のコマンド結果 `InspectEvaluatedGeometryResult.variantSelections`（`measurement-command.ts:77`、ref e2e で assert 済み）で満たされている。**要件・実装・テストの破綻ではなく報告書記述のみの軽微な不正確さ**。3つの render サイドカーには正しく variantSelections が記録済み。**裁量結論（推奨 (a) を採用）**: 実害なく要件充足済みのため artifact 拡張（追加スコープ）は行わず、報告書記述の問題として本報告書に明記して閉じる。将来 `ref-measurement-gate-v1` にトップレベル variantSelections を含めたい場合は別途 artifact 形式拡張が必要。
- 継続 note: ref サイドカーの `packagePath` / `pngPath` は machine-absolute（wave104 由来の既知 non-blocking note C-DEV-N-01、on-disk determinism テストは pngPath 除外で比較）。合成フィクスチャの variantGroups 直接代入（VariantGroupSchema parse 済み・test-support 限定・variant 編集操作は out of scope §12）は許容。

## 7. 次アクション: ユーザー目視 gate（PNG 3枚の確認）

**Wave105 の次アクションはユーザーによる目視 gate である。** 再生成された ref 目視 gate PNG 3枚を Default 衣装で確認すること:

- `discussion/model-authoring/experiments/ref-render-gate/ref-rest-full.png` — model-bounds framing が 392×1024 → 389×1024 に締まった（隠れ衣装 drawable が枠を広げなくなったため）。
- `discussion/model-authoring/experiments/ref-render-gate/ref-face-focus.png` — 重畳衣装レイヤーがフレームから除去。
- `discussion/model-authoring/experiments/ref-render-gate/ref-eyes-viewport.png` — バイト不変（viewport が衣装 drawable を含まないため。サイドカーに variantSelections 記録が追加されただけの consistency signal）。

3枚とも Ware グループが Default 衣装（`var_expression_default`）に解決された状態で描画されている。これが wave104 の不完全版（約9 drawable 余分描画）を置換する正しい目視基準である。決定論バイト一致（fresh-dir 2回レンダリング）は維持されている。

## 8. コミット構成の申し送り（Undine へ）

git working tree には wave105 実装スコープ、L0 運用文書、wave104 由来の未コミット変更が混在している（分類3・4）。コミット分割時の帰属方針は Undine（L0）の判断事項として申し送る:

- **Wave105 Domain A 実装スコープ**（コミット対象）: `apps/authoring-host/src/perception/**`（evaluation-adapter, evaluated-bounds, measurement-command, render-view-command, render-view-sidecar, variant-selection-resolution + 各テスト, variant-visibility-gate.test, evaluated-bounds.test）、`apps/authoring-host/src/ref-e2e.test.ts`、`apps/authoring-host/src/test-support/perception-fixtures.ts`、`packages/ai-interface/src/ai-{variant-selection,render-view-command,measurement-command}.ts` + index.ts + ai-variant-selection.test.ts、`discussion/model-authoring/experiments/ref-render-gate/**`（再生成 PNG + サイドカー + README）。
- **Wave105 discussion 成果物**（コミット対象）: `discussion/implementation/orchestration/wave105-plan.md`、`discussion/implementation/waves/wave105/**`、`discussion/implementation/reviews/wave105/**`、`discussion/implementation/orchestration/_map.md`（Wave105 エントリ更新）、`discussion/model-authoring/research/variant-feature-survey.md`。
- **L0 運用文書**（分類3、帰属は Undine 判断）: `.claude/skills/implementation-orchestration/SKILL.md`、`discussion/model-authoring/research/delegation-calibration-log.md`、`discussion/model-authoring/_map.md`。これらは待機プロトコル統制実験の記録であり Domain A/B の実装とは別関心。Wave105 のコミットに含めるか別コミットにするかは Undine の裁量。
- **wave104 由来の未コミット変更**（分類4）: 既存の混在分。Domain A レビューが wave105 由来分の scope 遵守を確認済み。

## 9. 質問（Undine への確認事項）

1. **`ref-measurement-gate.json` の variantSelections 記述**（§6・最終クリーンレビュー §6-1）: 報告書が主張する「measurement-gate.json への variantSelections 記録」は実ファイルに存在しない（コマンド結果には記録あり、計画要件は充足）。Orch-Sylph（Domain B）は推奨 (a)「報告書記述の問題として実害なく閉じる、artifact 拡張はしない」を採用済み。pass 判定はいずれでも不変だが、もし Undine が (b)「`ref-measurement-gate-v1` にトップレベル variantSelections を追記して報告書と一致させる」を望む場合は追加の狭い follow-up が必要（別 wave / 別委任）。Undine の追認を仰ぐ。
2. **L0 運用文書のコミット帰属**（§8）: 分類3の3ファイルを Wave105 コミットに含めるか別コミットにするかの最終判断を仰ぐ。

## 10. 総括

Wave105 は機能目的（Variant 可視性ゲート）と統制実験目的（artifact-wait プロトコル）の二重目的を両方達成し、Domain A pass + 最終クリーンレビュー pass で完遂した。全 Required checks 通過、Forbidden-scope 変更ゼロ、新規依存ゼロ。残るはユーザー目視 gate（PNG 3枚の Default 衣装確認）のみ。
