# Wave 22 Domain C Follow-up Review: Binary Source Texture Reference Materialization

> Target: `wave22-binary-source-texture-reference-materialization`  
> Review agent: Review-Sylph independent follow-up reviewer  
> Date: 2026-05-31  
> Status: `pass`

## Verdict

`pass`.

The fix loop resolves the prior blocking test gap. `storage-unsupported-v1` is now pinned by focused split PNG coverage that asserts the operation commits metadata, emits warning diagnostics, and states that bytes are not verified by operation-core. The PSD path still uses the same shared pending binary reference diagnostic helper, and its missing-bytes materialization path remains covered.

No Domain C production dependency on the parallel validator-core diffs was found. Domain C remains scoped to operation-core and authoring-core metadata materialization, with package-format binary reference types flowing through the existing authoring-core contract surface.

## Findings

No remaining blocking findings.

| Severity | Finding | Status |
|---|---|---|
| Medium | Prior gap: `storage-unsupported-v1` behavior lacked focused test coverage. New split PNG regression coverage at `packages/operation-core/src/operations/import-split-png-source-asset.test.ts:240` asserts committed metadata with `storageStatus: "storage-unsupported-v1"` at `:260` and `:264`, two `binaryPayloadPending` diagnostics at `:268`, warning severity/status at `:273`, no false verification wording at `:277` and `:278`, and storage-status evidence at `:279`. | fixed |
| Low | Prior gap: mismatch branches were mostly source-reviewed. New split PNG negative coverage at `packages/operation-core/src/operations/import-split-png-source-asset.test.ts:283` asserts rejection for source provenance/rights and texture path/provenance/rights mismatch check IDs at `:305` through `:309`, with no source asset or texture atlas mutation at `:312` and `:313`. | fixed enough for Domain C |

## Review Evidence

| Rubric | Result | Evidence |
|---|---|---|
| Unsupported storage behavior | pass | Shared pending diagnostics map non-stored refs through `createPendingBinaryAssetReferenceDiagnostics` at `packages/operation-core/src/operations/import-binary-asset-references.ts:131`, map `missing-package-local-bytes-v1` to `needs_review` and other non-stored statuses to `warning` at `:186`, and describe `storage-unsupported-v1` as not materialized at `:197`. The new split PNG test pins the unsupported branch directly. |
| Source / texture binary ref materialization | pass | PSD source refs are cloned into source asset metadata at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:48`; split PNG source refs are cloned at `packages/operation-core/src/operations/import-split-png-source-asset.ts:364`. PSD texture entries carry cloned texture binary refs at `packages/operation-core/src/operations/import-psd-source-asset-texture.ts:174`; split PNG texture entries do the same at `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:168`. |
| PSD structured profile path | pass | PSD structured layer profile resolves `texturePreviewReference` from `texturePreviewBinaryAssetRef` through `resolveBinaryBackedTexturePreviewReference` at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:189` without decoding bytes. |
| Split PNG metadata and preview relation | pass | Split PNG source diagnostics include binary refs and binary-backed texture preview references in `packages/operation-core/src/operations/import-split-png-source-asset-diagnostics.ts:25` and `:55`; preview assets still materialize as package-local references when backed by a package path in `packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:173`. |
| Parser-free / decode-free boundary | pass | Targeted scan over Domain C production/test scope found no new production `File`, `Blob`, `arrayBuffer`, `fetch`, filesystem read, image decode, PSD parser, or PNG decoder usage. Matches were schema field names, canvas metadata strings, test fixture reads, existing dependency-boundary tests, or data URL validation regexes. |
| Test adequacy | pass | Focused operation tests now cover PSD pending binary refs, split PNG pending refs, split PNG unsupported storage, and split PNG mismatch rejection. Authoring-core tests cover source ref preservation/path rejection and package-document texture ref round-trip. |

## Verification Performed

- Reviewed Domain C diff for `packages/operation-core`, `packages/authoring-core`, and this review artifact.
- Ran `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts`: first sandbox run failed with `EPERM` reading Vitest from `node_modules`; escalated rerun passed, 2 files / 27 tests.
- Reviewed Orch-Sylph's recorded verification: `pnpm.cmd typecheck` passed; `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` passed with LF/CRLF warnings only; earlier full focused Domain C vitest passed, 4 files / 36 tests; dependency-boundary vitest passed, 2 files / 3 tests.
- Re-ran `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22`: passed with LF/CRLF working-copy warnings only.
- Checked package manifests for Domain C scope: no `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, operation-core package manifest, authoring-core package manifest, editor manifest, or runtime-core package manifest status output.

## Residual Risks

- `stored-package-local-v1` remains caller-supplied metadata, not proof that operation-core read or verified bytes. This matches the Wave 22 binary asset contract, but later validator/editor UX should keep that distinction visible.
- PSD does not have a separate `storage-unsupported-v1` test case. I accept the split PNG direct regression as adequate because PSD and split PNG share `createPendingBinaryAssetReferenceDiagnostics`, and PSD already covers the same materialization/pending diagnostic path for missing bytes.
- The review was against the current uncommitted workspace, which still includes Wave 22 Domain A/B package-format diffs and parallel Domain D validator-core diffs.

## Gate Statement

Domain C can proceed.

Domain E/F can proceed after Domain D also passes.
