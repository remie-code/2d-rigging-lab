# Wave48 Domain G Report: Docs / Traceability Boundary Refresh

> Target: `wave48-docs-traceability-boundary-refresh`
> Role: Gnome documentation updater
> Verdict candidate: `pass`

## Verdict

verdict: `pass`

Domain G synchronized the documentation and traceability surfaces with Wave48 Domains A-F implementation / Review-Sylph `pass` evidence. The reflected scope is limited to explicit PSD import session -> `psd:root` / group import-plan candidate preview -> explicit eligible leaf approval -> approved-leaf-only batch intake through the existing Wave47 path -> import-plan diagnostics -> focused save/load/portable/parser-boundary regression through `psdImportPlanFocused`.

Wave48 is not marked final complete. Domain H final verification / integration bookkeeping and clean integration review remain pending.

## Files Changed

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave48/wave48-domain-g-docs-traceability-boundary-refresh-report.md`

## Evidence Basis Used

- Wave48 Domain A report/review: `psd:root` target, `126` candidates, `121` visible eligible leaves, `5` hidden leaves, explicit approved subset `headwear`, `eyewear`, `tie / tie`, and no all-layer / recursive group auto import scope.
- Wave48 Domain B report/review: browser candidate service for `psd:root` / group refs, recursive leaf enumeration, parser-free candidate plan after browser parse, statuses/reasons, digest, byte estimates, generated scaffold preview, and default `notApproved`.
- Wave48 Domain C report/review: parser-free package/operation import-plan approval bridge, candidate/approval digests, source identity, approved refs/order, destination parent, not-approved/blocked candidates, generated scaffold preview/resolved IDs, preflight before mutation, and approved-leaf-only batch execution.
- Wave48 Domain D report/review: Editor import-plan preview, eligible leaf approve/unapprove controls, approved-leaf-only execution, and stale approval controls requiring preview regeneration before execution.
- Wave48 Domain E report/review: import-plan bridge mismatch, blocked/not-approved/unsupported/hidden/empty/byte-cap/collision/partial/stale-source/current-byte-missing/private-local provenance diagnostics, with truthful `not_evaluated` when source bytes are absent.
- Wave48 Domain F report/review: `psdImportPlanFocused`, `test_data/sample_model.psd`, `psd:root`, `126` candidates, explicit approval of `headwear`, `eyewear`, `tie / tie`, approved-leaf-only batch execution, save/load/portable boundary, parser boundary, and non-persistence of source PSD bytes, raw parser objects, and session import-plan bridge capability. Existing focused ids `psdImportFocused` and `psdMultiLayerBatchFocused` also pass in Domain F evidence.

## Updates Made

- `current-capability-map.md` now records Wave48 Domains A-F pass evidence while keeping Wave47 as the latest final baseline and explicitly marking Wave48 final status as pending Domain H.
- `remaining-work-backlog.md` removes root/group import-plan preview plus explicit approved leaf intake from remaining PSD blockers, while keeping all-layer one-click import, recursive group auto import, group-as-artmesh import, drag/drop/filesystem/archive intake, renderer/pixel/compositing parity, Cubism export/runtime, public demo asset, and repo-side AI/LLM/autofix as future or non-goal scope.
- Implementation maps now index Wave48 A-F pass evidence and Domain G report without creating or claiming Domain G/H review artifacts.
- Fixture and traceability Markdown rows now include `126` candidates, canonical media type `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`, approved-leaf-only execution, portable boundary, and source PSD/raw parser/session bridge non-persistence wording.
- Traceability Markdown coverage summaries now include `TC-WAVE48-PSD-IMPORT-PLAN-E2E-001` for the relevant warning-gated MVP AC, rights AC, GUI semantic state, and fixtures-contract coverage views. JSON mirrors were intentionally not edited.

## Boundary Kept Explicit

This refresh does not claim:

- all-layer one-click import
- recursive group auto import
- group-as-artmesh import
- drag/drop/filesystem/archive intake
- renderer/pixel/compositing parity
- Cubism SDK/export/runtime integration
- public demo asset availability
- repo-side AI/LLM/autofix
- persisted source PSD bytes, raw parser objects, or session import-plan bridge capability
- Wave48 final complete / final pass

## Verification Performed

- `git diff --check -- discussion/implementation discussion/tests`
  - Passed before and after this report was written; Git emitted LF-to-CRLF working-copy normalization warnings only.
- `node scripts/check-focused-e2e-registry.mjs`
  - Passed: `22` entries, `14` aggregate-discoverable, `8` standalone direct.
- `rg --files scripts | rg "(fixture|trace|markdown|focused-e2e|psd-parser-import-boundary)"`
  - Found the narrow relevant registry/parser-boundary checks. `check-focused-e2e-registry.mjs` was run for this docs/traceability update; broad source/e2e suites were intentionally not run.
- `rg -n "Wave48 final complete|Wave48 final pass|final complete / final pass|Domain H final|not final|final未記録" ...`
  - Matches show Wave48 final is pending/not marked final, with historical final wording only for earlier waves.
- `rg -n "all-layer|recursive group|group-as-artmesh|drag/drop|drag-drop|filesystem|archive|renderer/pixel|compositing oracle|Cubism|public demo|repo-side AI|LLM|autofix|source PSD bytes|raw parser" ...`
  - Matches are explicit unsupported, future-scope, non-goal, or non-persistence boundary wording. No positive unsupported Wave48 capability claim was introduced.
- `rg -n "psdImportPlanFocused|TC-WAVE48-PSD-IMPORT-PLAN-E2E-001|wave48-psd-import-plan-focused-e2e-persistence-regression|126|application/vnd.ai-native-live2d.raw-rgba|psdImportFocused|psdMultiLayerBatchFocused" ...`
  - Required focused ids, Wave48 fixture/test id, candidate count, canonical raw RGBA media type, and preserved existing PSD focused ids are present.
- `rg -n "not_evaluated|candidate/approval digest|blocked/not-approved|unsupported/hidden/empty|byte-cap|collision|partial|stale-source|current-byte-missing|private-local provenance|metadataOnlyNoRawBytes|session import-plan bridge" ...`
  - Required diagnostics/provenance/non-persistence tokens are present in the updated docs.

## Remaining Issues / Risks

- Wave48 Domain H final verification / clean integration review is still pending and must run before Wave48 is marked final complete.
- Fixture and traceability JSON mirrors were not edited, matching the warning-gated Markdown registration pattern and the allowed write scope.
- Broad source test suites were not run by Domain G because this task is docs/traceability-only and the instruction limited verification to docs checks plus narrowly relevant registry/check scripts.

## User-Decision Points

None for Domain G.

Future decisions remain outside this domain: all-layer one-click import, recursive group auto import, group-as-artmesh import, drag/drop/filesystem/archive intake, renderer/pixel/compositing oracle, public/demo asset policy, Cubism compatibility, and repo-side AI/LLM/autofix scope.
