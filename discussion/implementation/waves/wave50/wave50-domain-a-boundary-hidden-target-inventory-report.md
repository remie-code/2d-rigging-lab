# Wave50 Domain A Report: Boundary / Hidden / Target Inventory

> Target: `wave50-boundary-hidden-target-inventory`
> Role: Orch-Sylph domain completion report
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Wave50 Domain A locks the boundary for explicit deterministic PSD structural import. The next domains may implement an additive structural scaffold path where explicitly approved PSD roots, groups, subtrees, or leaf sets are copied into the project initial model structure without semantic recognition. This report does not implement source behavior.

Source implementation is N/A for this domain. No Gnome source implementation task was started because Domain A only records the boundary, target inventory, taxonomy changes, cap policy, and early escape rules under the allowed discussion paths. If any later Domain A finding had required `apps/**`, `packages/**`, `scripts/**`, validator, operation, package, or Editor source edits, this run would have returned `escalate`.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave49/wave49-final-integration-report.md`
- `discussion/implementation/reviews/wave49/wave49-final-integration-review.md`

Narrow source and test evidence inspected:

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-result.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/psd-import-plan-evidence.ts`
- `packages/package-format/src/model-graph.ts`
- `packages/package-format/src/model-files.ts`
- `packages/authoring-core/src/runtime-visibility-mutations.ts`
- `packages/authoring-core/src/runtime-graph-drawables.ts`
- `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Final Boundary Wording

Final Wave50 wording:

Wave50 implements explicit deterministic PSD structural import. Given an explicitly approved PSD root, group, subtree, or leaf set, the repo/editor may deterministically copy PSD tree structure into a project-defined initial scaffold: PSD groups become project part containers, and PSD leaf layers become texture, drawable, and empty bounded mesh scaffold entries. The import preserves source refs, parentage, source order, source visibility, source opacity, bounds, generated refs, result refs, and evidence.

This is not semantic recognition. The repo/editor must not infer that a group or layer means eye, hair, mouth, expression, clothing, rig role, deformer, parameter, keyform, physics, mask, or any other artistic or rigging concept from names, pixels, paths, or PSD grouping. Any interpretation, proposal composition, or operation planning remains external Codex/LLM or human responsibility. The repo/editor remains the deterministic validation, dry-run, diff, approval, commit, transcript, evidence, stable-ref, and machine-readable error surface.

Operational consequences:

- Root/group/subtree approval is allowed only when the approval is explicit and digest-bound.
- Structural expansion may create project part containers for PSD groups.
- Group nodes must never become drawables, textures, meshes, or ArtMeshes.
- Leaf nodes may create texture/drawable/empty bounded mesh scaffold entries.
- Existing Wave48/Wave49 leaf-only import-plan behavior and focused IDs must remain valid.
- No Editor UI may describe this as suggest, auto-classify, recommended rigging, auto-rigging, auto-repair, smart recognition, or semantic PSD understanding.

## Current Repository Facts

Current parser/profile facts:

- The browser PSD parser adapter records `sourceGroups` and `sourceLayers`.
- Source layer records include `sourceLayerId`, `originalName`, `normalizedName`, parent group context, `groupPath`, `sourceOrder`, bounds, `visibleInSource`, and `opacityInSource`.
- Source group records include `sourceGroupId`, `originalName`, `normalizedName`, `parentGroupId`, `groupPath`, `sourceOrder`, `visibleInSource`, `opacityInSource`, and unsupported feature slots. The current browser adapter records group visibility as `true`; group opacity is evidence only.

Current import-plan facts:

- The candidate service sorts source layers by `sourceOrder`.
- Hidden leaves currently get statuses `hidden`, `unsupported`, and `notApproved`, plus approval blocker `hiddenLayerUnsupported`.
- Current blocking status sets include `hidden`.
- `duplicateName` is currently warning-like; path/ref-aware generated IDs are required.
- Existing caps are source bytes `32 MiB`, candidate leaves `200`, per-leaf raw RGBA `64 MiB`, approved leaves `4`, and approved total raw RGBA `32 MiB`.

Current materialization/runtime facts:

- Existing single-layer materialization creates a drawable with `defaultOpacity: 1` and `runtimeVisibility: true`.
- Existing batch execution is flat and leaf-only: each approved leaf gets a generated part under one destination parent.
- The project `ModelPart` schema has `partId`, `displayName`, `parentPartId`, `childPartIds`, and `drawableIds`; it has no runtime visibility or opacity fields.
- Drawable schema has `defaultOpacity` and `runtimeVisibility`; runtime drawables project those fields to runtime `opacity` and `visible`.

## Hidden Positive-Size Leaves

Accepted Wave50 rule:

Hidden positive-size PSD leaf layers are eligible when explicitly included and materializable. They must create initially runtime-hidden drawables.

Eligibility requirements:

- The target is a leaf layer, not a group.
- The source ref is present in the current candidate/structural plan.
- The source PSD identity and candidate/structural plan digest still match current session evidence.
- Bounds are positive.
- Raw materialization is available within per-leaf and total caps.
- The leaf has no other blocking condition such as unsupported layer role/features, duplicate source ref, generated ID collision, generated name collision, byte cap, missing current bytes, source identity mismatch, or destination parent failure.
- The leaf is explicitly approved or covered by an explicit structural approval. Hidden status alone is not approval.

Runtime behavior:

- `visibleInSource: false` maps to `initialRuntimeVisibility: false`.
- `visibleInSource: true` maps to `initialRuntimeVisibility: true`.
- This mapping applies at the drawable level only.
- Leaf opacity may map to drawable/default opacity only where the existing schema and tests make the semantics deterministic. If exact semantics are ambiguous, preserve source opacity as evidence and avoid compositing claims.
- Hidden leaf materialization is not Photoshop compositing, not expression logic, and not semantic variant recognition.

Required taxonomy changes for later domains:

- Keep candidate status `hidden` as source evidence, but remove it from blocking candidate status sets for Wave50 structural mode when the leaf is positive-size and materializable.
- Stop emitting `unsupported` solely because a leaf is hidden.
- Stop emitting approval blocker `hiddenLayerUnsupported` for eligible hidden positive-size leaves.
- A hidden eligible leaf may carry `candidate`, `hidden`, and `notApproved` before approval.
- A hidden approved leaf should carry `candidate` and `hidden`, with explicit `initialRuntimeVisibility: false` in approval/result evidence.
- Existing issue kind `hiddenCandidate` should remain only as legacy/blocked evidence for Wave48/Wave49-style blocked hidden candidates or for genuinely unsupported hidden cases. It must not be emitted merely because a Wave50 approved hidden leaf is hidden.
- Add or reserve a runtime visibility mismatch issue/check for Wave50 structural results. Recommended issue kind: `initialRuntimeVisibilityMismatch`; recommended checks:
  - `asset.psd.structuralInitialRuntimeVisibilityMismatch`
  - `operation.importPsdStructuralScaffold.initialRuntimeVisibilityMismatch`
- Add or reserve a structural cap issue/check for node/group/leaf count or depth failures. Recommended issue kind: `structuralExpansionCapExceeded`; recommended checks:
  - `browserPsdStructuralPlan.structuralExpansionCapExceeded`
  - `operation.importPsdStructuralScaffold.structuralExpansionCapExceeded`
- Existing `byteCapExceeded`, `byteUnavailable`, `currentSessionSourceMissing`, `sourceIdentityMismatch`, `collision`, `destinationParent`, `unsupportedCandidate`, and `emptyCandidate` remain valid for non-hidden blockers.

## Group Visibility And Opacity

Wave50 rule: group visibility and group opacity are evidence-only. They do not directly change runtime behavior in Wave50.

Reasons:

- Current `ModelPart` has no opacity or visibility fields.
- Runtime visibility/opacity are drawable-level properties.
- Group opacity and hidden propagation have Photoshop/compositing semantics that Wave50 explicitly does not claim.
- Treating group visibility as a runtime toggle would require a broader schema and product decision: part visibility, inherited visibility semantics, opacity multiplication, ordering, and save/load/runtime behavior.
- The current browser adapter does not provide a complete runtime-ready group visibility oracle.

Required behavior:

- Preserve source group visibility/opacity evidence where parser/profile data provides it.
- Preserve group source refs, group parentage, group path, source order, bounds if available, and generated group part refs.
- Use leaf `visibleInSource` for initial drawable runtime visibility.
- Do not suppress, hide, multiply, or otherwise alter leaf runtime behavior because a parent group is hidden or semi-transparent in Wave50.
- If later domains discover that a focused proof requires group visibility/opacity to affect runtime output, return `escalate`.

## Focused Sample Targets

Sample source: private/local `test_data/sample_model.psd`.

Read-only sample scan confirmed:

- Source byteLength: `22406225`
- Leaf count: `126`
- Visible leaves: `121`
- Hidden leaves: `5`
- Total all-leaf raw RGBA estimate: `49172000`
- Root child count from Wave44 smoke evidence: `14`
- Group count from Wave44/Wave49 evidence: `20`

Recommended Wave50 structural focused subset:

| Purpose | Display path | Ref | Source order | Visible in source | Bounds / estimate | Expected Wave50 assertion |
|---|---|---:|---:|---|---:|---|
| Duplicate-name visible root leaf | `headwear` | `psd:root/layer[0]` | `0` | `true` | `400 x 288` / `460800` | Eligible visible leaf; duplicate display name must be disambiguated by source ref/path/order, not display name alone. |
| Hidden positive-size root leaf | `headwear` | `psd:root/layer[1]` | `1` | `false` | `400 x 286` / `457600` | Eligible when explicitly approved; generated drawable starts `runtimeVisibility: false`; no `hiddenLayerUnsupported` blocker. |
| Nested visible leaf and group container | `hair_front / front hair` | `psd:root/group[2]/layer[0]` | `3` | `true` | `620 x 620` / `1537600` | Create a `hair_front` project part container and materialize the leaf under that generated parent. |
| Root visible leaf | `eyewear` | `psd:root/layer[3]` | `6` | `true` | `265 x 110` / `116600` | Create leaf scaffold under the selected destination/root structural parent; prove root leaf path. |
| Second nested visible leaf | `tie / tie` | `psd:root/group[6]/layer[0]` | `115` | `true` | `104 x 560` / `232960` | Prove another group container path and higher sourceOrder ordering. |

This five-leaf subset is small enough to stay well below the existing `32 MiB` approved raw RGBA cap while proving the required behaviors. It also makes the duplicate-name assertion concrete through the visible and hidden `headwear` pair.

Required sourceOrder assertions:

- Generated structural order must follow PSD `sourceOrder`, not alphabetical order and not approval order alone.
- For the recommended subset, the deterministic order is:
  1. `psd:root/layer[0]` / sourceOrder `0`
  2. `psd:root/layer[1]` / sourceOrder `1`
  3. `psd:root/group[2]/layer[0]` / sourceOrder `3`
  4. `psd:root/layer[3]` / sourceOrder `6`
  5. `psd:root/group[6]/layer[0]` / sourceOrder `115`
- Generated part child order and drawable draw order should use sourceOrder where applicable and must be explicit in evidence if a different existing graph ordering rule is intentionally retained.

Required focused proof surface:

- Structural preview shows group containers and leaves separately.
- Approval is explicit and digest-bound.
- Execution creates PSD group part containers, never group drawables.
- Visible leaves create runtime-visible drawables.
- Hidden positive-size leaves create runtime-hidden drawables.
- Duplicate display names do not collide because generated refs include stable source refs/path context.
- Save/load preserves generated part hierarchy and drawable runtime visibility.
- Codex-facing in-process command path exposes the same explicit structural refs and rejects stale approval context.

## Conservative Cap And Failure Policy

Wave50 should stay conservative and additive. The focused proof should not require full root execution of all `126` leaves.

Recommended structural preview caps:

| Cap | Recommendation | Sample root status |
|---|---:|---|
| Source PSD parse cap | `32 MiB` | `22406225` bytes, under cap. |
| Structural node enumeration cap | `256` groups plus leaves | Sample has about `146` groups plus leaves, under cap. |
| Leaf candidate enumeration cap | Keep `200` | Sample has `126`, under cap. |
| Structural depth cap | `8` | Sample max depth is within current smoke evidence depth. |

Recommended structural execution caps:

| Cap | Recommendation | Focused subset status |
|---|---:|---|
| Approved structural leaves | `6` | Recommended subset uses `5`. |
| Approved structural groups created | `32` | Recommended subset needs only root child group containers. |
| Per-leaf raw RGBA cap | Keep `64 MiB` | All selected leaves are under cap. |
| Approved total raw RGBA cap | Keep `32 MiB` | Recommended subset estimate is `2805560` bytes. |
| Generated node count cap | `64` total generated groups plus leaf scaffolds | Recommended subset is under cap. |

Failure policy:

- Cap checks run before mutation.
- Source identity, candidate/structural plan digest, approval digest, destination parent, and generated refs are revalidated before mutation.
- Any cap, stale, missing source, unsupported, collision, destination, or materialization preflight failure blocks the whole structural operation.
- No silent truncation is allowed.
- No partial commit is allowed for the initial Wave50 structural operation. If a future operation supports partial commit, it must report committed refs and failed refs exactly and should be a separate design decision.
- Root/full-subtree execution of the sample PSD should be blocked under the recommended execution caps because `126` leaves and `49172000` estimated raw bytes exceed the focused execution policy.
- Preview may enumerate more than execution may approve; preview enumeration is metadata/evidence and must not imply materialization.

## Risks And Early Escapes

Later domains should return `escalate` or `blocked` if any of these are required:

- Semantic role inference from layer names, group names, paths, pixels, or display position.
- Smart suggestion UI, auto classification, recommended rigging, auto repair, repo/editor proposal generation, or automatic commit.
- Group-as-ArtMesh behavior or group drawable/materialization behavior.
- Group visibility/opacity affecting runtime behavior.
- Hidden leaf materialization cannot be performed reliably for positive-size hidden leaves.
- Hidden leaf support requires Photoshop compositing, renderer/pixel oracle, texture sampling correctness, or effect/blend/mask correctness.
- Initial grid mesh generation, triangulation, retopology, UV unwrap, atlas packing, or mesh fitting.
- Source PSD bytes or raw parser objects persisted as package/session/portable capability.
- Direct parser dependency in `packages/**`, `runtime-core`, `validator-core`, or non-approved parser sites.
- External HTTP/WebSocket/MCP transport, LLM/provider integration, prompt workflow, or repo-side repair reasoning.
- Public/demo distribution of sample PSD-derived visual bytes.
- Cubism SDK/Core, `.moc3`, `.model3.json`, Cubism Physics, or Cubism compatibility claims.
- Caps need to be raised above the recommended defaults to pass focused proof.
- Structural refs cannot remain stable without breaking Wave48/Wave49 focused IDs.
- Parallel later domains need overlapping source contract edits without a coordinated dependency order.

## Domain B Readiness

Domain B can start after independent Review-Sylph review returns `pass`.

Domain B should treat this report as the accepted contract inventory for additive package/operation hierarchy scaffold schemas and evidence. It should not implement Editor UI, operation execution, validator behavior, or parser changes beyond the contract/evidence scope assigned in the Wave50 plan.

## Verification Performed

| Check | Result |
|---|---|
| Read Wave50 plan, automation policy, current capability map, backlog, Wave49 final report, and Wave49 final review | pass |
| `rg` source inspection for `hiddenLayerUnsupported`, `runtimeVisibility`, `sourceGroups`, `sourceLayers`, `sourceOrder`, `opacity`, candidate statuses, issue kinds, and materialization behavior | pass; facts recorded above |
| Node REPL read-only scan of `test_data/sample_model.psd` using `@webtoon/psd` | pass; target refs, sourceOrder, visibility, duplicate names, and raw RGBA estimates recorded above |
| Source implementation check | pass; no `apps/**`, `packages/**`, `scripts/**`, fixtures, generated data, dependency manifest, or lockfile edits were made |

`git diff --check` is recorded by the independent review/final Orch-Sylph verification after this artifact is written.

## Files Changed

- `discussion/implementation/waves/wave50/wave50-domain-a-boundary-hidden-target-inventory-report.md`

## Remaining Risks

- This report does not prove source implementation. Domains B-G must implement and verify contracts, operation execution, Editor/AI surfaces, validator diagnostics, and focused e2e.
- Exact generated refs for group containers and structural leaf scaffolds must come from later source execution evidence.
- The recommended structural execution caps raise the approved leaf count from the Wave49 import-plan default `4` to `6` for structural mode. This remains conservative and sample-focused, but Domains B/E/F should make the cap explicit and parser-free.
- Existing Wave48/Wave49 hidden blocked evidence remains historical truth. Wave50 structural mode must not rewrite that history; it must add a new supported hidden-positive-leaf path.

## User-Decision Points

None required for Domain A pass.

Future decisions outside Domain A:

- Raise structural execution caps beyond the recommended focused defaults.
- Make group visibility/opacity runtime-affecting.
- Generate initial grid meshes instead of empty bounded mesh scaffolds.
- Implement Photoshop compositing, renderer/pixel oracle, archive/filesystem import, public demo assets, or Cubism compatibility.
