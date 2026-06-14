# Wave70 Domain B Report: Editor v6D Mainline Selector Removal

- Verdict: `pass`
- Domain: `wave70-editor-v6d-mainline-selector-removal`
- Date: 2026-06-14
- Implementer: Gnome

## Files Changed

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
  - Removed the normal Mesh Tool backend option list and backend-option parser.
  - Switched `DEFAULT_MESH_GENERATION_METHOD` to `auto-outline-v6d-contour-band-support-rings`.
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
  - Updated default-method and provenance tests for the improved v6D support-ring method.
  - Added assertions that backend selector exports are no longer present.
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - Routed `commitGenerateMesh` default method through `DEFAULT_MESH_GENERATION_METHOD`.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Updated default command provenance expectations to improved v6D support-ring output.
  - Added improved v6D preview commit coverage while keeping old v6D/v6E/v6F explicit preview provenance safe.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - Removed backend option state from `MeshToolDraft` and `previewMeshDraft`.
  - Normal preview now generates with `auto-outline-v6d-contour-band-support-rings`.
  - Apply still commits the previewed mesh and preview provenance.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - Removed the visible `mesh-tool-backend-selector` section and v6D/v6E/v6F backend buttons.
  - Kept preset selection visible and working.
  - Reworded generation/source/fallback details toward quality/count/fallback labels instead of algorithm/library choice.
- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - Updated focused Mesh Tool semantic assertions for support-ring default generation and no visible backend selector.
- `discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md`
  - This report.
- `discussion/implementation/waves/wave70/_map.md`
  - Added Domain B status and next action.

No package, renderer, dependency manifest, or lockfile changes were made by Domain B.

## Basis Coverage Self-Report

| Basis item | Status | Evidence |
|---|---|---|
| Remove/hide visible backend algorithm selector | Implemented | `mesh-tool-inspector.tsx` no longer renders `data-testid="mesh-tool-backend-selector"` or backend buttons. E2E asserts visible selector count is 0. |
| Keep product-facing presets visible | Implemented | `MESH_GENERATION_PRESETS` remains unchanged; Inspector still renders the three preset buttons. Unit test asserts preset IDs. |
| Default Editor mesh preview/apply to improved v6D | Implemented | `DEFAULT_MESH_GENERATION_METHOD` is `auto-outline-v6d-contour-band-support-rings`; Context preview and command default use it. |
| Preserve preview -> Apply semantics | Implemented | Preview still creates an uncommitted `meshDraft`; Apply passes `previewMesh`, `meshDraft.method`, and preview provenance to `commitGenerateMesh`. Focused unit and e2e paths pass. |
| Preserve provenance | Implemented | Default command provenance records `generateMesh:auto-outline-v6d-contour-band-support-rings`, support-ring source, backend output, and backend id. Preview commit tests assert preview mesh geometry and provenance. |
| Do not make v6D/v6E/v6F normal user-facing UX | Implemented | Removed backend selector abstraction from normal state/UI; e2e asserts no visible v6D/v6E/v6F/backend buttons. |
| Historical old v6D/v6E/v6F data remains safe | Implemented | Explicit old v6D/v6E/v6F preview commit tests still pass; UI source/fallback/backend formatting maps old method/source IDs to generic legacy contour labels instead of crashing or exposing selector choices. |
| User-facing labels emphasize counts/quality/fallback | Implemented | Inspector rows now use `Generation result`, `Contour counts`, `Support rings`, `Support band`, `Constraint quality`, and generic fallback wording. |
| V2.6 remains callable as older method | Implemented | Domain B did not remove package method IDs or operation support; only Editor normal default changed. |

## Intentionally Deferred Basis Items

- Manual visual quality tuning of support-ring output remains Domain C / human visual review scope.
- Removal of old v6D/v6E/v6F backend implementations is explicitly out of scope; they remain callable for historical/comparison data.
- Renderer texture padding/dilation/filtering work remains out of scope and untouched.
- Side-by-side algorithm comparison UX remains out of scope and was not introduced.

## Preview / Apply / Provenance Trace

1. `MeshToolInspector` calls `previewMeshDraft(drawableId, presetId)` from preset buttons, initial empty-mesh auto-preview, and regenerate.
2. `EditorSessionProvider.previewMeshDraft` resolves the preset density and calls `createGeneratedMeshForDrawable` with:
   - `method: auto-outline-v6d-contour-band-support-rings`
   - `provenanceId: createMeshPreviewProvenanceId(drawableId, presetId, DEFAULT_MESH_GENERATION_METHOD)`
3. The generated mesh is stored in `meshDraft` with `method`, `source`, fallback data, and quality metrics.
4. `applyMeshDraft` calls `commitGenerateMesh` with the preview mesh, `meshDraft.method`, and preview provenance.
5. Operation provenance records the preview mesh path and support-ring v6 metrics; unit tests assert geometry equality and transform-history markers.

## Must-Not Compliance Evidence

- Did not edit Domain A backend implementation files.
- Did not edit renderer packages or reopen texture filtering/padding/dilation.
- Did not remove presets.
- Did not introduce a replacement algorithm selector under another name.
- Did not add dependencies or touch manifests/lockfiles.
- Did not delete old v6D/v6E/v6F methods.
- Did not add semantic auto-selection from part names, drawable names, or image content.
- Did not write review artifacts; only the implementation report and Wave70 implementation map were updated.

## Validation Performed

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox rerun passed, 2 files / 17 tests. |
| `pnpm.cmd test:e2e -- apps/editor/e2e/psd-import.e2e.spec.ts` | Invalid in this repo: root script `test:e2e` is not defined. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import -- psd-import.e2e.spec.ts` | Sandbox failed with `spawn EPERM`; also passed a literal `--` through the script, so it was not the final supported command. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import` | Outside-sandbox pass, 9 tests. This is the closest supported focused PSD import e2e command; `apps/editor/e2e` contains only `psd-import.e2e.spec.ts`. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `git diff --check -- <Domain B files + report/map>` | Pass; CRLF working-copy warnings only. |
| In-app Browser check | Attempted after starting a temporary Vite server on `127.0.0.1:4174`, but the Browser plugin reported `Browser is not available: iab`. The temporary server was stopped; no additional Browser evidence was collected. |

## Review Results

| Review lane | Final verdict | Notes |
|---|---|---|
| Spec Compliance Review | `pass` | Visible selector removal, preset preservation, improved-v6D default routing, preview/apply provenance, and historical old-method safety are implemented. |
| Design / Development Compliance Review | `pass` | No source-organization, operation-boundary, UX, dependency, renderer, or forbidden-scope findings. |
| Test Adequacy Review | `pass` | Focused unit and e2e coverage is adequate for selector removal, preset continuity, default routing, preview/apply provenance, legacy explicit preview safety, and PSD import mesh semantics. |

No Domain B fix loop was required.

## Residual Risk Classification

- Residual risk: `low`.
- Reason: selector removal, default routing, preview/apply provenance, focused unit tests, focused e2e, and typecheck all pass.
- Remaining risk is visual quality/tuning of the support-ring default on broader artwork, which is outside Domain B implementation and belongs to Domain C / human review.

## User-Decision Points

- None for Domain B implementation.
