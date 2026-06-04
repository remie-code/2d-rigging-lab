# Current Capability / Remaining Work Inventory - 2026-06-04

## 1. Purpose and Method

This report is the read-only inventory and rewrite plan for:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

The target documents were not rewritten in this task. Doc-Orch-Sylph split the investigation across six read-only Research-Sylph agents, waited for all results, removed duplicate findings, and integrated the rewrite guidance here.

Basis documents supplied to the agents:

- `.github/skills/implementation-orchestration/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `C:/Users/remie/.codex/skills/discussion-management/SKILL.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave39/wave39-final-report.md`
- `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`

Repository facts below come from the Research-Sylph source/test/fixture/document checks. Assumptions and choices are called out separately as decision points.

## 2. Research-Sylph Roster and Status

| Agent | Domain | Status | Notes |
| --- | --- | --- | --- |
| A1 | Core / Contracts / Package / Runtime / Validator / Product Preflight | done/pass | No blocker. Product Preflight v0 is implementation-proven but read-only/session-generated. |
| A2 | Editor / Workflow / UI / E2E | done/pass | No blocker. Editor semantic workflows and Wave39 Product Preflight are e2e-evidenced. |
| A3 | Rigging / Mesh / Deformation / Dynamics | done/pass | No blocker. Strong semantic rig/deformation evidence; Cubism/rendering compatibility must not be implied. |
| A4 | Asset I/O / PSD / Binary / Persistence / Transport | done/pass | No blocker. Real byte intake/persistence exists; PSD/PNG parse/decode remains absent. |
| A5 | AI / Codex-facing API / Approval / Transcript Boundary | escalate | Investigation complete. Wording around repo-side `repair candidate generation` conflicts with the required Codex-side inference boundary. |
| A6 | Document Structure / Backlog Hygiene / Link Integrity | done | No blocker. Target docs are overgrown with Wave chronology and need slimming. |

## 3. Repository Facts Summary by Capability Area

### Core Contracts / Validator / Product Preflight

- `packages/contracts/src/product-preflight-report.ts` defines Product Preflight report shape: required categories, status/severity, evidence refs, diagnostic refs, blocking reasons, and unsupported/not_evaluated claims.
- Contract tests reject missing categories and false pass claims for unsupported/not_evaluated states: `packages/contracts/src/product-preflight-report.test.ts:11`, `:37`, `:90`, `:166`.
- `packages/validator-core/src/product-preflight-report.ts` builds the report, maps checks to categories, and determines category/report status: `:104`, `:157`, `:552`, `:647`.
- Validator tests cover pass aggregation, missing evidence, truthful unsupported states, and unsupported transport failure: `packages/validator-core/src/product-preflight-report.test.ts:27`, `:110`, `:288`, `:343`.
- Wave39 integration is verified as pass in `discussion/implementation/waves/wave39/wave39-final-report.md:3`, with verified commands at `:64`-`:71`.
- Clean integration review reports pass/no blocking findings in `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md:3`, `:57`-`:59`.

Boundary:

- Product Preflight v0 is a truthful session-generated read-only report.
- It is not a persisted/exported package artifact.
- It does not prove parser/decode/archive/filesystem/renderer/pixel/Cubism/AI repair support.

### Package / Persistence / Transport

- Current-session byte availability, browser-local IndexedDB byte restore, project-defined JSON portable bundle, and transport boundary evidence exist.
- Package bridge evidence:
  - `packages/package-format/src/product-preflight-package-bridge.ts:39`
  - `packages/package-format/src/product-preflight-package-bridge.ts:80`
  - `packages/package-format/src/product-preflight-package-bridge.test.ts:12`
  - `packages/package-format/src/product-preflight-package-bridge.test.ts:66`
- Persistent / portable surfaces:
  - `packages/package-format/src/byte-intake.ts`
  - `packages/package-format/src/byte-availability.ts`
  - `packages/package-format/src/persistent-binary-storage.ts`
  - `packages/package-format/src/portable-package-bundle.ts`
  - `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts`
  - `apps/editor/src/editor-session/persistent-byte-restore.ts`
  - `apps/editor/src/editor-workflow/portable-bundle-workflow.ts`
  - `apps/editor/e2e/byte-intake-smoke.mjs`
  - `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
