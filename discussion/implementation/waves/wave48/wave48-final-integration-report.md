# Wave48 Final Integration Report

> Verdict: `pass`

## Verdict

Wave48 can now be treated as the latest final implementation-proven baseline.

The H-F1/H-F2 blocker fix has held under the full Domain H rerun. The Wave42 quality gate boundary now accepts the post-Wave42 focused smoke registration for `psdImportPlanFocused` without weakening focused smoke discovery, and top-level plus implementation bookkeeping no longer claims final pass before this rerun.

The accepted Wave48 scope is limited to explicit PSD import session -> `psd:root` / group import-plan candidate preview -> explicit eligible leaf approval/unapproval -> approved-leaf-only batch intake through the existing Wave47 batch path -> generated scaffold under `part_root` -> import-plan validator/Product Preflight diagnostics -> save/load/portable/parser-boundary/non-persistence regression through `psdImportPlanFocused`.

## Integration Findings

- Browser PSD import-plan candidate service supports explicit `psd:root` and group refs by enumerating leaf candidates. Group rows remain context only and no parser execution outside the approved browser adapter and Wave44 scripts was introduced.
- Operation/package bridge preflights candidate digest, approval digest, source identity, approved refs/order, destination parent, not-approved/blocked candidates, candidate statuses, and generated scaffold preview/resolved IDs before mutation.
- Editor UX exposes import-plan preview, explicit eligible leaf approval/unapproval, and approved-leaf-only batch execution. Stale approval controls require preview regeneration before execution.
- Validator/Product Preflight diagnostics cover import-plan bridge mismatch, blocked/not-approved/unsupported/hidden/empty/byte-cap/collision/partial/stale-source/current-byte-missing/private-local provenance states, and report missing source bytes truthfully as `not_evaluated` without persisted source bytes.
- `psdImportPlanFocused` proves `test_data/sample_model.psd`, `psd:root`, `126` candidates, explicit approval of `headwear`, `eyewear`, and `tie / tie`, approved-leaf-only execution, save/load, portable bundle boundary, parser boundary, and non-persistence of source PSD bytes/raw parser objects/session import-plan bridge capability.
- Existing focused ids `psdImportFocused` and `psdMultiLayerBatchFocused` still pass.
- Canonical approved materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`. Historical Wave44 pilot evidence still records the earlier `application/vnd.private-2d-rigging-lab.raw-rgba` media type; Wave48 approved materialized Editor/package paths use the canonical type.

## Verification Matrix

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `pnpm.cmd test:unit` | pass after approved rerun | Initial sandbox run failed at Vitest/esbuild startup with `spawn EPERM`; approved rerun passed `241` files / `1240` tests. |
| `pnpm.cmd test:e2e` | pass after approved rerun | Initial sandbox run failed at Vite/esbuild startup with `spawn EPERM`; approved rerun passed desktop and mobile smoke, with screenshot captures. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | pass after approved escalated run | `byteLength=22406225`, `root=psd:root`, `candidates=126`, `approved=headwear,eyewear,tie/tie`, `materializedBytes=810360`, `portableBundleBytes=1357158`. |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | pass after approved escalated run | `byteLength=22406225`, `materializedBytes=810360`, `layers=headwear,eyewear,tie/tie`, `batch=batch_src_explicit_psd_sample_model_22406225_3`. |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | pass after approved escalated run | `byteLength=22406225`, `materializedBytes=460800`, `drawable=draw_headwear`, `texture=tex_headwear`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass | `5` direct import/resolve sites limited to approved adapter and Wave44 scripts. |
| `node scripts/check-focused-e2e-registry.mjs` | pass | `22` entries, `14` aggregate-discoverable, `8` standalone direct. |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass | `5` categories, `22` focused e2e entries, `9` explicit non-goals. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `node scripts/check-source-organization-fixtures.mjs` | pass after approved rerun | Initial sandbox run returned child-process null exits; approved rerun passed `4` cases. |
| `node scripts/run-focused-e2e.mjs --check` | pass | Focused e2e registry check passed: `22` entries. |
| `node scripts/check-dependencies-guard-self-test.mjs` | pass after approved rerun | Initial sandbox run failed because child-process output was unavailable; approved rerun passed `7` cases. |
| `node scripts/check-wave43-validator-contract-coverage.mjs` | pass | `12` representative catalog IDs, `37` stable documentation tokens, `7` focused e2e boundary tokens. |
| `pnpm.cmd smoke:wave44:psd-parser` | pass | `test_data/sample_model.psd`, byteLength `22406225`, groupCount `20`, layerCount `126`, visible `121`, hidden `5`, raster candidates `126`. |
| `node scripts/wave44-psd-fixture-evidence-regression.mjs` | pass after approved rerun | Initial sandbox run failed with child-process `spawn EPERM`; approved rerun passed. |
| `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd` | pass | Direct Wave44 evidence generator passed for selected `headwear`, byteLength `460800`, digest `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`. This is an evidence generator covered by the regression guard, not an additional product capability. |
| Focused parser import scan | pass | Direct `@webtoon/psd` imports are limited to `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts` and Wave44 scripts; package/validator hits are parser metadata strings or tests. |
| Focused forbidden-scope scans over changed/untracked files | pass with classified matches | Matches were non-goal/future-scope wording, negative e2e assertions, guard self-test fixtures, `publicDemoAsset=false` or public-demo blocking tests, and non-persistence assertions. No affirmative forbidden implementation or claim was found. |
| Final stale wording scans over maps/final report/review | pass after bookkeeping | Final maps and Wave48 final report/review no longer state previous-H blocker conditions or pending rerun status. |
| `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests` | pass after bookkeeping | Git emitted LF-to-CRLF working-copy warnings only. |

## Still-Relevant Wave42/Wave43/Wave44 Guard Notes

The same still-relevant guard set from the previous Domain H run was rerun. `wave42-focused-e2e-boundary.mjs`, `wave42-guard-categories.mjs`, `wave42-non-goal-classification-policy.mjs`, and `wave42-quality-gate-report-shape.mjs` are module inputs to `check-wave42-quality-gate-boundary.mjs`; they are covered through that guard rather than executed as standalone CLI scripts. `wave44-psd-layer-materialization.mjs` is an evidence generator used by `wave44-psd-fixture-evidence-regression.mjs`; it was also run directly as a read-only extra check.

## Residual Non-Goals / Risks

Wave48 remains limited to import-plan preview and explicit approved leaf intake. It does not implement all-layer one-click import, recursive group auto import, group-as-artmesh import, drag/drop/filesystem/archive intake, full renderer/pixel/compositing oracle, Cubism SDK/export/runtime integration, public demo asset, repo-side AI/LLM/autofix, or persisted source PSD bytes/raw parser objects as package/session capability.

Residual risks are future-scope product choices, not current blockers: higher approval caps, hidden leaf import policy, broader/general PSD materialization, renderer/compositing oracle design, public/demo asset policy, and any future archive/filesystem or Cubism-policy reconsideration still need separate wave boundaries.

## Final Decision

`pass`. Wave48 is the latest final implementation-proven baseline after this Domain H rerun.
