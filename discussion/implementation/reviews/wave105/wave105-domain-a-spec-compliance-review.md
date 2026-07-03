# Wave105 Domain A — Spec Compliance Review (Review-Sylph, opus)

- Lane: Spec Compliance
- Domain: `wave105-variant-visibility-gate`（知覚経路への Variant 可視性ゲート）
- Reviewer role: Review-Sylph（読み取り専任 + プローブ）、delegated by Orch-Sylph
- Source of truth: `discussion/implementation/orchestration/wave105-plan.md` §3.1 / §6 / §8 / §9
- Basis 読了: wave105-plan（§3.1 裁定・§6 要件・§8 Review Policy・§9 Verification Matrix）/ `variant-feature-survey.md` / Gnome 報告 / 参照実装 `runtime-export-materialization.ts` / Editor 適用実態 `canvas-evaluation.ts` / authoring-core 純関数 `variant-evaluation.ts`

## 総合判定: **pass**

Domain A の Gnome 実装は Spec Compliance の全項目を満たしている。ゲート意味論は survey / Editor / Export 参照実装と同型で、predicate は authoring-core 純関数を消費（再実装なし）。適用は snapshot レベルで、render・測量・framing が同一 gated snapshot を共有する。空ケースは identity で旧挙動と参照同一。サイドカー / 測量に解決済み selection が必須記録され、測量にはゲート後の可視性フラグが載る。ref e2e の 6/9 assert は `ref/model/variants.json` の membership から独立導出され、vacuous pass ガードを備える。Gnome フラグ（`modelEvaluatedBounds` の可視 drawable のみ union）は §3.1 の framing 可視性世界共有の要請に照らして**妥当**であり、維持を裁定する。

検証はプローブ（authoring-host / ai-interface フルスイート 202 passed、root/app tsc exit 0）を含み、`git status --porcelain` の before/after 完全一致で残渣ゼロを実証済み。

## 各検証項目の判定

### 1. ゲート意味論の整合 — **pass**

三者の合成式が同型であることをコードで確認した:

- Export 参照実装 `packages/authoring-core/src/runtime-export-materialization.ts:146,154-155`:
  `baseVisible = normalizedDrawable.visible` → `visible: baseVisible && variantVisibilityPredicate(target.drawable.drawableId)`
- Editor 適用実態 `apps/editor/src/workspace/canvas/canvas-evaluation.ts:320-323`:
  `visible: drawable.runtimeVisibility && !hiddenByPart && variantVisibilityPredicate(drawable.drawableId)`
- 知覚実装 `apps/authoring-host/src/perception/evaluation-adapter.ts:118-121`:
  `visible: drawable.visible && predicate(drawable.drawableId)`

知覚実装が Editor の `!hiddenByPart` 項を含まないのは正しい。`hiddenByPart` は Editor のセッションローカルなパーツ隠し状態であり、計画 §3.1 Forbidden「Editor / Viewer の selection 状態への依存・模倣禁止。知覚経路の正は defaultActive + 明示 override のみ」に厳密に従っている。知覚は Export と同じ `base && predicate` の二層合成であり、これが正しい参照点である。

predicate は authoring-core の純関数 `createVariantVisibilityPredicate`（`evaluation-adapter.ts:6,111`）を直接 import・消費しており、`variant-evaluation.ts:24-41,43-71` の実体を再実装していない。default 導出も `resolveDefaultVariantActiveSelections`（`variant-selection-resolution.ts:2,53`）を消費。survey §再利用点（membership ∩ active ≠ ∅ / 対象外→true）とも整合。

### 2. snapshot レベル適用の実証 — **pass**

ゲートは RenderScene 構築時ではなく snapshot 生成点で適用される。`evaluatePerceptionSnapshot`（`evaluation-adapter.ts:66-89`）が `applyVariantVisibilityGate` を通した **新規 snapshot**（drawables re-map + drawList 再導出、`:118-134`）を返し、この単一 snapshot を:

