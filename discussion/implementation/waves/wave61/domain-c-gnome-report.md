# Wave61 Domain C Gnome Report: mesh-tool-initial-generation-v0

## verdict

done

Domain C の source implementation と fix loop 1 は完了。Review-Sylph Lane 2/3 の blocking/high findings は修正済み。

## changed files summary

- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave61/domain-c-gnome-report.md`

Fix loop 1 touched:

- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave61/domain-c-gnome-report.md`

## review findings addressed

- Added operation-boundary topology validation for `generateMesh.previewMesh`.
- Rejects preview triangles that reference vertex indices outside `vertices.length`.
- Rejects preview triangles with repeated vertex indices.
- Added negative operation tests for out-of-range triangle index and degenerate repeated-index triangle.
- Extended focused E2E to cover draft discard on target change.
- Extended focused E2E to cover draft discard on Mesh tool close.
- Extended focused E2E to cover Part Container selected -> Drawable picker -> child Drawable -> preview path.

## design / AC coverage checklist

- Single Drawable target: done.
- Container selected -> Drawable picker within selected container: done, picker uses `getPartOrderedChildren`.
- Project / none selected empty state: done.
- Presets Large Motion / Standard / Low Motion: done.
- Alpha-aware grid triangulation: done for raw RGBA texture bytes; fallback to bounds grid when bytes are unavailable or dimension-incoherent.
- Draft preview does not mutate project mesh: done.
- Apply commits the previewed geometry: done via `generateMesh.previewMesh`; operation provenance is replaced at commit time while geometry is preserved.
- Regenerate keeps existing mesh until Apply: done.
- Cancel / tool close / target change discards draft: done and now E2E-covered.
- Selected Drawable mesh overlay only: done.
- Overlay toggle is display-only: done.
- Hidden Drawable edit preview without model visibility mutation: done.
- Clipping does not alter generation source: done.
- Batch generation / manual vertex edit / add-delete UI / split-count UI / advanced tuning: not added.

## package / operation / data-contract notes

- `createAlphaAwareGridMesh` and `createGeneratedMeshForDrawable` live in authoring-core.
- `auto-grid-v1` reads Drawable-owned texture RGBA bytes only when byte dimensions match rounded mesh bounds; otherwise it falls back to bounds-grid generation.
- Operation-core `GenerateMeshPayloadSchema` accepts optional `previewMesh` using contracts-level mesh field schemas, without adding a package-format dependency.
- `generateMesh` validates preview mesh method, target IDs, vertex/UV/stable-id cardinality, optional triangle-stable-id cardinality, triangle index range, and repeated-index degeneracy before `replaceDrawableMesh()`.
- Existing `manual-empty`, `auto-grid-v1`, and `auto-outline-v1` rejection semantics are preserved.
- Domain A mixed-order authority was consumed, not redesigned.
- PSD Import preview / hidden group / PSD bytes visibility semantics were not changed by Domain C.

## UI / Canvas behavior notes

- Mesh Tool active state switches Inspector to Mesh workflow.
- Drawable selection shows preset controls, generated/draft status, Apply, Regenerate, Cancel, and overlay toggle.
- Part selection shows a single-target Drawable picker; no batch path was added.
- Canvas projection exposes draft/committed selected-mesh overlay metadata for tests.
- Renderer draws draft mesh as dashed amber overlay and committed mesh as teal overlay.
- Hidden selected Drawable is temporarily projected for mesh editing preview without mutating `runtimeVisibility`.

## tests and verification commands

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`
  - escalated: pass, 1 file / 9 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - escalated: pass, 3 files / 19 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import e2e/psd-import.e2e.spec.ts -g "generates an initial mesh"`
  - escalated: pass, 1 test.
- `pnpm.cmd --dir apps/editor typecheck`
  - pass.
- `pnpm.cmd run typecheck`
  - pass.
- `pnpm.cmd run test:unit`
  - escalated: pass, 189 files / 985 tests.
- `pnpm.cmd run check`
  - escalated: pass, including dependency and source organization guards.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`
  - pass; LF -> CRLF warnings only.

Sandbox note: Vitest / Playwright / root check commands have repeatedly hit Vite/esbuild/browser `spawn EPERM` under sandbox in this workspace, so the important process-spawning checks were run with escalation.

## residual risks / constraints

- Raw alpha scan assumes tightly packed RGBA8 bytes whose byte length matches rounded mesh bounds; otherwise fallback is intentional.
- Geometry-level zero-area triangles with three distinct collinear vertices are not rejected in fix loop 1; the explicit review requirement was satisfied by repeated-index degeneracy rejection.
- No pixel/screenshot oracle was run, per scope.
- Workspace still contains unrelated Domain A / Domain B dirty files; they were not reverted.

## user-decision points

なし。
