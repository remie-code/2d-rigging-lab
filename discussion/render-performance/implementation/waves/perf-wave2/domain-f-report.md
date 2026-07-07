# Perf Wave 2 / Domain F 実装レポート — 案A: rig control 評価の選択駆動遅延化

> 実装: Gnome（サブエージェント委任、呼び出し元 Orch-Sylph）
> Status: 実装・テスト・ベンチ完了
> 設計オラクル: `discussion/render-performance/improvement-design.md` §2 / `design-inputs.md` §1-3

---

## 1. 実装した契約変更の要点

### 必要 rig 集合の算出ロジック
`canvas-evaluation.ts` に `resolveRequiredEvaluatedRigControlIds(options)` を新設。`createCanvasEvaluatedScene` の options から「このフレームで評価済み rig 形状が消費され得る内部 rig id 集合」を算出する。中身は `resolveDeformerOverlay`（唯一の消費者）が拾い得るものと同一:

- `options.selection?.kind === "rigControl"` → `selection.id` を追加
- `options.rigDraft` が非 null → 合成 draft id（`DRAFT_RIG_CONTROL_ID`）を追加
- `options.controlPointPreview?.rigControlId` → 追加
- `options.rotationPreview?.rigControlId` → 追加

`createCanvasEvaluatedRigControls` に第3引数 `requiredIds: ReadonlySet<EvaluationRigControlId>` を追加。`requiredIds.size === 0` のとき空配列を返し、それ以外は `rigControls.filter(id ∈ requiredIds).map(...)` で部分集合だけ評価済み DTO 化する。これにより非選択時（スライダー操作相当）は rig 評価が一切走らない。

### 祖先チェーンの扱い（設計の「祖先チェーンも必要集合」への対応）
**出力部分集合に祖先を含める必要はない**と判断した。理由: `createCanvasEvaluatedWarpRigControl` / `createCanvasEvaluatedRotationRigControl` は引数 `rigControlsById`（L249 で常に全 committed + draft から構築、今回変更なし）を使って `createDrawableRigControlChain` で `parentId` を辿り、祖先全段の変形を内部で合成する。したがって選択1個を評価するだけで祖先の変形は既に畳み込まれる。設計の「1個 = 選択 rig + 祖先チェーン」は「選択 rig を評価すれば祖先の効果が反映される」という意味であり、出力配列に祖先ノードを列挙する必要はない。この等価性は選択時等価テスト（子 warp 選択時に親 warp の +200/+30 変形が evaluatedControlPoints に反映されること）で実証済み。

### preview 経路の一体化方法
**preview 経路に新規コードは不要だった**。preview は `canvas-preview-panel.tsx:196,206` の `createProjection({ controlPointPreview })` / `({ rotationPreview })` → `createCanvasRenderProjection(session, selection, options)`（selection 付き）→ `createCanvasEvaluatedScene(session, { ..., selection, controlPointPreview, rotationPreview })` と流れる。`resolveRequiredEvaluatedRigControlIds` が `controlPointPreview.rigControlId` / `rotationPreview.rigControlId` を必要集合に加えるため、preview 経路も同じ遅延評価を自動的に通る。選択と preview.rigControlId が食い違っても漏れないよう、両者を独立に必要集合へ加えている（設計の明示要求どおり）。`canvas-preview-panel.tsx` / rig interaction フックは無改修。

### resolveDeformerOverlay 追従の有無
**resolveDeformerOverlay 自体は無改修**（設計の「原則変えない」に従う）。`.find(status==="draft")` / `.find(rigControlId===selectedId)` は、必要集合が「選択 id と draft を必ず含む」ことを評価側で保証しているため、部分集合でも従来と同一の結果を返す。projection の 20 テストは全て無改修で green。

---

## 2. 変更ファイル一覧（絶対パス）

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\editor\src\workspace\canvas\canvas-evaluation.ts`
  （`createCanvasEvaluatedRigControls` に必要集合フィルタを追加 / `resolveRequiredEvaluatedRigControlIds` 新設 / 呼び出し側の配線）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\editor\src\workspace\canvas\canvas-evaluation.test.ts`
  （全件配列前提の3テストを新契約へ書き換え / 案A gate テスト6件を追加）

