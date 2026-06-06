# Wave49 Domain F Focused E2E Codex-Facing Regression Report

Status: pass

## Scope

Implemented focused regression coverage for `wave49-focused-e2e-codex-facing-regression`.

New focused e2e id:

- `psdImportPlanCodexFocused`

Command:

- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`

## Changes

- Added `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`.
- Registered `psdImportPlanCodexFocused` in `scripts/focused-e2e-registry.mjs`.
- Added the new id to the Wave42 focused e2e boundary in `scripts/wave42-focused-e2e-boundary.mjs`.
- Added warning fixture registration for `wave49-psd-import-plan-codex-focused-e2e-regression` in `discussion/tests/fixtures/fixture-manifest.md`.
- Added traceability row and reverse coverage references for `TC-WAVE49-PSD-IMPORT-PLAN-CODEX-E2E-001` in `discussion/tests/traceability/test-traceability-matrix.md`.

No `apps/editor/src/**`, package, operation, AI-interface, validator, dependency, manifest, or lockfile edits were made by Domain F.

## Coverage

The new focused e2e uses private/local `test_data/sample_model.psd` and exercises:

- root import-plan generation from `psd:root`;
- arbitrary eligible non-fixed leaf approval for `front hair` / `psd:root/group[2]/layer[0]`;
- real sample path-aware generated refs:
  - preview refs: `part_hair_front_front_hair_psd_root_group_2_layer_0`, `draw_hair_front_front_hair_psd_root_group_2_layer_0`, `tex_hair_front_front_hair_psd_root_group_2_layer_0`, `mesh_hair_front_front_hair_psd_root_group_2_layer_0`;
  - committed refs: `part_hair_front_front_hair`, `draw_hair_front_front_hair`, `tex_hair_front_front_hair`, `mesh_hair_front_front_hair`;
- hidden `headwear` / `psd:root/layer[1]` blocked taxonomy with `hiddenLayerUnsupported`;
- save/load restore with one checked persistent byte restored;
- Codex-facing in-process command parity through `setPsdImportPlanApproval`, `preflightPsdImportPlanIntake`, and `executePsdImportPlanIntake`;
- stale approval/context rejection with `ai.approvalRejected`.

The Codex-facing segment runs inside the browser process against a separate in-process workflow controller and command host. It does not use external transport, repo-side proposal generation, suggestion logic, or product-side smart automation.

## Verification

| Command | Status | Notes |
|---|---:|---|
| `node --check apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs` | pass | Syntax check passed. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | pass | Initial sandbox run failed with Vite/esbuild `spawn EPERM`; reran with approved escalation. Final run passed with `byteLength=22406225`, `candidates=126`, `approved=front hair`, `materializedBytes=1537600`, `codexOperation=op_editor_import_psd_layer_batch_batch_src_explicit_psd_sample_model_22406225_1_r1`, `staleContext=rejected`. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | pass | Reran with approved escalation. Passed with `candidates=126`, approved `headwear,eyewear,tie/tie`, `materializedBytes=810360`, portable bundle bytes `1357158`. |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | pass | Reran with approved escalation. Passed with `materializedBytes=810360`, layers `headwear,eyewear,tie/tie`, batch `batch_src_explicit_psd_sample_model_22406225_3`. |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | pass | Reran with approved escalation. Passed with `materializedBytes=460800`, drawable `draw_headwear`, texture `tex_headwear`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass | `5` direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `node scripts/check-focused-e2e-registry.mjs` | pass | `23` entries, `14` aggregate-discoverable, `9` standalone direct. |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass | `5` categories, `23` focused e2e entries, `9` explicit non-goals. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `git diff --check -- apps/editor/e2e apps/editor/src scripts discussion/tests discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | pass | Exit `0`; Git emitted CRLF working-copy warnings only. |
| Added-line forbidden/non-goal scan over Domain F changed files | pass | Hits were limited to explicit `No ...` non-goal documentation rows; implementation-code scan had no proposal/suggestion/external-transport matches. |
| `rg -n "publicDemoAsset\s*[:=]\s*true|allLayerImport|recursiveGroupAuto|groupAsArtmesh|externalTransport" apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs scripts/focused-e2e-registry.mjs scripts/wave42-focused-e2e-boundary.mjs` | pass | No matches; `rg` exited `1`. |

Not run:

- `pnpm.cmd typecheck`: not required for Domain F because no source hook or `apps/editor/src/**` file was touched.
- Focused unit/integration tests for source hooks: not applicable for the same reason.

## Assumptions

- Wave49 Domains A/B/C/D/E accepted reports are the source of truth for target eligibility, command surface behavior, and diagnostic taxonomy.
- The real `sample_model.psd` browser parser exposes the parent group as `hair_front`; therefore the e2e asserts path-aware refs from the current implemented workflow rather than the shorter synthetic `part_front_hair` refs used in lower-level Domain B synthetic tests.
- Existing unrelated source/package changes in the worktree belong to earlier Wave49 domains and were not reverted.

## Residual Risks

- Browser e2e requires unsandboxed process spawn for Vite/esbuild/Chrome on this Windows environment.
- Domain F verifies one arbitrary eligible sample leaf (`front hair`) plus hidden `headwear`; it does not broaden aggregate e2e runtime or claim all-layer/group-auto support.
- Independent Review-Sylph review is still required; this report is implementation evidence only.
