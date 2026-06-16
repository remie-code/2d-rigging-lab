# Wave77 Domain C Spec Compliance Review

- Target: `wave77-editor-wrap-selected-rig-ux-integration`
- Review lane: Spec Compliance Review
- Reviewer: Review-Sylph
- Date: 2026-06-16
- Verdict: `pass`

## Findings

No blocking findings.

No needs-change findings.

## Review Basis

Reviewed from source, tests, and basis documents, not from the implementation summary alone.

- Basis: `discussion/implementation/orchestration/wave77-plan.md` sections 3.4, 3.5, 7.4, 11, 13, 15-17.
- Dependency baseline: Domain A and Domain B reports/reviews, plus Wave76 Rig single/batch baseline.
- Source scope: `deformer-tree-wrap-selection.ts`, `deformer-tree-wrap-selection.test.ts`, `rig-tool-state.ts`, `rig-tool-state.test.ts`, `editor-session-commands.ts`, `editor-session-context.tsx`, `editor-session-context-history.test.ts`, `rig-tool-inspector.tsx`, `rig-tool-inspector.test.ts`, and focused inspection of existing `psd-import.e2e.spec.ts` Rig/D&D paths.

Follow-up source-organization check: the wrap-selection read model, payload builders, candidate validation, warnings, and bounds helpers moved from `rig-tool-state.ts` into `deformer-tree-wrap-selection.ts`. `editor-session-context.tsx` and `rig-tool-inspector.tsx` now import those focused exports from the new module. I found no Spec Compliance change from the move, so the verdict remains `pass`.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Rig Tool / Inspector can consume a coherent Deformer Tree multi-selection. | `implemented` | Inspector imports and derives `createDeformerTreeWrapSelectionReadModel(session, selection)`, then routes `selection.kind === "deformerTreeSet"` to `DeformerTreeWrapTargetStart`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:17`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:72`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:141`. The read model accepts only `deformerTreeSet`: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:71`. |
| Target section lists selected Deformer/Drawable names compactly. | `implemented` | `DeformerTreeWrapTargetStart` renders `readModel.targets` with display name and detail: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:321`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:329`. Component test covers selected names and details: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:191`. |
| Create Rotation Deformer creates one wrapper for the coherent selected set. | `implemented` | Payload builder returns one Rotation create payload with `wrapChildren`, derived child arrays, and optional common parent: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:134`. Context imports the builder from the focused module and commits it through one create operation: `apps/editor/src/features/editor-session/editor-session-context.tsx:143`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1212`. |
| Create Warp Deformer creates one wrapper for the coherent selected set. | `implemented` | Payload builder returns one Warp create payload with `wrapChildren`, derived child arrays, and optional common parent: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:172`. Context imports the builder from the focused module and commits it through one create operation: `apps/editor/src/features/editor-session/editor-session-context.tsx:143`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1238`. |
| Incoherent selection disables create actions and shows warning. | `implemented` | Read model returns `canCreate: false` and warning for empty, missing, duplicate, ancestor/descendant, mixed parent, root/parented, and binding mismatch reasons: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:85`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:336`. Inspector disables both buttons and renders warning: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:351`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:365`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:379`. Component test covers disabled buttons and warning: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:211`. |
| Pool Drawable plus selected root Deformer can create a new root wrapper. | `implemented` | Read model allows root RigControl plus Pool Drawable with no parent id; Rotation and Warp payload tests cover child lists, `wrapChildren`, union geometry, and root wrapper commit: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:33`. |
| Pool Drawable plus selected same-parent existing children can create a wrapper under that common parent. | `implemented` | Read model derives `parentRigControlId` when existing selected children share one immediate parent and allows Pool Drawable to join; test covers bound Drawable plus Pool Drawable and committed parent child-list update: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:107`. |
| Created wrapper becomes selected after creation. | `implemented` | Context selects returned `rigControlId` and clears selection anchors for both Rotation and Warp wrap-create methods: `apps/editor/src/features/editor-session/editor-session-context.tsx:1225`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1249`. Context-history test covers created wrapper selection after Deformer Tree wrap-selected create: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:451`. |
| Existing Deformer Tree D&D behavior still works. | `implemented` | Domain C did not replace D&D commands. Editor command wrappers still route D&D to `bindRigControlChild`, `moveDrawableRigControlBinding`, and `reparentRigControl`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:324`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:341`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:355`. Existing PSD E2E still covers Pool row drag to Deformer row: `apps/editor/e2e/psd-import.e2e.spec.ts:511`. |
| Existing single Drawable Rig create remains usable. | `implemented` | Single Drawable Inspector branch and context methods remain separate from `deformerTreeSet`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:121`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1126`. Existing E2E covers single Warp draft/apply and Rotation create: `apps/editor/e2e/psd-import.e2e.spec.ts:412`, `apps/editor/e2e/psd-import.e2e.spec.ts:616`. |
| Wave76 batch root create for unbound Drawables remains usable and separate. | `implemented` | `drawableSet` branch still uses `createRotationDeformerForDrawables` / `createWarpDeformerForDrawables`, not wrap-selected path: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:131`. Wave76 batch behavior remains covered in model and E2E tests: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:267`, `apps/editor/e2e/psd-import.e2e.spec.ts:213`. |
| Rotation wrapper pivot is computed from selected target bounds union. | `implemented` | Read model computes `bounds = unionRects(validCandidates.map(...))`; Rotation payload uses its center as pivot: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:118`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:163`. Root Deformer plus Pool Drawable test asserts union-derived pivot: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:71`. |
| Warp wrapper domain is computed from selected target warp-domain bounds union. | `implemented` | Read model computes `warpDomainBounds` union; Warp payload uses it as `domainBounds`: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:119`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:181`. Tests assert union-derived domain for root plus Pool and same-parent plus Pool cases: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:82`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:148`. |
| Existing parent and child Deformer geometry is not changed by wrap-selected UX. | `implemented` | Domain C only builds new wrapper geometry and passes `wrapChildren`; existing D&D/edit geometry updates remain separate. Domain B accepted operation tests verified existing geometry preservation, and Domain C source does not call `updateRigControl` in wrap-create methods: `apps/editor/src/features/editor-session/editor-session-context.tsx:1212`, `discussion/implementation/reviews/wave77/wave77-domain-b-spec-compliance-review.md:29`. |
| Exact mixed Drawable/RigControl display-order preservation. | `explicit non-goal` | Wave77 explicitly excludes exact mixed order preservation because child Drawables and child RigControls live in separate arrays: `discussion/implementation/orchestration/wave77-plan.md:97`, `discussion/implementation/orchestration/wave77-plan.md:558`. |
| Focused browser E2E for the complete wrap-selected click path. | `deferred by plan` | Plan allowed falling back to model/component tests when E2E cannot reliably perform the selected flow: `discussion/implementation/orchestration/wave77-plan.md:388`. Domain C has model, component, and context-history coverage; no new full browser click path was found in `psd-import.e2e.spec.ts`. |

## Must-Not Compliance

- No auto-resize/refit of existing Deformers on D&D: pass. D&D still dispatches bind/move/reparent commands only, and geometry edits remain under explicit update flows: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:324`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:369`.
- No wrapper for children from multiple existing non-root parents: pass. Read model rejects `uniqueParentedParentIds.length > 1`: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:102`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:110`. Negative test covers mixed-parent selected bound Drawables: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:180`.
- No ancestor/descendant wrap: pass. Read model rejects selected RigControl descendants and selected Drawables inside a selected RigControl subtree: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:98`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts:401`.
- No broad auto-rigging or semantic inference: pass. Domain C derives candidates only from explicit selected target ids and current graph parentage/bounds; no name, image, hierarchy-semantic, or AI inference path was added in reviewed source.
- No package format redesign or `RigControl.partId` ownership reintroduction: pass. Domain C reviewed edits are editor-local integration and pass Domain B's accepted `wrapChildren` payload surface; no save/load package-format source is in this change. Domain B review also accepted no `partId` ownership reintroduction: `discussion/implementation/reviews/wave77/wave77-domain-b-spec-compliance-review.md:34`.

