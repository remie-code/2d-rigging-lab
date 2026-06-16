# Wave 76 Plan: WebGL Clipping Fix + Drawable Multi-Select Batch Authoring

> Wave75でRotation translation authoringとDeformer Inspector整理は完了した。Wave76は、WebGL導入後にclipped drawableが完全消失する描画バグを直しつつ、Parts TreeのDrawable複数選択を基盤化し、Mesh/Rig Toolの一括authoring導線へつなげる。あわせて、RigControlがParts Containerに所属するという古い前提を`partId?: legacy only`へ後退させる。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave76
- Wave name: `webgl-clipping-rigcontrol-decoupling-drawable-multiselect-batch-authoring`
- Primary objective:
  - WebGL clipping feedback-loopを修正し、白目maskでclippedされた瞳/眼球drawableが完全消失しないようにする。
  - `RigControl.partId`を必須ownershipから外し、Deformer/RigControlをParts Tree所属ではなくDeformer Tree / rig hierarchy所属として扱えるようにする。
  - Parts TreeでDrawable-only複数選択を導入し、Select/Mesh/Rig各Toolの複数選択Inspector UXへ接続する。
  - Mesh Toolで複数Drawableのpreview/applyを行えるようにし、既存meshがあるDrawableは上書きせず警告付きで除外する。
  - Rig Toolで未所属Drawable群からroot Deformerを一括作成できるようにする。

## 2. Planning Gate Result

Planning Gate result: `Inventory then discuss`, then `Plan directly`.

Why planning is now safe:

- WebGL clippingについて、read-only Sylph調査で`renderMaskTexture()`のmask framebuffer feedback-loopが最有力原因として確認された。
- Parts Tree複数選択について、現在のselection stateが単一選択前提であり、`drawableSet` variantと`selectionAnchorDrawableId`が必要なことを確認した。
- Mesh Toolについて、現在のpreview stateが単一`meshDraft`前提であり、複数previewにはstate/projection/render overlayの配列対応が必要なことを確認した。
- Rig Toolについて、operation側は複数`childDrawableIds`を既に受けられるが、現行`RigControl.partId`必須がcross-Part batch createの概念を歪めることを確認した。
- `RigControl.partId`について、runtime/deformation evaluationは`partId`を使っておらず、schema/precondition/evidence/delete-blocker/UI表示のlegacy ownership markerに偏っていることを確認した。
- User decisions are now explicit:
  - `RigControl.partId`は`legacy optional`化する。
  - 新規RigControl作成では`partId`を書かない。
  - 旧`partId`は読めるが、積極的strip migrationはWave76では行わない。
  - legacy `partId`だけではPart delete blockerにしない。
  - Rig batch createは未所属Drawableだけを対象にする。
  - 既存Deformer配下のDrawable群を新規Deformerで包むwrap operationはout of scope。

Uncertainty:

- factual: medium. 実装中にoperation result/evidence/fixturesで追加の`partId`参照が見つかる可能性はある。
- decision: low. UX/product方針は明確。
- cost of wrong plan: high. `RigControl.partId`を誤って扱うとsave/load、validator、operation evidence、future batch rig UXに長く残る歪みになる。

## 3. Accepted Decisions / Oracles

### 3.1 WebGL Clipping

- Primary bug is likely WebGL mask framebuffer feedback-loop.
- `renderMaskTexture()` must not draw into a framebuffer while its attached mask target texture is still bound to any sampler texture unit.
- Missing/unrenderable mask sources may keep current skip behavior.
- Isolate Selected mask opacity parity is follow-up unless a small safe adapter fix is required by the implemented clipping test.
- No broad renderer redesign.
- No Photoshop/PDS pixel-perfect clipping parity.

### 3.2 RigControl Ownership

- Deformer/RigControl should not conceptually belong to a Parts Container.
- RigControl hierarchy is represented by `parentId` / `childRigControlIds`.
- A RigControl's affected content is represented by `childDrawableIds` / `childRigControlIds`.
- `RigControl.parentId` remains meaningful and must not be removed.
- `RigControl.partId` becomes optional legacy metadata only.
- New create rotation/warp payloads should not require `partId`.
- New RigControls written by Editor/operations should omit `partId`.
- Existing documents with `partId` must still load.
- Wave76 does not actively strip old `partId` from loaded documents unless it naturally disappears through new object creation.
- Legacy `rigControl.partId` alone must not block Part deletion.

