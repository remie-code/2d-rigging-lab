# Wave 77 Plan: Deformer Tree Multi-Select + Wrap Selected Rig Authoring

> Wave76でParts Tree Drawable multi-select、Mesh batch、Rig batch root createは完了した。Wave77はDeformer Tree側の複数選択を追加し、既存Deformer / bound Drawable / Pool Drawableを選んで新しい親Deformerで包む `wrap selected` authoringを実装する。あわせてDrawable PoolをParts tree構造で表示し、Deformer Tree rowの不要なcontrol-point detailを削る。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave77
- Wave name: `deformer-tree-multiselect-wrap-selected-rig-authoring`
- Primary objective:
  - Deformer TreeでDeformer node、bound Drawable ref、Drawable Pool内のunbound Drawableを複数選択できるようにする。
  - 選択したDeformer / Drawableを新しいRotation/Warp Deformerで包む `wrap selected` UXを実装する。
  - Drawable PoolをParts tree構造で表示し、Parts Container行はdisplay-onlyにする。
  - Deformer Tree rowから `5 x 5 control points` のような二段目detailを除去する。
  - 既存DeformerへのD&D bind/reparentは自動resize/refitしない現行挙動を維持し、必要な不変条件をテストで固定する。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then `Plan directly`.

Why planning is now safe:

- Read-only Sylph UI調査で、Deformer Tree rows / Drawable Pool rows / click handlers / selection projectionの現状を確認した。
- Read-only Sylph operation調査で、既存D&Dはchild list / parent referenceのみを更新し、`domainBounds` / `pivot` / control pointsを変更しないことを確認した。
- 既存 `insertBeforeChild` は単一子専用であり、複数の既存子をまとめて新規親Deformerへ移すatomic mutation/operationが存在しないことを確認した。
- User decisions are explicit:
  - Poolは未所属Drawableだけを表示する現行挙動を維持する。
  - 既存DeformerへDrawable/RigControlをD&Dしても自動resize/refitしない。
  - `wrap selected` では新規Deformerの初期bounds/pivot/domainを選択対象のunionから計算する。
  - 複数親にまたがる既存parented child wrapは扱わない。
  - Parts ContainerはPool構造表示用のみで、選択・DnD対象にしない。

Uncertainty:

- factual: medium. Multi-child wrap operationのdiff/evidence形状は実装時にoperation-core既存パターンへ合わせる必要がある。
- decision: low. UX/product方針は固まっている。
- cost of wrong plan: high. Rig hierarchy mutationを誤るとsave/load、keyform target、runtime evaluation、Deformer Tree UXに長く残る歪みになる。

## 3. Accepted Decisions / Oracles

### 3.1 Deformer Tree Selection

- Deformer Tree selectionはDeformer node、bound Drawable ref、Pool Drawableを含められる。
- Parts Container rowはPool構造表示用であり、選択対象にしない。
- Normal click: clicked selectable rowのみを選択し、anchorを更新する。
- Ctrl/Meta click: clicked selectable rowをtoggleし、anchorを更新する。
- Shift click: Deformer Tree上のvisible selectable row orderでanchorからclicked rowまでをrange選択する。
- Anchorが存在しない、またはvisible selectable rowにない場合、Shift clickはclicked row単体選択へ倒す。
- Parts Treeの`drawableSet` range orderをDeformer Treeに流用しない。
- Canvas multi-highlightは必須ではない。multi-selection時にDeformer overlayが出なくてもよい。

### 3.2 Drawable Pool

- Poolには未所属Drawableだけを表示する。
- すでにどこかのRigControlに所属しているDrawableはPoolに出さない。
- PoolはParts tree構造を反映して表示する。
- Pool内のParts Container rowはdisplay-onlyで、選択・DnD・drop targetにしない。
- 空のParts Container subtreeは表示しない。
- Pool Drawable rowは選択・DnD対象にする。

### 3.3 Existing DnD

