# Wave44 Domain F Report: PSD Fixture Evidence / Node Regression

> Target: `wave44-psd-fixture-evidence-node-regression`
> Role: Gnome implementation agent
> Status: implemented

## Verdict

`pass`

Domain F added a deterministic Node regression wrapper for the private/local `test_data/sample_model.psd` selected-layer materialization evidence, connected the saved evidence JSON to validator-core/Product Preflight focused coverage, and registered the warning-gated fixture in fixture manifest and traceability markdown.

## Files Changed

- `scripts/wave44-psd-fixture-evidence-regression.mjs`
- `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md`

`test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` was regenerated during verification and remained the compact evidence JSON path; no raw visual bytes were added.

## Regression / Fixture Evidence

- Regression command:
  - `node scripts/wave44-psd-fixture-evidence-regression.mjs`
- The wrapper regenerates materialization evidence in memory by invoking `scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd`, compares it to the persisted evidence JSON, and asserts private/local boundary fields.
- Fixed evidence values:
  - source PSD byteLength `22406225`
  - source SHA-256 `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5`
  - selected layer `psd:root/layer[0]` / `headwear`
  - raw RGBA byteLength `460800`
  - raw RGBA SHA-256 `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`
  - `publicDemoAsset=false`
  - `derivedRasterBytesPersisted=false`
  - `bytesPersisted=false`
- The validator focused test reads the real evidence JSON, builds a minimal source profile around that selected layer, and asserts:
  - `asset.psd.parserEvidence`
  - `asset.psd.layerTreeEvidence`
  - `asset.psd.featureNotEvaluated`
  - `asset.psd.materializationEvidence`
  - Product Preflight `assetBytes` receives a `sourceMaterialization` ref and stays `warn` because full compositing remains not evaluated.

## Fixture / Traceability Registration

- Added warning-gated fixture `wave44-psd-materialization-regression` to `discussion/tests/fixtures/fixture-manifest.md`.
- Added Test ID `TC-WAVE44-PSD-MATERIALIZATION-REGRESSION-001` to `discussion/tests/traceability/test-traceability-matrix.md`.
- Kept JSON mirrors unchanged because the allowed scope named the markdown files only and existing warning-gated Wave registrations already use markdown-only registration.
- The fixture is explicitly private/local and not a public distributable demo asset.

## Verification Performed

| Command/check | Result |
|---|---|
| `pnpm.cmd smoke:wave44:psd-parser` | passed |
| `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd --out test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` | passed |
| `node scripts/wave44-psd-fixture-evidence-regression.mjs` | passed |
| `pnpm.cmd exec vitest run packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts` | passed after aligning the Product Preflight `sourceMaterialization` ref path with the existing generated-path contract |
| `pnpm.cmd typecheck` | passed |
| `pnpm.cmd run check:source` | passed |
| `pnpm.cmd run check:deps` | passed |
| `git diff --check -- scripts/wave44-psd-fixture-evidence-regression.mjs packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` | passed for tracked changed files; Git reported LF-to-CRLF working-copy warnings only |

## Boundary Confirmation

- Parser dependency use remains under `scripts/**`; the new validator test reads JSON evidence only and does not import or execute `@webtoon/psd`.
- No `package.json`, lockfile, dependency registry, production parser import, Editor UI, full compositing, renderer/pixel oracle, archive/filesystem behavior, PNG workflow expansion, or Cubism compatibility behavior was added by Domain F.
- Product Preflight is used as read-only report aggregation coverage. No persisted/exported Product Preflight artifact, release gate, or demo gate was added.

## Remaining Issues

- JSON mirrors for fixture manifest and traceability remain unchanged by scope.
- Future user decision is still required before any `test_data/sample_model.psd` derived visual or raw bytes are treated as public distributable demo material.

## User-Decision Points

- None for Domain F.
