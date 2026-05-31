# Wave 20 Domain E Review

> Domain: `wave20-psd-fixtures-and-contract-evidence`
> Reviewer: Review-Sylph independent clean-context review
> Implementer context: `019e7ba0-4c29-7352-9806-003aec8041f5` / Gnome the 72nd
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-domain-a-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-a-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-b-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-b-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-c-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-c-review.md`
- `discussion/implementation/waves/wave20/wave20-domain-d-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-d-review.md`

## Files Reviewed

Domain E files:

- `fixtures/contracts/psd-import-happy-path/fixture-manifest.json`
- `fixtures/contracts/psd-import-happy-path/baseline-package.json`
- `fixtures/contracts/psd-import-happy-path/request/import-psd-source-commit.request.json`
- `fixtures/contracts/psd-import-happy-path/request/create-drawable-commit.request.json`
- `fixtures/contracts/psd-import-happy-path/request/generate-mesh-commit.request.json`
- `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json`
- `fixtures/contracts/psd-import-happy-path/expected/validation-report.json`
- `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json`
- `fixtures/contracts/psd-unsupported-layer/baseline-package.json`
- `fixtures/contracts/psd-unsupported-layer/request/import-psd-source-commit.request.json`
- `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json`
- `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json`
- `packages/operation-core/src/psd-import-contract-fixtures.test.ts`

Supporting upstream files reviewed for contract behavior:

- `packages/operation-core/src/operations/import-psd-source-asset.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-preconditions.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-texture.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`

Out of scope: `apps/editor/**` has parallel Domain F changes. I did not edit or review them as Domain E implementation except to classify typecheck scope.

## Verification Performed

```powershell
git status --short -uall fixtures/contracts packages/operation-core packages/validator-core discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: Domain E fixture/test files are untracked in the expected paths. Other modified/untracked operation-core and validator-core files are upstream Domain B/C/D work, and review/completion artifacts are present under `discussion/implementation/**`.

```powershell
git diff -- fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer packages/operation-core/src/psd-import-contract-fixtures.test.ts
```

Result: no output because the reviewed Domain E files are currently untracked.

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts
```

Initial sandbox run was not attempted for this exact single-file command after the broader Vitest sandbox failure; escalated run passed: `1` file / `2` tests.

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/validator-core/src/psd-source-profile.test.ts
```

Initial sandbox run failed with `EPERM` reading `node_modules/.pnpm/vitest.../vitest.mjs`. Escalated run passed: `3` files / `14` tests.

```powershell
pnpm.cmd run typecheck:root
```

Initial sandbox run failed with `EPERM` reading `node_modules/.pnpm/typescript.../tsc`. Escalated run passed.

```powershell
pnpm.cmd typecheck
```

Initial sandbox run failed with the same TypeScript `EPERM`. Escalated run passed for both root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`. The earlier reported Domain F editor typecheck failure was not reproducible in this review run; current `apps/editor/**` diffs remain out of Domain E scope.

```powershell
git diff --check -- fixtures/contracts packages/operation-core packages/validator-core discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: pass. Output contained only Git LF/CRLF working-copy warnings for tracked operation-core, validator-core, and editor files.

Additional checks:

- `rg --files fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer -g *.psd -g *.psb -g *.png -g *.jpg -g *.jpeg -g *.webp -g *.wasm`: no output.
- `rg -n "data:image|base64|sample_model|source-reference\.psd|texturePreviewReference|psdBytesIncluded|image bytes|third-party|redistributionAllowed|aiUsed" fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer packages/operation-core/src/psd-import-contract-fixtures.test.ts`: only metadata references and rights/provenance fields found.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json`: no output.
- `rg -n "psd-source|layered-character|unsupportedFeature|Photoshop|PSD" packages/runtime-core/src packages/runtime-core/package.json`: no output.
- `rg -n "[ \t]+$" fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer packages/operation-core/src/psd-import-contract-fixtures.test.ts`: no matches.

## Findings

No blocking findings.

No non-blocking findings requiring a Domain E source fix.

## Design / Development Compliance Review

Pass.

- Evidence truthfulness passes. Both fixture manifests explicitly state synthetic parser-free adapter metadata, no PSD bytes, and no raster extraction. The happy-path fixture says it is based only on safe sample header shape and records `psdBytesIncluded=false`, `rasterExtractionClaimed=false`, and `texturePreviewBytesIncluded=false`. The unsupported-layer fixture states no PSD bytes, image bytes, or embedded smart object content.
- The request fixtures do not claim actual `test_data/sample_model.psd` parsing. The happy path records `adapterName=synthetic-sample-model-profile-fixture`, an adapter diagnostic saying it follows header shape without fixture PSD bytes, and evidence `psdBytesFixture=false`. The unsupported fixture uses `synthetic-unsupported-layer-profile-fixture`.
- Rights/provenance metadata is present and clean. Both manifests and operation requests use `creator=contract-fixture`, `license=internal-test-fixture`, `redistributionAllowed=false`, and `aiUsed=false`. Expected summaries assert matching rights and provenance records after operation materialization.
- No PSD copy or binary asset was observed. The fixture tree contains only JSON files; the `.psd` and `.preview.png` strings are package-local metadata paths, not files under `fixtures/contracts/psd-*`.
- Parser-free and dependency boundaries pass. No dependency manifest or lockfile changes were found, and no external PSD/image parser dependency was added. Operation-core reads fixture JSON in the test, but it does not parse PSD bytes or decode images.
- Unsupported-layer evidence stays out of runtime-core. The unsupported summary asserts `drawableCount=0`, `containsSourceAssetIds=false`, `containsPsdProfile=false`, and `containsUnsupportedFeatureIds=false`; runtime-core has no PSD/source-profile matches.
- Source organization passes for Domain E. New authored logic is a focused contract fixture test file. There is no `index.ts` implementation logic, no `apps/editor/**` edit in Domain E, and no dependency/package manifest edit.

## Test Adequacy Review

Pass.

- The happy-path fixture test runs `importPsdSourceAsset`, `createDrawable`, and `generateMesh`, then compares exact expected validation report and a semantic summary. The summary includes operation statuses, operation target IDs, model diff paths, source manifest mapping, texture preview metadata, rights/provenance, and validation status.
- Happy-path fixture coverage is adequate for Domain E: adapter result maps to `psd-source-v1` / `layered-character-psd-profile-v1`, group/layer target parts, `layer_face_base` to `draw_psd_face_base`, `tex_psd_face_base`, texture preview metadata, provenance, rights, and final strict validation pass.
- Unsupported-layer fixture coverage is adequate for Domain E: import commits source metadata only, operation diagnostics include two `operation.importPsdSourceAsset.unsupportedFeature` checks, validator output includes two `asset.psd.unsupportedFeature` warnings with `SC-IN-003`, and runtime leakage summary remains false for PSD profile and unsupported feature IDs.
- Focused upstream operation and validator tests also passed with the fixture test, giving a meaningful integration check across Domain C materialization and Domain D diagnostics.

## Residual Risks

- The fixture uses metadata paths ending in `.psd` and `.preview.png` to exercise package-local references, but no corresponding bytes are included. This is truthful for Domain E and covered by manifest non-claims, but later package-file-set or persistence work must avoid interpreting these metadata paths as existing binary artifacts.
- Expected artifacts are exact JSON outputs from the current operation/validator behavior. If Domain C/D later change deterministic diagnostic flattening or validation report wording, these fixtures will need intentional contract review.
- `SourceManifest` still stores PSD structured details through string diagnostics and `unsupportedFeatures: string[]`. This was already accepted in Domain C/D; Domain E fixtures preserve that behavior rather than solving richer PSD source schema design.
- Current full `pnpm.cmd typecheck` passes. If parallel Domain F changes move again, any future editor typecheck failure should be treated as Domain F/integration scope unless it references the Domain E fixture/test paths.

## Files Changed By This Review

- `discussion/implementation/reviews/wave20/wave20-domain-e-review.md`

## Decision Points

None. No user or design decision is needed for the current Domain E scope.

## Domain Gate

Domain E can pass.
