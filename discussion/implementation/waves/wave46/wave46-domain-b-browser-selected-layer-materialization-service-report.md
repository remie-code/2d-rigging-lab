# Wave46 Domain B Report: Browser Selected-Layer Materialization Service

> Target: `wave46-browser-selected-layer-materialization-service`
> Date: 2026-06-05
> Role: Gnome implementation agent
> Review status: Review-Sylph F1 fix implemented; independent re-review pass for Domain B

## Verdict

`pass`

Domain B implementation is complete inside `apps/editor/src/**`: the Editor/browser service can materialize an explicitly selected PSD layer into an Editor-local raw RGBA candidate with parser-free evidence and private/local provenance. Focused Editor tests, full typecheck, source guard, dependency guard, and parser import boundary guard pass in the current worktree.

Fix loop 1/2 addressed Review-Sylph's freshness verification finding by adding Domain B-owned parser identity, source layer path/name, candidate/materialization identity, and Editor-local storage-boundary checks.

Fix loop 2/2 addressed Review-Sylph F1 by preserving `explicitFile` source intake evidence through successful browser `File` materialization while keeping the ArrayBuffer entrypoint evidence as `explicitArrayBuffer`. Focused service tests now cover both successful intake kinds. Independent Review-Sylph re-review confirmed the F1 fix and issued a Domain B `pass`; this does not mark overall Wave46 final pass.

## Files Changed By Domain B

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.test.ts`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`

Observed parallel / pre-existing non-Domain-B worktree changes were not edited or reverted by Domain B:

- `packages/operation-core/**`
- `packages/package-format/**`
- Wave46 orchestration / Domain A report and review artifacts

No package source, dependency manifest, dependency registry, lockfile, scripts, e2e, or UI workflow files were edited by Domain B.

Fix loop 2/2 changed only:

- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`

## Materialization Service Summary

- Added `materializeSelectedPsdLayerFromArrayBuffer` and `materializeSelectedPsdLayerFromBrowserFile`.
- The service enforces source PSD size preflight before parser execution and `File.arrayBuffer()` for oversize browser `File` input.
- The service computes source PSD SHA-256 and supports optional expected source digest/byteLength checks before parser execution.
- Actual PSD parse/composite execution remains inside the approved adapter boundary: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
- The new service imports no `@webtoon/psd` parser package and persists no source PSD bytes or materialized bytes.
- Adapter materialization now distinguishes missing layer refs, selected group nodes as unsupported layer type, parser failure, and materialization failure.
- Existing Wave45 compact materialization evidence was aligned to Wave46 canonical raw RGBA mediaType and explicit `publicDemoAsset=false` provenance where package schemas allow it.

## Evidence Fields Summary

Successful materialization returns an Editor-local candidate:

- `bytes: Uint8Array` for current-session raw RGBA candidate bytes only
- `mediaType=application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`
- `pixelFormat=rgba8`
- `width` / `height`
- materialized `byteLength`
- materialized SHA-256 digest
- source PSD SHA-256 digest and byteLength
- source PSD file name / declared media type / source asset id
- source layer ref, path, and original name
- parser metadata: name, package, version, adapter, runtime, private-shape policy
- extraction options: `Layer.composite(false, false)`, `effect=false`, `composed=false`, `outputEncoding=raw-rgba`, `channelOrder=rgba`
- provenance: explicit user-selected private/local PSD input, `privacyLabel=private/local`, `publicDemoAsset=false`, Domain B non-persistence statement
- storage boundary: Editor-local candidate only; package storage identity and persistent binary asset refs are not assigned by Domain B and remain Domain C/D-owned

Evidence is parser-free outside the adapter; no parser nodes, `children`, stacks, or raw parser objects are emitted.

## Failure / Stale Handling Summary

Structured failure evidence is returned for:

- `sourceOversize`
- `sourceMismatch`
- `parserFailure`
- `missingLayer`
- `unsupportedLayerType`
- `materializationFailure`
- `materializedLayerOversize`

Added `verifySelectedPsdLayerMaterializedAssetCandidate` for Editor-local freshness checks:

- missing current materialized bytes -> `missing`
- materialized digest/byteLength mismatch -> `stale`
- source digest/byteLength mismatch -> `stale`
- source layer ref mismatch -> `stale`
- source layer path/name mismatch -> `stale`
- mediaType mismatch -> `stale`
- parser package/version/private-shape policy mismatch -> `stale`
- extraction options mismatch -> `stale`
- candidate/materialization identity mismatch -> `stale`
- Editor-local storage boundary mismatch -> `stale`

All failure/freshness evidence keeps `publicDemoAsset=false`.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts`
  - 10 tests passed.
  - Added successful browser `File` materialization coverage for `source.intakeKind=explicitFile` and private/local Editor-local candidate evidence.
  - Existing successful ArrayBuffer materialization coverage now asserts `source.intakeKind=explicitArrayBuffer`.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts apps/editor/src/editor-state/explicit-psd-import-state.test.ts`
  - 3 files / 17 tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - passed.
- `pnpm.cmd typecheck`
  - passed in the current worktree.
- `pnpm.cmd run check:source`
  - passed: source organization guard passed.
- `pnpm.cmd run check:deps`
  - passed: dependency guard passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts.

Diff hygiene:

- `git diff --check -- apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
  - completed with no output; the three files are currently untracked Wave46 files, so the supplemental no-index check below was also used.
- `git diff --check -- apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/waves/wave46 discussion/implementation/reviews/wave46`
  - passed; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new Domain B file>` for the three new Editor source/test files and this report
  - completed with exit code 1 from comparing each file against `NUL`; output contained CRLF working-copy warnings only and no whitespace error lines.

## Parser Import Boundary Confirmation

- No new direct `@webtoon/psd` import was added outside `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
- `node scripts/check-psd-parser-import-boundary.mjs` passed.
- `packages/**` direct parser import remains absent.

## Remaining Issues / User-Decision Points

- No Domain B user decision is required.
- Independent Review-Sylph re-review passed for Domain B after fix loop 2/2. Overall Wave46 final pass remains outside this Domain B report.
- Future product decisions remain outside Domain B: storage bridge, part mapping UX, validator diagnostics, all-layer import, drag-drop/archive/filesystem, encoded PNG/WebP output, renderer/pixel oracle, public demo assets, and Cubism compatibility.
