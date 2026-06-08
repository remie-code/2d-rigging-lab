# Wave56 Domain C Review: Headless Scripts / Typecheck Baseline

## Verdict

`pass`

Domain C establishes a GUI-independent standard path for `typecheck`, `test:unit`, and `check`. No blocking issue was found for the Wave56 headless baseline contract.

## Scope Reviewed

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `scripts/check-dependencies.mjs`
- `discussion/implementation/waves/wave56/wave56-domain-c-headless-scripts-typecheck-baseline-report.md`
- Current `git status` / `git diff` for `scripts/**`, `apps/editor/**`, and Wave56 artifacts, using path/status evidence only.

Investigation boundary:

- I did not inspect old `apps/editor/src/**` source content for reuse, UX facts, state facts, or component facts.
- B-owned physical deletions are visible in the shared worktree, but this review does not credit or blame Domain C for those deletions unless Domain C's own report/diff claims them.

## Basis Documents Used

- `discussion/implementation/orchestration/wave56-plan.md`
- `discussion/implementation/waves/wave56/wave56-domain-a-purge-manifest-baseline-contract-report.md`
- `discussion/implementation/reviews/wave56/wave56-domain-a-purge-manifest-baseline-contract-review.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

None.

## Verification Performed

- Inspected effective root scripts in `package.json:8` through `package.json:15`.
  - `typecheck` delegates only to root `tsc --noEmit`.
  - `test` delegates to `test:unit`.
  - `test:unit` runs `vitest run packages` with a single exclusion.
  - `check` runs only `typecheck`, `test:unit`, `check:deps`, and `check:source`.
- Inspected `tsconfig.json:17` through `tsconfig.json:24`.
  - Root typecheck includes packages and scripts, and excludes only `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`.
- Inspected `scripts/check-dependencies.mjs`.
  - Retained forbidden dependency, lockfile, and asset checks.
  - No longer imports the B-deleted Wave42 non-goal classification helper.
- `pnpm.cmd run typecheck`: pass.
- `pnpm.cmd run test:unit`:
  - Sandbox attempt failed with `spawn EPERM` while Vitest/esbuild loaded config.
  - Re-run outside sandbox: pass, 185 test files / 942 tests.
- `pnpm.cmd run check`: pass outside sandbox, including typecheck, unit tests, dependency guard, and source organization guard.
- Mechanical standard-path reference guard:
  - Command scanned `package.json pnpm-workspace.yaml tsconfig.json scripts .github` for old e2e/focused/testid/editor package references.
  - Result: one non-standard helper hit at `scripts/check-wave43-validator-contract-coverage.mjs:171` for `node scripts/check-focused-e2e-registry.mjs`.
  - Classification: not invoked by `package.json:15` standard `check`, not a Domain C blocker.
- Raw old-editor path scan:
  - Result: one non-standard retained helper hit at `scripts/check-psd-parser-import-boundary.mjs:21` for `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
  - Classification: not invoked by the root standard path; Domain A explicitly allowed this script only outside the headless baseline unless later made GUI-independent.
- Fixture exclusion check:
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:21` and `:22` import deleted old editor preview source.
  - The exclusion in `package.json:11` and `tsconfig.json:23` is narrow and justified for the current headless baseline.
- `git diff --check -- package.json pnpm-workspace.yaml tsconfig.json scripts discussion/implementation/waves/wave56 discussion/implementation/reviews/wave56`: pass; Git emitted line-ending warnings only.

## Confirmations Against Rubric

- Standard `pnpm run typecheck`, `pnpm run test:unit`, and `pnpm run check` are GUI-independent: confirmed by script inspection and successful command execution.
- Old e2e, focused e2e, and production `data-testid` guard pressure are removed from the standard path: confirmed. Root `test:e2e`, `test:e2e:editor`, `check:testids`, and `check:testids:fixtures` are absent.
- Package-level tests were not weakened beyond removing GUI pressure: confirmed for Domain C. `test:unit` still runs package tests and excludes only the old GUI-coupled preview/viewer equivalence fixture.
- Root typecheck was not broadly weakened: confirmed. `tsconfig.json` excludes only the same old GUI-coupled fixture.
- `scripts/check-dependencies.mjs` was not weakened in the dependency/asset surface required for the headless baseline: confirmed. It still checks forbidden dependency names, lockfile mentions, and forbidden asset paths. The removed non-goal claim scan is a residual guard-surface reduction, but not a blocker under the Domain A/C contract because it depended on a B-deleted Wave42 helper and was not required by the Wave56 headless baseline.
- Domain C did not edit/delete B-owned purge files based on Domain C report and C-owned diff: confirmed with limitation. Current status shows B-owned old app/script deletions in the shared worktree, while Domain C's own diff is limited to `package.json`, `tsconfig.json`, and `scripts/check-dependencies.mjs`.
- Domain C did not inspect/reuse old `apps/editor/src/**` for UX facts: confirmed only at artifact level. The report states this at `discussion/implementation/waves/wave56/wave56-domain-c-headless-scripts-typecheck-baseline-report.md:22` through `:24`; full command history is not auditable from this review.
- Orchestration separation and wait rules: confirmed from provided Orch-Sylph evidence and basis documents. Gnome implementation was separate and reached final `done`; the first wait timeout was treated as polling timeout, and this review is a separate clean Review-Sylph context. Full command history remains outside this review's audit surface.
- Domain C report required fields: confirmed. The report includes verdict, changed config/script files, exact headless command definitions, verification results, remaining old GUI/e2e references classified, and confirmations about B-owned deletions / old GUI source inspection.

## Residual Risks / Open Verification Items

- `scripts/check-wave43-validator-contract-coverage.mjs:171` still mentions the deleted focused e2e registry. It is not standard-path pressure now, but later cleanup can remove or update this historical helper if F/G decide retained scripts should have no deleted-helper references at all.
- `scripts/check-psd-parser-import-boundary.mjs:21` still approves a deleted old editor path. It is outside standard `check`; later F/G should either remove it, rewrite it against a fresh non-GUI parser boundary, or keep it explicitly classified as non-standard historical tooling.
- The removed non-goal claim scan is no longer part of `check:deps`. If Undine wants that broader policy guard retained independently of Wave42 GUI artifacts, the safer fix is to re-home the generic non-goal policy into a retained non-Wave42 script/module and restore `checkNonGoalClaims` without importing B-deleted Wave42 helper files.
- The excluded `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` remains in the repository but outside standard typecheck/unit. Later package cleanup should delete, rewrite, or re-home it under a non-GUI contract.

## User-Decision Points

None.

## Gnome Fix Loop

Not required.
