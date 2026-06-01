# Wave 26 Domain A Test Adequacy Review

- verdict: `pass`
- wave: Wave 26 `rig-control-keyform-viewer-hardening`
- domain: A `wave26-rig-control-keyform-operation-fixture-hardening`
- lane: Test Adequacy
- reviewer: Review-Sylph
- date: 2026-06-01

## Review Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave26-plan.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Changed files and untracked fixture artifacts under:
  - `packages/authoring-core/src/keyform-mutations.test.ts`
  - `packages/operation-core/src/operations/add-keyform.test.ts`
  - `packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts`
  - `fixtures/contracts/rig-control-keyform-angle-operation/**`

## Personal Verification

- Read the targeted diff with `git diff -- packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/add-keyform.test.ts packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts fixtures/contracts/rig-control-keyform-angle-operation`.
- Read the new untracked fixture test and all fixture request / expected JSON files directly.
- Ran `git status --short -uall -- <Domain A paths>` to confirm the scoped changed/untracked files.
- Ran `git diff --check -- packages/authoring-core/src packages/operation-core/src fixtures/contracts/rig-control-keyform-angle-operation`: exit 0, with only the reported LF-to-CRLF warnings for the two modified tracked test files.
- I did not rerun Vitest or typecheck in this clean review context. I treated Gnome's reported test outputs as implementation verification and independently inspected whether the tests and fixtures assert the required evidence.

## Findings

No blocking test adequacy findings.

The new tests prove the `rigControl:angleDegrees` authoring mutation path at the authoring layer. `packages/authoring-core/src/keyform-mutations.test.ts:50` creates a linear 1D rig-control angle keyform set, and the assertions pin target kind/id/property plus the scalar `statePatch: 30`. Missing rig-control target and unsupported rig-control property paths are covered at `packages/authoring-core/src/keyform-mutations.test.ts:135` and `packages/authoring-core/src/keyform-mutations.test.ts:173`.

The operation handler tests cover dry-run success and deterministic operation diagnostics. `packages/operation-core/src/operations/add-keyform.test.ts:119` dry-runs `addKeyform` for `rigControl:angleDegrees`; the test asserts no original-session mutation, candidate keyform creation, `targetIds`, checked refs, and model diff target evidence at `packages/operation-core/src/operations/add-keyform.test.ts:153`, `:158`, and `:163`. Missing rig-control target and unsupported property diagnostics are asserted at `packages/operation-core/src/operations/add-keyform.test.ts:221` and `:283`.

The fixture test covers the product-evidence path beyond the bare handler. `packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts:114` checks dry-run immutability plus runtime evidence refs; `:129` commits, logs, serializes, materializes runtime artifacts, writes package file entries, and reloads the package document. The expected package summary pins committed keyform target, model diff target, operation log target IDs / checked refs / payload target, generated artifact paths, materialized keyform, and reloaded keyform at `fixtures/contracts/rig-control-keyform-angle-operation/expected/package-materialization-summary.json:8`, `:26`, `:48`, `:98`, `:107`, `:113`, and `:131`.

Negative evidence is deterministic enough for this domain. The fixture test at `packages/operation-core/src/rig-control-keyform-operation-fixture.test.ts:162` compares both negative requests against exact expected summaries. Those summaries pin check IDs, target strings, messages, zero operation-log length, unchanged revisions, and zero keyform count at `fixtures/contracts/rig-control-keyform-angle-operation/expected/negative-diagnostics-summary.json:3` and `:19`.

Existing mesh behavior remains covered in the same operation test file. The pre-existing mesh dry-run/commit and negative assertions remain present around `packages/operation-core/src/operations/add-keyform.test.ts:25`, `:97`, `:204`, `:262`, `:308`, and `:331`, and Gnome reported the focused operation-core and authoring-core suites passing.

Fixture evidence is stable and minimal for this scope. The fixture manifest records a no-space fixture ID, AC/scenario coverage, blocked modules, input artifacts, expected artifacts, and update rule at `fixtures/contracts/rig-control-keyform-angle-operation/fixture-manifest.json:3`, `:5`, `:11`, `:15`, `:20`, `:27`, and `:44`. The baseline package is JSON-only, uses a generated text fixture asset, and records rights/provenance metadata rather than binary image or third-party model inputs at `fixtures/contracts/rig-control-keyform-angle-operation/baseline-package.json:203`, `:217`, and `:236`.

## Remaining Issues

- Whole-repo `pnpm.cmd typecheck` still needs a green rerun before the wider Wave 26 gate can close. The reported failure is in `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`, outside Domain A, so it is not a Domain A test adequacy failure.
- If Domain F promotes `rig-control-keyform-angle-operation` into central P0 / MVP-blocking fixture traceability, update the central fixture manifest / traceability docs then. For Domain A, the fixture-local manifest plus executable fixture test are adequate.

## User-Decision Points

None.
