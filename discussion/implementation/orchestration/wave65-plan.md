# Wave 65 Plan: Parameter-driven Deformer Editing UX v0 + Mesh V2.5 Soft Boundary Sidecar

> Parameterを作り、keyformを打てる状態から一歩進めて、parameter値をscrubしながらWarp DeformerをCanvas上で直接編集できる体験へ進める。Mesh V2.5は本流から分離したsidecarとして扱う。

## 1. 状態

- Status: Planned
- Target wave: Wave65
- Wave name: `parameter-driven-deformer-editing-v0-mesh-v2-5-sidecar`
- Primary objective:
  - Parameter Barをcustom slider化し、track clickを無効化し、keyform marker clickだけでkeyform位置へjumpする。
  - Undo / Redo v0をEditor session側に導入し、scrubは非破壊、commit操作は履歴対象にする。
  - Warp Deformer制御点をCanvas上で直接編集できるようにする。単点drag、範囲選択、複数点dragをv0必須範囲に含める。
  - keyform位置以外ではCanvas上のdirect dragを禁止し、Inspectorの `Add Keyform Here` 導線へ寄せる。
  - Mesh `auto-outline-v2.5-soft-boundary` を、Parameter本流と衝突しないheadless sidecarとして進める。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [Undo / History Inventory](../waves/wave65/wave65-preplan-undo-history-inventory.md)
- [Parameter / Canvas Preview Inventory](../waves/wave65/wave65-preplan-parameter-canvas-preview-inventory.md)
- [Canvas / Warp Editing Inventory](../waves/wave65/wave65-preplan-canvas-warp-editing-inventory.md)
- [Test Oracle Inventory](../waves/wave65/wave65-preplan-test-oracle-inventory.md)

Why planning is now safe:

- Undo / Redoは未実装であり、既存 `reversible` / `modelDiff` だけではgeneric inverseに不足することが確認済み。
- Editor側では `EditorSessionProvider` 周辺にundo stackを置くのが自然で、scrubはeditor-local stateとしてUndo対象外にしやすい。
- Parameter値は既にCanvas projectionへ伝播し、opacity / rotation / warp overlayの補間結果を受け取れる。
- Canvasにはstage/screen projectionとWarp overlay描画基盤があるが、control point hit test、range selection、multi-drag modeは未実装。
- `canEditValue` 系で、keyform位置以外のdirect drag禁止を判定できる可能性が高い。
- native rangeではtrack click無効化とmarker click分離が難しいため、Parameter Barはcustom slider相当が必要。

Uncertainty:

- factual: low to medium。主要経路は棚卸済みだが、Canvas direct editingの実装時にpointer競合の細部確認が必要。
- decision: low。UXの主要判断は合意済み。
- cost of wrong plan: high。Undo層やCanvas編集層を誤ると以後のrigging UX全体が歪む。

## 3. Accepted Decisions / Oracles

- UXを真とする。Accepted UXを実現するために必要なら `packages/**` のformat / schema / operation / validator / runtime / fixture / testを修正してよい。
- Root / Undineは実装しない。実装は必ず Orch-Sylph -> Gnome / Review-Sylph の境界で行う。
- Subagentは必ず待機する。timeoutは失敗ではなくpolling timeoutである。
- 完了済みchild sessionは閉じる。実行中child sessionを親が閉じたり停止してはいけない。
- Parameter Bar:
  - track clickは無効。
  - thumb dragでparameter値を連続scrubする。
  - keyform marker clickだけが、そのkeyform値へのjumpを行う。
  - keyform以外のbar clickによるjumpは置かない。
  - Prev / Next / Min / Default / Max jump buttonはv0不要。
  - keyboard操作は別途扱い、Wave65では必須にしない。
- ScrubはUndo対象外。
- Commit操作はUndo対象。drag操作は `1 gesture = 1 undo entry` とする。
- Canvas direct editing:
  - Warp control point単体dragは必須。
  - drag範囲選択による複数control point選択は必須。
  - 選択中control pointsの一括dragは必須。
  - keyform位置以外ではdirect drag不可。
  - nudge、bounding box transform、reset selected points、手動edge/vertex編集はWave65では扱わない。