`canvas-projection.ts` / `canvas-preview-panel.tsx` / rig interaction フックは無改修（selection・preview を既に渡す既存経路を活用したため）。

**計測フックは維持**: `canvas.evaluation.assembly.rigControls.ms` 他の全スパン・caller counter は削除・改名せず、遅延化後も記録される（値が小さくなるのみ）。

---

## 3. テスト結果

### gate テスト（新規、canvas-evaluation.test.ts の "selection-driven rig-control subset" describe）
- **描画等価（核）**: `produces byte-identical drawables whether or not a rig control is selected` — 非選択 vs 選択で `JSON.stringify(scene.drawables)` が byte 一致。canvasBounds / maskRelations も一致。**PASS**
- **選択時等価**: `keeps the selected rig control's evaluated shape numerically identical to full evaluation` — 選択 rig の evaluatedControlPoints / domainBounds が期待値と数値一致。**PASS**。加えて既存の「子 warp local rest space」テストが祖先変形の反映を実証。
- **遅延の構造テスト（時間 assert なし）**:
  - `evaluates zero rig controls when nothing is selected/previewed/drafted` → `scene.rigControls` が `[]`。**PASS**
  - `evaluates only the selected rig control, leaving the rest of the subset empty` → 2 rig 中、選択した1個の id のみが配列に現れる。**PASS**
  - `includes a control-point preview's rig control in the subset without a selection` → preview 経路の遅延評価。**PASS**
  - `includes the rig draft in the subset even when a drawable is selected` → draft 経路。**PASS**

### 既存テスト書き換え（契約縮小に忠実、意味論緩和なし）
全件配列前提だった3テストに `selection: { kind: "rigControl", id: ... }` を明示追加し、当該 rig が部分集合に含まれる新契約で検証:
- `evaluates parameter scrub geometry...`（L75 `rigControls[0]`）→ 選択 + `toHaveLength(1)` を追加
- `evaluates child warp in local rest space...`（L193 `requireRigControl(RIG_CHILD_WARP)`）→ 子 warp 選択
- `evaluates rotation rest translation...`（3 シーン全て）→ RIG_FACE_ROTATION 選択

### スイート結果
- `canvas-evaluation.test.ts`: **22 passed**（16 既存 + 6 新規 gate）
- `canvas-projection.test.ts`: **20 passed**（無改修）
- `apps/editor/src/workspace` 全体: **279 passed / 4 skipped / 4 failed**
  - 4 failed は全て `diagnostics/diagnostics-jump-actions.test.ts`（gate で除外可と指定された既知 baseline fail 4件）。当方の変更起因ではないことをファイル単位で確認済み。
- **typecheck**（`apps/editor` tsc）: 当方変更ファイルにエラー 0。ワークツリー全体では pre-existing エラー22件（diagnostics-state / viewer / variant-manager / 各種テストフィクスチャ、いずれも当方無関係の既存 WIP）。当方の2ファイルを HEAD へ戻した baseline は23件で、当方変更で件数は増えていない（むしろ1件減）。→ **当方由来の型エラーなし**。
- **check:source**: PASS（exit 0, "Source organization guard passed."）
- **check:deps**: PASS（exit 0, "Dependency guard passed."）

---

## 4. ベンチ before/after 実測値（RUN_PERF_BENCH=1, 20 iterations/scale）

計測方法: 同一マシン・同一プロセスで、`createCanvasEvaluatedRigControls` の subset フィルタを一時的に「全件評価」へ surgical patch した before と、実装後の after を各々ベンチ実行。ベンチは `selection: null`（= rig 非選択 = スライダー操作相当）で評価するため、after は必要集合が空になり rig 評価が丸ごと消える。

### rigHeavy（drawables=200, chainDepth=8, rigControls=1600）

| span | before total (ms) | before avg (ms/eval) | after total (ms) | after avg (ms/eval) |
|---|---|---|---|---|
| `canvas.evaluation.assembly.rigControls.ms` | **1121.95** | **56.098** | **0.025** | **0.001** |
| `canvas.evaluation.artworkBoundsAndAssembly.ms` | **1123.713** | **56.186** | **1.385** | **0.069** |
| `canvas.evaluation.deformerVertex.ms`（案A対象外） | 150.625 | 7.531 | 135.711 | 6.786 |

