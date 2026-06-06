# Wave49 Domain F Review: Focused E2E Codex-Facing Regression

> Target: `wave49-focused-e2e-codex-facing-regression`
> Role: independent Review-Sylph
> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-f-focused-e2e-codex-facing-regression-report.md`
> Verdict: `pass`

## Verdict

`pass`.

I reviewed the Domain F diff, the focused e2e script, focused registry/boundary scripts, fixture/traceability registrations, Wave49 plan, Codex-friendly automation policy, and relevant Wave49 Domain A/C/E accepted reviews. I also reran the required guards and the new focused e2e, then reran the three existing PSD focused e2e ids to confirm preservation.

No blocking design/development compliance, test adequacy, automation policy, focused registry/Wave42 boundary, parser/persistence boundary, or focused-ID preservation issue was found.

## Findings

No findings.

## Design / Development Compliance

Pass.

- The new focused smoke explicitly targets the non-Wave48 leaf `front hair` at `psd:root/group[2]/layer[0]` and records path-aware generated refs for part/drawable/texture/mesh in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:40`.
- The UI path remains an explicit human operation sequence: select file, set `psd:root`, set approved refs to front hair only, execute approved batch, save, reload, and inspect persistence in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:83`.
- The Codex-facing path uses the in-process workflow controller and command host, then supplies exact refs and parameters to `setPsdImportPlanApproval`, `preflightPsdImportPlanIntake`, and `executePsdImportPlanIntake` in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:533` and `:586`.
- The stale approval/context path is tested by approving a preflight for front hair, attempting execute with `psd:root/layer[3]`, and expecting `ai.approvalRejected` before the valid front-hair execute in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:660`.
- The implementation stays in the Domain F allowed scope: e2e, focused registry/boundary scripts, fixture/traceability docs, and Wave49 report/review artifacts. The worktree also contains many Domain A-E source/package changes, which I treated as accepted basis rather than Domain F leakage.

## Test Adequacy

Pass.

- The new focused e2e covers root import-plan preview, `126` candidate count, explicit approval of front hair only, blocked hidden headwear taxonomy, approved batch execution, save/load restore, Codex-facing command parity, and stale approval-context rejection.
- Hidden `headwear` / `psd:root/layer[1]` is asserted as blocked with `statuses=hidden,unsupported,notApproved` and `approvalBlocked=hiddenLayerUnsupported` in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:280`.
- The Codex command segment checks candidate counts, approved refs, source digest, generated preview refs, hidden candidate blocker, preflight result refs, committed result refs, evidence refs, transcript shape, and save/load state in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:598`.
- Fixture and traceability registrations connect the new warning-gated fixture/test ID to the e2e command, registry guard, parser guard, `hiddenLayerUnsupported`, `psdImportPlanCommand`, and `ai.approvalRejected` in `discussion/tests/fixtures/fixture-manifest.md:108` and `discussion/tests/traceability/test-traceability-matrix.md:103`.
- I independently reran the new focused e2e and all three preserved PSD focused e2e commands; all passed after the expected Windows sandbox `spawn EPERM` rerun outside sandbox.

## Automation Policy Compliance

Pass.

- The Wave49 policy says the repo/editor must expose deterministic human-equivalent operations without proposal generation, semantic inference, auto-classification, external transport, or smart rigging UI (`discussion/design/codex-friendly-automation-policy.md:12`, `:18`, `:25`, `:66`).
- Domain F follows that boundary: the e2e passes explicit refs and expected plan context; it does not add product behavior, proposal generation, ranking, semantic classification, LLM/provider integration, or external transport.
- The scoped forbidden/smart automation scan over Domain F changed files found only existing non-goal wording, focused registry descriptions, and e2e assertions that detect forbidden UI claims. The `HTTP` hit was an error message for Vite `/@fs/` local sample fetch inside the browser e2e, not an external transport implementation.

## Focused Registry / Wave42 Boundary Review

Pass.

- `psdImportPlanCodexFocused` has metadata and is registered as standalone direct verification in `scripts/focused-e2e-registry.mjs:121`.
- The post-Wave42 overlay keeps `psdImportPlanFocused` and adds `psdImportPlanCodexFocused` without changing aggregate inclusion semantics in `scripts/focused-e2e-registry.mjs:171`.
- The Wave42 focused boundary records both post-Wave42 overlay ids and still preserves base `psdImportFocused` and `psdMultiLayerBatchFocused` entries in `scripts/wave42-focused-e2e-boundary.mjs:16` and `:114`.
- `node scripts/check-focused-e2e-registry.mjs` passed with `23` entries, `14` aggregate-discoverable, and `9` standalone direct.
- `node scripts/check-wave42-quality-gate-boundary.mjs` passed with `5` categories, `23` focused e2e entries, and `9` explicit non-goals.

## Parser / Persistence Boundary Review

Pass.

- `node scripts/check-psd-parser-import-boundary.mjs` passed: `5` direct import/resolve sites remain limited to the approved browser adapter and Wave44 scripts.
- Domain F did not add a direct parser import in packages/runtime/validator or broaden parser scope. Plain `@webtoon/psd` scan hits outside the guard were metadata strings or existing approved/test references.
- Persistence assertions verify source PSD bytes are not stored as a binary asset, materialized texture bytes are referenced through a private/local binary ref and canonical raw-RGBA media type, and serialized project/package/log text does not contain source PSD bytes, parser object, raw byte payload, `rawRgbaBytes`, `sourcePsdBytes`, or `publicDemoAsset=true` in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:430`.
- Reload assertions confirm session-only import-plan/parser evidence is cleared from the UI after load while the generated front-hair project state and browser-local persistent bytes are restored in `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs:480`.

