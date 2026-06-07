# Wave51 Domain E Focused Regression / Guardrails Review

- verdict: `pass`
- role: clean Review-Sylph
- scope: source review only, except this review artifact

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-a-boundary-coupling-target-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-b-psd-import-production-coupling-removal-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-b-psd-import-production-coupling-removal-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-c-task-view-shell-foundation-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-c-task-view-shell-foundation-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-d-test-evidence-surface-preparation-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-d-test-evidence-surface-preparation-review.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Files Reviewed

- `scripts/check-production-testid-boundary.mjs`
- `scripts/check-production-testid-boundary-fixtures.mjs`
- `scripts/production-testid-boundary-fixtures/valid-assignments/apps/editor/src/valid-testid-assignment.ts`
- `scripts/production-testid-boundary-fixtures/valid-excluded-tests-and-e2e/apps/editor/src/component.test.ts`
- `scripts/production-testid-boundary-fixtures/valid-excluded-tests-and-e2e/apps/editor/e2e/smoke.ts`
- `scripts/production-testid-boundary-fixtures/invalid-selector-string/apps/editor/src/behavior.ts`
- `scripts/production-testid-boundary-fixtures/invalid-attribute-readback/apps/editor/src/behavior.ts`
- `scripts/production-testid-boundary-fixtures/invalid-dataset-read/apps/editor/src/behavior.ts`

Note: the Domain E script and fixture files are currently untracked, so plain `git diff -- scripts/...` does not show their contents. They were reviewed by direct file reads and `git status --short -uall`.

## Findings Ordered By Severity

None.

## Checks Performed

1. Domain E guardrail requirement is satisfied without product implementation or broad e2e expansion.
   - The guard is implementation-owned tooling under `scripts/**`, which is within Domain E scope and covered by the source organization policy.
   - The default scan root is `apps/editor/src` and the scanned extensions are `.ts` / `.tsx` at `scripts/check-production-testid-boundary.mjs:5-6`.
   - The implementation does not change production Editor source, package behavior, e2e tests, UI layout, command schemas, or product workflows.

2. `data-testid` remains allowed as a test-facing observation hook while production behavior dependency patterns are blocked.
   - Test-id assignment remains valid through `dataset.testid = ...`, `dataset["testid"] = ...`, and `setAttribute("data-testid", ...)`, proven by the `valid-assignments` fixture.
   - Non-assignment `dataset.testid` / `dataset["testid"]` use is rejected by the simple-assignment check at `scripts/check-production-testid-boundary.mjs:199-209`.
   - `[data-testid...]` selector strings are rejected at `scripts/check-production-testid-boundary.mjs:235`.
   - `getAttribute("data-testid")`, `getAttributeNode("data-testid")`, `hasAttribute("data-testid")`, `attributes.getNamedItem("data-testid")`, and `attributes["data-testid"]` readbacks are rejected at `scripts/check-production-testid-boundary.mjs:246` and `scripts/check-production-testid-boundary.mjs:257`.

3. Exclusions and fixtures are appropriate.
   - Test/e2e exclusion rules cover `/e2e/`, `/__tests__/`, `/test/`, `/tests/`, and `.test` / `.spec` TypeScript filenames at `scripts/check-production-testid-boundary.mjs:92-97`.
   - The `valid-excluded-tests-and-e2e` fixture intentionally includes selector/readback/dataset-read patterns only in test/e2e locations and passes.
   - The three invalid fixtures separately lock the selector string, attribute readback, and dataset read failure modes.
   - The fixture runner asserts both expected exit status and expected diagnostic text for all five cases at `scripts/check-production-testid-boundary-fixtures.mjs:10-40` and `scripts/check-production-testid-boundary-fixtures.mjs:65-73`.

4. Source organization is acceptable.
   - The guard has a single responsibility and lives in a specifically named script file, not an `index.ts` or catch-all file.
   - The fixture runner is separate from the production repository scan.
   - The regression fixtures are isolated under `scripts/production-testid-boundary-fixtures/**`, matching the pattern used by other implementation-owned tooling fixtures.

5. Forbidden scope was not introduced.
   - Reviewed target files do not add Mesh / Atlas / Parameter / Variant capability, semantic recognition, proposal generation, auto-fix, external transport, renderer or pixel oracle work, Cubism integration, or public demo asset work.
   - A forbidden-scope keyword scan over the Domain E target returned no matches.

6. Orchestration compliance is satisfied for this review.
   - The assignment states the source implementation was delegated to Gnome.
   - This review was performed in a separate clean Review-Sylph context.
   - I did not edit source files; only this review artifact was written.

## Verification Checked / Performed

Checked Orch-Sylph evidence:

- `node scripts/run-focused-e2e.mjs --check`: passed, 24 entries.
- `node scripts/check-production-testid-boundary.mjs`: passed.
- `node scripts/check-production-testid-boundary-fixtures.mjs`: initial sandbox run failed with child `spawnSync ... EPERM`; approved rerun passed, 5 cases.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- scripts`: passed.

Performed in this clean review:

- Read all requested Domain E guard and fixture files directly.
- Ran `node scripts/check-production-testid-boundary.mjs`: passed.
- Ran `node scripts/check-production-testid-boundary-fixtures.mjs`: sandbox run failed with `spawnSync C:\Program Files\nodejs\node.exe EPERM`; approved rerun passed with `Production data-testid boundary fixture regressions passed: 5 cases.`
- Ran `node scripts/run-focused-e2e.mjs --check`: passed with `Focused e2e registry check passed: 24 entries.`
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `git diff --check -- scripts`: passed.
- Ran `rg -n 'data-testid' apps/editor/src -g '*.ts' -g '*.tsx'`: only the existing component-test selector helper matched; no production source selector string matched.
- Ran `rg -n 'dataset' apps/editor/src -g '*.ts' -g '*.tsx'`: production matches were assignment-only for `dataset.testid` / other metadata; non-assignment `dataset.testid` reads were limited to test files.
- Ran direct spot checks:
  - `node scripts/check-production-testid-boundary.mjs --root scripts/production-testid-boundary-fixtures/invalid-selector-string`: failed as expected with the selector diagnostic.
  - `node scripts/check-production-testid-boundary.mjs --root scripts/production-testid-boundary-fixtures/valid-assignments`: passed.
- Confirmed `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are unchanged, so the guard is not wired into package scripts.

## Residual Risks / Deferred Debt

- The guard is a focused static text/regex guard, not a TypeScript AST or runtime behavior analyzer. Dynamic constructions such as concatenated selector strings or indirect method calls could evade it. This is acceptable for Domain E because the guard directly covers the known and likely reintroduction patterns from Domain A/B.
- The guard is not wired into `package.json` scripts in this domain. It is available as `node scripts/check-production-testid-boundary.mjs`, but final integration or a later guardrail wave should decide where it belongs in the standard verification path.
- Default scanning is limited to `apps/editor/src` `.ts` / `.tsx` files. That matches the assignment and Gnome summary, but future production code outside that root would require either an added `--source-root` invocation or a broadened default.
- The new script and fixture files are untracked at the time of this review. Final integration must include them; otherwise the guard would not be present in version control.

## User-Decision Points

None.
