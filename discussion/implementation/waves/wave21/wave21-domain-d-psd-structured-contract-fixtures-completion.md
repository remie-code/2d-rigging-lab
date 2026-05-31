# Wave 21 Domain D Completion: PSD Structured Contract Fixtures

## Status

pass

## Delegation

- Orch-Sylph: Domain D coordinator.
- Gnome implementation: not recorded in the original Domain D completion artifact; context id/name is not available from persisted Wave 21 artifacts.
- Review-Sylph: not recorded with context id/name in the original Domain D review artifact; review artifact is `discussion/implementation/reviews/wave21/wave21-domain-d-psd-structured-contract-fixtures-review.md`.
- Domain G artifact note: this delegation section was added during Domain G integration review to make the persisted evidence gap explicit. Domain G did not edit Domain D source, fixture, or test files.

## Review Result

Review-Sylph status: pass.

Findings: none at blocking, high, medium, or low severity.

Review confirmed:

- structured fixture persistence evidence is pinned for the happy path and unsupported-layer fixtures
- fixture truthfulness remains metadata-only with no PSD/image bytes, parser, decode, raster extraction, or binary storage claim
- rights/provenance and texture relation evidence are preserved
- Domain A/B/C structured contract support matches the fixture expectations
- source organization is acceptable for the focused fixture oracle test

Review artifact:

- `discussion/implementation/reviews/wave21/wave21-domain-d-psd-structured-contract-fixtures-review.md`

## Scope

Domain D updated the PSD contract fixtures and the focused operation fixture oracle:

- `fixtures/contracts/psd-import-happy-path/fixture-manifest.json`
- `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json`
- `fixtures/contracts/psd-import-happy-path/expected/validation-report.json`
- `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json`
- `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json`
- `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json`
- `packages/operation-core/src/psd-import-contract-fixtures.test.ts`

Existing Domain A/B/C workspace diffs were observed and left untouched.

## Fixture Evidence

- Happy path now pins persisted `sourceManifest.psdProfile` evidence, including adapter identity, canvas, groups, layer role, compatibility policy, adapter diagnostic, and texture preview references.
- Unsupported-layer now pins structured unsupported feature evidence in `sourceManifest.psdProfile.sourceLayers[].unsupportedFeatures[]`, including source refs, severity, rasterization candidacy, and manual-confirmation flags.
- Expected validation reports now assert structured diagnostics:
  - `asset.psd.adapterDiagnostic` for the happy path.
  - `asset.psd.unsupportedFeature` paths under `/assets/sourceManifest/sourceAssets/0/psdProfile/sourceLayers/...` for the unsupported fixture.
- Operation result summaries now include full operation diagnostics, not only check IDs.
- Texture relation evidence now cross-checks profile texture metadata against texture atlas and preview asset metadata.
- Fixture manifests now state that the fixtures do not include, parse, decode, rasterize, derive, or copy PSD/image bytes. Preview texture evidence remains metadata-only.

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts`
  - pass, 2 tests
- `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/validator-core/src/psd-source-profile.test.ts`
  - pass, 2 files / 17 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- fixtures/contracts packages/package-format packages/operation-core packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- `git status --short -uall -- fixtures/contracts`
  - only JSON fixture files are modified; no `.psd`, image, or `.wasm` fixture was added
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml ":(glob)**/package.json"`
  - pass; no dependency manifest or lockfile diffs

## Implementation Notes

The only non-fixture code change is the focused contract test oracle in `packages/operation-core/src/psd-import-contract-fixtures.test.ts`. It now summarizes structured `psdProfile` and texture relation evidence so the JSON fixtures act as exact acceptance oracles.

No operation-core, validator-core, package-format production behavior was changed by Domain D.

## Residual Risks

- The fixtures pin metadata-only texture preview references. They intentionally do not prove image bytes exist, decode, or render.
- The expected validation report uses the structured diagnostics emitted by current Domain C validator behavior. Future validator wording or evidence-order changes will require explicit fixture oracle updates.

## Downstream Gate

Domain D is pass from the fixture, test, and Review-Sylph artifact perspective. Domain F proceeded after Domain E also passed.
