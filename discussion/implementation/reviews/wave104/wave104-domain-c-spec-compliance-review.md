# Wave104 Domain C — Spec Compliance Review

Verdict: pass

Reviewer: Review-Sylph (Spec Compliance lane, Domain C / Measurement + ref e2e)
Date: 2026-07-03
Basis: `discussion/implementation/orchestration/wave104-plan.md` §8 (Domain C, conditional write scope 2 件含む) / §3.3 (測量仕様) / §3.4 (テクスチャ寸法解決, 2026-07-03 改訂含む) / §3.5 (ref e2e・ユーザー目視 gate) / §10 (Domain C 明示確認項目) / §3.1-2。

## 要約

Domain C の実装は仕様に適合している。必須確認項目 10 件 + 追加 3 件をすべてソース・差分・実テスト実行で検証し、blocking finding は無い。

- **ref/ 無変更**を git status/diff で実証。フル ref e2e 実行後も `git status --short ref/` は空を維持。
- **e2e 決定論**（同一リクエスト 2 回でバイト一致の PNG、および測量数値の完全一致）が実在し、自分の実行で pass を確認。
- **PNG ↔ サイドカー整合**および §3.2 必須フィールド充足を実ファイルで確認。
- **README の目視 gate 説明**が各 PNG の内容・生成コマンド・サイドカーの読み方・目視 gate 対象物である旨を網羅。
- **測量ユニットテストの期待値は独立導出**（オウム返しでない）。
- **§3.4 改訂遵守**: texture-resolution.ts に無検証の寸法採用経路が無いこと（byteLength 厳密一致のみ採用、不一致・曖昧は決定論的 reject）を構造分析で確認し、**ref 126 per-layer テクスチャ全件 derived-verified** を実テストで再現。
- **runtime-core optional export の非破壊性**: 追加は additive optional field + 純ヘルパのみで既存スナップショットフィールド無変更。既知の先行 failed 2 件は runtime-core 変更を revert しても再現＝clean HEAD 起因と実証。新規 export テスト 3 件 pass。
- **boundary 非緩和**: ai-interface に render-core/render-software 依存追加なし、dependency-boundary テスト・package.json 無変更。
- **capability**: inspectEvaluatedGeometry は `read` capability でゲート。
- **forbidden scope**: Editor/Player/render-webgl2/operation-core/validator-core-src/package-format-src 無変更。lockfile 変更は workspace importer link のみ（Domain B 再検証で承認済み分類と同一）＝新規外部依存ゼロ。

---

## 確認項目ごとの判定

### 1. ref/ が無変更 — PASS

- `git status --short ref/` 空、`git diff --stat ref/` / `git diff --cached --stat ref/` とも空。
- フル ref e2e（`ref-e2e.test.ts` 4 tests, PNG 再生成含む）実行**後**にも `git status --short ref/` が空（exit 0）を再確認。ref はロード元として read-only、成果物は `discussion/model-authoring/experiments/ref-render-gate/`（ref/ 外）に出力される。
- テストコードでも state directory は常に `tmpdir()` 配下（`makeStateDir`）で ref/ 外、出力先は `REF_GATE_DIR`（ref/ 外）に固定。

### 2. e2e 決定論 — PASS

- `ref-e2e.test.ts` の "renders the user visual gate PNGs ... deterministically"（L177-231）が、同一リクエストを fresh directory に再レンダし `rerunBytes.equals(firstBytes)` でバイト一致を assert。**自分の実行で pass**。
- 測量側も "measures evaluated geometry deterministically ..."（L233-315）が 2 回目リクエスト結果を `secondResult.results` で `toEqual(result.results)` 完全一致 assert。pass。
- 合成側の裏付けも実行 pass: `render-view-file-output.test.ts` "byte-identical PNG bytes across two runs"（authoring-host 50 passed に含む）。

### 3. PNG ↔ サイドカー整合・§3.2 必須フィールド — PASS

