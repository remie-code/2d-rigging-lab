# Wave105 Domain A — Design / Development Review (Review-Sylph)

Reviewer: Review-Sylph (opus), delegated by Orch-Sylph.
Lane: Design / Development (wave105-plan §8).
Scope: read-only. No probes required; all findings established from the plan, survey, Gnome report, source files, git diff/status, and executed guard/test/tsc commands. Zero working-tree residue introduced (verified: the only tracked/untracked changes are the ones present before this review; I created only `discussion/implementation/reviews/wave105/` per the completion contract).

## 総合判定: **pass**

Domain A の実装は Design/Development 観点のすべての検証項目を満たす。authoring-core 純関数を消費（再実装なし）、runtime-core/authoring-core 無変更、ai-interface 依存境界の非緩和、write scope 厳守、命名規約・ソース組織準拠、設計整合（新 snapshot 返却・mutation なし・決定論ソート）を実測で確認した。needs_fix ゼロ。Orch-Sylph 向けに scope 外変更 2 ファイルに関する **確認事項（question）** を 1 件残す（Domain A 実装の可否には影響しない）。

## 各検証項目

### 1. authoring-core 純関数の消費（再実装なし） — **pass**

- `createVariantVisibilityPredicate` を `evaluation-adapter.ts:6,111` で authoring-core から import・消費。
- `resolveDefaultVariantActiveSelections` を `variant-selection-resolution.ts:2,53` で authoring-core から import・消費。
- predicate ロジック（membership 判定）も default 導出も host/ai-interface 内で再実装していない。`variant-selection-resolution.ts` は authoring-core の default を受け、payload override を **マージ・検証**するだけ（存在検証・mode 整合・重複検出）。default 導出そのものは純関数任せ。
- 根拠: `apps/authoring-host/src/perception/evaluation-adapter.ts:1-8,111-116`、`apps/authoring-host/src/perception/variant-selection-resolution.ts:1-2,52-53`。grep 全消費点確認済み（他に消費なし）。

### 2. runtime-core / authoring-core 無変更、runtime-core への variant 混入なし — **pass**

- `git status --porcelain -- packages/runtime-core packages/authoring-core ...` は空（forbidden scope clean、exit 0）。
- runtime-core への variant 概念混入なし: ゲートはアダプタ層（`evaluation-adapter.ts`）で runtime-core の評価済み snapshot を **read-only 入力**として受け、新 snapshot を組み立てる。runtime-core 側 API/型は不変更。
- 根拠: git status（項目 4 実証）、`evaluation-adapter.ts:70-88,99-135`。

### 3. boundary 非緩和 — **pass**

- `ai-variant-selection.ts` は `package-format` を import していない。grep 上の "package-format" ヒットは **すべてコメント/JSDoc**（`ai-variant-selection.ts:9,15,16,24,29`）、import 文はゼロ。
- id トークンパターンをインライン宣言（`ai-variant-selection.ts:22` `idTokenPattern = "[A-Za-z0-9_-]+"`、`^vgrp_...$` / `^var_...$`）。これは package-format の実定義（`packages/package-format/src/model-variants.ts:8,10-16`）と **文字列レベルで完全一致**しており、境界を破らずに同一契約をミラーしている。妥当。
- `packages/ai-interface/package.json` / `pnpm-lock.yaml` / root `package.json` はいずれも無変更（git status で対象パス空、diff 空）。新規外部依存ゼロ・`pnpm install` なし。
- dependency-boundary テスト pass: `packages/ai-interface/src/dependency-boundary.test.ts` 5 tests green。ai-interface フルスイート 122 tests green。
- 根拠: `packages/ai-interface/src/ai-variant-selection.ts:22-32`、`packages/package-format/src/model-variants.ts:8-16`、vitest 実行結果。

### 4. write scope 厳守 — **pass（実装スコープについて）**

- Forbidden scope（runtime-core / authoring-core / render-software / render-webgl2 / operation-core / validator-core / package-format / apps/editor / apps/runtime-player / `ref/`）は `git status --porcelain -- <各パス>` が空（exit 0）で clean を実証。
- 変更された実装/テスト/成果物はすべて Allowed scope（`apps/authoring-host/**`、`packages/ai-interface/src/**`、`discussion/model-authoring/experiments/ref-render-gate/**`、Domain A report ディレクトリ）に収まる。
- 根拠: 本レビューの git status/diff 実測（冒頭）。
- 注意点は項目「質問」を参照（Domain A 実装スコープ外の 2 ファイル）。

### 5. 命名規約・ソース組織 — **pass**

