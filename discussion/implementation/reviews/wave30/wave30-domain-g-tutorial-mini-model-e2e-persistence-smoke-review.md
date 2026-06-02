# Wave 30 Domain G Review Note: Tutorial Mini Model E2E Persistence Smoke

## Verdict

pass after corrective handback

## Reviewer

Review-Sylph, clean read-only context. The reviewer was separate from the Gnome implementation context and did not edit files.

## Scope Reviewed

- `apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- Related UI test-id sources:
  - `apps/editor/src/editor-state/editor-test-ids.ts`
  - `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`
  - `apps/editor/src/ui/app-shell/app-shell.ts`
- Upstream Domain A-F completion reports and review notes.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Findings

Final re-gate findings after corrective handback:

- No blocking findings.
- The prior mobile layout overflow escalation is resolved by `wave30-mobile-layout-overflow-handback`.
- Domain G report/review were updated from the prior `escalate` state to record final pass.

Initial Domain G findings, kept as resolved history:

1. Blocking / escalation: mobile layout overflow requires source/UI hand-back outside Domain G scope.
   - Focused tutorial smoke passes workflow assertions but records mobile overflow after create/edit/viewer/load with `scrollWidth=472`.
   - The smoke explicitly allows mobile overflow in `apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` around the created, small edit, viewer, and loaded layout checks.
   - Full `pnpm.cmd test:e2e` fails before the tutorial smoke at existing `mobile wave25-rig-control` overflow in `apps/editor/e2e/smoke-checks.mjs`, with `documentScrollWidth=515`.
   - This is not fixable by e2e-only work except making the test fail earlier. Actual remediation requires UI/layout source work outside Domain G's allowed write scope.

2. No e2e coverage blocker was found inside the allowed Domain G scope.
   - The smoke covers create, 7/8 readiness, small existing edit, Preview evidence, Viewer evidence, explicit save/load, 8/8 readiness after load, and storage/package semantic checks.
   - It uses semantic assertions only; no renderer/pixel oracle or dependency/manifest change was introduced.

## Verification Reviewed

- `node --check apps\\editor\\e2e\\tutorial-mini-model-persistence-smoke.mjs` -> pass.
- `node apps\\editor\\e2e\\tutorial-mini-model-persistence-smoke.mjs` -> desktop/mobile workflow pass; mobile overflow recorded.
- `node apps\\editor\\e2e\\part-texture-layer-persistence-smoke.mjs` -> desktop/mobile pass.
- `pnpm.cmd test:e2e` -> fail at existing `mobile wave25-rig-control`, `documentScrollWidth=515`.
- `git diff --check -- apps/editor/e2e` -> pass, CRLF warnings only.
- Manifest/lockfile diff -> no output.

## Design Compliance

- Domain G implementation changes are contained to `apps/editor/e2e/**`.
- No source UI aria/test-id tweaks were required.
- No broad editor implementation, runtime, operation, validator, asset I/O, parser, image decode, archive, dependency, manifest, full renderer, pixel oracle, or Cubism compatibility changes were introduced by Domain G.
- No `index.ts` implementation logic was added by Domain G.

## Test Adequacy

Adequate for Domain G's e2e coverage slice, but not sufficient for pass because mobile layout observability reveals a source/UI overflow issue.

The added smoke covers:

- Initial tutorial guided workflow readiness.
- Tutorial model creation.
- Tutorial readiness preflight evidence.
- Small existing mesh edit.
- Preview semantic evidence.
- Viewer / Runtime semantic evidence.
- Browser-local save/load and reinspection.
- Desktop and mobile viewports.
- Basic accessibility and reachability checks.
- Package persistence details in localStorage.

Adjacent part/texture/layer smoke was rerun and passed. Full editor e2e was attempted and failed before the tutorial smoke on an existing mobile overflow.

## Corrective Handback Re-Gate Review

Corrective domain: `wave30-mobile-layout-overflow-handback`

- Completion report: `discussion/implementation/waves/wave30/wave30-mobile-layout-overflow-handback.md`
- Review note: `discussion/implementation/reviews/wave30/wave30-mobile-layout-overflow-handback-review.md`

Clean Review-Sylph final verdict: `pass`.

Verification reviewed / performed:

- `node --check apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass.
- `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile initial / created / small edit / viewer / loaded states all reported `count=0 scrollWidth=390`.
- `pnpm.cmd test:e2e` -> pass; desktop/mobile editor smoke passed.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd run check:deps` -> pass.
- `git diff -- package.json apps/editor/package.json pnpm-lock.yaml` -> no output.
- Scoped `git diff --check` -> no errors, CRLF warnings only.

Assessment:

- Tutorial smoke overflow assertions were tightened, not weakened. `allowOverflow` now defaults to strict failure when `overflow.count !== 0`.
- Domain G coverage still matches create -> readiness 7/8 -> small mesh edit -> Preview / Viewer semantic evidence -> save/load -> readiness 8/8 -> reinspection on desktop/mobile.
- No full renderer, pixel oracle, dependency, manifest, lockfile, package-scope, parser, image decode, asset I/O, archive, or Cubism compatibility issue was introduced.
- Gnome/Review-Sylph separation was preserved; Review-Sylph remained read-only.

## Remaining Issues

No blocking Domain G issues remain.

Broader Wave30 workspace remains dirty/untracked across multiple domains; Integrator should handle staging and integration scope explicitly.

## User-Decision Points

None.
