# Wave42 Domain D Review: Dependency / Forbidden-Scope Guard Refinement

## Verdict

`pass`

Gnome fix loop required: no.

## Scope Reviewed

Reviewed Wave42 Domain D as an independent Review-Sylph pass over the explicit basis documents, Domain D target files, supporting Domain A policy files, status/diff evidence, and independent verification commands.

Target files reviewed:

- `scripts/check-dependencies.mjs`
- `scripts/check-dependencies-guard-self-test.mjs`
- `discussion/implementation/waves/wave42/domain-d-dependency-forbidden-scope-guard-refinement-report.md`
- `scripts/wave42-non-goal-classification-policy.mjs`
- `scripts/wave42-guard-categories.mjs`

## Findings By Severity

### Blocking

None.

### Needs Fix

None.

### Non-Blocking Notes

- The committed self-test covers the required main positive/false-positive lanes for forbidden dependency name, lockfile mention, asset path, positive non-goal claim, negative assertion, non-goal documentation, and fixture false flags. It does not permanently encode dedicated `safetyUiText` or `historicalReviewEvidence` fixture cases. I ran additional temp-directory probes for those two allowed contexts plus a bare positive claim; they passed.
- The non-goal text classifier is intentionally conservative and line-oriented. `negativeAssertionContextPattern` over a 24-line window can suppress positive-looking strings inside nearby `forbidden*Claims` / `unsupported*Claims` test contexts, which is appropriate for current E2E negative fixtures but remains a future false-negative risk if product-facing prose is placed in that same context.
- `historicalEvidencePathPattern` allows review/report evidence under `discussion/implementation/reviews/**`. That is acceptable for review artifacts and keeps historical evidence quiet, but it is not a semantic proof that every future review sentence is safe product copy.

## Lane Review

### Design / Development Compliance Review

Pass.

- Domain D write scope is respected. The Domain D tracked/untracked implementation files are `scripts/check-dependencies.mjs`, `scripts/check-dependencies-guard-self-test.mjs`, and the Domain D completion report. `git status --short -uall` also shows parallel Wave42 A/B/C files, but no package manifest, lockfile, `apps/editor/src/**`, or `packages/**` change attributable to Domain D.
- No package manifest, lockfile, product source, source organization guard, or e2e runner edit is required by the Domain D implementation. A scoped status over `package.json`, `pnpm-lock.yaml`, `apps/editor/src`, and `packages` showed no changes.
- The dependency and asset scans remain deterministic and local: `check-dependencies.mjs` recursively scans the current working tree, ignores only fixed local build/vendor directories, checks `package.json`, checks `pnpm-lock.yaml`, and checks forbidden asset path patterns.
- The Domain A policy import is appropriate. Domain D imports `wave42NonGoalClassificationPolicy` only to derive explicit Wave42 non-goal terms, keeping the non-goal list centralized while leaving dependency/asset scan behavior in the dependency guard.
- Positive forbidden non-goal claim detection is bounded to explicit policy terms plus positive words such as implemented/supported/enabled/available/passed/ready/integrated. The guard excludes its own dependency-check scripts and the policy script from claim scanning so regression fixtures can contain intentionally forbidden strings without failing the repository scan.
- Allowed contexts are reasonable for the Wave42 scope: negative assertions, negative assertion fixture context, non-goal documentation, fixture false booleans, safety/unsupported wording through negative patterns, and historical review/report evidence.
- Existing E2E forbidden-claim strings are in arrays such as `forbiddenSupportClaims` and `forbiddenPositiveClaims`; the classifier's negative context allowance explains why they remain non-blocking without turning those fixtures into product capability claims.
- No Product Preflight persisted/exported artifact, release/demo gate, repo-side repair generation, LLM integration, auto-fix, external transport, parser/image/archive/filesystem/renderer/Cubism behavior, repo-side repair, or product capability implementation was introduced.

### Test Adequacy Review

Pass.

- `scripts/check-dependencies-guard-self-test.mjs` is focused and deterministic. It creates temporary fixture repositories, runs the real dependency guard via `spawnSync`, checks expected status/output, and removes the temp root.
- The seven committed cases cover the core requested behavior: forbidden dependency name, forbidden lockfile mention, forbidden asset path, positive forbidden non-goal claim, negative assertion allowed, non-goal documentation allowed, and fixture false flag allowed.
- Required direct guards passed: the focused self-test, the full dependency guard, the Wave42 boundary guard, and source organization guard.
- I added reviewer-only temp probes for safety text and historical review evidence because they are not separately represented in the committed self-test. Those probes passed and did not write to the repository.
- Residual risk is acceptable for this wave: the classifier is a deterministic guardrail, not a broad semantic document reviewer. Future expansion should add committed cases before broadening the context windows or allowed path classes.

## Verification Performed

Implementation evidence considered:

- `node scripts/check-dependencies-guard-self-test.mjs`: pass; `Dependency guard self-test passed: 7 cases.`
- `node scripts/check-dependencies.mjs`: pass; `Dependency guard passed.`
- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass; `Wave42 quality gate boundary guard passed: 5 categories, 19 focused e2e entries, 9 explicit non-goals.`
- `node scripts/check-source-organization.mjs`: pass; `Source organization guard passed.`
- `git diff --check -- scripts discussion\implementation\waves\wave42 discussion\implementation\reviews\wave42`: pass with Git LF/CRLF warnings only.
- Corrected reviewer temp classifier probe: pass; safety text allowed, historical review evidence allowed, bare positive Cubism compatibility claim blocked.
- `git status --short -uall`: Domain D files plus parallel Wave42 A/B/C files; no package manifest, lockfile, `apps/editor/src/**`, or `packages/**` changes.

Additional Review-Sylph checks performed:

- Read the orchestration/context-hygiene skills and Wave42 plan.
- Read dependency, source organization, schema/ID, traceability, and fixture policy basis documents as needed.
- Read Domain A report/review and supporting Wave42 policy files.
- Read Domain D target scripts and report directly.
- Spot-checked existing forbidden claim strings in E2E files to confirm they are negative assertion fixtures, not product capability claims.

## Remaining Issues

- No blocking remaining issues for Domain D.
- The guard should be treated as conservative text containment, not a substitute for future clean-context semantic review of broad docs or product UI copy.
- If Domain E/F later decide that `safetyUiText` and `historicalReviewEvidence` need permanent regression coverage, the self-test should add those cases in a future scoped fix.

## User-Decision Points

None.

## Orchestration Compliance

Pass.

- The Wave42 plan requires Gnome implementation and Review-Sylph review to be separated.
- The Domain D completion report states that Gnome implementation completed the source changes and that independent Review-Sylph review was still expected.
- This artifact is the independent Review-Sylph review. I did not edit Domain D source files, tests, the implementation report, package manifests, product source, source organization guard, or e2e runner files.
- I found no evidence that Orch-Sylph implemented Domain D source changes directly. The available evidence is consistent with Gnome owning implementation and Review-Sylph owning this review.
