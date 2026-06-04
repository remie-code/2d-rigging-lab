# Wave42 Domain C Review: Focused E2E Registry / Replay Runner

## Verdict

`pass`

Gnome fix loop required: no.

## Scope Reviewed

Clean grounded Review-Sylph review of Wave42 Domain C `wave42-focused-e2e-registry-replay-runner`.

Target files reviewed:

- `scripts/focused-e2e-registry.mjs`
- `scripts/check-focused-e2e-registry.mjs`
- `scripts/run-focused-e2e.mjs`
- `discussion/implementation/waves/wave42/domain-c-focused-e2e-registry-replay-runner-report.md`

Domain A boundary files used as source facts:

- `scripts/check-wave42-quality-gate-boundary.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/wave42-guard-categories.mjs`
- `scripts/wave42-non-goal-classification-policy.mjs`
- `scripts/wave42-quality-gate-report-shape.mjs`

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave42-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave42/domain-a-verification-registry-quality-gate-boundary-foundation-report.md`
- `discussion/implementation/reviews/wave42/domain-a-verification-registry-quality-gate-boundary-foundation-review.md`

## Findings By Required Lane

### 1. Design / Development Compliance Review

Blocking findings: none.

Needs-fix findings: none.

Pass rationale:

- Domain C stays within the assigned registry/replay surface. The registry imports the Domain A boundary (`scripts/focused-e2e-registry.mjs:5`) and builds Domain C entries from the 19 Domain A entries (`scripts/focused-e2e-registry.mjs:147`, `scripts/focused-e2e-registry.mjs:165`).
- The registry does not claim list/check coverage. Each registry entry carries `executionCoverageClaim: "noneUntilExactCommandRuns"` (`scripts/focused-e2e-registry.mjs:161`), and the runner list output prints that value for every entry (`scripts/run-focused-e2e.mjs:99`).
- The checker verifies required metadata shape, Domain A boundary drift, path/command/category drift, command shape, file existence, invocation shape, aggregate inclusion truthfulness, and package aggregate script invariance (`scripts/focused-e2e-registry.mjs:221`, `scripts/focused-e2e-registry.mjs:235`, `scripts/focused-e2e-registry.mjs:247`, `scripts/focused-e2e-registry.mjs:251`, `scripts/focused-e2e-registry.mjs:283`, `scripts/focused-e2e-registry.mjs:303`, `scripts/focused-e2e-registry.mjs:342`).
- Aggregate inclusion is grounded in `apps/editor/e2e/smoke-checks.mjs`, which imports 14 focused smoke modules directly (`apps/editor/e2e/smoke-checks.mjs:11` through `apps/editor/e2e/smoke-checks.mjs:38`). The 5 standalone direct entries are not imported there.
- Root/editor package scripts still point to the existing editor aggregate path and were not expanded to include the focused runner (`package.json:12`, `package.json:13`, `apps/editor/package.json:8`).
- The runner selects exactly one registry entry by `--id` or `--path` and rejects both selectors together (`scripts/run-focused-e2e.mjs:111`). It rejects selections that do not match the registry before spawning.
- Non-dry execution uses `spawn(process.execPath, [path.join(repoRoot, repoPath)], { cwd: repoRoot, stdio: "inherit", shell: false })` (`scripts/run-focused-e2e.mjs:160`), so command execution is registry-scoped and avoids shell interpretation.
- No forbidden product source, e2e assertion weakening, package manifest/lockfile change, dependency addition, Product Preflight persisted/exported artifact, release/demo gate, parser/image/archive/filesystem/renderer/Cubism implementation, repo-side repair generation, LLM, auto-fix, or external transport work was found in Domain C.
- Source organization is acceptable for this domain. The added scripts have narrow responsibilities: registry data/checker helper, CLI checker, and selected replay runner. No `index.ts` implementation or broad catch-all application source file was introduced.

### 2. Test Adequacy Review

Blocking findings: none.

Needs-fix findings: none.

Pass rationale:

- `node scripts/check-focused-e2e-registry.mjs` directly exercises the registry drift, metadata, aggregate inclusion, command, file existence, and package aggregate-script invariance checks.
- `node scripts/check-focused-e2e-registry.mjs --json` returned `schemaVersion=focused-e2e-registry-check-report-v0`, `verdict=pass`, 19 entries, 14 aggregate-discoverable entries, 5 standalone direct entries, `productCapabilityAdded=false`, and no findings.
- `node scripts/run-focused-e2e.mjs --list` returned all 19 entries and each listed `coverage: noneUntilExactCommandRuns`.
- `node scripts/run-focused-e2e.mjs --id productPreflightDiff --dry-run` and `--path apps/editor/e2e/product-preflight-diff-smoke.mjs --dry-run` both selected the same single direct command and reported `coverage: dryRunOnlyNoCoverage`.
- Negative selection checks rejected a path containing shell-looking text and rejected using `--id` and `--path` together. These support the runner scoping and selection behavior.
- Actual browser e2e replay and aggregate `pnpm test:e2e` were intentionally not run. That is acceptable for Domain C because the Wave42 Domain C minimum verification is registry list/check plus a representative direct replay dry path, and the implementation does not change application behavior.

## Verification Performed

| Command / Check | Result |
|---|---|
| `node scripts/check-focused-e2e-registry.mjs` | pass; 19 entries, 14 aggregate-discoverable, 5 standalone direct |
| `node scripts/check-focused-e2e-registry.mjs --json` | pass; `verdict=pass`, `productCapabilityAdded=false`, no findings |
| `node scripts/run-focused-e2e.mjs --check` | pass; 19 entries |
| `node scripts/run-focused-e2e.mjs --list` | pass; all entries printed `coverage: noneUntilExactCommandRuns` |
| `node scripts/run-focused-e2e.mjs --id productPreflightDiff --dry-run` | pass; exact command `node apps/editor/e2e/product-preflight-diff-smoke.mjs`, `dryRunOnlyNoCoverage` |
| `node scripts/run-focused-e2e.mjs --path apps/editor/e2e/product-preflight-diff-smoke.mjs --dry-run` | pass; same exact direct command and `dryRunOnlyNoCoverage` |
| `node scripts/run-focused-e2e.mjs --id productPreflightDiff --dry-run --json` | pass; JSON `executionCoverageClaim=dryRunOnlyNoCoverage` |
| `node scripts/run-focused-e2e.mjs --path "apps/editor/e2e/product-preflight-diff-smoke.mjs;echo X" --dry-run` | expected fail; selection did not match registry |
| `node scripts/run-focused-e2e.mjs --id productPreflightDiff --path apps/editor/e2e/product-preflight-diff-smoke.mjs --dry-run` | expected fail; rejects both selectors together |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass; 5 categories, 19 focused e2e entries, 9 explicit non-goals |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git status --short -uall` | Domain C additions present; parallel B/D guard/report changes also present |
| `git diff --check -- scripts apps/editor/e2e package.json apps/editor/package.json discussion/implementation/waves/wave42 discussion/implementation/reviews/wave42` | pass; only CRLF warnings for parallel B/D modified guard files |
| `rg -n "[ \t]+$" scripts/focused-e2e-registry.mjs scripts/check-focused-e2e-registry.mjs scripts/run-focused-e2e.mjs discussion/implementation/waves/wave42/domain-c-focused-e2e-registry-replay-runner-report.md` | pass; no trailing whitespace matches |
| `rg -n --no-heading "focused-e2e|run-focused|check-focused" package.json apps/editor/package.json` | pass; no package script additions |

