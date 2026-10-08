# Wave105 — Final Clean Integration Review (Review-Sylph, opus)

- Reviewer role: Review-Sylph（最終クリーン統合レビュー、読み取り専任）、delegated by Orch-Sylph（Wave105 Domain B）
- Scope: 統合視点での独立検証。Domain A 個別レビュー3本（spec-compliance / design-development / test-adequacy）は既に pass。本レビューは wave 全体の統合健全性・Required checks の再現・成果物完備性を独立に確認する。
- Source of truth: `discussion/implementation/orchestration/wave105-plan.md` §3.1 / §6 / §7 / §8 / §9 / §10 / §12
- Basis 読了: wave105-plan、Domain A ドメイン報告、Gnome report 2本、Domain A レビュー3本、および対象実装/テスト/artifact ファイルの直接読解 + Required checks 自己実行。
- Undine（L0）確定済み分類1〜4 を適用（cmo3 偽陽性 / clean HEAD 先行 fail / L0 運用文書の working-tree 変更 / wave104 由来の未コミット共存）。これらは違反として蒸し返していない。

## 総合判定: **pass**

Wave105 Domain A の実装は統合視点でも健全である。①snapshot レベルのゲート適用により render / 測量 / framing が単一の gated snapshot を共有し、②空ケースは identity return で構造的にバイト不変が保証され、③P5 gap 修正の新規ユニットテストは vacuous でなく visible-only 契約を固定し、④サイドカー / 測量コマンド結果に解決済み variantSelections が記録される。Required checks はすべて自己実行で再現できた（focused テスト 241 passed、root/app tsc exit 0、source-organization pass、check-dependencies は cmo3 分類1のみ、git diff --check clean、forbidden-scope diff 空、lockfile/package.json 無変更）。成果物は計画 §10 の Domain A 分が完備。

ブロッカーはゼロ。非ブロッキングの観測事項を1件記録する（`ref-measurement-gate.json` に関する報告書表現の軽微な不正確さ。要件・実装・テストは満たされているため pass 判定に影響しない）。

## 1. Required checks の再現的確認（自己実行の証跡）

