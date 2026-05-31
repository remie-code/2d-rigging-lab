# Wave 20 Domain C Review

> Domain: `wave20-psd-import-operation-materialization`
> Reviewer: Review-Sylph independent clean-context review
> Implementer context: `019e7b80-e80e-77f3-a369-469860936c86` / Gnome the 68th
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-domain-b-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-b-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-c-completion.md`

## Files Reviewed

- `packages/operation-core/src/operations/import-psd-source-asset.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-texture.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/authoring-core/src/source-asset-mutations.test.ts`
- Supporting authoring/package code read for persistence behavior:
  `packages/authoring-core/src/source-asset-mutations.ts`,
  `packages/authoring-core/src/texture-asset-mutations.ts`,
  `packages/authoring-core/src/package-document-assets.ts`,
  `packages/package-format/src/source-manifest.ts`,
  `packages/package-format/src/texture-atlas.ts`,
  `packages/package-format/src/package-file-set.ts`.

Out of scope: current `packages/validator-core/**` changes are present in the worktree and were treated as Domain D work.

## Verification

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/authoring-core/src/source-asset-mutations.test.ts
```

Sandbox result: failed with `EPERM` reading Vitest from `node_modules`.

Escalated rerun: pass, `3` files / `27` tests.

```powershell
pnpm.cmd typecheck
```

Sandbox result: failed with `EPERM` reading TypeScript from `node_modules`.

Escalated rerun: pass for root and editor typecheck.

```powershell
git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only LF/CRLF working-copy warnings.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

```powershell
rg -n 'readFile|FileReader|decode|raster extraction|psd parser|ag-psd|sharp|pngjs|jimp' <Domain C operation/test files>
```

Result: no matches.

```powershell
rg -n '[ \t]+$' <new Domain C files and completion note>
```

Result: no matches.

## Findings

No blocking or non-blocking findings.

## Review Notes

Parser-free boundary passes. The PSD operation consumes `payload.adapterResult` and never reads PSD bytes, decodes images, extracts rasters, or imports parser/image libraries. The handler rejects missing adapter results through `operation.importPsdSourceAsset.missingAdapterResult` in `import-psd-source-asset-preconditions.ts:42`, and the exact dependency/forbidden parser scan found no matching implementation sites.

Operation integrity passes. `importPsdSourceAssetOperationHandler.dryRun` applies the operation to `createDryRunAuthoringSession(session)` in `import-psd-source-asset.ts:44`, while commit applies to the live session at line 49. Preconditions run before any source or texture mutation at lines 79-89. Focused tests cover dry-run original-session non-mutation, commit through operation core, missing adapter rejection, unsafe preview rejection before mutation, and missing target part rejection in `import-psd-source-asset.test.ts:21`, `:77`, `:139`, `:165`, and `:188`.

Materialization passes within current contracts. `createPsdSourceAssetFromPayload` writes `psd-source-v1` / `layered-character-psd-profile-v1` source asset records and source layer metadata in `import-psd-source-asset-materialization.ts:16-42`. Role overrides and layer unsupported feature IDs are preserved in source layers at lines 102-116. Group metadata, source order, target part mapping, texture IDs, texture preview refs, unsupported feature details, and adapter diagnostics are flattened deterministically into source asset diagnostics in `import-psd-source-asset-diagnostics.ts:18-84`.

Texture preview and target relation handling passes. Texture preview materialization validates package-local/data URL references, missing texture IDs, duplicate/existing texture IDs, and missing referenced parts in `import-psd-source-asset-texture.ts:43-107`, then creates texture atlas entries and preview assets at lines 118-164. Package serialization support exists through `package-document-assets.ts:12-25` and `package-file-set.ts:56-61`.

Rights/provenance pass. Commit creates source provenance and rights records in `import-psd-source-asset.ts:110-132`, links the operation ID, records adapter/schema transform history, and uses the same source asset as the rights asset for texture preview metadata. The focused commit test verifies source manifest, provenance, rights, texture atlas, model diff, and operation log target IDs.

Source organization passes. New operation logic is split across lifecycle, diagnostics, materialization, preconditions, and texture files. `packages/operation-core/src/index.ts` remains barrel-only. `operation-registry.ts` has minimal handler wiring, and `import-split-png-source-asset-unsupported-psd.ts` is now a compatibility re-export.

Test adequacy passes for Domain C. The focused tests exercise the highest-risk operation and authoring paths, and full typecheck passes. Additional precondition branches such as duplicate group/layer IDs and unknown requested roles are implemented deterministically but not all individually asserted; this is acceptable for the current focused scope.

## Residual Risks

- Current `SourceManifest` only has string `diagnostics` and layer `unsupportedFeatures: string[]`, so PSD group metadata, source order, texture/part relation, and structured unsupported feature details are flattened. This is truthful and deterministic, but a later package-format wave may want structured PSD source fields.
- Texture previews remain adapter-supplied references only. There is still no PSD binary storage, parser, image decode, raster extraction, or Photoshop-compatible rendering claim.
- `unsupportedPsdSourceAssetOperationHandler` remains as a legacy alias to the commit-capable handler. This is compatible, but the name is now historical.

## Files Changed By This Review

- `discussion/implementation/reviews/wave20/wave20-domain-c-review.md`

## Domain C Result

Domain C can pass after this review.