- Supported transport is `projectDefinedJsonBundleV0`; ZIP/archive/filesystem/drag-drop/native/cloud transports remain future/dependency-gated.

Boundary:

- Persistence is browser-local same-origin best effort plus project-defined JSON bundle portability.
- It is not OS filesystem, cloud/cross-profile, quota-proof, private-browsing-proof, archive, or drag-drop support.

### Runtime / Viewer Evidence

- Runtime Product Preflight bridge is semantic evidence only:
  - `packages/runtime-core/src/product-preflight-runtime-bridge.ts:34`
  - `packages/runtime-core/src/product-preflight-runtime-bridge.ts:123`
  - `packages/runtime-core/src/product-preflight-runtime-bridge.test.ts:18`
- Editor Viewer / Runtime inspection can show semantic state, parameter overrides, snapshot/diff, validation diagnostics, and runtime evidence.

Boundary:

- No full renderer, render target, pixel oracle, texture sampling correctness, standalone viewer, Cubism runtime, `.moc3`, or `.model3.json` support is implemented.

### Editor / Workflow / UI / E2E

Users can operate these editor workflows today:

- Browser-local project save/load/reset.
- Portable JSON export/import.
- Same-origin IndexedDB byte restore.
- Runtime-projected SVG preview and parameter sliders.
- Viewer/runtime inspection, parameter override, snapshot/diff, diagnostics.
- Split PNG / PSD adapter metadata intake with rights/provenance.
- Browser file-input byte intake with digest/byteLength/mediaType evidence.
- Generated drawable creation, layer visibility/order, mesh vertex select/drag/nudge, bounded topology/UV edit.
- Direct layer tree operations for parts/drawables with explicit destructive controls.
- `rotation2d` rig controls, `warpLattice2d`, keyforms, minimal dynamics, semantic mask/opacity workflow.
- Rights-clean synthetic tutorial mini model workflow.
- Product Preflight read-only report run, category/status inspection, save/load rerun.
- Deterministic AI dry-run/approval/commit/read/validate/transcript foundation.

Evidence:

- App shell wiring: `apps/editor/src/ui/app-shell/app-shell.ts:307`, `:317`, `:325`, `:335`, `:348`, `:381`, `:408`.
- Product Preflight workflow/UI:
  - `apps/editor/src/editor-workflow/product-preflight-workflow.ts:72`, `:96`
  - `apps/editor/src/editor-workflow/workflow-controller.ts:1186`
  - `apps/editor/src/ui/product-preflight-panel.ts:24`, `:56`, `:124`
- Product Preflight e2e save/load/rerun:
  - `apps/editor/e2e/product-preflight-smoke.mjs:64`, `:70`, `:71`, `:72`, `:75`, `:275`
- Save/load:
  - `apps/editor/src/editor-workflow/workflow-controller.ts:1250`, `:1270`, `:1319`, `:1370`, `:1380`
  - `apps/editor/src/editor-session/browser-project-store.ts:81`, `:96`, `:148`
- E2E smoke runner/checks:
  - `scripts/editor-e2e-smoke.mjs:29`
  - `apps/editor/e2e/smoke-checks.mjs:68`, `:78`, `:80`, `:115`, `:122`, `:165`, `:173`, `:189`, `:197`, `:213`, `:221`

Boundary:

- No real PSD/PNG parse/decode/materialization, full renderer, pixel oracle, standalone viewer, Cubism compatibility, native filesystem, cloud persistence, LLM/repair UI, automatic triangulation, UV unwrap/atlas, or advanced layer tree drag/drop/multi-select/group transform.

### Mesh / Rigging / Deformation / Dynamics

Implemented semantic 2D rigging/editing:

- Mesh topology/UV:
  - Vertex select/move, add/remove unreferenced vertex, add/remove triangle, direct UV move.
  - Evidence: `packages/contracts/src/mesh-topology.ts:7`; `packages/authoring-core/src/mesh-topology-mutations.ts:106`, `:143`, `:180`, `:240`, `:266`; `packages/operation-core/src/operations/mesh-topology.ts:66`, `:242`, `:409`.
  - Validator/runtime/e2e: `packages/runtime-core/src/mesh-evidence.ts:25`, `:119`, `:252`; `packages/validator-core/src/validators/mesh-semantics.ts:120`, `:443`, `:568`, `:630`, `:697`, `:861`; `apps/editor/e2e/topology-uv-persistence-smoke.mjs:69`, `:123`, `:128`, `:141`, `:519`.
