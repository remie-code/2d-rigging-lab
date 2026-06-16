# Wave 74 Plan: Authoring Save/Load Keyform Hardening + Deformer Foundation Fixes

> Wave73後の足場固めwave。ユーザーが設定できる基本 authoring state の保存復元をUI観点で証明し、load後のkeyform発見性を上げる。あわせて、mesh-bounds外へ出る頂点をWarp Deformer domainに含める修正と、Rotation translation keyform interpolationを直す。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave74
- Wave name: `authoring-save-load-keyform-hardening-deformer-foundation`
- Primary objective:
  - Warp Deformer作成/fit/reset domainをmesh vertex bounds基準へ更新し、レイヤー境界外mesh頂点が変形から取り残されないようにする。
  - Rotation Deformer keyed `translation` Vec2 をkeyform補間対象にし、x/yを線形補間する。
  - portable save/load後にdeformer motion keyformsが実データとして残り、UI/Canvas上でも再発見・再確認できることを証明する。
  - load後のkeyform発見性を、selection/current slider poseを永続化せずに改善する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first`, followed by user discussion.

Why planning is now safe:

- ユーザー判断が明確:
  - Slider performance改善は本waveから外す。
  - `selection`、`current parameter values`、`active tool`、`canvas view` は保存しない方針を維持する。
  - Keyform復元問題は、まず保存形式変更ではなくユーザー視点のsave/load hardeningと発見性改善で扱う。
  - keyform marker/count/keyed target indicationを強める方向を採用する。
  - Warp domain mesh-bounds fixとRotation translation interpolation fixは追加調査なしで実装計画に入れる。
- Read-only Sylph inventoryにより、次が確認済み:
  - package/session save-load pathは、warp offsets、rotation angle、rotation translationを含むmodel keyform dataを保存復元している可能性が高い。
  - 重大な欠落は、actual UI workflow after reloadでdeformer-motion keyformsを証明するe2e/visibilityが薄いこと。
  - load後にselection/current parameter valuesがresetされるため、keyformがUI上「消えた」ように見える。
  - deformer-motion keyforms、tree order/reparent、drawable runtime visibilityのafter-load UI assertionsが薄い。

Uncertainty:

- factual: medium. Warp domain creation/fit/resetの正確な境界、Rotation translation interpolationの現行抜け箇所、Keyform discovery UIの既存投影点はDomain内で確認が必要。
- decision: low. Product direction is fixed.
- cost of wrong plan: high. Deformer domainやkeyform補間を誤ると、基本的な変形品質と保存復元信頼性を損なう。

## 3. Accepted Decisions / Oracles

- Root / Undine must not implement the wave.
- Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for every started subagent.
- `wait_agent` timeout is polling timeout, not failure.
- Running child agents must not be killed, interrupted, closed, or summarized as complete.
- Completed child sessions must be closed by their parent.
- Current mesh generation default and accepted mesh improvements must not be reverted.
- Wave73 portable bundle Open/Save and editor-state hidden-part persistence must remain intact.
- Do not persist selection, active tool, canvas view, current parameter values, manual collapsed tree state, undo history, drafts, or in-progress gestures.
- Do not implement slider performance optimization in Wave74.
- Do not add browser-local save slot, archive/filesystem, new package format, Viewer/Runtime View, Texture Atlas, Variant, or mesh algorithm work.
- Keyform discovery should improve through marker/count/keyed target indication, not by restoring prior editor-local pose.
- Warp domain should include mesh vertex bounds, including vertices outside the source layer rectangle.
- Rotation keyed `translation` must be interpolated as a Vec2 with deterministic linear x/y interpolation.
- `restTranslation` remains fallback/setup state when no keyed `translation` applies.
- `restScale` / keyed scale remain unexposed.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Parameter Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Canvas Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Project Storage Task](../../design/screen-design/screens/project-storage-task.md)

Wave baseline:

- [Wave73 Plan](wave73-plan.md)
- [Wave73 Final Integration Report](../waves/wave73/wave73-final-integration-report.md)
- [Wave73 Final Clean Integration Review](../reviews/wave73/wave73-final-clean-integration-review.md)
- [Wave73 Domain A Report](../waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md)
- [Wave73 Domain B Report](../waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md)
- [Wave72 Final Integration Report](../waves/wave72/wave72-final-integration-report.md)

Confirmed inventory facts:

- Deformer-motion keyform data appears to survive package/session round-trip, but browser/UI after-load assertions are thin.
- load clears selection and current parameter values by design.
- Warp offsets, rotation angle, and rotation translation keyforms are not sufficiently asserted after portable reload through actual UI workflow.
- Mesh vertices may now extend outside source layer bounds due to accepted mesh generation behavior.

## 5. Review Policy

Each implemented domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks this wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks architecture, module boundary, source organization, operation boundary, dependency policy, deterministic behavior, UI responsibility split, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit / integration / browser / e2e coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- User-Facing UX Trace
- Operation / Runtime / Package Contract Trace
- Save/Load Keyform Evidence Trace where relevant
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

Wave74 uses two parallel implementation domains plus one final integration domain.

```text
Batch 1:
  Domain A: Deformer Foundation Fixes
  Domain B: Save/Load Keyform Visibility Hardening