## Existing Focused IDs

Preserved.

- `psdImportPlanFocused` remains registered in the focused overlay and Wave42 post-boundary data (`scripts/focused-e2e-registry.mjs:173`, `scripts/wave42-focused-e2e-boundary.mjs:18`).
- `psdMultiLayerBatchFocused` remains in the Wave42 base boundary and registry metadata (`scripts/wave42-focused-e2e-boundary.mjs:120`, `scripts/focused-e2e-registry.mjs:127`).
- `psdImportFocused` remains in the Wave42 base boundary and registry metadata (`scripts/wave42-focused-e2e-boundary.mjs:114`, `scripts/focused-e2e-registry.mjs:109`).
- I reran `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`, `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`, and `node scripts/run-focused-e2e.mjs --id psdImportFocused`; all passed.

## Verification Performed

| Command / check | Result |
|---|---|
| `node --check apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs` | Passed. |
| `node scripts/check-focused-e2e-registry.mjs` | Passed: 23 entries, 14 aggregate-discoverable, 9 standalone direct. |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | Passed: 5 categories, 23 focused e2e entries, 9 explicit non-goals. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts. |
| `git diff --check -- apps/editor/e2e apps/editor/src scripts discussion/tests discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed by exit code 0; Git emitted LF-to-CRLF working-copy warnings only. |
| Scoped forbidden/smart automation scan over Domain F changed files | Passed with classified negative/boundary hits only. |
| `node scripts/run-focused-e2e.mjs --list` | Passed; listed 23 entries including the three preserved PSD ids and new `psdImportPlanCodexFocused`. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | Sandbox run failed with Vite/esbuild `spawn EPERM`; approved escalated rerun passed: `byteLength=22406225`, `candidates=126`, `approved=front hair`, `materializedBytes=1537600`, `staleContext=rejected`. |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | Passed with approved escalated run: `candidates=126`, approved `headwear,eyewear,tie/tie`, `materializedBytes=810360`, `portableBundleBytes=1357158`. |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | Passed with approved escalated run: `materializedBytes=810360`, layers `headwear,eyewear,tie/tie`. |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | Passed with approved escalated run: `materializedBytes=460800`, drawable `draw_headwear`, texture `tex_headwear`. |

## Unresolved Risks / Assumptions

- Browser e2e execution on this Windows environment requires outside-sandbox process spawn for Vite/esbuild/Chrome; sandboxed execution fails with `spawn EPERM`.
- Domain F verifies one arbitrary eligible non-fixed sample leaf and one hidden blocked leaf plus stale approval-context rejection. It does not prove all possible eligible leaves or broaden aggregate e2e coverage.
- I treated Wave49 Domain A-E reports/reviews and current source/package/editor changes as accepted basis unless they conflicted with Domain F; I found no such conflict.
