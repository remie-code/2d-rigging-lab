# Wave 27 Domain C Second-Pass Review: Validator Composition Diagnostics

## Verdict

pass

## Review Scope

- Reviewed target: `wave27-validator-composition-diagnostics`, second pass after the stale runtime mask evidence fix.
- Reviewed current working tree status, tracked Domain C diffs, target validator source/test files, check catalog, validator contract, Wave 27 plan, Gnome's Domain C report, and the prior Review-Sylph report.
- Did not edit source files. This review report is the only artifact written by second-pass Review-Sylph.
- Existing unrelated dirty work is present outside Domain C, including authoring, operation, runtime, and implementation map files. Those changes were treated as out of scope.

## Prior Finding Status

Resolved.

The prior finding required stale/current runtime snapshot identity mismatch to be unified as `mask.runtimeEvidenceMissing` and covered by a focused test asserting `runtimeSnapshotIdentity=mismatch`.

Evidence:

- `packages/validator-core/src/validators/mask-composition.ts:148`-`160` maps runtime snapshot identity mismatch to `createRuntimeEvidenceMissingCheck` with `runtimeSnapshotIdentity=mismatch`.
- `packages/validator-core/src/validators/mask-composition.ts:353`-`360` emits `mask.runtimeEvidenceMissing` for missing or stale runtime evidence.
- `packages/validator-core/src/check-catalog.ts:155`-`168` documents stale snapshot identity mismatch under `mask.runtimeEvidenceMissing` and limits `mask.runtimeEvidenceMismatch` to disabled, unknown, unresolved, or source/target-mismatched runtime mask evidence.
- `discussion/design/module-contracts/validator-contract.md:130`-`131` and `discussion/design/module-contracts/validator-contract.md:169`-`170` match the same policy.
- `packages/validator-core/src/mask-composition-diagnostics.test.ts:191`-`213` adds the focused stale runtime snapshot identity test and asserts `mask.runtimeEvidenceMissing`, `runtimeSnapshotIdentity=mismatch`, and package/snapshot revision evidence.

## Findings

No blocking findings.

Non-blocking evidence note: `discussion/implementation/waves/wave27/wave27-validator-composition-diagnostics-report.md:71`-`72` still records the focused test as "1 file / 10 tests", but the current second-pass run passed "1 file / 11 tests". The source/test/contract behavior is correct; this is a stale implementation-report count only.

## Review Lanes

| Lane | Status | Notes |
|---|---|---|
| Validator Evidence | pass | Stale runtime snapshot identity mismatch is now classified as `mask.runtimeEvidenceMissing`; the focused test asserts `runtimeSnapshotIdentity=mismatch`. |
| Composition Semantics | pass | Checks remain semantic/evidence based: missing drawables, self-mask, duplicates, disabled evidence, runtime evidence gap, runtime relation mismatch, and opacity evidence gap. No pixel oracle or renderer behavior was introduced. |
| Contract / Check Catalog Consistency | pass | Check catalog, contract table/prose, implementation, and focused tests agree on stale identity mismatch as missing runtime evidence. |
| Development Compliance | pass | New implementation remains in a focused validator file; `packages/validator-core/src/index.ts:16` is barrel-only; source organization guard passed. |
| Test Adequacy | pass | Focused suite now includes the stale runtime snapshot identity regression test and passed independently with 11 tests. |
| Non-goals Containment | pass | No operation handler, runtime evaluator implementation, editor UI, fixtures/contracts, package manifest, lockfile, dependency, pixel renderer, Cubism, parser, image decode, file picker, or archive work was added by Domain C target files. |
| Orchestration Compliance | pass | Wave plan requires Orch-Sylph to delegate source implementation to Gnome and review to Review-Sylph (`discussion/implementation/orchestration/wave27-plan.md:42`-`45`, `:392`-`:393`). The fix evidence identifies Gnome `019e81a9-806d-7bb1-8ad5-a893aca02f35`; this second-pass review was separate and source-read-only. I found no evidence in the inspected Domain C artifacts that Orch-Sylph implemented source directly. |

## Verification Run

- `pnpm.cmd exec vitest run packages/validator-core/src/mask-composition-diagnostics.test.ts`
  - Pass: 1 file / 11 tests.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave27`
  - Pass; Git printed LF-to-CRLF working-copy warnings only.
- `pnpm.cmd run check:source`
  - Pass: source organization guard passed.

Gnome-reported broader verification was not re-run in this second pass: full validator-core suite, `pnpm.cmd typecheck`, and `pnpm.cmd test:unit` were reported passing by Gnome. The second-pass verification independently re-ran the focused regression suite, whitespace check, and source organization guard.
