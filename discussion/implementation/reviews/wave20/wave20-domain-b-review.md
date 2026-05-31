# Wave 20 Domain B Review

> Domain: `wave20-psd-adapter-result-dto-operation-payload-gate`
> Reviewer: Review-Sylph independent clean-context review
> Reviewer context id: not exposed in this subagent context
> Implementer context: `019e7b70-e621-72a2-a0bc-345cbe86473f` / Gnome the 65th
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/reviews/wave20/wave20-domain-a-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-a-completion.md`

## Files Reviewed

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/package-format/src/source-manifest.ts`
- `package.json`

## Files Changed By This Review

- `discussion/implementation/reviews/wave20/wave20-domain-b-review.md`

## Diff Reviewed

Directly reviewed:

```powershell
git diff -- packages/operation-core/src/payloads/import-source.ts packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts
```

The source diff is limited to four operation-core files:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`

`operation-payload.ts`, `operation-registry.ts`, `packages/package-format/src/source-manifest.ts`, `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` had no diff in the reviewed scope.

## Verification Performed

```powershell
git diff --check -- packages/operation-core packages/package-format discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output only contained Git LF/CRLF working-copy warnings for the four modified operation-core files.

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: no output.

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts
```

Initial sandbox result: failed with `EPERM` reading `node_modules/.pnpm/vitest.../vitest.mjs`.

Re-run with escalation: pass, `2` test files and `23` tests passed.

```powershell
pnpm.cmd typecheck
```

Initial sandbox result: failed with `EPERM` reading `node_modules/.pnpm/typescript.../tsc`.

Re-run with escalation: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

Additional review commands:

- `git status --short -uall`
- `git diff --name-only -- <reviewed source/dependency scope>`
- `rg -n "PsdAdapter|ImportPsdSourceAssetPayloadSchema|adapterResult" packages/operation-core/src/payloads/import-source.ts`
- `rg -n "missingAdapterResult|adapterResultPresentButMaterializationPending|parser-free|does not parse PSD bytes|Wave 20 Domain C" packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `rg -n "psdAdapterResultPayload|parses PSD adapter results|rejects PSD import without|rejects adapter-supplied PSD import|includeAdapterResult" packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
- `rg -n "payloads/import-source|operationHandlers|unsupportedPsdSourceAssetOperationHandler" packages/operation-core/src/index.ts packages/operation-core/src/operation-registry.ts`
- `rg -n "psd-source-v1|layered-character-psd-profile-v1|unsupportedFeatures|diagnostics" packages/package-format/src/source-manifest.ts`

## Findings

No blocking or non-blocking findings remain.

## Design / Development Compliance Review

Pass.

- Parser-free payload boundary is implemented in `packages/operation-core/src/payloads/import-source.ts`. `PsdAdapterResultSchema` is an adapter-supplied DTO with schema/profile literals, adapter name, canvas, source groups, source layers, unsupported feature records, and diagnostics at lines 23-125. `ImportPsdSourceAssetPayloadSchema` accepts it only as optional `adapterResult` at lines 127-134.
- Domain A field matrix coverage is present in payload form: canvas/bounds at lines 65-68 and 104; group identity/path/order/visibility/opacity/bounds/target part/unsupported features at lines 72-83; layer identity/path/order/bounds/visibility/opacity/role/unsupported features/texture preview/texture/target part at lines 97-111.
- Missing adapter result and adapter-present-but-not-yet-materialized states are truthful and deterministic. The unsupported PSD handler branches on `request.payload.adapterResult !== undefined` at `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts:45` and emits either `operation.importPsdSourceAsset.missingAdapterResult` or `operation.importPsdSourceAsset.adapterResultPresentButMaterializationPending` at lines 52-57, targeted to `/payload/adapterResult` at lines 58-62.
- No parser, image decoder, PSD dependency, package manifest change, lockfile change, UI change, validator implementation, runtime-core PSD-specific dependency, or actual PSD bytes parsing/raster extraction was observed.
- `packages/operation-core/src/index.ts` remains barrel-only. It only re-exports `./payloads/import-source.js` at line 3 and other public surfaces; no implementation logic was added there.
- `packages/operation-core/src/operation-registry.ts` remains a registry map. The PSD operation still routes through the unsupported/pending handler at lines 13 and 39-40, which is acceptable for Domain B because Domain C owns adapter-present materialization.
- Source organization is acceptable for this domain. `import-source.ts` is a named import payload schema file, not an entrypoint or catch-all `index.ts`. The PSD adapter schema family is substantial but cohesive with the import source payload responsibility.
- `packages/package-format/src/source-manifest.ts` already allows `psd-source-v1` at line 10 and `layered-character-psd-profile-v1` at line 17. Its `unsupportedFeatures` and `diagnostics` fields remain string arrays at lines 40 and 52; this is a downstream design risk for Domain C/D if structured PSD feature details must persist in source manifests, but Domain B's operation payload can represent the structured adapter result without changing package-format.

## Test Adequacy Review

Pass.

- Adapter-supplied PSD result validation is covered in `packages/operation-core/src/operation-schemas.test.ts`. The fixture includes source group, source layer, bounds, visibility, opacity, unsupported features, texture preview, texture ID, target part mapping, adapter diagnostics, and rights at lines 10-103. The schema test parses it through both `OperationPayloadSchema` and `OperationRequestSchema` at lines 257-290.
- Missing adapter result gate is covered in `packages/operation-core/src/operations/import-split-png-source-asset.test.ts:515-533`, including rejected status, `operation.importPsdSourceAsset.missingAdapterResult`, parser-free message text, deterministic target path `/payload/adapterResult`, and unchanged revisions.
- Adapter-present materialization-pending diagnostic is covered at `packages/operation-core/src/operations/import-split-png-source-asset.test.ts:535-552`, including rejected status, `operation.importPsdSourceAsset.adapterResultPresentButMaterializationPending`, Wave 20 Domain C wording, and unchanged revisions.
- Unsupported feature representation without runtime-core dependency is covered by structured fixture data in `operation-schemas.test.ts:61-77` and `import-split-png-source-asset.test.ts:771-803`. The reviewed files import contracts and zod, not runtime-core or parser/image packages.
- Focused tests and full typecheck both passed after the sandbox `EPERM` was resolved by re-running with escalation.

## Residual Risks

- `import-source.ts` is still readable, but the PSD adapter schema family is large enough that Domain C or D should split it into a dedicated PSD adapter payload file if materialization, validation, or diagnostics logic expands around it.
- `package-format` source manifest currently stores layer `unsupportedFeatures` and asset `diagnostics` as strings. If Domain C/D need to persist structured unsupported feature metadata, they may need a focused source-manifest schema change or a documented flattening strategy.
- Domain B intentionally rejects adapter-present PSD imports until Domain C. This is truthful and tested, but downstream domains must replace that pending path before the Wave 20 final pass criteria that require adapter-present commit.

## Domain C/D Gate

Domain B can pass. Domain C and Domain D can start in parallel after this domain, following the Wave 20 plan, as long as they keep their write scopes separated:

- Domain C should own PSD adapter-result materialization and any operation/authoring mutation changes.
- Domain D should own validator diagnostics and avoid changing the operation handler unless coordinated through Orch-Sylph.