### 3.3 Parts Tree Multi-Select

- Multi-select target is Drawable only.
- Parts Container is not a multi-select target.
- Normal click on Drawable: selected = clicked Drawable only; anchor = clicked Drawable.
- Ctrl-click Drawable: toggle clicked Drawable in selected Drawable set; anchor = clicked Drawable.
- Shift-click Drawable: select visible Drawable rows from anchor to clicked Drawable; skip Parts Container rows.
- If no visible anchor exists, Shift-click falls back to clicked Drawable only; anchor = clicked Drawable.
- If a Parts Container is selected and user Shift/Ctrl-clicks a Drawable, clear the Container selection and select only clicked Drawable; anchor = clicked Drawable.
- Deformer Tree multi-select is out of scope.
- Canvas Shift/Ctrl multi-select is out of scope.
- Canvas selection visualization may show all selected Drawables uniformly; no user-visible primary selection is required.

### 3.4 Mesh Batch

- Mesh Inspector Target section should show target Drawable names only, both in new preview and edit/generated states.
- Multi-select Mesh Tool should show selected Drawable names.
- Meshless / empty-scaffold Drawables are eligible for batch preview/apply.
- Drawables with generated/non-empty existing mesh are excluded by default and shown with warning.
- Existing meshes are not overwritten in Wave76.
- `Generate preview` may generate multiple previews and may take time; user accepts this tradeoff.
- UI should disable generation while generating.
- `Apply mesh` is enabled only when eligible previews exist.
- `Cancel` discards all current previews.

### 3.5 Rig Batch

- Rig Tool multi-select target list shows all selected Drawable names.
- Already-bound Drawables are excluded from create actions and shown with warning.
- Eligible unbound Drawables become `childDrawableIds` of one new root Deformer.
- If eligible count is zero, create buttons are disabled.
- Batch create must not use a fake/common Parts Container ownership.
- Wrapping already-bound Drawables with a newly inserted Deformer is out of scope.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Wave baseline:

- [Wave75 Plan](wave75-plan.md)
- [Wave75 Final Integration Report](../waves/wave75/wave75-final-integration-report.md)
- [Wave75 Final Clean Integration Review](../reviews/wave75/wave75-final-clean-integration-review.md)

Relevant earlier waves:

- [Wave67 Plan](wave67-plan.md)
- [Wave67 Final Integration Report](../waves/wave67/wave67-final-integration-report.md)
- [Wave72 Plan](wave72-plan.md)
- [Wave73 Plan](wave73-plan.md)

Design / UX:

- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Parameter Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Canvas Preview Component](../../design/screen-design/components/canvas-preview.md)

Confirmed source facts from read-only investigation:

- `packages/render-webgl2/src/webgl2-renderer.ts` creates a mask target texture on `TEXTURE1`, attaches it to a framebuffer, and can draw mask pass while the same texture remains bound.
- `packages/render-webgl2/src/webgl2-renderer.test.ts` currently records GL calls but does not model active texture unit / framebuffer attachment feedback loop.
- Current Editor selection is single-target in `apps/editor/src/features/editor-session/model/editor-selection.ts` and context state.
- Parts Tree row selection derives from that single selection in `session-tree.ts` and `structure-tree-panel.tsx`.
- Mesh preview is a single `MeshToolDraft | null` in Editor session context and a single projection/render overlay path.
- Rig create operations already accept multiple `childDrawableIds`, but payload/schema currently require `partId`.
- Runtime/deformation evaluation does not require `RigControl.partId`.
- Operation IDs for create rig controls are display-name based, not `partId` based.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Checks this plan and basis docs.
   - Each in-scope requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks module boundaries, schema/API compatibility, source organization, operation policy, deterministic behavior, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit/component/e2e coverage, browser or pixel proof where required, and negative coverage for excluded cases.

Domain reports must include:

- Basis Coverage Self-Report
- User-Facing UX Trace where applicable
- Data / Schema / Operation Contract Trace where applicable
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

Wave76 uses parallel foundation domains where write scopes are separable, then dependent batch-authoring domains.

