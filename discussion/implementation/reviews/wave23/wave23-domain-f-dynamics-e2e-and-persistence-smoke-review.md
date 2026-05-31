# Wave 23 Domain F Review: Dynamics E2E and Persistence Smoke

> Target: `wave23-dynamics-e2e-and-persistence-smoke`  
> Domain: F  
> Review-Sylph: current context  
> Status: `pass`  
> Date: 2026-05-31

## Verdict

`pass`

Independent review found no blocking, high, medium, or low findings.

## Scope Reviewed

Domain F reported files:

- `apps/editor/e2e/dynamics-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`

The broader working tree also contains prior Wave 23 Domain A-E source, fixture, and report changes. Those were treated as upstream context already covered by their completion/review artifacts. This Domain F review focused on the reported e2e smoke/test-helper changes and verification after the upstream domains were present.

## Basis Checked

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- Domain A-E completion and review reports under `discussion/implementation/waves/wave23/` and `discussion/implementation/reviews/wave23/`
- Existing editor e2e runner and smoke patterns under `apps/editor/e2e/`
- Root/editor `test:e2e` scripts in `package.json` and `apps/editor/package.json`

## Findings

None.

## Design / Development Compliance Review

Result: `pass`

- Domain F stays in e2e/test-helper scope. The target diff adds a dynamics smoke import/call to `smoke-checks.mjs`, adds e2e test IDs to `test-ids.mjs`, and introduces the new dynamics persistence smoke file. It does not add broad editor, runtime, validator, operation, authoring, parser, file-picker, asset I/O, package manifest, or lockfile changes.
- Existing e2e patterns are followed. The smoke uses the established `createPageSession` page API, `waitForText`, `waitForTestId`, direct DOM assertions, browser localStorage inspection, screenshot evidence, reset isolation before/after the workflow, and horizontal overflow checks.
- Desktop/mobile coverage is real through the existing runner. `editorSmokeViewports` defines desktop `1280x900` and mobile `390x844` viewports (`apps/editor/e2e/smoke-checks.mjs:44`, `apps/editor/e2e/smoke-checks.mjs:46`, `apps/editor/e2e/smoke-checks.mjs:52`), `page-session.mjs` applies viewport width/height/mobile flags, and `scripts/editor-e2e-smoke.mjs` iterates every viewport before reporting pass.
- The dynamics workflow is minimal and stable: create group, set existing preview driver, run preview, reset preview, save, reload, load, and re-run preview (`apps/editor/e2e/dynamics-persistence-smoke.mjs:18`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:31`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:35`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:40`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:46`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:51`).
- Save/load assertions are meaningful for authored dynamics persistence. The saved project check parses `model/dynamics.json`, `model/parameters.json`, and `operationLogJsonl`, then checks schema version, package ID/revision, operation types/targets, group fields, `scalarDampedFollowV1`, reset policy, driver/output IDs, settings, computed output parameter, and generated runtime/validation artifacts (`apps/editor/e2e/dynamics-persistence-smoke.mjs:143`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:195`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:198`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:232`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:260`).
- Preview evidence is recomputed after load rather than treated as persisted UI state. The load check expects the authored group/parameter to return while preview output/evidence starts empty, then the smoke runs preview again and rechecks runtime evidence and validator diagnostics (`apps/editor/e2e/dynamics-persistence-smoke.mjs:124`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:51`).
- Validation/evidence checks are sufficient for Minimum Open Dynamics v1 smoke coverage. The test verifies runtime snapshot and validation report evidence are generated, preview evidence includes snapshot/report IDs, validator diagnostics are clean, and generated runtime/validation artifacts are present in saved persistence state.
- Accessibility and mobile usability basics are included through panel reachability, named controls, and no-horizontal-overflow checks (`apps/editor/e2e/dynamics-persistence-smoke.mjs:271`, `apps/editor/e2e/dynamics-persistence-smoke.mjs:320`, `apps/editor/e2e/smoke-checks.mjs:147`).
- Source organization policy is satisfied. No `index.ts` implementation logic or catch-all production source file was added; `pnpm.cmd run check:source` passed.
- Dependency policy is satisfied. No package manifest or lockfile diff exists, `pnpm.cmd run check:deps` passed, and a forbidden-scope diff scan found no new Cubism Physics, `.physics3`, file picker, parser, decode, real PNG/PSD asset dependency, or external dependency additions in the Domain F target diff.

## Test Adequacy Review

Result: `pass`

The e2e coverage is adequate for Domain F:

- Creation path asserts the committed `createParameter` plus `createDynamicsGroup` operation log, created computed output parameter, group row, generated evidence summary, and enabled preview controls.
- Preview run/reset path asserts frame-count status, computed output panel, driver value evidence, runtime snapshot/report evidence, and clean validator diagnostics.
- Save/load path asserts localStorage persistence at the package-file and operation-log level, reload/load UI restoration, and recomputation of preview evidence after load.
- The full e2e runner executes both desktop and mobile viewports and passed in this review.
- Existing PSD/binary/source intake, asset I/O boundary, drawable, mesh, layer, and preview smoke paths remain in the same runner and passed together with the new dynamics smoke.

Residual test risk is non-blocking: the e2e smoke checks that computed output/evidence exists and is recomputed, but it does not pin exact numeric solver output values. Exact deterministic solver values remain covered by Domain B runtime tests and Domain E fixture/contract evidence.

## Verification

Commands run independently:

| Command / check | Result |
|---|---|
| `git status --short -uall -- apps/editor/e2e/dynamics-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | Shows `smoke-checks.mjs` and `test-ids.mjs` modified, `dynamics-persistence-smoke.mjs` untracked/new. |
| `git diff -- apps/editor/e2e/dynamics-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | Reviewed. Tracked diff is limited to smoke runner integration and e2e test IDs; new smoke file read directly. |
| `node --check apps/editor/e2e/dynamics-persistence-smoke.mjs` | pass. |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed and mobile smoke passed. |
| `pnpm.cmd typecheck` | pass. |
| `git diff --check -- apps/editor discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; Git emitted LF-to-CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json` | pass; no output. |
| `rg -n '[ \t]+$' apps/editor/e2e/dynamics-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | pass; no matches. |
| `pnpm.cmd run check:deps` | pass; dependency guard passed. |
| `pnpm.cmd run check:source` | pass; source organization guard passed. |
| `git diff -G "Cubism|physics3|showOpenFilePicker|FileReader|parser|decode|dependency|PSD|PNG|file picker" -- apps/editor/e2e/dynamics-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | pass; no matching added diff output, CRLF warnings only. |

## Residual Risks

- The smoke is intentionally broad browser smoke, not a numeric solver oracle. Runtime/fixture tests remain the stronger oracle for exact dynamics values.
- The e2e runner prints preview/drawable screenshot summaries, not the dynamics screenshot summary, although the dynamics smoke captures and returns one. This is not blocking because pass/fail assertions cover the dynamics workflow and screenshot evidence is still produced in the returned smoke evidence.
- The wider working tree contains earlier Wave 23 domains. Integration-level review should still consider the combined Wave 23 diff before the wave is closed.

## Escalation / User Decision Points

None.
