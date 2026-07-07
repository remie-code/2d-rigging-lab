# Domain F 案A レビュー — レーン1「設計適合」

> レビュー: Review-Sylph（設計適合レーン、サブエージェント委任、呼び出し元 Orch-Sylph）
> 対象: Perf Wave 2 / Domain F「案A 選択駆動遅延化」
> 設計オラクル: `improvement-design.md` §2 / `design-inputs.md` §1-3 / `perf-wave2-plan.md` §3
> 判定: **合格（軽微な報告事項1件・質問1件あり）**
> スコープ: 設計適合のみ。テスト実効性・再実行はレーン2担当のため未検証。

---

## 1. 設計適合（セクションごと）

| 重点ポイント | 判定 | 根拠 |
|---|---|---|
| 1. 契約変更の範囲（全件→選択駆動部分集合、非選択時は空） | ◯ | 下記 §2 |
| 2. 祖先チェーンの扱い（祖先非列挙の裁量が数値等価か） | ◯ | 下記 §3（核心） |
| 3. preview 経路の一体化 | ◯ | 下記 §4 |
| 4. オーバーレイ解決の追従（部分集合でも同一結果） | ◯ | 下記 §5 |
| 5. 計測フック維持 | ◯ | 下記 §6 |
| 6. 禁止 scope 遵守 | ◯ | 下記 §7 |
| 7. 設計に無い判断分岐（deformerTreeSet 除外等） | ◯ | 下記 §8 |

---

## 2. 契約変更の範囲（重点1）◯

`createCanvasEvaluatedRigControls`（`canvas-evaluation.ts:583-`）に第3引数 `requiredIds: ReadonlySet<EvaluationRigControlId>` を追加。
- `requiredIds.size === 0` → `[]` を返す（非選択時は空）。
- それ以外 → `rigControls.filter(rc => requiredIds.has(rc.id)).map(...)` で部分集合のみ評価済み DTO 化。

`resolveRequiredEvaluatedRigControlIds(options)`（`canvas-evaluation.ts:620-638`）が必要集合を算出:
- `selection.kind === "rigControl"` → `selection.id`
- `rigDraft !== null` → `DRAFT_RIG_CONTROL_ID`
- `controlPointPreview?.rigControlId` → 追加
- `rotationPreview?.rigControlId` → 追加

設計 §2「必要 rig 集合 = 選択中 + preview draft + 評価に必要な祖先チェーン。非選択時は空」と一致（祖先チェーンの扱いは §3 で詳述、これは設計意図に照らして正当）。

**ID 整合を確認**: committed rig control の内部 id は `input.rigControl.rigControlId`（`createEvaluationWarpRigControl:456` / `createEvaluationRotationRigControl:504`）で `RigControlId` と同値。draft は `DRAFT_RIG_CONTROL_ID`（`createEvaluationRigDraft:534`）。必要集合へ入れる値（`selection.id` / `preview.rigControlId` / `DRAFT_RIG_CONTROL_ID`）が `EvaluationRigControl.id` と型・値ともに一致するため、`requiredIds.has(rc.id)` フィルタが正しく機能する。

## 3. 祖先チェーンの扱い（重点2・核心）◯ — 裁量判断は妥当

**Gnome の裁量（祖先を出力部分集合に列挙しない）はコード追跡により数値等価を満たすことを確認した。**

- `createCanvasEvaluatedWarpRigControl(rigControl, rigControlsById)`（`:641-669`）:
  - L645 `createDrawableRigControlChain(rigControl, rigControlsById)` が `rigControl` を起点に `parentId` を辿り、祖先全段を含むチェーンを構築（`createDrawableRigControlChain:796-816`、`while` で `parentId` を `rigControlsById.get` し `chain.unshift`）。
  - L647-649 rest 制御点に `applyRigControlChainToPoint(point, chain)` を適用し、祖先変形を畳み込む。
- 鍵となる不変点: フィルタは `rigControls`（全件）から必要集合で絞るが、**チェーン解決に渡す `rigControlsById` はフィルタ前の全件 Map**（`canvas-evaluation.ts:249` で構築、L356 でそのまま渡す。今回変更なし）。したがって選択1個の評価でも祖先全段にアクセスでき、祖先変形が内部合成される。
- rotation も同型（`createCanvasEvaluatedRotationRigControl:671-698`、`applyRigControlChainToPoint(rigControl.pivot, chain)`）。

⇒ 出力配列に選択 rig 1個だけを入れても、その `evaluatedControlPoints` / `domainBounds` / `pivot` は従来の全件評価と**同一 rig について byte 一致**。設計不変条件「評価された rig の形状値は従来と数値同一」を満たす。設計文書の「必要 rig 集合 = 選択 + 祖先チェーン」は「祖先の効果を反映して選択 rig を評価する」意味であり、**出力配列への祖先ノード列挙は不要**。Gnome の解釈は設計意図に忠実。

