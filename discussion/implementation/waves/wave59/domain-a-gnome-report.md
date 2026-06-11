# Wave59 Domain A Gnome Report

## Verdict

done

## Recovery note

This recovery run reused the existing Wave59 Domain A partial implementation and report artifacts. No Wave59 source work was restarted or deleted. The previous UX review lane still records `needs_changes` for hidden-only Isolate Selected behavior, and the existing Fix Loop 1 source changes address that finding. This recovery reran the focused and required verification successfully after that fix.

## Files changed

### Runtime PSD-derived render bytes

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/features/psd-import/model/psd-import-types.ts`
- `apps/editor/src/features/psd-import/model/psd-import-planner.ts`
- `apps/editor/src/features/psd-import/model/psd-import-commit.ts`

### Canvas projection, renderer, and UI

- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`

### Package opacity semantics

- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`

### Tests

- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

### Report

- `discussion/implementation/waves/wave59/domain-a-gnome-report.md`

## Implementation summary by required scope

1. Render data availability after PSD import commit: implemented. The browser PSD adapter now returns selected layer RGBA bytes alongside materialization evidence. Commit registers those derived texture bytes into current `AuthoringSession.binaryAssets` via `registerAuthoringSessionBinaryBytes`.
2. PSD layer opacity preservation: implemented in `importPsdLayerMaterialization`; drawable `defaultOpacity` is now clamped from `sourceLayer.opacityInSource` instead of hardcoded `1`.
3. Session-derived Canvas projection outside React: implemented in `canvas-projection.ts`.
4. Canvas 2D renderer replacing placeholder: implemented in `canvas-renderer.ts` and wired into `CanvasPreviewPanel`; it draws grid, origin, canvas bounds, drawable stack by order/bounds/opacity, and selection overlays.
5. View controls: implemented wheel zoom centered at pointer, Space + left drag pan, Fit Artwork, Fit Canvas, 1:1, and zoom in/out.
6. Compact Canvas toolbar: implemented view controls, overlay toggles, and Isolate Selected.
7. Parts Tree to Canvas and Canvas to selection: implemented. Part/drawable selection projects to Canvas overlays; Canvas click selects deterministic topmost visible renderable drawable by bounds/order.
8. Runtime visibility reflection: implemented. Canvas projection uses `drawable.runtimeVisibility`; hidden drawables are not rendered or hit-tested.
9. Isolate Selected: implemented. Non-selected visible drawables dim when enabled, with the control disabled when no drawable selection/subtree exists.
10. Mask/clipping relation support: renderer-only existing model mask relation support implemented for enabled `session.graph.masks` using `destination-in`. PSD clipping extraction was not implemented because the current `@webtoon/psd` public `Layer` API does not expose a deterministic clipping-mask field; using private parser shapes would violate the private-shape boundary.

## Clipping status

Renderer-only existing relation support is implemented. PSD clipping extraction is blocked until an approved public parser API or product decision permits a deterministic, rights-safe extraction path.

## Runtime PSD byte/storage boundary

Raw source PSD bytes are not durably persisted by this change. The import plan carries selected-layer RGBA bytes only transiently during planning/commit. After commit, the session registers derived texture-raster bytes under package-local binary refs for rendering. Source PSD evidence remains metadata-only for this flow: digest, byte length, path/ref, and materialization evidence. This preserves the durable boundary against raw source PSD byte persistence.

## Verification

- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd --dir apps/editor build`: sandbox run failed with esbuild `spawn EPERM`; rerun with approved escalation passed. Vite emitted the existing large chunk warning only.
- `pnpm.cmd run typecheck`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`: sandbox run failed with esbuild `spawn EPERM`; rerun with approved escalation passed, 2 files / 9 tests.
- `pnpm.cmd run test:unit`: sandbox run failed with esbuild `spawn EPERM`; rerun with approved escalation passed, 185 files / 942 tests.
- `pnpm.cmd run check`: pass with approved escalation, including typecheck, 185 files / 942 tests, dependency guard, and source organization guard.
- `pnpm.cmd run smoke:wave44:psd-parser`: pass on `test_data/sample_model.psd`; smoke evidence still reports `bytesPersisted: false` for raster extraction.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass, 1 test.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`: pass with CRLF normalization warnings only.

## Residual risks and decision points

- PSD clipping extraction remains a product/parser boundary decision. The renderer can honor authored mask relations, but this wave does not infer PSD clipping from private `@webtoon/psd` internals.
- Hit testing is bounds-based and deterministic; it is not alpha-aware and does not use mesh topology.
- Rendering uses derived raw RGBA layer rectangles. It intentionally does not claim Photoshop pixel parity, blend-mode parity, atlas packing, mesh editing, or Cubism compatibility.
- The editor build still emits the existing Vite large chunk warning.
- The E2E uses non-visible `data-*` hooks for renderability and deterministic Canvas click coordinates; these are test hooks, not user-facing UI.

## Long-running process check

No long-running dev server remains. `Get-CimInstance Win32_Process` was denied by the OS policy, so verification used `netstat -ano | Select-String ':4173'` and `Get-Process -Name node`; port `4173` had only `TIME_WAIT` entries and no `LISTENING` process, and no `node` process was reported.

## Fix Loop 1

### Files changed

- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `discussion/implementation/waves/wave59/domain-a-gnome-report.md`

### Exact fix

Review-Sylph found that hidden-only selection could keep Isolate Selected active and dim all visible artwork. The fix adds `hasIsolatableCanvasSelection(projection)`, which returns true only when the current direct selection or selected part subtree contains at least one visible renderable drawable. `CanvasPreviewPanel` now disables Isolate Selected and reports it unpressed when that helper is false. `canvas-renderer.ts` also uses the same helper before applying isolate dimming, so an already-enabled isolate toggle becomes a no-op after switching to a hidden-only selection. Hidden drawables remain skipped for normal rendering and hit testing.

Focused coverage now checks visible direct selection, visible part-subtree selection, hidden direct selection, and hidden-only part-subtree selection.

### Verification results

- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`: sandbox run failed with esbuild `spawn EPERM`; recovery rerun with approved escalation passed, 2 files / 9 tests.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: recovery rerun passed, 1 test.
- `git diff --check -- apps packages discussion`: pass with CRLF normalization warnings only.
- Long-running dev server check: recovery run found only `TIME_WAIT` entries for `:4173` and `Get-Process -Name node -ErrorAction SilentlyContinue` returned no node process.

### Remaining risks

- No additional Fix Loop 1 verification gap remains after recovery reruns.
