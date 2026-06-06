# Wave48 Domain F Review: PSD Import Plan Focused E2E / Persistence Regression

> Reviewer: Review-Sylph
> Target: `wave48-psd-import-plan-focused-e2e-persistence-regression`
> Artifact: `discussion/implementation/reviews/wave48/wave48-domain-f-psd-import-plan-focused-e2e-persistence-regression-review.md`

## Verdict

verdict: `pass`

No blocking findings.

Domain F stays within the focused e2e / test-id mirror / focused registry / docs / report scope. The new regression covers the approved Domain A target `psd:root` and explicitly approved leaf subset only:

- `headwear` / `psd:root/layer[0]`
- `eyewear` / `psd:root/layer[3]`
- `tie / tie` / `psd:root/group[6]/layer[0]`

## Reviewed Files

- `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/focused-e2e-registry.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave48/wave48-domain-f-psd-import-plan-focused-e2e-persistence-regression-report.md`
- Comparators: `apps/editor/e2e/psd-import-focused-smoke.mjs`, `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`, `scripts/check-psd-parser-import-boundary.mjs`, `scripts/check-focused-e2e-registry.mjs`

## Design / Development Compliance Review

Pass.

- Domain F does not introduce `packages/**` work. The working tree contains accepted upstream A-E package edits, but the Domain F file set and report are limited to e2e/test-id registry/docs/report files.
- `apps/editor/e2e/test-ids.mjs` only mirrors existing product test IDs for import-plan controls; it does not change product behavior.
- `scripts/focused-e2e-registry.mjs` adds `psdImportPlanFocused` through a post-Wave42 overlay, leaves `scripts/wave42-focused-e2e-boundary.mjs` untouched, marks the entry `standaloneDirectVerification`, and keeps `executionCoverageClaim: "noneUntilExactCommandRuns"`.
- The registry guard remains truthful: it reports 22 entries, 14 aggregate-discoverable, 8 standalone direct, and `productCapabilityAdded: false`.
- No new public demo asset, archive/filesystem/drag-drop route, renderer/pixel/compositing oracle, Cubism dependency, all-layer one-click import, recursive group auto import, or group import capability is added by Domain F.

Non-blocking note: `discussion/tests/traceability/test-traceability-matrix.md` adds the Wave48 row and warning-fixture reference, but the derived AC/module coverage summary tables still list Wave47 as the latest PSD focused e2e coverage. The file explicitly says warning-gated markdown registrations do not require JSON mirror or Acceptance Runner registration, so I do not treat this as a blocker for Domain F.

## Test Adequacy Review

Pass.

The new e2e is focused but materially checks the intended path:

- Browser workflow reaches the explicit PSD import panel and import-plan controls.
- It uploads `test_data/sample_model.psd`, waits for browser parse evidence, and checks parser/runtime/source facts.
- It submits root scope `psd:root` and approved refs equal to the three accepted Domain A leaf refs.
- It asserts preview facts: 126 candidates, 121 eligible, 3 approved, 123 not-approved, 5 hidden/unsupported, source digest, parser identity, and private/local provenance.
- It commits the approved batch and checks generated part/drawable/mesh/texture IDs and byte/digest evidence for only the approved leaves.
- It saves, reloads, exports a portable JSON bundle, resets, imports the bundle, and rechecks generated project state.
- It validates fixture manifest and traceability tokens from inside the e2e before running the browser flow.

The test remains desktop-only, matching the existing PSD focused smoke style.

## Parser Boundary And Persistence Verification

Pass.

Parser boundary:

- The e2e itself has no direct `@webtoon/psd` import; it exercises parsing through the existing browser UI/import adapter path.
- `scripts/check-psd-parser-import-boundary.mjs` scans `apps/**`, `packages/**`, and `scripts/**`, rejects any `packages/**` direct parser import, and passed with the 5 approved direct import/resolve sites only.

Persistence and non-persistence:

- Saved project checks inspect localStorage, package file set, operation log JSONL, source manifest, graph, drawables, meshes, and texture atlas.
- The assertions require source PSD `binaryAssetRef` to be absent, raw parser persistence to be `notPersisted`, source PSD byte persistence to be `metadataOnlyNoRawBytes`, materialized bytes to be binary-asset refs, and `publicDemoAsset=false`.
- The import-plan bridge evidence is checked for candidate plan digest, source digest/byteLength, approved count, blocked/not-approved separation, `onlyApprovedLeafRefsPassedToBatch`, and no leakage of approved refs into not-approved/blocked sets.
- Reload checks require session-only PSD import/import-plan UI evidence to be cleared while generated project assets restore from browser-local verified bytes.
- Portable bundle checks require exactly three materialized texture payloads, no source PSD binary payload, no import-plan bridge session evidence as portable package capability, and no raw/parser/source byte claim tokens.

## Existing Focused E2E IDs

Pass.

The new overlay does not regress registry resolution for existing PSD focused ids.

- `psdImportFocused` remains in the Wave42 boundary and resolves through `scripts/run-focused-e2e.mjs --id psdImportFocused --dry-run`.
- `psdMultiLayerBatchFocused` remains in the Wave42 boundary and resolves through `scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused --dry-run`.
- `psdImportPlanFocused` resolves through the new overlay with command `node apps/editor/e2e/psd-import-plan-focused-smoke.mjs`.
- I accepted the Orch escalated browser e2e pass results as runtime evidence for the three PSD focused ids; independently rerunning full browser e2e in this review was not necessary beyond the sandbox-safe registry/dry-run checks.

## Checks Run

| Check | Result |
|---|---|
| `node --check apps/editor/e2e/psd-import-plan-focused-smoke.mjs` | pass |
| `node scripts/check-focused-e2e-registry.mjs` | pass: 22 entries, 14 aggregate-discoverable, 8 standalone direct |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass: 5 approved direct import/resolve sites |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused --dry-run` | pass: resolves to `node apps/editor/e2e/psd-import-plan-focused-smoke.mjs` |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused --dry-run` | pass |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused --dry-run` | pass |
| `git diff --check -- apps/editor/e2e scripts/focused-e2e-registry.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave48/wave48-domain-f-psd-import-plan-focused-e2e-persistence-regression-report.md` | pass with LF-to-CRLF warnings only |
| trailing whitespace scan on new untracked e2e/report | pass |

## Final Assessment

Domain F satisfies the requested focused e2e / persistence / parser-boundary regression review. The implementation adds no product capability by itself, keeps registry truthfulness intact through a post-Wave42 overlay, and verifies the parser and byte persistence claims through concrete browser/project/package assertions.