- Pool Drawableを既存DeformerへD&Dする既存導線は維持する。
- bound Drawable refを別DeformerへD&Dする既存導線は維持する。
- Deformer nodeを別DeformerへD&Dする既存導線は維持する。
- これら既存D&Dは`domainBounds`、`pivot`、`restControlPoints`、Bezier metadataを自動変更しない。
- `Fit to children`のような明示refit操作はWave77では作らない。

### 3.4 Wrap Selected

- `wrap selected` は、選択した既存child群とunbound Pool Drawable群を、新規Rotation/Warp Deformerの子にする操作である。
- 例:

```text
Deformer A
  drawable a
  drawable b
  drawable c
```

`a,b,c`を選択してWarp Deformerを作ると:

```text
Deformer A
  New Warp Deformer
    drawable a
    drawable b
    drawable c
```

- `a,b`だけを選んだ場合、`c`は`Deformer A`直下に残る。
- parented既存childは、同一 immediate parent の直下にある場合のみまとめてwrapできる。
- root RigControl同士はroot groupとしてwrapできる。
- Pool Drawableはunboundなので、同一parent制約を満たす既存child groupに合流できる。
- Non-pool selected itemsが同一parent/rootにまとまらない場合はcreate actionをdisabledにし、警告を出す。
- 祖先と子孫を同時にwrap対象にすることは禁止する。
- 既存データモデルは`childDrawableIds`と`childRigControlIds`を別配列で持つため、混在childの表示順完全保持は必須にしない。

### 3.5 New Wrapper Geometry

- 新規Warp Deformerの`domainBounds`は、選択されたDrawable/RigControlのwarp-domain bounds unionから計算する。
- 新規Rotation Deformerの`pivot`は、選択されたDrawable/RigControlのrotation bounds union中心から計算する。
- 既存parent Deformerのgeometryは変更しない。
- 既存child Deformerのgeometryも変更しない。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Wave baseline:

- [Wave76 Plan](wave76-plan.md)
- [Wave76 Final Integration Report](../waves/wave76/wave76-final-integration-report.md)
- [Wave76 Final Clean Integration Review](../reviews/wave76/wave76-final-clean-integration-review.md)

Relevant earlier waves:

- [Wave63 Plan](wave63-plan.md)
- [Wave72 Plan](wave72-plan.md)
- [Wave73 Plan](wave73-plan.md)
- [Wave75 Plan](wave75-plan.md)

Confirmed source facts from read-only investigation:

- `createDeformerTreeRows` and `createDrawablePoolItems` live in `apps/editor/src/features/editor-session/model/rig-tool-state.ts`.
- `DeformerTreeView` renders bound refs, Deformer rows, and Pool rows in `apps/editor/src/workspace/panels/deformer-tree-view.tsx`.
- Current global selection supports `part`, single `drawable`, `drawableSet`, and single `rigControl`, but not mixed Deformer Tree sets.
- Current Deformer Tree click handlers ignore modifier keys.
- `createDrawablePoolItems` filters out every Drawable already listed in any `rigControl.childDrawableIds`.
- `bindRigControlChild`, `moveDrawableRigControlBinding`, and `reparentRigControl` update references only; they do not resize/refit Deformers.
- Existing `insertBeforeChild` is scalar and requires exactly one inserted child target.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Classify each in-scope requirement as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Check module boundaries, schema/API compatibility, deterministic behavior, source organization, and forbidden scope.
3. `Test Adequacy Review`
   - Check unit/component/e2e coverage and negative cases.

Domain reports must include:

- Basis Coverage Self-Report
- User-Facing UX Trace where applicable
- Data / Schema / Operation Contract Trace where applicable
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Deformer Tree Selection + Drawable Pool Tree + Row Cleanup
  Domain B: Multi-Child Wrap Operation / Authoring Foundation

Batch 2:
  Domain C: Editor Wrap-Selected Rig UX Integration

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A is editor UI/model selection work and can run in parallel with package/operation work if write scopes are kept separate.
- Domain B owns authoring/operation support for atomic multi-child wrap and should not touch Deformer Tree UI.
- Domain C depends on A and B because it needs Deformer Tree selection state plus operation support.
- Domain D runs only after A-C pass or explicitly escalate.