- render: `render-view-command.ts:67-70,89-93`（`createPerceptionRenderScene` に `base.snapshot`）
- 測量: `measurement-command.ts:46-49`（`snapshot.drawables[].bounds` / `visible`）
- framing: `view-resolution.ts:58`（modelBounds）/ `:76`（drawableFocus）が同じ snapshot を消費

が全て消費する。「目と巻尺が同じ可視性世界を見る」ことは `variant-visibility-gate.test.ts` の測量フラグテスト（`:260-292`、eye→visible:true / eye-mask→visible:false）と ref e2e の gated snapshot 由来 visible 集合の照合（`ref-e2e.test.ts:397-426`）で実証済み。runtime-core は非変更（forbidden-scope diff clean）。

### 3. 空ケース不変（バイト同一）— **pass**

`applyVariantVisibilityGate` は `variantGroups.length === 0` で **入力 snapshot をそのまま返す**（`evaluation-adapter.ts:104-109`）ため、ゲート導入前後で snapshot が参照同一 → 旧挙動とバイト同一が構造的に保証される。実証:

- `variant-visibility-gate.test.ts:57-93`: 空グループ fixture で全 drawable visible=true（identity）+ 空 selections request 有無で render バイト同一 + サイドカー selections=[]。
- 既存 golden の無変更 pass（`render-view-file-output.test.ts` の byte-identical PNG 2 run、ref e2e determinism）が全て緑 — 計画 §6「既存 golden の無変更 pass で実証してよい」を満たす。
- プローブ: authoring-host フルスイート 202 passed（既存 51 の非退行含む）。

一点の note（非ブロッキング）: 空ケーステストは「ゲート内 no-op」を直接検証するが、「ゲート導入前 vs 後」の差分そのものを別々にキャプチャして比較する形式ではない。ただし identity return による参照同一 + 既存 golden 全 pass で旧挙動不変は十分に担保されており、追加テストは不要。

### 4. サイドカー / 測量の selection 記録 — **pass**

- サイドカー: `RenderViewSidecarSchema.variantSelections`（`ai-render-view-command.ts:169`、optional で後方互換）。producer は常に emit（`render-view-command.ts:111,181` の両 call site で `variant.resolved` を渡す）。空グループ時 = 空配列（`variant-visibility-gate.test.ts:86-91`）。
- 測量結果: `InspectEvaluatedGeometryResultSchema.variantSelections`（`ai-measurement-command.ts:155`）+ per-drawable `visible`（`:95`）。`measurement-command.ts:77,105` で resolved echo + gated `drawable.visible` を記録。
- 測量ポリシー（§3.1「隠れたもののジオメトリは返す + 可視性フラグは黙らせない」）: `measurement-command.ts:98-110` で gated-hidden drawable も bounds/vertices を返しつつ `visible: drawable.visible` を載せる。`variant-visibility-gate.test.ts:260-292` で eye-mask が hasBounds:true / visible:false を実証。

「どの衣装で撮ったか」の証明が render・測量・空ケースの全経路で担保されている。

### 5. ref e2e「6 通過 / 9 遮断」assert が実データ由来 — **pass**

`ref-e2e.test.ts:134-153` が `ref/model/variants.json` を実行時に読み、`targetsPassingVariant`（membership.variantIds が対象 variantId を含むか）で期待集合を **パッケージデータから独立導出**する（純 predicate と同じ規則）。プロンプトの id リストはソースになっていない（Gnome 報告 §6 と一致）。

vacuous pass ガードを確認: `:412` `expect(expectedDefaultPass.size).toBe(6)` / `:413` `expect(expectedDefaultBlocked).toHaveLength(9)`。さらに OBSERVED 側は gated snapshot を `inspectEvaluatedGeometry` 経由（render が消費するのと同一の gated snapshot）で測り、`:422` で membership 由来集合とソート後厳密一致、`:423-425` で各遮断 drawable の visible=false を確認。override テスト（`:428-457`、Rodos で通過集合が Default と genuinely 異なることまで assert）と reject テスト（`:459-478`、未知 variant が黙って default に落ちないこと）も実データ由来。

