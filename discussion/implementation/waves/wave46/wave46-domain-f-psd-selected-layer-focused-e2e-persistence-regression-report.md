# Wave46 Domain F Report: PSD Selected Layer Focused E2E / Persistence Regression

> Target: `wave46-psd-selected-layer-focused-e2e-persistence-regression`
> Date: 2026-06-05
> Role: Gnome implementation agent
> Review status: separate Review-Sylph review passed; Domain H final integration also passed

## Verdict

`pass`

Domain F strengthened the existing direct focused `psdImportFocused` e2e path so it now covers the Wave46 selected PSD layer intake path end to end: explicit browser PSD parse, selected `headwear` layer materialization, existing-part project intake, texture/drawable/part mapping evidence, browser-local save/load restore, and parser import boundary containment.

## Selected Layer Target

- Requested target: `headwear`.
- Target used: `psd:root/layer[0]`.
- Fallback: none.
- Evidence: `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` identifies `psd:root/layer[0]` as `headwear` with source path `headwear`, byteLength `460800`, and digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`.

## Files Changed

- `apps/editor/e2e/psd-import-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/focused-e2e-registry.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md`

No product implementation, package source, dependency, parser boundary, drag/drop/archive/filesystem, all-layer import, renderer/pixel oracle, Cubism, or public demo asset scope was edited.

## Implementation Summary

- Reused the existing standalone focused e2e id `psdImportFocused` instead of adding a new aggregate e2e entry.
- Extended `apps/editor/e2e/test-ids.mjs` with the Domain D selected-layer intake test IDs already present in Editor source.
- Extended `psd-import-focused-smoke.mjs` to:
  - parse `test_data/sample_model.psd` through the explicit browser PSD import flow;
  - select `psd:root/layer[0]` / `headwear`;
  - click `Add selected layer` with Domain D's default existing destination part `part_root`;
  - assert materialized digest, byteLength, mediaType, dimensions, texture evidence, drawable evidence, part destination, source PSD/source layer evidence, private/local provenance, and browser-local storage summary;
  - save and reload the project;
  - assert the explicit parser session is cleared after load;
  - assert `importPsdSourceAsset` and `importPsdLayerMaterialization` remain in the operation log;
  - assert the materialized drawable/texture mapping is present after load;
  - assert same-origin browser-local persistent bytes restored with one verified materialized binary asset;
  - assert no raw parser object, source PSD byte payload, raw/visual byte payload, or positive public demo asset claim is stored.
- Updated focused registry metadata for `psdImportFocused` so the purpose/tags truthfully include selected-layer intake while remaining standalone direct verification.
- Added narrow fixture/traceability markdown registration for `wave46-psd-selected-layer-focused-e2e-persistence-regression`.

## Boundary Assertions Added

- Source PSD bytes remain metadata-only in saved project state; no source PSD binary asset ref is persisted for the source asset.
- Materialized selected-layer bytes are referenced as private/local package texture binary asset metadata and restored through same-origin browser-local IndexedDB after digest/byteLength verification.
- Raw parser objects and browser parser session state are not persisted across project load.
- The saved project keeps `publicDemoAsset=false` provenance and avoids a positive public demo asset claim.
- Direct parser import remains guarded by `scripts/check-psd-parser-import-boundary.mjs`.

## Verification Performed

The local shell required sandbox escalation in this environment because normal managed-sandbox PowerShell process launch failed before commands ran.

- `node scripts/run-focused-e2e.mjs --id psdImportFocused` passed.
  - Output summary: `desktop passed byteLength=22406225 materializedBytes=460800 drawable=draw_headwear texture=tex_headwear`; `smoke passed`.
- `node scripts/check-psd-parser-import-boundary.mjs` passed.
  - Output summary: `5 direct import/resolve sites limited to approved adapter and Wave44 scripts`.
- `node scripts/check-focused-e2e-registry.mjs` passed.
  - Output summary: `20 entries, 14 aggregate-discoverable, 6 standalone direct`.
- `node --check apps/editor/e2e/psd-import-focused-smoke.mjs` passed.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd run check:deps` passed.
- `git diff --check` for touched files passed.

## Remaining Issues / User-Decision Points

- No user decision point is currently known.
- Independent Review-Sylph review is still pending by orchestration design.

## Provisional Assumptions

- Reusing `psdImportFocused` is preferred over creating a second standalone smoke because it avoids broad aggregate/runtime expansion and the existing test already owns `test_data/sample_model.psd` parser-boundary coverage.
- Existing destination part `part_root` is a valid Domain D-supported path for Wave46; no new part path is required for Domain F coverage.
