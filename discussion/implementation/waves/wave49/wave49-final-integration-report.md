# Wave49 Final Integration Report

> Verdict: `pass`

## Verdict

Wave49 can now be treated as the latest final implementation-proven baseline.

The accepted Wave49 scope is limited to explicit PSD import-plan preview and explicit eligible leaf approval/execution generalized beyond the Wave48 fixed three leaves. The final proof is `front hair` / `psd:root/group[2]/layer[0]` through the existing Editor/browser import-plan workflow and the existing `packages/ai-interface` / in-process command host style surface. The repo/editor remains a deterministic operation, validation, evidence, and approval surface; it does not generate proposals, infer semantics, classify parts, auto-fix, auto-commit, or add external transport.

## Integration Findings

- Domain A boundary holds: arbitrary eligible leaf approval is explicit and parser-free; `front hair` is the selected non-fixed target; hidden `headwear` remains blocked; no fixed3-only assumption remains in the Wave49 execution evidence.
- Domain B package/operation changes are additive and backward compatible. Result evidence exposes approved leaf refs/order, generated `part` / `drawable` / `texture` / `mesh` refs, operation/evidence refs, and machine-readable issue kinds without direct parser imports.
- Domain C Codex-facing commands are human-equivalent in-process operations only: set explicit import-plan approval, preflight, execute, and inspect result refs. Approval-context digest binding rejects stale or swapped approval context before commit.
- Domain D Editor workflow remains simple: approve/unapprove/execute/result view. No smart suggestion, recommendation, or semantic classification UI was added.
- Domain E validator/Product Preflight diagnostics remain truthful and parser-free. Missing current source bytes are reported as `not_evaluated`, not as passing evidence.
- Domain F focused proof passed: `psdImportPlanCodexFocused` reports `candidates=126`, `approved=front hair`, `materializedBytes=1537600`, and `staleContext=rejected`. Existing focused IDs `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused` still pass.
- Domain G docs and traceability preserve Wave49 scope and non-goals. Final H bookkeeping updates now mark Wave49, not Wave48, as the latest final implementation-proven baseline.
- Canonical approved materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.

