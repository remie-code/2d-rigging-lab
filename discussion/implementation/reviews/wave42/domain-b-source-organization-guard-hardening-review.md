# Wave42 Domain B Review: Source Organization Guard Hardening

## Verdict

`pass`

Gnome fix loop required: no.

## Scope Reviewed

Reviewed Wave42 Domain B as an independent Review-Sylph pass over the specified basis documents, target files, status evidence, implementation report, and direct verification commands.

Target files reviewed:

- `scripts/check-source-organization.mjs`
- `scripts/check-source-organization-fixtures.mjs`
- `scripts/source-organization-fixtures/invalid-forbidden-catch-all/packages/demo/src/schemas.ts`
- `scripts/source-organization-fixtures/invalid-index-logic/packages/demo/src/index.ts`
- `scripts/source-organization-fixtures/invalid-large-catch-all/packages/demo/src/common.ts`
- `scripts/source-organization-fixtures/valid-barrel-index/packages/demo/src/feature.ts`
- `scripts/source-organization-fixtures/valid-barrel-index/packages/demo/src/index.ts`
- `discussion/implementation/waves/wave42/domain-b-source-organization-guard-hardening-report.md`

Basis documents used:

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
- `discussion/implementation/waves/wave42/domain-b-source-organization-guard-hardening-report.md`

## Findings

### Blocking

None.

### Needs Fix

None.

### Non-Blocking Notes

- `git diff --check` does not inspect untracked fixture files, so I separately scanned Domain B's untracked files for trailing whitespace with `rg -n "[ \t]+$" ...`; no matches were found.
- The Domain B completion report is present and accurate enough for the domain. It does not yet include this review result, which is expected because this review artifact is the independent gate.

## Lane 1: Design / Development Compliance Review

Pass.

- The guard addresses the three requested blind spots without product refactor:
  - Barrel-only `index.ts` is enforced by `isAllowedBarrelLine` and the `baseName === "index.ts"` check in `scripts/check-source-organization.mjs:105`, `scripts/check-source-organization.mjs:119`, `scripts/check-source-organization.mjs:120`, and `scripts/check-source-organization.mjs:186`.
  - Forbidden catch-all filenames remain blocking through `forbiddenCatchAllNames.has(baseName)` in `scripts/check-source-organization.mjs:180`.
  - Large catch-all-like files are detected by a conservative filename heuristic and line threshold in `scripts/check-source-organization.mjs:6`, `scripts/check-source-organization.mjs:124`, and `scripts/check-source-organization.mjs:194`.
- Fixture-specific CLI hooks are narrow and deterministic: `--root`, `--source-root`, and `--max-large-catch-all-lines` are parsed in `scripts/check-source-organization.mjs:17` onward and used only to point the same guard at local fixture trees.
- Intentional negative fixtures are excluded from the default repository scan via `source-organization-fixtures` in `scripts/check-source-organization.mjs:13`, preserving `node scripts/check-source-organization.mjs` as a default repo guard.
- The large-file rule is intentionally conservative. It flags catch-all-like names such as `common.ts` above the configured threshold, but it does not attempt broad semantic classification of every existing large file. This matches the Wave42 plan's instruction not to broadly refactor existing legitimate large files.
- The write scope is respected for Domain B. The Domain B status set is limited to `scripts/check-source-organization.mjs`, the focused source-organization fixture runner and fixtures, and the Domain B completion report.
- No `apps/editor/src/**`, `packages/**`, package manifest, lockfile, Product Preflight persisted/exported artifact, release/demo gate, parser/image/archive/filesystem/renderer/Cubism, external dependency, repo-side repair generation, LLM, natural-language repair, auto-fix, or external transport change was required by Domain B.
- Parallel Domain C/D files are present in the worktree, including `scripts/check-dependencies.mjs` and focused e2e runner scripts, but they are outside Domain B and were not needed for this review verdict.

## Lane 2: Test Adequacy Review

Pass.

