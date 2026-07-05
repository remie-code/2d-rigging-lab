# Wave106 Domain A `wave106-core-replacement` — Orch-Sylph 最終報告

- 呼び出し元: Undine（L0）
- ドメイン: Domain A = Core Replacement（packages 全層 + fixtures）
- オラクル: `discussion/design/dynamics-world-frame-chain.md`（§3 物理 / §4 スキーマ / §5 命名 / §6 裁定 / §7 validator 改廃 / §8 プリセット）
- 拘束台帳: `discussion/implementation/orchestration/wave106-blast-radius-inventory.md`

## 判定: **pass**

dynamics v0（`additivePendulumV0`、入力値を平衡点とするバネ系）→ 世界系 Verlet 質点チェーン（`worldFrameChainV1` / `dynamics-file-v3`）への破壊的置換を、packages 全層 + fixtures + テストで完遂。

- **packages 内 tsc: error 0**（root `npx tsc --noEmit` で packages スコープ error 0。apps は各自 tsconfig で対象外＝想定内）
- **dynamics 関連テスト: 全 green**（コア5ファイル43 + 全 dynamics 関連10ファイル89、validator §7・operation ライフサイクル・スキーマ境界・物理妥当性を含む）
- **3レビューレーン: 全て pass**（Physics=合格、Design/Dev=芯合格、Test Adequacy=要修正2件は修正ループで解消）
- **旧識別子残置ゼロ**（`additivePendulumV0` / `dynamics-file-v2` / `dynamics-pendulum-solver-v1` / `runtime-dynamics-pendulum-v1` / 廃止ノブ）を packages src・catalog・fixtures で確認

**重要な留保（既存赤の切り分け）**: `npx vitest run packages/` 全体では 14テスト / 13ファイルが赤いままだが、Orch が `git stash`（packages+fixtures 退避）で **committed HEAD（`dc9fae9c`）を実測し、同一の13ファイル14テストが着手前 HEAD でも赤い**ことを確認済み。**Wave106 Domain A は既存赤を1件も増やしておらず、dynamics 起因の赤はゼロ**。残14赤は Domain A スコープ外の別要因（後述「残課題 / 他ドメイン引き継ぎ」）。

## ループ回数

- Gnome 実装: 実質2段（計画推奨）だが、Gnome-2 のコンテキスト肥大により第2段を Gnome-2→Gnome-3 へ引き継ぎ。修正ループ1回（Gnome-4）。合計 Gnome 起動4回。
- レビュー: 3レーン並列1回 + grep 照合の再確認（Orch 直接検証）。

## 作成 / 変更ファイル

### 本体 src（25ファイル、非テスト）
- package-format: `model-files.ts`（v3 スキーマ）, `runtime-export.ts`（solver 契約 `runtime-dynamics-chain-v1` / capability `dynamics-chain-solver-v1`、`RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema` 同一維持=裁定#6）
- contracts: `runtime-state.ts`（particles 化）, `runtime-diff.ts`（stateSummary 同期）
- runtime-core: `dynamics-evaluation.ts`（ソルバ全面書換=§3.2〜§3.5）, `normalized-runtime-graph.ts`, `snapshot.ts`（solverKind `worldFrameChainV1` + stateSummary）, `snapshot-comparison.ts`, `state-compatibility.ts`, `initial-state.ts`, `parameter-resolution.ts`（出力オフセットのアンカー認識ルーティング=裁量#1、加算合成算術は不変）, `runtime-options.ts`, `tutorial-evidence-summary-schema.ts`
- authoring-core: `runtime-graph-dynamics.ts`, `dynamics-mutations.ts`, `package-document-from-authoring-session.ts`, `package-document-model-files.ts`, `runtime-export-materialization.ts`, `tutorial-mini-model-seed.ts`
- operation-core: `payloads/dynamics.ts`, `operations/create-dynamics-group.ts`, `operations/update-dynamics-group.ts`
- validator-core: `validators/dynamics-semantic.ts`（§7 改廃）, `check-catalog.ts`（§7 catalog 改廃=修正ループ）
- ai-interface: `ai-codex-proposal-operation-catalog.ts`（文言・requiredInputs のみ）

### テスト（約49ファイル）
物理妥当性テスト群（`dynamics-evaluation.test.ts` 17件）新設、validator §7 発火テスト、operation ライフサイクル、スキーマ境界（v3 受理 / v2 reject / 廃止フィールド付き payload reject）、決定論・拘束剛性・多段+segmentIndex、既存テストの inline dynamics データ v3 化。

