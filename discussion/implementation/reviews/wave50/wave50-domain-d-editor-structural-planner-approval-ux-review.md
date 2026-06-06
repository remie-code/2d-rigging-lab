# Wave50 Domain D Review: Editor Structural Planner / Approval UX

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Wave50 Domain D clean re-review Sylph after fix pass
> Verdict: `pass`
> Reviewed: 2026-06-07

## Verdict

`pass`

The prior `needs_changes` blocker is closed. The structural planner now keeps descendant group containers in scope when the selected scope is a stable PSD group source ref, so nested descendant leaves no longer fall back to the destination parent merely because their immediate parent group draft was omitted.

No remaining blocking findings were found in the inspected Domain D source/tests. Domain D remains inside the accepted explicit deterministic structural expansion boundary: no semantic recognition, smart suggestion/proposal UI, auto-rigging, Photoshop compositing, renderer pixel oracle, Cubism compatibility claim, or external transport was introduced.

## Re-Review Basis

- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- Domain A-C reports/reviews listed in the re-review assignment
- `discussion/implementation/waves/wave50/wave50-domain-d-editor-structural-planner-approval-ux-report.md`
- Previous Domain D review artifact before this update

Source/tests inspected:

- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts`
- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-session/psd-structural-scaffold-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/explicit-psd-structural-scaffold-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- Structural references in the root-provided focused Editor test set

## Findings

1. Prior blocker: closed.

- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:448` now evaluates group scope with exact group id, path-style node refs, and ancestor-chain matches.
- The new ancestor-chain branch at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:465` includes descendant groups when an ancestor group's stable `sourceGroupId` or node ref matches the selected scope.
- Leaf scope still includes ancestor groups at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:489`, so group and leaf scope expansion are aligned.
- Approved leaves still force their full group ancestry into `requiredGroupIds` at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:662`, and approved group scaffolds are emitted from those required non-blocked drafts at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:173`.
- Leaf routing still uses the immediate parent group's generated part when that draft exists at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:607`. Because descendant group drafts now exist for stable group-source scopes, this no longer falls back to the selected destination parent for the fixed case.

2. Regression coverage for the fix: adequate for Domain D re-review.

- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts:76` adds a nested stable group-source scope test.
- The test proves the approved group scaffolds are exactly `group_hair` and `group_hair_front`, the child group has `sourceParentGroupRef: group_hair`, and its `generatedParentPartId` equals the generated parent group part.
- The same test proves the hidden nested leaf routes to the generated child group part and keeps `visibleInSource: false` / `initialRuntimeVisibility: false`.
- Existing planner coverage at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts:11` still covers root/group/leaf structural preview, group-as-part-container separation, hidden root leaf runtime-hidden behavior, and old root structural selection shape.
- Existing explicit panel tests at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:293` and `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:322` cover structural approval UI, hidden leaf eligibility, and stale-preview blocking.
- Existing leaf-only import-plan panel tests remain present at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:155`, `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:188`, and `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:237`.

3. Required structural behavior remains intact.

- Groups are emitted as strict `groupPartContainer` scaffolds at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:684` and carry generated part refs, not drawable/texture/mesh refs.
- Leaves are emitted as `leafDrawableScaffold` entries at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:706` with generated parent part, drawable, texture, mesh, source order, visibility, opacity, bounds, and byte evidence.
- `initialRuntimeVisibility` is copied from `visibleInSource` at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:732`, so hidden approved leaves are runtime-hidden.
- Group visibility/opacity remains evidence-only in the planner; no runtime group visibility semantics are added.
- Preview nodes continue to expose generated refs and runtime visibility at `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts:846`.

4. Editor workflow and UX boundary: pass.

- Preview generation stores the structural plan in Editor state through `runEditorExplicitPsdStructuralScaffoldPreviewWorkflow` at `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts:121`.
- Commit uses the existing operation-core path through `createImportPsdStructuralScaffoldOperationRequest` and `commitImportPsdStructuralScaffoldWithBinaryBytes` at `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts:257` and `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts:273`.
- The operation request is in-process GUI/human surface only at `apps/editor/src/editor-session/psd-structural-scaffold-command.ts:18`; no HTTP/WebSocket/MCP transport is introduced.
- Committed result projection records generated group/leaf refs and runtime-hidden labels through `projectCommittedPsdStructuralScaffoldIntakeState` at `apps/editor/src/editor-state/explicit-psd-structural-scaffold-state.ts:120`.
- The panel remains explicit approval UI. It posts chosen refs and blocks commit when approvals diverge from the last generated preview.

## Test Adequacy Notes

The previous reviewer noted that a workflow/controller or shell-level structural commit projection test would be stronger. The fix pass did not add a dedicated structural workflow/controller test, but the prior blocking issue is now directly covered in the planner test where the bug lived, and the root-provided focused Editor suite includes the surrounding workflow/controller/session/app-shell files.

I am not treating the remaining lack of a real PSD Layer Tree/save-load proof as blocking for Domain D after this fix. It remains a residual integration risk for later Wave50 focused e2e/integration domains.

## Verification Considered

Root-provided verification after the fix pass:

- `pnpm.cmd typecheck`: pass.
- Focused Editor Vitest: sandbox failed with esbuild `spawn EPERM`; approved rerun passed 5 files / 93 tests:
  - `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts`
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - `apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - `apps/editor/src/editor-session/session-adapter.test.ts`
  - `apps/editor/src/ui/app-shell/app-shell.test.ts`
- Earlier parser boundary/check:source/diff-check were reported as pass.

Review-local verification:

- Read the required Wave50 plan, automation policy, Domain A-C reports/reviews, Domain D report, and previous Domain D review.
- Inspected the structural planner, nested fix, workflow/session wiring, state projection, panel implementation, and focused tests.
- Ran targeted `rg` scans for scope/ref routing, group/leaf parentage, hidden/runtime visibility, structural tests, and forbidden-scope terms.
- Ran `git diff --check -- apps/editor discussion/implementation/reviews/wave50/wave50-domain-d-editor-structural-planner-approval-ux-review.md`: pass; Git emitted LF/CRLF working-copy warnings only.

I did not rerun Vitest in this clean re-review context because the root-provided approved rerun already covers the fix pass and the sandbox path is known to hit esbuild `spawn EPERM`.

## Remaining Risks

- Full real-PSD end-to-end proof for generated Layer Tree rows, save/load persistence, and visual browser inspection is still a later Wave50 integration responsibility.
- Structural workflow/controller commit projection could use a dedicated focused unit test in a later hardening pass, but no current blocking defect was found from source inspection.

## Files Changed By Review

- `discussion/implementation/reviews/wave50/wave50-domain-d-editor-structural-planner-approval-ux-review.md`

## User-Decision Points

None for Domain D.
