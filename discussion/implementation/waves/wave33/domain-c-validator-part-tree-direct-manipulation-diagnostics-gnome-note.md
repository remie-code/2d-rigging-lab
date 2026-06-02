# Wave33 Domain C Gnome Implementation Note

Target: `wave33-validator-part-tree-direct-manipulation-diagnostics`

## Scope

- Added deterministic validator diagnostics for duplicate part child references, non-empty part delete candidate blockers, and supplied runtime/viewer part hierarchy evidence mismatches.
- Hardened existing part diagnostics without adding operation handlers, runtime algorithms, or Editor UI.

## Changed Files

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/part-delete-blockers.ts`
- `packages/validator-core/src/validators/part-layer-semantics.ts`
- `packages/validator-core/src/validators/part-runtime-evidence.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-gnome-note.md`

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - Result: pass, 1 file / 11 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/validator-core/src/viewer-evidence.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - Result: pass, 5 files / 42 tests.
- `pnpm.cmd typecheck`
  - Result: fail after root `tsc --noEmit` passed.
  - Blocker: editor typecheck fails outside Domain C scope in `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts` because fixture objects lack required `LayerTreeDrawableViewModel.directManipulation` at lines 185 and 218.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave33`
  - Result: pass; command emitted LF-to-CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <new Domain C file>` for the two new validator files and this note
  - Result: no whitespace errors; exit code 1 is expected for no-index content differences, output was LF-to-CRLF warnings only.

## Residual Risks

- None known for Domain C after needs_fix loop 1 verification.

## Needs Fix Loop 1

Finding addressed:

- `packages/validator-core/src/validators/part-runtime-evidence.ts` no longer silently skips runtime snapshots that include `parts` evidence when `packageId` or `packageRevision` disagrees with the validated package.

Changes:

- Added deterministic `part.runtimeEvidenceMismatch` checks for stale runtime snapshot `packageId` and `packageRevision`.
- Added focused test coverage for stale runtime part evidence identity / revision mismatch.
- Narrowed validator contract wording to state that `part.runtimeEvidenceMismatch` covers supplied part evidence whose validated package identity or revision no longer matches.

Loop 1 verification:

- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - Result: pass, 1 file / 12 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/validator-core/src/viewer-evidence.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - Result: pass, 5 files / 43 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --check -- packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/validator-core/src/validators/part-runtime-evidence.ts discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-gnome-note.md`
  - Result: pass; command emitted LF-to-CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <untracked loop file>` for `part-runtime-evidence.ts` and this note
  - Result: no whitespace errors; exit code 1 is expected for no-index content differences, output was LF-to-CRLF warnings only.