### fixtures（27ファイル、決定論再生成）
台帳の21件 + baseline-package.json 群の埋め込み空 dynamics ブロックの schemaVersion 更新。`git diff --check` clean、差分は全て dynamics 関連フィールドに局在（Orch がサンプル diff で無関係バイト差ゼロを確認、Test Adequacy レーンも独立確認）。

## テスト結果

| スコープ | 結果 |
|---|---|
| packages 内 tsc | error 0 |
| dynamics コア（runtime-core dynamics-evaluation + validator dynamics-semantic 等） | 全 green（89 tests） |
| 物理妥当性（dynamics-evaluation.test.ts） | 17 tests green |
| packages 全体 | 14 failed / 1421（全て HEAD 由来既存赤、非 dynamics、責務外） |

## レビュー判定（3レーン、`discussion/implementation/reviews/wave106/`）

| レーン | レポート | 判定 |
|---|---|---|
| Physics / Spec Compliance | `wave106-domain-a-physics-spec-compliance-review.md` | **合格**（独立検算7項全通過。周期を Python で独立再現し解析値と ratio 1.0000 一致、√則を実検証。積分順序・射影の子のみ移動・atan2(d.x,d.y)・θ_local=θ_world−φ を行番号まで照合。裁量#1 追認） |
| Design / Development | `wave106-domain-a-design-development-review.md` | **芯合格 + 要修正2件**（命名§5完全適用・廃止フィールド本体src残置ゼロ・§7改廃実装通り・加算合成/固定ステップ不変・境界非緩和。要修正=穴A/B、修正ループで解消） |
| Test Adequacy | `wave106-domain-a-test-adequacy-review.md` | **芯合格 + 要修正2件**（物理妥当性テストの実効性・周期の式検証性・golden の式再現性・fixtures 局在・`.skip`ゼロを確認。要修正=穴A/B、修正ループで解消） |

### 修正ループ（Gnome-4、`wave106-domain-a-gnome4-fix-report.md`）
- **穴A**: `check-catalog.ts` が Domain A で未反映だった → §7 に合わせ削除3（invalidPendulumCardinality/invalidOutputCardinality/normalizationInvalid）/ 改名2（zeroInputInfluence→zeroInputScale、outputStrengthZero→outputScaleZero）/ 新設2（chainSegmentsInvalid、outputSegmentIndexOutOfRange）/ 維持7 + description 旧語彙撤去。catalog checkId を実装 `dynamics-semantic.ts` の発火 checkId 11件と完全一致（catalog を実装の真に合わせる）。
- **穴B**: テスト4ファイルの `evaluatorVersions.dynamics: "additivePendulumV0"` → `"worldFrameChainV1"`。
- Orch 最終独立検証: `additivePendulumV0` in packages = 0、旧 catalog rule ids = 0、新 catalog rule ids = 4 登録、dynamics テスト green、tsc error 0。

## 裁量判断（Orch 追認済み）

1. **裁量#1（parameter-resolution.ts）**: 出力オフセット算出をアンカー認識版へ接続（`getDynamicsOutputOffsetForParameter` に graph/authoredParameterValues を渡し、§3.5 の θ_local=θ_world−φ に必要な φ を再計算）。**加算合成算術（base+offset の再クランプ）は diff ゼロで不変**。Orch が diff で確認、Physics レーンが独立追認（式§3.5 に非抵触）。状態に φ を持たない設計（§4）ゆえの構造的必然。
2. **DynamicsGroup 既存フィールド維持**: 設計 §4 Zod 概形は `id, name?` の簡略表記だが、既存 `dynamicsGroupId/displayName/enabled/presetId` は維持（廃止対象は pendulums 系ノブと input/output 廃止フィールドのみ）。
3. **複数 output ルーティング**: 単一 output 前提の索引を全 output 走査へ（segmentIndex 複数解禁対応）。合成算術は不変。
4. **snapshot 単一出力 evidence を代表（先頭）出力として維持**、debug を anchorPhiDeg/pinX/pinY へ。
5. **catalog severity**: 新設2件を実装の発火 severity（blocking）に合わせた（実装を真とする原則）。
6. **dt 上限ガード（MAX_STABLE_STEP_MS=100）**: §3.3 明記外だが爆発防止の保守ガード。Physics レーンが「式の破壊でなく実害なし」と評価。

## escalate 判定

なし。設計 §3 の式に複数解釈は生じず（Physics レーンが全て一意照合）、parameter-resolution の加算合成枠組み・advanceRuntimeState・固定ステップ機構・authoring-host は無変更、pnpm install / 新規依存なし、fixtures の dynamics 以外バイト差なし。

## 残課題 / 他ドメイン引き継ぎ

