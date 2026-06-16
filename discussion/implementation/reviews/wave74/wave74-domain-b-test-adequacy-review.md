# Wave74 Domain B Test Adequacy Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave74 Domain B, `wave74-save-load-keyform-visibility-hardening`
- Lane: Test Adequacy Review

## Scope Reviewed

Reviewed the Domain B implementation report, the required wave/basis documents, and the current source/test diffs for:

- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`

Parallel Domain A tests in `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`, `packages/authoring-core/src/portable-project-bundle.test.ts`, and `packages/runtime-core/**` were checked only as supporting context. They are not counted as replacements for Domain B's required user-visible save/load evidence.

## Basis Used

- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/project-storage-task.md`

## Findings

No blocking findings.

No needs-change findings.

## Coverage Matrix

| Requirement / evidence target | Result | Evidence |
|---|---|---|
| Browser/e2e save -> reload -> reselect for Warp `controlPointOffsets` | Adequate | E2E creates a Warp keyform through the visible Parameter Binding Add/Update path and asserts evaluated overlay offsets before save at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:92`. After reload, it discovers the Warp row, reselects it, asserts Canvas offset count/first offset values, and asserts UI input values at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:236` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:255`. |
| Browser/e2e save -> reload -> reselect for Rotation `angleDegrees` | Adequate | E2E authors Rotation angle through Add/Update and asserts evaluated angle before save at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:70`. After reload and reselection, it asserts Canvas evaluated angle plus the Rotation angle input value at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:238`. |
| Browser/e2e save -> reload -> reselect for Rotation `translation` | Adequate | E2E authors Rotation translation through Add/Update and asserts Canvas translation before save at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:78`. After reload and reselection, it asserts Canvas translation x/y and UI Translation X/Y values at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:241` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:251`. |
| Distinguishes data loss from intentional selection/current parameter reset | Adequate | Before save, the test changes current parameter numeric value to `30` at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:113`. After reload/open, it asserts no selected Parts Tree row, Project inspector, active parameter default, current numeric value reset to `0`, and keyform state `No target` at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:147`. It then proves keyform data still exists through Deformer Tree badges without selecting a deformer at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:155`. |
| UI values and evaluated Canvas/deformer state after load | Adequate | Rotation angle, Rotation translation, and Warp offsets are asserted both through Parameter Binding UI inputs and Canvas/deformer overlay attributes after load at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:241`, `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:246`, `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:258`, and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:261`. |
| Deterministic keyform discovery after load without persisted selection/current slider pose | Adequate | Deformer rows expose deterministic `data-keyform-set-count` and `data-keyform-key-count`, and render a visible `Keyed N` badge when key count is positive at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:178` and `apps/editor/src/workspace/panels/deformer-tree-view.tsx:221`. E2E asserts badges after load while no Deformer Tree row is selected at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:155`, with helper assertions at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:325`. |
| Keyform count model projection | Adequate | `summarizeRigControlKeyforms` counts rig-control keyform sets and keys at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:610`; Warp and Rotation read models project those counts at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:674` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:719`. Model test asserts deterministic count projection for Deformer Tree discovery at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:286`. |
| Negative non-persistence assertion for selection/current parameter values | Adequate | Selection reset is directly asserted for Parts Tree and Deformer Tree at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:147` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:163`. Current parameter numeric value reset is directly asserted at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:151`. |
| Active tool / canvas view / active parameter coverage rationale | Non-blocking gap | The e2e directly asserts current parameter value reset but does not create a distinct active-tool or canvas-view pre-save state and then assert it is not restored. This is acceptable for Domain B because the Domain B changes do not touch persistence state, and the Wave74 Domain B required evidence specifically calls out selection/current parameter non-persistence. Final integration may add a broader provider/browser transient-state check if this becomes a wave-gate concern. |
| Tree reorder/reparent and Drawable runtime visibility after-load assertions | Adequate | E2E reorders visible Drawable rows before save and verifies relative order after load at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:21` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:188`. It creates a parent Warp over the Rotation deformer and asserts the loaded Rotation row's `data-parent-rig-control-id` matches the loaded Warp row at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:166`. It hides a Drawable before save and after load asserts the row shows `Show drawable`, then shows it and checks renderable count increments at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:192`. |
| Parameter Binding Add affordance | Adequate | Production UI renders Add when no current keyform exists and routes it through `addCurrent` at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:121`. The component test asserts the Add action is enabled for a between-key Warp offset state at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:116`. The e2e exercises Add for Rotation angle, Rotation translation, and Warp offsets at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:72`, `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:80`, and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:94`. |
| Package/session tests are supporting only | Adequate | Domain B does not rely on package-only evidence. The user-visible Playwright path is the primary proof, with Wave73/Wave74 package/runtime tests only supporting lower-level behavior. |

## Validation Reviewed / Rerun

Reviewed Domain B report validation:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
  - Reported sandbox startup failure with esbuild `spawn EPERM`, then approved escalated pass: 2 files / 9 tests.
- `pnpm.cmd typecheck`
  - Reported pass.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - Reported sandbox startup failure with `spawn EPERM`, then first escalated browser run failed on strict locator ambiguity, and final escalated rerun passed: 1 Playwright test.
- `node scripts/check-source-organization.mjs`
  - Reported pass.
- `node scripts/check-dependencies.mjs`
  - Reported pass.
- `git diff --check -- apps/editor packages/authoring-core packages/operation-core discussion/implementation/waves/wave74`
  - Reported pass.

This review reran one cheap non-destructive check:

| Command | Outcome |
|---|---|
| `git diff --check -- apps/editor/e2e/portable-project-save-load.e2e.spec.ts apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/deformer-tree-view.tsx apps/editor/src/workspace/panels/parameter-binding-section.tsx apps/editor/src/workspace/panels/parameter-binding-section.test.ts discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md` | Exit 0. CRLF normalization warnings only. |

I did not rerun Vitest or Playwright in this review lane. The assignment said broad e2e rerun was optional only if needed, and direct inspection plus the recorded focused validation was sufficient.

## Residual Risks / Non-Blockers

- The portable save/load Playwright test is intentionally broad and can fail from unrelated PSD import, tree, Canvas, project-storage, or selector regressions. This is acceptable because the task specifically required user-visible after-load proof.
- Keyform count discovery is compact: it proves that keyed rig controls are discoverable and countable, but it is not a full keyform browser or timeline. That matches Wave74's allowed discovery affordance scope.
- Component coverage for the new Add affordance is thin by itself because it checks SSR disabled state rather than click payload. The e2e exercises the actual Add path for all three Domain B keyform properties, so this is not a needs-change finding.
- Active tool and canvas view non-persistence are not directly asserted in the new Domain B e2e. No Domain B persistence code path was changed, and selection/current parameter reset is directly covered; keep this as final-integration awareness rather than a Domain B blocker.
- Existing Wave74 Domain A Design / Development review flagged ownership of the shared `rig-tool-state.ts` keyform-count projection. For this Domain B test adequacy lane, that projection and its model/e2e assertions are reviewed as Domain B evidence.

## User-Decision Points

None.

## Final Recommendation

`pass`.

Domain B has adequate user-visible browser evidence for save/load restoration of Warp `controlPointOffsets`, Rotation `angleDegrees`, and Rotation `translation`; deterministic after-load discovery without restored selection/current slider pose; negative reset assertions for selection/current parameter value; and supporting component/model tests for keyform counts and Add affordance.
