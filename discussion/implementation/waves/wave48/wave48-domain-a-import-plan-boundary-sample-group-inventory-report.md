# Wave48 Domain A Report: Import Plan Boundary / Sample Group Inventory

> Target: `wave48-import-plan-boundary-sample-group-inventory`
> Role: Gnome drafting agent
> Verdict candidate: `pass`

## Verdict

verdict: `pass`

Wave48 Domain A can proceed with a bounded import-plan preview contract. The selected focused target is the PSD document root `psd:root`, with the Wave47 proven leaves `headwear`, `eyewear`, and `tie / tie` used as the explicit approved subset for the first focused e2e. This is a root-scope candidate discovery step only; it does not claim all-layer import, recursive group auto import, group import, drag-drop, archive/filesystem access, Photoshop-style full compositing, renderer/pixel oracle, texture sampling correctness, Cubism compatibility, public demo assets, or repo-side repair/LLM behavior.

No source implementation, dependency manifest, lockfile, review artifact, raw visual byte, public demo asset, or sample-derived public asset was created or edited.

Current-run note: this target report already existed as an untracked Wave48 artifact before this pass. This pass inspected it, reran the sample PSD inspection, checked the listed basis documents, and updated the verification bookkeeping below so the persistent output is current for this Domain A run.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave47/wave47-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-h-clean-integration-review.md`
- `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
- `discussion/implementation/waves/wave47/wave47-domain-f-psd-multi-layer-focused-e2e-persistence-regression-report.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

Narrow script inspection: `scripts/wave44-psd-parser-smoke.mjs` was read to confirm it is the existing Wave44 approved parser smoke path and writes evidence to stdout only.

## PSD Inspection

Successful sample PSD inspection command:

```powershell
node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd
```

Concise result from the command output:

- Parser: `@webtoon/psd` `0.4.0`
- Source: `test_data/sample_model.psd`
- Source byteLength: `22406225`
- Source SHA-256: `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`
- Source provenance: private/local fixture, `publicDemoAsset=false`
- Document: `2048 x 3072`, channelCount `4`, depth `8`, colorMode `3`, root childCount `14`
- Tree summary: `20` groups, `126` leaf layers, `121` visible leaf layers, `5` hidden leaf layers, `0` zero-size leaves, maxDepth `3`
- Root candidate leaf raw RGBA estimate: all leaves `49172000` bytes; visible positive leaves `40626328` bytes
- Wave47 approved subset raw RGBA estimate: `810360` bytes
- Duplicate-name pressure exists at root scope: examples include `eyelash-r`, `mouth`, `eyebrow-l`, `eyebrow-r`, `eyelash-l`, and `nose` with `10` same-name leaves each.

The command did not persist raw RGBA bytes, screenshots, public demo assets, source PSD bytes, or raw parser objects.

## Selected Sample Target

Selected sample group/root candidate target: `psd:root`.

Why this target is stable:

- It is the only single sample scope that includes all Wave47 proven leaves: `headwear`, `eyewear`, and grouped leaf `tie / tie`.
- It uses the existing Wave44 parser smoke / Wave45-47 Editor browser parser boundary shape and does not require a parser dependency expansion.
- The root scope exercises both root leaves and a grouped leaf while keeping execution explicitly leaf-approved.
- The root candidate list intentionally includes hidden and duplicate-name pressure, which makes Wave48 preview/status evidence meaningful without importing anything automatically.
- The focused e2e remains small because only the three proven leaves below are approved for execution.

| Approval order | Candidate path | Candidate ref | Default status before approval | Bounds | Estimated / proven raw bytes | Wave47 materialized digest |
|---:|---|---|---|---|---:|---|
| 1 | `headwear` | `psd:root/layer[0]` | `candidate`, `notApproved` | `400 x 288` | `460800` | `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a` |
| 2 | `eyewear` | `psd:root/layer[3]` | `candidate`, `notApproved` | `265 x 110` | `116600` | `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708` |
| 3 | `tie / tie` | `psd:root/group[6]/layer[0]` | `candidate`, `notApproved` | `104 x 560` | `232960` | `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673` |

Default e2e approval selection: the three refs above, in the listed order, under destination parent `part_root`, destination kind `generatedPartScaffold`.

## Candidate Discovery Semantics

- Input scope is a parser session source plus one explicit scope ref: either `psd:root` or a PSD group ref.
- Discovery walks the selected scope recursively to build a leaf candidate list. The walk must preserve parser refs, full path segments, display names, bounds, visibility, opacity/composedOpacity when available, and source order.
- Group rows may be displayed as context or filters, but group rows are not import entries and are not passed to Wave47 batch intake.
- Import execution requires an explicit approved leaf list. There is no default "approve all" behavior.
- Candidate refs are parser-session refs such as `psd:root/layer[0]`; generated package IDs must be derived from path/ref-aware sanitized tokens, not final display name alone.
- Candidate discovery may estimate raw RGBA bytes from `width * height * 4`; this estimate is preflight evidence, not materialized byte proof.
- Candidate discovery must not persist raw PSD bytes, raw parser objects, raw visual bytes, screenshots, or public sample assets.

## Default Candidate Statuses

Candidate records may carry multiple machine-readable statuses. v0 should keep these status IDs stable:

| Status ID | Meaning | Execution behavior |
|---|---|---|
| `candidate` | Visible leaf with positive bounds and no detected v0 blocker. | Eligible for explicit approval, but not executed unless approved. |
| `hidden` | Leaf is hidden in the PSD tree. | Hidden-by-default; do not pass to batch intake unless a later approved domain explicitly supports hidden approval with evidence. |
| `unsupported` | Group/container row, unsupported parser feature, unsupported layer kind, unavailable raster extraction, or unsupported hidden-layer policy. | Never silently import. Show reason. |
| `emptyZeroSize` | Leaf has width or height `0`. | Never materialize; report as empty/zero-size. |
| `duplicateRef` | Same source layer ref appears more than once in a plan or approval list. | Block repeated entry; preserve canonical first ref. |
| `duplicateName` | Same display name appears under different paths. | Does not block by itself, but requires path/ref-aware generated ID preview and collision preflight. |
| `generatedIdCollision` | Generated texture/drawable/mesh/part ID collides with package state or another approved entry. | Collision-blocked until explicit deterministic resolution. |
| `generatedNameCollision` | Generated display name or scaffold label collides in a way the UI/package cannot present truthfully. | Collision-blocked until explicit deterministic resolution. |
| `byteCapBlocked` | Per-leaf or approved-selection byte/count cap would be exceeded. | Do not execute blocked entries. Show cap and estimate/actual. |
| `notApproved` | Candidate is listed but not selected by the user approval step. | Must not be passed to Wave47 batch intake. |

Recommended record shape:

- `statuses: string[]`
- `statusReasons: string[]`
- `isApproved: boolean`
- `approvalBlockedReasons: string[]`

This avoids collapsing `candidate` and `notApproved`: an eligible leaf can be both `candidate` and `notApproved` until the user explicitly approves it.

## Approval Semantics

- Only approved leaf refs are passed to the existing Wave47 batch materialization/intake path.
- Approval is an ordered explicit leaf-ref list plus destination parent part and generated scaffold preview.
- Not-approved, unsupported, hidden-by-default, duplicate-ref, generated-collision, and byte-cap-blocked candidates must not be silently imported.
- The approval bridge must revalidate that each approved ref still exists in the candidate plan digest and that source PSD hash/byteLength still match current session evidence.
- If candidate plan evidence is stale or mismatched, execution must require reparse/replan/reapproval.
- Partial success must remain truthful: if a later domain allows per-layer mutation before a failure, it must report committed refs and failed refs exactly. If preflight blocks, no mutation should occur.

## Evidence Requirements

Session evidence for Domains B/D/F must include:

- `candidatePlanDigest`: SHA-256 over canonical parser-free candidate plan JSON.
- Source PSD identity: file name, byteLength, SHA-256, mediaType if declared, current-byte availability, private/local provenance, `publicDemoAsset=false`.
- Parser/adapter identity: parser package/name/version, adapter version or implementation label, runtime, extraction policy.
- Scope identity: `scopeRef`, scope display path, source child order, discovery mode `recursiveLeafCandidatePreview`.
- Candidate identity: candidate ref, full path, display name, kind `layer`, parent group refs/names, bounds, visible/hidden, opacity/composedOpacity if available, byte estimate.
- Candidate statuses and reasons, including not-approved candidates.
- Approval selection: approved leaf refs/order, destination parent part, approved byte estimate, approval timestamp or operation id if available.
- Generated scaffold preview: planned `partId`, `drawableId`, `meshId`, `textureId`, display names, collision status, and destination kind.
- Boundary flags: private/local provenance, `publicDemoAsset=false`, no source PSD byte persistence, no raw parser object persistence, no public asset claim.

Parser-free package / operation evidence for Domains C/E/F must include:

- Candidate plan digest and approval selection digest or equivalent immutable approval evidence.
- Source PSD hash/byteLength and source asset id, without storing source PSD bytes as a package capability.
- Approved leaf refs/path/name/statuses/order and not-approved/blocked candidate summary.
- Generated scaffold preview/resolved IDs and destination parent part.
- For approved materialized leaves only: Wave47 raw RGBA materialized binary asset ref, mediaType `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`, digest, byteLength, width, height, source layer ref/path, extraction options, operation id, and private/local provenance.
- Explicit `publicDemoAsset=false`.
- No raw parser object, no source PSD bytes, no raw/visual materialized bytes inline in package evidence, and no public demo asset wording.

## Byte Estimate And Caps

Recommended v0 caps:

| Cap | Recommendation | Sample root result |
|---|---:|---|
| Source PSD parse cap | `32 * 1024 * 1024` bytes | Source is `22406225`, under cap. |
| Candidate enumeration cap | `200` leaf candidates per plan | Root has `126`, under cap. |
| Per-leaf raw RGBA cap | `64 * 1024 * 1024` bytes | Wave47 subset leaves are all under cap. |
| Approved leaf count cap | `4` approved leaves per execution | Wave47 subset uses `3`, under cap. |
| Approved total raw RGBA cap | `32 * 1024 * 1024` bytes | Wave47 subset is `810360`, under cap. |

Root preview is intentionally larger than the approved execution cap: visible positive candidate estimate is `40626328` bytes and all-leaf estimate is `49172000` bytes. This is acceptable for preview because no bytes are materialized by candidate discovery. It also proves why v0 must not provide "approve all" or recursive root/group auto import. Any approval selection above count or byte caps is `byteCapBlocked`.

If a later product decision needs larger approvals, workerization, streaming materialization, or higher caps, that is outside Domain A and should be escalated.

## Early Escape For Domains B-F

Domain B should return `escalate` or `blocked` if candidate discovery needs direct parser imports outside the approved Editor/browser adapter or Wave44 scripts, requires new dependencies, cannot represent hidden/unsupported/collision/byte-cap states parser-free, needs workerization or higher caps to handle `psd:root`, or must silently truncate candidates.

Domain C should return `escalate` or `blocked` if package/operation evidence requires raw parser objects, source PSD byte persistence, public schema-breaking changes, silent import of not-approved candidates, or a bridge that cannot preserve candidate plan digest and approval selection.

Domain D should return `escalate` or `blocked` if the UX requires all-layer one-click import wording, recursive group auto import, drag-drop/filesystem/archive features, hidden leaf auto approval, public demo asset wording, or a workflow that can execute without explicit approved leaf refs.

Domain E should return `escalate` or `blocked` if Product Preflight/validator diagnostics require direct parser execution in `packages/**`, persisted/exported Product Preflight artifacts, candidate diagnostics used as sole MVP-blocking oracles without contract support, or omission of missing/stale/not-approved/blocked evidence.

Domain F should return `escalate` or `blocked` if focused e2e cannot use `psd:root` preview plus explicit approval without importing all candidates, if source PSD bytes/raw parser objects are persisted, if the test needs renderer/pixel/texture-correctness or Photoshop compositing oracles, if public sample/demo asset output is required, or if the Wave47 leaf refs/digests no longer match the sample.

All Domains B-F should stop rather than widening scope if implementation requires all-layer import, recursive group import, broader/general PSD materialization, archive/filesystem/File System Access API, full compositing, renderer/pixel oracle, Cubism compatibility, public demo assets, repo-side repair generation, LLM/provider integration, natural-language repair, or auto-fix.

## Files Changed

- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`

No `apps/**`, `packages/**`, `scripts/**`, dependency manifest, lockfile, fixture byte, public demo asset, raw visual byte, or Wave48 review artifact was edited.

## Verification Performed

- `node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd`
  - Passed. Concise result recorded in "PSD Inspection".
- `git diff --check -- discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
  - Passed with no output. The target report is currently untracked, so a supplemental `Select-String -Path discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md -Pattern "\s+$"` trailing-whitespace scan was also run and returned no output.
- `git status --short -uall -- discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
  - Shows this target report as an untracked Wave48 Domain A artifact.
- `git status --short -uall -- apps packages scripts package.json pnpm-lock.yaml`
  - No output; no source/dependency files were edited by this Domain A task.

Pre-existing worktree state outside this task was observed before this update: `discussion/implementation/orchestration/_map.md` was modified, `discussion/implementation/orchestration/wave48-plan.md` was untracked, and `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md` was untracked. Domain A did not edit those paths.

## Remaining Issues

- Domains B-F must implement and verify the actual candidate plan service, approval bridge, UX, diagnostics, and focused e2e. Domain A only fixes the boundary and sample target.
- Exact generated scaffold IDs for the Wave48 approval preview should be confirmed by Domains C/D using existing Wave47 helper behavior; Domain A requires path/ref-aware deterministic IDs and collision evidence but does not edit source.
- Hidden leaf approval remains intentionally conservative. v0 lists hidden leaves as hidden/not-approved; if a later domain wants explicit hidden materialization, it needs evidence and may need design review.
- Root preview all-candidate byte estimate exceeds the recommended approved execution cap. This is expected and must remain a preview/status fact, not a reason to add "approve all".

## User-Decision Points

None required for Domain A pass.

Future decisions outside Domain A:

- Raise candidate enumeration, approved leaf count, or approved byte caps.
- Allow explicit hidden leaf materialization.
- Move beyond root/group preview plus explicit leaf approval into all-layer import or recursive group import.
- Permit public/demo use of sample-derived visual assets.
