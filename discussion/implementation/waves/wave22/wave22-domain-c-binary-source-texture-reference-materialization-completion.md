# Wave 22 Domain C Completion: Binary Source Texture Reference Materialization

> Target: `wave22-binary-source-texture-reference-materialization`
> Implementer: `019e7d67-b78d-7171-a27f-7970330ebc01` / Gnome the 6th
> Reviewer: `019e7d7e-83db-7c22-83df-d663b0373d55` / Sylph the 8th
> Follow-up reviewer: `019e7d87-73a3-7350-8c02-d2de08f962c3` / Sylph the 9th
> Date: 2026-05-31
> Status: `pass`

## Summary

Domain C materialized package-local binary asset references through source and texture metadata without adding PSD/PNG decode, file picker, archive, filesystem import, external dependency, runtime-core binary detail, or validator implementation.

Source import payload metadata can now carry Domain A/B `BinaryAssetReference` data into authoring source assets and texture atlas entries. PSD structured profile and split PNG import metadata can relate texture preview paths to package-local binary refs while keeping the operation-core behavior parser-free and decode-free.

The first independent Review-Sylph pass returned `needs_fix` because `storage-unsupported-v1` behavior lacked focused test coverage. Gnome added test-only regressions for unsupported storage and mismatch branches, and the follow-up Review-Sylph review passed:
[wave22-domain-c-binary-source-texture-reference-materialization-review.md](../../reviews/wave22/wave22-domain-c-binary-source-texture-reference-materialization-review.md).

## Changed Files

| File | Responsibility |
|---|---|
| `packages/authoring-core/src/binary-asset-references.ts` | Shared authoring helpers for cloning and normalizing source/texture binary refs against provenance, rights, and package-local paths. |
| `packages/authoring-core/src/authoring-mutations.ts` | Mutation error codes for binary ref mismatch diagnostics. |
| `packages/authoring-core/src/source-asset-mutations.ts` | Source import metadata normalization for source-level binary refs. |
| `packages/authoring-core/src/texture-asset-mutations.ts` | Texture preview metadata normalization for texture-level binary refs. |
| `packages/authoring-core/src/index.ts` | Barrel export for the new binary ref helper surface only. |
| `packages/authoring-core/src/source-asset-mutations.test.ts` | Authoring tests for preserving compatible source binary refs and rejecting mismatches. |
| `packages/authoring-core/src/package-document-adapter.test.ts` | Package-document round-trip coverage for source and texture binary refs. |
| `packages/operation-core/src/payloads/import-source.ts` | Import payload schemas for source binary refs and texture-preview binary refs. |
| `packages/operation-core/src/operations/import-binary-asset-references.ts` | Operation-core precondition and pending-diagnostic helpers for binary refs. |
| `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts` | PSD binary ref diagnostic integration. |
| `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts` | PSD source asset and structured profile materialization of package-local binary-backed preview references. |
| `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts` | PSD binary ref precondition checks. |
| `packages/operation-core/src/operations/import-psd-source-asset-texture.ts` | PSD texture atlas binary ref materialization. |
| `packages/operation-core/src/operations/import-psd-source-asset.ts` | PSD operation result diagnostics for pending binary refs. |
| `packages/operation-core/src/operations/import-psd-source-asset.test.ts` | Focused PSD source/texture binary ref materialization and pending diagnostic tests. |
| `packages/operation-core/src/operations/import-split-png-source-asset-diagnostics.ts` | Split PNG binary ref diagnostic integration. |
| `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts` | Split PNG texture preview materialization with binary-backed package-local references. |
| `packages/operation-core/src/operations/import-split-png-source-asset.ts` | Split PNG source asset materialization and result diagnostics for pending binary refs. |
| `packages/operation-core/src/operations/import-split-png-source-asset.test.ts` | Focused split PNG source/texture binary ref, unsupported-storage, and mismatch regression tests. |
| `discussion/implementation/reviews/wave22/wave22-domain-c-binary-source-texture-reference-materialization-review.md` | Independent initial and follow-up review record. |
| `discussion/implementation/waves/wave22/wave22-domain-c-binary-source-texture-reference-materialization-completion.md` | This completion note. |

## Evidence

- Source import payloads can embed package-local binary refs for source assets.
- PSD adapter-supplied structured layer metadata can reference a package-local texture preview binary ref without parsing or decoding PSD bytes.
- Split PNG layer metadata can reference a package-local texture preview binary ref without reading or decoding PNG bytes.
- Texture atlas entries carry the binary ref; texture preview assets continue to use the existing package-local file or deterministic data URL relation.
- Missing or unsupported binary payload states produce pending/warning operation diagnostics and do not claim bytes were verified by operation-core.
- Provenance, rights, and package path mismatches reject before source/texture metadata mutation.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/authoring-core/src/source-asset-mutations.test.ts packages/authoring-core/src/package-document-adapter.test.ts` | pass | Initial sandbox run hit `EPERM` reading Vitest under `node_modules`; escalated rerun passed 4 files / 36 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/dependency-boundary.test.ts packages/authoring-core/src/dependency-boundary.test.ts` | pass | Escalated run passed 2 files / 3 tests. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Git emitted LF/CRLF working-copy warnings only. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts` | pass | Post-fix rerun passed 2 files / 27 tests. |
| Dependency manifest status check | pass | No changes under root manifests, lockfile, workspace manifest, editor/runtime package manifests, or package manifests checked for Domain C. |
| Forbidden implementation scope status check | pass for Domain C | No Domain C changes under `apps/editor` or `packages/runtime-core`. `packages/validator-core` has parallel Domain D diffs and was not edited by Domain C. |

## Review Result

| Review | Result | Notes |
|---|---|---|
| Initial Review-Sylph independent review | `needs_fix` | Medium finding: `storage-unsupported-v1` behavior was not test-pinned. Low finding: mismatch branches were mostly source-reviewed. |
| Gnome fix loop | `pass` | Added focused tests only in `import-split-png-source-asset.test.ts` for unsupported storage, pending diagnostics, no false byte verification, and source/texture mismatch rejection. |
| Follow-up Review-Sylph independent review | `pass` | No remaining blocking findings. Review accepted split PNG `storage-unsupported-v1` coverage because PSD and split PNG share the pending binary diagnostic helper. |

## Explicit Non-Claims

- No PSD parser.
- No PNG or PSD decode.
- No raster extraction, image sniffing, canvas rendering, or texture materialization from bytes.
- No file picker, Browser File API import, archive import/export, or filesystem import.
- No external dependency or manifest/lockfile change.
- No validator-core, editor, or runtime-core implementation by Domain C.
- No operation-core claim that package-local bytes are present or verified.

## Residual Risks

- `stored-package-local-v1` remains caller-supplied metadata in operation-core; byte presence and digest verification remain Domain B/D file-set and validator responsibility.
- PSD does not have a separate `storage-unsupported-v1` focused test, but the shared pending diagnostic helper is directly covered through split PNG and reviewed as adequate for Domain C.
- Texture preview binary refs are attached to texture atlas entries and related to preview assets by texture id/path; `TexturePreviewAsset.reference` itself still uses the existing package-local file or deterministic data URL union.
- The workspace still includes uncommitted Domain A/B package-format diffs and parallel Domain D validator-core diffs.

## Downstream Start

Domain C is `pass`.

Domain E/F can proceed after Domain D also passes.
