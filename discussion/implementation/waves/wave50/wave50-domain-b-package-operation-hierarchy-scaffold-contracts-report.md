# Wave50 Domain B Report: Package / Operation Hierarchy Scaffold Contracts

> Target: `wave50-package-operation-hierarchy-scaffold-contracts`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Domain B added additive PSD structural scaffold contracts and evidence DTOs for explicit hierarchy initial state. The change is contract-only: it does not implement Editor UI, validator behavior, parser behavior, external transport, or operation execution semantics.

## Implementation Summary

- Added package-format structural scaffold evidence schemas for:
  - PSD group -> generated project part container scaffolds.
  - PSD leaf -> generated drawable / texture / empty mesh scaffold entries.
  - source group refs, source layer refs, source parentage, source order, source visibility, source opacity, bounds, generated refs, initial runtime visibility, cap policy, summary, and structural issues.
- Added optional `psdStructuralScaffoldPlanEvidence` and `psdStructuralScaffoldApprovalEvidence` arrays to `LayeredCharacterPsdProfileSchema`.
- Added operation-core mirror structural scaffold evidence schemas, operation evidence DTO, and a standalone `ImportPsdStructuralScaffoldPayloadSchema`.
- Added optional `psdStructuralScaffoldEvidence` to `OperationResultSchema`.
- Did not add `importPsdStructuralScaffold` to `OperationTypeSchema`, `OperationPayloadSchema`, or the handler registry. This intentionally prevents current operation-core from accepting a structural operation request that it would not execute correctly.
- Kept existing `PsdImportPlanGeneratedScaffoldSchema`, `PsdImportPlanApprovedLeafRefSchema`, `approvedLeafRefs`, `generatedPartScaffold`, and Wave49 leaf-only payload/evidence shape unchanged.
- Kept structural issue kinds separate as `PsdStructuralScaffoldIssueKindSchema` instead of extending the existing import-plan issue enum, because validator-core has an exhaustive Wave49 import-plan issue mapping and Domain B cannot edit validator-core.

## Files Changed

- `packages/package-format/src/psd-structural-scaffold-evidence.ts`
- `packages/package-format/src/psd-structural-scaffold-evidence.test.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/operation-core/src/psd-structural-scaffold-evidence.ts`
- `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts`
- `packages/operation-core/src/payloads/import-psd-structural-scaffold.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/index.ts`
- `discussion/implementation/waves/wave50/wave50-domain-b-package-operation-hierarchy-scaffold-contracts-report.md`

Pre-existing untracked Domain A artifacts under `discussion/implementation/waves/wave50/**` and `discussion/implementation/reviews/wave50/**` were not modified by this Domain B pass.

## Contract Notes

- Group scaffold entries are strict `groupPartContainer` records and contain generated part refs only. Extra drawable/texture/mesh refs on groups are rejected by schema.
- Leaf scaffold entries carry generated drawable, texture, and mesh refs plus `generatedParentPartId`; they do not represent groups as drawables.
- `initialRuntimeVisibility` is schema-checked to match the source leaf `visibleInSource` value. Hidden source leaves therefore validate only with `initialRuntimeVisibility: false`.
- Group visibility and opacity are evidence only. No runtime group visibility/opacity semantics were added.
- Cap policy fields are positive integer / byte-limit contracts and invalid cap shapes are rejected.
- Persistence boundaries remain explicit: raw parser objects are not persisted, source PSD bytes are metadata-only/no raw bytes, materialized layer bytes are binary refs only, and there is no Photoshop compositing, renderer pixel oracle, semantic recognition, repo proposal generation, or initial grid mesh generation claim.

## Verification Performed

| Check | Result |
|---|---|
| Focused Vitest: `packages/package-format/src/psd-structural-scaffold-evidence.test.ts`, `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts`, `packages/package-format/src/source-manifest.test.ts`, `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`, `packages/operation-core/src/operation-schemas.test.ts` | pass after approved rerun; sandbox run hit esbuild `spawn EPERM`; approved rerun passed 5 files / 32 tests |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass; 5 direct import/resolve sites limited to approved adapter and Wave44 scripts |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` | pass; Git emitted LF/CRLF working-copy warnings only |

## Residual Risks

- Structural operation execution is not implemented in this domain. Domain C must register/execute the structural operation or otherwise wire the payload DTO intentionally.
- Structural issue kinds are reserved on the structural evidence schema, not on the legacy import-plan issue enum. If Domain F promotes these into validator-core/Product Preflight mappings, it should add validator mappings then.
- The schemas do not perform cross-array graph validation such as verifying every leaf parent group appears in the same plan. That remains operation/validator responsibility.

## User-Decision Points

None for Domain B.

Future-scope decisions remain unchanged: group visibility/opacity runtime semantics, higher caps, initial grid mesh generation, Photoshop compositing, renderer/pixel oracle, external transport, public sample-derived assets, or Cubism compatibility would require separate approval.

## Forbidden Scope / Behavior Check

- Did not edit `apps/editor/**`.
- Did not edit `packages/ai-interface/**`.
- Did not edit `packages/validator-core/**`.
- Did not import or depend on the PSD parser from packages.
- Did not implement operation execution behavior.
- Did not add external HTTP/WebSocket/MCP transport.
- Did not add repo-side proposal generation, semantic classification, candidate ranking, auto-fix, automatic commit, initial grid mesh generation, or group-as-artmesh behavior.
