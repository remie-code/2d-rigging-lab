# Wave44 Domain H Clean Integration Review

> Target: `wave44-integration-review-and-final-report`
> Reviewer: Review-Sylph independent clean integration reviewer
> Date: 2026-06-05
> Artifact: `discussion/implementation/reviews/wave44/wave44-domain-h-clean-integration-review.md`

## Verdict

`pass`

No blocking integration findings were found. Wave44 satisfies the pass boundary for a scripts-only explicit-path PSD parser/materialization pilot: dependency/security/provenance evidence is recorded, `test_data/sample_model.psd` parser smoke and selected `headwear` materialization evidence pass, validator/Product Preflight handling is truthful, private/local fixture boundaries are preserved, unsupported scope is not claimed, and source/dependency guards pass.

This artifact is the independent clean integration review that Domain H correctly left delegated/pending before this file existed. After this pass, a narrow Gnome bookkeeping update is needed to link this review artifact and replace `clean integration review delegated/pending` wording with clean-review-recorded/pass wording.

## Scope Reviewed

- Wave44 plan and orchestration/review rules.
- Wave44 Domain A-G reports and independent reviews.
- Domain H integration bookkeeping/final verification report.
- Modified dependency, contract, package-format, operation-core, validator-core, script, evidence, fixture, traceability, map, and backlog files.
- Current working tree status and diff.
- Supplied Orch-Sylph final verification results, plus focused independent reruns listed below.

## Findings

### Blocking

None.

### Low / Non-Blocking Observations

- `pnpm-workspace.yaml:5` through `pnpm-workspace.yaml:7` records `GHSA-5xrq-8626-4rwp` under `auditConfig.ignoreCves`, but an independent raw `pnpm audit --audit-level moderate` still reports that advisory. I did not treat the workspace audit config as pass evidence. The pass is based on the raw audit being limited to the pre-existing Vitest advisory and the explicit ignored-baseline audit passing, matching Domain H's record at `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md:83` through `:84`.

## Integration Evidence

- A-G independent reviews are recorded as `pass` in Domain H's summary at `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md:52` through `:58`.
- Domain H explicitly did not claim this clean review before the artifact existed: `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md:13` and `:22` through `:23`.
- `@webtoon/psd@0.4.0` is a root devDependency with a scripts-only smoke command at `package.json:12` and `package.json:20`; the dependency registry records the Wave44 approved scope at `generated/dependencies/dependency-registry.json:28`.
- Parser imports are confined to Wave44 scripts: `scripts/wave44-psd-parser-smoke.mjs:6` and `scripts/wave44-psd-layer-materialization.mjs:6`. Package/app scans found only parser package-name strings in tests, not production imports.
- PSD/Product Preflight contracts include `sourceMaterialization` refs at `packages/contracts/src/product-preflight-report.ts:105` and `:213`; validator asset-byte requirements include that evidence kind at `packages/validator-core/src/product-preflight-report.ts:85`.
- Real PSD evidence is preserved without parser-private shapes through `packages/package-format/src/psd-source-evidence.ts:59`, `:87`, and `:138`, and the source manifest accepts real parse/materialization fields at `packages/package-format/src/source-manifest.ts:134` and `:197`.
- Validator diagnostics are wired through `packages/validator-core/src/validators/psd-source-profile-structured.ts:17` and `:86`, with catalog IDs for parser, layer tree, feature, and materialization evidence at `packages/validator-core/src/check-catalog.ts:652` through `:724`.
- The persisted evidence JSON records private/local, not-public-distributable status and no persisted raster bytes at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:5` through `:8`, with materialization digest/provenance/parser/options at `:40`, `:62` through `:70`, and `:81` through `:88`.
- Fixture and traceability docs record the warning-gated Wave44 regression and unsupported boundaries at `discussion/tests/fixtures/fixture-manifest.md:103` and `discussion/tests/traceability/test-traceability-matrix.md:97`.
- Capability/backlog docs keep unsupported scope explicit and do not promote Editor PSD UX, PNG workflow expansion, archive/filesystem, full compositing, renderer/pixel oracle, Cubism, public sample assets, or repo-side AI repair/LLM/auto-fix: see `discussion/implementation/current-capability-map.md:30`, `:60` through `:63`, and `discussion/implementation/remaining-work-backlog.md:27` through `:28`.

## Verification Performed

Independently reran:

- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd exec vitest run packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/package-format/src/source-manifest.test.ts packages/contracts/src/product-preflight-report.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts`: passed, 6 files / 47 tests.
- `pnpm.cmd smoke:wave44:psd-parser`: passed; confirmed `@webtoon/psd@0.4.0`, source byteLength `22406225`, source SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, document `2048x3072`, groupCount `20`, layerCount `126`, and selected `headwear` raw RGBA digest `671E6A363745B1CE2E8D29C1A63438170FE9511C8884EA42298CF9B8886E5C1A`.
- `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd`: passed without writing files; emitted the expected compact evidence JSON with `derivedRasterBytesPersisted=false`.
- `node scripts/wave44-psd-fixture-evidence-regression.mjs`: passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `git diff --check -- .`: passed with LF-to-CRLF working-copy warnings only.
- `pnpm.cmd audit --audit-level moderate`: failed only on pre-existing Vitest advisory `GHSA-5xrq-8626-4rwp`.
- `pnpm.cmd audit --audit-level moderate --ignore GHSA-5xrq-8626-4rwp`: passed.
- Parser mention scan: `rg -n '@webtoon/psd|ag-psd' packages apps` found only test evidence strings for `@webtoon/psd`; no `ag-psd` hits.
- Installed `node_modules/@webtoon/psd/package.json` inspection: version `0.4.0`, MIT, no runtime `dependencies` field.
- Installed `@webtoon/psd` binary-like file scan for `.wasm`, `.node`, `.exe`, `.dll`, `wasm`, and `binary`: no files found.
- Wave44 derived artifact scan found only `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`; no raw image/visual byte files were added under that derived Wave44 path.