- Rig/keyform:
  - Project-defined `rotation2d` rig controls, parent/child rig and drawable binding, `angleDegrees` keyform.
  - Evidence: `packages/authoring-core/src/keyform-mutations.ts:143`, `:164`, `:204`; `packages/runtime-core/src/rig-control-evaluation.ts:83`, `:188`, `:360`; `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:14`, `:202`.
- Warp lattice:
  - Project-defined `warpLattice2d`, drawable/child rig binding, `controlPointOffsets` keyform, semantic bilinear deformation, bounds/hash recalculation.
  - Evidence: `packages/contracts/src/warp-lattice2d.ts:7`, `:56`; `packages/runtime-core/src/rig-control-warp-lattice.ts:66`, `:98`, `:129`, `:157`, `:199`; `packages/validator-core/src/warp-lattice-diagnostics.test.ts:20`, `:29`, `:133`, `:163`, `:191`; `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:120`, `:147`, `:170`, `:566`.
- Dynamics:
  - Minimum Open Dynamics v1 with `scalarDampedFollowV1` computed output parameter, preview run/reset, RuntimeState/snapshot/diff, validator diagnostics.
  - Evidence: `packages/authoring-core/src/dynamics-mutations.ts:37`, `:146`; `packages/runtime-core/src/dynamics-evaluation.ts:39`; `packages/runtime-core/src/snapshot.ts:251`; `packages/runtime-core/src/dynamics-evaluation.test.ts:16`; `packages/runtime-core/src/viewer-evaluation.test.ts:93`; `packages/validator-core/src/dynamics-semantic.test.ts:19`.

Recommended wording:

- Use: "project-defined semantic rig/deformation evidence", "semantic bilinear `warpLattice2d` evaluator", "runtime/viewer evidence with bounds/hash/vertexHash", "bounded topology/UV direct edit".
- Avoid: "Cubism-compatible", "rendered correctness", "pixel-correct deformation", "full renderer", "standalone viewer", "Cubism Physics", "automatic triangulation", "atlas", "UV unwrap", "real PSD/PNG texture pipeline".

### Asset I/O / PSD / Binary

Implemented:

- Browser file input actual selected byte intake.
- SHA-256 / byteLength / mediaType metadata.
- Current-session byte availability evidence.
- Browser-local IndexedDB best-effort byte restore.
- Project-defined JSON bundle with base64 round-trip.
- Parser-free PSD adapter/profile metadata and structured persistence.
- Split PNG source asset metadata and rights/provenance checks.
- Workspace-local sample PSD byte characterization fixture.

Evidence:

- PSD adapter/profile:
  - `packages/operation-core/src/operations/import-psd-source-asset.ts`
  - `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
  - `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
  - `packages/validator-core/src/psd-source-profile.test.ts`
  - `fixtures/contracts/psd-import-happy-path/**`
  - `fixtures/contracts/psd-unsupported-layer/**`
- Source asset rights:
  - `packages/operation-core/src/operations/import-split-png-source-asset.ts`
  - `packages/validator-core/src/validators/asset-rights.ts`
  - `packages/validator-core/src/source-asset-rights-provenance.test.ts`