**消費者が祖先ノードの DTO を必要としないことも確認**: `resolveDeformerOverlay` は選択1個（または draft 1個）の `evaluatedControlPoints` / `domainBounds` / `pivot` のみ使う（`canvas-projection.ts:412-417` / `398-404`）。祖先ノードの評価済み DTO を配列から引くことはない。design-inputs §2 と一致。

## 4. preview 経路の一体化（重点3）◯

配線を追跡し、preview が同じ遅延評価を通ることを確認:
- rig ドラッグ preview: `canvas-preview-panel.tsx:196` `createProjection({ controlPointPreview })` / `:206` `({ rotationPreview })`。
- → `createCanvasRenderProjection(session, selection, options)`（selection 同伴）。
- → `createCanvasEvaluatedScene(session, { ..., selection, controlPointPreview, rotationPreview })`（`canvas-projection.ts:198-215`、preview 引数が到達）。
- → `resolveRequiredEvaluatedRigControlIds`（`:250`）が `controlPointPreview.rigControlId` / `rotationPreview.rigControlId` を必要集合へ追加。

selection と preview.rigControlId を**独立に**集合へ加えているため、両者が食い違っても preview 対象は漏れない（設計の明示要求どおり）。`canvas-preview-panel.tsx` / interaction フックは論理無改修（preview panel には既存基盤由来の `evaluationCaller: "canvas"` 追加のみ、§6 参照）。**preview 経路の一体化は Gnome の主張どおり成立。**

## 5. オーバーレイ解決の追従（重点4）◯

`resolveDeformerOverlay`（`canvas-projection.ts:392-418`）は論理無改修。部分集合でも同一結果を返すことを確認:
- draft 経路（L398-405）: `input.draft`（= `deformerDraft`）非 null → `.find(status === "draft")`。projection L204 で `deformerDraft → rigDraft` 変換されるため、`deformerDraft` 非 null ⇔ `rigDraft` 非 null ⇔ 必要集合に `DRAFT_RIG_CONTROL_ID` 追加、が連動。draft は必ず集合に含まれ拾える。
- 選択経路（L407-414）: `selection.kind === "rigControl"` → `.find(rigControlId === selection.id)`。選択 id は必ず集合に含まれる（§2）ため拾える。`rigControlId` は `sourceRigControlId`（`:656`/`:683`）= 選択 id と一致。
- その他（drawable / drawableSet / part / deformerTreeSet）: L407 で `undefined`。消費なし。

必要集合が preview 過剰で膨らむ場合でも、`.find` は特定条件でヒットするため誤ヒットしない（過剰評価は性能上の微小コストのみで正当性に無影響）。**部分集合でも同一結果が保証される。**

**唯一の消費者であることを横断検索で再確認**: `evaluatedScene.rigControls`（評価済み）の実消費点は `canvas-projection.ts:291`（→ resolveDeformerOverlay）のみ。他に評価済み rigControls 配列を全件要求する消費者は存在しない（`session.graph.rigControls`〔原本〕参照は別物）。design-inputs §2 の 0〜1 個消費と完全一致。

## 6. 計測フック維持（重点5）◯

`assembly.rigControls.ms` を含む全スパンが維持されている:
- `startLive2dPerformanceTiming` / `recordLive2dPerformanceTiming` / `recordLive2dPerformanceCounter` の import・使用は削除・改名なし（むしろ counter import 追加）。
- 案A対象の `canvas.evaluation.assembly.rigControls.ms` は `createCanvasEvaluatedRigControls` 呼び出しを包む位置に維持（`:353-362`）。遅延化後もスパンが残り、値が小さくなるのみ。

**重要な切り分け**: `git diff HEAD` に大量の計測フック追加（`indexBuild.ms` / `keyform.ms` / `rigControlEval.ms` / `deformerVertex.ms` / `assembly.artworkBounds.ms` / `assembly.rest.ms` / `artworkBoundsAndAssembly.ms` / `caller counter` / `evaluationCaller` 引数・型・viewer 配線）が含まれるが、これらは **Perf Wave 1.3 で導入済みの既存計測基盤**（`baseline-synthetic-v3.md` L62-71・L91-144 に span 名と細分化がすべて既出。plan §1「Perf Wave 1/1.2/1.3 の計測基盤が未コミットで作業ツリーに残置」に該当）。Domain F 由来の論理変更ではなく、pre-existing の未コミット差分。案A由来の変更は `resolveRequiredEvaluatedRigControlIds` 新設 + `createCanvasEvaluatedRigControls` の引数追加・フィルタ + L250/L354-357 の配線に限定されている。

## 7. 禁止 scope 遵守（重点6）◯