### Domain B への引き継ぎ（Domain A の Forbidden scope、A では触っていない）
- **editor 側 `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts` の旧診断2件が残存**（Design/Dev レーン申し送り、L0 裁定で Domain B の領分と確定）。Domain B が dynamics-tool の新スキーマ対応時に処理すること。

### packages 全体の既存赤14テスト（HEAD `dc9fae9c` 由来、Domain A 責務外・非 dynamics）
Orch が git stash で HEAD ベースラインを実測し、以下が着手前から赤いことを確定。Domain D の最終統合 or 別途で処理すべき既存問題:
- **(A) tutorial recipe × preset 衝突**: `tutorial-mini-model-recipe.ts` が `createParameter(param_mouth_open)` するが同 id は wave64 登録済み preset → `duplicateParameter` で reject（wave30 系4ファイルを封じている）。本体 src 判断が必要。
- **(B) variants フィーチャの `model/variants.json` 追加**: package file-set entryCount +1 のずれで operation-core golden 5ファイル不一致。variants ドメインの golden 未更新。
- **(C) `createParameter` の semanticRole 欠落**（minimal-operation-fixture）: 本体退行の疑い。
- **(D) keyform 検証追加 / snapshot baseValue フィールド**（rig-control-runtime-evidence / warp-lattice-diagnostics / runtime-grid2d-keyform-fixture）: 本体 or 別フィーチャ由来。

これらは Domain A の完了条件（dynamics 置換 + packages 内 tsc green + dynamics テスト green + 旧識別子残置ゼロ）とは独立。Domain D の Forbidden-scope diff check / grep gate は dynamics 識別子については green になる見込み（Domain A が旧 dynamics 識別子を残置ゼロにしたため）だが、上記(A)〜(D)の既存赤の扱いは L0 / Domain D の判断事項。

## 起動した全子 agentId と閉域結果

| agentId | 役割 | 成果物 | 閉域結果 |
|---|---|---|---|
| `a78638119601c68ad` | Gnome-1（スキーマ/状態/ソルバ/evidence） | gnome1-report.md | completed（TaskStop: No task found = 生存なし） |
| `a4602c6639278f5fb` | Gnome-2（下流層+fixtures、コンテキスト肥大で第2段を Gnome-3 へ引継） | （report は Gnome-3 が完成） | completed（TaskStop: not running 確認済み） |
| `a1c809e52aea60a42` | Gnome-3（テスト green 化引継、escalate=既存赤切り分け） | gnome2-report.md | completed（TaskStop: No task found） |
| `a188a5756c74baa7d` | Gnome-4（catalog/残置 修正ループ） | gnome4-fix-report.md | completed（TaskStop: not running） |
| `aab103969fbea20b1` | Review-Sylph Physics/Spec | physics-spec-compliance-review.md | completed（TaskStop: No task found） |
| `aff151724ca351267` | Review-Sylph Design/Dev（孫 Explore 1体を起動） | design-development-review.md | completed（TaskStop: No task found） |
| `a82feb3cd6ccf7b66` | Review-Sylph Test Adequacy | test-adequacy-review.md | completed（TaskStop: No task found） |

**掃除リスト（L0 / ユーザーへ）**: Design/Dev レビュアー（`aff151724ca351267`）が起動した**孫 Explore エージェント1体**は、L0 中継で完遂（全件合格）を確認済みだが、Orch からも L0 からも観測・停止できない（規則5）。UI 上に生存表示が残る場合はユーザーの手動停止でのみ閉じられる。作業ツリーへの影響はなく衛生問題のみ。他の子は全て閉域済み（孤児なし）。

## Basis Coverage（設計 → 実装 → 検証）

| 検証項目（計画 §11） | 最小 evidence | 状態 |
|---|---|---|
| 収束点が重力方向（症状治療） | 平衡点テスト①②③（角度→−φ / 並進→0 / 複合→−φ、誤差<0.005°） | pass |
| 振り子として物理妥当 | 周期√則（Physics レーン独立再現 ratio 1.0000）+ 減衰単調性 + 拘束剛性（<5e-7cm） | pass |
| kind が意味を持つ | 角度定常(−φ) と並進定常(0) の差 >1° をテストで固定 | pass |
| 決定論・固定ステップ不変 | 2回実行一致 + advanceRuntimeState diff ゼロ + parameter-resolution 加算合成不変 | pass |
| 旧データが黙って壊れない | v2 reject テスト + 廃止フィールド付き payload reject | pass |
| CLI 経路が生きている | operation dry-run→commit テスト green（authoring-host 無変更） | pass |
| 命名完全適用・旧名残置ゼロ | grep 証跡（packages src / catalog / fixtures で旧 dynamics 識別子ゼロ） | pass |