- Sample PSD:
  - `test_data/sample_model.psd`
  - size `22406225`
  - SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`
  - `fixtures/contracts/wave31-byte-sample-characterization/expected/sample-model-byte-characterization-summary.json`
  - `packages/package-format/src/wave31-byte-sample-characterization-fixture.test.ts`

Boundary:

- PSD/PNG decode, PSD layer parse, raster extraction, texture materialization, compositing, media header sniffing, and pixel renderer oracle are not implemented.
- Sample PSD proves byte length/hash/intake, not PSD semantics or public redistribution rights.

### AI / Codex-facing API / Approval / Transcript

Implemented:

- `packages/ai-interface` exposes executable command names:
  - `getEditorState`
  - `inspectModel`
  - `inspectTarget`
  - `validatePackage`
  - `dryRunOperation`
  - `commitOperation`
  - `getOperationLog`
- Evidence: `packages/ai-interface/src/ai-command-name.ts:3`.
- Dry-run/commit call an in-process host; commit passes approval policy:
  - `packages/ai-interface/src/ai-command-executor.ts:74`
  - `packages/ai-interface/src/ai-command-executor.ts:102`
  - `packages/ai-interface/src/ai-approval-policy.ts:87`
- Transcript appends command and approval entries; it does not infer or generate repair candidates:
  - `packages/ai-interface/src/ai-command-transcript.ts:12`
  - `packages/ai-interface/src/ai-command-transcript.ts:94`
  - `packages/ai-interface/src/ai-command-transcript.ts:116`
- Editor AI host routes read commands and operation commands through an in-process command bus:
  - `apps/editor/src/ai-command-host/editor-ai-command-host.ts:53`
- Product Preflight observation is a deterministic helper/schema:
  - `packages/ai-interface/src/ai-product-preflight-observation.ts:59`
- `observeProductPreflightReport` is not an executable AI command and is rejected by schema tests:
  - `packages/ai-interface/src/ai-command-schema.test.ts:515`
- `packages/ai-interface/package.json:9` has no LLM/provider dependency.

Boundary:

- There is no repo-side LLM/provider, prompt loop, repair reasoning, repair candidate generation/ranking, standalone `getDiff` command, rerun-validation command, or executable Product Preflight AI command.

## 4. Implementation-Proven Capabilities as of Wave39

Grouped by product capability rather than chronology:

| Capability | Proven Surface | Evidence Level |
| --- | --- | --- |
| Product Preflight v0 | Required-category report, truthful unsupported/not_evaluated states, validator aggregation, package/runtime bridges, editor panel/workflow, save/load rerun e2e | Strong: contracts/tests/validator/tests/fixtures/editor e2e/Wave39 review |
| Project package persistence | Browser-local save/load/reset, IndexedDB byte restore, portable JSON bundle round-trip | Strong: package-format tests and editor e2e |
| Byte intake and byte evidence | Browser-selected bytes, digest/length/mediaType, current-session evidence | Strong: package-format/editor e2e |
| Transport boundary | `projectDefinedJsonBundleV0` supported, archive/filesystem routes rejected/not supported | Strong: contracts/package-format/e2e negative oracle |
| Editor semantic workflows | preview, viewer/runtime inspection, layer tree edits, mesh edits, topology/UV, rig/dynamics/composition, tutorial | Strong for semantic paths: editor source and e2e smoke |
| Mesh topology/UV | Bounded vertex/triangle edits and direct UV point movement | Strong: contracts/authoring/operation/runtime/validator/e2e |
| Rig/keyform/warp lattice | Project-defined rotation2d, keyforms, warp lattice semantic bilinear deformation | Strong: runtime/validator/e2e |
| Dynamics v1 | `scalarDampedFollowV1`, runtime snapshot/diff, preview run/reset, validator diagnostics | Moderate-to-strong: unit/runtime/viewer/validator evidence |
| PSD/source assets | Parser-free PSD/source metadata profile, split PNG source asset metadata, rights/provenance checks | Strong for metadata semantics; no parser/decode proof |
| AI command surface | Dry-run/commit/read/validate/operation log, approval policy, transcript append | Strong for deterministic command host; no inference/candidate generation |

## 5. Remaining Work Classification

### No-extra-decision Candidates

These can likely be assigned as scoped implementation/doc tasks without changing product policy:

- Rewrite `current-capability-map.md` into a product-area capability map instead of a Wave changelog.
- Rewrite `remaining-work-backlog.md` into a current residual-work table and remove completed Wave history.
- Update stale Wave references:
  - `remaining-work-backlog.md:47`, `:51`
  - `discussion/implementation/_map.md:73`
  - `current-capability-map.md:307`
- Add direct Wave39 clean review evidence where current docs only link the final report/review map:
  - `current-capability-map.md:387`
- Clarify "UV editing" as completed bounded direct UV edit, with advanced/freeform UV unwrap/atlas still remaining:
  - `current-capability-map.md:258`, `:271`
- Narrow persistent binary storage wording to exclude native/cloud/cross-profile/archive guarantees:
  - `current-capability-map.md:333`
- Replace generic "PSD support" wording with parser-free PSD adapter/profile metadata support.
- Separate completed Product Preflight v0 from future final acceptance/demo gate work.

### User-decision Required

These need an explicit choice before implementation or final doc positioning:

- Wave40 authority: should the docs treat Wave40 as already planned, or preserve the Wave39-time "choose next Wave40 boundary" state?
- AI repair boundary: should Wave40 be reframed from repo-side "repair candidate generation" to Codex-generated candidate intake plus repo-side dry-run/diff/rerun validation/approval/transcript?
- Product Preflight durability: should v0 remain session-only, or become a persisted/exported package artifact?
- Next product priority after Wave39: AI repair/diff surface, archive/filesystem, real parser/decode, renderer/pixel oracle, or Cubism compatibility.
- Public/demo asset policy: whether and how to introduce public rights-clean real assets beyond local byte fixtures.

### Dependency / Security / Rights / UX Gates

- ZIP/archive writer/importer dependency and license/provenance review.
- File System Access API, directory picker, native drag/drop, and browser support/permission UX.
- PNG/image/PSD decode libraries, media signature/header sniffing, parser trust boundaries, and malicious file handling.
- Renderer/pixel oracle dependency and acceptance criteria.
- Cubism SDK/Core remains forbidden unless policy changes; proprietary parser/runtime licensing would require separate approval.
- Public/tutorial/demo asset rights and private/public split.
- Cloud/cross-profile persistence and quota/private-browsing guarantees.
- Advanced topology/UV algorithms: automatic triangulation, retopology, edge tools, unwrap, atlas, texture sampling correctness.
- Native layer tree drag/drop/multi-select/group transform destructive semantics.

### Explicit Future Scope / Non-goals

Current docs should continue to say these are not implemented:

- Cubism SDK/Core integration.
- Cubism import/export/load compatibility, `.moc3`, `.model3.json`.
- Cubism Physics compatibility.
- Full renderer, standalone viewer, render target, pixel oracle.
- Real PSD/PNG parser/decode/raster extraction/texture materialization.
- ZIP/archive/native filesystem/cloud transport.
- Direct vertex physics, cloth/collision/IK/timeline bake.
- LLM/provider/prompt integration inside the repo.
- Repo-side repair reasoning or repair candidate generation/ranking.

### Documentation / Quality Debt

- Target docs are too chronological and duplicate wave reports.
- `_map.md` entries contain stale "after Wave37" and Wave40 status conflicts.
- `current-capability-map.md` has wave update blocks and "remaining gaps" that are no longer current.
- `remaining-work-backlog.md` includes large completed Wave27-Wave38 sections and should not be the completion-history archive.
- Quality backlog remains valid:
  - fresh checkout replay / CI gate
  - `check:source` blind spots
  - e2e decomposition
  - traceability/doc refresh
  - schema cleanup
  - runtime/viewer naming cleanup
  - dynamics create-flow atomicity

## 6. AI / Codex-facing 2D Rigging Edit Boundary Statement

Recommended canonical statement for both target docs:

> The AI / Codex-facing surface is a structured observation and control surface for Codex. The repo/tool provides package, editor, runtime, validator, Product Preflight, diagnostics, dry-run, diff/validation, approval, transcript, and evidence-reference surfaces. Codex owns reasoning, repair design, natural-language judgment, and repair candidate generation/ranking. The repo should accept, preview, validate, approve, apply, and record Codex-proposed operations, but should not claim to perform AI inference or repair candidate generation itself.

Applied to 2D rigging:

- The repo can expose semantic mesh/rig/deformation/dynamics state and deterministic operations.
- The repo can dry-run candidate operations, report diffs/diagnostics, require approval, commit, and transcript the result.
- Codex should generate or select repair/edit candidates.
- Docs should avoid saying the editor "AI" generates rigging repairs unless a future explicit provider/prompt integration is approved and implemented.

## 7. Rewrite Proposal for `current-capability-map.md`

### Keep

- Purpose/status line and "not a Wave changelog" intent.
- Product intent and non-goals.
- Current capability facts grouped by product area.
- Evidence entry links to:
  - `discussion/implementation/_map.md`
  - `discussion/implementation/orchestration/_map.md`
  - `discussion/implementation/waves/wave39/wave39-final-report.md`
  - `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
