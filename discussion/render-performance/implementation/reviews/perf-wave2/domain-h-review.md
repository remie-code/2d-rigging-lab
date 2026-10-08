# Perf Wave 2 / Domain H レビュー — 統合 / before-after / ドキュメント整合

> レビュー担当: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）
> レビュー日: 2026-07-08（同一マシン: Windows 11 / Ryzen 7 5700X / Node v22.14.0 / vitest 3.1.4）
> 対象: Domain H の統合成果（after-wave2-synthetic.md / final-report.md / domain-h-report.md / improvement-design.md / render-performance/_map.md）
> 前提: Domain F/G の実装コード適合は 4 レビュー合格済みで本レビューの対象外。本レビューは統合成果の正しさを検証する。

---

## 判定: **合格（pass）**

5 観点すべてで、成果物の主張が自己再実行・突合により再現・整合した。要修正の差分は **なし**。ドキュメントへの未合意方針の混入もなし。切り分けガイドは実際の git status と漏れなく整合。以下、観点別の検証実測を示す。

---

## 観点 1: before/after 表の数値再現（ベンチ自己再実行 — 必須）

**RUN_PERF_BENCH=1 で `synthetic-heavy-model.bench.test.ts` を自己再実行**（10 tests passed, exit 0）。after 文書の代表値（run1）と私の再実行値を照合:

| scale | canvas.evaluation avg（after文書 run1 / 私の再実行） | assembly.rigControls total（after run1 / 再実行） | deformerVertex total（after run1 / 再実行） |
|-------|------|------|------|
| light    | 0.273 / **0.283** | 0.021 / **0.026** | 2.731 / **2.850** |
| medium   | 1.782 / **2.086** | 0.014 / **0.016** | 17.293 / **22.219** |
| heavy    | 20.329 / **19.836** | 0.030 / **0.031** | 321.076 / **310.944** |
| rigHeavy | 10.616 / **10.582** | 0.024 / **0.023** | 37.249 / **36.716** |

**核心結論はすべて再現**:
- **主犯 `assembly.rigControls` のゼロ化**: 全 4 scale で total 0.016〜0.031ms（実質ゼロ）。after 文書の「0.02〜0.03ms total（実質ゼロ）」と一致。案A の選択駆動遅延化が rig 非選択経路で効いていることを再確認。
- **deformerVertex の大幅削減**: heavy/rigHeavy は after 文書値の近傍で再現。medium は私の再実行で 22.219（文書 run1=17.293 / run2=19.937 よりやや高い）だが、after 文書自身が run1/run2 変動を明示し「絶対値は実行時変動」と断っており、削減の定性的結論（before 192.116 → after 17〜22 台、−88〜91%）は揺るがない。桁・傾向として再現。
- **artworkBoundsAndAssembly（親）の縮小**: rigHeavy で total 0.82ms（文書 0.848 近傍）。設計 §5「rigHeavy で artworkBoundsAndAssembly がほぼ消える」を再確認。

**before 値の引用照合**: after 文書 §3 の before 列（全 4 scale・全スパン）を baseline-synthetic-v3.md §4 と 1 セルずつ照合。全一致（例 rigHeavy: evaluation 89.153 / assembly.rigControls 67.824ms/eval / artworkBoundsAndAssembly 67.935ms/eval、medium: evaluation 13.690 / deformerVertex 9.606、heavy: deformerVertex 201.628 等すべて原典と一致）。誤引用なし。

**測定意味論の記述**: after 文書 §0 の「`selection: null` = rig 非選択 = スライダー操作の主経路」の説明は正しい。ベンチ出力の caller counter が全 scale で `canvas.evaluation.caller.unknown = 20`（ベンチは caller タグ非付与）であり、rig 非選択・全件評価不要の主経路を測っていることと整合。案A により rig 非選択で必要集合が空になり rigControls がゼロ化する説明も、再実行の assembly.rigControls 実質ゼロで裏付けられる。

→ **観点 1 合格**。

## 観点 2: 全体検証の主張と実行結果の一致

各コマンドを自己実行し照合:

