# Wave44 Domain F Review: PSD Fixture Evidence Node Regression

> Target: `wave44-psd-fixture-evidence-node-regression`
> Reviewer: Review-Sylph independent reviewer
> Reviewed report: `discussion/implementation/waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md`

## Verdict

`pass`

No blocking findings were found. Domain F freezes the Domain D selected-layer materialization evidence and Domain E validator/Product Preflight diagnostics as deterministic regression coverage while preserving the private/local fixture boundary for `test_data/sample_model.psd`.

## Findings

### Blocking findings

None.

### Non-blocking observations

- The focused validator regression is colocated under `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts` rather than `packages/**/__tests__/**`. This matches the repository's existing package test layout and the source organization policy does not forbid colocated responsibility tests. The source organization guard passed.
- `git diff --check` only covers tracked modified files. The new/untracked Domain F script, test, report, and evidence JSON were checked separately with a trailing-whitespace search.

## Scope Reviewed

- `scripts/wave44-psd-fixture-evidence-regression.mjs`
- `scripts/wave44-psd-layer-materialization.mjs`
- `scripts/wave44-psd-parser-smoke.mjs`
- `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
- `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md`
- Domain A-E Wave44 reports/reviews relevant to dependency scope, materialization evidence, and validator/Product Preflight diagnostics.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave44-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Design / Development Compliance Review

- Determinism is adequately pinned. The regression wrapper invokes `scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd`, parses stdout, asserts fixture-boundary fields, and compares stable serialized JSON against the persisted evidence at `scripts/wave44-psd-fixture-evidence-regression.mjs:34` through `scripts/wave44-psd-fixture-evidence-regression.mjs:141`.
- The persisted evidence remains compact metadata only. It marks `privateLocalFixture`, `notPublicDistributable`, `publicDemoAsset: false`, and `derivedRasterBytesPersisted: false` at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:4` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:9`.
- The evidence records source and materialized byte lengths/digests, source layer reference, parser identity, and extraction options, but it does not persist raw RGBA, visual bytes, data URLs, or base64 payloads. The regression explicitly rejects those fields at `scripts/wave44-psd-fixture-evidence-regression.mjs:119` through `scripts/wave44-psd-fixture-evidence-regression.mjs:126`.
- Unsupported boundaries are truthful: Photoshop-style final compositing, renderer pixel oracle, and texture sampling correctness stay `notEvaluated`, and public demo distribution stays `notSupported` at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:94` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:99`.
- Parser dependency scope remains scripts-only. Direct `@webtoon/psd` imports are in `scripts/wave44-psd-parser-smoke.mjs` and `scripts/wave44-psd-layer-materialization.mjs`; searches under `packages apps` found only evidence strings in tests, not parser imports.
- Dependency registry scope remains `dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo` for `@webtoon/psd@0.4.0` at `generated/dependencies/dependency-registry.json:28` through `generated/dependencies/dependency-registry.json:33`.
- Fixture manifest registration is narrow and warning-gated. `wave44-psd-materialization-regression` states private/local evidence only, no raw visual bytes, no public demo asset, and no full compositing/renderer/pixel/archive/UI/PNG/Cubism oracle at `discussion/tests/fixtures/fixture-manifest.md:103`.
- Traceability registration is likewise warning-gated and points to the evidence JSON, regression script, and focused validator test without promoting this fixture to MVP-blocking acceptance coverage at `discussion/tests/traceability/test-traceability-matrix.md:97` and `discussion/tests/traceability/test-traceability-matrix.md:287`.
- No Domain F package manifest, lockfile, Editor UI, archive/filesystem, PNG workflow expansion, renderer/pixel oracle, Cubism compatibility, public demo asset, or Product Preflight persisted/exported artifact changes were found.

## Test Adequacy Review

- The Node regression proves the persisted Domain D evidence still matches actual materialization from `test_data/sample_model.psd`.
- The focused validator test reads the real evidence JSON, validates it through `PsdLayerMaterializationEvidenceSchema`, builds a `SourceManifest`, checks Domain E PSD diagnostics, and verifies Product Preflight `sourceMaterialization` aggregation at `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts:36` through `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts:141`.
- The validator test asserts digest formatting for both derived raster and source PSD evidence at `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts:70` through `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts:80`, covering the Domain E digest regression risk.
- Product Preflight coverage is read-only aggregation coverage. It does not create a persisted/exported preflight artifact, release gate, or demo gate.
- Broader suite coverage was not rerun in this Domain F review. Given the focused domain scope, passing typecheck, source guard, dependency guard, parser smoke, materialization command, node regression, and focused Vitest is sufficient for the Domain F risk.

## Verification Performed

- `git status --short -uall`: observed Wave44-wide uncommitted changes; treated non-Domain-F files as parallel/prior-domain work.
- `pnpm.cmd smoke:wave44:psd-parser`: passed. It emitted parser `@webtoon/psd@0.4.0`, source byteLength `22406225`, source SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, document `2048x3072`, groupCount `20`, layerCount `126`, and selected-layer raw RGBA digest `671E6A363745B1CE2E8D29C1A63438170FE9511C8884EA42298CF9B8886E5C1A`.
- `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd`: passed without writing files; emitted compact evidence JSON.
- `node scripts/wave44-psd-fixture-evidence-regression.mjs`: passed.
- `pnpm.cmd exec vitest run packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`: passed, 1 test.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- Parser import searches under `packages apps`: no direct `@webtoon/psd`, `ag-psd`, or `psd` parser imports were found; `@webtoon/psd` appears only as evidence strings in package tests.
- `git diff --check -- discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`: no whitespace findings; Git reported LF-to-CRLF working-copy warnings.
- `rg -n "[ \t]+$"` on new/untracked Domain F script, test, report, and evidence JSON: no matches.
- `Get-ChildItem test_data/derived/wave44/psd-layer-materialization`: only `headwear.raw-rgba.materialization-evidence.json` was present; no raw RGBA or visual byte file was persisted.

## Orchestration Compliance

Gnome/Review-Sylph separation is satisfied for this gate. The Domain F report identifies the implementer role as Gnome at `discussion/implementation/waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md:4` through `discussion/implementation/waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md:5`. This review was performed in a separate Review-Sylph context, inspected basis documents and changed files directly, and did not edit implementation/source/test/docs files.

## Remaining Issues

- `test_data/sample_model.psd` and its derived evidence remain private/local fixture material only.
- The current regression covers one selected layer (`headwear`) and metadata/digest evidence. It does not prove general PSD materialization, Photoshop-style full compositing, renderer output, texture sampling correctness, Editor UI intake, archive/filesystem behavior, PNG workflow expansion, or Cubism compatibility.
- The known baseline `vitest` advisory noted by Domain B remains outside Domain F's scope.

## User-Decision Points

- A future user decision and separate rights/provenance review remain required before any `test_data/sample_model.psd` derived visual bytes, screenshots, exports, or public sample/demo bundles are treated as public distributable demo material.
