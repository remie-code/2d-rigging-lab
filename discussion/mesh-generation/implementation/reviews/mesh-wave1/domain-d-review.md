# Mesh Wave 1 / Domain D レビュー: Final Integration / Clean Review / Map Closeout

> レビュー担当: Review-Sylph(Opus 4.8)。委任元: Orch-Sylph(Mesh Wave 1 Domain D)。
> 日付: 2026-07-07
> ブランチ: feature/2d-rigging-eco-system(WIP・他ドメインの mesh 変更が working tree に併存)
> 対象報告: [domain-d-report.md](../../waves/mesh-wave1/domain-d-report.md) / [final-report.md](../../waves/mesh-wave1/final-report.md)

## 判定

**合格(pass)**

Domain D の成果(トグルラベル v6/v7 確定・モノレポ全体検証・ドキュメント6本整合・final report)は、concept-design §2-6・wave 計画 §9/§10・全ドメイン成果と整合している。全テスト結果を自己再実行で再現し、Gnome 報告の数値と完全一致した。apps/editor の 4 fail が mesh 非起因の既知 baseline であることを独立検証で確認した(mesh 起因の新規 fail ゼロ)。ドキュメントに未合意方針・希望的観測・未評価の品質断定の混入は無い。要修正事項は無し。

---

## 観点 (a): concept-design §2-6 と最終実装状態の突合(核心3点の自己確認)

### 核心1: 3不変条件がテストで担保されている + v7 に乱数なし

- **決定性(乱数禁止)**: `packages/authoring-core/src/mesh-generation-v7-*` 全ファイルを `Math.random`/`Date.`/`crypto`/`performance.now` で grep → **0 件**。テスト `mesh-generation-v7-margin-contour.test.ts` L140-175「v7 determinism」が同一入力2回で vertices/uvs/triangles/vertexStableIds/triangleStableIds の5フィールド完全一致を assert。**担保あり**。
- **被覆保証**: 同テスト L99-134「v7 coverage guarantee」が、全不透明ピクセル中心をフルスキャン(サンプルでなく `for y for x` 走査)で点-三角形包含 assert。filled blob と細い hair-tip(尾部3px幅)の2 fixture。多島 fixture も stage-mesh 上でフルスキャン被覆(L502-542)。**担保あり(核)**。
- **ε < r 結合則**: 同テスト L59-93 が5テクスチャサイズ(16/64/256/1024/4096)×3プリセットの全組で `simplifyEpsilon < marginRadiusPixels` を assert。r クランプ[4,16]px も検証。**担保あり**。

### 核心2: v7 が v6系ファイルを import していない

v7 全ファイル(pipeline / parameters / margin-contour / test)の import 文を grep。依存先は `delaunator` / `./mesh-generation-v7-constrainautor-runtime.js` / `./mesh-geometry/*`(中立モジュール) / `./mesh-generation-contract.js` / `./mesh-generation-v7-parameters|pipeline.js` / `./mesh-quality-metrics.js` / package packages のみ。`mesh-generation-v6-*` / `mesh-outline-*` / 各 v6 バックエンドへの import は **0 件**。`mesh-geometry/**` 側も v6 参照は grep で0件(唯一のヒットは polyline-simplification.ts のコメント内 `mesh-outline-generation` 言及=import ではない)。`mesh-quality-metrics.ts` は中立命名で v6/v7/outline import を持たない(=既知事項(c)は「V6型参照の共有ヘルパ」であり v6ファイル依存ではない。設計適合)。**pass**。

### 核心3: V7系統分離

`mesh-generation-contract.ts` diff で V7 専用系統が V6 と別系統で新設されていることを確認:
`V7_MESH_GENERATION_METHOD_IDS` / `_SOURCE_IDS` / `_BACKEND_IDS` / `_DEPENDENCY_PACKAGE_IDS` / `V7MeshGenerationCandidate` 型 / `V7_MESH_GENERATION_CANDIDATES` / `MeshGenerationV7FallbackReason`(4理由) / `isV7MeshGenerationMethod` / `getV7MeshGenerationCandidate`。いずれも V6 の対応物と並列に追加され、既存集約(`MESH_GENERATION_METHOD_IDS` 等)へは spread で合流。ディスパッチャ `mesh-generation.ts` に v7 分岐 + フォールバック step(v7 blocked → v6d-adaptive 連鎖)を確認。**pass**。

### 「薄いUI」

`mesh-tool-inspector.tsx` / `mesh-tool-state.ts` を確認。method 分岐は正確に3点に閉じている:
(1) `MESH_GENERATION_METHOD_CHOICES` を `.map()` する `<section data-testid="mesh-tool-generation-toggle">` 1ブロック(データ駆動・per-method ハードコード分岐なし)、(2) `useState<...>(method)` + `selectMethod` ハンドラ、(3) `previewMeshDraft`/`previewMeshDrafts` への optional `method` 引数受け渡し(既定 `DEFAULT_MESH_GENERATION_METHOD`)。UI 全体に v7 method 文字列のハードコード分岐は散らばっていない。v6削除時は「配列1行削除 + section ブロック撤去」で消える(コメントにも明記)。ラベルは `candidate.label` レンダーで "v6"/"v7"。**pass**。

