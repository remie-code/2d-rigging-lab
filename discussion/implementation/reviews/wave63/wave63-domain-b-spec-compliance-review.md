# Wave63 Domain B Spec Compliance Review

## Verdict

- Verdict: `pass`
- Domain: `wave63-mesh-auto-outline-v2-algorithm-foundation`
- Review lane: Spec Compliance Review
- Reviewer: Review-Sylph Lane 1
- Date: 2026-06-12

Pass rationale:

- `auto-outline-v2` is explicit in authoring-core and operation payload schema.
- v1/grid compatibility remains present and covered by focused tests.
- fallback chain is observable in generated result, operation provenance, and Mesh Tool preview summary.
- quality metrics are computed deterministically and routed through authoring result, operation provenance, and Mesh Tool preview summary.
- v2 algorithm mechanisms required for this wave are present, except full constrained triangulation and robust hole/island cleanup, which are explicitly deferred by plan/report rather than hidden as pass evidence.
- report language does not overclaim Cubism/pixel-perfect behavior or full constrained triangulation.

## Review Basis

- `discussion/implementation/orchestration/wave63-plan.md`
- `discussion/implementation/waves/wave63/wave63-preplan-mesh-auto-outline-v2-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v2.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
- Direct source/test inspection in the changed files listed by Gnome.

## Coverage Matrix

| Requirement / basis item | Status | Evidence |
|---|---|---|
| `auto-outline-v2` is a new explicit generation method | implemented | `MeshGenerationMethod` includes `auto-outline-v2` in `packages/authoring-core/src/mesh-generation.ts:16`; operation payload schema accepts it in `packages/operation-core/src/payloads/model-edit.ts:150`; report self-coverage records it at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:15`. |
| Preserve `auto-outline-v1` and `auto-grid-v1` as fallback / compatibility | implemented | method union keeps v1/grid in `packages/authoring-core/src/mesh-generation.ts:16`; payload schema keeps both in `packages/operation-core/src/payloads/model-edit.ts:150`; operation tests still cover grid and v1 at `packages/operation-core/src/operations/generate-mesh.test.ts:28`, `:89`, `:221`. |
| Editor new preview uses v2 | implemented | preview generation calls `method: "auto-outline-v2"` in `apps/editor/src/features/editor-session/editor-session-context.tsx:292`; Apply passes `auto-outline-v2` in `apps/editor/src/features/editor-session/editor-session-context.tsx:322`; command default is v2 in `apps/editor/src/features/editor-session/model/editor-session-commands.ts:263`. |
| Quality summary includes max edge, max area, min angle, max valence, refinement iteration, fallback reason | implemented / observable | metric interface and computation are in `packages/authoring-core/src/mesh-quality-metrics.ts:3`; v2 attaches metrics in `packages/authoring-core/src/mesh-outline-v2-generation.ts:181`; fallback fields are on result type in `packages/authoring-core/src/mesh-generation.ts:44`; operation provenance formats metrics at `packages/operation-core/src/operations/generate-mesh.ts:337`; Mesh Tool shows fallback and metrics at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:134`. |
| Curvature-aware boundary resampling | implemented | contour loops are resampled before triangulation in `packages/authoring-core/src/mesh-outline-v2-generation.ts:111`; curvature affects target spacing and point retention in `packages/authoring-core/src/mesh-outline-v2-generation.ts:410`. |
| Deterministic jittered / Poisson-like interior sampling | implemented | jittered hex-like sampling with minimum-distance rejection is in `packages/authoring-core/src/mesh-outline-v2-generation.ts:562`; deterministic seed/jitter helpers are in `packages/authoring-core/src/mesh-outline-v2-generation.ts:907`. |
| Inset ring for Standard / Large where feasible | implemented | high density config has 2 rings and medium has 1 ring in `packages/authoring-core/src/mesh-outline-v2-generation.ts:203`, `:221`; ring sampling is in `packages/authoring-core/src/mesh-outline-v2-generation.ts:483`; test asserts inset ring presence in `packages/authoring-core/src/mesh-generation.test.ts:95`. |
| Triangulation / refinement with iteration cap | implemented as interim, constrained deferred | refinement loop has bounded `maxRefinementIterations` in config and loop in `packages/authoring-core/src/mesh-outline-v2-generation.ts:73`, `:618`; triangulation mode is explicitly `interim-delaunay-alpha-filter` in `packages/authoring-core/src/mesh-outline-v2-generation.ts:181`; report defers constrained triangulation at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:21`. |
| Fallback chain `auto-outline-v2 -> auto-outline-v1 -> auto-grid-v1` | implemented | v2 attempts v1 fallback in `packages/authoring-core/src/mesh-generation.ts:109`; v1 failure returns grid with both fallback steps in `packages/authoring-core/src/mesh-generation.ts:160`; empty-alpha test asserts v2 and v1 steps in `packages/authoring-core/src/mesh-generation.test.ts:202`; operation provenance formats fallback steps in `packages/operation-core/src/operations/generate-mesh.ts:323`. |
| Representative v2 quality improvement over v1 | implemented | test compares v2 vs v1 metrics in `packages/authoring-core/src/mesh-generation.test.ts:132`; report lists observed improvements at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:75`. |
| Determinism | implemented | direct v2 test compares identical results in `packages/authoring-core/src/mesh-generation.test.ts:95`; deterministic stable IDs use `outline_v2` in `packages/authoring-core/src/mesh-outline-v2-generation.ts:870`. |
| Alpha outside filtering | implemented | filtered triangles run alpha sample checks in `packages/authoring-core/src/mesh-outline-v2-generation.ts:729` and `:831`; existing contour test asserts no transparent-centroid triangles in `packages/authoring-core/src/mesh-generation.test.ts:50`. |
| Human visual check is separate from pixel oracle | implemented as process/report boundary | plan requires separation at `discussion/implementation/orchestration/wave63-plan.md:202`; report states no pixel oracle at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:30`. |

