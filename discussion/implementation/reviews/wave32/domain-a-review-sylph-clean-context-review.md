# Wave32 Domain A Clean Context Review

Target: `wave32-warp-lattice-contract-package-footing`

Reviewer: Review-Sylph L2

Date: 2026-06-02

Verdict: `pass`

## Scope Reviewed

- `packages/contracts/src/warp-lattice2d.ts`
- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/warp-lattice2d.test.ts`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/warp-lattice2d-contract.test.ts`
- `discussion/implementation/waves/wave32/domain-a-gnome-implementation-report.md`

Parallel Wave32 Domain B/C/D changes in editor/runtime/validator/docs were treated as outside Domain A except where they affected repository-wide verification.

## Findings

No blocking Domain A findings.

- Contract shape is fixed in a dedicated `warp-lattice2d.ts` file: `controlPointOffsets`, row-major control point order, positive `domainBounds`, lattice size helpers, and outside-domain policy are explicit.
- `packages/contracts/src/index.ts` remains barrel-only; the change is a single re-export.
- Package-format now enforces positive warp lattice `domainBounds`, `latticeColumns >= 2`, `latticeRows >= 2`, and `restControlPoints.length === latticeColumns * latticeRows`.
- `controlPointOffsets` keyforms are narrowed to `Vec2[]` patches with `replace` or `additiveDelta` composition for `rigControl.controlPointOffsets`.
- Runtime diff evidence shape is schema-only and does not implement runtime algorithm behavior.
- No dependency manifest, lockfile, Cubism compatibility, full renderer, pixel oracle, PSD/image/archive, operation handler, or editor UI implementation was introduced by Domain A.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/contracts/src/warp-lattice2d.test.ts packages/package-format/src/warp-lattice2d-contract.test.ts`
  - 2 files, 9 tests passed.
- `pnpm.cmd exec vitest run packages/contracts/src packages/package-format/src`
  - 20 files, 129 tests passed.
- `pnpm.cmd exec tsc --noEmit --pretty false --moduleResolution bundler --module esnext --target es2022 --strict --skipLibCheck packages/contracts/src/warp-lattice2d.ts packages/contracts/src/runtime-diff.ts packages/package-format/src/model-files.ts`
  - Passed.
- `git diff --check -- packages/contracts/src/index.ts packages/contracts/src/runtime-diff.ts packages/package-format/src/model-files.ts`
  - No whitespace errors; Git emitted LF/CRLF working-copy warnings only.
- `rg -n "[ \t]+$" ...` over new Domain A files and this review artifact
  - No trailing whitespace matches.

Blocked outside Domain A:

- `pnpm.cmd typecheck`
  - Failed in current workspace at `packages/validator-core/src/validators/package-schema.ts` with:
    - `TS2440: Import declaration conflicts with local declaration of 'createWarpLatticeSchemaIssueCheck'.`
    - `TS2554: Expected 1 arguments, but got 3.`
  - This is in modified validator-core files owned by parallel Domain C, outside Domain A write/review scope.
  - Note: this differs from the older Gnome report, which recorded a prior out-of-scope failure in `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`.

## Residual Risks

- Package-format schema validates `controlPointOffsets` patch shape independently from the targeted rig control. Cross-file validation that the patch length equals the target lattice cardinality remains validator/runtime-domain work.
- Domain A fixes runtime evidence schema footing only. Evaluation correctness, stale evidence detection, Viewer evidence, and validator diagnostics remain later Wave32 domain responsibilities.
