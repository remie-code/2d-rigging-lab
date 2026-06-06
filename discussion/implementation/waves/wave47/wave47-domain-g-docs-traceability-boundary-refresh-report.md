# Wave47 Domain G Report: Docs / Traceability Boundary Refresh

> Target: `wave47-docs-traceability-boundary-refresh`
> Role: Gnome implementation/documentation update worker
> Verdict: `pass`

## Verdict

`pass`

Wave47 Domains A-F are treated as accepted upstream. This documentation refresh records the newly proven boundary as explicit PSD import -> explicit multi-leaf selection (`headwear`, `eyewear`, `tie / tie`) -> batch raw RGBA materialization -> private/local project asset intake -> generated texture/drawable/mesh/part scaffold evidence -> focused save/load/persistence boundary regression through `psdMultiLayerBatchFocused`.

This report and the updated docs do not claim all-layer PSD import, recursive group import, general PSD materialization beyond explicit selected leaf-layer paths, full compositing, renderer/pixel correctness, texture sampling correctness, Cubism compatibility, public demo asset status, drag-drop, archive/filesystem/File System Access API, repo-side AI repair, LLM/provider integration, natural-language repair, or auto-fix.

## Files Changed

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave47/wave47-domain-g-docs-traceability-boundary-refresh-report.md`

## Evidence Basis Used

- Wave47 Domain F focused e2e id: `psdMultiLayerBatchFocused`.
- Domain F selected leaf layers: `headwear`, `eyewear`, `tie / tie`; fallback: none.
- Domain F materialization evidence:
  - `headwear` / `psd:root/layer[0]`: digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`, byteLength `460800`.
  - `eyewear` / `psd:root/layer[3]`: digest `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708`, byteLength `116600`.
  - `tie / tie` / `psd:root/group[6]/layer[0]`: digest `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673`, byteLength `232960`.
- Domain F persistence evidence: total materialized byte length `810360`, batch id `batch_src_explicit_psd_sample_model_22406225_3`, destination parent `part_root`, destination kind `generatedPartScaffold`, private/local provenance, `publicDemoAsset=false`, and save/load reinspection with `3 restored / 3 checked`.
- Wave47 Domain A-F reports and A-F review reports under `discussion/implementation/waves/wave47/` and `discussion/implementation/reviews/wave47/`.
- Existing Domain F fixture/traceability registrations for `wave47-psd-multi-layer-focused-e2e-persistence-regression` and `TC-WAVE47-PSD-MULTI-LAYER-BATCH-E2E-001`.

## Updates Made

- `current-capability-map.md` now treats Wave47's explicit multi-leaf batch path as the current proven PSD intake boundary, adds a Wave47 surface section, and keeps unsupported future scope explicit.
- `remaining-work-backlog.md` removes Wave47 explicit multi-leaf batch intake from future/backlog wording and leaves future PSD work as all-layer import, recursive group import, broader/general PSD materialization beyond explicit selected leaf-layer paths, drag-drop, archive/filesystem, PNG workflow, full compositing, renderer/pixel oracle, and texture sampling correctness.
- `discussion/implementation/_map.md` and `discussion/implementation/orchestration/_map.md` now index Wave47 A-G pass / Domain G review-recorded status. Domain H final bookkeeping supersedes the original pre-final "no final integration pass claim" state.
- `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` were intentionally not edited because Domain F already added the Wave47 warning-gated fixture row and traceability row with the correct focused e2e id and boundary wording.

## Verification Performed

- `git diff --check -- discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md discussion/implementation/_map.md discussion/implementation/orchestration/_map.md discussion/implementation/waves/wave47/wave47-domain-g-docs-traceability-boundary-refresh-report.md`
  - Passed; no whitespace findings. Git emitted LF-to-CRLF working-copy normalization warnings for existing touched docs.
- Link/path existence sanity check for newly referenced Wave47 artifacts.
  - Passed; all newly referenced Wave47 plan/report/review paths exist after this report was added.
- Fixture/traceability registration check for `wave47-psd-multi-layer-focused-e2e-persistence-regression`, `TC-WAVE47-PSD-MULTI-LAYER-BATCH-E2E-001`, and `psdMultiLayerBatchFocused`.
  - Passed; registrations were present before Domain G edits and did not need adjustment.
- Forbidden-overclaim scan across newly added diff lines and touched docs.
  - Passed with only explicit unsupported/future/non-goal boundary mentions; no affirmative claims were introduced for all-layer import, recursive group import, full compositing, renderer/pixel correctness, Cubism compatibility, public demo asset status, drag-drop, archive/filesystem, or repo-side AI repair.

## Review Status

- Domain G Review-Sylph review is recorded as `pass` in `discussion/implementation/reviews/wave47/wave47-domain-g-docs-traceability-boundary-refresh-review.md`.

## Remaining Issues

- Wave47 final integration / clean integration review pass is recorded by Domain H at `discussion/implementation/waves/wave47/wave47-domain-h-integration-review-and-final-report.md` and `discussion/implementation/reviews/wave47/wave47-domain-h-clean-integration-review.md`.
- Fixture and traceability JSON mirrors remain unedited, matching the Domain F warning-gated markdown registration scope.

## User-Decision Points

None for Domain G.

Future decisions remain outside this domain: all-layer PSD import, recursive group import, broader/general PSD materialization, drag-drop/archive/filesystem, PNG workflow, full compositing, renderer/pixel oracle, public/demo asset policy, Cubism compatibility, and repo-side AI repair/LLM/provider scope.

## Intentionally Not Edited

- Source implementation files: forbidden by Domain G scope.
- `discussion/implementation/reviews/wave47/**`: owned by Review-Sylph.
- `discussion/tests/fixtures/fixture-manifest.md`: Domain F registration is already present and narrowly scoped.
- `discussion/tests/traceability/test-traceability-matrix.md`: Domain F traceability row is already present and narrowly scoped.
