# Wave 21 Domain D Review: PSD Structured Contract Fixtures

> Target: `wave21-psd-structured-contract-fixtures`
> Review agent: Review-Sylph
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain D artifacts:

- `fixtures/contracts/psd-import-happy-path/fixture-manifest.json`
- `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json`
- `fixtures/contracts/psd-import-happy-path/expected/validation-report.json`
- `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json`
- `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json`
- `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json`
- `packages/operation-core/src/psd-import-contract-fixtures.test.ts`
- `discussion/implementation/waves/wave21/wave21-domain-d-psd-structured-contract-fixtures-completion.md`

Prerequisite gate checked: Domain A/B/C completion and review reports are `pass`. I also checked the relevant A/B/C structured contract support in package-format, operation-core, and validator-core.

## Findings

| Severity | Finding | File / line | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Notes

Happy path structured persistence is pinned. The expected summary includes `sourceManifest.psdProfile` with adapter, canvas, groups, layer metadata, compatibility policy, adapter diagnostic evidence, and texture preview references at `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json:124`. The same summary pins source manifest, texture relation consistency, preview metadata, rights/provenance, and validation check IDs at `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json:96`, `:253`, `:267`, `:290`, and `:321`.

Unsupported-layer evidence is structured and AI-readable. The expected summary pins flattened compatibility feature IDs and structured `psdProfile.sourceLayers[].unsupportedFeatures[]` details at `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json:94`, `:100`, and `:151`. The expected validation report proves structured diagnostics against `psdProfile` target paths and includes unsupported feature ID, scope, severity, rasterize candidacy, manual-confirmation, source kind/id, and fallback evidence at `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json:22`, `:29`, `:51`, `:60`, `:62`, `:78`, `:85`, `:107`, and `:116`.

The focused fixture contract test is adequate for Domain D. It executes the fixture operation sequence, exact-compares generated validation reports, exact-compares generated evidence summaries, and includes source manifest, texture relation, preview metadata, rights/provenance, and unsupported runtime-leakage summaries at `packages/operation-core/src/psd-import-contract-fixtures.test.ts:32`, `:52`, `:55`, `:60`, `:74`, `:77`, `:151`, `:152`, `:154`, and `:349`.

The fixtures remain parser-free and metadata-only. Both fixture manifests explicitly state that they do not include, parse, decode, rasterize, derive, or copy PSD/image bytes at `fixtures/contracts/psd-import-happy-path/fixture-manifest.json:5` and `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json:5`. Their truthfulness blocks set `psdBytesIncluded`, `psdBytesParsed`, `imageBytesDecoded`, `rasterExtractionClaimed`, and `texturePreviewBytesIncluded` to false at `fixtures/contracts/psd-import-happy-path/fixture-manifest.json:26` and `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json:21`.

Rights/provenance truthfulness is clear. The manifests declare `rightsStatus=cleared`, `license=internal-test-fixture`, `redistributionAllowed=false`, and `aiUsed=false` at `fixtures/contracts/psd-import-happy-path/fixture-manifest.json:37` and `fixtures/contracts/psd-unsupported-layer/fixture-manifest.json:32`. The expected summaries pin matching rights/provenance records and metadata-only content hashes at `fixtures/contracts/psd-import-happy-path/expected/psd-import-happy-path-summary.json:290` and `fixtures/contracts/psd-unsupported-layer/expected/psd-unsupported-layer-summary.json:201`.

Domain A/B/C contract support matches the fixtures. Package-format exposes the structured profile schema and optional `sourceAsset.psdProfile` at `packages/package-format/src/source-manifest.ts:162` and `:182`. Operation-core materializes `psdProfile` from adapter results and preserves the compatibility policy at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:45`, `:138`, and `:211`. Validator-core emits structured unsupported feature and adapter diagnostic checks from `psdProfile` target paths at `packages/validator-core/src/validators/psd-source-profile-structured.ts:60`, `:285`, and `:365`.

Source organization is acceptable for Domain D. The only non-fixture source change is a focused fixture oracle test under operation-core. Existing operation-core tests already import package-format and validator-core test helpers through the same local package source pattern, so this is consistent with current contract-fixture practice.

## Scope Note

`git diff --name-only -- apps/editor` currently reports editor diffs under `apps/editor/**`. I did not attribute or review those as Domain D changes. They are outside the Domain D reviewed file list and should remain under Domain E / integration review ownership. Domain D-specific status showed only the six fixture JSON files and `packages/operation-core/src/psd-import-contract-fixtures.test.ts` modified, plus the Domain D completion report.

## Verification

| Check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts` | pass | 1 file / 2 tests passed. |
| `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/validator-core/src/psd-source-profile.test.ts` | pass | 2 files / 17 tests passed. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- fixtures/contracts packages/package-format packages/operation-core packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| `rg --files fixtures/contracts/psd-import-happy-path fixtures/contracts/psd-unsupported-layer` | pass | Listed JSON files only; no `.psd`, image, or `.wasm` fixture file. |
| `git status --short -uall -- *.psd *.png *.jpg *.jpeg *.webp *.wasm` | pass | No output. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml ":(glob)**/package.json"` | pass | No dependency manifest or lockfile diffs. |

## Residual Risks

- The happy-path texture preview is intentionally metadata-only. It proves relation consistency, not image existence, decode, or rendering.
- Fixture expected reports are exact oracles for the current Domain C wording/order. Future validator evidence wording or ordering changes will require explicit fixture oracle updates.
- Current workspace contains `apps/editor/**` diffs outside Domain D. They are not a Domain D blocker, but the Wave 21 integration gate should verify their Domain E ownership and review outcome.

## Verdict

Domain D can pass. From Domain D's side, Domain F can proceed after Domain E also passes.
