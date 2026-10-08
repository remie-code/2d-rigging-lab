# Perf Wave 2 — Final Report（案A: 選択駆動遅延化 + 案D+E: deformerVertex 表示経路最適化）

> Status: Complete（2026-07-08）
> 作成: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Domain H）。本 Domain は統合・再計測・ドキュメント整合のみで、**評価・描画ロジックは一切変更していない**。
> 設計オラクル: [improvement-design.md](../../../improvement-design.md)（Status: Implemented）
> before/after 詳細: [measurements/after-wave2-synthetic.md](../../../measurements/after-wave2-synthetic.md)

---

## 1. 各ドメイン要約

| Domain | 内容 | 成果 | レビュー判定 |
|--------|------|------|-------------|
| **F**（案A: rig control 選択駆動遅延化） | `CanvasEvaluatedScene.rigControls` の契約を「全件配列」→「選択駆動の部分集合」へ縮小。非選択時は空、選択/preview/draft のみ評価。`resolveRequiredEvaluatedRigControlIds` 新設、`createCanvasEvaluatedRigControls` に必要集合フィルタ追加。preview 経路は既存の selection/preview 引数流路で自動追従（無改修）。 | rig 非選択（本番主経路）で rig control 評価が実質ゼロ化。祖先チェーンは `rigControlsById`（全件）経由で内部合成されるため出力配列は選択1個で数値等価。 | 設計適合レーン **合格** / テスト妥当性レーン **合格**（[domain-f-review-design.md](../../reviews/perf-wave2/domain-f-review-design.md) / [domain-f-review-tests.md](../../reviews/perf-wave2/domain-f-review-tests.md)） |
| **G**（案D+E: deformerVertex 表示経路最適化） | 表示経路の `normalizeTransformNumber` から toFixed(12) を除去（微小値ゼロ化 snap は保持、epsilon 検証で最大差 9.1e-13）。3重クローンを削減（cloneMesh を shallowCloneVec2 化 / applyRigControlChainToVertices の冗長コピー除去・chain 空素通し / projection cloneEvaluatedMesh を参照渡し化、adapter 層は isolation のため保持）。unionRects の spread を reduce 1パスへ（案E）。 | deformerVertex を medium −91% / heavy −92% / rigHeavy −79.7% / light −68.1% 削減。保存・export・provenance の `session.graph` 原本はバイト同一、表示値は epsilon(1e-9) 等価。 | 設計適合レーン **合格** / テスト妥当性レーン **合格**（[domain-g-review-design.md](../../reviews/perf-wave2/domain-g-review-design.md) / [domain-g-review-tests.md](../../reviews/perf-wave2/domain-g-review-tests.md)）。テスト強度の残課題（cloneMesh 境界の isolation テスト穴）は Domain G ループ2で補強済み。 |
| **H**（統合・再計測・ドキュメント整合） | 合成ベンチ before(v3)/after 再計測、モノレポ全体検証、ドキュメント整合、本 final-report・計測003手順の作成。評価・描画ロジックは無改変。 | 下記 §2〜§6。 | 単一レーン（本レポートが成果物） |

---

## 2. before-after 要約（主経路 = rig 非選択のスライダー操作）

**measurements/after-wave2-synthetic.md の要約。** before = v3（案未適用）、after = F+G 適用済みの現状ツリー。ベンチは `selection: null`（本番のパラメータスライダー/rig ドラッグ操作の主経路）で評価する。

### evaluation 全体（`canvas.evaluation.ms`）の削減率

| scale | before avg (ms/eval) | after avg (ms/eval) | 削減率 |
|-------|----------------------|---------------------|--------|
| light    | 0.835 | 0.273 | **−67.3%** |
| medium   | 13.690 | 1.782 | **−87.0%** |
| heavy    | 233.393 | 20.329 | **−91.3%** |
| rigHeavy | 89.153 | 10.616 | **−88.1%** |

### 主経路で何が消えたか

