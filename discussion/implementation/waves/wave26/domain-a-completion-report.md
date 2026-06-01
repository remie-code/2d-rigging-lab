# Wave 26 Domain A Completion Report

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: A `wave26-rig-control-keyform-operation-fixture-hardening`  
> Date: 2026-06-01  
> Verdict: `pass`

## Summary

Domain A passed.

`addKeyform` -> `rigControl:angleDegrees` operation evidence is now covered as product evidence through focused authoring / operation tests and a dedicated contract fixture. The evidence covers dry-run, commit, operation result, operation log, model diff target tracking, package materialization, package reload, and deterministic missing-target / unsupported-property diagnostics.

Orch-Sylph did not perform source implementation. Source implementation was delegated to Gnome in a separate context, and review was delegated to two separate Review-Sylph contexts.

## Files Changed For Domain A

- `packages/authoring-core/src/keyform-mutations.test.ts`
- `packages/operation-core/src/operations/add-keyform.test.ts`
- `packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts`
- `fixtures/contracts/rig-control-keyform-angle-operation/**`
- `discussion/implementation/reviews/wave26/wave26-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave26/wave26-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave26/domain-a-completion-report.md`

## Gnome Delegation Summary

Gnome implemented the bounded Domain A task within the allowed source and fixture scope:

- Added authoring mutation coverage for `rigControl` keyform target creation and deterministic rejection paths.
- Added operation handler coverage for `rigControl:angleDegrees` dry-run evidence, original-session immutability, checked refs, target IDs, and model diff target evidence.
- Added operation diagnostics coverage for missing rig-control target and unsupported rig-control property.
- Added the dedicated `rig-control-keyform-angle-operation` contract fixture with request and expected evidence JSON.
- Added fixture tests that prove dry-run, commit, operation log, package materialization, package reload, and negative diagnostics.

Gnome reported no dependency, manifest, lockfile, UI, runtime evaluator, validator broad rewrite, `index.ts` implementation, Cubism compatibility, file picker, parser, image decode, archive, or binary-upload changes for Domain A.

## Review Results

Design / Development Compliance Review:

- Report: `discussion/implementation/reviews/wave26/wave26-domain-a-design-development-review.md`
- Verdict: `pass`
- Findings: no blocking, high, medium, or low findings.
- Key notes: allowed scope respected; source organization policy respected; no `index.ts` implementation logic; no dependency or forbidden-scope drift; fixture and operation evidence are coherent.

Test Adequacy Review:

- Report: `discussion/implementation/reviews/wave26/wave26-domain-a-test-adequacy-review.md`
- Verdict: `pass`
- Findings: no blocking test adequacy findings.
- Key notes: tests cover dry-run, commit/log/materialization, model diff, negative diagnostics, existing mesh compatibility, and fixture-local manifest evidence.

Fix loops used: 0.

## Verification

Gnome reported:

- `pnpm.cmd exec vitest run packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts` passed, 4 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/add-keyform.test.ts packages/operation-core/src/operation-lifecycle.test.ts` passed, 40 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src` passed, 28 files / 142 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src` passed, 13 files / 49 tests.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src fixtures/contracts/rig-control-keyform-angle-operation` passed with LF/CRLF warnings only.

Design / Development Review-Sylph additionally ran:

- Domain A `git diff` and direct fixture reads.
- Manifest / lockfile status check with no Domain A dependency drift.
- `git diff --check` with LF/CRLF warnings only.
- `pnpm.cmd exec vitest run packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts` passed, 4 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/add-keyform.test.ts` passed, 23 tests.

Test Adequacy Review-Sylph independently inspected the targeted diff and all new fixture request / expected JSON files. It did not rerun Vitest or typecheck.

Whole-repo `pnpm.cmd typecheck` was not green during this Domain A run because of out-of-scope parallel validator-core changes in `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`. This is a Wave-level integration item, not a Domain A source finding.

## Pass Evidence

- `rigControl:angleDegrees` keyform dry-run succeeds and leaves the original session unchanged.
- Commit succeeds and records operation log / model diff / runtime evidence refs / generated artifact paths.
- Package materialization includes the authored keyform target and reload preserves it.
- Missing rig-control target emits deterministic `operation.addKeyform.missingTarget` diagnostics.
- Unsupported rig-control property emits deterministic `operation.addKeyform.unsupportedTargetProperty` diagnostics.
- Existing mesh/drawable keyform operation coverage remains in place and focused suites passed.

## Remaining Issues

- Wave-level typecheck must be rerun after the separate validator-core Domain C style changes are fixed.
- If Wave26 final integration wants `rig-control-keyform-angle-operation` promoted into central P0 / MVP-blocking fixture traceability, the integration/reporting lane should update the central fixture manifest and traceability docs.

## User-Decision Points

None for Domain A.
