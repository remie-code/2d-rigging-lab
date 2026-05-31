# Wave 20 Domain B Completion

> Domain: `wave20-psd-adapter-result-dto-operation-payload-gate`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7b70-e621-72a2-a0bc-345cbe86473f` / Gnome the 65th | Implemented parser-free PSD adapter result DTOs and deterministic PSD operation gate diagnostics. |
| Review-Sylph independent review | `019e7b77-a4c7-7601-976b-da6c87c0b98b` / Sylph the 66th | Reviewed basis docs, Domain A artifacts, changed files, diff, tests, and verification. Verdict `pass`. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Owner |
|---|---|
| `packages/operation-core/src/payloads/import-source.ts` | Gnome |
| `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts` | Gnome |
| `packages/operation-core/src/operation-schemas.test.ts` | Gnome |
| `packages/operation-core/src/operations/import-split-png-source-asset.test.ts` | Gnome |
| `discussion/implementation/reviews/wave20/wave20-domain-b-review.md` | Review-Sylph |
| `discussion/implementation/waves/wave20/wave20-domain-b-completion.md` | Orch-Sylph |

No dependency manifests, lockfiles, editor UI files, validator files, runtime-core files, `index.ts` implementation logic, PSD binary files, or package-format files were changed for Domain B.

## Implementation Summary

- Added `PsdAdapterResultSchema` and related parser-free adapter DTO schemas to `packages/operation-core/src/payloads/import-source.ts`.
- `ImportPsdSourceAssetPayloadSchema` now accepts optional `adapterResult` for `layered-character-psd-profile-v1`.
- The adapter result can represent PSD canvas, source groups, source layers, bounds, opacity, visibility, source order, unsupported features, adapter diagnostics, texture preview references, texture IDs, and target part IDs.
- The existing PSD operation gate now rejects missing adapter results with `operation.importPsdSourceAsset.missingAdapterResult`.
- Adapter-present PSD requests validate at the DTO boundary but remain rejected with `operation.importPsdSourceAsset.adapterResultPresentButMaterializationPending` until Domain C implements materialization.

## Verification Performed

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts
```

Result: initial sandbox run failed with `EPERM` reading the pnpm-installed Vitest file; escalated re-run passed, `2` files / `23` tests.

```powershell
pnpm.cmd typecheck
```

Result: initial sandbox run failed with `EPERM` reading the pnpm-installed TypeScript binary; escalated re-run passed for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- packages/operation-core packages/package-format discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only Git LF/CRLF working-copy warnings for the four modified operation-core files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

Review-Sylph also independently ran or checked the same focused verification and recorded the results in `discussion/implementation/reviews/wave20/wave20-domain-b-review.md`.

## Review Result

Review-Sylph verdict: `pass`.

No blocking or non-blocking findings remain.

Confirmed review lanes:

- Design / development compliance: pass.
- Test adequacy: pass.
- Source file organization policy: pass.
- Barrel-only `index.ts`: pass.
- Parser-free truthfulness: pass.
- Dependency policy: pass.
- Downstream usability for Domain C/D: pass.

## Residual Risks

- PSD adapter-present operation execution intentionally remains rejected until Domain C replaces the pending gate with materialization.
- `packages/operation-core/src/payloads/import-source.ts` remains cohesive for Domain B, but Domain C/D should split PSD adapter payload schemas if implementation or validation logic expands around them.
- `packages/package-format/src/source-manifest.ts` currently persists unsupported features and diagnostics as string arrays. Domain C/D may need either a flattening strategy or a focused schema change if structured PSD unsupported feature metadata must persist.

## Next Domain Gate

Domain B can pass.

Domain C and Domain D can start in parallel after this pass:

- Domain C should own PSD adapter-result operation materialization and authoring/package mutation paths.
- Domain D should own PSD profile validator diagnostics.

They should avoid overlapping writes to the PSD operation gate unless coordinated through their Orch-Sylph domains.