- **主犯 `createCanvasEvaluatedRigControls`（= `assembly.rigControls` スパン、v3 で artworkBoundsAndAssembly の 99.84% を占めた）が案A でゼロ化**: rigHeavy で **67.824ms/eval → 0.001ms/eval（−99.998%）**。親 `artworkBoundsAndAssembly` も rigHeavy で **67.935 → 0.042ms/eval（−99.94%）**。設計 §5「rigHeavy で artworkBoundsAndAssembly がほぼ消える」を数値で達成。
- **第二標的 deformerVertex が案D+E で削減**: medium −91% / heavy −92% / rigHeavy −79.7% / light −68.1%。deformerVertex が支配的な medium/heavy でこの寄与が evaluation 全体の削減を牽引。
- 両案が異なる scale の主犯を分担: rigHeavy は案A（rig control 主犯のゼロ化）が支配、heavy/medium は案D+E（deformerVertex）が支配。

---

## 3. モノレポ全体検証（実測数値）

Domain H で実際に実行した結果（2026-07-08、同一マシン）:

| 検証 | コマンド | 結果 |
|------|---------|------|
| root typecheck | `pnpm run typecheck`（= `tsc --noEmit`, root tsconfig） | **PASS（exit 0）** |
| apps/editor typecheck | `npx tsc --noEmit -p apps/editor/tsconfig.json` | **22 errors**（pre-existing baseline と完全一致。F/G 変更ファイル起因 0 件を確認 — §4） |
| root test:unit（packages） | `npx vitest run packages --exclude ...` | **234 files / 1455 tests PASS**（fail 0） |
| apps/editor workspace | `npx vitest run apps/editor/src/workspace` | **283 passed / 4 skipped / 4 failed** |
| apps/editor canvas（F/G の主戦場） | `npx vitest run apps/editor/src/workspace/canvas` | **110 passed / 4 skipped**（F の選択駆動 subset テスト + G の二層分離テスト含む） |
| check:deps | `node scripts/check-dependencies.mjs` | **PASS（"Dependency guard passed."）** |
| check:source | `node scripts/check-source-organization.mjs` | **PASS（"Source organization guard passed."）** |

### 既知除外（この2つのみ・それ以外の fail はゼロ）

1. **`diagnostics/diagnostics-jump-actions.test.ts` の 4 件**（wave106 P3 既知 baseline fail）。全 4 件がこのファイルに閉じていることを個別に確認済み（`setActiveEntry` の `"import"` vs `"workspace"` 期待差）。F/G/H と無関係。apps/editor workspace の 4 failed はすべてこれ。
2. **apps/editor の pre-existing 型エラー 22 件**（別WIP由来・別タスク化済み。§4 参照）。

**上記 2 つ以外の fail はゼロ**。root packages スイートは 1455/1455 green、canvas スイートも 110/110 green。

---

## 4. pre-existing 型エラー 22 件の内訳（F/G 起因ゼロの確認）

`npx tsc --noEmit -p apps/editor/tsconfig.json` の 22 件は以下のファイルに分布し、**F/G が変更した canvas-evaluation.ts / canvas-projection.ts / canvas-evaluation.test.ts には 1 件も存在しない**（実測 grep で確認）:

| ファイル | 件数 |
|---------|------|
| features/editor-session/model/editor-diagnostics-state.ts | 3 |
| workspace/viewer/viewer-render-source.test.ts | 3 |
| workspace/viewer/viewer-render-source.ts | 2 |
| workspace/viewer/viewer-runtime-screen.tsx | 2 |
| workspace/viewer/viewer-variant-selection.test.ts | 3 |
| workspace/variants/variant-manager-screen.tsx | 1 |
| workspace/viewer/runtime-controls.tsx | 1 |
| workspace/panels/mesh-tool-inspector.test.ts | 1 |
| workspace/panels/parameter-bar.test.ts | 1 |
| features/editor-session/model/{editor-session-history,mesh-apply-auto-refit,mesh-tool-state,session-tree}.test.ts | 各1（計4） |
| features/project-storage/model/editor-project-storage.test.ts | 1 |