- `ref-render-gate/` に 3 PNG（`ref-rest-full.png` / `ref-face-focus.png` / `ref-eyes-viewport.png`）各々に `*.render-view.json` が対応。サイドカーの `pngPath` が対応 PNG を逆参照。
- §3.2 必須フィールド充足を実サイドカー（`ref-eyes-viewport.render-view.json`）で確認: `packagePath`、`packageRevision`(1844)、`parameterOverrides`([] = rest)、`resolvedView`（`stageViewport` / `outputWidth`(1024) / `outputHeight`(436) / `pixelsPerStageX`(3.7925...) / `pixelsPerStageY`(3.7913...)）。加えて `textureDimensionSources[]`（§3.4 改訂記録）。
- スキーマ enforcement 確認: `RenderViewSidecarSchema`（`ai-render-view-command.ts` L131-147）が上記フィールドを要求。ビルダ `buildRenderViewSidecar`（`render-view-sidecar.ts`）は `resolvedView` の各値を `ResolvedSoftwareRenderView` から転記し `RenderViewSidecarSchema.parse` を通す。
- e2e 内 stale-image guard: `result.sidecar.packageRevision === result.packageRevision` を各 PNG について assert（L209）。

### 4. README の目視 gate 説明 — PASS

`ref-render-gate/README.md` を精読。以下を網羅:
- 各 PNG の内容・view 種別・「何を目視チェックすべきか」の表（L32-36）。
- 再現コマンド（`npm run test:ref-e2e` / `npx vitest run ...ref-e2e.test.ts`, L16-24）。
- サイドカーの読み方: `packageRevision`（stale 判定）、`resolvedView` による image→stage 座標変換式（`stageX = stageViewport.minX + px / pixelsPerStageX` 等, L46-52）と、画像上観測を操作量へ翻訳する具体例。
- 「判定梯子最上段・ユーザーが目視して描画正しさを承認する gate の対象物」である旨（L3-7）。
- `textureDimensionSources`（§3.4 改訂）と測量 companion の説明、レンダラ mask 意味論の注意書き。

### 5. 測量数値の非オウム返し検証 — PASS

- `perception/measurement-command.test.ts`（4 tests, 実行 pass）:
  - drawable bounds: 有限・正の sanity + missing の not found。加えて "matches the shared perception snapshot ... (not re-derived)" は実装が共有評価スナップショットの `bounds`/`vertices` と一致することを cross-check（同一評価器を共有している証明であり、期待値は独立の評価経路から取得）。
  - warp 制御点: 期待値を「3x3 グリッドが 100x200 domain rect 上に均等配置 → 4 隅が rest ノードに存在し全点が domain rect 内に収まる」という**幾何学的独立導出**で assert（L145-160）。実装式（restControlPoints + offset）のオウム返しではない。さらに snapshot 直参照値との一致も cross-check。
- `ai-measurement-command.test.ts`（7 tests, 実行 pass）でスキーマ round-trip / discriminated union を検証。

### 6. §3.4 改訂遵守（無検証の寸法採用経路が無い） — PASS

