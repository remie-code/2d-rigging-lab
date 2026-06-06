# Wave48 Domain A Review: Import Plan Boundary / Sample Group Inventory

> Target: `wave48-import-plan-boundary-sample-group-inventory`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`

The Domain A report satisfies the Wave48 boundary gate. It fixes `psd:root` as the sample root candidate scope and limits execution to the explicit Wave47-proven approved leaf subset: `headwear`, `eyewear`, and `tie / tie`. The report is clear that group/root discovery produces a candidate leaf list only, group rows are not import entries, and execution must pass only an explicitly approved leaf-ref list into the existing Wave47 batch intake path.

No blocking design, development-compliance, or test-adequacy findings were found.

## Scope Reviewed

- Report under review: `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- Wave48 plan, current capability map, remaining backlog, Wave47 final/clean reports, Wave47 Domain A/F reports, development policies, fixture manifest, and traceability matrix.
- Existing parser smoke script path `scripts/wave44-psd-parser-smoke.mjs`, read-only.
- Current worktree status and source/dependency diff scope.

## Design / Development Compliance Review

No findings.

Evidence:

- Wave48 plan requires Domain A to establish group/root candidate discovery, leaf approval boundary, hidden/unsupported/collision/byte-cap semantics, and the sample group/root target before source implementation.
- The report selects `psd:root` and grounds the executable subset in the Wave47 proven leaves and refs:
  - `headwear` / `psd:root/layer[0]`
  - `eyewear` / `psd:root/layer[3]`
  - `tie / tie` / `psd:root/group[6]/layer[0]`
- The selected refs, byte lengths, and digests match Wave47 Domain F evidence.
- Candidate discovery semantics are explicit: root/group scope is recursively walked into leaf candidates, group rows are display/filter context only, and execution requires an explicit approved leaf list.
- Required status semantics are present: `candidate`, `hidden`, `unsupported`, `emptyZeroSize`, `duplicateRef`, `duplicateName`, `generatedIdCollision`, `generatedNameCollision`, `byteCapBlocked`, and `notApproved`.
- Approval semantics are explicit: not-approved, unsupported, hidden-by-default, duplicate-ref, generated-collision, and byte-cap-blocked candidates must not be silently imported.
- Evidence requirements include candidate plan digest, source PSD hash/byteLength, candidate refs/path/name/statuses, approval selection, generated scaffold preview, private/local provenance, and `publicDemoAsset=false`.
- Parser-free package/operation evidence requirements avoid raw parser objects, source PSD byte persistence, inline raw/visual bytes, public demo asset claims, and direct parser execution in packages.
- v0 caps are conservative and bounded: source parse `32 MiB`, candidate enumeration `200`, per-leaf raw RGBA `64 MiB`, approved count `4`, approved total raw RGBA `32 MiB`.
- The report explicitly avoids all-layer one-click import, recursive group auto import, group import, drag-drop/archive/filesystem, full compositing, renderer/pixel/texture correctness oracle, Cubism compatibility, public demo assets, and repo-side repair/LLM claims.
- Early escape cases for Domains B-F are present and cover parser-boundary expansion, new dependencies, unsupported parser-free states, direct parser use in packages/validator, Product Preflight persistence, hidden auto approval, public demo asset wording, and forbidden oracle/scope expansion.

## Test Adequacy Review

No findings.

Domain A is a boundary/reporting gate, not an implementation source domain. The performed evidence is adequate for this domain because it verifies the sample PSD identity, root candidate inventory, aggregate byte estimates, duplicate-name pressure, Wave47-proven leaf subset, parser-boundary path, and no source/dependency edit scope. The later implementation/test obligations are correctly assigned to Domains B-F rather than claimed as complete by Domain A.

Independent verification performed:

- `node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd`
  - Passed.
  - Confirmed parser `@webtoon/psd` `0.4.0`, source byteLength `22406225`, source SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, private/local provenance, `publicDemoAsset=false`, document `2048 x 3072`, root childCount `14`, `20` groups, `126` leaf layers, `121` visible leaf layers, `5` hidden leaf layers.
- Read-only aggregate computation from the existing smoke output:
  - all-leaf raw RGBA estimate `49172000`
  - visible positive raw RGBA estimate `40626328`
  - zero-size leaves `0`
  - duplicate-name pressure includes `eyebrow-l=10`, `eyebrow-r=10`, `eyelash-l=10`, `eyelash-r=10`, `mouth=10`, and `nose=10`
- `git diff --name-status -- apps packages scripts package.json pnpm-lock.yaml`
  - No output; no source/dependency diff was present before this review artifact was written.

## Final Verification Performed

Run after writing this review artifact:

- `git diff --check -- discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
  - Passed with no output.
- `git status --short -uall`
  - Output:
    - ` M discussion/implementation/orchestration/_map.md`
    - `?? discussion/implementation/orchestration/wave48-plan.md`
    - `?? discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
    - `?? discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
  - No `apps/**`, `packages/**`, `scripts/**`, dependency manifest, or lockfile files are changed in current status.

## Files Changed By This Review

- `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`

## Remaining Issues

None blocking for Domain A.

Domains B-F still own the actual candidate service, parser-free operation bridge, Editor UX, Product Preflight diagnostics, and focused e2e implementation. Domain A only fixes the boundary, sample target, required statuses, evidence requirements, caps, and early escape conditions.

## User-Decision Points

None required for Domain A pass.

Future decisions outside Domain A remain:

- Raising candidate enumeration, approved leaf count, or approved byte caps.
- Allowing explicit hidden leaf materialization.
- Moving beyond root/group preview plus explicit leaf approval into all-layer import or recursive group import.
- Permitting public/demo use of sample-derived visual assets.
