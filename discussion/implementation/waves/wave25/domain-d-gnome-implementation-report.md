# Wave25 Domain D Gnome Implementation Report

## Status

pass

## Target

- Domain: Wave25 / Domain D
- Task: `wave25-rig-control-fixtures-contract-evidence`
- Purpose: Pin contract evidence for `parent-child-rigControl-diagonal` and `invalid-rigControl-cycle` with deterministic fixtures and focused tests.

## Changed Files

- `fixtures/contracts/parent-child-rigControl-diagonal/fixture-manifest.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/baseline-package.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/request/*.request.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/runtime/runtime-graph.json`
- `fixtures/contracts/parent-child-rigControl-diagonal/expected/*.json`
- `fixtures/contracts/invalid-rigControl-cycle/fixture-manifest.json`
- `fixtures/contracts/invalid-rigControl-cycle/package.json`
- `fixtures/contracts/invalid-rigControl-cycle/expected/*.json`
- `packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`
- `discussion/implementation/waves/wave25/domain-d-gnome-implementation-report.md`

## Evidence Fixed

### `parent-child-rigControl-diagonal`

- Added deterministic operation requests for creating a parent rotation rig control, creating a child rotation rig control, binding the child rig control under the parent, and binding the child to a drawable.
- Added expected operation-result evidence that records successful dry-run immutability, commit outputs, generated rig control IDs, generated binding IDs, and attached runtime/validator evidence references.
- Added runtime hierarchy evidence for parent-before-child evaluation:
  - parent local/world angle: `30`
  - child local angle: `15`
  - child world angle: `45`
  - evaluation order: parent rig control before child rig control
- Added runtime diff evidence for the drawable vertex hash and transformed geometry bounds.
- Added validator report summary proving the package and runtime evidence validate without diagnostics.
- Added viewer-facing evidence summary that stays contract-level and does not make Cubism SDK/Core compatibility claims.

### `invalid-rigControl-cycle`

- Added deterministic invalid package fixture with a two-node rig control parent/child cycle.
- Added expected validator report and diagnostics proving the blocking `rigControl.cycle` diagnostic.
- Added runtime-blocking summary proving no successful topological evaluation is expected for the invalid cycle fixture.
- Kept the invalid fixture centered on the cycle diagnostic by suppressing secondary runtime-evidence-missing checks when the cycle itself blocks hierarchy evaluation.

## Fixture Tests

- Operation fixture test replays the parent-child operation request sequence and checks deterministic operation evidence.
- Runtime fixture test builds hierarchy evidence from the parent-child runtime graph and checks deterministic hierarchy and runtime diff summaries.
- Validator fixture test checks:
  - valid parent-child package plus runtime evidence returns no diagnostics;
  - invalid cycle package returns the expected blocking diagnostic and runtime-blocking evidence.

## Verification

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts packages/operation-core/src/rig-control-contract-evidence-fixture.test.ts packages/validator-core/src/rig-control-semantic.test.ts packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
  - Pass: 5 files, 16 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Pass: 1 file, 1 test.
- `pnpm.cmd typecheck`
  - Pass.
- `pnpm.cmd run check:source`
  - Pass.
- `pnpm.cmd run check:deps`
  - Pass.
- `git diff --check -- fixtures/contracts packages/operation-core packages/runtime-core packages/validator-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25`
  - Pass. Git reported existing LF/CRLF working-copy warnings, but no whitespace errors.

## Early Escape Triggers

None.

No broad runtime-core or validator-core implementation was required for this Domain D fixture work. The only validator source adjustment is fixture-facing: when a rig-control cycle is present, runtime hierarchy evidence cannot be meaningfully required, so the semantic validator reports the blocking cycle diagnostic without adding secondary missing-runtime-evidence diagnostics.

## Residual Risks

- The operation fixture asserts the operation-result evidence references and drawable runtime diff summary. The full parent/child world-angle hierarchy evidence is pinned in the runtime fixture, not duplicated inside the operation fixture.
- The current worktree contains pre-existing and parallel Domain A/B/C edits. This report only covers the Domain D fixture and focused-test changes listed above.
