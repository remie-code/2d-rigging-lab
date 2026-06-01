# Wave25 Domain F Review: Rig Control E2E And Persistence Smoke

> Target: `wave25-rig-control-e2e-and-persistence-smoke`  
> Date: 2026-06-01  
> Role: Review-Sylph independent review  
> Implementer: `019e80a2-3777-73b2-ae68-df7f5fd015ae` / Gnome the 57th  
> Verdict: `pass`

## Scope Reviewed

This review inspected the required basis documents, actual changed files, current diff/status, Gnome's implementation report, and verification commands. The Gnome report was treated as a claim source only, not as the sole evidence.

Reviewed basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave25-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave24/wave24-final-report.md`
- `discussion/implementation/reviews/wave24/wave24-clean-integration-review.md`
- Wave25 Domain A-E completion and review artifacts under `discussion/implementation/waves/wave25/` and `discussion/implementation/reviews/wave25/`
- Gnome report: `discussion/implementation/waves/wave25/domain-f-gnome-implementation-report.md`

Reviewed changed files:

- `apps/editor/e2e/rig-control-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave25/domain-f-gnome-implementation-report.md`

## Findings

No blocking, high, medium, low, or needs-fix findings.

## Design / Development Compliance

Result: `pass`.

- Domain F stayed inside the expected e2e/report scope. The scoped status showed only `apps/editor/e2e/smoke-checks.mjs`, `apps/editor/e2e/test-ids.mjs`, the new `apps/editor/e2e/rig-control-persistence-smoke.mjs`, and Wave25 report/review artifacts.
- No production editor/runtime/operation/validator source fix was introduced by Domain F. Existing dirty source files belong to prior Wave25 domains and were not part of this review's changed-file set.
- No package manifest, workspace manifest, or lockfile dirty status was observed for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor/package.json`, or the relevant package manifests.
- `apps/editor/e2e/test-ids.mjs` mirrors the production rig-control test IDs and row helper from `apps/editor/src/editor-state/editor-test-ids.ts` (`rigControl.panel`, create/bind form IDs, evidence/diagnostics IDs, and `rigControl.row.<id>`).
- Targeted forbidden-scope scan over Domain F files found no file picker, parser, archive, image decode, dependency, Cubism SDK/Core, Cubism Viewer compatibility, Cubism Physics compatibility, `.moc3`, or `.model3` implementation/claim text.
- No `index.ts` implementation logic was touched.
- The new e2e file is focused on one browser workflow. It is longer than the smallest existing smoke files, but it is not a catch-all helper and does not centralize unrelated editor behavior.

## Test Adequacy

Result: `pass`.

- The new smoke uses real UI forms and submit buttons for create/bind. It sets DOM form fields on `rigControl.create.form` and `rigControl.bind.form`, then clicks `rigControl.create` and `rigControl.bind` (`apps/editor/e2e/rig-control-persistence-smoke.mjs:25`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:32`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:55`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:59`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:434`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:464`).
- It covers parent create, child create, child rig-control binding, and drawable binding, then checks operation status/log and user-visible rig-control rows/evidence (`apps/editor/e2e/rig-control-persistence-smoke.mjs:109`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:127`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:146`).
- It verifies browser-local persistence by reading saved `model/rig-controls.json`, operation log JSONL, package revision, target IDs, generated runtime artifacts, and generated validation artifacts from localStorage (`apps/editor/e2e/rig-control-persistence-smoke.mjs:198`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:206`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:246`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:271`).
- It verifies load restoration with authored rig controls, child binding, operation log, and preview-side semantic evidence (`apps/editor/e2e/rig-control-persistence-smoke.mjs:75`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:79`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:159`).
- It opens Viewer / Runtime before and after load and asserts semantic rig-control runtime evidence: evaluated count, rig-control IDs, hierarchy order, affected drawable, runtime diff, and no diagnostics (`apps/editor/e2e/rig-control-persistence-smoke.mjs:69`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:83`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:180`).
- Assertions are semantic/user-visible or saved-package JSON checks. They do not use pixel or exact matrix/numeric transform oracles beyond authored rest-angle persistence.
- Integration into `runEditorSmoke` keeps existing source/PSD/binary/dynamics/viewer smoke paths before the rig-control smoke, and the same function is called by the existing desktop/mobile viewport loop (`apps/editor/e2e/smoke-checks.mjs:76`, `apps/editor/e2e/smoke-checks.mjs:137`, `apps/editor/e2e/smoke-checks.mjs:145`, `apps/editor/e2e/smoke-checks.mjs:153`, `apps/editor/e2e/smoke-checks.mjs:161`).

## Accessibility / Layout Basics

Result: `pass`.

- The smoke asserts the Rig Control panel name, create/bind form names, submit button text, and field labels/control names (`apps/editor/e2e/rig-control-persistence-smoke.mjs:365`). These match the production panel labels in `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:37`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:62`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:129`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:158`.
- The smoke checks panel reachability before interacting with the form (`apps/editor/e2e/rig-control-persistence-smoke.mjs:320`).
- Horizontal overflow checks still run after the new rig-control smoke and after the post-smoke reset (`apps/editor/e2e/smoke-checks.mjs:165`, `apps/editor/e2e/smoke-checks.mjs:168`).

## Verification Performed

Initial non-escalated PowerShell commands failed with `windows sandbox: spawn setup refresh`; required reads and commands were rerun with escalation per tool policy.

| Check | Result |
|---|---|
| `git status --short -uall apps/editor/e2e discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | reviewed; Domain F e2e changes plus Wave25 report/review artifacts present |
| `git diff -- apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | reviewed; only rig-control smoke import/invocation/evidence return and e2e test-id mirror additions |
| `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs` | pass |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed, mobile smoke passed, `editor-e2e: smoke passed` |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass; source organization guard passed |
| `pnpm.cmd run check:deps` | pass; dependency guard passed |
| `git diff --check -- apps/editor discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| Manifest/lockfile dirty-status check | pass; no output |
| Targeted forbidden-scope scan over Domain F files | pass; no matches |

## Residual Risks

- Verification ran in a shared dirty Wave25 workspace, not a fresh checkout replay.
- The browser smoke proves user-visible semantic evidence and persisted package JSON, not pixel rendering or exact matrix math. Numeric transform determinism remains covered by Domains B/D runtime and fixture tests.
- The new smoke is integrated into the full editor e2e runner rather than exposed as a separate script, which is appropriate for Domain F's no-manifest-change constraint but means isolated reruns require invoking the full e2e smoke or a manual node import.

## Required Gnome Fix

None.

## User Decision Points

None.
