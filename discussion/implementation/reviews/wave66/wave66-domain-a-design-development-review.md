# Wave66 Domain A Design / Development Compliance Review

- verdict: `pass`
- lane: Design / Development Compliance Review
- domain: `wave66-canvas-evaluation-foundation-v0`
- reviewer: Review-Sylph
- date: 2026-06-13

## Evidence Reviewed

- Basis / plan:
  - `discussion/implementation/orchestration/wave66-plan.md` sections 3, 4, 5, 7.1, 7.4, 8, 9, 13, 14, 15.
  - `discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md`.
  - `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`.
  - Development policies: UX-backed package logic authority, source file organization, dependency, operation, schema and ID conventions.
- Changed files:
  - `apps/editor/src/workspace/canvas/canvas-evaluation.ts`.
  - `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`.
  - `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`.
- Diff/status evidence:
  - Reproduced the three requested `git diff --no-index -- NUL ...` new-file diffs.
  - `git status --short -uall` shows the three Domain A files plus unrelated/concurrent dirty files under `packages/**`, `apps/editor/.dev-server.out.log`, and wave66 basis/report paths.
- Reviewer verification:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`: sandbox run failed with Windows `spawn EPERM`; rerun outside sandbox passed, 1 file / 5 tests.
  - `pnpm.cmd --dir apps/editor typecheck`: passed.
  - `pnpm.cmd run check:source`: passed.
  - `pnpm.cmd run check:deps`: passed.

## Compliance Checklist Results

- `canvas-renderer.ts` kept session-free: `pass`.
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts` imports projection/control-point types/helpers only, not `AuthoringSession` or the new evaluation adapter.
  - Domain A did not modify `canvas-renderer.ts`; this matches the wave plan requirement that renderer not gain raw session knowledge.
- Evaluation boundary under `apps/editor/src/workspace/canvas/**`: `pass with warning`.
  - The new editor-owned boundary is `createCanvasEvaluatedScene(session, options)` in `canvas-evaluation.ts:142`.
  - Public editor-local evaluation shapes live in `canvas-evaluation.ts:25` through `canvas-evaluation.ts:109`.
  - The file is coherent as a canvas evaluation adapter, but at 919 lines it should not keep absorbing Domain B rendering/projection/hit-test concerns.
- Operation boundary and mutation policy: `pass`.
  - Production code reads `AuthoringSession`, builds maps, clones mesh/domain/vector data, and returns evaluated scene data; no production commit or Operation Core bypass is introduced.
  - Non-mutation is specifically covered by tests at `canvas-evaluation.test.ts:60` through `canvas-evaluation.test.ts:90` and `canvas-evaluation.test.ts:153` through `canvas-evaluation.test.ts:171`.
- Dependency policy: `pass`.
  - No manifest or lockfile change was present in the Domain A diff.
  - Imports use existing workspace/editor dependencies only: authoring-core, contracts, and the existing editor keyform helper in `canvas-evaluation.ts:1` through `canvas-evaluation.ts:17`.
  - `check:deps` passed.
- Forbidden scopes: `pass`.
  - Domain A did not change `packages/authoring-core`, Mesh V2.6 logic, renderer triangle drawing, save/load, viewer/runtime preview, or WebGL rendering.
  - The new implementation contains no Cubism SDK/Core, Mesh V2.6, save/load, viewer, or WebGL references.
- Schema / ID policy: `pass`.
  - `CanvasEvaluatedScene`, `CanvasEvaluatedDrawable`, and related exported interfaces are editor-internal TypeScript shapes, not new contract-owned external DTO/Zod schemas.
  - Internal generated/fallback IDs such as `canvasDraftRigControl` and `vtx_rect_*` contain no spaces and do not create external schema vocabulary.
- Source organization report coverage: `pass with warning`.
  - The Gnome report documents residual implementation risks at `wave66-domain-a-canvas-evaluation-foundation-report.md:79` through `wave66-domain-a-canvas-evaluation-foundation-report.md:85`.
  - It does not explicitly declare an oversized-file exception, but the source organization guard passed and the current file has one identifiable responsibility.