Batch 2:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A and B start in parallel from the Wave73 baseline.
A owns Warp domain mesh-bounds behavior and Rotation translation interpolation.
B owns save/load keyform visibility and discovery affordances without relying on A's implementation details.
C depends on A/B pass or explicit escalation and performs combined validation, clean review, and map closeout.
```

Rationale:

- A and B are mostly independent in write scope and product responsibility.
- Warp domain and Rotation interpolation are direct deformation correctness fixes and should be isolated from UI discovery changes.
- Save/load keyform hardening can proceed against existing keyform/package/editor surfaces while A fixes deformation semantics.
- Any end-to-end proof that specifically combines A's corrected behavior with B's save/load/discovery behavior belongs to C's final integration validation.

## 7. Acceptance Criteria

### 7.1 Warp Domain Mesh-Bounds Fit

Required:

- Warp Deformer creation domain must include the selected drawable's committed mesh vertex bounds, not only source layer/drawable bounds.
- Fit/reset domain actions must use mesh vertex bounds when a committed mesh exists.
- Mesh vertices outside source layer bounds must be inside the resulting Warp domain plus deterministic margin.
- Existing behavior for drawables without a committed mesh must remain deterministic and use the existing fallback bounds.
- Domain margin must be deterministic and preset/geometry independent unless existing local pattern requires otherwise.
- Existing committed custom domains must not be silently overwritten except when the user invokes fit/reset or creates a new Warp Deformer.
- Canvas/evaluation tests must prove outside-layer mesh vertices move with Warp deformation rather than remaining effectively unwarped.

Must not:

- Change mesh generation algorithms.
- Clip mesh vertices back into source layer bounds.
- Introduce freeform topology or manual mesh editing behavior.

### 7.2 Rotation Translation Keyform Interpolation

Required:

- Keyform sampling/interpolation must include Rotation `translation` Vec2.
- `translation.x` and `translation.y` must interpolate linearly between keyed values.
- Exact key values must remain exact.
- `restTranslation` must remain fallback when no keyed `translation` applies.
- Rotation `angleDegrees` and opacity interpolation behavior must remain unchanged.
- Canvas evaluation and runtime evidence must use interpolated translation values.
- Save/load round-trip must preserve keyed translation and still evaluate interpolated values after load.

Must not:

- Expose or interpolate `scale`.
- Change package schema unless a narrow existing-schema export bug blocks implementation.

### 7.3 User-Visible Keyform Save/Load Hardening

Required:

- Add browser/e2e or equivalent user-visible tests that save, reload, and then reselect target/parameter context to assert:
  - Warp control point offset keyforms;
  - Rotation angle keyforms;
  - Rotation translation keyforms.
- Tests must distinguish "data lost" from "not visible because selection/current parameter was reset".
- Tests should assert both UI state/value and evaluated Canvas behavior where practical.
- Add after-load assertions for at least one tree reorder/reparent case and one Drawable runtime visibility toggle if stable within the existing fixture path.
- Package/session tests may support the proof, but cannot be the only evidence for user-visible keyform restoration.

### 7.4 Keyform Discovery After Load

Required:

- A loaded project with keyforms must expose a testable affordance that keyforms exist without requiring prior selection/current slider pose to be restored.
- The affordance should be one or more of:
  - keyform count;
  - key marker;
  - keyed target indication;
  - parameter/keyed binding summary.
- The affordance must be deterministic and must not rely on hidden test-only text.
- The affordance must not restore or persist selection/current parameter values as a side effect.
- The UI must still allow the user to reselect a keyed drawable/deformer and parameter/key value to inspect/edit the keyform normally.

Must not:

- Persist selection or current slider pose.
- Auto-jump to an arbitrary keyform in a way that changes evaluated pose on load unless explicitly documented and tested as a deliberate UX decision.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Deformer Foundation Fixes | Wave73 deformation/save-load baseline | Warp domain mesh-bounds fit and Rotation translation interpolation |
| 1 | B. Save/Load Keyform Visibility Hardening | Wave73 save-load/keyform baseline; parallel with A | User-visible after-load keyform assertions and keyform discovery affordance |
| 2 | C. Final Integration / Clean Review / Map Closeout | A/B pass or explicit escalation | Combined validation, independent clean review, reports/maps |

## 9. Domain A: `wave74-deformer-foundation-fixes`

Purpose:

- Fix deformation correctness gaps in parallel with save/load keyform visibility hardening.

Expected implementation areas:

- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts` or current warp creation operation path
- `packages/operation-core/src/payloads/rig-control.ts` only if fit/reset payloads need alignment
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/runtime-core/src/rig-control-keyform-state.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-transform.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx` only if fit/reset UX state requires it
- Focused operation/authoring/runtime/editor tests

Allowed write scope:

- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**`
- `apps/editor/**` for warp domain / rotation interpolation integration only
- `discussion/implementation/waves/wave74/**`
- `discussion/implementation/reviews/wave74/**`