## Plan-vs-Basis Delta

| Basis expectation | Observed delta | Review classification |
|---|---|---|
| Preferred constrained triangulation | Not implemented. Current path is ordinary Delaunay plus alpha filtering, labeled `interim-delaunay-alpha-filter`. | deferred by plan / acceptable for Domain B because plan allowed clearly labeled ordinary Delaunay fallback and no full constrained claim. |
| Robust hole classification, multiple-island policy, morphological cleanup, island/hole summary | Not completed. | deferred / residual risk. Report explicitly calls this out at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:28`. |
| Quality metrics visible enough for Domain B | Visible in authoring result, direct operation provenance, and Mesh Tool preview. | implemented. Residual: Apply using preview mesh still commits only the preview mesh payload, so preview fallback/metrics are visible before Apply but not persisted as separate Apply provenance fields. |
| Preset density ordering for v2 | Config clearly varies high/medium/low density and rings; focused tests prove v1 density ordering and v2 inset/metric behavior, but I did not find a direct v2 output ordering assertion. | implementation appears compliant; test-strength question belongs to Test Adequacy lane. Not a spec-compliance blocker. |
| Full visual naturalness | Not encoded as automated oracle. | compliant, because basis explicitly keeps human visual check separate from pixel-perfect/Cubism oracle. |

## Mesh v2 Algorithm Field Coverage

| Field / summary surface | Coverage | Evidence |
|---|---|---|
| Algorithm identity | `auto-outline-v2` method, `outline-v2-rgba` source, and `outline_v2` stable IDs are present. | `packages/authoring-core/src/mesh-generation.ts:16`, `:121`; `packages/authoring-core/src/mesh-outline-v2-generation.ts:885`. |
| Preset / density | Editor preset passes densityHint; v2 config maps high/medium/low to different boundary, inset, interior, and refinement values. | `apps/editor/src/features/editor-session/editor-session-context.tsx:294`; `packages/authoring-core/src/mesh-outline-v2-generation.ts:197`. |
| Fallback reason / steps | Result type carries fallbackReason/fallbackSteps; UI formats chain; operation provenance records fallback steps. | `packages/authoring-core/src/mesh-generation.ts:44`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:424`; `packages/operation-core/src/operations/generate-mesh.ts:323`. |
| max edge length | computed and routed to UI/provenance. | `packages/authoring-core/src/mesh-quality-metrics.ts:21`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:174`; `packages/operation-core/src/operations/generate-mesh.ts:345`. |
| max triangle area | computed and routed to UI/provenance. | `packages/authoring-core/src/mesh-quality-metrics.ts:21`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:175`; `packages/operation-core/src/operations/generate-mesh.ts:346`. |
| min angle degrees | computed and routed to UI/provenance. | `packages/authoring-core/src/mesh-quality-metrics.ts:57`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:176`; `packages/operation-core/src/operations/generate-mesh.ts:347`. |
| max vertex valence | computed and routed to UI/provenance. | `packages/authoring-core/src/mesh-quality-metrics.ts:65`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:177`; `packages/operation-core/src/operations/generate-mesh.ts:348`. |
| refinement iteration count | computed and routed to UI/provenance. | `packages/authoring-core/src/mesh-outline-v2-generation.ts:181`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:178`; `packages/operation-core/src/operations/generate-mesh.ts:349`. |
| triangulation mode | computed and routed to direct operation provenance; not shown in Mesh Tool UI, which is acceptable because the required UI summary did not require this field. | `packages/authoring-core/src/mesh-outline-v2-generation.ts:181`; `packages/operation-core/src/operations/generate-mesh.ts:350`. |
| alpha bounds | returned and displayed in preview summary. | `packages/authoring-core/src/mesh-generation.ts:121`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:169`. |
| contour/inset/interior internal counts | v2 generated result includes them; tests assert inset/interior presence. These are not surfaced in UI, which is acceptable for Domain B. | `packages/authoring-core/src/mesh-outline-v2-generation.ts:25`; `packages/authoring-core/src/mesh-generation.test.ts:120`. |

