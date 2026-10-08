# Wave99 Domain B Test Adequacy Re-Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-evaluation-runtime-export-compatibility`
Review pass: Fix Loop 1 / TA-B-001
Verdict: `pass`

## Scope

This is a focused re-review of Wave99 Domain B Test Adequacy after Fix Loop 1.
Review scope was read-only except for this report file.

Basis reviewed:

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- Domain A report/review baseline documents under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`
- Domain B report/spec/design-development reviews and the prior Domain B Test Adequacy review

Primary source/tests reviewed directly:

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `packages/authoring-core/src/variant-evaluation.ts`
- `packages/authoring-core/src/variant-evaluation.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`

## Findings

No blocking findings.

TA-B-001 is closed.

## TA-B-001 Closure Evidence

Fix Loop 1 added focused negative Runtime Export Variant metadata schema tests
in `packages/package-format/src/runtime-export.test.ts:128`.

| Required negative case | Result | Evidence |
|---|---|---|
| Missing `defaultActiveSelections` | Closed | Test case at `packages/package-format/src/runtime-export.test.ts:183`; required schema field at `packages/package-format/src/runtime-export.ts:525` |
| Selection references missing group | Closed | Test case at `packages/package-format/src/runtime-export.test.ts:188`; schema issue branch at `packages/package-format/src/runtime-export.ts:586` |
| Group `defaultActive` and exported default selection mismatch | Closed | Test case at `packages/package-format/src/runtime-export.test.ts:193`; consistency branch at `packages/package-format/src/runtime-export.ts:576` |
| Wrong explicit selection kind for group mode | Closed | Test case at `packages/package-format/src/runtime-export.test.ts:198`; mode-check branch at `packages/package-format/src/runtime-export.ts:927` |
| Selection references missing Variant | Closed | Test case at `packages/package-format/src/runtime-export.test.ts:203`; Variant-reference branch at `packages/package-format/src/runtime-export.ts:943` |

The new test asserts stable issue paths, not only generic parse failure, at
`packages/package-format/src/runtime-export.test.ts:216`. That means the tests
would fail if the missing-group, mismatch, wrong-kind, or missing-Variant
schema consistency branches were removed or relaxed while another branch still
made parsing fail.

The existing positive/optional coverage remains at
`packages/package-format/src/runtime-export.test.ts:96`, verifying Runtime
Export models without variants still parse and valid Variant metadata is
accepted.

## Retained Domain B Coverage Checklist

| Required Domain B test area | Status | Evidence |
|---|---|---|
| Predicate helper returns true for missing/empty variants | pass | `packages/authoring-core/src/variant-evaluation.test.ts:17` |
| Predicate helper returns true for variant-neutral drawables | pass | `packages/authoring-core/src/variant-evaluation.test.ts:28` |
| Predicate helper handles `singleSelect` groups | pass | `packages/authoring-core/src/variant-evaluation.test.ts:35` |
| Predicate helper handles `multiToggle` groups | pass | `packages/authoring-core/src/variant-evaluation.test.ts:54` |
| Predicate helper blocks assigned drawable when active selection does not include it | pass | `packages/authoring-core/src/variant-evaluation.test.ts:74` |
| Default active resolver is covered | pass | `packages/authoring-core/src/variant-evaluation.test.ts:93` |
| Runtime Export with no variants remains compatible | pass | `packages/package-format/src/runtime-export.test.ts:96`; `packages/authoring-core/src/runtime-export-assembly.test.ts:95` |
| Runtime Export with variants includes metadata/default active selection | pass | `packages/authoring-core/src/runtime-export-assembly.test.ts:103` |
| Default active selection affects initial exported visibility | pass | `packages/authoring-core/src/runtime-export-assembly.test.ts:103`; materialization at `packages/authoring-core/src/runtime-export-materialization.ts:148` |
| Atlas target selection includes bound inactive/default-hidden Variant drawables | pass | `packages/authoring-core/src/runtime-export-assembly.test.ts:135` |
| Atlas source signature does not stale solely from membership/default active changes | pass | `packages/authoring-core/src/runtime-export-assembly.test.ts:152`; signature inputs at `packages/authoring-core/src/texture-atlas-source-signature.ts:14` |
| Runtime Export Variant schema rejects invalid/inconsistent metadata | pass | `packages/package-format/src/runtime-export.test.ts:128` |

## Scope / Diff Check

- Fix Loop 1 changed the Runtime Export schema test and Domain B report per the Gnome summary.
- I found no new forbidden-scope diff in Editor UI, Runtime Player UI/hotkey/protocol, runtime-core, render packages, dependency manifests, lockfile, or Texture Atlas target/signature/packing/mutation files.
- Current worktree still contains the broader Domain A/B implementation diffs already reviewed by the prior lanes; this re-review did not treat those as Fix Loop 1 source changes.

## Commands Run

Sandboxed first attempt:

```text
pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts
```

Result: failed before test execution with `spawn EPERM` while Vitest/Vite loaded
esbuild from `vitest.config.ts`. This was classified as a sandbox process-spawn
restriction, not a test failure.

Escalated rerun:

```text
pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts
```

Result: pass, 1 file / 8 tests.

Read-only checks:

```text
git diff --check -- packages/package-format/src/runtime-export.test.ts packages/package-format/src/runtime-export.ts discussion/implementation/waves/wave99/wave99-domain-b-variant-evaluation-runtime-export-compatibility-report.md
```

Result: exit 0; CRLF conversion warnings only.

```text
git diff --name-only -- apps/editor/src apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src package.json pnpm-lock.yaml packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts packages/authoring-core/src/texture-atlas-packing.ts packages/authoring-core/src/texture-atlas-mutations.ts
```

Result: no files.

Not run:

- Full repository test suite.
- Full Domain B focused suite from the prior review, because this re-review was scoped to TA-B-001 and Gnome's Fix Loop 1 verification.
- `pnpm install`, per dependency/no-install policy.

## Residual Risks

- Runtime Export metadata still duplicates default active selection inside each
  group and in `defaultActiveSelections`; schema consistency tests now guard
  the contract, but future runtime switching should choose one canonical read
  path.
- Existing Runtime Player loader compatibility remains variant-free/default
  active only. Player-side Variant switching UI/protocol is intentionally out of
  Wave99 Domain B.
- Canvas preview active selection, session-local preview state, and Manager UI
  coverage remain Domain C responsibilities.

## Decision Needed

No user design decision is needed. Verdict: `pass`.