- Inspector:
  - keyform位置では対象propertyを編集可能。
  - keyform位置以外では補間値readonly、`Add Keyform Here` を主操作にする。
  - parameter未選択時はkeyform editing UIを出さない。
- Mesh V2.5:
  - `auto-outline-v2` を基礎にする。
  - bounds比率ベースのsoft boundaryで輪郭付近だけ少し外側へ包む。
  - Large Motionでも現V2 Low Motionより粗いくらいを目指す。
  - `auto-outline-v3-envelope` は実験候補へ下げる。
  - Editor defaultを勝手にV2.5へ切り替えない。sidecarとして明示method / headless検証を優先する。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

UX / Design:

- [Parameter / Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [auto-outline-v2 Algorithm](../../design/mesh-generation/auto-outline-v2.md)
- [auto-outline-v2.5 Soft Boundary Algorithm](../../design/mesh-generation/auto-outline-v2-5-soft-boundary.md)
- [auto-outline-v3 Envelope Algorithm](../../design/mesh-generation/auto-outline-v3-envelope.md)

Wave64 Baseline:

- [Wave64 Plan](wave64-plan.md)
- [Wave64 Final Integration Report](../waves/wave64/wave64-final-integration-report.md)
- [Wave64 Final Clean Integration Review](../reviews/wave64/wave64-final-clean-integration-review.md)

Wave65 Inventories:

- [Undo / History Inventory](../waves/wave65/wave65-preplan-undo-history-inventory.md)
- [Parameter / Canvas Preview Inventory](../waves/wave65/wave65-preplan-parameter-canvas-preview-inventory.md)
- [Canvas / Warp Editing Inventory](../waves/wave65/wave65-preplan-canvas-warp-editing-inventory.md)
- [Test Oracle Inventory](../waves/wave65/wave65-preplan-test-oracle-inventory.md)

## 5. Review Policy

Wave65もWave64と同じく、各implementation domainに3 review lanesを必須とする。

1. `Spec Compliance Review`
   - wave planとprimary basis docsへの対応を見る。
   - 各basis requirementを `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant` に分類する。
   - `unclear` はpassにしてはいけない。
2. `Design / Development Compliance Review`
   - architecture、module boundary、source organization、operation boundary、forbidden scopeを見る。
3. `Test Adequacy Review`
   - in-scope spec行に対応するunit / integration / e2e / manual visual check / N/A rationaleを見る。

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- User Workflow Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 6. Wave Strategy

Wave65 uses a dependency-aware `2 + 2 + 1` structure.

```text
Batch 1:
  Domain A: Editor Undo / Redo History Foundation v0
  Domain D: Mesh auto-outline-v2.5 Soft Boundary Headless Sidecar

Batch 2:
  Domain B: Parameter Bar Custom Slider + Keyform Marker Navigation
  Domain C: Warp Deformer Canvas Control Point Editing

Batch 3:
  Domain E: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A -> B
A -> C
D independent sidecar
B <-> C: thin shared provider/current-parameter contract only
E depends on A/B/C/D pass or explicit escalation
```

理由:

- Undo / RedoはCanvas direct editingの前提であり、`1 gesture = 1 undo entry` のcommit境界を先に作る。
- Parameter Bar custom sliderはkeyform marker clickとtrack click無効化を扱い、Canvas editingの前にactive parameter / current value UXを安定させる。
- Warp Canvas editingはCanvas / pointer / overlayの本丸であり、Undo v0とParameter editability判定を前提にする。
- Mesh V2.5はheadless + explicit methodならParameter workと衝突が小さいためsidecarとして並列化できる。

## 7. UX Acceptance Criteria

### 7.1 Undo / Redo v0

```text
User commits an editing operation
  -> undo stack receives one entry
  -> Undo reverts the session to the previous committed state
  -> Redo reapplies the reverted state
```

Required:

- Editor session側にUndo / Redo stackを持つ。
- `reversible` / `modelDiff` からgeneric inverseを無理に作らない。v0はsession snapshot / committed session historyを許容する。
- ScrubはUndo対象外。
- keyform add / update / delete、Ends / Ends+Center、Parts Tree DnD、Mesh apply / regenerate、Deformer create / update / binding moveなど、既存editor command経由のcommit操作を履歴対象にする。
- Canvas dragはpointermoveで一時previewし、pointerupで1回だけcommitして1履歴entryにする。
- Undo / Redo UIはApp Bar上の小さなicon buttonでよい。buttonはdisabled状態を持つ。
- Keyboard shortcutはWave65では必須にしない。

### 7.2 Parameter Bar Custom Slider + Marker Navigation

```text
Active parameter selected
  -> thumb drag scrubs value
  -> track click does nothing
  -> keyform marker click jumps to that keyform value
```

Required:

- native range依存を外し、custom slider相当でtrack click無効化とmarker clickを分離する。
- thumb dragでcurrent parameter valueを連続scrubできる。
- keyform markerは、選択中target + active parameterに関係するkeyformだけを表示する。
- marker clickでそのkeyform値へjumpする。
- keyform以外のbar clickによるjumpはしない。
- current valueがkeyform位置か、interpolated位置かを人間が判別できる。
- existing Parameter Manager / Set Active contractを壊さない。

### 7.3 Warp Deformer Canvas Editing v0

```text
Select Warp Deformer
  -> choose active parameter
  -> move to an existing keyform marker
  -> drag control point / marquee select points / drag selected points
  -> pointerup commits one update
  -> Undo reverts the gesture
```

Required:

- Warp Deformer selected時、Canvas overlay control pointsをhit testできる。
- 単一control pointをdragできる。
- drag範囲選択で複数control pointsを選択できる。
- 選択中control pointsをまとめてdrag移動できる。
- control point selectionはeditor-local UI/session stateであり、package model dataに保存しない。
- keyform位置以外ではdirect dragできない。
- direct drag禁止状態では、Canvas上の点はreadonlyとして見え、Inspector側の `Add Keyform Here` 導線を使う。
- pointermove中は一時previewを表示し、pointerupでDomain Aのhistory付きcommit境界へ入る。
- commitは既存Domain A/Wave64のkeyform operation contractを使う。GUI専用の非operation mutationへ逃げない。

### 7.4 Mesh V2.5 Soft Boundary Sidecar

```text
Mesh generation method explicitly requests auto-outline-v2.5-soft-boundary
  -> V2-based alpha-aware mesh
  -> ratio-based soft boundary around contour
  -> coarser triangles
  -> fallback to V2 / existing fallback when needed
```

Required:

- `auto-outline-v2.5-soft-boundary` を明示methodとして扱える。
- 入力はDrawable自身のRGBA alpha mask。
- paddingは固定pxではなく、alpha bounds / Drawable bounds比率から決める。
- Large Motionでも現V2 Low Motionより粗いくらいを目指す。
- alphaから遠すぎる透明領域だけのtriangleを主結果に残さない。
- soft boundary外triangleを残さない。
- V2 / existing fallbackへ戻れる。
- quality summary / provenanceにV2.5固有情報を残す。
- Editor defaultはV2のままにする。V2.5をUI defaultへ切り替えるのは人間visual確認後の別判断。

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Editor Undo / Redo History Foundation v0 | Wave64 editor command baseline | session history stack、Undo / Redo UI、commit wrapper、gesture commit contract |
| 1 | D. Mesh auto-outline-v2.5 Soft Boundary Sidecar | Wave63/64 mesh baseline | V2-based coarse soft boundary method、metrics、fallback |
| 2 | B. Parameter Bar Custom Slider + Keyform Marker Navigation | Domain A pass / Wave64 Parameter Bar baseline | track click disabled、thumb drag scrub、marker click jump |
| 2 | C. Warp Deformer Canvas Control Point Editing | Domain A pass / Wave64 parameter-aware inspector baseline | control point hit test、marquee select、multi-point drag、keyform-position gate |
| 3 | E. Final Integration / Clean Review / Map Closeout | A/B/C/D pass or explicit escalation | validation、cross-domain review、maps |

## 9. Domain A: `wave65-editor-undo-redo-history-foundation`

Purpose:

- Wave65以降のdirect manipulationを支えるEditor-local Undo / Redo v0を導入する。

Expected implementation areas:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/workspace/**`
- focused editor tests

Required capabilities:

1. Undo stack / Redo stack
   - session snapshotまたはcommitted session historyとして保持する。
   - bounded depthを持つ。
   - new commit後はredo stackをclearする。

2. Command wrapper integration
   - existing editor command commit結果をhistory対象にする。
   - operation rejection時はhistoryに積まない。
   - scrub / selection / overlay toggleなど非破壊UI stateはhistoryに積まない。

3. UI
   - App BarにUndo / Redo icon buttonを置く。
   - disabled状態を持つ。
   - tooltipは短く、人間向け。

4. Gesture contract
   - pointermove previewはcommitしない。
   - pointerup時に1回commitし、1 undo entryにするためのAPI/utilityを用意する。

Acceptance:

- Keyform add/update/deleteなど既存editor command commitをUndo / Redoできる。
- Rejected operationはhistoryを汚さない。
- ScrubはUndo対象外。
- Redoは新規commitでclearされる。
- Domain Cがgesture commitに利用できる薄いAPIがある。

Forbidden:

- package-wide generic inverse operationの発明。
- `modelDiff` を完全なundo oracleとして扱うこと。
- Keyboard shortcut必須化。
- save/load project persistence拡張。
- Canvas control point editing本体。
- Mesh V2.5。

## 10. Domain B: `wave65-parameter-bar-custom-slider-marker-navigation`

Purpose:

- Parameter Barを、drag scrubとkeyform marker jumpが干渉しないUIへ更新する。

Dependencies:

- Domain A pass and handoff.

Expected implementation areas:

- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- focused editor component/model tests
- minimal provider integration only if needed

Required capabilities:

- Custom slider相当のUI。
- track click無効。
- thumb drag scrub。
- keyform marker表示。
- marker click jump。
- selected target + active parameterに関係するmarkerだけを表示。
- current valueがkeyform位置かinterpolated位置か分かる表示。
- Parameter Manager Set Active / existing parameterValues contract保持。

Acceptance:

- User can scrub by dragging the thumb.
- Clicking track does not change parameter value.
- Clicking a keyform marker changes current parameter value to that marker.
- Existing Parameter Bar active parameter behavior remains intact.
- Focused tests cover thumb drag, track click no-op, marker click jump, and marker projection.

Forbidden:

- Keyboard navigation.
- Prev / Next / Min / Default / Max jump buttons.
- Canvas control point editing.
- Undo stack implementation beyond using Domain A contract where necessary.
- Mesh work.

## 11. Domain C: `wave65-warp-deformer-canvas-control-point-editing`

Purpose:

- Warp Deformerを、Inspector数値操作だけでなくCanvas上の直接操作でkeyform編集できるようにする。

Dependencies:

- Domain A pass and gesture/history handoff.
- Domain B can run in parallel after A, but Domain C must not assume B's internal UI implementation beyond shared provider/current-parameter contract.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- focused canvas / model / editor tests

Required capabilities:

1. Hit testing
   - Warp control point screen positionsを計算できる。
   - pointerdownがcontrol pointを掴んだか判定できる。

2. Selection
   - control point selectionはeditor-local state。
   - single point selection。
   - marquee rectangleによるrange selection。
   - selected pointsの保持とclear。

3. Drag editing
   - selected point / selected pointsをdrag移動する。
   - pointermove中はpreview。
   - pointerupで1 commit。
   - commitはWave64 keyform operation contractを使う。
   - Domain A historyへ1 gesture = 1 undo entryで積む。

4. Editability gate
   - keyform位置以外ではdirect drag不可。
   - `canEditValue` など既存parameter binding projectionを利用する。
   - readonly状態をCanvas/Inspectorで破綻なく見せる。

Acceptance:

- User can select a Warp Deformer and see editable control points at an editable keyform.
- User can drag one control point and commit the change.
- User can marquee-select multiple control points.
- User can drag selected control points together and commit one change.
- Undo reverts a committed drag gesture.
- Direct drag is blocked at non-keyform parameter positions.
- Focused tests cover hit test, marquee selection, multi-point drag commit, non-keyform block, and undo integration.

Forbidden:

- Rotation Deformer direct Canvas editing.
- keyboard nudge.
- bounding box transform / scale / rotate selected points.
- reset selected points.
- manual mesh vertex/edge editing.
- package model persistence of UI selection state.
- Mesh V2.5.

## 12. Domain D: `wave65-mesh-auto-outline-v2-5-soft-boundary-sidecar`

Purpose:

- Mesh V2の良い性質を残しながら、輪郭付近だけをsoft boundary化し、全体密度を粗くした次候補をheadless sidecarとして実装する。

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` if method metadata/schema is needed
- `packages/validator-core/**` if generation summary validation is needed
- focused package tests / fixtures
- `apps/editor/**` は原則触らない。触る場合はexplicit method visibility程度に留め、default切替はしない。

Required capabilities:

- Add explicit method `auto-outline-v2.5-soft-boundary` or equivalent agreed safe identifier.
- Reuse/extract V2 helpers where appropriate.
- Ratio-based soft boundary padding.
- Coarser boundary / interior spacing.
- Transparent near-boundary allowance.
- Far-transparent triangle rejection.
- soft boundary outside triangle rejection.
- quality metrics / provenance for V2.5.
- fallback to V2 / existing fallback with reason.

Acceptance:

- Output is deterministic.
- V2.5 vertex / triangle count is clearly lower than V2 on representative fixtures unless fallback justifies otherwise.
- Large Motion is not denser than current V2 Low Motion target unless explicitly justified.
- Triangle results remain near the Drawable alpha region and do not create a huge envelope.
- Existing V2 tests remain passing.
- Editor default remains V2.

Forbidden:

- Parameter / Keyform / Undo work.
- Defaulting editor generation to V2.5.
- Cubism reproduction claim.
- Broad geometry dependency without dependency policy compliance / escalation.

## 13. Domain E: `wave65-final-integration-clean-review-map-closeout`

Purpose:

- Domains A/B/C/Dを統合し、Wave65としてpassできるか確認する。

Expected work:

- Confirm domain reports and 3 review lanes exist for A/B/C/D.
- Confirm A handoff was consumed by B/C.
- Confirm D stayed independent and did not switch Editor default unexpectedly.
- Confirm B/C shared provider/current-parameter contract is coherent.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused editor tests from A/B/C
- Focused package tests from D
- Focused Playwright only for durable user path if stable and not visual-pixel based
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave65/wave65-domain-a-editor-undo-redo-history-foundation-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-b-parameter-bar-custom-slider-marker-navigation-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-c-warp-deformer-canvas-control-point-editing-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md`
- `discussion/implementation/waves/wave65/wave65-final-integration-report.md`
- `discussion/implementation/waves/wave65/_map.md`
- `discussion/implementation/reviews/wave65/_map.md`
- `discussion/implementation/reviews/wave65/wave65-final-clean-integration-review.md`

## 14. Orchestration Policy

This wave must follow `.github/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for started subagents.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome.
- Must delegate review to independent Review-Sylphs.
- Must include the separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX requires it.
- Must include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce the assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave65/wave65-domain-a-editor-undo-redo-history-foundation-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-b-parameter-bar-custom-slider-marker-navigation-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-c-warp-deformer-canvas-control-point-editing-report.md`
- `discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md`
- `discussion/implementation/waves/wave65/wave65-final-integration-report.md`
- `discussion/implementation/waves/wave65/_map.md`

Reviews:

- `discussion/implementation/reviews/wave65/wave65-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-test-adequacy-review.md`
- `discussion/implementation/reviews/wave65/wave65-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave65/_map.md`

## 16. Out of Scope

- Keyboard shortcuts / keyboard slider editing.
- Prev / Next / Min / Default / Max jump controls.
- Rotation Deformer direct Canvas editing.
- Bounding box transform / scaling / rotating selected control points.
- Control point nudge.
- Reset selected / reset all control points.
- Manual mesh vertex / edge / topology editing.
- Visibility / clipping / draw order keyforms.
- Parts Container keyforms.
- Mesh topology keyforms.
- Parameter preset ecosystem redesign.
- Camera Capture / Face Tracking Facade.
- External runtime API / export facade.
- Save / load project UX expansion.
- Texture Atlas.
- Physics / dynamics expansion.
- Variant / Expression Manager implementation.
- Photoshop pixel-perfect compositing.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.
