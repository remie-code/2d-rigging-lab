# Wave44 Domain D Review: PSD Raster Layer Materialization Pilot

> Target: `wave44-psd-raster-layer-materialization-pilot`
> Reviewer: Review-Sylph independent reviewer
> Reviewed report: `discussion/implementation/waves/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-report.md`
> Verdict: `pass`

## Verdict

`pass`

Domain D satisfies the Node-first pilot scope. It materializes one selected layer raster from `test_data/sample_model.psd`, records compact private/local evidence, keeps the direct PSD parser dependency in `scripts/**`, and does not claim Photoshop final compositing, renderer/pixel oracle behavior, texture sampling correctness, public demo distribution, Editor file picker/drag-drop, PNG workflow expansion, or validator/Product Preflight diagnostics.

## Findings

No blocking findings.

## Design / Development Compliance

- PSD input direction is respected. The materialization script requires an explicit `--psd` path at `scripts/wave44-psd-layer-materialization.mjs:33` through `scripts/wave44-psd-layer-materialization.mjs:65`, reads `test_data/sample_model.psd`, and does not expand PNG image-set workflow or Editor intake UI.
- Dependency boundary is respected. The direct `@webtoon/psd` import is in the script-only workflow at `scripts/wave44-psd-layer-materialization.mjs:6`. Fixed-string scans under `packages apps` for `from "@webtoon/psd"`, `import("@webtoon/psd")`, `from "ag-psd"`, and `import("ag-psd")` returned no matches.
- Evidence is parser-free enough for the Domain C boundary. The persisted JSON contains parser identity/version and `privateShapePolicy`, but no raw parser layer object, at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:67` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:76`.
- Privacy/provenance is explicit. The evidence marks the fixture `privateLocalFixture`, `notPublicDistributable`, `publicDemoAsset: false`, and `derivedRasterBytesPersisted: false` at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:4` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:9`.
- Source and derived raster evidence include the required source hash/length/media type, source layer reference, materialization media type, byteLength, digest, parser version, and extraction options at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:10` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:93`.
- Unsupported boundaries are truthful. The evidence keeps Photoshop-style final compositing, renderer pixel oracle, and texture sampling correctness as `notEvaluated`, and public demo distribution as `notSupported`, at `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:94` through `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json:99`.

## Test Adequacy

- The script asserts the expected source byteLength and SHA-256 before parsing at `scripts/wave44-psd-layer-materialization.mjs:129` through `scripts/wave44-psd-layer-materialization.mjs:147`.
- It asserts the pilot layer ref/name and raw RGBA byteLength/SHA-256 before emitting evidence at `scripts/wave44-psd-layer-materialization.mjs:149` through `scripts/wave44-psd-layer-materialization.mjs:179`.
- It records `Layer.composite(false, false)` and extraction options without persisting raw bytes at `scripts/wave44-psd-layer-materialization.mjs:260` through `scripts/wave44-psd-layer-materialization.mjs:275`.
- Review reran the materialization script without `--out`; it passed and emitted the same source digest `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5`, materialization byteLength `460800`, and raw RGBA digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`.
- Review also checked non-writing failure paths: missing layer ref `psd:root/layer[999]` fails with `Unable to find selected PSD layer`, and unsupported pilot layer ref `psd:root/layer[1]` fails with the expected pilot-layer/digest mismatch.

The executable smoke is adequate for this Node-first pilot. A CI-registered Domain D regression remains appropriate for later Domain F fixture/evidence regression work.

## Verification Reviewed / Performed

- Read the Domain D script, persisted evidence JSON, and Domain D implementation report directly.
- Read Wave44 plan excerpts, dependency/source organization policy excerpts, fixture manifest excerpts, Domain A/B/C reports, Domain B/C reviews, and `scripts/wave44-psd-parser-smoke.mjs` excerpts.
- Ran `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd`: passed without writing files.
- Ran missing/unsupported layer-ref negative checks described above: both failed clearly without writing files.
- Ran direct parser import scans under `packages apps`: no `@webtoon/psd` or `ag-psd` direct imports found.
- Listed `test_data/derived/wave44/psd-layer-materialization`: only `headwear.raw-rgba.materialization-evidence.json` is present; no raw RGBA or visual byte artifact is persisted.
- Ran `pnpm.cmd smoke:wave44:psd-parser`: passed, with Domain B raster extraction digest matching Domain D.
- Ran `pnpm.cmd typecheck`: passed in the current working tree.
- Ran `pnpm.cmd run check:source`: passed.
- Ran `pnpm.cmd run check:deps`: passed.

## Typecheck Relevance

The earlier Orch-Sylph observation that `pnpm.cmd typecheck` failed appears external to Domain D. Domain D changed only the Node script, compact evidence JSON, and its report; it did not edit TypeScript source. In this review context, `pnpm.cmd typecheck` now passes.

## Residual Risks

- Domain D evidence is a pilot over one selected layer, not a general PSD materialization implementation.
- The materialization script is not yet registered as a dedicated package script or CI regression. Domain F is the natural owner for broader fixture/evidence regression registration.
- Raw visual bytes remain private/local only if ever generated; none are persisted by Domain D.

## User-Decision Points

- None required for Domain D to pass.
- A future user decision and rights/provenance review remain required before any `test_data/sample_model.psd` derived visual or raw bytes are treated as public distributable demo material.

## Separation Statement

Gnome/Review-Sylph separation is satisfied. This review was performed in a separate Review-Sylph context, inspected changed files and basis documents directly, performed independent verification, and did not edit implementation/source/test files.
