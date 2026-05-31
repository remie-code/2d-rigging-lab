# Wave 20 Domain E Completion

> Domain: `wave20-psd-fixtures-and-contract-evidence`
> Orchestrator: Orch-Sylph
> Status: `pass`

## Delegation

| Role | Context | Result |
|---|---|---|
| Gnome source implementation | `019e7ba0-4c29-7352-9806-003aec8041f5` / Gnome the 72nd | Added synthetic parser-free PSD adapter fixtures and focused contract tests. |
| Review-Sylph independent review | `019e7bad-56ec-77e3-b723-9fd910e7b323` / Sylph the 73rd | Reviewed basis docs, Domain A/C/D artifacts, fixtures, changed files, diff, and verification. Verdict `pass`. |

Orch-Sylph did not implement source changes. Source implementation and review were separated into distinct contexts.

## Changed Files

| File | Purpose |
|---|---|
| `fixtures/contracts/psd-import-happy-path/fixture-manifest.json` | Synthetic parser-free happy path fixture manifest and rights/provenance metadata. |
| `fixtures/contracts/psd-import-happy-path/baseline-package.json` | Baseline package for the happy path operation sequence. |
| `fixtures/contracts/psd-import-happy-path/request/import-psd-source-commit.request.json` | Adapter-result PSD import operation request. |
| `fixtures/contracts/psd-import-happy-path/request/create-drawable-commit.request.json` | Drawable creation request linked to the imported PSD source layer. |
| `fixtures/contracts/psd-import-happy-path/request/generate-mesh-commit.request.json` | Mesh generation request for the created drawable. |
| `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json` | Expected operation result, model diff, source manifest, texture preview, rights, provenance, and validation summary. |
| `fixtures/contracts/psd-import-happy-path/expected/validation-report.json` | Expected strict validation report for the happy path package state. |
| `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json` | Synthetic parser-free unsupported layer fixture manifest and rights/provenance metadata. |
| `fixtures/contracts/psd-unsupported-layer/baseline-package.json` | Baseline package for the unsupported layer operation sequence. |
| `fixtures/contracts/psd-unsupported-layer/request/import-psd-source-commit.request.json` | Adapter-result PSD import request containing unsupported feature metadata. |
| `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json` | Expected operation, validator, and runtime non-leakage evidence. |
| `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json` | Expected validation report with `asset.psd.unsupportedFeature` diagnostics. |
| `packages/operation-core/src/psd-import-contract-fixtures.test.ts` | Focused fixture contract tests for Domain E. |
| `discussion/implementation/reviews/wave20/wave20-domain-e-review.md` | Independent Review-Sylph report. |
| `discussion/implementation/waves/wave20/wave20-domain-e-completion.md` | This completion report. |

No dependency manifests, lockfiles, editor UI files, runtime-core files, PSD binaries, or parser/image dependencies were changed by Domain E.

## Implementation Summary

- Added `psd-import-happy-path` and `psd-unsupported-layer` contract fixtures under `fixtures/contracts/**`.
- The fixtures use synthetic adapter-result metadata only. They do not include PSD bytes, copied `test_data/sample_model.psd` bytes, raster extraction output, third-party image bytes, or parser-generated evidence.
- The happy path fixture fixes adapter result to source manifest, source layer, target part, drawable, texture ID, texture preview metadata, rights, provenance, operation result, model diff, and validation report evidence.
- The unsupported layer fixture fixes unsupported feature operation diagnostics and validator diagnostics while asserting PSD-specific unsupported metadata does not leak into runtime output.

## Verification

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts
```

Result: passed in Gnome and Review-Sylph runs, `1` file / `2` tests.

```powershell
pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/validator-core/src/psd-source-profile.test.ts
```

Result: parent sandbox run failed with `EPERM` reading pnpm-installed Vitest; escalated rerun passed, `3` files / `14` tests.

```powershell
pnpm.cmd typecheck
```

Result: parent sandbox run failed with `EPERM` reading pnpm-installed TypeScript; escalated rerun passed for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.

```powershell
git diff --check -- fixtures/contracts packages/operation-core packages/validator-core discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result: passed. Output contained only existing Git LF/CRLF working-copy warnings for tracked upstream files.

Additional checks:

- `rg --files fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer -g *.psd -g *.psb -g *.png -g *.jpg -g *.jpeg -g *.webp -g *.wasm`: no output.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json`: no output.
- Parser/image dependency keyword scan over Domain E fixtures and test: no parser/decode/raster dependency matches.
- `psdBytesIncluded` and `texturePreviewBytesIncluded` fixture metadata are explicitly `false`.

## Review Result

Review-Sylph verdict: `pass`.

No blocking findings and no non-blocking findings requiring a Domain E fix remain.

Confirmed review lanes:

- Evidence truthfulness: pass.
- Rights/provenance metadata: pass.
- No PSD copy or image binary fixture: pass.
- Parser-free boundary and dependency policy: pass.
- Happy path contract adequacy: pass.
- Unsupported-layer diagnostics and runtime non-leakage: pass.
- Source organization and write-scope compliance: pass.
- Test adequacy: pass.

Review report:

- `discussion/implementation/reviews/wave20/wave20-domain-e-review.md`

## Residual Risks

- The fixtures intentionally use metadata paths ending in `.psd` and `.preview.png` to exercise package-local references, but no corresponding bytes are included. Future package-file-set or persistence work must not treat those paths as binary artifacts.
- Expected JSON artifacts are contract evidence for current Domain C/D deterministic materialization and validator behavior. Any later change to diagnostic flattening or validation report wording should update these fixtures only through contract review.
- `SourceManifest` still persists richer PSD unsupported feature details through string diagnostics and `unsupportedFeatures: string[]`, matching the accepted Domain C/D behavior rather than solving a richer PSD schema.

## Next Domain Gate

Domain E can pass.

Domain G can proceed after Domain F also passes. Domain G should consume the Domain E fixtures as parser-free adapter-result evidence and must keep the GUI smoke path clear that no PSD file parsing, PSD byte import, or raster extraction is being claimed.