いずれも viewer / variant-manager / diagnostics-state / mesh-tool 系の別 WIP 由来で、`exactOptionalPropertyTypes` / branded-type の齟齬。F/G/H の scope 外。

---

## 5. CI 経路の確認（事実と影響 — 修正はしていない）

### 事実（Domain H で root package.json / apps/editor/package.json / tsconfig を実読して再確認）

- **root `test:unit` = `vitest run packages --exclude packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`** → **packages のみ対象、apps/editor を含まない**。
- **apps/editor の package.json にはユニットテスト用 script が無い**（`dev` / `build` / `typecheck` / `test:e2e:psd-import`（playwright）/ `preview` のみ）。
- **root `typecheck` = `tsc --noEmit`（root tsconfig）**。root tsconfig の `include` は `packages/*/src`・`packages/*/test`・`scripts/**`・`vitest.config.ts` のみで、**`apps/**` を含まない**。apps/editor の型検査は `apps/editor/tsconfig.json` を個別に叩く必要がある。
- root `check`（`pnpm run check`）= `typecheck && test:unit && check:deps && check:source`。すべて packages スコープ（typecheck/test）+ 全体（check:deps/source）。

### 影響

- **canvas 系ユニットテスト（canvas-evaluation.test.ts, canvas-projection.test.ts, 二層分離テスト, 選択駆動 subset テスト等）は root の `pnpm check` / `test:unit` 経路では回らない**。これらは apps/editor 配下であり、root の packages スコープに含まれないため。今回の F/G のテスト green は Domain H が `npx vitest run apps/editor/src/workspace/canvas` を明示実行して確認したものであり、既存の CI（もし root check を回すもの）では自動検証されない。
- 同様に **apps/editor の型検査（pre-existing 22 件を含む）も root typecheck では検出されない**。
- **本 Domain では修正しない**（禁止事項・方針判断はユーザー/L0）。CI に apps/editor のユニットテスト・型検査を組み込むか否かは方針判断として escalate（§8 質問）。

---

## 6. 既知事項

1. **CI 経路（§5）**: apps/editor のユニットテスト・型検査が root CI（`pnpm check` / `test:unit` / `typecheck`）で回らない。canvas 系テスト（F/G の等価テスト含む）は自動検証経路の外にある。**未修正**（方針判断待ち）。
2. **pre-existing 型エラー 22 件（§4）**: apps/editor に別 WIP 由来の型エラーが 22 件残存。F/G/H の scope 外・別タスク化済み。
3. **保留中の案C（レンダー外化）**: StrictMode 開発モード二重評価対策。A+D 実施後の実モデル計測003で dev 体感が目標未達の場合の次弾。**保留のまま**（improvement-design §4 を改変していない）。60fps 続行可否も **ユーザー実数判断待ち**。

---

## 7. ユーザー実モデル計測003の手順と 30fps 判定方法

### 7-1. 計測手順（実モデル計測001/002 と同じ手順を踏襲）

実モデル計測002（[measurements/real-model-002.md](../../../measurements/real-model-002.md)）と**同一条件・同一手順**で計測する:

1. **条件**: Editor Canvas でパラメータスライダーを操作。**Viewer は非表示**（001/002 と同条件。caller が `canvas` 単一になる条件）。デフォーマを細かく作り込んだ実モデル（症状が出るモデル）を使う。
2. **計測フラグを有効化**: dev server で `globalThis.__LIVE2D_PERF__ = true` 相当を有効にし（002 の domain-pb-report §6 手順に準拠）、フェーズ計測（`canvas.evaluation.ms` とその内訳スパン・caller counter）を収集する。
3. **操作**: スライダーを一定時間操作して評価を複数回（002 では count 92）走らせ、`console.table` 等で timings（count / totalMs / maxMs / avg）と counters を採取する。
4. **採取するキー**: `canvas.evaluation.ms`（全体）とその内訳（indexBuild / keyform / rigControlEval / deformerVertex / artworkBoundsAndAssembly と3子スパン assembly.rigControls / artworkBounds / rest）、`canvas.renderSceneAdapter.ms`、caller counter（`canvas.evaluation.caller.canvas` 等）、webgl2 counters。
5. **記録先**: `measurements/real-model-003.md`（新規）に 002 と同じ表形式で before(002 の値)/after(003) を並記。