## Negative Compliance Evidence

### v1/grid compatibility not broken

- `auto-outline-v1` and `auto-grid-v1` remain in the authoring method union and operation payload enum: `packages/authoring-core/src/mesh-generation.ts:16`, `packages/operation-core/src/payloads/model-edit.ts:150`.
- Focused operation tests still cover grid dry-run, grid commit, and v1 commit: `packages/operation-core/src/operations/generate-mesh.test.ts:28`, `:89`, `:221`.
- Focused vitest run passed 23 tests across authoring mesh generation, operation mesh generation, and editor-session command tests.

### Fallback chain observable

- Authoring v2 fallback records a v2 failure step, then attempts v1, then grid fallback with both v2 and v1 steps: `packages/authoring-core/src/mesh-generation.ts:109`, `:160`.
- Empty-alpha test asserts `bounds-grid` plus both fallback steps: `packages/authoring-core/src/mesh-generation.test.ts:202`.
- Operation provenance records fallback steps as transform history entries: `packages/operation-core/src/operations/generate-mesh.ts:323`.
- Mesh Tool preview formats fallback steps for the user: `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:424`.

### No semantic recognition / no pixel-perfect Cubism claim

- Basis says v2 is not semantic recognition and not pixel-perfect Cubism reproduction: `discussion/implementation/orchestration/wave63-plan.md:50`, `:51`.
- Mesh Tool basis says preset generation is not semantic recognition and does not auto-select by meaning: `discussion/design/screen-design/components/mesh-tool.md:17`, `:273`.
- Gnome report explicitly says no semantic preset inference, Cubism compatibility claim, or pixel oracle was added: `discussion/implementation/waves/wave63/wave63-domain-b-report.md:30`, `:31`.
- I found no changed Domain B source path that claims Cubism compatibility or pixel-perfect output.

### No overclaim of full constrained triangulation

- Report headline says current v2 is interim ordinary Delaunay + alpha filter and not full constrained triangulation: `discussion/implementation/waves/wave63/wave63-domain-b-report.md:9`.
- Basis coverage self-report marks constrained triangulation deferred: `discussion/implementation/waves/wave63/wave63-domain-b-report.md:21`.
- Source labels the metric mode `interim-delaunay-alpha-filter`: `packages/authoring-core/src/mesh-outline-v2-generation.ts:181`.
- Source triangulation is ordinary Bowyer-Watson-style triangulation followed by alpha filtering: `packages/authoring-core/src/mesh-outline-v2-generation.ts:729`, `:740`, `:831`.
- Tests assert the interim triangulation mode, not constrained triangulation: `packages/authoring-core/src/mesh-generation.test.ts:122`, `:241`; `packages/operation-core/src/operations/generate-mesh.test.ts:259`.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Sandbox run failed with `spawn EPERM`; escalated rerun passed.
  - Result: 3 files passed, 23 tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "generates an initial mesh" --workers=1 --reporter=line`
  - Sandbox run failed with `spawn EPERM`; escalated rerun passed.
  - Result: 1 test passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <Domain B changed paths>`
  - Passed with line-ending warnings only.
- `Select-String -Path packages/authoring-core/src/mesh-outline-v2-generation.ts,packages/authoring-core/src/mesh-quality-metrics.ts -Pattern '[ \t]+$'`
  - No matches.
- `pnpm.cmd typecheck`
  - Failed in non-Domain-B paths:
    - `packages/operation-core/src/operations/update-rig-control.ts(14,36)` cannot find `@private-2d-rigging-lab/package-format`.
    - `packages/runtime-core/src/rig-control-evaluation.ts(386,3)` cannot find `clamp`.
  - I did not classify this as a Domain B spec-compliance failure.

## Findings

No blocking spec-compliance findings.

Non-blocking observations:

- `auto-outline-v2` density ordering is evident in config, but I did not find a direct v2 output ordering assertion analogous to the existing v1 density ordering test. This should be considered by the Test Adequacy lane, not as a Spec Compliance blocker.
- When Apply commits a preview mesh payload, preview fallback/quality details are visible before Apply but are not carried as separate Apply provenance fields. Direct generation provenance records metrics. This is acceptable for Domain B's "observable enough" bar, but future work may want preview metadata in operation payloads if evidence persistence becomes a requirement.

## Residual Risk Classification

- Residual risk: `medium`.

Reasons:

- Full constrained triangulation is explicitly deferred, so boundary preservation can still be weaker on complex concave, thin, hole, or multi-island shapes.
- Hole/multiple-island classification, morphological cleanup, and summary of ignored holes/islands remain future work.
- Quality refinement exists and is bounded, but the representative fixture did not require refinement iterations beyond initial sampling/rings.
- Full repository typecheck is currently blocked by parallel non-Domain-B errors.

## Required Follow-up

No `needs_fix` item for Domain B Spec Compliance.