- Explicit boundary statements for parser/decode/archive/filesystem/renderer/Cubism/AI inference.

### Move / Link Out

- Wave20-Wave39 update blocks should move out of the main body conceptually; leave only links to wave reports/maps.
- Completed wave-history detail should live in wave final reports/reviews and `_map.md`, not in the capability map.
- Long evidence lists inside table cells should become short evidence anchors.

### Compress

- Convert Wave chronology into a compact "Current capability surface as of Wave39" table.
- Collapse repeated Product Preflight mentions into one "Product Preflight v0" capability row.
- Collapse repeated asset/persistence/archive backlog references into one boundary row.
- Collapse AI wording into one "Codex-facing deterministic API surface" row plus boundary statement.

### Suggested Headings

1. Status and Purpose
2. Product Intent and Non-goals
3. Current Implementation Surface as of Wave39
4. Capability Boundaries and Non-support
5. Incomplete Product Workflows
6. Evidence Entry Points
7. Next Decision Points

### Suggested Product-area Rows

- Package / schema / contracts
- Product Preflight v0
- Editor workflow and persistence
- Preview / Viewer / Runtime semantic evidence
- Mesh topology and UV
- Rig controls / keyforms / warp lattice
- Dynamics
- Source assets / PSD adapter / byte intake
- Transport
- AI / Codex-facing command surface
- Validation / test/e2e evidence