> **注**: 002 との比較で、artworkBoundsAndAssembly（002 で 75.8% = 96.4ms/eval）が案A でほぼ消えること、caller が引き続き `canvas` 単一で renderSceneAdapter の 2 倍（= 二重評価が残存しているか）を確認できる。

### 7-2. 30fps 目標の判定方法

- **判定基準**: `canvas.evaluation.ms` の **avg が 33ms 以下** なら 30fps（1フレーム33ms）達成。
  - 002 の before は avg 127.2ms/eval（≈ 8fps 相当、1評価あたり）。二重評価込みの実効フレームは ≈ 254ms/フレーム（≈4fps）だった。
  - after で avg ≤ 33ms なら、1評価あたりで 30fps ラインに到達。

### 7-3. dev の StrictMode 二重評価を考慮した読み方（必読）

dev server では **React StrictMode により評価が2回走る**（[double-evaluation-diagnosis.md](../../../double-evaluation-diagnosis.md) 参照。002 で caller `canvas` = 92 が renderSceneAdapter = 46 のちょうど2倍 = 二重評価の実証）。計測値は次の両面で読む:

- **本番相当（production, StrictMode 無し）= 1 評価分**: `canvas.evaluation.ms` の avg そのものが1フレームの評価コスト。**この avg ≤ 33ms なら本番で 30fps 達成**。
- **dev 体感 = 2 評価分**: dev server では1フレームあたり評価が2回走るため、体感フレームコストは `avg × 2`。**dev 体感で 30fps を測るなら avg ≤ 16.5ms** が目安。
- **案A で1評価が軽くなれば二重実行の絶対コストも下がる**（improvement-design §4 の見立て）: 案A で1評価の主犯（rig control 全量再構築）が消えるため、StrictMode で2回走っても「2 × 軽くなった評価」となり、二重実行の絶対コスト自体が大幅に下がる（§4 は「A で1評価が軽くなれば二重実行の絶対コストも 1/10 前後に下がる見込み」と見立て）。合成ベンチでは主経路の evaluation 全体が heavy −91% 等なので、二重実行しても絶対コストは before の1回分より小さくなる可能性が高い。
- **判定の締め**: avg ≤ 33ms を満たしても dev 体感が重い場合（= 二重評価が体感を支配）、案C（評価のレンダー外化）を次弾として検討する材料になる。この続行判断はユーザーが実数を見て行う（improvement-design §4）。

---

## 8. コミット時の切り分けガイド（コミットはしない・後で切り分けるための地図）

**Domain H はコミット禁止。** 以下は実際の `git status`（2026-07-08 時点）と照合した帰属マップ。ユーザー/L0 が後で層ごとに切り分けコミットするための地図。

### 実際の git status（実測）

```
 M apps/editor/src/workspace/canvas/canvas-evaluation.test.ts
 M apps/editor/src/workspace/canvas/canvas-evaluation.ts
 M apps/editor/src/workspace/canvas/canvas-projection.ts
 M apps/editor/src/workspace/panels/canvas-preview-panel.tsx
 M apps/editor/src/workspace/viewer/viewer-clean-stage.ts
 M apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx
 M discussion/_conventions.md
 M discussion/_map.md
 M discussion/reports/_map.md
?? apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
?? apps/editor/src/workspace/canvas/synthetic-heavy-model.ts
?? apps/runtime-player/private-2d-rigging-lab-runtime-player-0.0.0.tgz
?? discussion/render-performance/
?? discussion/reports/editor-render-performance/
```

