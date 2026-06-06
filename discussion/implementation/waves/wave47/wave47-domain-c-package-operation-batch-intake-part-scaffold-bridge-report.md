# Wave47 Domain C Report: Package / Operation Batch Intake Part Scaffold Bridge

> Target: `wave47-package-operation-batch-intake-part-scaffold-bridge`
> Role: Gnome
> Verdict candidate: `pass`

## Verdict Candidate

`pass`

Domain C added parser-free package/operation support for explicit multi-layer PSD selected-layer batch intake. The implementation stays in `packages/operation-core/src/**`, uses no PSD parser import in packages, changes no dependencies, persists no source PSD bytes, and carries only parser-free evidence objects.

## Chosen Operation Shape

Chosen shape: new batch operation, `importPsdLayerMaterializationBatch`, implemented as a batch wrapper over the existing Wave46 single-layer `importPsdLayerMaterialization` handler.

Reason:

- The existing single-layer handler already owns stale source identity, extraction option, media type, binary asset, rights, destination, and mapping validation.
- The new batch operation owns batch-only concerns: duplicate layer refs, selected-layer count cap, total byte cap, generated ID/name reservation, destination parent, batch summary evidence, and no-silent-partial semantics.
- Mutation is not partial. The batch handler applies all per-layer operations to a cloned session first and copies the clone back only when every layer succeeds. Rejected results include `psdLayerMaterializationBatchEvidence` with per-entry `preflightReady` / `preflightBlocked` statuses and diagnostics.

## Behavior Implemented

- Added `importPsdLayerMaterializationBatch` operation payload with explicit `batchId`, destination `{ destinationKind: "generatedPartScaffold", parentPartId }`, and selected materialization entries.
- Generates deterministic per-layer `partId`, `drawableId`, `meshId`, and `textureId` from source layer path/name, for example `Hair / Front` -> `part_hair_front`, `draw_hair_front`, `mesh_hair_front`, `tex_hair_front`.
- Rejects or reports:
  - duplicate source layer refs
  - duplicate generated IDs
  - generated part/drawable display-name collisions
  - missing destination parent
  - selected layer count over `4`
  - total raw RGBA byteLength over `32 MiB`
  - single-layer stale/missing/mismatch failures from the reused Wave46 handler, including missing bytes, media type mismatch, digest/byteLength mismatch, stale source digest, parser/extraction mismatch, and invalid generated destination IDs
- Adds batch evidence to `OperationResult` / evidence-provider merge plumbing while preserving existing per-layer `psdLayerMaterializationEvidence`.

## Files Changed

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
- `discussion/implementation/waves/wave47/wave47-domain-c-package-operation-batch-intake-part-scaffold-bridge-report.md`

No `packages/package-format/src/**` source edit was needed because the existing source manifest already supports multiple parser-free PSD layer materialization evidence records. No `apps/editor/**`, `packages/validator-core/**`, `scripts/**`, dependency manifest, or lockfile file was edited by this Domain C implementation. Parallel `apps/editor/**` worktree changes were observed and left untouched.

## Verification Performed

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
  - Passed: 2 files, 11 tests.
- `pnpm.cmd typecheck`
  - Passed: root `tsc --noEmit` and editor typecheck.
- `pnpm.cmd run check:source`
  - Passed: Source organization guard passed.
- `pnpm.cmd run check:deps`
  - Passed: Dependency guard passed.
- Parser-free direct import scan:
  - `rg -n --glob '*.ts' --glob '*.tsx' 'from\s+[''"](@webtoon/psd|ag-psd)[''"]|require\(\s*[''"](@webtoon/psd|ag-psd)[''"]\s*\)' packages`
  - No matches. `rg` exited `1`, which means no direct import/require hits.
- `git diff --check -- packages/operation-core/src/index.ts packages/operation-core/src/lifecycle/evidence.ts packages/operation-core/src/operation-evidence-result.ts packages/operation-core/src/operation-ids.ts packages/operation-core/src/operation-payload.ts packages/operation-core/src/operation-registry.ts packages/operation-core/src/operation-result.ts packages/operation-core/src/operation-type.ts packages/operation-core/src/payloads/import-source.ts`
  - Passed with CRLF warnings only; no whitespace findings.
- `git diff --no-index --check -- NUL <new operation-core file>` for:
  - `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`
  - `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
  - `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts`
  - Passed with CRLF warnings only; no whitespace findings.

## Remaining Issues

None blocking for Domain C.

Downstream domains still need to connect this operation to Editor UX, validator/Product Preflight diagnostics, and focused e2e persistence. This implementation does not claim all-layer import, recursive group import, renderer/pixel oracle, texture correctness oracle, Cubism compatibility, public demo asset status, or source PSD byte persistence.

## User-Decision Points

None.

Future decisions outside Domain C remain: raising batch caps, supporting hidden layer materialization, supporting user-supplied scaffold ID overrides, or requiring a broader transaction system beyond this clone-then-commit batch operation.

## Reviewer Focus

- Confirm `psdLayerMaterializationBatchEvidence` is acceptable as additive operation result evidence and not a schema-breaking public rename.
- Check that clone-first mutation prevents silent partial success on child preflight failures.
- Check strict generated display-name collision behavior against downstream UX expectations.
- Confirm parser-free evidence stays raw-parser-object-free and source-PSD-byte-free.