## 7. Acceptance Criteria

### 7.1 Deformer Tree Multi-Select

Required:

- Deformer Tree supports single and multi-select for Deformer rows.
- Deformer Tree supports single and multi-select for bound Drawable ref rows.
- Expanded Drawable Pool supports single and multi-select for Pool Drawable rows.
- Normal/Ctrl-or-Meta/Shift behavior follows the accepted selection oracle.
- Range selection uses visible Deformer Tree selectable row order.
- Parts Container rows in Pool are skipped by selection and range selection.
- Existing single `selectRigControl` and `selectDrawable` behavior remains usable outside Deformer Tree multi-select.
- Multi-selection can be represented in Inspector without crashing existing single-selection panels.

Must not:

- Reuse Parts Tree `drawableSet` range order for Deformer Tree range selection.
- Select Parts Container rows.
- Persist editor selection state in portable package data.
- Add Canvas modifier multi-select.

### 7.2 Drawable Pool Tree and Row Cleanup

Required:

- Drawable Pool renders unbound Drawables under their Parts Container hierarchy.
- Empty container subtrees are pruned.
- Pool container rows are display-only and non-draggable.
- Pool Drawable rows remain draggable to Deformer rows.
- Pool count remains the count of unbound Drawables, not container rows.
- Deformer rows no longer render the secondary `control points` / pivot detail line.
- Inspector still exposes editable Deformer details where applicable.

Must not:

- Show already-bound Drawables in Pool.
- Make Pool container rows drop targets.
- Remove Inspector controls needed for editing Deformer geometry.

### 7.3 Multi-Child Wrap Operation

Required:

- Authoring/operation layer supports one atomic create-and-wrap path for Rotation Deformer.
- Authoring/operation layer supports one atomic create-and-wrap path for Warp Deformer.
- The created wrapper owns selected child Drawables and selected child RigControls.
- For parented existing children, all existing parented children must share the same immediate parent.
- For root RigControls, selected root children are removed from `rigControlRootIds` and reparented under the new wrapper.
- Unbound Pool Drawables can be included in the new wrapper.
- Bound Drawables from a different parent are rejected.
- RigControls from a different parent/root group are rejected.
- Ancestor/descendant mixed selection is rejected.
- Duplicate selected targets are de-duped or rejected deterministically.
- Existing parent and child geometry is not changed by wrap.
- Operation evidence/model diff clearly records parent child list changes, new RigControl creation, child parent changes, and root id changes where applicable.

Must not:

- Compose multiple non-atomic operations for the main wrap path.
- Change package format semantics unrelated to RigControl hierarchy.
- Reintroduce `RigControl.partId` as ownership.
- Claim exact mixed child display-order preservation.

### 7.4 Editor Wrap-Selected UX

Required:

- Rig Tool / Inspector can consume a coherent Deformer Tree multi-selection.
- Target section lists selected Deformer/Drawable names compactly.
- Create Rotation Deformer creates one wrapper Deformer for the coherent selected set.
- Create Warp Deformer creates one wrapper Deformer for the coherent selected set.
- Incoherent selection disables create actions and shows a warning.
- Pool Drawable + selected root Deformer can create a new root wrapper.
- Pool Drawable + selected same-parent children can create a wrapper under that common parent.
- Created wrapper becomes selected after creation.
- Existing Deformer Tree D&D behavior still works.

Must not:

- Auto-resize existing Deformers on D&D.
- Create wrappers for children from multiple existing non-root parents.
- Create wrappers when selected parent and descendant are both in the target set.
- Add broad auto-rigging or semantic inference.

### 7.5 Tests and UX Proof

Required:

- Unit tests cover Deformer Tree selection transitions.
- Projection tests cover Pool tree rendering, unbound-only filtering, empty container pruning, and display-only container flags.
- Operation/authoring tests cover multi-child wrap success and rejection cases.
- Editor model tests cover wrap payload builders, bounds/pivot union, and incoherent selection warnings.
- Component or E2E tests cover modifier-click Deformer Tree multi-select and Pool tree behavior.
- E2E or integration test covers a representative wrap-selected flow.
- Existing Deformer D&D tests assert no automatic `domainBounds` / `pivot` / control-point mutation.
- `pnpm typecheck` passes.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Deformer Tree Selection + Drawable Pool Tree + Row Cleanup | Wave76 pass baseline | Add mixed Deformer Tree multi-select, Pool hierarchy rendering, and remove row detail clutter |
| 1 | B. Multi-Child Wrap Operation / Authoring Foundation | Wave76 pass baseline | Add atomic create-and-wrap support for multiple Drawable/RigControl children |
| 2 | C. Editor Wrap-Selected Rig UX Integration | Domain A + B pass | Connect Deformer Tree selection to Rig Tool create actions and warnings |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A-C pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave77-deformer-tree-selection-pool-tree-row-cleanup`

Purpose:

- Add Deformer Tree mixed multi-select state and clean up Deformer Tree/Pool rendering.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- related focused tests

Required tests / evidence:

- Selection transition tests for replace, Ctrl/Meta toggle, Shift range, anchor fallback, and Pool container skip.
- Pool tree projection tests for nested Parts order, bound Drawable exclusion, empty container pruning, and display-only flags.
- UI/component/E2E proof that Deformer rows no longer show `control points` secondary text.
- Existing D&D smoke remains passing.

Early escape triggers:

- Existing global `EditorSelection` consumers cannot tolerate a mixed Deformer Tree set without broad refactor.
- Modifier-click behavior cannot be tested without adding large new test infrastructure.

## 10. Domain B: `wave77-multi-child-wrap-operation-authoring-foundation`

Purpose:

- Add an atomic model/operation path for creating a new Deformer that wraps multiple existing children and/or unbound Drawables.

Expected implementation areas:

- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts` only if payload contract changes require catalog updates
- package-format/schema files only if operation payload needs a DTO export change

Preferred design:

- Extend existing create Rotation/Warp operation payloads with an explicit bulk wrap target field such as `wrapChildren`.
- Keep existing `insertBeforeChild` compatibility for single-child insertion.
- Derive created wrapper child lists from wrap targets.
- Keep the operation atomic rather than composing create + multiple bind/reparent/move operations.

Required tests / evidence:

- Parent Deformer with `a,b,c`; wrap `a,b`; `c` remains under parent.
- Parent Deformer with mixed direct Drawable and child RigControl; selected siblings move under wrapper.
- Root RigControls wrap into one new root wrapper and old root ids are updated.
- Unbound Drawable can be included with a coherent parented or root selected group.
- Mixed non-root parents reject.
- Ancestor/descendant mixed selection rejects.
- Existing geometry on parent/children remains unchanged.
- Operation diff/evidence includes all relevant child/root/parent changes.

Early escape triggers:

- Operation schema compatibility requires a separate versioning decision.
- Atomic multi-child wrap cannot be expressed without large operation-core redesign.
- A package/runtime invariant assumes exact mixed child order in a way this wave cannot satisfy.

## 11. Domain C: `wave77-editor-wrap-selected-rig-ux-integration`

Purpose:

- Connect Deformer Tree mixed selection to user-facing create Rotation/Warp wrapper actions.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.tsx` or existing nearest tests
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Required tests / evidence:

- Coherent Deformer Tree selection produces enabled create buttons.
- Incoherent selection produces disabled create buttons and warning copy/icon.
- Create Rotation wrapper computes pivot from selected bounds union.
- Create Warp wrapper computes domain from selected warp-domain bounds union.
- Pool Drawable + root Deformer wrapper flow works.
- Pool Drawable + same-parent existing children wrapper flow works.
- Created wrapper becomes selected.
- Existing single Drawable Rig create and Wave76 batch root create still work.

Early escape triggers:

- Inspector routing for mixed Deformer Tree selection conflicts with established single Deformer editing behavior.
- Bounds/pivot helper extraction would require broad canvas/runtime refactor.
- E2E cannot reliably perform the selected flow; then fall back to model/component tests and record the limitation.

## 12. Domain D: `wave77-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave77 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave77/**`
- `discussion/implementation/reviews/wave77/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A-C reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave77 is marked complete.
- Final report records:
  - Deformer Tree selection semantics;
  - Drawable Pool tree behavior;
  - row cleanup;
  - multi-child wrap operation design;
  - Editor wrap-selected UX;
  - existing D&D no-auto-resize behavior;
  - validation results;
  - residual risks.
- Maps mark Wave77 status correctly.

Required checks:

- `pnpm typecheck`
- Focused editor selection / rig-tool / deformer-tree tests
- Focused authoring/operation rig-control tests
- Focused Playwright PSD-import path for Deformer Tree multi-select / wrap-selected UX where practical
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 13. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Deformer Tree mixed multi-select | unit tests plus focused UI/E2E proof |
| Range uses Deformer Tree visible order | selection transition tests |
| Pool tree unbound-only structure | projection tests |
| Pool containers display-only | projection/UI tests |
| Row detail removed | component/E2E assertion |
| Existing D&D no auto-resize | operation/editor tests asserting unchanged geometry |
| Parented multi-child wrap | authoring/operation tests |
| Root RigControl wrap | authoring/operation tests |
| Pool Drawable included in wrapper | editor model/operation tests |
| Mixed-parent rejection | negative operation/editor tests |
| Ancestor/descendant rejection | negative operation tests |
| Editor create wrapper UX | component/E2E or model + focused browser proof |
| Existing single/batch Rig create not regressed | existing and focused regression tests |

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave77/wave77-domain-a-deformer-tree-selection-pool-tree-row-cleanup-report.md`
- `discussion/implementation/waves/wave77/wave77-domain-b-multi-child-wrap-operation-authoring-foundation-report.md`
- `discussion/implementation/waves/wave77/wave77-domain-c-editor-wrap-selected-rig-ux-integration-report.md`
- `discussion/implementation/waves/wave77/wave77-final-integration-report.md`
- `discussion/implementation/waves/wave77/_map.md`

Reviews:

- `discussion/implementation/reviews/wave77/wave77-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave77/wave77-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave77/_map.md`

## 15. Subagent Contract

Domain assignment must include:

- target and wave;
- dependencies;
- allowed write scope;
- forbidden write scope;
- basis documents;
- applicable policies;
- required tests and verification;
- expected evidence;
- loop limit;
- early escape triggers.

Each Orch-Sylph must start with bounded current-state confirmation before delegating to Gnome.

Gnome instructions must include:

- This workspace may already have unrelated dirty changes.
- Do not revert user or other-agent changes.
- Do not run broad refactors.
- Implement within the domain write scope.
- Preserve Wave76 accepted behavior.
- Keep out-of-scope auto-resize/refit, mixed-parent wrap, Canvas modifier selection, and semantic auto-rigging out of implementation.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

## 16. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` only when the assigned domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement out-of-scope wrap behavior, Canvas multi-select, auto-rigging, semantic inference, or existing-Deformer auto-resize/refit.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope and negative cases explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 17. Out of Scope

- Auto-resize/refit of existing Deformers after D&D bind/reparent.
- `Fit to children` UI.
- Multiple existing non-root parents in one wrap operation.
- Ancestor/descendant simultaneous wrap.
- Exact mixed child display-order preservation across `childDrawableIds` and `childRigControlIds`.
- Canvas Ctrl/Shift multi-select.
- Canvas multi-selection highlighting requirements.
- Parts Tree behavior changes.
- Mesh generation changes.
- Keyform interpolation changes.
- Save/load format redesign.
- Reintroducing `RigControl.partId` ownership.
- Semantic recognition from part name, drawable name, image content, or hierarchy.
- Auto-rigging.
- Renderer architecture work.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