プローブ: ref e2e 7 tests 全 pass（gate 6/9 = 716ms、Rodos override = 2146ms、reject = 382ms）。

### 6.【Orch 追加】Gnome フラグの妥当性判断 — **pass（変更を維持と裁定）**

Gnome は `modelEvaluatedBounds` を「可視 drawable のみ union」に変更した（`evaluated-bounds.ts:121-128`、`filter((drawable) => drawable.visible)`）。裁定: **この変更は妥当であり、維持すべき。全 drawable の union に戻すべきではない。**

根拠:

- `modelEvaluatedBounds` は `view-resolution.ts:58` で `modelBounds` framing（renderView で view 省略時のデフォルト枠）に使われる。framing は「絵に何が写る領域を枠にするか」を決める。ゲートで隠された drawable を union に含めると、**目（render）も巻尺（測量）もその衣装を見ていないのに、枠だけが見えない衣装のために広がる** という不整合が構造化される。これはまさに survey §設計上の急所 1(b)・§3.1 が排除しようとした不整合の framing 版。
- 計画 §3.1 は明示的に「描画・測量・bounds・drawableFocus のすべてが消費する。目と巻尺が同一の可視性世界を共有する」「framing（drawableFocus / modelBounds bbox）が同一の可視性世界を共有することは三位一体設計の前提」と述べる。全 drawable union は framing だけを可視性世界の外に置く点で §3.1 に反する。
- ゲート無しパッケージでの no-op を確認: 空グループ時は全 drawable が visible=true（`applyVariantVisibilityGate` の identity return で base visible がそのまま残る）ため `filter(visible)` は恒等、旧 `unionBounds(全 drawable)` と結果一致。ゲート適用パッケージのみ差が出る。ref e2e の rest-full framing が 392×1024 → 389×1024 に締まったこと（Gnome 報告 §5、余分な衣装 drawable が枠を広げなくなった）はこの正しさの実証。
- `drawableFocus` 経路（`view-resolution.ts:76`、`evaluatedDrawableBounds`）は visible を見ずに bounds を返すが、これは正しい: ユーザーが gated-hidden drawable を明示 focus する用途は §3.1 測量ポリシー「隠れたものを意図的に測る用途は正当」と同型で、可視性フラグは測量で別途返るため黙殺にならない。modelBounds（自動枠）と drawableFocus（明示指定）で扱いが分かれるのは意図的で正しい。

Gnome の Questions（§8 冒頭・§Questions）で挙げた「reviewer が全 drawable union を好むなら revert 可能」に対する回答: **revert 不要。現行の可視 drawable のみ union が正。**

## Gnome フラグ判断への裁定（要約）

`modelEvaluatedBounds` の「可視 drawable のみ union」化は計画 §3.1 の必須要請であり維持する。ゲート無しパッケージで旧挙動と一致することもコード・テスト両面で確認済み。

## 質問（Orch-Sylph 宛）

なし。全項目が実装・テスト・プローブで裏づけられ、Spec Compliance レーンとしてブロッカーは検出されなかった。

（参考: 他レーンの担当だが観測した点 — 空ケース不変テストは identity return + 既存 golden 全 pass で十分担保されているが、もし Test Adequacy レーンが「導入前後の明示的バイト比較」形式の追加テストを望む余地はある。Spec Compliance としては現行で pass。）

## プローブの完全復元証明

- 実行: `npx vitest run apps/authoring-host packages/ai-interface`（202 passed）/ `npx tsc --noEmit`（root exit 0）/ `npx tsc --noEmit -p apps/authoring-host/tsconfig.json`（app exit 0）。いずれも読み取り専用実行。
- ref e2e はテスト内で `ref-render-gate/` に書き込むが、既に Gnome が生成済みの内容と同一（determinism）のため差分なし。
- `git status --porcelain` の before/after を scratchpad で diff → 完全一致（`GIT STATUS UNCHANGED - no probe residue`）。残渣ゼロ。