> 注(欠陥ではない): inspector / editor-session-context / mesh-tool-state.test.ts の diff 本体は Domain C の成果が working tree に併存しているもの。Domain D の実 source 変更は `mesh-tool-state.ts` の `label: "Current" → "v6"` 1行のみ。clean review としては「最終状態」が設計整合であることを確認した(整合)。

---

## 観点 (b): 全体 green 自己再実行(実数値)

リポジトリルートから全コマンドを自己再実行。**Gnome 報告と完全一致**。

| 検証 | コマンド | 自己再実行結果 | Gnome 報告 | 一致 |
|---|---|---|---|---|
| authoring-core | `pnpm exec vitest run packages/authoring-core` | 276 passed / 0 failed (35 files) | 276/0 | ✓ |
| operation/validator/runtime-core | `pnpm exec vitest run packages/operation-core packages/validator-core packages/runtime-core` | 732 passed / 0 failed (129 files) | 732/0 | ✓ |
| authoring-host | `pnpm run test:authoring-host` | 82 passed / 0 failed (15 files) | 82/0 | ✓ |
| apps/editor | `pnpm exec vitest run apps/editor` | 435 passed / 4 failed (1 file failed) | 435/4 | ✓ |
| typecheck | `pnpm run typecheck` | pass (exit 0) | pass | ✓ |
| check:deps | `pnpm run check:deps` | `Dependency guard passed.` (exit 0) | pass | ✓ |
| check:source | `pnpm run check:source` | `Source organization guard passed.` (exit 0) | pass | ✓ |

### apps/editor 4 fail の mesh 非起因判定 — 独立検証結論

4 fail はすべて `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`。以下を自分で確認:

1. **無変更**: `git status` / `git diff --stat HEAD` で `diagnostics-jump-actions.ts`(source)も同テストも working tree で無変更(HEAD と同一)。
2. **論理的無関係**: 同テスト/同 source を `mesh-tool-state|MESH_GENERATION_METHOD|mesh-generation` で grep → 参照0件。Domain D のラベル1行変更(mesh-tool-state.ts)とは import で全く繋がらない。
3. **失敗機序の直接確認**: テストは `setActiveEntry("import")` を期待(L49/78/138)。だが **実装** `diagnostics-jump-actions.ts` は既に `setActiveEntry("workspace")` を呼ぶ(L125/138/166)。= entry 名 `"import" → "workspace"` リネームに対するテスト側の追随漏れ。純粋な test-vs-source 文字列不一致で mesh と無関係。
4. **既知記録の実在**: `discussion/implementation/waves/wave106/wave106-final-integration-report.md` L111 の **P3** に、この4 fail が同一ファイル・同一リネーム由来・HEAD `6645c2fe` コミット済みの既知 baseline として記録済み。この記録は当該4 failを正しく説明する。

**結論**: この4 fail は **mesh 起因の新規 fail ではない**。pre-existing の diagnostics entry リネーム追随漏れ(wave106 P3)であり、mesh いずれのドメインも当該ファイルに触れていない。Domain D の「真の全体 green(mesh 起因 fail ゼロ)」判定は **妥当**。needs_fix なし。

---

## 観点 (c): ドキュメント整合・未合意方針混入チェック

`git diff` で6ドキュメントを確認。

- **concept-design.md**: Status を `Accepted 2026-07-07 → Implemented(Mesh Wave 1)` に更新(Accepted の事実を保持)。本文設計内容は無変更(diff は Status 1行のみ)。**pass**。
- **mesh-generation/_map.md**: 未決事項テーブル(現状 L30-37)を確認 → 既存4件(品質評価基準 / keyform追従 / UV clamp整合 / 穴あき対応)すべて維持、追記2件(v7 の `computeMeshQualityMetrics` V6型依存 = Mesh Wave 2 入力 / `projectPresetAlias`・preset初期化 operation = 将来設計案件)は実装事実に即す。表2行の Status 更新・次の行動更新も現況どおり。**pass**。
- **implementation/_map.md**: waves/reviews を「作成済み」化、mesh-wave1-plan を「実行完了」化、新節「Mesh Wave 1 実装結果(全ドメイン pass)」に A/B/C/R/D の判定・ループ・報告/レビューリンク表 + 統合検証実数値を反映。wave1 全ドメイン結果を正しく反映。**pass**。
- **root discussion/_map.md**: `git diff --numstat` → 1行追加/1行削除のみ。L41 該当行(mesh-generation トピック行)の Status 列だけが変更され、L65(topic 説明行)含む他行は無変更。**pass**。
- **final-report.md**: ユーザー目視評価 gate 手順(§4)に髪パーツ・v6/v7比較・3プリセット・3特徴ゲシュタルト・v7パラメータ初期値 r/ε/L をすべて含む。評価合格後の Mesh Wave 2 方針(§5)も含む。**pass**。

