# Wave28 Domain D Review: Editor Layer Tree Draft State View Model

- Target: `wave28-editor-layer-tree-draft-state-view-model`
- Verdict: `pass`
- Orch-Sylph: coordinated only; did not perform source implementation.
- Implementation agent: Gnome `019e8283-e0a5-7192-993e-4ee31eaffce7`
- Review agent: Review-Sylph `019e82af-4f2b-7e72-bbb0-9ce2843b0bb8`
- Full-history fork: not used for either subagent.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Implementation Summary

Gnome reported a focused Domain D implementation:

- Added `layerTreeDraft` editor-only state for drawable selection, lock, and editor-hide.
- Added deterministic draft actions for select, clear selection, lock toggle/update, and editor-hide toggle/update.
- Added a part-grouped layer tree view model with texture resolved/missing/unassigned state, runtime visibility, editor-hidden, locked, and selected fields/labels.
- Added a standalone focused `ui/layer-tree` draft panel that emits draft callbacks only and does not wire operation commits.

## Files Changed by Domain D

- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/layer-tree-draft-state.test.ts`
- `apps/editor/src/editor-state/layer-tree-view-model.ts`
- `apps/editor/src/editor-state/layer-tree-view-model.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/layer-tree/index.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- `discussion/implementation/waves/wave28/domain-d-editor-layer-tree-draft-state-view-model-completion.md`
- `discussion/implementation/reviews/wave28/domain-d-editor-layer-tree-draft-state-view-model-review.md`

## Review Findings

Review-Sylph returned `pass` with no blocking or needs-fix findings.

Key checks passed:

- Domain D files stay in allowed `editor-state` and focused `ui/layer-tree` scope.
- No Domain D layer-tree wiring was found in `editor-workflow`, `editor-session`, `app`, or e2e scope.
- `apps/editor/src/editor-state/index.ts` and `apps/editor/src/ui/layer-tree/index.ts` remain barrel-only.
- `editorHiddenIds`, `lockedIds`, and `selection` remain editor draft state.
- Runtime visibility is projected separately from editor-only hide.
- Texture labels are deterministic for resolved, missing, and unassigned states.
- `layer-tree-panel` exposes callbacks only and does not commit operations.

## Verification

Gnome reported:

- Focused Domain D tests: passed, 3 files / 4 tests.
- Affected editor-state tests: passed, 5 files / 13 tests.
- Existing drawable/composition/rig/source-intake UI compatibility tests: passed, 4 files / 30 tests.
- Domain D `git diff --check`: passed with CRLF warnings only.

Review-Sylph independently reported:

- Focused Domain D tests: passed, 3 files / 4 tests.
- Nearby editor-state compatibility tests: passed, 2 files / 16 tests.
- Existing drawable/composition/rig/source-intake UI tests: passed, 4 files / 30 tests.
- `editor-test-ids.test.ts`: passed, 1 test.
- Domain D `git diff --check`: passed with CRLF warnings only.

Typecheck:

- Editor/package typecheck was attempted, but still fails due to out-of-scope parallel Wave28 changes in non-Domain-D areas such as `packages/operation-core`, `packages/validator-core`, and/or `editor-preview`.
- This is recorded as residual workspace risk, not a Domain D needs-fix item.

Skipped:

- E2E was not run. Domain D forbids e2e edits and is scoped to focused editor state/UI tests plus typecheck if practical.

## Residual Risks

- Layer tree UI is a draft component and is not mounted into the app shell or persisted through workflow/session integration in this domain. That is intentional; workflow integration belongs to later Wave28 domains.
- The workspace contains parallel Wave28 edits in paths forbidden for Domain D, including `packages/**` and `editor-preview/**`. Those were treated as out-of-scope parallel domain changes.

## User-Decision Points

None.