## 8. Rewrite Proposal for `remaining-work-backlog.md`

### Keep

- Purpose/status line.
- Remaining work grouped by decision and implementation readiness.
- Near-term candidates.
- Dependency/security/rights gates.
- Documentation/quality debt.
- Explicit future/non-goals.

### Remove as Completed / Obsolete

- Large "Wave27-Wave38 completed scope" sections from the active backlog body.
- Old "Wave31 complete" framing where the document now includes Wave39.
- Generic "UV editing" as an open gap; bounded direct UV editing exists.
- Generic "persistent binary upload/storage" as open gap; browser-local and portable bundle persistence exist.
- "Actual uploadではない" wording for source assets; actual browser byte intake exists.

### Reclassify

- "PSD support" -> real parser/decode/raster extraction/materialization remains; parser-free metadata adapter is complete.
- "Persistence" -> native/cloud/cross-profile/archive guarantees remain; browser-local and JSON bundle persistence are complete.
- "AI repair candidate generation" -> Codex-generated candidate intake/preview/dry-run/diff/validation/approval/transcript surface.
- "Product Preflight" -> v0 complete; final acceptance runner/demo-safe gate/exported artifact are remaining.
- "Viewer/runtime" -> semantic inspection complete; full renderer/pixel oracle/standalone viewer remain.

### Suggested Headings

1. Status and Purpose
2. Active / Planned Near-term Boundary
3. No-extra-decision Candidates
4. User-decision Required
5. Dependency / Security / Rights / UX Gates
6. Explicit Future Scope / Non-goals
7. Documentation and Quality Debt
8. Evidence Links and Usage Note

## 9. Concrete Stale / Overgrown Sections and Recommended Edits