Also reviewed the supplied Orch-Sylph final verification record, including full `pnpm test:unit`, rerun-passing `pnpm test:e2e`, source/dependency guards, Wave42/Wave43 guard checks, focused e2e registry checks, parser import scan, dependency inspection, and audit results.

## Residual Risks

- The first `pnpm test:e2e` run timed out after desktop smoke and passed on immediate rerun. I found no Wave44-specific causality, but this remains a residual e2e flake risk.
- Raw `pnpm audit --audit-level moderate` still reports the pre-existing Vitest advisory `GHSA-5xrq-8626-4rwp`; it is not attributable to `@webtoon/psd`.
- Wave44 proves one selected-layer raw RGBA materialization pilot. It does not prove general PSD materialization, Photoshop-style final compositing, renderer/pixel oracle, texture sampling correctness, Editor/browser PSD import UX, archive/filesystem behavior, public demo asset redistribution, Cubism compatibility, or repo-side AI repair/LLM/auto-fix.
- I did not rerun the full unit or e2e suites in this clean review; I relied on Orch-Sylph's recorded full-suite results and independently reran the focused Wave44 verification listed above.

## User-Decision Points

None required for Wave44 clean integration pass.

Future user decisions remain outside this pass:

- Choose the next product priority after Wave44: Editor/browser PSD UX, general PSD materialization, renderer/pixel oracle, archive/filesystem, advanced topology/UV, public/demo assets, or Cubism policy reconsideration.
- Decide separately before treating any private/local `test_data/sample_model.psd` derived visual bytes, screenshots, exports, or bundles as public distributable demo material.

## Post-Review Bookkeeping Needed

After this pass artifact exists, Gnome should perform a narrow bookkeeping update only:

- Link `discussion/implementation/reviews/wave44/wave44-domain-h-clean-integration-review.md`.
- Replace `clean integration review delegated/pending` wording in Domain H/maps/backlog with clean-review-recorded/pass wording.
- Avoid source, tests, dependency registry, package manifest, lockfile, scripts, evidence JSON, fixture docs, or traceability changes unless a new delegated review/fix loop explicitly authorizes them.

## Separation Confirmation

Review-Sylph/Gnome separation is confirmed. I performed this review independently from the Domain H Gnome report, grounded it in basis docs, diffs, changed files, evidence JSON, verification outputs, and direct repository inspection, and wrote only this allowed review artifact. I did not implement source fixes or edit source, tests, package manifests, lockfiles, generated dependency registry, scripts, evidence JSON, maps, backlog, fixture docs, or traceability docs.
