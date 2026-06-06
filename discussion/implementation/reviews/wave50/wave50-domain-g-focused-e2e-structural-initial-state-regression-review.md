# Wave50 Domain G Review: Focused E2E Structural Initial State Regression

> Target: `wave50-focused-e2e-structural-initial-state-regression`
> Role: clean Review-Sylph
> Verdict: `pass`
> Reviewed: 2026-06-07

## Verdict

`pass`

No blocking findings. Fixes required: no.

Domain G stays within the Wave50 G scope: it adds the focused structural e2e and focused registry/traceability registration only. I found no product implementation beyond regression hooks, no aggregate e2e runtime broadening, and no unsupported capability claim in the changed Domain G files.

## Findings

No blocking findings.

Non-blocking notes:

- Structural-specific stale execute/rejection is not available in Wave50. Domain G records this limitation truthfully and preserves stale rejection via the existing `psdImportPlanCodexFocused` leaf import-plan path. I reran that focused ID and observed `staleContext=rejected`.
- I could not find a local Domain G Gnome completion report artifact under `discussion/implementation/waves/wave50/`. Therefore I cannot fully verify Domain G Gnome/Orch-Sylph separation from repository artifacts alone. This clean review was executed separately from implementation, and I did not edit source or test implementation.

## Basis Reviewed

- `.github/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- Domain A-F completion reports under `discussion/implementation/waves/wave50/`
- Domain A-F reviews under `discussion/implementation/reviews/wave50/`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Target changed files listed in the Domain G review assignment.

## Scope Review

Pass.

- The Domain G target diff is limited to `apps/editor/e2e/test-ids.mjs`, the new `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`, `scripts/focused-e2e-registry.mjs`, `scripts/wave42-focused-e2e-boundary.mjs`, and the fixture/traceability Markdown files.
- `apps/editor/e2e/test-ids.mjs:64` through `apps/editor/e2e/test-ids.mjs:75` adds test IDs for the already-implemented structural scaffold UI surfaces.
- `scripts/focused-e2e-registry.mjs:127` through `scripts/focused-e2e-registry.mjs:131` registers `psdStructuralInitialStateFocused` as `standaloneDirectVerification`; it does not add it to the editor aggregate.
- `scripts/wave42-focused-e2e-boundary.mjs:34` through `scripts/wave42-focused-e2e-boundary.mjs:39` mirrors the new post-Wave42 focused boundary entry.
- Existing PSD focused IDs remain present: `psdImportFocused`, `psdImportPlanFocused`, `psdImportPlanCodexFocused`, and `psdMultiLayerBatchFocused` are preserved in registry/boundary metadata.

## E2E Adequacy Review

Adequate for Domain G pass.

- End-to-end flow: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:158` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:227` drives parse, structural preview, approval, commit, save/load, and Codex-facing projection.
- Approved sample coverage: constants at `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:46` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:61` prove four approved leaves with out-of-order approval input and expected sourceOrder-derived refs.
- Structural preview: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:321` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:395` asserts group/leaf counts, generated group parts/drawables, hidden runtime-hidden count, group container rows, leaf generated drawable/texture/mesh refs, parent refs, runtime visible/hidden labels, and sourceOrder row order.
- Commit result: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:402` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:437` asserts successful structural commit, generated group/drawable counts, runtime-hidden count, leaf refs, parent refs, and sourceOrder in result rows.
- Save/load persistence: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:445` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:722` inspects the saved project package, operation log, source manifest, graph parts, drawables, meshes, texture refs, private/local materialization refs, runtime visibility, no source PSD byte persistence, and structural operation evidence.
- Loaded UI state: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:722` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:758` asserts generated group rows, drawable rows, texture resolution, visible leaf `Runtime visible` labels, hidden headwear `Runtime hidden`, and restored private/local texture binary refs.
- Group-as-container-only: saved evidence rejects group drawable/texture/mesh claims at `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:648` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:652`.
- Codex-facing projection: `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:774` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:1044` uses `getPsdImportPlanState` and asserts structural refs, group refs, leaf refs, generated IDs, sourceOrder, runtime visibility, latest committed refs, save/load persistence, and transcript shape.
- Fixture/traceability registration is self-checked by `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:1433` through `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs:1462`.

## Documentation Review

Pass.

- `discussion/tests/fixtures/fixture-manifest.md:69` registers Wave50 as warning-gated Markdown evidence only, explicitly says JSON mirrors are intentionally unchanged, records `publicDemoAsset=false`, and avoids public demo capability claims.
- `discussion/tests/fixtures/fixture-manifest.md:113` records the new fixture row with structural scope, sourceOrder, group containers, visible/hidden runtime rows, Codex projection, stale limitation through `psdImportPlanCodexFocused`, no source PSD byte/raw parser persistence, and forbidden non-goals.
- `discussion/tests/traceability/test-traceability-matrix.md:78` states the Wave50 proof note and explicitly says it does not add JSON mirror coverage, aggregate e2e coverage, external transport, proposal generation, semantic recognition, automatic rigging, initial grid mesh generation, renderer/pixel/compositing proof, public demo asset, Cubism compatibility, or persisted source PSD bytes/raw parser objects.
- `discussion/tests/traceability/test-traceability-matrix.md:112` truthfully records that stale approval-context rejection remains proven by the existing leaf import-plan Codex focused path because there is no structural-specific execute/stale command in Wave50.
- `discussion/tests/traceability/test-traceability-matrix.md:279` and `discussion/tests/traceability/test-traceability-matrix.md:280` preserve the JSON mirror and quality-gate listing/checking limitations.

## Non-Goal Review

Pass.

Targeted scans over the Domain G files found no introduced semantic recognition, smart suggestion/proposal UI, auto-classification, auto-rigging, initial grid mesh generation, Photoshop compositing, renderer/pixel oracle, external transport, Cubism compatibility, public demo asset capability, or direct parser import expansion. Positive mentions in the fixture/traceability docs are non-goal disclaimers or unsupported-claim guards.

## Verification Performed

Passed:

- `node --check apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`
- `node scripts/check-focused-e2e-registry.mjs` -> 24 entries, 14 aggregate-discoverable, 10 standalone direct.
- `node scripts/check-wave42-quality-gate-boundary.mjs` -> 5 categories, 24 focused e2e entries, 9 explicit non-goals.
- `node scripts/check-psd-parser-import-boundary.mjs` -> 5 approved direct import/resolve sites.
- `git diff --check -- apps/editor/e2e scripts discussion/tests discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` -> pass with LF/CRLF working-copy warnings only.
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused` -> sandbox `spawn EPERM` first, approved local rerun passed; desktop proved 4 approved leaves, 2 generated group parts, runtime-hidden headwear, and Codex read status `ok`.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` -> passed; `staleContext=rejected`.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` -> passed.
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` -> passed.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused` -> passed.

## Orchestration Compliance

Partial pass with note.

The call header identifies this as an Orch-Sylph delegated clean Review-Sylph review. I wrote only this review artifact and did not edit implementation files. A local Domain G Gnome completion report artifact was not present at the expected wave report location, so I cannot fully verify Domain G Gnome separation from repository artifacts alone. This is recorded as a non-blocking orchestration evidence gap for Domain G review, not a source/test fix requirement.

## Review Artifact

- `discussion/implementation/reviews/wave50/wave50-domain-g-focused-e2e-structural-initial-state-regression-review.md`
