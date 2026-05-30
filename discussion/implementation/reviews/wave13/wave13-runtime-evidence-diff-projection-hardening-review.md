# Wave 13 Domain C Review: Runtime Evidence Diff Projection Hardening

> Target: `wave13-runtime-evidence-diff-projection-hardening`
> Reviewer: Review-Sylph
> Verdict: `pass`

## Scope Reviewed

- `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`
- Context files:
  - `packages/runtime-core/src/runtime-evidence-artifacts.ts`
  - `packages/runtime-core/src/runtime-evidence.ts`
  - `packages/runtime-core/src/snapshot-comparison.ts`
  - `packages/contracts/src/runtime-diff.ts`
  - `packages/runtime-core/src/snapshot.ts`

The review was read-only. Files were not edited by Review-Sylph.

## Basis Documents Used

- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-runtime-diff-contract-and-comparison-semantics-completion.md`
- `discussion/implementation/reviews/wave13/wave13-runtime-diff-contract-and-comparison-semantics-review.md`
- `discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Design / Development Compliance

Result: `pass`.

- Domain C scope allows `packages/runtime-core/src/runtime-evidence-artifacts.test.ts` and minimal evidence source edits if needed; the reviewed change is tests-only in that file.
- No production source, `index.ts`, operation, editor, validator, fixture, or contract implementation change is introduced by the Domain C diff.
- The test aligns with Domain A's contract: `RuntimeDiffSchema` keeps `runtime-diff-v1` and defaulted `drawableRuntimeStateChanges` / `drawListChanges`.
- Runtime evidence uses `runtimeComparison.diff` directly, so the new fields are not projected through a narrower shape.
- The new test maps `runtimeDiff.beforeSnapshotId` and `runtimeDiff.afterSnapshotId` through `createRuntimeSnapshotArtifactPath` and verifies that materialized snapshot artifacts exist and match those IDs.

## Test Adequacy

Result: `pass`.

- Existing mesh keyform artifact coverage now asserts that dedicated runtime state and drawList fields remain empty for mesh-only evidence.
- New regression coverage includes opacity, visibility, base draw order, evaluated draw order, drawList membership change, drawList order change, and legacy `/drawList` compatibility.
- Assertions are strong enough for Domain C: exact `drawListChanges`, exact legacy `parameterChanges`, exact snapshot drawLists, and length plus contents for `drawableRuntimeStateChanges`.
- Non-blocking note: the fixture combines drawList membership and order change in one case rather than isolating order-only projection. This is acceptable because Domain A already owns comparison semantics coverage; Domain C's job is projection through runtime evidence artifact paths.

## Verification Assessment

Review-Sylph did not rerun Vitest or typecheck.

Provided Orch-Sylph verification is sufficient for this Domain C gate:

- focused runtime evidence artifact test passed;
- full `packages/runtime-core/src` Vitest run passed;
- `pnpm.cmd typecheck` passed;
- `git diff --check -- packages/runtime-core/src/runtime-evidence-artifacts.test.ts` passed with LF/CRLF warning only.

Review-Sylph ran `git diff --check -- packages/runtime-core/src/runtime-evidence-artifacts.test.ts`; it passed with LF/CRLF warning only.

## Findings

Blocking: none.

Non-blocking:

- DrawList membership and order projection are covered in a combined evidence case, not isolated evidence cases. This does not block Domain C because isolated comparison semantics are already covered by Domain A.

## Remaining Issues

- None blocking for Domain C.

## User-Decision Points

- None.

## Assumptions

- Non-target modified files in the worktree belong to other Wave 13 domains or integration work.
- Runtime evidence is expected to expose `runtimeDiff` as part of the evidence result, not as a separate materialized artifact file.