| File / Reference | Finding | Recommended Edit |
| --- | --- | --- |
| `current-capability-map.md:6` onward | Wave20-Wave39 update blocks dominate the top of a non-changelog doc. | Replace with short "as of Wave39" status plus links to wave reports/maps. |
| `current-capability-map.md:258`, `:271` | Unqualified "UV editing" remains listed as major gap. | Change to advanced/freeform UV unwrap/atlas/texture sampling; bounded direct UV edit is complete. |
| `current-capability-map.md:281` | `repair suggestion` can read as repo-side AI generation. | Reword as Codex-generated repair suggestions handled through repo API/evidence surfaces. |
| `current-capability-map.md:291` | Source asset row still says Wave18-Wave22 and "actual uploadではない". | Update for Wave31 actual-byte intake and Wave35/Wave36 persistence; retain no parser/decode boundary. |
| `current-capability-map.md:295` | Editor UI row misses later UI surfaces. | Add byte intake, direct layer tree, topology/UV, Product Preflight. |
| `current-capability-map.md:307` | Verification posture says Wave8-Wave38. | Update to Wave8-Wave39 and cite Wave39 final/review. |
| `current-capability-map.md:333` | Persistent binary upload/storage wording is ambiguous after Wave35/Wave36. | Reword to native/cloud/cross-profile/archive persistence guarantees remain. |
| `current-capability-map.md:337` | Validator row omits Wave32 warp-lattice and Wave38 topology/UV diagnostics. | Add those capabilities or convert to current validator capability summary. |
| `current-capability-map.md:387` | Wave39 evidence does not directly cite clean review file. | Add `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`. |
| `current-capability-map.md:394`, `:397` | Archive/filesystem/import-export candidates duplicate backlog content. | Link to backlog decision gates rather than duplicating detail. |
| `current-capability-map.md:398` | "修復候補提示へ進める" can imply repo-side generation. | Reword around Codex-proposed candidates plus dry-run/diff/validation/approval. |
| `current-capability-map.md:409` | Says source inspection basis is limited. | Update after this inventory or cite this report as the focused source/test/fixture basis. |
| `remaining-work-backlog.md:13` onward | Backlog includes update history and completed implementation proof. | Keep only active remaining work; move completion history to maps/wave reports. |
| `remaining-work-backlog.md:36`, `:47`, `:51` | Basis still reads as Wave20-Wave31 / Wave31 complete. | Update to Wave20-Wave39 or describe the original basis separately. |
| `remaining-work-backlog.md:91`, `:93` | Archive/filesystem/import-export duplicated with capability map. | Merge into dependency/security/UX gate section. |
| `remaining-work-backlog.md:121`, `:248` | `repair candidate generation` conflicts with Codex-side inference boundary. | Reword to Codex-generated candidate intake/preview/dry-run/diff/validation/approval/transcript. |
| `remaining-work-backlog.md:126` onward | Wave27-Wave38 completion list is not active backlog. | Remove or compress to one "completed work lives in wave reports/maps" note. |
| `remaining-work-backlog.md:240` | Generic Wave40+ candidate framing conflicts with planned Wave40 docs. | Decide whether Wave40 is planned; then update wording consistently. |
| `remaining-work-backlog.md:269` | Usage section repeats long evidence links. | Compress and point to maps/wave reports. |
| `discussion/implementation/_map.md:73` | Says backlog is "after Wave37". | Update to after Wave39 during the map refresh. |
| `discussion/implementation/_map.md:229` | Says choose Wave40 boundary, while orchestration map has Wave40 planned. | Align Wave40 status with orchestration docs or mark as user-decision pending. |
| `discussion/implementation/orchestration/_map.md:49`, `:100` | Wave40 is marked planned. | Keep if Wave40 is authoritative, but reconcile with AI boundary if repair generation wording remains. |
| `discussion/implementation/orchestration/wave40-plan.md:11`, `:52`, `:108` | `deterministic repair candidate generation` conflicts with required boundary. | Reframe to Codex candidate intake plus deterministic repo-side preview/diff/validation/approval/transcript, or escalate to user. |

## 10. User-decision Points

Yes. Decisions to surface before or during the rewrite:

1. Wave40 status: treat Wave40 as planned/authoritative, or preserve a Wave39 snapshot where Wave40 is still a choice?
2. AI boundary: reframe repo-side "repair candidate generation" to Codex-generated candidate intake plus deterministic dry-run/diff/validation/approval/transcript?
3. Product Preflight persistence: keep v0 session-only or plan persisted/exported package artifact support?
4. Next product priority: AI repair/diff surface, archive/filesystem, real parser/decode, renderer/pixel oracle, or Cubism compatibility?
5. Asset policy: when to introduce public rights-clean real assets and how to separate private/local fixtures from distributable demo assets?

Doc-Orch recommendation: do not ask the user before the two target-doc rewrite if the rewrite records Wave40/AI items as "decision required" rather than choosing for them. Ask the user first only if the next task also rewrites Wave40 plan/orchestration status.

## 11. Recommended Next Step

Proceed to a Doc-Gnome rewrite task for only:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

The rewrite should cite this report, compress wave chronology, preserve unsupported boundaries, and mark Wave40/AI repair wording as a decision point unless Undine provides a policy decision first.

Do not rewrite `discussion/implementation/orchestration/wave40-plan.md` in that same task unless the user explicitly approves the AI boundary reframe for Wave40.
