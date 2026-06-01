# Wave 26 Domain E Test Adequacy Review

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: E `wave26-viewer-evidence-e2e-persistence-smoke`  
> Review lane: Test Adequacy  
> Reviewer: Review-Sylph  
> Date: 2026-06-01

## Verdict

`pass`

No blocking, high, or medium test adequacy findings were found for the Domain E target files.

## Findings

None.

## Evidence Reviewed

- Basis documents:
  - `discussion/implementation/orchestration/wave26-plan.md`
  - `discussion/implementation/current-capability-map.md`
  - `discussion/implementation/remaining-work-backlog.md`
  - `discussion/implementation/waves/wave25/wave25-final-report.md`
  - `discussion/implementation/reviews/wave25/wave25-clean-integration-review.md`
  - `discussion/implementation/waves/wave26/domain-a-completion-report.md`
  - `discussion/implementation/waves/wave26/domain-b-completion-report.md`
  - `discussion/implementation/waves/wave26/wave26-domain-c-validator-report-hardening-completion.md`
  - `discussion/implementation/waves/wave26/domain-d-completion-report.md`
- Target diff:
  - `git diff -- apps/editor/e2e/rig-control-persistence-smoke.mjs apps/editor/e2e/test-ids.mjs`
- Target files:
  - `apps/editor/e2e/rig-control-persistence-smoke.mjs`
  - `apps/editor/e2e/test-ids.mjs`
- E2E runner integration:
  - `scripts/editor-e2e-smoke.mjs`
  - `apps/editor/e2e/smoke-checks.mjs`

## Test Adequacy Assessment

Browser-level positive path is covered. `runRigControlPersistenceSmoke` now creates parent and child `rotation2d` rig controls, binds child rig control and drawable targets, adds an `addKeyform` operation for `rigControl:angleDegrees`, then opens Viewer / Runtime and applies the viewer parameter override (`apps/editor/e2e/rig-control-persistence-smoke.mjs:30`, `:45`, `:60`, `:67`, `:74`, `:83`). The keyform creation assertion checks committed operation status, operation log count, generated evidence, keyform list projection, target rig control, parameter id, and authored angle summary (`apps/editor/e2e/rig-control-persistence-smoke.mjs:178`).

Preview / Viewer inspection is covered at a semantic evidence level. The e2e asserts the Rig Controls panel preview evidence includes the authored angle keyform summary, then asserts Viewer / Runtime summary, runtime diff, diagnostics, affected drawable, evaluated parent/child controls, override count, override source, and local/world angle evidence (`apps/editor/e2e/rig-control-persistence-smoke.mjs:189`, `:227`).

Save/load persistence is adequately inspected. The smoke parses the browser-local persisted project, reads `model/rig-controls.json` and `model/keyforms.json`, verifies operation log entries and target ids, and compares parent, child, and keyform set JSON against the expected persisted shape (`apps/editor/e2e/rig-control-persistence-smoke.mjs:265`, `:272`, `:350`, `:399`). After reload/load, it verifies operation log count, child binding projection, keyform list projection, preview evidence, and diagnostics before reopening Viewer / Runtime (`apps/editor/e2e/rig-control-persistence-smoke.mjs:92`, `:198`, `:98`).

Viewer / Runtime recompute after load is covered. The smoke opens Viewer / Runtime before save, sets `param_preview_body_yaw` to `1`, asserts keyform-driven local/world evidence, reloads the page, loads the saved project, reopens Viewer / Runtime, reapplies the same override, and repeats the same assertions (`apps/editor/e2e/rig-control-persistence-smoke.mjs:83`, `:98`, `:227`). This proves the loaded package path can recompute the semantic viewer evidence without relying on pre-reload DOM state.

Negative UX coverage is present but narrow. The browser smoke asserts the initial unavailable state for the bind and keyform workflows, including empty-state text and disabled submit buttons (`apps/editor/e2e/rig-control-persistence-smoke.mjs:116`). Domain D unit coverage separately exercises deterministic keyform rejection messages for no eligible parameter, no eligible `rotation2d` control, missing selections, unsupported target kind, and non-finite numeric input (`apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:152`, `:178`, `:205`). This satisfies the review rubric, but the residual risk below records that the browser e2e does not submit an invalid keyform form.

Desktop/mobile and existing smoke coverage remain connected. The full editor smoke runner still defines `desktop` and `mobile` viewports (`apps/editor/e2e/smoke-checks.mjs:46`) and calls the rig-control smoke after source intake, drawable, mesh vertex, layer controls, asset I/O boundary, dynamics, and Viewer / Runtime smoke paths (`apps/editor/e2e/smoke-checks.mjs:76`, `:137`, `:145`, `:153`, `:161`). The target e2e test id mirror adds the keyform form, submit, list, and viewer parameter control identifiers needed by the browser smoke (`apps/editor/e2e/test-ids.mjs:63`, `:112`).

## Verification Performed

- `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs`: pass.
- `node --check apps/editor/e2e/test-ids.mjs`: pass.
- `git diff --check -- apps/editor/e2e`: pass; LF/CRLF warnings only.
- `pnpm.cmd test:e2e`: pass; desktop and mobile editor smoke both passed.
- `pnpm.cmd typecheck`: pass.

I did not independently rerun `pnpm.cmd run check:source` or `pnpm.cmd run check:deps` in this lane. The provided implementation summary reports both as passing, and this review focused on target e2e adequacy plus direct execution of the full browser smoke and typecheck.

## Residual Risks

- The browser-level negative UX path is limited to initial unavailable/disabled state checks. Invalid form submission diagnostics are covered by focused UI tests, not by the full browser smoke. This is acceptable for Domain E as implemented, but a future hardening pass could add a small browser invalid-submit assertion if the wave integrator wants the stricter "rejected submit" oracle in e2e.
- Viewer evidence is semantic text/runtime evidence, not a renderer or pixel oracle. This matches the Wave26 non-goals and Domain D handoff.

## User-Decision Points

None.

## Report Path

`discussion/implementation/reviews/wave26/wave26-domain-e-test-adequacy-review.md`
