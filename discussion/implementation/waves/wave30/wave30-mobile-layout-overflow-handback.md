# Wave 30 Corrective Domain: Mobile Layout Overflow Handback

## Verdict

pass

## Domain

- Target: `wave30-mobile-layout-overflow-handback`
- Purpose: fix the mobile horizontal overflow blocker that prevented Wave30 Domain G from passing full e2e.
- Upstream gate: Domains A-F passed; Domain G escalated because full e2e failed at existing mobile `wave25-rig-control` overflow before the tutorial smoke, and the tutorial smoke still recorded mobile overflow.
- Orchestration: Gnome implementation and Review-Sylph review were separated. Orch-Sylph did not implement source changes.
- Fix loops: 0. Initial clean Review-Sylph verdict was `pass`.

## Files Changed

Gnome implementation:

- `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`
- `apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs`

Orch-Sylph reporting:

- `discussion/implementation/waves/wave30/wave30-mobile-layout-overflow-handback.md`
- `discussion/implementation/reviews/wave30/wave30-mobile-layout-overflow-handback-review.md`

Note: the current workspace contains Wave30 files as untracked additions, including the two implementation files above and prior Wave30 reports. This corrective domain did not revert or normalize unrelated Wave30 work.

## Evidence

- Root cause was the always-rendered tutorial workflow panel, not the rig-control workflow itself.
- Long tutorial readiness / evidence / non-goal text could exceed the mobile viewport because panel text containers did not constrain and wrap long tokens.
- The UI fix is local to the tutorial workflow panel and applies `min-width: 0`, `max-width: 100%`, and `overflow-wrap: anywhere` to long panel text/list content.
- The same always-rendered panel explains both the existing `wave25-rig-control` overflow and the tutorial mini model mobile overflow.
- The tutorial smoke no longer uses mobile overflow allowances for created, small-edit, viewer, or loaded states; overflow now fails the smoke instead of being logged as pass-through evidence.
- No dependency, manifest, lockfile, renderer, parser, asset I/O, image decode, pixel oracle, or broad app-shell redesign was introduced.

## Verification

Performed by Gnome:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts` -> pass, 20 tests.
- `node --check apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass.
- `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile layout all `count=0 scrollWidth=390`.
- `pnpm.cmd test:e2e` -> pass; previously failing `mobile wave25-rig-control` gate no longer fails.
- Diagnostic rerun for `mobile wave25-rig-control` -> `viewportWidth=390`, `documentScrollWidth=390`, `overflowingElementCount=0`.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd run check:deps` -> pass.
- Scoped whitespace checks -> pass; CRLF warnings only on pre-existing tracked e2e/UI diffs.

Independently performed by Review-Sylph:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts` -> pass, 20 tests.
- `pnpm.cmd typecheck` -> pass.
- `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile initial/created/small edit/viewer/loaded states all `count=0 scrollWidth=390`.
- `pnpm.cmd test:e2e` -> pass; desktop/mobile editor smoke passed and did not stop at `mobile wave25-rig-control`.
- `pnpm.cmd run check:source` -> `Source organization guard passed.`
- `pnpm.cmd run check:deps` -> `Dependency guard passed.`
- `git diff --check -- apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass/no output.

Performed by Orch-Sylph:

- Listed Wave30 report/review directories before adding this corrective report.
- Confirmed parent workspace contains the panel wrapping style and tightened tutorial overflow assertion path.
- Confirmed scoped status shows the implementation files as untracked Wave30 additions rather than dependency or manifest edits.

## Review Findings And Fix Loops

Review-Sylph verdict: `pass`.

- No blocking, medium, or low findings.
- Source organization and dependency policy passed.
- E2e assertion integrity passed: the tutorial smoke's mobile overflow allowance was tightened, not weakened.
- Non-goals remained contained.

Fix loops: none.

Review note: `discussion/implementation/reviews/wave30/wave30-mobile-layout-overflow-handback-review.md`

## Remaining Issues

No corrective-domain blocker remains.

The broader workspace still contains untracked Wave30 implementation and report files from multiple domains. Integrator should handle staging/integration scope explicitly.

## User-Decision Points

None.
