# Wave90 Domain A Test Adequacy Review

## Verdict

`pass`

Domain A `wave90-workspace-persistence-core` のテストは、Wave90 plan が要求する workspace save/open core の主要リスクを focused unit tests で直接検証している。blocking finding はない。

## Basis Reviewed

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `packages/package-format/src/workspace-metadata.ts`
- `packages/package-format/src/workspace-file-set.ts`
- `packages/package-format/src/workspace-save-plan.ts`
- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/package-format/src/index.ts`
- `packages/authoring-core/src/workspace-save.ts`
- `packages/authoring-core/src/workspace-save.test.ts`
- `packages/authoring-core/src/index.ts`

## Findings

None blocking.

## Coverage Assessment

| Required evidence | Assessment |
|---|---|
| Save plan skips verified binary | Covered by `packages/package-format/src/workspace-save-plan.test.ts:24`, asserting `skip` and existing verification `pass` at `:33` and `:37`. The implementation path returns `skip` on existing verification pass in `packages/package-format/src/workspace-save-plan.ts:196` through `:204`. |
| Writes missing binary | Covered by `packages/package-format/src/workspace-save-plan.test.ts:40`, asserting `write`, `existing-missing`, and exact bytes at `:49`, `:53`, and `:54`. |
| Rewrites corrupt/digest mismatch binary when session bytes verify | Covered by `packages/package-format/src/workspace-save-plan.test.ts:57`, with digest mismatch assertions at `:81` through `:87`. The same test also covers media mismatch at `:89` through `:95`. |
| Errors when session bytes do not match reference | Covered by `packages/package-format/src/workspace-save-plan.test.ts:98`, asserting `error`, `session-bytes-mismatch`, and `binary.digest.mismatch` at `:107` through `:113`. |
| Parse/open rejects traversal, absolute paths, backslashes, duplicate paths | Covered by `packages/package-format/src/workspace-file-set.test.ts:35`, with concrete cases at `:39` through `:62`. These exercise `assertPackageRelativePath()` and duplicate detection used by workspace parse in `packages/package-format/src/workspace-file-set.ts:103` through `:107`. |
| Stale binary index metadata is derived warning / ignored | Covered by `packages/package-format/src/workspace-file-set.test.ts:65`, asserting parsed `PackageDocument` equality and `workspace.metadata.binaryAssetIndex.ignored` at `:93` through `:100`. Implementation emits derived metadata warnings in `packages/package-format/src/workspace-file-set.ts:144` through `:161`. |
| PSD source bytes are not collected for browser PSD workspace save | Covered by `packages/package-format/src/workspace-save-plan.test.ts:116`, asserting PSD source exclusion and only extracted layer raw RGBA decision paths at `:133` through `:145`. Implementation excludes source binary refs and collects texture atlas refs separately in `packages/package-format/src/workspace-save-plan.ts:119` through `:148`. |
| Generated atlas raw RGBA is collected only when committed as texture atlas artifact | Covered by `packages/package-format/src/workspace-save-plan.test.ts:148`, asserting uncommitted session bytes produce no decisions and committed texture atlas refs produce a write candidate at `:168` through `:171`. |
| Authoring-core adapter builds plan from PackageDocument refs + session bytes | Covered by `packages/authoring-core/src/workspace-save.test.ts:26`, asserting document `binaryAssetRef`, `workspace.json`, `write`, `existing-missing`, and path at `:44` through `:53`. Implementation passes `getAuthoringSessionBinaryFileEntries()` into package-format save planning in `packages/authoring-core/src/workspace-save.ts:38` through `:44`. |
| Tests would fail for plausible regressions | Adequate. Tests assert decision action, reason, verification issue codes, concrete package-relative paths, exact bytes, and candidate/excluded path lists rather than broad snapshots. |

## Verification Performed

- `pnpm.cmd exec vitest run packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/workspace-save-plan.test.ts packages/authoring-core/src/workspace-save.test.ts`
  - sandbox attempt failed with known Vite/esbuild `spawn EPERM`;
  - escalated rerun passed: 3 files, 11 tests.
- `pnpm.cmd typecheck`
  - passed.
- Direct source/test inspection with `rg` and `Get-Content`.

## Remaining Risks

- No blocking missing focused test was found.
- Non-blocking hardening: `WorkspaceBinaryWriteReason` has explicit branches for `existing-byte-length-mismatch` and `existing-asset-id-mismatch` in `packages/package-format/src/workspace-save-plan.ts:277` through `:287`, but the new save-plan test file does not assert those reasons directly. Core byte verification for missing bytes and byte-length mismatch is already covered in `packages/package-format/src/package-binary-file-set.test.ts:88` through `:127`, and the save-plan behavioral requirements are covered by missing, digest mismatch, media mismatch, and session mismatch tests.
- Non-blocking hardening: `metadata/byte-intake-summaries.json` warning behavior is implemented in `packages/package-format/src/workspace-file-set.ts:155` through `:161`, but the new stale metadata test focuses on `metadata/binary-asset-index.json`.

## User-Decision Points

None blocking for Domain A. Future hardening can add explicit save-plan tests for byte-length mismatch, asset-id mismatch, session-bytes-missing, and byte-intake summary warning if the team wants branch-level coverage beyond the Wave90 Domain A gate.