### 未合意方針・希望的観測・未評価断定の混入チェック(clean review の要)

- final-report §判定(L14)は「v7 が v6 と同等以上の商用風出力になっているか **はコードで判定できない**」と明記。**未評価の品質断定なし**。
- v7 パラメータは「工学的出発点であり、評価で調整する前提」と記載(希望的観測でない)。
- 品質評価基準は §4 末尾 / _map.md 未決事項で **未決** として明示、ユーザー合意へ委譲。
- Mesh Wave 2(v6削除)は「評価合格して初めて進む」と条件付き。先走り実装方針の混入なし。

**混入なし。pass。**

---

## 観点 (d): wave計画 §10 Acceptance Criteria 照合表

| # | AC 項目 | 判定 | 根拠 |
|---|---|---|---|
| 1 | v7 method が契約に V7系統として登録され、UI 世代トグルから選択・生成できる | **pass** | contract に V7系統一式(観点a核心3)。UI トグル `MESH_GENERATION_METHOD_CHOICES` に v7 選択肢、`selectMethod`→`previewMeshDraft(method)` 貫通。test L40-53 が契約登録を、L300-322 が v7 生成の stableId トークンを検証 |
| 2 | v7 出力が3特徴を構造的に持つ(被覆保証 / 輪郭頂点間隔 ≈ L / 細長領域の内部点0) | **pass** | 被覆保証=test L99-134 フルスキャン。細長内部点0=test L181-201。プリセット単調性(L が頂点密度を支配)=test L75-93/L225-248。細長抑制で毛先を少数三角形で包む(特徴3)構造を確認 |
| 3 | 被覆保証・ε<r・決定性の3不変条件がテストで担保 | **pass** | 観点a核心1。3条件すべて専用テストで assert。v7 に乱数なし(grep 0件) |
| 4 | v6 決定性回帰14個を含む既存テストが全 green(v6 挙動バイト同一) | **pass** | authoring-core 276/276 green(`mesh-generation.test.ts` 76 tests 内包)。Domain A/B レビューで v6 回帰14個の座標同一 `toMatchObject` を既確認、本再実行でも全 green |
| 5 | v7 実装ファイルが v6系ファイルを import していない | **pass** | 観点a核心2。v7 全ファイル import grep で v6 依存0件 |
| 6 | preview スキーマ・package-format スキーマ・外部依存・lockfile が無変更 | **pass** | `git status`/`diff` で model-edit.ts・package-format・pnpm-lock.yaml・全 package.json 無変更。delaunator/@kninnug/constrainautor は authoring-core の既存 dep(新規追加なし) |
| 7 | pnpm install をエージェントが実行していない | **pass** | lockfile 無変更(git diff 0)。Gnome 報告 §質問4 で install 未実行を明言。lockfile が baseline のままである事実が裏付け |
| 8 | baseline 既存 fail(check:deps / 横断テスト約12件)が是正済み、または escalate 残件がユーザー裁定付きで明示 | **pass** | check:deps 再実行 pass(Domain R 1ループ目の誤検知精密化)。横断テストは operation/validator/runtime-core 732/0(Domain R が tutorial 4件ほか是正)。self-test claim 走査は別タスク化(ユーザー裁定済み・ゲート非含)として final-report §3(a) に明示 |
| 9 | 関連ドキュメントが実装事実に整合 | **pass** | 観点c。6ドキュメントすべて実装事実整合、未合意方針混入なし |

**全9項目 pass。**

---

## 差分・残課題

- **要修正: なし。**
- 既知残件(いずれも mesh Wave scope 外・ユーザー裁定/後続 wave へ正しく送り済み):
  1. apps/editor 4 fail(diagnostics-jump-actions entry リネーム追随漏れ・wave106 P3)。mesh 非起因の editor 別課題。後続 wave で追随。
  2. `check-dependencies-guard-self-test.mjs` の claim 走査未実装(別タスク化済み・ゲート非含)。
  3. v7 の `computeMeshQualityMetrics`(V6型)依存 = Mesh Wave 2 計画の入力(_map.md 未決 + final-report §3(c) に記録済み)。
  4. `projectPresetAlias` / preset 初期化 operation = 将来設計案件(_map.md 未決に記録済み)。
- 次の gate は **ユーザー目視評価**(コードで代替不能)。final-report §4 の手順が正。

## 質問

なし。委任プロンプトの4観点すべてを自己確認で完了し、判定を確定できた。