→ rigHeavy の `assembly.rigControls.ms` は **56.098ms/eval → 0.001ms/eval（約 99.998% 減）**。親の `artworkBoundsAndAssembly.ms` も **56.186 → 0.069ms/eval（約 99.9% 減、artworkBounds 単独＋rest のみ残存）**。deformerVertex は案A対象外につき実質不変（差はノイズ）。

### heavy（drawables=120, chainDepth=6, rigControls=720）

| span | before total (ms) | before avg (ms/eval) | after total (ms) | after avg (ms/eval) |
|---|---|---|---|---|
| `canvas.evaluation.assembly.rigControls.ms` | 429.717 | 21.486 | 0.030 | 0.001 |
| `canvas.evaluation.artworkBoundsAndAssembly.ms` | 431.286 | 21.564 | 1.168 | 0.058 |

### 補足（medium: rigControls=120）
before `assembly.rigControls.ms` 57.425ms total（2.871ms/eval）→ after 0.018ms total（0.001ms/eval）。全スケールで N×D に比例していたコストが選択駆動化で消えることを確認。

**結論**: rig 非選択（本番のスライダー/ドラッグ操作の主経路）では rig control 評価コストが実質ゼロになる。設計 §5 の「rigHeavy で artworkBoundsAndAssembly がほぼ消える」を数値で満たした。

---

## 5. 裁量判断（設計未定義だが合理的に実装した箇所）

1. **祖先を出力部分集合に列挙しない**: 設計は「必要 rig 集合 = 選択 + 祖先チェーン」と記すが、評価関数が `rigControlsById`（全件）経由で祖先を内部合成するため、出力配列には選択 rig 1個だけを入れれば数値等価になる。祖先ノードを配列に追加すると `resolveDeformerOverlay` の `.find` が拾う対象が増えないのに DTO 生成コストだけ増えるため、出力は選択 rig のみとした。等価性は選択時等価テスト（親変形の反映）で担保。
2. **`selection.kind === "deformerTreeSet"` は必要集合に含めない**: `resolveDeformerOverlay` は `deformerTreeSet` を消費せず（`rigControl` kind と draft のみ分岐）、当該選択では deformerOverlay を出さない。設計も「selection?.kind === 'rigControl' のとき selection.id」と限定しているため、deformerTreeSet では rig 評価を空のままとした（消費者不在で安全）。
3. **preview 経路を無改修**: preview panel / interaction フックに手を入れず、既存の selection + preview 引数の流路を必要集合の入力として使った。設計要求（preview.rigControlId を明示的に必要集合へ）は評価側の `resolveRequiredEvaluatedRigControlIds` で満たしており、preview 側の変更は不要と判断。

---

## 6. escalate 事由

なし。design-inputs §2 の消費者分析（全 rig を要する消費者は不在、0〜1個）に反する消費者は実装中に発見されず。祖先チェーン解決も既存 `rigControlsById` の範囲で完結し、非自明な依存はなかった。

---

## 7. 質問（判断に迷った点・不足情報）

1. **typecheck baseline の pre-existing エラー22件について**: `apps/editor` のワークツリーには当方無関係の型エラーが既存（diagnostics-state / viewer / variant-manager / 各種テストフィクスチャ）。gate は「typecheck pass」を要求するが、これらは当方の scope 外（Perf Wave の他ドメインまたは別 WIP 由来）であり、当方変更ファイルはエラー0。この pre-existing エラーの解消は当方 scope 外と判断したが、Orch-Sylph 側で全体 typecheck green を完了条件とする場合は、別ドメイン/別 Gnome への割り当てが必要。当方では触っていない（禁止 scope 遵守）。

2. **ベンチ before の測定手法**: `git show HEAD:...` で HEAD 版を書き出すと LF 化＆モジュール混在で perf counter が記録されない事象が出たため、before は「実装後ファイルに subset フィルタを全件評価へ戻す surgical patch を当てて同一プロセスで計測 → 元に戻す」方式を採った。CRLF・他コードは一切変えず論理1点のみの差分で比較しており、before/after の相対比較は妥当と判断。恒久的な before baseline を別途残す必要があれば指示を請う。
