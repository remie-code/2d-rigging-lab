# Wave78 Domain B Design / Development Compliance Review

- lane: Design / Development Compliance Review
- target: `wave78-canvas-keyed-warp-scale-handles-gesture-integration`
- verdict: pass
- reviewer: Review-Sylph

## Scope Reviewed

Reviewed directly from basis documents, source, tests, diff/status, focused searches, and verification commands. The Domain B report was used as orientation only.

Basis documents read:

- `discussion/implementation/orchestration/wave78-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-design-development-review.md`
- `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`

Source and tests inspected:

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`

## Findings

No blocking or warning findings.

## Compliance Notes

Source organization: pass.

The production changes stay inside the Domain B canvas/workspace surface plus the Domain A helper. `warp-deformer-scale.ts` has a single pure geometry responsibility at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:71`. The hook remains the owner of Warp pointer interaction and adds a `scale-drag` state without introducing a catch-all source file at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:78`. Renderer additions are local overlay drawing helpers at `apps/editor/src/workspace/canvas/canvas-renderer.ts:352`. The source organization guard passed.

Dependency policy: pass.

`git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` produced no manifest or lockfile changes. Import inventory showed only existing workspace/package imports plus existing test/runtime dependencies such as `react`, `react-dom/client`, and `vitest`. `node scripts/check-dependencies.mjs` passed.

Operation boundary: pass.

Scale drag uses the existing Warp gesture path. The hook creates a controller with `createWarpControlPointOffsetUpdateGesture` at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:249`, and that gesture commits through `editKeyformKey` with `action: "updateCurrent"` in `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:29`. The Warp binding is replace-mode at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:686`, and `canEditValue` is exact-key gated at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:326`.

Exact-key editability and off-key unavailability: pass.

Scale handles are visible only when the existing edit projection is commit-capable and the lattice/rest point shape is valid: `scaleHandlesVisible` is computed at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:204`, and the rest/cardinality gate is built at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:634`. Off-key behavior is covered by `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:205`.

Preview and commit determinism: pass.

Pointermove computes full replacement offsets with the pure helper at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:431` and stores preview in hook state, using `compositionMode: "replaceEvaluated"` at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:176`. Pointerup commits only through `finishPointerDrag`, only once, and only when moved and changed at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:477`. Pointercancel is wired through the panel with `commit: false` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:732`. No production source search found direct `session.graph` mutation or direct rest/domain/lattice update in the Domain B implementation files.

Forbidden scope: pass.

The implementation projects `restControlPoints` for preview/scale math but does not mutate source `restControlPoints`, `domainBounds`, lattice row/column counts, meshes, Deformer Tree, Viewer, package operations, or renderer architecture. `canvas-evaluation.ts` exposes cloned rest points at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:529`, and `canvas-projection.ts` clones them into the overlay at `apps/editor/src/workspace/canvas/canvas-projection.ts:463`. Searches for forbidden Cubism/format terms and rest-frame resize behavior in the reviewed files did not identify an implementation-scope violation.

Hit priority and interaction integration: pass.

`CanvasPreviewPanel` still delegates Rotation before Warp at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:380`, preserving the existing cross-deformer priority. Within Warp, scale handles are hit-tested before control points at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:234`, and `hitTestWarpScaleHandle` checks corners before edges at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:683`. Tests cover corner priority, edge priority, commit-once, and cancel discard at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:252`, `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:325`, and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:364`.

Coordinate-space handling: pass with residual risk.

Scale handle positions are derived from the same evaluated Warp control point overlay used for existing point hit testing, while committed offsets follow the same Canvas-delta-to-offset convention as existing point drag. This is no worse than the existing Warp point drag limitation. The residual parent-transformed Warp precision risk remains, because there is still no inverse-local coordinate conversion for parent Warp deformation.

Renderer and UI semantics: pass.

The renderer draws amber square/bar transform handles only when the hook marks them visible and the overlay is committed at `apps/editor/src/workspace/canvas/canvas-renderer.ts:358`. They are visually separate from teal control points and draft dashed overlays. This reads as keyed lattice transform affordance rather than rest-frame resize. The panel cursor does not yet distinguish scale-handle hover from the default crosshair at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:611`; that is a UX polish residual, not a compliance blocker.

Test/support code organization: pass with residual risk.

The new hook tests use local React hook harness and fake DOM support in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`. This does not add hidden dependencies and remains test-local, but the file is now large enough that future hook-test additions should consider extracting shared test support.

## Verification Commands Run

- `git status --short -uall`
  - Confirmed the Domain B source/test files are modified and Domain A helper/report files are still untracked in this worktree.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json`
  - Passed; no output.
- `git diff --check -- apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Passed with Git LF/CRLF normalization warnings only.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed.
- Focused `rg` searches over reviewed files for imports, direct mutation paths, `editKeyformKey`/`updateCurrent`, rest/domain/lattice references, Cubism/format terms, resize wording, and scale handle render/hit paths.
  - No blocking hits.

## Residual Risks

- Parent-transformed Warp scale precision inherits the existing point-drag limitation: drag deltas are Canvas-space deltas applied to keyed offsets without an inverse parent-deformer local-space solve.
- Hook and renderer both compute scale handle positions locally. Current behavior aligns, but future changes could drift without a shared helper or renderer-focused regression.
- No Playwright/pixel smoke was run in this lane; visual semantics were reviewed from renderer source and focused unit/hook evidence.
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts` now includes substantial local fake DOM support. It is acceptable for this wave, but future tests should avoid continuing to grow that file unchecked.
