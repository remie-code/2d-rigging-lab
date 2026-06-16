# Wave77 Domain C Test Adequacy Review

- Target: `wave77-editor-wrap-selected-rig-ux-integration`
- Review lane: Test Adequacy Review
- Reviewer: Review-Sylph
- Date: 2026-06-16
- Verdict: `pass`
- Follow-up: rechecked after source-organization split to `deformer-tree-wrap-selection.ts` / `.test.ts`.

## Findings

No blocking findings.

No needs-change findings.

Non-blocking residuals:

- Browser E2E does not click through the new wrap-selected create flow end to end. The required representative proof is still adequate because Domain C has model, component, and editor-session integration coverage for wrap payload creation, disabled/warning rendering, and created-wrapper selection. Existing `psd-import.e2e.spec.ts` covers the surrounding Deformer Tree modifier selection, Pool tree, Pool DnD continuity, and Wave76 batch Rig regression path.
- Editor read-model negative coverage is concentrated on mixed-parent incoherence. Source has stale/missing target, parent mismatch, bound Pool Drawable, duplicate target, ancestor/descendant, and mixed root/parented branches, and Domain B tests cover operation-level rejects for these classes. Additional focused Domain C read-model tests for duplicate/ancestor/stale selection would reduce regression detection latency but are not required to pass this gate.

## Required Coverage Assessment

| Required Domain C verification | Assessment | Evidence |
|---|---|---|
| Coherent selection produces enabled create payloads | pass | Root Deformer + Pool Drawable read-model is coherent and creates Rotation/Warp payloads in `deformer-tree-wrap-selection.test.ts:33-92`; same-parent bound Drawable + Pool Drawable is coherent in `deformer-tree-wrap-selection.test.ts:107-157`; Inspector coherent component enables both buttons in `rig-tool-inspector.test.ts:191-208`. |
| Incoherent selection disables actions and warning | pass | Mixed-parent Deformer Tree selection returns `status: "incoherent"`, `canCreate: false`, warning copy, and undefined Rotation/Warp payloads in `deformer-tree-wrap-selection.test.ts:180-228`; Inspector warning and disabled buttons are asserted in `rig-tool-inspector.test.ts:211-230`. |
| Rotation pivot comes from selected bounds union | pass | Root Deformer + Pool Drawable Rotation payload asserts `pivot: { x: 44.5, y: 40 }` in `deformer-tree-wrap-selection.test.ts:71-80`; source computes read-model bounds union at `deformer-tree-wrap-selection.ts:118` and payload center at `deformer-tree-wrap-selection.ts:143-168`. |
| Warp domain comes from selected warp-domain bounds union | pass | Root + Pool and same-parent + Pool tests assert union `domainBounds: { x: 9, y: 19, width: 72, height: 42 }` in `deformer-tree-wrap-selection.test.ts:82-91` and `deformer-tree-wrap-selection.test.ts:148-157`; source computes warp-domain union at `deformer-tree-wrap-selection.ts:119` and uses it at `deformer-tree-wrap-selection.ts:181-207`. |
| Pool Drawable + root Deformer wrapper flow | pass | Model test commits the wrapper, updates root ids to the new wrapper, and checks wrapped child lists in `deformer-tree-wrap-selection.test.ts:33-105`. |
| Pool Drawable + same-parent existing children wrapper flow | pass | Model test wraps a bound Drawable plus Pool Drawable under the existing parent and checks parent and wrapper child lists in `deformer-tree-wrap-selection.test.ts:107-178`. |
| Created wrapper becomes selected | pass | Editor-session integration test selects a root Deformer plus Pool Drawable, creates a Rotation wrapper, then asserts selection is the created RigControl and the wrapped child/root state changed in `editor-session-context-history.test.ts:451-506`; source callbacks set selection to the returned RigControl in `editor-session-context.tsx:1210-1233` and `editor-session-context.tsx:1236-1259`. |
| Existing single Drawable Rig create regression | pass | Existing insertion path remains tested in `rig-tool-state.test.ts:170-215`; single selected Drawable UI path remains routed before the Deformer Tree branch in `rig-tool-inspector.tsx:119-126`. |
| Wave76 batch root create regression | pass | Batch target classification and all-unbound root Rotation/Warp creates remain tested in `rig-tool-state.test.ts:217-340`; Inspector batch button behavior remains covered in `rig-tool-inspector.test.ts:133-187`; browser PSD E2E still clicks batch Rotation create and validates committed two-child overlay in `psd-import.e2e.spec.ts:213-235`. |
| Representative component/browser/E2E proof where practical | pass | Component/SSR tests cover enabled/disabled/warning wrap UI in `rig-tool-inspector.test.ts:190-230`; editor-session integration covers actual command selection result in `editor-session-context-history.test.ts:451-506`; browser E2E covers Deformer Tree modifier selection and Pool DnD continuity in `psd-import.e2e.spec.ts:480-512`. |
| Typecheck recorded | pass | Orch-Sylph recorded `pnpm.cmd typecheck` as pass for Domain C. |