- `node scripts/check-source-organization.mjs` → `Source organization guard passed.`（exit 0）。
- `node scripts/check-dependencies.mjs` → cmo3（pnpm-lock.yaml の Cubism パーサ依存クラス）1 件のみ。これは計画 §7 で「line 2486 の既知先行偽陽性」として分類継続が明示されたもの。**本 wave で lockfile は無変更**（git diff/status で空）につき新規 finding ゼロ。
- 命名は周辺規約に整合: `resolveVariantSelections` / `VariantSelectionResolutionError` / `applyVariantVisibilityGate` は周辺（`measureEvaluatedGeometry`、`resolvePerceptionRenderView` 等）の動詞句・PascalCase 命名と一致。ソート実装 `localeCompare` は周辺の確立規約（`measurement-command.ts:71`、`render-view-sidecar.ts:29`、`texture-resolution.ts:84-105`、ai-interface 各所）に完全準拠。
- app tsc（`npx tsc --noEmit -p apps/authoring-host/tsconfig.json`）exit 0。
- 根拠: 上記コマンド実行結果、grep によるソート規約照合。

### 6. 設計整合 — **pass**

- 新 snapshot 返却・mutation なし: `applyVariantVisibilityGate`（`evaluation-adapter.ts:99-135`）は `drawables.map` で spread copy を作り、`{...input.snapshot, drawables, drawList}` を返す。runtime-core 結果は read-only 扱い（in-place 変更なし）。frozen/shared object 前提のコメントも設計意図を明示。
- gate-free 恒等: variantGroups 空/不在で早期 return（`evaluation-adapter.ts:104-109`）。空ケースがバイト不変であることを設計で保証。
- 決定論的シリアライズ: `variant-selection-resolution.ts:121-128` で `variantGroupId` により `localeCompare` ソート、`activeSelections` と `resolved` echo の両方が同順序。id は ASCII 制約（`[A-Za-z0-9_-]`）なので `localeCompare` でも安定。周辺規約と一致。
- framing の可視性世界共有: `modelEvaluatedBounds`（`evaluated-bounds.ts:121-128`）が visible-only union に変更。gate-free では全 drawable visible ゆえ旧挙動と同一、gated 時のみ差分。plan §3.1「目と巻尺と framing が同一可視性世界」に整合する妥当な精緻化（Gnome §7/§8 の自認と一致）。設計的に read-only・非破壊で問題なし。
- measurement `visible` フラグは drawable ブランチのみ・`found===true` 時のみ付与（`measurement-command.ts:98-110`）。variant gate は drawable 可視性概念なので rigControl に付けないのは適切。gated-hidden でもジオメトリは返り `visible:false` を報告（§3.1「黙らせない」に整合）。
- 根拠: `evaluation-adapter.ts:99-135`、`evaluated-bounds.ts:111-128`、`variant-selection-resolution.ts:121-144`、`measurement-command.ts:88-138`。

## 質問（Orch-Sylph 宛て・非ブロッキング）

1. **Domain A 実装スコープ外の 2 ファイルが working tree で変更されている**:
   - `.claude/skills/implementation-orchestration/SKILL.md`（規則 1-3 を artifact-wait ポーリングプロトコルへ改訂）
   - `discussion/model-authoring/research/delegation-calibration-log.md`（Round 4 の統制実験 2 本を追記）

   これらは内容上、§3.2 の **artifact-wait プロトコル実験の観測記録**であり、Domain A の variant 可視性ゲート実装とは無関係。計画 §6 Domain A の Allowed write scope にも列挙されていない（Domain A の allowed は `apps/authoring-host/**`、`packages/ai-interface/src/**`、ref-render-gate 実験、root package.json scripts、Domain A report/review のみ）。

   Gnome 報告 §2 末尾は「No changes to ... or any forbidden-scope directory」と述べるのみで、この 2 ファイルには言及していない。これらは **Orch-Sylph / L0 側が実験統制の一環として編集したもの**と推測されるが、Design/Development レビューの立場からは Domain A 実装差分の外にある変更として認識し、Orch-Sylph に帰属確認を求める。もし Gnome が触れたのであれば scope 逸脱、Orch/L0 が実験記録として触れたのであれば正当（§3.2 記録義務の履行）。**Domain A 実装の pass 判定自体には影響しない**（実装/テスト/成果物はすべて Allowed scope 内）。

## 実行した検証コマンド（証跡）

| コマンド | 結果 |
|---|---|
| `git status --porcelain -- <forbidden scope 各パス>` | 空（clean、exit 0） |
| `git diff/status -- pnpm-lock.yaml, ai-interface/package.json, root package.json` | 無変更（空） |
| `node scripts/check-source-organization.mjs` | `Source organization guard passed.`（exit 0） |
| `node scripts/check-dependencies.mjs` | cmo3 既知先行偽陽性 1 件のみ（lockfile 無変更 → 新規ゼロ） |
| `npx vitest run packages/ai-interface` | 122 passed / 0 failed（18 files） |
| `npx vitest run .../dependency-boundary.test.ts` | 5 passed / 0 failed |
| `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | exit 0 |
| grep: ai-variant-selection.ts の `package-format` | コメントのみ、import ゼロ |
| grep: id パターン照合 | ai-interface インライン宣言 = package-format 実定義と完全一致 |
