# Wave 20 Domain D Completion

> Domain: `wave20-psd-profile-validator-diagnostics`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7b81-f8ea-7410-84a5-e3a9813fe96d` / Gnome the 69th | Implemented PSD source profile validator diagnostics and focused validator tests. |
| Review-Sylph independent review | `019e7b8c-93ed-7850-9117-d3bc6e83a1d8` / Sylph the 69th | Reviewed basis docs, Domain A/B artifacts, changed files, diff, tests, and verification. Verdict `pass`. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Owner |
|---|---|
| `packages/validator-core/src/validators/psd-source-profile.ts` | Gnome |
| `packages/validator-core/src/psd-source-profile.test.ts` | Gnome |
| `packages/validator-core/src/check-catalog.ts` | Gnome |
| `packages/validator-core/src/validators/package-runtime.ts` | Gnome |
| `packages/validator-core/src/index.ts` | Gnome, barrel export only |
| `discussion/implementation/reviews/wave20/wave20-domain-d-review.md` | Review-Sylph |
| `discussion/implementation/waves/wave20/wave20-domain-d-completion.md` | Orch-Sylph |

No Domain D fixture files, operation-core implementation files, authoring-core files, editor UI files, runtime-core files, dependency manifests, lockfiles, PSD binaries, or parser/image dependencies were changed.

## Implementation Summary

- Added `validatePsdSourceProfiles` in a dedicated validator file.
- Registered `asset.psd.unsupportedFeature` for flattened `sourceLayer.unsupportedFeatures[]` entries, with source-targeted AI-readable evidence.
- Registered `rights.psdLayerProvenanceMissing` for PSD source layers mapped to drawables that cannot be traced through existing `drawable.sourceProvenanceId` contract support.
- Wired PSD profile checks into `validatePackageRuntime`.
- Preserved existing texture preview and source-layer mismatch validation paths, including split PNG and generated fixture compatibility.

## Verification Performed

```powershell
pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts
```

Result: initial sandbox run failed with `EPERM` reading pnpm-installed Vitest. Escalated rerun passed, `2` files / `20` tests.

```powershell
pnpm.cmd exec vitest run packages/validator-core/src
```

Result: initial sandbox run failed with `EPERM` reading pnpm-installed Vitest. Escalated rerun passed, `6` files / `35` tests.

```powershell
pnpm.cmd typecheck
```

Result: initial sandbox run failed with `EPERM` reading pnpm-installed TypeScript. Escalated rerun did not pass because of parallel Domain C `packages/operation-core/**` worktree errors. No Domain D validator-core typecheck error was identified by the Domain D review.

```powershell
git diff --check -- packages/validator-core fixtures/contracts discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only Git LF/CRLF working-copy warnings for tracked validator-core files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/runtime-core
```

Result: no output.

Review-Sylph also confirmed no PSD references or PSD-specific schema leakage in `packages/runtime-core`.

## Review Result

Review-Sylph verdict: `pass`.

No blocking findings and no non-blocking findings requiring Domain D source fixes remain.

Confirmed review lanes:

- Design / development compliance: pass.
- Test adequacy: pass.
- Parser-free truthfulness: pass.
- Validator contract fit: pass.
- Runtime-core non-leakage: pass.
- Source file organization: pass.
- Dependency policy: pass.

## Residual Risks

- Full repository `pnpm.cmd typecheck` still needs a clean pass after parallel Domain C operation-core work stabilizes.
- `rights.psdLayerProvenanceMissing` is implemented, cataloged, and tested, but should be mirrored into validator contract documentation during a future contract refresh.
- Package-format currently persists unsupported PSD features as strings, so Domain D reports structured validator evidence from flattened `sourceLayer.unsupportedFeatures[]`. Richer unsupported-feature persistence remains future schema work.
- Validator diagnostics prove adapter/materialized metadata consistency only. They do not prove actual PSD layer contents from `test_data/sample_model.psd`.

## Next Domain Gate

Domain D can pass.

Domain E/F can proceed after Domain C also passes. Integrator should require a clean full typecheck after Domain C before advancing the wider Wave 20 gate.