```text
Batch 1:
  Domain A: WebGL Clipping Feedback-Loop Fix
  Domain B: RigControl partId Legacy Optional Decoupling
  Domain C: Drawable Multi-Select Selection Model + Parts Tree + Select Inspector

Batch 2:
  Domain D: Mesh Target Simplification + Multi Preview/Apply

Batch 3:
  Domain E: Rig Batch Create for Unbound Drawables

Batch 4:
  Domain F: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A is isolated to render-webgl2 and renderer tests.
- Domain B touches package/operation/authoring/validator/evidence contracts and must finish before Rig batch create.
- Domain C establishes selection shape and visible Parts Tree gestures needed by Mesh/Rig batch UI.
- Domain D depends on C because batch Mesh uses selected Drawable sets and anchor behavior; it also touches session context/Canvas projection and should not race C.
- Domain E depends on B and C because it needs `partId` decoupled and selected Drawable sets; it is sequenced after D to avoid `editor-session-context` merge collisions.
- Domain F runs only after all implementation domains pass or explicitly escalate.

## 7. Acceptance Criteria

### 7.1 WebGL Clipping

Required:

- A clipped drawable with an opaque overlapping mask remains visible inside the mask in WebGL.
- The clipped drawable is absent or transparent outside the mask.
- Mask framebuffer draw calls must not occur while the mask target texture is bound to any texture unit.
- The guard must hold for the first clipped drawable in a frame.
- The guard must also hold for multiple clipped drawables in one frame / mask target reuse path.
- Existing WebGL primary path remains active.
- Canvas2D fallback behavior is not regressed.
- Missing or unrenderable mask sources keep existing skip behavior unless a direct bug is proven.

Must not:

- Add broad screenshot/pixel oracle to normal app E2E.
- Redesign the renderer or introduce new clipping architecture.
- Claim PSD clipping extraction or Photoshop parity.
- Fold isolate-selected mask opacity parity into the main fix unless it is a small, proven direct requirement.

### 7.2 RigControl partId Legacy Optional Decoupling

Required:

- `rotation2d` and `warpLattice2d` RigControl schemas load both old documents with `partId` and new documents without `partId`.
- New create Rotation/Warp Deformer operation payloads do not require `partId`.
- New created RigControls omit `partId`.
- Authoring mutation preconditions no longer require a RigControl part to exist.
- Operation target refs / targetIds / diagnostics for create rig controls do not include a Part target solely because of rig creation.
- Operation ID generation remains stable and display-name based.
- Runtime/deformation evaluation works for RigControls with no `partId`.
- Validator Part delete blockers do not block on legacy `rigControl.partId` alone.
- Existing blockers from actual Part children, Drawables, masks, and other real ownership remain intact.
- Editor create flows stop sending `partId`.
- Editor read models and Inspector do not present RigControl as belonging to a Parts Container.
- Portable save/load can round-trip both legacy and new no-`partId` RigControls.
- AI operation catalog no longer lists `partId` as a required input for create rig operations.

Must not:

- Remove `RigControl.parentId`.
- Break old project loading.
- Perform broad destructive migration or strip old `partId` from all loaded documents unless narrowly justified.
- Reinterpret `partId` as common ancestor ownership for new batch Deformers.

### 7.3 Drawable Multi-Select and Select Inspector

Required:

- `EditorSelection` supports a Drawable set variant or equivalent ordered selected Drawable list.
- A separate internal `selectionAnchorDrawableId` or equivalent anchor supports Shift range.
- Selected Drawable ids are stored in visible Parts Tree order where relevant.
- Normal click Drawable selects only that Drawable and updates anchor.
- Ctrl-click Drawable toggles selected membership and updates anchor.
- Shift-click Drawable selects the visible Drawable range from anchor to clicked Drawable, skipping Parts Containers.
- If anchor is absent or not visible, Shift-click selects only clicked Drawable and updates anchor.
- Parts Container selected + Shift/Ctrl-click Drawable clears Container selection and selects only clicked Drawable.
- Parts Container rows cannot become members of multi-select.
- Select Tool multi-select Inspector shows selected Drawable names and no unrelated edit controls.
- Canvas reflects selected Drawables uniformly without a distinct primary visual.
- Existing single-selection behavior for Part, Drawable, and RigControl remains intact.

Must not:

- Add Deformer Tree multi-select.
- Add Canvas Ctrl/Shift multi-select.
- Let Parts Container and Drawable selection mix in one multi-selection.
- Persist selection state in portable project data.

### 7.4 Mesh Target Simplification and Batch Preview/Apply

Required:

- Mesh Inspector Target section shows only target Drawable name(s), both for new preview state and generated/edit state.
- Existing target diagnostic/stat rows such as status, preset, vertices, triangles, source, alpha bounds, max edge, max area, min angle, max valence, refinement, generation result, contour counts, fallback steps, contour regions, filtered triangles, constraint quality, and missing constraints are removed from Target.
- Single-selection Mesh behavior remains usable.
- Multi-select Mesh Tool shows selected Drawable names.
- Eligible Drawable = no generated/non-empty mesh yet, or empty scaffold mesh where generation is appropriate.
- Existing generated/non-empty mesh Drawables are excluded by default and shown with warning.
- `Generate preview` generates previews for all eligible selected Drawables.
- UI disables `Generate preview` while generation is running.
- `Apply mesh` is enabled only when eligible previews exist.
- `Apply mesh` applies previews to eligible Drawables only.
- `Cancel` discards all current previews.
- Canvas can show multiple mesh previews/overlays for selected eligible Drawables.

Must not:

- Overwrite existing generated meshes in batch mode.
- Add an overwrite/regenerate-existing-mesh route.
- Change the mesh generation algorithm.
- Treat slow batch generation as a bug unless the UI remains stuck after completion.

### 7.5 Rig Batch Create for Unbound Drawables

Required:

- Rig Tool multi-select target section shows selected Drawable names.
- Drawables already bound to any Deformer/RigControl are excluded from create actions and shown with warning.
- Eligible Drawable = selected Drawable that is not currently a child of any RigControl.
- If eligible count is zero, `Create Rotation Deformer` and `Create Warp Deformer` are disabled.
- `Create Rotation Deformer` creates one root Rotation Deformer whose `childDrawableIds` are all eligible selected Drawables.
- `Create Warp Deformer` creates one root Warp Deformer whose `childDrawableIds` are all eligible selected Drawables.
- Rotation pivot and Warp domain bounds are computed from the union bounds of eligible Drawables.
- Created Deformers do not require or write `partId`.
- Existing single Drawable Rig create remains usable.

Must not:

- Include already-bound Drawables.
- Create fake/common Parts Container ownership.
- Wrap already-bound Drawable children under a newly inserted Deformer.
- Mix existing parented and unparented Drawables into one wrapper operation.
- Add Deformer Tree multi-select.

### 7.6 Tests and UX Proof

Required:

- WebGL fake context tests catch framebuffer feedback-loop risk.
- A small renderer-specific browser/WebGL pixel proof or equivalent focused real WebGL proof confirms clipped target visible inside mask and not outside.
- Parts Tree unit tests cover normal/Ctrl/Shift selection, Parts Container exclusion, missing/nonvisible anchor fallback.
- E2E proves actual modifier-click behavior in Parts Tree for at least one focused PSD-import path.
- Select Inspector test proves selected Drawable names render for multi-selection.
- Mesh tests prove target simplification, existing-mesh warning/exclusion, preview/apply eligibility, and cancel behavior.
- Rig tests prove bound warning/exclusion, disabled zero-eligible state, and create payload/session result with multiple child Drawables and no `partId`.
- Save/load or package-format tests prove legacy and no-`partId` RigControls both load/round-trip safely.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. WebGL Clipping Feedback-Loop Fix | Wave75 pass baseline | Fix clipped drawable disappearance in WebGL and prove mask framebuffer safety |
| 1 | B. RigControl partId Legacy Optional Decoupling | Wave75 pass baseline | Decouple RigControl/Deformer from Parts Container ownership |
| 1 | C. Drawable Multi-Select Selection Model + Parts Tree + Select Inspector | Wave75 pass baseline | Add Drawable-only multi-select semantics and minimal Select Inspector projection |
| 2 | D. Mesh Target Simplification + Multi Preview/Apply | Domain C pass | Batch mesh previews/apply over selected Drawables and simplify Mesh Inspector Target |
| 3 | E. Rig Batch Create for Unbound Drawables | Domain B + C pass; after D to avoid context collisions | Create Rotation/Warp Deformer from eligible unbound selected Drawables |
| 4 | F. Final Integration / Clean Review / Map Closeout | Domains A-E pass or explicit escalation | Combined validation, independent clean review, reports/maps |

## 9. Domain A: `wave76-webgl-clipping-feedback-loop-fix`

Purpose:

- Fix WebGL clipping disappearance caused by mask framebuffer feedback loop.

Expected implementation areas:

- `packages/render-webgl2/src/webgl2-renderer.ts`
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
- Potential small renderer browser/readPixels test harness if existing infrastructure supports it

Required tests / evidence:

- Fake GL context tracks active texture unit, texture bindings, current framebuffer, and framebuffer color attachment.
- `drawElements` fails or records error when current framebuffer attached texture is bound to any texture unit.
- Test covers first clipped drawable.
- Test covers repeated clipped drawables / mask target reuse.
- Focused real WebGL/pixel evidence confirms clipped target visibility inside mask.

Early escape triggers:

- Existing test infrastructure cannot provide real WebGL proof without adding a broad or flaky oracle.
- Fix requires redesigning renderer clipping architecture.

## 10. Domain B: `wave76-rigcontrol-partid-legacy-optional-decoupling`

Purpose:

- Make `RigControl.partId` optional legacy metadata and stop new RigControls from depending on Parts Container ownership.

Expected implementation areas:

- `packages/package-format/src/model-files.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/runtime-graph-rig-controls.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/validator-core/src/validators/part-delete-blockers.ts`
- `packages/runtime-core/**` only for evidence/tests if needed
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- related fixtures/save-load tests

Allowed source change emphasis:

- Schema/API changes are allowed because accepted UX is blocked by stale package logic.
- Keep changes narrow to RigControl `partId` decoupling.

Required tests / evidence:

- Schema accepts old with-`partId` and new without-`partId` RigControls.
- Create rotation/warp/deformer operations work without `partId`.
- Operation results no longer emit Part target refs for RigControl creation.
- Validator delete blocker no longer blocks only because of legacy `rigControl.partId`.
- Runtime/evaluation evidence is unchanged for no-`partId` RigControls.
- Editor create and portable save/load no longer rely on `partId`.
- AI catalog required inputs updated.

Early escape triggers:

- Package compatibility requires a formal migration/versioning decision.
- Removing `partId` from new payloads breaks external operation contract assumptions not covered by current docs.
- Validator semantics reveal an actual non-legacy ownership use for `partId`.

## 11. Domain C: `wave76-drawable-multiselect-parts-tree-select-inspector`

Purpose:

- Add Drawable-only multi-select state and Parts Tree modifier-click behavior, then expose a minimal Select Inspector list.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Required tests / evidence:

- Unit tests for selection state transitions.
- Component or model tests for selected row flags.
- E2E modifier-click proof using existing row locators and `modifiers`.
- Inspector assertion for selected Drawable name list.
- Canvas projection test proving selected Drawable ids are reflected without subtree expansion.

Early escape triggers:

- Existing selection consumers cannot safely tolerate a multi-selection variant without broad refactor.
- E2E cannot reliably exercise modifiers without new test hooks.

## 12. Domain D: `wave76-mesh-target-simplification-multi-preview-apply`

Purpose:

- Simplify Mesh Inspector Target and support batch mesh preview/apply for selected eligible Drawables.

Expected implementation areas:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` if present or newly needed
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- related Mesh Tool tests

Required tests / evidence:

- Target section name-only assertion for single preview/edit state.
- Multi-select selected names assertion.
- Existing mesh warning/exclusion assertion.
- Generate preview for multiple eligible Drawables.
- Apply commits generated previews only for eligible Drawables.
- Cancel discards all previews.
- Canvas overlay/projection can represent multiple previews.

Early escape triggers:

- Existing mesh preview state is too entangled with single target to change without destabilizing single Mesh flow.
- Operation layer cannot apply multiple existing `generateMesh` commits without larger transaction/undo design.

## 13. Domain E: `wave76-rig-batch-create-unbound-drawables`

Purpose:

- Create one Rotation/Warp Deformer from multiple selected unbound Drawables.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- operation tests only if Domain B did not already cover needed no-`partId` payload behavior

Required tests / evidence:

- Eligibility helper detects already-bound Drawables.
- Inspector shows warnings for already-bound selected Drawables.
- Buttons disabled when zero eligible Drawables.
- Create Rotation Deformer creates one root RigControl with all eligible `childDrawableIds` and no `partId`.
- Create Warp Deformer creates one root RigControl with all eligible `childDrawableIds`, union domain bounds, and no `partId`.
- Existing single target create still works.

Early escape triggers:

- Domain B `partId` decoupling is incomplete.
- Existing operation schema still requires `insertBeforeChild` for selected Drawables.
- Product decision is needed for bound Drawable wrap behavior.

## 14. Domain F: `wave76-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave76 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave76/**`
- `discussion/implementation/reviews/wave76/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A-E reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave76 is marked complete.
- Final report records:
  - clipping root cause and fix;
  - WebGL feedback-loop proof;
  - `RigControl.partId` legacy optional behavior;
  - multi-select semantics;
  - Mesh batch behavior;
  - Rig batch behavior;
  - deliberately excluded wrap behavior;
  - validation results;
  - residual risks.
- Maps mark Wave76 status correctly.

Required checks:

- `pnpm typecheck`
- Focused render-webgl2 tests
- Focused package/operation/authoring/validator tests for `RigControl.partId`
- Focused editor selection / mesh / rig tests
- Focused Playwright PSD-import path for modifier multi-select and batch UX
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 15. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| WebGL clipped drawable visible inside mask | Real WebGL pixel proof or documented focused browser proof |
| No mask framebuffer feedback loop | Fake GL state guard tests |
| Old and new RigControls load | package-format/schema tests |
| New RigControls omit partId | operation/editor/save-load tests |
| Runtime evaluation ignores partId | runtime/evaluation evidence tests |
| Part delete not blocked by legacy rig partId | validator/operation tests |
| Parts Tree Ctrl/Shift multi-select | unit tests plus focused E2E |
| Parts Container excluded from multi-select | unit/component/E2E tests |
| Select Inspector lists selected Drawables | component/E2E assertion |
| Mesh Target name-only | component/E2E assertion |
| Mesh batch excludes existing mesh | model/component test |
| Mesh batch preview/apply/cancel works | model/e2e assertion |
| Rig batch excludes bound Drawable | model/component test |
| Rig batch creates one root Deformer | model/operation/e2e assertion |
| No wrap selected bound Drawables | negative test or explicit no-control assertion |

## 16. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave76/wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`
- `discussion/implementation/waves/wave76/wave76-domain-e-rig-batch-create-unbound-drawables-report.md`
- `discussion/implementation/waves/wave76/wave76-final-integration-report.md`
- `discussion/implementation/waves/wave76/_map.md`

Reviews:

- `discussion/implementation/reviews/wave76/wave76-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-d-test-adequacy-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-e-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-e-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-e-test-adequacy-review.md`
- `discussion/implementation/reviews/wave76/wave76-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave76/_map.md`

## 17. Subagent Contract

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
- Preserve Wave75 accepted behavior.
- Keep out-of-scope wrap behavior out of implementation.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

## 18. Orchestration Policy

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
- Must not implement out-of-scope wrap behavior, Deformer Tree multi-select, Canvas multi-select, existing mesh overwrite, or broad renderer redesign.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope and negative cases explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 19. Out of Scope

- Wrapping already-bound selected Drawable children under a newly inserted Deformer.
- Multiple-parent wrap behavior.
- Mixing unbound and already-bound Drawables into one wrapper operation.
- Child RigControl + Drawable mixed wrap.
- Deformer Tree multi-select.
- Canvas Shift/Ctrl multi-select.
- Existing mesh overwrite/regenerate route in batch Mesh mode.
- New mesh generation algorithm changes.
- Manual mesh topology expansion.
- Renderer architecture redesign.
- Isolate Selected mask opacity parity unless required by the direct clipping fix.
- PSD clipping extraction.
- Photoshop / PSD pixel-perfect clipping, masks, layer effects, blend modes, smart objects, or pixel oracle parity.
- Drawable Pool tree redesign in this wave; record as follow-up if still desired after Rig batch create.
- Slider performance optimization.
- New parameter system design.
- Full timeline/keyframe editor.
- Browser-local save slot / IndexedDB UI.
- Cloud persistence.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop import/export.
- New package format versioning unless required by `partId` optional compatibility.
- Viewer / Runtime View.
- Texture Atlas Task.
- Variant / Expression Manager.
- Dynamics expansion.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
