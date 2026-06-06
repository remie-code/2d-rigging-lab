# Wave49 Domain A Review: Boundary / Target Inventory / Operation Parity

> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`
> Verdict: `pass`

## Verdict

`pass`.

I reviewed the report artifact directly against the Wave49 plan, automation policy, Wave48 final baseline, capability/backlog docs, and focused source/evidence shape files. I found no blocking design, development, test-adequacy, automation-policy, or forbidden-scope issue in Domain A.

Domain A is correctly limited to boundary/inventory/report work. It does not claim source implementation, public demo assets, smart automation, proposal generation, all-layer one-click PSD import, recursive group auto import, group-as-artmesh import, or group-as-artmesh execution.

## Findings

No findings.

## Compliance Review

Design / development compliance: pass.

- The accepted Wave49 boundary is recorded at report lines 45-54: arbitrary eligible leaf refs are explicit targets from an existing import-plan candidate preview, discovery remains `psd:root`/group preview, execution is approved-leaf-only, Codex-facing work stays in-process, and external transport is out of scope.
- The arbitrary eligible leaf definition is present at lines 56-70 and remains deterministic: source identity, visibility, positive bounds, current digest/source checks, cap checks, and explicit approval are required; semantic meaning and image interpretation are not eligibility inputs.
- Wave48 fixed3 backward compatibility is recorded at lines 72-90, including the three refs/digests/bytes, `psdImportPlanFocused`, `126` candidates, `121` visible candidates, `5` hidden/unsupported blocked candidates, canonical media type, parser-free evidence names, non-persistence, and stale approval behavior.
- Stable refs/result evidence fields are recorded at lines 112-123, and the failure taxonomy is recorded at lines 125-136.
- Codex-facing human-equivalent in-process operation boundary is recorded at lines 138-144.
- Non-goals and early escape triggers are recorded at lines 147-168.

Test adequacy / downstream implementability: pass for Domain A scope.

- Domain A is not a source implementation domain, so source tests are not expected here.
- The report gives later domains enough implementable targets: at least one non-fixed sample target (`front hair`, `psd:root/group[2]/layer[0]`) is recorded at line 99, with a clear caveat that later domains must assert current candidate-plan status and produce execution evidence before claiming support.
- Blocked/not-approved/stale/collision-cap scenarios are recorded at lines 103-110.
- Existing shape checks confirm the fixed3 e2e refs and media type in `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`, the bridge/evidence schema fields in `packages/package-format` and `packages/operation-core`, and the Product Preflight IDs in `packages/validator-core/src/check-catalog.ts`.

Automation policy compliance: pass.

- Report lines 52-54 and 138-144 match the accepted policy: the repo/editor provides deterministic state, validation, dry-run, approval, commit, transcript, evidence, stable refs, and machine-readable errors; Codex/external workflows own interpretation and operation planning.
- Positive smart automation claims were not found by focused `rg` scan. Matches for proposal generation, semantic inference, all-layer import, recursive group auto import, group-as-artmesh, and public demo assets are negative/non-goal/early-escape contexts.

Source edit / forbidden scope confirmation: pass.

- Before this review artifact was written, `git status --short -uall -- apps packages scripts package.json pnpm-lock.yaml fixtures test_data generated discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` showed only the untracked Domain A report.
- No `apps/**`, `packages/**`, `scripts/**`, `package.json`, `pnpm-lock.yaml`, `fixtures/**`, `test_data/**`, or `generated/**` source/fixture/generated file was edited by Domain A.

## Files Changed

- `discussion/implementation/reviews/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-review.md`

## Verification Performed

- `git diff --check -- discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49`: pass after review artifact write.
- `rg -n "Codex-facing|human-equivalent|in-process|Automation boundary|repo/editor does not|does not generate|must not|Non-Goals|Early Escape|proposal generation|semantic inference|auto-classification|auto-placement|all-layer one-click|recursive group auto|group-as-artmesh|public demo asset" discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`: pass; boundary terms are present and forbidden terms are in negative/non-goal/early-escape contexts.
- `rg -n "^[A-Za-z0-9].*(implements|adds|supports|provides|generates|infers|classifies|recommends|auto-places|auto-executes).*(proposal|semantic|auto-classification|auto-placement|automatic rigging|all-layer one-click|recursive group auto|group-as-artmesh|public demo asset)" discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`: pass; exit code `1`, no positive claim matches.
- `git status --short -uall -- apps packages scripts package.json pnpm-lock.yaml fixtures test_data generated discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49`: after review artifact write, only the Domain A report and this review artifact are untracked in the requested scope; no source/package/script/fixture/generated file is changed.

## Unresolved Risks

- `front hair` is an inventory target only. Later source/e2e domains must generate actual approval/result refs and materialized digest evidence before claiming execution support.
- Hidden leaf materialization, larger caps, public/demo assets, external transport, renderer/pixel oracle, Cubism compatibility, all-layer import, recursive group auto import, and group-as-artmesh behavior remain outside Wave49 Domain A and require escalation if implementation depends on them.