Forbidden write scope:

- Save/load discovery UI implementation except narrow test fixtures needed by Domain A.
- Mesh generation algorithm changes.
- Restoring selection/current parameter values.
- Slider performance optimization.
- Viewer / Runtime View.
- New dependencies unless dependency policy is followed and escalated.

Required tests / evidence:

- Warp creation test: committed mesh with vertices outside layer bounds produces a domain containing all mesh vertices plus deterministic margin.
- Warp fit/reset test: mesh vertex bounds are used when committed mesh exists, fallback bounds when no mesh exists.
- Canvas/evaluation test proving outside-layer vertices deform with the lattice.
- Rotation translation interpolation tests:
  - rest fallback;
  - exact keyed value;
  - midpoint x/y linear interpolation;
  - after-load/evaluation if practical.
- Regression tests proving angle/opacity interpolation and Wave73 rotation translation editing still work.

Early escape triggers:

- Current Warp domain schema cannot represent mesh-bounds domains without a broader contract change.
- Existing evaluation intentionally treats outside-domain vertices by extrapolation in a way that conflicts with mesh-bounds fit.
- Rotation translation interpolation requires a package schema change beyond existing `translation` Vec2 support.

## 10. Domain B: `wave74-save-load-keyform-visibility-hardening`

Purpose:

- Prove and improve user-visible keyform restoration after portable save/load without persisting editor-local pose.

Expected implementation areas:

- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/features/project-storage/**`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/**` Parameter Bar / Tree / Deformer Tree keyed indicators if present
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/**` only for narrow assertion/helper fixes if tests reveal a real save/load bug
- `packages/operation-core/**` only if tests reveal an operation save/load bug
- Focused e2e/unit/component tests

Allowed write scope:

- `apps/editor/**`
- `packages/authoring-core/**` for narrow save/load assertion/helper fixes only
- `packages/operation-core/**` only for a confirmed operation serialization/hydration bug
- `discussion/implementation/waves/wave74/**`
- `discussion/implementation/reviews/wave74/**`

Forbidden write scope:

- Persisting selection/current slider pose/active tool/canvas view.
- Changing package format without a confirmed blocker.
- Deformer foundation fixes already owned by Domain A except if Domain A escalates and Domain B is explicitly revised.
- Slider performance optimization.
- Browser-local save slot / archive/filesystem / new save format.

Required tests / evidence:

- Reproduce/assert save/load workflow for:
  - Warp controlPointOffsets keyform;
  - Rotation angle keyform;
  - Rotation translation keyform.
- After load, reselect target and parameter/key value and assert keyform UI values.
- Assert evaluated Canvas/deformer state after load where stable.
- Add deterministic keyform discovery affordance tests:
  - keyform count/marker/keyed target indication appears after load;
  - affordance does not require prior selection/current slider pose persistence;
  - selection/current parameter values remain non-persisted.
- Add or strengthen after-load assertions for:
  - tree reorder/reparent;
  - Drawable runtime visibility toggle.
- If a real save/load loss is discovered, fix only that layer and record root cause.

Early escape triggers:

- Existing UI has no stable place for a user-facing keyform affordance without a broader Parameter/Timeline redesign.
- Browser e2e cannot reliably assert deformer keyform values without a new test-facing surface.
- Investigation proves keyform data is lost in package/session, requiring broader package/schema work.

## 11. Domain C: `wave74-final-integration-clean-review-map-closeout`

Purpose:

- Validate the combined foundation hardening work, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave74/**`
- `discussion/implementation/reviews/wave74/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- Relevant design maps only if status links need alignment

Acceptance:

- Domain A implementation report exists and records pass or explicit escalation.
- Domain B implementation report exists and records pass or explicit escalation.
- Domain A/B Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before the wave is marked complete.
- Final report records:
  - Warp mesh-bounds domain behavior;
  - Rotation translation interpolation;
  - save/load deformer keyform proof;
  - keyform discovery affordance;
  - deliberately non-persisted editor-local state;
  - validation results;
  - residual risks.
- Maps mark Wave74 status correctly.

Forbidden:

- Production source implementation except narrow documentation/map fixes.
- Closing the wave without independent clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused operation-core rig-control/keyform tests
- Focused authoring-core rig-control/keyform/portable bundle tests
- Focused runtime-core rotation/keyform evaluation tests
- Focused editor session/context tests
- Focused editor component/canvas interaction tests
- Focused Playwright portable save/load keyform path if stable
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Warp domain includes mesh vertices outside layer | Operation/authoring/editor tests |
| Fit/reset uses mesh vertex bounds | Focused tests |
| Outside-domain visual distortion fixed | Canvas/evaluation test or stable e2e evidence |
| Rotation translation interpolation | Runtime/keyform/editor tests |
| Rest translation fallback preserved | Runtime/editor tests |
| Keyform data restored after load | Package/session and UI/e2e assertions |
| Warp offset keyform after-load visible | E2E/component assertion |
| Rotation angle keyform after-load visible | E2E/component assertion |
| Rotation translation keyform after-load visible | E2E/component assertion |
| Keyform discovery affordance | UI/component/e2e assertion |
| Selection/slider pose not persisted | Negative provider/UI assertion |
| Tree reorder and drawable visibility after-load | Focused e2e or integration assertions |
| No slider performance work | Diff/review check |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`
- `discussion/implementation/waves/wave74/wave74-final-integration-report.md`
- `discussion/implementation/waves/wave74/_map.md`

Reviews:

- `discussion/implementation/reviews/wave74/wave74-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave74/wave74-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave74/wave74-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave74/wave74-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave74/wave74-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave74/wave74-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave74/wave74-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave74/_map.md`

## 14. Subagent Contract

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
- Do not run overlapping broad refactors.
- Implement within the domain write scope.
- Preserve existing mesh generation, Wave73 save/load foundation, and Wave73 rotation translation editing unless this plan explicitly requires a narrow change.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

## 15. Orchestration Policy

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
- Must not implement slider performance optimization, Viewer, browser-local save slot, archive/filesystem, mesh generation changes, or editor-local pose persistence outside this plan.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check Warp domain, Rotation translation interpolation, keyform save/load visibility, keyform discovery, forbidden scope, and test adequacy.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Slider performance optimization.
- Persisting selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, in-progress gestures, or manual collapsed tree state.
- Browser-local save slot / IndexedDB UI.
- Cloud persistence.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop import/export.
- New package format.
- Mesh generation algorithm changes.
- Manual mesh topology expansion.
- Exposing `restScale` or keyed scale.
- Viewer / Runtime View.
- Texture Atlas Task.
- Variant / Expression Manager.
- Dynamics expansion.
- Renderer/WebGL architecture expansion.
- Pixel oracle / Photoshop compositing parity.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