## Verification Evidence

Reviewed test source covers the Domain C behavior:

- Model wrap payloads and commits: `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:33`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:107`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts:180`.
- Inspector enabled/disabled/warning UI: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:190`.
- Context selection after wrap-create: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:451`.
- Existing single/batch/D&D flows: `apps/editor/e2e/psd-import.e2e.spec.ts:213`, `apps/editor/e2e/psd-import.e2e.spec.ts:412`, `apps/editor/e2e/psd-import.e2e.spec.ts:511`, `apps/editor/e2e/psd-import.e2e.spec.ts:616`.

Orch-Sylph reported the following focused checks as passing after the source move: focused Vitest for `deformer-tree-wrap-selection.test.ts`, `rig-tool-state.test.ts`, `rig-tool-inspector.test.ts`, and `editor-session-context-history.test.ts` with 4 files / 32 tests; `pnpm.cmd typecheck`; source organization; dependency check; and scoped `git diff --check` with only LF-to-CRLF warnings. This review did not rerun those commands.

## Residual Risks

- No full browser E2E was found for clicking Deformer Tree mixed selection and then invoking wrap-selected create end to end. The accepted fallback evidence is model plus component plus context-history coverage, so this is non-blocking for Spec Compliance.
- Ancestor/descendant rejection is source-enforced in the read model and operation baseline, while Domain C's component test injects the warning read model rather than constructing an ancestor/descendant session. Treat as a Test Adequacy follow-up only if broader UI proof is required.

## User Decision Points

None.
