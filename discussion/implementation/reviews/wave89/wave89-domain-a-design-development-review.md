# Wave89 Domain A Design / Development Compliance Review

## Verdict

Verdict: `pass`.

No blocking design/development compliance findings were found for Domain A `wave89-texture-atlas-task-apply-performance-fix`.

## Basis Read

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`
- Discussion entry points: `discussion/_conventions.md`, `discussion/_map.md`
- Supporting source for byte/signature behavior: `packages/authoring-core/src/texture-atlas-source-signature.ts`, `packages/authoring-core/src/texture-atlas-binary.ts`, `packages/authoring-core/src/texture-atlas-packing.ts`, `packages/authoring-core/src/binary-byte-registration.ts`, `packages/package-format/src/package-binary-file-set.ts`

## Scope Reviewed

Reviewed Domain A changed source/tests directly:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`

Also checked the existing Operation Core atlas test and GUI command wiring:

- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`

`git status` shows concurrent Domain B viewer files are dirty, but Domain A changes are confined to the expected Atlas Task / authoring-core / operation-core files. I did not treat viewer source changes as this lane's implementation source.

## Blocking Findings

None.

## Design / Development Compliance Assessment

### Architecture Boundaries

Pass. The changed Domain A source stays inside Atlas Task projection/tests, authoring-core atlas target/mutation logic, and the Operation Core atlas apply handler. No implementation logic was moved into viewer files, broad renderer/history code, package manifests, or catch-all modules.

### Operation Core Mutation Boundary

Pass. User-facing Apply still goes through the editor-session command helper and Operation Core:

- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:76`-`83` calls the editor-session `applyTextureAtlasPreview` surface, not authoring-core mutation directly.
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:46`-`58` clones the session, builds an `applyTextureAtlasPreview` operation request, and calls `commitOperationAsync`.
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`-`148` recreates the preview from the current session and rejects layout mismatch before mutation.

### Stale Checks And Apply Optimization

Pass. The Operation Core optimization skips the direct authoring-core guard only after current-session preview recreation and layout comparison:

- Operation Core validates the current recreated layout against the expected payload at `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`-`148`.
- It passes `freshnessValidation` only after that validation at `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:157`-`164`.
- Authoring-core still recomputes target selection/source signature when no validated freshness token is supplied at `packages/authoring-core/src/texture-atlas-mutations.ts:203`-`236`.
- The direct authoring-core byte-change guard is covered at `packages/authoring-core/src/texture-atlas-mutations.test.ts:343`-`375`.

Current search found no other production caller passing `freshnessValidation`.

### `textureBytes` Reference Reuse

Pass with residual risk noted below. `selectTextureAtlasTargets()` now reuses `binaryEntry.bytes` at `packages/authoring-core/src/texture-atlas-targets.ts:402`-`407`, avoiding the previous source-byte clone. This is not worse than current session mutability assumptions because:

- The persisted preview source signature is computed at preview creation.
- Freshness recomputation hashes all current target bytes at `packages/authoring-core/src/texture-atlas-source-signature.ts:108`-`111` and `147`-`155`.
- Direct authoring-core Apply rejects a post-preview byte mutation in the new test.
- Generated atlas bytes are fresh Apply output from `createTextureAtlasPageRgbaBytes()` at `packages/authoring-core/src/texture-atlas-mutations.ts:116`; session binary registration copies bytes through `createPackageBinaryFileEntry()` (`packages/package-format/src/package-binary-file-set.ts:100`-`108`).

### No Hidden Destructive Graph Mutation

Pass. Reviewed production mutation code still writes atlas artifact state only:

- `packages/authoring-core/src/texture-atlas-mutations.ts:145`-`181` writes layout summary, generated texture entry, provenance/rights records, and binary bytes.
- `packages/authoring-core/src/texture-atlas-mutations.ts:183`-`197` leaves `drawableChanges` and `meshUvChanges` empty.
- Tests assert drawable texture refs, mesh UVs, and topology/source graph preservation in `packages/authoring-core/src/texture-atlas-mutations.test.ts:288`-`340`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:79`-`150`, and `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:329`-`366`.

Targeted production search did not find authoring `Drawable.textureId`, `Mesh.uvs`, topology, deformer, keyform, dynamics, or runtime-state rewrites in the reviewed Domain A production files.

### Atlas Task Performance Shape

Pass. The UI now generates the heavy preview image only in `createTextureAtlasTaskPreviewState()`:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts:182`-`204` creates and stores `previewPage`.
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts:130`-`151` reuses the cached `previewPage` during projection and stale states.
- The focused UI test counts one RGBA generation for Generate Preview, then verifies rerender/stale settings/stale target projections keep the same image reference at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:200`-`294`.

Apply still generates final atlas bytes once from the Operation Core-recreated preview, which is consistent with Wave89's "reduce duplication" requirement and the explicit non-goal of broad binary/history redesign.

### Source Organization

Pass. No `index.ts`, catch-all file, new broad helper file, or misplaced implementation logic was introduced. Changed files remain responsibility-specific. `node scripts/check-source-organization.mjs` passed.

### Dependency Policy

Pass. There are no `package.json` or `pnpm-lock.yaml` diffs. `node scripts/check-dependencies.mjs` passed.

### Forbidden Scope

Pass. Domain A did not implement Workspace Directory Export, workerization, manual atlas editing, multi-page atlas, camera capture, Cubism compatibility, or new dependencies. Concurrent Domain B viewer changes remain outside this lane.

## Verification Performed

Source/test review:

- Read the listed basis documents and reviewed the named Domain A source/test files directly.
- Read supporting source-signature, binary-generation, and binary-registration helpers to verify byte-reference and guard behavior.
- Checked GUI command wiring to confirm Apply remains Operation Core-backed.
- Ran targeted production search for destructive atlas rewrites and forbidden scope terms.
- Checked manifest/lockfile diff for dependency changes; no output.

Commands:

- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - Sandbox attempt failed with known Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files, 23 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain A files>`: exit 0; LF/CRLF working-copy warnings only.

## Residual Risks

- The task-local UI stale signature still uses sampled byte summarization for projection performance, so it is not an authoritative full-byte freshness oracle. Operation Core remains authoritative and recomputes full source signatures before Apply.
- `TextureAtlasPreviewFreshnessValidation` is exported from authoring-core and could be misused by future callers. Current production search found only the Operation Core handler passing it after current-session layout validation.
- `textureBytes` reference reuse depends on existing mutable current-session byte conventions; it removes a large copy but does not introduce immutability/freeze guarantees.
- Apply still allocates final generated atlas bytes once; deeper binary storage/history structural-sharing optimization remains outside Wave89 Domain A scope.

## User-Decision Points

None blocking for this wave. Future design may decide whether the freshness-validation escape hatch should become internal-only or receive stricter API documentation.
