# Wave28 Domain C Report: Validator Part / Texture / Layer Diagnostics

## Verdict

done

## Scope Changed

- Added deterministic part hierarchy, drawable membership, and editor layer-state reference diagnostics in validator-core.
- Reused existing texture diagnostics for missing texture atlas entry and texture/source mismatch.
- Updated validator check catalog and contract documentation for the newly formalized diagnostics.
- Kept public `index.ts` barrel-only; the only `index.ts` change is a re-export.

## Files Changed

- `packages/validator-core/src/validators/part-layer-semantics.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave28/domain-c-validator-part-texture-layer-diagnostics-report.md`

## Diagnostics Added Or Reinforced

- `ref.drawablePartMissing`
- `part.parentMissing`
- `part.childMissing`
- `part.parentChildMismatch`
- `part.cycle`
- `part.drawableMembershipMismatch`
- `editorState.staleReference`
- Existing `ref.drawableTextureMissing` and `ref.textureSourceLayerMismatch` are covered by focused Wave28 tests.

## Verification

- Pass: `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - 1 file, 8 tests passed.
- Pass: `pnpm.cmd exec vitest run packages/validator-core/src`
  - 16 files, 96 tests passed.
- Pass: `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave28`
  - Exit code 0. Git reported existing line-ending normalization warnings for touched files.
- Pass: `pnpm.cmd typecheck`
  - Root and editor typecheck completed with exit code 0 after the Review-Sylph readonly fixture fix.

## Compatibility Notes

- Source, PSD, binary, dynamics, viewer, rig-control, and mask validator tests remained compatible in the validator-core focused suite.
- Editor-only `selection`, `lockedIds`, and `editorHiddenIds` stale refs are warning-level diagnostics and do not mask runtime/package errors.
- Valid editor-only selection/lock/hide refs do not produce package runtime failures.

## Known Risks

- The part cycle diagnostic emits the first deterministic cycle path, not an exhaustive list of all cycles.

## User Decision Points

- None for Domain C.