`apps/authoring-host/src/perception/texture-resolution.ts` を全読・経路分析:
- **Rung 1（declared）**: `assertExactByteLength`（L360-374）が `byteLength === width*height*4` を必須検証。不一致は `byteLengthMismatch` throw。
- **Rung 2（derived-verified）**: 候補源 = 参照 drawable の rest mesh bounds（整数・正のみ, `deriveDimensionCandidates` L277-304）。`width*height*4 === byteLength` を満たす候補のみ `verified`（L225-229）。`verified.length===0` → `byteLengthMismatch` reject、`verified.length>1`（例: 2x6 と 3x4 が同 byteLength）→ `missingDimensions`（ambiguous）reject、候補ゼロ → `missingDimensions` reject。採用は `verified.length===1` のみ。
- **結論**: 採用に至る全経路が例外なく byteLength 厳密一致を通過。bounds からの無検証採用経路は構造的に存在しない。採用種別（declared / derived-verified）は `resolveTextureDimensionSources` で記録され sidecar に転記（黙らせない）。§3.4 改訂の不変量「検証された寸法のみ・無検証 bounds 推定禁止」を保存。
- **ref 126 テクスチャ再現**: `ref-e2e.test.ts` "resolves derived-verified dimensions for every per-layer texture ..."（L147-175）が ref の 126 使用テクスチャ全件について `resolveTextureDimensionSources` を実行し、`records.every(r => r.dimensionSource === "derived-verified")` を assert（strict ladder ゆえ全 pass = 全件 byteLength 厳密一致の証明）。さらに render 経路の各 sidecar も 126 件全 derived-verified を assert（L213-218）。**自分の実行で pass**。テスト自身のコメントが指摘する通り、strict ladder の full pass が exact byteLength 一致の証明を兼ねる。
- derivation ユニットテスト（`texture-resolution-derivation.test.ts`, 5 tests, 実行 pass）: derive+verify 成功 / off-by-one reject / 非整数候補ゼロ reject / 曖昧 reject（4x4 vs 8x2 = area 16 の独立構成）/ declared 優先。期待値はフィクスチャ mesh bounds から独立取得でオウム返しでない。

### 7. runtime-core optional export の非破壊性 — PASS

- `git diff HEAD -- packages/runtime-core/src/rig-control-evaluation.ts` 精査: 変更は (a) `Vec2DtoSchema` import 追加、(b) `EvaluatedRigControlSchema` への `evaluatedControlPoints: z.array(Vec2DtoSchema).optional()` **additive optional** 追加、(c) warp 評価内で内部計算済み `latticeEvaluation.localState.controlPointOffsets` から `computeEvaluatedWarpControlPoints`（純関数）を呼び result に optional spread、(d) 純ヘルパ関数 1 個の追加。**既存スナップショットフィールドの改名・削除・意味変更はゼロ**。評価挙動は変えず、既に内部で計算済みの値を公開するのみ（§8 conditional 選択肢 1 に厳密適合）。
- 新規 export テスト `rig-control-evaluated-control-points.test.ts`（3 tests）**実行 pass**。
- **既知の先行 failed 2 件の分類を実証**: `runtime-grid2d-keyform-fixture.test.ts` / `wave30-tutorial-mini-model-contract-fixtures.test.ts` の 2 件は commit 失敗系（"Expected op...to commit"）で本 export と無関係。`git stash push -- packages/runtime-core/src/rig-control-evaluation.ts` で **runtime-core 変更を revert した状態でも同 2 件が再現**することを実行確認 → clean HEAD 起因であり Domain C 由来の退行ではない。stash pop で復元済み。差し引き runtime-core: 34 passed / 2 pre-existing failed、退行ゼロ。

### 8. boundary 非緩和 — PASS

- `packages/ai-interface/src/` に render-core / render-software の import 追加ゼロ（grep でヒットするのはコメント文言のみ。runtime-core は `dependency-boundary.test.ts` の**禁止リスト**側に既存記載）。
- `packages/ai-interface/package.json` 無変更、`dependency-boundary.test.ts` 無変更（`git diff HEAD` 空）、テスト 5 件 pass。
- 承認ライフサイクル: Domain C は read/measurement 系のみで dry-run/commit 経路に触れていない（`ai-command-executor.ts` の Domain C 追加は read dispatch への `inspectEvaluatedGeometry` 分岐追加のみ、承認ポリシー無変更。executor 変更は Domain A/B と共有ファイルだが Domain C 分に破壊はない）。

### 9. capability（inspectEvaluatedGeometry = read ゲート） — PASS