> **重要な差分（委任プロンプトの前提との相違）**: 委任プロンプトは「作業ツリーの未コミット束は3層（(a) Mesh Wave 1/1.1 (b) Perf Wave 1.x 計測基盤 (c) Perf Wave 2 F/G）」と記していたが、**実際の git status には mesh-geometry / v7系 / mesh-tool UI ファイルは未コミットとして現れない**。これらは直近コミット（`6749b520 [modify]meshv7を作成、選べるようにした` 等）で**既にコミット済み**。したがって現在の未コミット束は **2層（Perf Wave 1.x 計測基盤 + Perf Wave 2 F/G）+ ドキュメント + ビルド生成物** である。以下はこの実態に基づく。

### 層 A: Perf Wave 2 F/G（本 wave の実装成果）

| ファイル | 帰属根拠 |
|---------|---------|
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts` | 案A（`resolveRequiredEvaluatedRigControlIds` / 必要集合フィルタ）+ 案D+E（normalizeTransformNumber / shallowCloneVec2 / applyRigControlChainToVertices / unionRects）。**F と G の両変更が同一ファイルに同居**（F 完了後 G が同ファイルに追加実装したため）。切り分けコミットで F/G を分離したい場合は hunk 単位が必要。 |
| `apps/editor/src/workspace/canvas/canvas-projection.ts` | 案D（cloneEvaluatedMesh 参照渡し化, Domain G）。※ただし Wave 1.x の caller 転送計装も同ファイルに含まれる可能性あり（下記層B 参照。hunk で混在）。 |
| `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts` | 案A の選択駆動 subset テスト（Domain F）+ 案D+E の二層分離テスト（Domain G, ループ2 の isolation 補強含む）。 |

### 層 B: Perf Wave 1.x 計測基盤（別 wave・レビュー済み・既知）

| ファイル | 帰属根拠 |
|---------|---------|
| `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` | Wave 1.x の evaluationCaller 配線（caller タグ転送）。Domain F/G は無改修と両レポートが明記（F report §2「canvas-preview-panel.tsx は無改修」）。→ **Wave 1.x 由来**。 |
| `apps/editor/src/workspace/viewer/viewer-clean-stage.ts` | Wave 1.x の caller 計装（viewer 経路の evaluationCaller 転送）。F/G の変更ファイル一覧に無い。→ **Wave 1.x 由来**。 |
| `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx` | 同上（viewer 経路の caller 計装）。F/G の変更ファイル一覧に無い。→ **Wave 1.x 由来**。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts`（untracked） | 合成ヘビーモデルベンチ本体。Wave 1（計測基盤）で新設。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.ts`（untracked） | ベンチ fixture 生成ロジック。Wave 1（計測基盤）で新設。 |
| `canvas-evaluation.ts` / `canvas-projection.ts` の一部 hunk | Wave 1.x のスパン細分化・caller 転送（`assembly.*` 3子スパン等）。これらは層 A の F/G 実装 hunk と**同一ファイル内で混在**。domain-{f,g}-review は「計測基盤の差分が F/G diff に混在」と R1/確認事項で明記済み。 |

> **注**: `canvas-evaluation.ts` と `canvas-projection.ts` は層 A（F/G 実装）と層 B（Wave 1.x 計測基盤の hunk）が同一ファイルに混在する。ファイル単位では層を分けられないため、hunk 単位の切り分けが必要（レビューの R1 と整合）。

### 層 C: ドキュメント（帰属を明記）

| ファイル | 帰属 |
|---------|------|
| `discussion/render-performance/`（**untracked ディレクトリ全体**） | **Perf 系**。improvement-approach / design-inputs / improvement-design / double-evaluation-diagnosis / `render-performance/_map.md`（← Domain H が編集したのはこの階層内の _map.md。root の `discussion/_map.md` ではない）/ measurements/（baseline-synthetic 各版・real-model 各版・after-wave2-synthetic）/ implementation/（perf-wave2-plan・F/G/H report・reviews・本 final-report）。Perf Wave 1/2 の全成果文書。ディレクトリごと untracked なので `git add discussion/render-performance/` で一括ステージ可。 |
| `discussion/reports/editor-render-performance/`（**untracked ディレクトリ**） | **Perf 系**（current-state-survey.md 等の現状調査レポート）。 |
| `discussion/_map.md`（M, **tracked・Domain H は未編集**） | **root の discussion 地図**（`render-performance/_map.md` とは別ファイル）。diff は mesh-generation 行の更新 + render-performance トピック登録行の追加で、**mesh と Perf の両トピックが混在**する pre-existing 差分。Domain H は触っていない（実測 `git diff` で確認）。切り分けコミット時は mesh/Perf どちらの登録として扱うか要判断（両方の行を含む）。 |
| `discussion/reports/_map.md`（M, **tracked・Domain H は未編集**） | reports 階層の地図。editor-render-performance 行の追加等（Perf 系 pre-existing 差分）。Domain H は未編集。 |
| `discussion/_conventions.md`（M, **tracked・Domain H は未編集**） | discussion 規約。Perf 系とは別由来の pre-existing 差分。**帰属不明 = Domain H は触っていない**。 |

### 層 D: ビルド生成物（コミット対象外の可能性）

| ファイル | 帰属 |
|---------|------|
| `apps/runtime-player/private-2d-rigging-lab-runtime-player-0.0.0.tgz`（untracked） | runtime-player のパッケージ tarball（ビルド生成物）。**Perf/Mesh いずれの成果でもなく、コミット対象から除外すべき生成物の可能性が高い**（.gitignore 検討対象）。Domain H は生成していない・触っていない。 |

### Domain H が編集したドキュメント（本 wave の統合成果・層 C の Perf 系に含む）

- `discussion/render-performance/measurements/after-wave2-synthetic.md`（新規）
- `discussion/render-performance/improvement-design.md`（Status → Implemented, §6 追記）
- `discussion/render-performance/_map.md`（現況反映。※ root の `discussion/_map.md` ではなく render-performance 階層内の _map.md。両者とも untracked ディレクトリ内）
- `discussion/render-performance/implementation/waves/perf-wave2/final-report.md`（本ファイル）
- `discussion/render-performance/implementation/waves/perf-wave2/domain-h-report.md`（Domain H 総括）

---

## 9. ベンチ一時変更の復元確認

- Domain H の計測では production コード・ベンチ・テストを**一切改変していない**。ベンチは `RUN_PERF_BENCH` を環境変数から読むため source 改変不要。計測前後で `git status` が同一（一時変更なし）→ 復元不要を確認済み。
- なお Domain F/G の各レポートに記載の一時変更（F: subset フィルタを全件へ戻す surgical patch / G: shallowCloneVec2 を alias に退行させる注入）は、各 Gnome が計測・注入検証後に復元済みと明記されており、現状ツリーには残差分なし（F/G の変更ファイルは実装そのもののみ）。

---

## 10. 質問（Orch-Sylph / L0 / ユーザーへ）

1. **CI 経路（§5）の方針**: apps/editor のユニットテスト（canvas 系等）と型検査が root CI で回らない。canvas-evaluation.test.ts 等の F/G 等価テストは自動検証経路の外。これを CI に組み込むか（apps/editor に `test:unit` script 追加 + root check への配線、または CI 側で apps/editor を個別に叩く）は方針判断。**Domain H では修正していない**（禁止事項遵守）。組み込む場合は別ドメイン/別タスク化が必要。
2. **委任前提と git status の相違（§8 冒頭）**: 委任プロンプトは未コミット束を「3層（Mesh Wave 1/1.1 を含む）」としていたが、mesh 系は既にコミット済みで、実際の未コミット束は「2層（Perf 1.x + Perf 2）+ ドキュメント + tgz 生成物」。切り分けガイドはこの実態に合わせた。認識に相違があれば指摘されたい。
3. **pre-existing 型エラー 22 件**: apps/editor の 22 件は別 WIP 由来・別タスク化済みとの前提で進めた。これらの解消は Perf Wave 2 の完了条件に含めていない（F/G/H の scope 外）。
4. **`discussion/_conventions.md` の未コミット差分**: Domain H は未編集だが M 状態。Perf 系とは別由来の既存差分と判断（帰属不明として層 C に注記）。切り分けコミット時に帰属を確認されたい。