Normal sandbox command startup failed during this review, so local read/check commands were run with approved escalation. No network, dependency install, manifest edit, source fix, or browser e2e execution was performed by this reviewer.

## Orchestration Compliance Assessment

Pass.

- This assignment identifies the caller as `Orch-Sylph` and the role as independent `Review-Sylph`.
- The Wave42 plan requires Orch-Sylph to separate Gnome implementation from Review-Sylph review. The Domain C completion report says implementation is complete and ready for independent Review-Sylph review, and does not claim review pass (`discussion/implementation/waves/wave42/domain-c-focused-e2e-registry-replay-runner-report.md:5`, `discussion/implementation/waves/wave42/domain-c-focused-e2e-registry-replay-runner-report.md:7`).
- The review used explicit basis documents, target files, Domain A source facts, and independent verification rather than relying on implementation notes alone.
- This artifact is the independent Review-Sylph review. I did not edit implementation/source files.

## Remaining Issues

- Actual browser e2e replay was not run in Domain C or in this review. Residual risk is limited to runtime/browser availability and existing focused smoke behavior, not the registry/check/list/dry-run logic.
- Aggregate `pnpm test:e2e` remains intentionally unexpanded. Final Wave42 integration can decide whether to run the aggregate and/or a representative non-dry focused replay as part of broader final verification.
- Parallel Domain B/D changes are present in the worktree and passed the shared guards here, but they are outside this Domain C review except where they affect shared verification commands.

## User-Decision Points

None for Domain C.

## Reviewer Source Edit Boundary

Source edits were avoided by the reviewer. The only file written by this reviewer is this review artifact:

- `discussion/implementation/reviews/wave42/domain-c-focused-e2e-registry-replay-runner-review.md`