## Source/Test Trace

- `RigToolInspector` imports the focused wrap-selection model and consumes `deformerTreeSet` selection by deriving `createDeformerTreeWrapSelectionReadModel` and rendering `DeformerTreeWrapTargetStart`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:17-20`, `:70-73`, `:139-147`.
- The wrap target UI lists compact target names/details, renders warning copy with `data-testid="rig-tool-wrap-selection-warning"`, and disables both create buttons when `readModel.canCreate` is false: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:300-384`.
- `editor-session-context.tsx` imports the focused payload builders and still selects the returned wrapper RigControl after create: `apps/editor/src/features/editor-session/editor-session-context.tsx:143-146`, `:1210-1233`, `:1236-1259`.
- The read-model builder rejects missing/stale, parent mismatch, bound Pool Drawable, duplicate, ancestor/descendant, mixed-parent, and mixed root/parented selections before payload creation: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:71-132`, `:336-373`.
- Payload builders map `wrapChildren` into child Drawable/RigControl lists and preserve optional `parentRigControlId` for same-parent wraps: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:134-208`.
- Bounds resolution distinguishes Rotation bounds from Warp domain bounds, using child unions and Warp domain data where applicable: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:517-576`, `:634-642`.

## E2E / Integration Adequacy

The plan requires an E2E or integration proof for a representative wrap-selected flow. Domain C satisfies this with the editor-session integration test in `editor-session-context-history.test.ts:451-506`, which exercises the real context command path and resulting selection/state mutation.

Browser coverage remains representative rather than wrap-specific:

- Wave76 batch Rig root create regression is browser-clicked in `psd-import.e2e.spec.ts:213-235`.
- Deformer Tree modifier selection and Pool Drawable selection are browser-clicked in `psd-import.e2e.spec.ts:502-510`.
- Existing Pool Drawable DnD still works in `psd-import.e2e.spec.ts:511-512`.

This is acceptable for Domain C because the browser proof covers the UI surfaces most likely to regress from A/C integration, while the wrap mutation itself is covered by focused model/context tests and Domain B authoring/operation tests.

## Negative Case Assessment

Adequate for pass:

- Mixed existing non-root parents are rejected at the editor read-model/payload layer in `deformer-tree-wrap-selection.test.ts:180-228`.
- Ancestor/descendant warning rendering is covered at component level through an incoherent read-model in `rig-tool-inspector.test.ts:211-230`.
- Operation/authoring lower layers reject mixed parents, duplicates, missing children, parent mismatch, child-list mismatch, insert+wrap, and ancestor/descendant without mutation in `packages/operation-core/src/operations/rig-control.test.ts:787-925` and `packages/authoring-core/src/rig-control-mutations.test.ts:420-492`.

Residual test gap:

- Domain C does not directly model-test every read-model invalid reason in `deformer-tree-wrap-selection.ts:336-373`. This is non-blocking because one editor incoherence path, the disabled/warning UI path, and the lower-layer negative contracts are covered.

## Validation Reviewed

I did not rerun tests during this review. I reviewed the caller-recorded verification and inspected the current source/tests:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`: pass, 4 files / 32 tests after sandbox `EPERM` rerun.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- Scoped `git diff --check`: pass with LF-to-CRLF warnings only.

## User Decision Points

None.

## Final Recommendation

Domain C test adequacy is `pass`. The required model, component, integration, and representative browser evidence is sufficient for Wave77 Domain C, with the non-blocking residuals above carried into Domain D final integration review.