| 検証 | 文書の主張 | 私の再実行 | 一致 |
|------|-----------|-----------|------|
| root typecheck（`pnpm run typecheck`） | PASS（exit 0） | **exit 0** | ✅ |
| apps/editor typecheck（`tsc -p apps/editor/tsconfig.json`） | 22 errors / F/G ファイル 0 件 | **error TS 22 件 / canvas-evaluation・canvas-projection に grep 0 件** | ✅ |
| root test:unit（`vitest run packages --exclude ...`） | 234 files / 1455 tests PASS（fail 0） | **234 passed / 1455 passed（fail 0）** | ✅ |
| apps/editor canvas（`vitest run apps/editor/src/workspace/canvas`） | 110 passed / 4 skipped | **110 passed / 4 skipped（11 files）** | ✅ |
| check:deps（`node scripts/check-dependencies.mjs`） | PASS | **"Dependency guard passed."** | ✅ |
| check:source（`node scripts/check-source-organization.mjs`） | PASS | **"Source organization guard passed."** | ✅ |

**「既知2つ以外の fail はゼロ」の主張**は再現した。root packages は 1455/1455 green、canvas は 110/110 green。apps/editor workspace の 4 failed（= diagnostics-jump-actions 4 件）と apps/editor pre-existing 型 22 件が既知除外であり、F/G 変更ファイル（canvas-evaluation.ts / canvas-projection.ts / canvas-evaluation.test.ts）には型エラー 0 件（grep で確認）。核心の主張は正しい。

→ **観点 2 合格**。

## 観点 3: ドキュメント更新が実装事実と一致し未合意方針の混入がないか

- **improvement-design.md**: Status → `Implemented(Perf Wave 2, 2026-07-08)`、Accepted 履歴を保持。§6 の削減率（medium −87.0% / heavy −91.3% / rigHeavy −88.1% / light −67.3%、主犯 rigHeavy 67.824→0.001ms/eval）は after 文書と一致。**案C は §4「保留」のまま本文改変なし**（28-30 行、A+D 後の実モデル計測003で dev 体感未達なら次弾、の記述を保持）。**60fps 続行可否は §1 と §6 で「実数で判断」「ユーザー実モデル計測003待ち」のまま**、勝手な「達成」等の記述なし。未合意方針の混入なし。
- **render-performance/_map.md**: improvement-design 行 Status→Implemented、measurements 行に after-wave2-synthetic 反映。「次の行動」が **「Perf Wave 2 完了 → ユーザー実モデル計測003（avg ≤ 33ms なら 30fps 達成）」** に更新済み。案C は「保留のまま」。実装事実と整合。
- **30fps 判定 / StrictMode 二重評価の読み方**: final-report §7-2「avg ≤ 33ms なら 30fps」、§7-3「本番相当=1回分 / dev 体感=2回分（avg×2、dev で 30fps なら avg ≤ 16.5ms）」は double-evaluation-diagnosis.md（「本番では StrictMode 二重実行は起きない」「評価92=描画46×2」）と正確に整合。原典の機序（本番=1回 / dev=2回）を誤りなく反映。

→ **観点 3 合格**。

## 観点 4: コミット切り分けガイドと git status の整合

**final-report §8 の「実際の git status（実測）」ブロックを、私が実行した `git status --porcelain` と 1 行ずつ照合 → 完全一致**（M 9 件 + ?? 5 件、漏れ・余剰なし）。

