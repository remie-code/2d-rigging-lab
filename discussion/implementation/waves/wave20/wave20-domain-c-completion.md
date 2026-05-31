# Wave 20 Domain C Completion

> Domain: `wave20-psd-import-operation-materialization`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7b80-e80e-77f3-a369-469860936c86` / Gnome the 68th | Implemented adapter-backed PSD source import materialization. |
| Review-Sylph independent review | `019e7b95-203a-7330-9313-273af785be5e` / Sylph the 70th | Reviewed basis docs, Domain A/B artifacts, changed files, diff, and verification. Verdict `pass`. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Purpose |
|---|---|
| `packages/operation-core/src/operations/import-psd-source-asset.ts` | Adapter-backed PSD import operation lifecycle and result diff. |
| `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts` | PSD adapter unsupported feature / adapter diagnostic conversion and source manifest diagnostic flattening. |
| `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts` | PSD source asset, layer metadata, source ID, content hash, and target ID materialization helpers. |
| `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts` | Deterministic PSD adapter result, layer/group, target part, and requested role preconditions. |
| `packages/operation-core/src/operations/import-psd-source-asset-texture.ts` | PSD layer texture preview metadata validation and texture atlas / preview asset materialization. |
| `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts` | Legacy compatibility re-export for the PSD operation handler. |
| `packages/operation-core/src/operation-registry.ts` | Routes `importPsdSourceAsset` to the commit-capable PSD handler. |
| `packages/operation-core/src/operations/import-psd-source-asset.test.ts` | Focused PSD dry-run, commit, missing adapter, unsafe preview, and missing target part tests. |
| `packages/operation-core/src/operations/import-split-png-source-asset.test.ts` | Updates registry and legacy PSD expectations for the new adapter-present path. |
| `packages/authoring-core/src/source-asset-mutations.test.ts` | Confirms PSD source profile metadata, rights, provenance, and flattened diagnostics fit authoring mutations. |

No dependency manifests, lockfiles, validator files, runtime-core files, editor UI files, or `index.ts` implementation logic were changed for Domain C.

## Implementation Summary

- `importPsdSourceAsset` now commits when `payload.adapterResult` is present.
- Missing adapter result remains rejected with `operation.importPsdSourceAsset.missingAdapterResult`; operation-core still does not parse PSD bytes, decode images, or extract rasters.
- Adapter-backed commit writes a `psd-source-v1` / `layered-character-psd-profile-v1` source asset, source layer metadata, provenance, rights, texture atlas entries, and texture preview assets into the authoring session.
- Source group metadata, target part mappings, texture preview refs, texture IDs, unsupported features, adapter diagnostics, requested layer role overrides, and canvas facts are preserved in deterministic source asset diagnostics where current package contracts support only string diagnostics.
- Operation result diagnostics preserve adapter unsupported features and adapter diagnostics without leaking PSD-specific structures into runtime-core.
- Existing generic authoring mutations were sufficient; `source-asset-mutations.ts` and `texture-asset-mutations.ts` production code did not need changes.

## Verification

Initial sandbox runs for Vitest and TypeScript hit `EPERM` reading `node_modules`; the same commands were rerun with escalation.

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/authoring-core/src/source-asset-mutations.test.ts
```

Result: pass. `3` test files / `27` tests passed.

```powershell
pnpm.cmd typecheck
```

Result: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output only contained Git LF/CRLF working-copy warnings.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

Additional parser-free scan:

```powershell
rg -n "readFile|FileReader|decode|raster extraction|psd parser|ag-psd|sharp|pngjs|jimp" packages/operation-core/src/operations/import-psd-source-asset.ts packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts packages/operation-core/src/operations/import-psd-source-asset-materialization.ts packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts packages/operation-core/src/operations/import-psd-source-asset-texture.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/authoring-core/src/source-asset-mutations.test.ts
```

Result: no matches.

## Residual Risks

- Current `SourceManifest` contracts store source asset diagnostics and layer unsupported features as string arrays, so structured PSD group and unsupported feature details are flattened deterministically. A later package-format wave may choose a structured field.
- `unsupportedPsdSourceAssetOperationHandler` is retained as a legacy export alias for compatibility, but it now points to the commit-capable PSD handler.
- Texture previews remain adapter-supplied metadata only. No PSD binary storage, parser, image decode, or raster extraction was added.

## Review Result

Review-Sylph verdict: `pass`.

No blocking or non-blocking findings remain.

Confirmed review lanes:

- Parser-free truthfulness: pass.
- Source layer to texture preview / texture ID / target part relation: pass within current source manifest contracts.
- Operation integrity: pass.
- Rights / provenance materialization: pass.
- Source file organization: pass.
- Test adequacy: pass.

Review report:

- `discussion/implementation/reviews/wave20/wave20-domain-c-review.md`

## Next Domain Gate

Domain C can pass.

Domain E/F may proceed after Domain D also passes. Domain C no longer blocks PSD fixture/evidence work or editor PSD source intake mode for the adapter-result path.

## Decision Points

None. No user or design decision is needed for the Domain C scope.