`git diff HEAD --name-only` で確認。変更は `apps/editor/src/workspace/*`（canvas-evaluation / canvas-projection / canvas-preview-panel / viewer-clean-stage / viewer-runtime-screen）と `discussion/*` のみ。
- `packages/**` / 保存・export・provenance 経路 / 依存・lockfile / package.json への変更**なし**。
- 案A単体で drawables 経路のロジック・deformerVertex 経路（案D対象）のロジックには触れていない（deformerVertex 周辺は既存計測 span のみ、変換ロジック無改修）。

## 8. 設計に無い判断分岐（重点7）◯ — deformerTreeSet 除外は安全

`EditorSelection`（`editor-selection.ts:3-23`）は 5 kind（part / drawable / drawableSet / rigControl / deformerTreeSet）。`resolveRequiredEvaluatedRigControlIds` は `rigControl` のみを集合に加え、`deformerTreeSet` を含めない。**これは消費者不在ゆえ安全**:
- `resolveDeformerOverlay` は `deformerTreeSet` を消費しない（`canvas-projection.ts:407` `selection?.kind !== "rigControl"` → undefined）。deformerTreeSet 選択時は deformerOverlay を出さない。
- 単一 rig クリックは `createLegacySelectionForDeformerTreeTarget`（`editor-selection.ts:286-300`）で `kind: "rigControl"` の legacy selection に変換される。deformerTreeSet kind になるのは複数選択時のみで、その場合オーバーレイ非表示。

⇒ deformerTreeSet で rig 評価を空のままにしても、消費者が拾わないため視覚的欠落は生じない。設計 §2 も「selection.kind === 'rigControl' のとき selection.id」と限定しており、裁量は設計の限定に忠実。

---

## 9. 差分（要修正事項）

**設計適合上の要修正はなし。** 以下は報告事項（合否に影響しない）。

### 報告事項 R1: レポートの「2ファイルのみ変更 / projection・preview・viewer 無改修」記述はワークツリー実態と不一致
domain-f-report.md §2 は「変更ファイルは canvas-evaluation.ts / .test.ts の2ファイル。canvas-projection.ts / canvas-preview-panel.tsx / rig interaction フックは無改修」と述べるが、`git diff HEAD` では canvas-projection.ts（+10）/ canvas-preview-panel.tsx（+1）/ viewer-clean-stage.ts（+1）/ viewer-runtime-screen.tsx（+1）にも差分がある。**ただしこれらは §6 で確定したとおり Wave 1.3 由来の既存計測基盤（`evaluationCaller` 配線）であり、Domain F の論理変更でも scope 逸脱でもない**。レポートは「案A論理として無改修」の意味では正しいが、ワークツリー全体の差分表現としては誤解を招く。Orch-Sylph 側で「案A由来変更 = canvas-evaluation.ts の rig 部分集合ロジック + テスト」「他ファイルの差分は既存計測基盤」と切り分けて記録することを推奨。

---

## 10. 裁量判断の妥当性評価（総括）

1. **祖先非列挙**（裁量1）: **妥当**。§3 のコード追跡で数値等価を確認。`rigControlsById` 全件経由のチェーン内部合成により、選択1個の評価で祖先変形が畳み込まれる。設計不変条件を満たす。
2. **deformerTreeSet 除外**（裁量2）: **妥当**。§8 のとおり消費者不在で安全。設計の限定に忠実。
3. **preview 経路無改修**（裁量3）: **妥当**。§4 の配線追跡で、既存の selection + preview 引数の流路が必要集合の入力として機能することを確認。

---

## 11. 判定

**合格。** 設計オラクル（improvement-design §2 / design-inputs §1-3 / perf-wave2-plan §3）に対し、案A の契約変更・祖先チェーン扱い・preview 一体化・オーバーレイ追従・計測フック維持・禁止 scope 遵守・裁量判断のすべてが設計適合。要修正の設計差分なし。報告事項 R1（レポート記述とワークツリー実態の切り分け）は Orch-Sylph へ引き継ぎ。

---

## 12. 質問（Orch-Sylph へ）

1. **既存計測基盤（Wave 1.3 由来）の未コミット差分が Domain F の diff に混在している点**: 本レビューは §6 で「案A由来変更 = canvas-evaluation.ts の rig 部分集合ロジック + テスト」「他4ファイルの差分は Wave 1.3 計測基盤」と切り分けて設計適合を判定した。この切り分けが Orch-Sylph の認識と一致するか確認されたい。もし Domain F が計測基盤の一部（例: `assembly.rigControls.ms` span の評価位置移動）も自ドメイン成果として扱う前提なら、その span 配置が設計の計測意図（rig 評価コストを単独スパンで捕捉）と一致していることは §6 で確認済み。