**Gnome の「委任前提は3層だったが実際は2層（mesh系は既コミット済み）」という主張を検証**:
- `git status --porcelain | grep -i mesh` → **空**（未コミットの mesh 変更なし）。
- 直近コミット `04e24cdb`（= 委任プロンプトの `6749b520` と同一メッセージ「meshv7を作成、選べるようにした」。リベース/amend で hash が変わっている）の `git log --stat` に、**mesh-tool-inspector.tsx / mesh-tool-state.ts / mesh-geometry/*（alpha-mask, boundary-tracing 等）/ mesh-generation-v7-*（pipeline, margin-contour, parameters）が含まれる**ことを確認。mesh 系は既コミット済み。
- → **Gnome の主張は正しい**。切り分けガイドが実態（層A: Perf Wave 2 F/G、層B: Perf Wave 1.x 計測基盤、層C: ドキュメント、層D: tgz 生成物）に基づく 2 層構成であることは妥当。

**帰属根拠の妥当性検証**:
- 層B の caller 計装ファイル（canvas-preview-panel.tsx / viewer-clean-stage.ts / viewer-runtime-screen.tsx）の差分実体を `git diff` で確認 → **各 1 行の `evaluationCaller:` タグ付与のみ**（"canvas" / "viewerCleanStage" / "viewerRuntime"）。F report が「canvas-preview-panel.tsx は無改修」「F/G の変更ファイル一覧に無い」と明記していることと整合し、Wave 1.x 計測基盤への帰属は妥当。
- 層A の canvas-evaluation.ts / canvas-projection.ts / canvas-evaluation.test.ts が F/G 実装（+ 層B の Wave 1.x hunk が同一ファイルに混在）という注記も、これらが実際に M 状態にあることと整合。

→ **観点 4 合格**。

## 観点 5: 成果物の内部整合

final-report / after-wave2-synthetic.md / domain-h-report.md の 3 文書間で数値矛盾なし:
- evaluation 全体削減率（light −67.3% / medium −87.0% / heavy −91.3% / rigHeavy −88.1%）— 3 文書とも同一。
- 主犯 rigHeavy（67.824→0.001ms/eval、−99.998%）/ 親 artworkBoundsAndAssembly（rigHeavy −99.94%）— 3 文書とも同一。
- deformerVertex 削減率（medium −91% / heavy −92% / rigHeavy −79.7% / light −68.1%）— 3 文書とも同一。
- git status 実測ブロック（final-report §8 と domain-h-report §8）と実際の git status — 一致。

→ **観点 5 合格**。

---

## 差分・残課題

**なし**（要修正の差分はゼロ）。

補足（レビュー対象外だが記録）:
- 委任プロンプトが挙げた HEAD コミット hash `6749b520` は、現在 `04e24cdb`（同一コミットメッセージ）にリベース/amend されている。内容（mesh 系を含む）は同一のため切り分けガイドの結論に影響なし。
- final-report §5〜§6 が提起する「apps/editor のユニットテスト・型検査が root CI（pnpm check / test:unit / typecheck）で回らない」事実は、私も root tsconfig の include（packages/* / scripts / vitest.config.ts のみ、apps/** 非対象）を実読して確認済み。これは Domain H が正しく事実として記録し、修正は方針判断として escalate している。妥当な対応（scope 外を勝手に実装しない）。

## レビュー実行の非破壊確認

- ベンチ・テスト・typecheck の実行に RUN_PERF_BENCH env を一時使用したのみ。production / テスト / 成果文書は一切改変していない。
- レビュー実行後の `git status --porcelain` がレビュー開始時と**完全一致**であることを確認済み（M 9 件 + ?? 5 件、変化なし）。恒久変更なし。
- 本レビューレポート（domain-h-review.md）の新規作成のみが唯一の書き込み。

## 質問（Orch-Sylph へ）

1. **CI 経路の escalate（final-report §10 質問1）**: apps/editor のユニットテスト（canvas 系 = F/G 等価テスト）と型検査が root CI で回らない件は、Domain H が正しく事実記録し方針判断として escalate している。本レビューではこれを「妥当な未修正」と判定したが、Perf Wave 2 の**完了条件に含めるか否か**は Orch-Sylph / L0 の裁定事項。レビュー観点としては「Domain H が scope 外を勝手に実装しなかったこと」は適切と判断。
2. **pre-existing 型エラー 22 件 / diagnostics-jump-actions 4 件**: いずれも別 WIP・wave106 既知 baseline 由来で F/G/H scope 外という前提を、私も再実行で裏付けた（F/G ファイルに型エラー 0、workspace の 4 failed はすべて diagnostics-jump-actions）。この前提（Perf Wave 2 完了条件外）でよいか最終確認されたい。