| Check | コマンド | 結果 | 判定 |
|---|---|---|---|
| focused テスト | `npx vitest run apps/authoring-host packages/ai-interface packages/render-software` | **40 files / 241 passed / 0 failed**。ref e2e 7 tests に「6 pass / 9 blocked ゲート」「Rodos override」「unknown variant reject」を含む。 | pass |
| root tsc | `npx tsc --noEmit` | **exit 0** | pass |
| app tsc | `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | **exit 0** | pass |
| source-organization | `node scripts/check-source-organization.mjs` | `Source organization guard passed.`（exit 0） | pass |
| dependencies | `node scripts/check-dependencies.mjs` | cmo3（pnpm-lock.yaml Cubism パーサ依存クラス）**1 件のみ** = 分類1（line 2486 既知先行偽陽性）。lockfile 無変更につき wave105 由来の新規 finding ゼロ。 | pass |
| whitespace | `git diff --check` | **exit 0**（whitespace error ゼロ）。LF→CRLF 警告のみ = 分類無視対象。 | pass |
| forbidden-scope diff | `git status --porcelain -- packages/runtime-core packages/authoring-core packages/render-software packages/render-webgl2 packages/operation-core packages/validator-core packages/package-format apps/editor apps/runtime-player ref/` | **空**（clean） | pass |
| lockfile / package.json | `git status --porcelain -- pnpm-lock.yaml packages/ai-interface/package.json package.json` | **空**（3ファイルとも無変更、`pnpm install` なし） | pass |
| boundary 非緩和 | grep `from "@private-2d-rigging-lab/package-format"` in `packages/ai-interface/src/ai-variant-selection.ts` | **ヒットゼロ**（type import 含め package-format を import しない。id パターンはインライン宣言）。 | pass |

- テスト数 241 = Domain A 報告の 239（元 80+122+37）+ P5 修正の +2（`evaluated-bounds.test.ts` 2 tests）。整合。

## 2. 統合健全性（統合視点での破綻検査）

### 2.1 単一 gated snapshot の共有配線 — **pass**

`evaluation-adapter.ts` の `applyVariantVisibilityGate`（:99-135）が `base visible && predicate(drawableId)` を合成した**新規 snapshot**（drawables re-map + drawList 再導出、runtime-core 結果は非破壊）を返し、`evaluatePerceptionSnapshot`（:66-89）がこれを単一 snapshot として返す。この単一 snapshot を:

- **render**: `render-view-command.ts:60-70` で variant を1回解決 → base 評価 → `createPerceptionRenderScene(base.snapshot)`（:89-93）。sweep セルも同じ `variant.activeSelections` で gate（:124-131）。
- **測量**: `measurement-command.ts:41-49` で同じ resolver を通し、`evaluatePerceptionSnapshot(..., variantSelections: variant.activeSelections)` の snapshot から bounds / visible を読む。
- **framing**: `view-resolution.ts:58` `modelEvaluatedBounds(input.snapshot)` / `:76` `evaluatedDrawableBounds(input.snapshot, ...)` が同じ snapshot を消費。

が消費する。render と測量は独立に resolver を呼ぶが、両者とも `session.graph.variantGroups` + 同一 payload から決定論的に同一の resolved 形へ解決するため、目・巻尺・枠が同一可視性世界を見る構造が保たれている。runtime-core は非変更（forbidden-scope diff 空で実証）。

### 2.2 空ケース不変の構造保証 — **pass**

`applyVariantVisibilityGate` は `variantGroups.length === 0` で**入力 snapshot をそのまま return**（:104-109、参照同一）。ゲート導入前後で snapshot オブジェクトが参照同一のため、旧挙動とのバイト同一が構造的に保証される（テスト依存でなくコード構造で保証）。既存 golden 全 pass（`render-view-file-output.test.ts` の byte-identical、ref e2e determinism）がこれを実証。

### 2.3 P5 gap 修正の実効性（visible-only 契約の固定）— **pass**

`evaluated-bounds.test.ts`（新規）を直接読解して vacuous でないことを確認:

- テスト1（:77-103）は可視 drawable を `[0,10]²`、`visible:false` の drawable を可視 union の**bbox 外** `[100,120]²` に配置し、`expect(bounds).toEqual({ x:0, y:0, width:10, height:10 })` を assert。`modelEvaluatedBounds`（`evaluated-bounds.ts:121-128`）の `.filter((drawable) => drawable.visible)` を除去（union-all に revert）すると rect が `width/height:120` に広がり赤化する構造 → mutation-detecting。
- テスト2（:105-125）は全可視時の union 不変（gate-free framing 回帰防止のペア）。

隠れ drawable を意図的に可視 union の外へ置く設計により、Test Adequacy レビューが指摘した co-located 問題（eye/eye-mask が同一領域に重なり union が縮まらない）を回避しており、実際に visible-only vs union-all の差が rect に現れる。Gnome fix report の mutation 実証（filter 除去でテスト1赤化・即復元・git 残渣ゼロ）とも整合。mutation プローブの再注入は不要と判断（コード構造から実効性が明白であり、Test Adequacy レビューが既に P5 プローブ実施・復元済み）。

### 2.4 サイドカー / 測量への解決済み selection 記録 — **pass**

- render サイドカー: `render-view-command.ts:111,181` で `variant.resolved` を両 call site から `buildRenderViewSidecar` に渡す。ref 実 artifact 3本（`ref-rest-full` / `ref-face-focus` / `ref-eyes-viewport`.render-view.json）すべてが `variantSelections: [{kind:"singleSelect", variantGroupId:"vgrp_expression", variantId:"var_expression_default"}]` を記録（:778-783 で確認）。
- 測量コマンド結果: `measurement-command.ts:77` で `variantSelections: variant.resolved` を結果に載せ、:105 で per-drawable `visible: drawable.visible`（gated）を載せる。ref e2e `:454` が Rodos override 時の `rodosResult.variantSelections` を assert。

## 3. 成果物完備性（計画 §10 Domain A 分）— **pass**

| Expected artifact | 存在 |
|---|---|
| `wave105-domain-a-variant-visibility-gate-report.md`（プロトコル観測含む） | あり（§5 に artifact-wait 観測記録） |
| Gnome report 2本（`wave105-domain-a-gnome-report.md` / `-gnome-fix-report.md`） | あり |
| レビュー3本（spec-compliance / design-development / test-adequacy） | あり（すべて pass、Test Adequacy は needs_fix→修正後 pass） |
| ref-render-gate 再生成 PNG3枚 + サイドカー + README | あり（`ref-rest-full.png` / `ref-face-focus.png` / `ref-eyes-viewport.png` + 3 render-view.json + `ref-measurement-gate.json` + README.md） |

- §7 Domain B の Required check「§3.2 プロトコル実験の観測結果が Domain A 報告書に記録されていること」→ Domain A 報告 §5 に L0 中継 0 回・二重チャネル確認・張り直しコスト等が記録済み。確認。
- 本レビューファイル（`wave105-final-clean-integration-review.md`）の出現で §10 の Domain B 分の一部を満たす。残る Domain B 成果物（`wave105-final-integration-report.md`、waves/reviews/orchestration の `_map.md` 更新）は Orch-Sylph（Domain B）の担当作業として申し送る（本レビューのスコープ外）。

## 4. 残リスク・目視 gate

- **ユーザー目視 gate（次アクション）**: 再生成 PNG 3枚（`ref-rest-full.png` / `ref-face-focus.png` / `ref-eyes-viewport.png`）を Default 衣装で確認すること。`ref-rest-full` は framing が 392×1024→389×1024 に締まり（隠れ衣装 drawable が枠を広げなくなった）、`ref-face-focus` は重畳衣装レイヤーがフレームから除去、`ref-eyes-viewport` はバイト不変（viewport が衣装 drawable を含まないため。サイドカーに variantSelections 記録が追加されただけ）。計画 §3.4 の通り wave104 の不完全版（約9 drawable 余分描画）を置換する。
- **決定論バイト一致**: ref e2e の fresh-dir 再レンダリング 2回バイト一致テストが緑（本レビューの focused テスト実行で pass）。variant selection のシリアライズは `variantGroupId` で localeCompare ソートされ決定論を乱さない。維持されている。
- ブロッカーはゼロ。

## 5. 非ブロッキング観測事項

1. **`ref-measurement-gate.json` の報告書表現の軽微な不正確さ（非ブロッキング）**: Domain A 報告 §4 / Gnome 報告 §5 は「3サイドカー + `ref-measurement-gate.json` は全て `variantSelections: [...]` を記録」と述べるが、実ファイルの `ref-measurement-gate.json`（スキーマ `ref-measurement-gate-v1`）には**トップレベル `variantSelections` フィールドが存在しない**。この artifact の wave105 差分は per-drawable `"visible": true` フラグが3箇所追加されただけ（`git diff` で確認）で、これは計画 §3.1「測量にゲート後可視性フラグを含める」要件の artifact レベル実証として正しい。face/eye 3 drawable は Ware グループの target ではないため常に可視で `visible: true` が正しい。**計画の要件「測量結果に解決済み selection を記録」は `inspectEvaluatedGeometry` のコマンド結果 `InspectEvaluatedGeometryResult.variantSelections`（`measurement-command.ts:77`、ref e2e `:454` で assert 済み）で満たされている**ため、この不正確さは要件・実装・テストの破綻ではなく報告書の記述のみの問題。3つの render サイドカーには正しく variantSelections が記録されている。修正不要だが、将来 `ref-measurement-gate-v1` スキーマにトップレベル variantSelections を含めたい場合は別途 artifact 形式の拡張が必要。

2. （継続 note）ref サイドカーの `packagePath`/`pngPath` は machine-absolute（wave104 由来の既知 non-blocking note C-DEV-N-01）。on-disk determinism テストは `pngPath` を除外して比較。継続。

3. （継続 note）合成フィクスチャが `base.session.graph.variantGroups` を直接代入で組む（operation-core commit 経由でない）が、`VariantGroupSchema` で parse 済み・test-support 限定・variant 編集操作が out of scope（計画 §12）のため許容。Test Adequacy レビュー §Secondary と同意見。

## 6. 質問（Orch-Sylph 宛）

1. **`ref-measurement-gate.json` の variantSelections 記述**: §5-1 の通り、報告書が主張する「measurement-gate.json への variantSelections 記録」は実ファイルに存在しない（コマンド結果には記録あり、要件は満たされている）。これを (a) 報告書の記述誤りとしてそのまま（実害なし・修正不要）扱うか、(b) `ref-measurement-gate-v1` artifact にもトップレベル variantSelections を追記して報告書と一致させるか、Orch-Sylph（Domain B）の判断を仰ぎたい。本レビューは (a) を推奨（要件は既に満たされ、artifact 拡張は追加スコープを生むため）。pass 判定はいずれでも変わらない。

2. **Domain A スコープ外2ファイルの帰属**: Domain A レビュー（Design/Development §質問1）と Domain A 報告 §7 が、`.claude/skills/implementation-orchestration/SKILL.md` と `discussion/model-authoring/research/delegation-calibration-log.md` の working-tree 変更を Orch/L0 の実験統制記録と推定し帰属確認を求めている。Undine（L0）確定済み分類3で「L0 の運用文書・wave スコープ外・非ブロッキング・Domain A の scope 逸脱ではない」と裁定済みのため、本レビューはこれを違反として扱わない。コミット分割時にこの2ファイルを Domain A/B のどのコミットに含める（あるいは別コミットにする）かは Orch-Sylph（Domain B）のコミット構成判断事項として申し送る。

## 7. 実行した検証の完全復元証明

- すべて読み取り専用実行（vitest run / tsc --noEmit / check スクリプト / git status/diff）。本番コード・テストの変更なし。
- ref e2e はテスト内で `ref-render-gate/` に書き込むが、既存の Gnome 生成内容と決定論一致のため差分なし。
- mutation プローブは実施していない（コード読解 + Required checks 再実行で足りると判断。Test Adequacy レビューが既に P1〜P5 プローブを実施・復元済み）。
- 書き出したファイルは本レビューレポート（`discussion/implementation/reviews/wave105/wave105-final-clean-integration-review.md`）1本のみ。
