# Wave31 Domain C Review Notes: Editor Source Intake File Input Draft

## Review Status

- Final verdict: pass
- Initial review verdict: needs_changes
- Re-review verdict: pass
- Fix loops used: 1 of 2
- Review mode: read-only clean Review-Sylph contexts

## Review Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave31-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/waves/wave30/wave30-final-report.md`

## Scope Reviewed

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

The worktree also contained unrelated Wave31 changes under `packages/**`, `fixtures/**`, and discussion docs. Review-Sylph did not treat those as Domain C changes.

## Initial Finding

### Medium: Selected-file rights/provenance summary could become stale

`apps/editor/src/ui/source-assets/source-intake-form.ts` initially updated the selected-file summary only on file input change. If a user selected a file first and then edited rights/provenance controls, the pre-commit UI could show stale `Rights draft` and `Provenance draft` labels.

Impact:

- Submitted draft state still read current rights/provenance, so state was not corrupted.
- The visible pre-commit UI could be untruthful, which violated the Domain C UI truthfulness requirement.

Required fix:

- Refresh selected-file summary when rights/provenance controls change.
- Add a focused regression test for selecting a file first, then editing rights/provenance before submit.

## Fix Review

Gnome fix loop 1 changed:

- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

Re-review result:

- Prior stale summary issue is fixed.
- `source-intake-form.ts` refreshes the selected-file summary on rights status, creator, license, source URL, notes, redistribution, and AI-use control changes.
- `source-intake-panel.test.ts` covers selecting a file first, then editing rights status, creator, license, and AI-use before submit.

## Truthfulness Review

Passed:

- Selected file metadata is presented as draft metadata before commit.
- UI displays filename, byte length, declared media type, rights draft, provenance draft, and storage truthfulness.
- Storage wording states bytes are selected in browser memory only, not committed to package, and require reupload after reload.
- Tests assert no parser/decode/archive/renderer correctness claims.
- No operation commit wiring was introduced.

## Source Organization Review

Passed:

- No implementation logic was added to `index.ts`.
- No forbidden scope was touched by Domain C.
- No dependency, manifest, or lockfile changes were introduced by Domain C.

Warning:

- `apps/editor/src/ui/source-assets/source-intake-form.ts` is now large enough that future source-assets work should consider splitting file-input summary helpers if the form grows again. This is not blocking for Domain C because `check:source` passed and the file remains cohesive.

## Test Adequacy

Passed:

- Focused state tests cover selected file metadata normalization, deterministic validation, and no operation payload.
- Focused UI tests cover file input rendering, selected metadata display, storage truthfulness, local draft confirmation, live rights/provenance summary refresh, and no parser/decode/archive/renderer claims.
- Editor view-model test remained in the focused verification set.

## Verification Evidence

Reported by Gnome and rechecked by Review-Sylph:

- `pnpm.cmd exec vitest run apps/editor/src/ui/source-assets/source-intake-panel.test.ts`: pass, 13 tests
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-state/editor-view-model.test.ts`: pass, 31 tests
- `pnpm.cmd typecheck`: pass
- `pnpm.cmd run check:source`: pass
- `pnpm.cmd run check:deps`: pass
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui/source-assets`: pass with only CRLF warnings

## Remaining Issues

- None for Domain C.
- Operation/session/package commit wiring remains deferred to later Wave31 domains.
- Non-Domain-C Wave31 package, validator, fixture, and discussion changes should remain separated in integration records.

## User Decision Points

None.