## Findings

No blocking findings.

### FINDING-001: Source file growth risk should be contained in Domain B

- severity: `warning`
- evidence:
  - `canvas-evaluation.ts` contains public evaluation types (`:25` through `:109`), the main adapter (`:142` through `:275`), rig-control normalization/evaluation (`:277` through `:620`), mesh fallback/opacity/preview helpers (`:621` through `:728`), and indexing/geometry utilities (`:731` through `:919`).
  - Source File Organization Policy requires files to stay responsibility-owned and to document exceptions when multiple responsibilities are temporarily kept together.
- assessment:
  - This is not blocking for Domain A because the file is not an `index.ts`, is not a generic `types`/`utils` catch-all, and `pnpm.cmd run check:source` passed.
  - Domain B should avoid adding renderer triangle drawing, projection migration, overlay migration, or hit-test logic into this file. Split into named canvas evaluation submodules if the adapter grows.

### FINDING-002: `selection` and `overlayToggles` are accepted but not yet consumed

- severity: `warning`
- evidence:
  - `CanvasEvaluationOptions` includes `selection` and `overlayToggles` at `canvas-evaluation.ts:79` through `canvas-evaluation.ts:80`.
  - The Domain A report explicitly defers overlay/hit-test migration and Canvas panel wiring to Domain B at `wave66-domain-a-canvas-evaluation-foundation-report.md:48` through `wave66-domain-a-canvas-evaluation-foundation-report.md:51`.
- assessment:
  - This is acceptable for Domain A foundation scope because the wave plan assigns evaluated overlay, hit test, and renderer integration to Domain B.
  - Domain B should either consume these inputs when building evaluated projection/overlay state or narrow the shape before it becomes a misleading stable surface.

## Policy Concerns / Non-Blocking Warnings

- The repository has unrelated/concurrent dirty `packages/**` and Mesh V2.6-sidecar files in `git status`. Domain A changed files do not import or rely on those package-side changes, but the integrator should continue to keep Domain A and Domain C evidence separated.
- The adapter intentionally duplicates some evaluation behavior that may later align with runtime-core. This is allowed by the preplan, which permits an editor-owned adapter and leaves runtime-core reuse to implementer judgment.
- Exact non-linear parent-local coordinate inversion remains a documented v0 residual risk in the Gnome report; it should be revisited during Domain B integration when overlay/control-point behavior is exercised against more complex nested deformers.

## Verification Evidence Assessment

- Gnome's reported focused vitest and editor typecheck results were independently reproduced.
- The initial vitest sandbox failure is environmental: it occurs before config load while esbuild tries to spawn. The same command passed outside the sandbox.
- Additional design/development guard checks passed:
  - `check:source` confirms no current automated source organization violation.
  - `check:deps` confirms the dependency guard still passes.

## Residual Risks

- Domain A has no Canvas panel integration yet; Domain B must prove the evaluated scene is actually used for image rendering, overlay, and hit testing.
- The new file is acceptable now but should be split if Domain B adds rendering/projection/hit-test behavior near the evaluation internals.
- The current adapter exposes editor-local interfaces. They should remain editor-local unless a future wave explicitly promotes them to shared contracts with schema review.

## Domain B Readiness Recommendation

Domain B is ready to proceed from a design/development compliance perspective.

Recommended guardrails for Domain B:

- Keep `canvas-renderer.ts` free of raw `AuthoringSession` imports; pass evaluated scene/projection data instead.
- Do not place triangle texture drawing, overlay migration, or hit-test migration into `canvas-evaluation.ts` if doing so broadens the file beyond evaluation ownership.
- Preserve non-mutating preview behavior for parameter scrub, mesh draft, rig draft, and control point drag preview.
- Continue to keep Mesh V2.6/package-side work separate from canvas evaluation/rendering evidence.
