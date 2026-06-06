# Wave49 Domain A Report: Boundary / Target Inventory / Operation Parity

> Target: `wave49-boundary-target-inventory-operation-parity`
> Role: Orch-Sylph domain completion report; source implementation is forbidden, inventory/report drafting was delegated to Gnome
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Wave49 Domain A fixes the boundary for the next source domains. The accepted Wave49 scope is a generalization of Wave48 import-plan preview and explicit leaf approval: from the fixed three-leaf proof to arbitrary eligible PSD leaf refs supplied explicitly by a human or external Codex workflow. This report does not implement source behavior. It records the target inventory, compatibility constraints, required result refs, failure taxonomy, non-goals, and early escape triggers for later Wave49 domains.

No `apps/**`, `packages/**`, `scripts/**`, e2e/test source, fixture/generated data, package manifest, lockfile, public asset, or sample-derived visual byte was edited.

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Basis Documents Used

- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-final-integration-report.md`
- `discussion/implementation/reviews/wave48/wave48-final-integration-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- `discussion/implementation/waves/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-report.md`
- `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
- `discussion/implementation/waves/wave48/wave48-domain-d-editor-import-plan-preview-explicit-approval-ux-report.md`
- `discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md`
- `discussion/implementation/waves/wave48/wave48-domain-f-psd-import-plan-focused-e2e-persistence-regression-report.md`
- `discussion/implementation/reviews/wave48/*` where cited by Wave48 final integration evidence
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`
- Relevant source/evidence shape inspections in:
  - `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts`
  - `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts`
  - `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
  - `packages/package-format/src/psd-import-plan-evidence.ts`
  - `packages/operation-core/src/psd-import-plan-approval-evidence.ts`
  - `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts`
  - `packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts`
  - `packages/validator-core/src/check-catalog.ts`

## Accepted Wave49 Boundary

- Upstream gate: Wave48 final integration rerun and clean review are `pass`; Wave48 is the latest implementation-proven baseline.
- Domain A scope: inventory/report only. Later domains own implementation.
- Wave49 source boundary: arbitrary eligible leaf refs from an existing explicit PSD import-plan candidate preview may be explicitly approved, unapproved, dry-run/preflighted, executed, and inspected.
- Discovery boundary: candidate discovery remains `psd:root` or explicit PSD group scope preview with `recursiveLeafCandidatePreview`. Group/root rows are context only, not import entries.
- Execution boundary: only explicitly approved eligible leaf refs may be passed to the existing approved-leaf batch materialization/intake path.
- Codex-facing boundary: external Codex may provide exact refs and operation parameters through existing `packages/ai-interface` / operation API / in-process command host style surfaces. The repo/editor remains the deterministic state, validation, dry-run, diff, approval, commit, transcript, evidence, and machine-readable error surface.
- Transport boundary: no HTTP, WebSocket, MCP server, or other external transport work is part of Wave49.
- Automation boundary: repo/editor does not generate proposals, infer semantics, classify PSD parts, place deformers, rank candidates, repair operations, or commit inferred edits.

## Definition: Arbitrary Eligible Leaf

For Wave49, an arbitrary eligible leaf is a PSD leaf candidate that satisfies all of these constraints:

- It appears in a current parser-free candidate plan for an explicit `psd:root` or group scope.
- It is a layer candidate, not a group/context row.
- It has stable source identity: `sourceAssetId`, `sourceLayerId`, optional `sourceLayerName`, `sourceLayerPath`, source PSD digest, byteLength, and candidate plan digest.
- It is visible in source and has positive bounds.
- It has `candidate` status and no blocking status. `duplicateName` may be present as a non-blocking warning when path/ref-aware generated IDs avoid collision.
- It does not have any of these blocking statuses: `hidden`, `unsupported`, `emptyZeroSize`, `duplicateRef`, `generatedIdCollision`, `generatedNameCollision`, `byteCapBlocked`.
- It has empty `approvalBlockedReasons`.
- It is still current against source PSD identity, candidate plan digest, approval selection digest, destination parent, and current bytes.
- It is within approved count and byte caps.

Default `notApproved` is not a blocker by itself. It means the candidate is visible in preview only until a human or external Codex workflow supplies an explicit approved leaf-ref list. Eligibility never depends on semantic name meaning, image interpretation, or inferred part role.

## Wave48 Fixed3 Compatibility That Must Remain

The Wave48 focused path remains a regression gate. Wave49 must preserve it while allowing non-fixed eligible refs.

| Order | Display path | Candidate ref | Materialization id | Generated refs | Digest / bytes |
|---:|---|---|---|---|---|
| 1 | `headwear` | `psd:root/layer[0]` | `mat_psd_root_layer_0` | `part_headwear`, `draw_headwear`, `mesh_headwear`, `tex_headwear` | `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a` / `460800` |
| 2 | `eyewear` | `psd:root/layer[3]` | `mat_psd_root_layer_3` | `part_eyewear`, `draw_eyewear`, `mesh_eyewear`, `tex_eyewear` | `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708` / `116600` |
| 3 | `tie / tie` | `psd:root/group[6]/layer[0]` | `mat_psd_root_group_6_layer_0` | `part_tie_tie`, `draw_tie_tie`, `mesh_tie_tie`, `tex_tie_tie` | `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673` / `232960` |

Required compatibility facts:

- `psdImportPlanFocused` still uses `test_data/sample_model.psd`, `psd:root`, `126` candidates, `121` eligible/visible candidates, `5` hidden or unsupported blocked candidates, and only the three approved leaves above.
- Approved materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.
- The batch path remains `importPsdLayerMaterializationBatch` with `psd-layer-materialization-batch-operation-evidence-v1`.
- Candidate and approval bridge evidence remains parser-free: `psd-import-plan-candidate-evidence-v1`, `psd-import-plan-approval-evidence-v1`, and `psd-import-plan-approval-bridge-evidence-v1`.
- Save/load and portable bundle behavior remains truthful: source PSD bytes, raw parser objects, and session import-plan bridge capability are not persisted as package/session capability; only approved materialized private/local texture payloads persist.
- Stale approval UI/workflow behavior remains fixed: approval control changes require preview regeneration before execution.

## Selected Targets And Scenarios

### Non-Wave48 Eligible Candidate

Candidate selected for later focused proof beyond the fixed three:

| Candidate | Ref | Evidence | Wave49 use |
|---|---|---|---|
| `front hair` | `psd:root/group[2]/layer[0]` | Existing Wave44 parser smoke representative layer and current rerun: visible `true`, bounds `620 x 620` at `692,144`, estimated raw RGBA bytes `1537600`. | First candidate for arbitrary eligible approval/execution beyond `headwear`, `eyewear`, and `tie / tie`. Later implementation domains should assert the actual candidate-plan status from the current service, then approve this exact ref explicitly. |

This candidate is selected because it is a visible positive-size leaf under `psd:root`, is not one of the Wave48 fixed3 leaves, and is already evidenced by the approved parser smoke path. Domain A does not claim materialized digest or generated result refs for this leaf; those must be produced by later execution evidence.

### Blocked / Not-Approved / Hidden / Stale Scenarios

| Scenario | Target / trigger | Evidence | Expected later behavior |
|---|---|---|---|
| Hidden sample leaf | `psd:root/layer[1]` / `headwear` | Current parser smoke rerun: visible `false`, bounds `400 x 286` at `807,93`, estimated raw RGBA bytes `457600`; Wave48 root summary has `5` hidden leaves. Service code maps hidden leaves to hidden unsupported approval blocking with default not-approved preview. | Candidate may be listed for preview/status, but must not execute unless a future policy explicitly supports hidden materialization. Later tests can assert `hidden`, `unsupported`, `notApproved`, and `hiddenLayerUnsupported` where exposed. |
| Not-approved selected | Any preview candidate omitted from explicit approved list, including fixed3 or `front hair` before approval. | Wave48 bridge/e2e records not-approved and blocked candidates separately from approved leaves. | Passing a not-approved candidate to batch intake must produce a machine-readable rejection before mutation. |
| Stale source identity | Candidate plan or approval source digest/byteLength/source asset differs from current source evidence. | Wave48 Domain E tests and review cover `asset.psd.importPlanSourceStale`; Domain C bridge rejects stale or mismatched evidence before mutation. | Require reparse/replan/reapproval; no silent trust of stale refs. |
| Collision / cap / empty blocked | Generated id/name collision, duplicate approval ref, zero-size, or byte cap trigger. | Wave48 candidate service and validator tests cover synthetic hidden/unsupported/empty/collision/byte-cap cases. | Machine-readable blocked state; no partial hidden execution. |

## Required Stable Refs And Evidence Fields

Later domains must expose these fields in dry-run/preflight/result inspection so human UI and Codex-facing in-process commands can perform equivalent explicit operations.

| Area | Required stable fields |
|---|---|
| Candidate plan | `planId`, `candidatePlanDigest`, source PSD identity, scope ref/display path/discovery mode, `candidateIndex`, `sourceLayerRef.sourceLayerId`, `sourceLayerName`, `sourceLayerPath`, bounds, `visibleInSource`, byte estimate, statuses, status reasons, approval blocked reasons, generated scaffold preview refs. |
| Approval evidence | `approvalId`, `approvalSelectionDigest`, approved leaf refs in explicit order, destination parent part, approval status, not-approved candidates, blocked candidates, collision/preflight summary, boundary flags. |
| Execution result | Batch `operationId`, child/per-layer operation IDs, `batchId`, aggregate status, per-entry status, selected index, materialization id, materialized byteLength, digest, generated part/drawable/mesh/texture refs, source layer ref/path, diagnostics. |
| Package/source evidence | `psd-import-plan-candidate-evidence-v1`, `psd-import-plan-approval-evidence-v1`, `psd-import-plan-approval-bridge-evidence-v1`, `psd-layer-materialization-evidence-v1`, `psd-layer-materialization-batch-operation-evidence-v1`, source manifest refs where present. |
| Diagnostics/issues | Operation diagnostic check IDs, Product Preflight check IDs, target paths, evidence refs, issue IDs, and blocking status codes. |
| Persistence boundary | `rawParserObjectPersistence=notPersisted`, source bytes metadata-only, materialized bytes through binary asset refs only, `publicDemoAsset=false`, no portable persistence of session-only import-plan bridge capability. |

## Machine-Readable Failure Taxonomy

Wave49 should retain Wave48 names unless a later source domain has a narrow compatibility reason to add an alias. Do not rename existing IDs casually.

| Layer | Machine-readable values / IDs | Required interpretation |
|---|---|---|
| Candidate status | `candidate`, `hidden`, `unsupported`, `emptyZeroSize`, `duplicateRef`, `duplicateName`, `generatedIdCollision`, `generatedNameCollision`, `byteCapBlocked`, `notApproved` | `candidate` means eligible pending explicit approval. `duplicateName` is warning only. The others listed as blocking above prevent execution. |
| Approval status | `approved`, `candidatePlanStale`, `candidatePlanMismatch`, `approvalSelectionMismatch`, `preflightBlocked` | Execution requires `approved`; every other status blocks execution and should point to reparse/replan/reapproval or collision/cap resolution. |
| Batch aggregate/entry | `success`, `preflightBlocked`, `partialFailure`, `failure`; entry `success`, `preflightReady`, `preflightBlocked` | Current policy is preflight-blocks-on-any-failure with silent partial success forbidden. If future code reaches partial, committed and failed refs must be explicit. |
| Operation diagnostics | `operation.importPsdLayerMaterializationBatch.importPlanApprovalMissingLeaf`, `importPlanApprovedLeafMismatch`, `importPlanCandidateMissing`, `importPlanNotApprovedCandidateSelected`, `importPlanBlockedCandidateSelected`, `importPlanMaterializationSourceMismatch`, `importPlanGeneratedScaffoldMismatch`, `importPlanCandidateDigestMismatch`, `importPlanApprovalNotApproved`, `importPlanApprovedLeafCountMismatch`, `importPlanSourceAssetMismatch`, `importPlanSourcePsdMismatch`, `importPlanDestinationMismatch` | Reject stale, missing, mismatched, blocked, not-approved, wrong destination, and generated-scaffold mismatch cases before mutation. |
| Existing batch diagnostics | `layerCountCapExceeded`, `totalByteLengthCapExceeded`, `missingDestinationParentPart`, `duplicateLayerRef`, `duplicateGeneratedId`, `idNameCollision` | Continue to apply alongside import-plan diagnostics. |
| Product Preflight check IDs | `asset.psd.importPlanEvidenceMissing`, `asset.psd.importPlanEvidenceMismatch`, `asset.psd.importPlanCandidateMismatch`, `asset.psd.importPlanCandidateStatusSummary`, `asset.psd.importPlanApprovalMismatch`, `asset.psd.importPlanNotApprovedCandidateSelected`, `asset.psd.importPlanCandidateBlocked`, `asset.psd.importPlanPreflightBlocked`, `asset.psd.importPlanPartialState`, `asset.psd.importPlanSourceCurrentBytesMissing`, `asset.psd.importPlanSourceStale`, `asset.psd.importPlanProvenanceBlocked` | Report parser-free import-plan state truthfully, including `not_evaluated` when current source bytes or bridge evidence are unavailable. |

## Codex-Facing Human-Equivalent Operation

Wave49 Codex-facing work should mean existing in-process operation parity, not a new product automation system.

- Codex may read current state, inspect candidate plans, provide an exact approved leaf-ref list, request dry-run/preflight, request approved execution, and inspect stable result refs.
- Codex may use `packages/ai-interface` and the existing in-process command host style surface. External transport is outside scope.
- The repo/editor must validate and execute explicit operations only. Any proposal composition, semantic reasoning, candidate choice, or operation sequence planning belongs outside the repo/editor.
- The Editor UI remains simple explicit approve/unapprove/execute/inspect/result-view controls.

## Non-Goals

- Repo/editor proposal generation, semantic inference, candidate ranking, auto-classification, auto-placement, auto-repair, automatic commit, or embedded LLM/provider/prompt flow.
- Smart Editor UI or wording that implies recommendation, semantic PSD understanding, automatic rigging, or repair generation.
- All-layer one-click PSD import, recursive group auto import, group-as-artmesh import, direct group import as artmesh, automatic part hierarchy inference, or hidden leaf auto approval.
- HTTP, WebSocket, MCP server, or other external transport.
- Drag-drop, File System Access API, directory picker, ZIP/archive/native filesystem/cloud transport.
- Photoshop-style full compositing, renderer/pixel oracle, texture sampling correctness, Cubism SDK/Core/export/runtime compatibility.
- Public demo asset availability or publication of sample PSD-derived visual bytes.

## Early Escape Triggers For Later Domains

Return `escalate` or `blocked` if implementation requires any of the following:

- Repo/editor proposal generation, semantic part inference, smart classification, candidate ranking, automatic rigging, automatic repair, or automatic commit.
- External transport or LLM/provider integration.
- Importing all candidates by default, recursive group execution, group-as-artmesh behavior, or execution without explicit approved leaf refs.
- Direct parser dependency use in `packages/**`, runtime, validator, or non-approved parser sites.
- Persisting raw parser objects or source PSD bytes as package/session capability.
- Public/demo use of sample-derived visual bytes.
- Schema-breaking generated ref changes needed to expose result refs.
- Higher caps, workerization, hidden leaf materialization, archive/filesystem work, renderer/pixel oracle, or Cubism claims.
- Parallel domains needing to edit the same files or overlapping source contracts without coordination.

## Verification Performed

| Command / check | Result |
|---|---|
| `node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd` parsed via PowerShell `ConvertFrom-Json` | pass. Source byteLength `22406225`, SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, groups `20`, layers `126`, visible `121`, hidden `5`, raster candidates `126`; `front hair` ref `psd:root/group[2]/layer[0]`, visible `true`, bounds `620x620@692,144`, estimated raw RGBA `1537600`; hidden `headwear` ref `psd:root/layer[1]`, visible `false`, bounds `400x286@807,93`, estimated raw RGBA `457600`. |
| `git diff --check -- discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | pass. |
| `rg -n "[ \t]+$" discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md` | pass; exit code `1` with no trailing-whitespace matches. This supplements `git diff --check` because the report is currently untracked. |
| `rg -n "Codex-facing|human-equivalent|packages/ai-interface|in-process|Automation boundary|repo/editor does not" discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md` | pass; boundary terms are present. |
| `rg -n "^[A-Za-z0-9].*(implements|adds|supports|provides|generates|infers|classifies|recommends|auto-places|auto-executes).*(proposal|semantic|auto-classification|auto-placement|automatic rigging|all-layer one-click|recursive group auto|group-as-artmesh|public demo asset)" discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md` | pass; exit code `1` with no matches, so no positive smart automation or forbidden-scope claim was found in prose claim lines. |

## Files Changed

- `discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`

## Unresolved Risks

- Domain A did not execute `front hair`; later source/e2e domains must generate actual candidate-plan approval/result refs and materialized digest evidence before claiming execution support for that leaf.
- Exact generated result refs for non-fixed leaves must come from source execution evidence, not from this report.
- Hidden leaf materialization remains not approved. If the product direction changes, it needs a separate design decision and tests.
- Existing untracked Wave49 plan/policy and modified map/backlog files were treated as upstream basis or unrelated worktree state and were not edited by this task.
