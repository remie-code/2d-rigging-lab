# Wave 30 Domain G Completion Report: Tutorial Mini Model E2E Persistence Smoke

## Verdict

pass after corrective handback

## Domain

- Target: `wave30-tutorial-mini-model-e2e-persistence-smoke`
- Purpose: add browser e2e smoke coverage for create tutorial mini model -> inspect readiness -> small existing edit -> Preview / Viewer inspection -> save/load -> reinspection, with desktop/mobile and basic accessibility/layout observability.
- Upstream gate: Domains A-F were reported `pass`.
- Orchestration: Gnome implementation / verification and Review-Sylph review were separated. Orch-Sylph did not implement source changes.
- Initial Domain G verdict: `escalate` because mobile layout overflow required source/UI handback outside Domain G's e2e-only scope.
- Corrective handback: `wave30-mobile-layout-overflow-handback` passed and resolved the overflow blocker.
- Re-gate verdict: `pass`.
- Fix loops in Domain G: 0. Corrective source/UI work was handled by the separate handback domain.

## Files Changed

Domain G Gnome changes:

- `apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/smoke-checks.mjs`

No UI aria/test-id source tweaks were made by Domain G. The `test-ids.mjs` change mirrors existing editor test IDs for e2e use only.

## Evidence

- Added a focused tutorial mini model e2e smoke covering desktop and mobile viewports.
- The smoke verifies initial tutorial workflow readiness, creation of `pkg_tutorial_mini_model`, and `In progress: 7 of 8 tutorial steps ready` before browser-local save/load.
- The smoke performs a small existing edit through `moveMeshVertex` on the tutorial front hair mesh and verifies operation-log persistence.
- The smoke verifies Preview semantic evidence, Viewer / Runtime semantic evidence, validation diagnostics, and viewer parameter override evidence.
- The smoke verifies browser-local save/load and `Ready: 8 of 8 tutorial steps ready` after load.
- The smoke inspects localStorage package contents for parts, drawables, meshes, mask relation, rig control, dynamics, keyforms, runtime artifacts, validation artifacts, and the small edit operation.
- The full editor smoke runner now imports and invokes the tutorial mini model smoke after the part/texture/layer smoke.
- Assertions are semantic only. No full renderer, pixel oracle, real asset import, file picker, parser, image decode, archive, external dependency, or Cubism compatibility claim was added.

## Verification

Performed by Gnome:

- `node --check apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass.
- `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass for desktop/mobile workflow assertions.
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs` -> pass for desktop/mobile adjacent smoke.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd run check:deps` -> pass.
- `git diff --check -- apps/editor/e2e` -> pass, CRLF warnings only.
- `git diff -- package.json apps/editor/package.json pnpm-lock.yaml` -> no output.

Reviewed / independently rerun by Review-Sylph:

- `node --check apps\\editor\\e2e\\tutorial-mini-model-persistence-smoke.mjs` -> pass.
- `node apps\\editor\\e2e\\tutorial-mini-model-persistence-smoke.mjs` -> desktop/mobile workflow pass; mobile overflow recorded.
- `node apps\\editor\\e2e\\part-texture-layer-persistence-smoke.mjs` -> desktop/mobile pass.
- `pnpm.cmd test:e2e` -> fails before the tutorial smoke at existing mobile `wave25-rig-control` overflow, `documentScrollWidth=515`.
- `git diff --check -- apps/editor/e2e` -> pass, CRLF warnings only.
- Manifest/lockfile diff -> no output.

Re-gate verification after corrective handback:

- Gnome re-verification:
  - Inspected corrective reports and current Domain G e2e files.
  - Confirmed `tutorial-mini-model-persistence-smoke.mjs` no longer uses mobile `allowOverflow: true`; `observeHorizontalOverflow` defaults to strict failure on overflow.
  - `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile initial / created / small edit / viewer / loaded states all reported `count=0 scrollWidth=390`.
  - `pnpm.cmd test:e2e` -> pass; desktop/mobile editor smoke passed.
  - Scoped `git diff --check` for Domain G e2e / corrective files / Wave30 reports -> pass, CRLF warnings only.
  - Manifest/lockfile diff for discovered `package.json` manifests plus `pnpm-lock.yaml` -> no output.
- Clean Review-Sylph re-gate:
  - `node --check apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass.
  - `node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs` -> pass; mobile all states `count=0 scrollWidth=390`.
  - `pnpm.cmd test:e2e` -> pass.
  - `pnpm.cmd typecheck` -> pass.
  - `pnpm.cmd run check:source` -> pass.
  - `pnpm.cmd run check:deps` -> pass.
  - `git diff -- package.json apps/editor/package.json pnpm-lock.yaml` -> no output.
  - Scoped `git diff --check` -> no errors, CRLF warnings only.

## Review Findings And Escalation

Final Review-Sylph verdict: `escalate`.

Blocking escalation:

- Mobile layout overflow remains outside Domain G's e2e-only implementation scope.
- Focused tutorial smoke passes workflow assertions, but records mobile overflow after create/edit/viewer/load with `scrollWidth=472`.
- Full `pnpm.cmd test:e2e` fails before the tutorial smoke at existing mobile `wave25-rig-control` overflow with `documentScrollWidth=515`.
- Review-Sylph judged this not fixable by e2e-only work except by making tests fail earlier. Actual remediation requires source/UI layout work outside Domain G's allowed scope.

Non-blocking e2e review result:

- Review-Sylph found no e2e coverage blocker inside Domain G's allowed scope.
- The smoke covers create, 7/8 readiness, small edit, Preview evidence, Viewer evidence, explicit save/load, 8/8 readiness after load, and storage/package semantic checks.
- Source organization, dependency policy, and non-goal containment were acceptable for the Domain G changes.

Review note: `discussion/implementation/reviews/wave30/wave30-domain-g-tutorial-mini-model-e2e-persistence-smoke-review.md`

## Corrective Handback And Final Re-Gate

Corrective domain: `wave30-mobile-layout-overflow-handback`

- Completion report: `discussion/implementation/waves/wave30/wave30-mobile-layout-overflow-handback.md`
- Review note: `discussion/implementation/reviews/wave30/wave30-mobile-layout-overflow-handback-review.md`

The corrective domain fixed the source/UI mobile overflow blocker and tightened the tutorial smoke overflow checks rather than weakening them. The previous `mobile wave25-rig-control` full-e2e blocker no longer reproduces, and the tutorial mini model mobile smoke now reports `count=0 scrollWidth=390`.

Final clean Review-Sylph re-gate verdict: `pass`.

- No blocking findings remained.
- Domain G e2e coverage still matches the required workflow: create -> readiness 7/8 -> small mesh edit -> Preview / Viewer semantic evidence -> save/load -> readiness 8/8 -> reinspection on desktop/mobile.
- Assertions remain semantic-only; no full renderer or pixel oracle was introduced.
- No dependency, manifest, lockfile, package-scope, asset I/O, parser, image decode, archive, Cubism compatibility, or forbidden-scope issue was found.

## Remaining Issues

No blocking Domain G issues remain.

Broader Wave30 workspace remains dirty/untracked across multiple domains; Integrator should handle staging and integration scope explicitly.

## User-Decision Points

None.