- `scripts/check-source-organization-fixtures.mjs:10` defines four focused fixture cases covering the requested blind spots:
  - valid barrel-only `index.ts`: `scripts/check-source-organization-fixtures.mjs:12`
  - invalid implementation logic in `index.ts`: `scripts/check-source-organization-fixtures.mjs:18`
  - forbidden catch-all filename: `scripts/check-source-organization-fixtures.mjs:24`
  - large catch-all-like file: `scripts/check-source-organization-fixtures.mjs:30`
- The fixture runner invokes the real guard with fixture-local `--root` and `--source-root` arguments in `scripts/check-source-organization-fixtures.mjs:45` and `scripts/check-source-organization-fixtures.mjs:47`, not a duplicated implementation.
- The large catch-all regression uses `--max-large-catch-all-lines 3` in `scripts/check-source-organization-fixtures.mjs:33`, which keeps the fixture small while exercising the same threshold path.
- Fixture contents match their purpose:
  - `scripts/source-organization-fixtures/valid-barrel-index/packages/demo/src/index.ts:1` through `:3` contain only re-export forms.
  - `scripts/source-organization-fixtures/invalid-index-logic/packages/demo/src/index.ts:1` contains implementation logic in `index.ts`.
  - `scripts/source-organization-fixtures/invalid-forbidden-catch-all/packages/demo/src/schemas.ts:1` creates the forbidden `schemas.ts` filename case.
  - `scripts/source-organization-fixtures/invalid-large-catch-all/packages/demo/src/common.ts:1` through `:4` create the catch-all-like `common.ts` threshold case.
- Default guard execution plus fixture regression execution is adequate for this narrow guard hardening domain. Full product e2e or unit suites are not necessary because Domain B does not change product source or runtime behavior.

## Verification Performed

The normal sandbox failed before PowerShell startup (`windows sandbox: spawn setup refresh`), so the read/check commands were rerun with approved escalation. Commands were read-only except for writing this review artifact.

| Command | Result |
|---|---|
| `git status --short -uall` | confirmed Domain B files plus parallel Domain A/C/D artifacts; no product source or manifest changes attributable to Domain B |
| `node scripts/check-source-organization.mjs` | pass; `Source organization guard passed.` |
| `node scripts/check-source-organization-fixtures.mjs` | pass; `Source organization fixture regressions passed: 4 cases.` |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass; 5 categories, 19 focused e2e entries, 9 explicit non-goals |
| `git diff --check -- scripts/check-source-organization.mjs discussion/implementation/waves/wave42/domain-b-source-organization-guard-hardening-report.md` | pass; CRLF warning only |
| `rg -n "[ \t]+$" scripts/check-source-organization.mjs scripts/check-source-organization-fixtures.mjs scripts/source-organization-fixtures discussion/implementation/waves/wave42/domain-b-source-organization-guard-hardening-report.md` | no trailing whitespace matches |
| `git status --short -uall apps/editor/src packages package.json pnpm-lock.yaml pnpm-workspace.yaml` | no output; no forbidden product/dependency path changes detected |

## Remaining Issues

- The large catch-all guard remains filename/size based, not semantic. This is an intentional conservative boundary for Wave42, not a blocking gap.
- Domain E should later decide whether to document the new fixture command and threshold option in the source organization policy or traceability docs. That is outside Domain B's write scope.

## User-Decision Points

None.

## Orchestration Compliance

Pass.

- The Wave42 plan requires Orch-Sylph to separate Gnome implementation from Review-Sylph review.
- This artifact is the independent Review-Sylph review. I did not edit implementation/source/test files or the Domain B completion report.
- The only file written by this reviewer is `discussion/implementation/reviews/wave42/domain-b-source-organization-guard-hardening-review.md`, which is within the explicitly allowed review-report scope.
- Review used explicit basis documents and repository files, not forked implementation conversation history.
- Gnome and Review-Sylph separation was preserved for this review gate.