- `ai-read-command.ts` `hasRequiredReadCapability`（L72-75）: `validatePackage` のみ `validate`、それ以外（= inspectEvaluatedGeometry 含む）は `read` capability を要求。capability 不足時 `permission_denied`。
- executor 経路も `#executeReadCommand` → `executeAiReadCommand` に委譲し同 capability チェックを通す。
- 契約テスト `ai-read-command.test.ts`（11 tests）/ `ai-executor-read-integration.test.ts`（6 tests）実行 pass。

### 10. forbidden scope — PASS

- `git status --porcelain | grep -E "apps/editor|apps/runtime-player|render-webgl2|operation-core|validator-core/src|package-format/src"` → 該当ゼロ。
- 新規外部依存: なし。`pnpm-lock.yaml` の +12 行は workspace `link:` importer 登録のみ（外部 registry / resolution / version 追加行ゼロを実確認）。これは Domain B 再検証が「workspace importer 登録・承認済み分類・新規外部依存に非該当」と判定した内容と同一で、Domain C 由来の新規外部依存ではない。

---

## Findings

### Blocking

- なし。

### Non-blocking

- **C-NB-1（記録のみ、Domain C 責務外）**: ref の `validatePackage` は `strict` プロファイルで error:97 を返す（e2e ログ `REF_E2E validate counts {"info":0,"warning":0,"error":97,"blocking":0}`）。これは §3.5 の設計どおり「診断内容は fail 条件にせず記録対象」であり e2e も gate していない。ref は実運用モデルであり診断有無自体は Domain C の合否と無関係。将来のバリデータ/ref 整合の topic として記録に留める。
- **C-NB-2（設計上の注意、非欠陥）**: derived-verified の候補源は「参照 drawable の rest mesh bounds が整数寸法」であることに依存する。ref では 126 件全てこの前提を満たすことを実証済みだが、mesh bounds が非整数のモデルでは `missingDimensions` reject となる（＝黙って推定しない正しい挙動）。§3.4 改訂の不変量は保存されており blocking ではない。texture-resolution.ts のコメント（L269-276）が ref に対する bounded 検証根拠を明記しており適切。

---

## 確認した証拠の要約

- git: `ref/` は status/diff とも空、フル e2e 実行後も空。forbidden scope 該当ゼロ。lockfile +12 は workspace link のみ。
- 実テスト実行（自分で）: ai-interface 17 files/107 passed（measurement 6・render-view 7・read-integration 6・dependency-boundary 5 含む）。authoring-host 12 files/50 passed（ref-e2e 4・measurement-command 4・texture-resolution-derivation 5 含む）。runtime-core 34 passed/2 pre-existing failed（revert で clean HEAD 起因を実証）。runtime-core 新 export test 3 passed。`tsc --noEmit` exit 0（Domain C ファイルにエラーなし）。
- ソース精読: `ai-measurement-command.ts`（スキーマ・capability=read）、`perception/measurement-command.ts`（host 実装、共有評価器再利用）、`authoring-host-command-host.ts`（read host 配線）、`rig-control-evaluation.ts` diff（additive optional export）、`texture-resolution.ts`（§3.4 改訂 ladder、無検証採用経路なし）、`render-view-command.ts`（textureDimensionSources 配線）、`render-view-sidecar.ts` / `ai-render-view-command.ts`（§3.2 フィールド + §8 追記 2 の optional スキーマ）。
- 成果物: `ref-render-gate/` に 3 PNG + 3 sidecar + measurement-gate.json + README、全て §3.2 / §3.5 要件充足。

## 質問（Orch-Sylph 宛て）

なし。§8 conditional write scope 2 件（runtime-core 狭い export / texture-resolution.ts 検証付き導出）はいずれも計画の許容範囲・justification 通りに実装され、非破壊性・非退行を実証済み。lockfile 更新は Domain B 再検証で L0 承認済みの分類（workspace importer link）と同一であり Domain C 固有の新規判断を要さない。

## レポートパス

`discussion/implementation/reviews/wave104/wave104-domain-c-spec-compliance-review.md`
