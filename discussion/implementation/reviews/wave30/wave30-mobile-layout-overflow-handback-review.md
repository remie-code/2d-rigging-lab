# Wave 30 Corrective Domain Review Note: Mobile Layout Overflow Handback

## Verdict

pass

## Reviewer

Review-Sylph, clean read-only context. The reviewer was separate from the Gnome implementation context and did not edit files.

## Scope Reviewed

- `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`
- `apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs`
- Related read-only context around `smoke-checks`, `editor.css`, and app-shell layout.
- Upstream Wave30 Domain F/G completion and review reports.

The reviewer noted unrelated Wave30 dirty/untracked files in the workspace and treated them as outside this corrective handback scope.

## Basis

- `discussion/implementation/waves/wave30/wave30-domain-f-editor-tutorial-mini-model-workflow-ux.md`
- `discussion/implementation/reviews/wave30/wave30-domain-f-editor-tutorial-mini-model-workflow-ux-review.md`
- `discussion/implementation/waves/wave30/wave30-domain-g-tutorial-mini-model-e2e-persistence-smoke.md`
- `discussion/implementation/reviews/wave30/wave30-domain-g-tutorial-mini-model-e2e-persistence-smoke-review.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

## Findings

No findings.

## Review Notes

- The overflow fix is layout-focused and applies wrapping constraints to long tutorial panel text: `min-width: 0`, `max-width: 100%`, and `overflow-wrap: anywhere`.
- The root-cause explanation is plausible from source because the tutorial workflow panel is always rendered and can affect unrelated mobile smoke paths such as `wave25-rig-control`.
- The tutorial e2e smoke no longer uses `allowOverflow: true` for the mobile workflow states under review. Overflow count now causes failure.
- Full e2e passed and did not stop at the previous `mobile wave25-rig-control` blocker.

## Verification Reviewed

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts` -> pass, 20 tests.
- `pnpm.cmd typecheck` -> pass.
- `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile initial/created/small edit/viewer/loaded all `count=0 scrollWidth=390`.
- `pnpm.cmd test:e2e` -> pass.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd run check:deps` -> pass.
- `git diff --check -- apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass/no output.

## Source Organization And Dependency Policy

pass

- Implementation scope stayed within UI source plus a narrow e2e assertion/smoke adjustment.
- No `index.ts` implementation logic was added.
- No dependency, manifest, or lockfile change was found in the reviewed scope.

## E2e Assertion Integrity

pass

The assertion adjustment tightens the tutorial smoke by removing the mobile overflow pass-through allowance. It does not hide or weaken real overflow detection.

## Remaining Issues

None for this corrective domain.

## User-Decision Points

None.