## Verification Matrix

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `pnpm.cmd test:unit` | pass after approved rerun | Initial sandbox run failed at Vitest/esbuild startup with `spawn EPERM`; approved rerun passed `242` files / `1256` tests. |
| `pnpm.cmd test:e2e` | pass after approved rerun | Initial sandbox run failed at Vite/esbuild startup with `spawn EPERM`; approved rerun passed desktop and mobile smoke with screenshot captures. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | pass after approved rerun | Initial sandbox run failed at Vite/esbuild startup with `spawn EPERM`; approved rerun reported `byteLength=22406225`, `root=psd:root`, `candidates=126`, `approved=front hair`, `materializedBytes=1537600`, `codexOperation=op_editor_import_psd_layer_batch_batch_src_explicit_psd_sample_model_22406225_1_r1`, `staleContext=rejected`. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | pass after approved focused-e2e rerun | `byteLength=22406225`, `root=psd:root`, `candidates=126`, `approved=headwear,eyewear,tie/tie`, `materializedBytes=810360`, `portableBundleBytes=1357158`. |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | pass after approved focused-e2e rerun | `byteLength=22406225`, `materializedBytes=810360`, `layers=headwear,eyewear,tie/tie`, `batch=batch_src_explicit_psd_sample_model_22406225_3`. |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | pass after approved focused-e2e rerun | `byteLength=22406225`, `materializedBytes=460800`, `drawable=draw_headwear`, `texture=tex_headwear`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass | `5` direct import/resolve sites limited to the approved adapter and Wave44 scripts. |
| `node scripts/check-focused-e2e-registry.mjs` | pass | `23` entries, `14` aggregate-discoverable, `9` standalone direct. |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass | `5` categories, `23` focused e2e entries, `9` explicit non-goals. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `node scripts/run-focused-e2e.mjs --check` | pass | Focused e2e registry check passed: `23` entries. |
| `node scripts/check-source-organization-fixtures.mjs` | pass after approved rerun | Initial sandbox run returned null child-process exits/output; approved rerun passed `4` cases. |
| `node scripts/check-dependencies-guard-self-test.mjs` | pass after approved rerun | Initial sandbox run had unavailable child-process output; approved rerun passed `7` cases. |
| `node scripts/check-wave43-validator-contract-coverage.mjs` | pass | `12` representative catalog IDs, `37` stable documentation tokens, `7` focused e2e boundary tokens. |
| `pnpm.cmd smoke:wave44:psd-parser` | pass | `test_data/sample_model.psd`, byteLength `22406225`, groupCount `20`, layerCount `126`, visible `121`, hidden `5`, raster candidates `126`; includes `front hair` and hidden `headwear` fixture facts. |
| `node scripts/wave44-psd-fixture-evidence-regression.mjs` | pass after approved rerun | Initial sandbox run failed with child-process `spawn EPERM`; approved rerun passed. |
| `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd` | pass | Direct Wave44 evidence generator passed for selected `headwear`, byteLength `460800`, digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`. This is an evidence generator, not an additional product capability. |
| `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests` | pass | Git emitted LF-to-CRLF working-copy warnings only. |
| Focused forbidden-scope scans with `rg` and added-line diff scan | pass with classified matches | Matches were unsupported/non-goal policy/catalog entries, negative assertions, non-persistence checks, focused e2e fixture loading via Vite `/@fs/`, existing editor mesh canvas drag behavior, and Wave49 docs boundary wording. No affirmative forbidden implementation or positive capability claim was found. |
| Final stale wording scans over maps/final report/review | pass after H bookkeeping | Final maps/backlog/current capability wording now mark Wave49 as the latest final baseline and no longer describe Wave49 as awaiting final review. |

## Still-Relevant Wave42/Wave43/Wave44 Guard Notes

The same still-relevant guard set from Wave48 Domain H was rerun. `wave42-focused-e2e-boundary.mjs`, `wave42-guard-categories.mjs`, `wave42-non-goal-classification-policy.mjs`, and `wave42-quality-gate-report-shape.mjs` are covered through `node scripts/check-wave42-quality-gate-boundary.mjs` rather than executed as standalone CLI scripts. `wave44-psd-layer-materialization.mjs` is an evidence generator used by `wave44-psd-fixture-evidence-regression.mjs`; it was also run directly as a read-only extra check.

## Warnings

- Several Node/Vite/Vitest/browser or child-process checks hit sandbox `spawn EPERM` or null child-process output and were rerun with approved escalation as required.
- `git diff --check` emitted LF-to-CRLF working-copy warnings only.
- Wave44 historical pilot evidence still uses `application/vnd.private-2d-rigging-lab.raw-rgba`; Wave49 approved materialized Editor/package paths use the canonical `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.
- The new focused e2e uses Vite `/@fs/` to load the private local PSD fixture in the browser smoke. This is test harness fixture loading, not product HTTP/WebSocket/MCP transport.

## Residual Non-Goals / Risks

Wave49 does not implement repo/editor-side proposal generation, semantic inference/classification, `Suggest` / `Auto classify` / `Recommended deformers` / smart UI, auto-fix, automatic commit, external HTTP/WebSocket/MCP transport, all-layer one-click import, recursive group auto import, group-as-artmesh import, deformer/parameter/keyform/warp lattice/physics auto generation, drag/drop/filesystem/archive intake, full renderer/pixel/compositing oracle, Cubism SDK/export/runtime integration, public demo asset, or persisted source PSD bytes/raw parser objects as package/session capability.

Residual risks are future-scope product choices, not current blockers: broader/general PSD materialization, hidden leaf import policy, approval cap policy, renderer/compositing oracle design, public/demo asset policy, archive/filesystem intake, and Cubism compatibility policy still require separate wave boundaries.

## Final Decision

`pass`. Wave49 is the latest final implementation-proven baseline.
