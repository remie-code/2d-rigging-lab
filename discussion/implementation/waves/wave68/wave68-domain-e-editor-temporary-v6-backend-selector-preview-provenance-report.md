# Wave68 Domain E Report: Editor Temporary V6 Backend Selector / Preview Provenance

- Status: complete / pass
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-editor-temporary-v6-backend-selector-preview-provenance`
- Date: 2026-06-14
- Owner: Orch-Sylph
- Implementation agent: Gnome `019ec4a4-f4b2-7e90-93c2-5d66ffaa8b2c`
- Review agents:
  - Spec Compliance Review: Review-Sylph `019ec4c2-fd8a-7691-8425-94aff92486b3`
  - Design / Development Compliance Review: Review-Sylph `019ec4c3-6dba-7f13-b876-04514f6c30c2`
  - Test Adequacy Review: Review-Sylph `019ec4c3-e2e2-76d0-8e95-f1578b615e94`

## Verdict

`pass`

Domain E adds a bounded temporary `Experimental backend` selector to the existing Mesh Tool. Product-facing mesh presets remain separate, default preview/apply behavior remains `auto-outline-v2.6-soft-apron`, and v6a/v6b/v6c can be explicitly previewed for a selected Drawable.

Initial Spec Compliance and Design / Development reviews returned `needs_changes` because preview Apply preserved mesh geometry and method but dropped preview actual source, fallback, and v6 quality metrics from committed Operation provenance. Fix Loop 1 added `previewProvenance` to the `generateMesh` preview commit path and all review lanes passed re-review.

## Current-State / Dirty-Worktree Classification

### Domain E-owned changes

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
  - Adds temporary backend option IDs and labels for default v2.6 plus v6a/v6b/v6c.
  - Keeps `DEFAULT_MESH_GENERATION_METHOD` as `auto-outline-v2.6-soft-apron`.
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
  - New focused default/temporary backend option coverage.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - Carries selected backend method in `MeshToolDraft`.
  - Preview calls `createGeneratedMeshForDrawable` with the selected backend.
  - Apply commits the preview mesh with selected method and preview provenance.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - Adds a separate `Experimental backend` / `Temporary` section.
  - Shows v6 source, output kind, fallback, boundary/interior counts, and backend diagnostics.
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - Forwards optional `previewProvenance` into the existing Operation Core `generateMesh` request.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Adds v6 preview apply provenance coverage.
- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - Restores the default mesh source expectation to v2.6 and adds a v6A backend selector semantic assertion.
- `packages/operation-core/src/payloads/model-edit.ts`
  - Adds validated `previewProvenance` for preview mesh commits.
- `packages/operation-core/src/operations/generate-mesh.ts`
  - Records `previewMeshSource`, fallback steps, and quality metrics when committing a preview mesh.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Adds backend-output and fallback-output preview provenance coverage.

### Pre-existing / unrelated editor changes preserved

These `apps/editor` changes existed before Domain E and were not attributed to Domain E:

- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`

They add or test bounds-quad rendering fallback for empty/degenerate committed meshes and are render/WebGL-adjacent. Domain E did not edit them.

### Other Wave68 dirty worktree areas not attributed to Domain E

- Wave68 Domains A-D package/backend/source/test changes under `packages/authoring-core/**` and parts of `packages/operation-core/**`.
- `packages/authoring-core/package.json`, `pnpm-lock.yaml`, and `generated/dependencies/dependency-registry.json`.
- Mesh-generation design docs and Wave68 Domain A-D reports/reviews.
- `tmp/**` run logs.

Domain E did not run `pnpm install`, did not edit package manifests or lockfile, did not edit generated dependency registry, did not edit render packages, and did not edit mesh backend algorithm files.

## Implementation Summary

The Mesh Tool now has two independent dimensions:

- Preset: `Large Motion`, `Standard`, `Low Motion`.
- Temporary backend: default v2.6, v6A Local, v6B Constrainautor, v6C Poly2Tri.

The default backend option resolves to `auto-outline-v2.6-soft-apron`, so the existing preview/apply path remains unchanged unless the temporary backend selector is explicitly used.

When a v6 backend is selected, preview stores:

- selected method
- preview mesh
- actual source
- alpha bounds
- fallback reason and steps
- quality metrics, including `v6Metrics`

Apply still routes through Editor command -> Operation Core. Fix Loop 1 extends the existing `generateMesh` preview commit payload with `previewProvenance`, allowing committed provenance to retain:

- `meshSource:previewMesh`
- `previewMeshSource:<actual source>`
- fallback steps/reason
- `meshQuality:v6ActualSource=...`
- `meshQuality:v6Output=backend-output|fallback-output|blocked`
- v6 backend diagnostics where present

## Acceptance Trace

| Requirement | Result | Evidence |
|---|---|---|
| User can explicitly preview v6a/v6b/v6c for a selected Drawable. | Implemented | Backend options map to `auto-outline-v6a-local`, `auto-outline-v6b-constrainautor`, and `auto-outline-v6c-poly2tri`; Mesh Tool buttons call the same preview path with selected backend ID. |
| User can see successful backend output vs fallback. | Implemented | Inspector shows source, fallback summary, v6 output kind, boundary/interior counts, and v6b/v6c diagnostics. |
| Apply commits previewed mesh and provenance correctly. | Implemented after Fix Loop 1 | Preview mesh geometry is committed and preview actual source/fallback/quality are persisted through Operation provenance. |
| V2.6 default remains unchanged when selector is unused. | Implemented | Default option and method remain `default-v2-6-soft-apron` / `auto-outline-v2.6-soft-apron`; focused test locks this behavior. |
| Existing PSD import / mesh generation / deformer creation semantic flow remains stable. | Partially verified | Focused unit tests, typecheck, and production build passed. Playwright semantic flow did not reach Domain E assertions due an initial `Import PSD` reachability timeout. |
| Backend selector is isolated/temporary and easy to remove/hide later. | Implemented | Selector is centralized in `mesh-tool-state.ts` and rendered as a single `Experimental backend` section labeled `Temporary`. |

## Review Lanes

| Lane | Initial verdict | Fix Loop 1 result | Final verdict |
|---|---|---|---|
| Spec Compliance Review | `needs_changes` | Added durable preview provenance through `previewProvenance`; re-review found no spec regressions. | `pass` |
| Design / Development Compliance Review | `needs_changes` | Vertical operation-boundary fix preserved Operation Core mutation path and source boundaries. | `pass` |
| Test Adequacy Review | `pass` | Re-review confirmed new backend-output and fallback-output preview provenance tests. | `pass` |

Review artifacts:

- [Spec Compliance Review](../../reviews/wave68/wave68-domain-e-spec-compliance-review.md)
- [Design / Development Compliance Review](../../reviews/wave68/wave68-domain-e-design-development-review.md)
- [Test Adequacy Review](../../reviews/wave68/wave68-domain-e-test-adequacy-review.md)

## Verification

Parent / Orch-Sylph verification:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox hit Windows `esbuild spawn EPERM`; approved rerun passed, 3 files / 43 tests. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `pnpm.cmd --dir apps/editor exec vite build --outDir ../../tmp/wave68-domain-e-fix1-build --emptyOutDir` | Sandbox hit Windows `esbuild spawn EPERM`; approved rerun passed, 2182 modules transformed, normal chunk warning only; temporary output removed. |
| `git diff --check -- <Domain E tracked/fix files>` | pass, LF/CRLF warnings only |
| `git diff --no-index --check -- NUL apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts` | no whitespace diagnostics; expected no-index nonzero exit and LF/CRLF warning only |

Playwright:

| Command | Result |
|---|---|
| `pnpm.cmd --dir apps/editor exec playwright test -c playwright.config.ts -g "generates an initial mesh draft"` | Approved run failed before Domain E assertions: timed out waiting for the initial `Import PSD` button after `page.goto("/")`. Generated test output was cleaned. |

The Playwright gap remains residual risk for final integration, not a Domain E blocker, because the wave plan marks the focused Playwright semantic flow as conditional on stability and the failure occurred before the modified Mesh Tool assertions.

## Must-Not Compliance

- Backend selection is labeled temporary/experimental, not permanent end-user UX.
- Product-facing presets remain separate from backend selection.
- No backend is selected from part name, drawable name, or semantic image recognition.
- No v6 candidate is claimed as final or default.
- No side-by-side visual diff UI was added.
- No rendering/WebGL feature work was added by Domain E.
- No package manifest, lockfile, dependency registry, render package, or mesh backend algorithm edits were made by Domain E.

## Residual Risk

- Browser semantic E2E risk: medium. The focused Playwright flow did not reach Domain E assertions because the app did not expose the initial `Import PSD` button in that run.
- UI coverage risk: low. E2E clicks v6A only; v6B/v6C share the same mapped UI path and are covered through backend/operation tests.
- Fallback UI display risk: low. Operation tests cover fallback-output preview provenance, and the UI renders `outputKind`, but there is no stable browser fixture assertion for a fallback preview label.
- API hardening risk: low. `previewProvenance` is shape-validated and requires `previewMesh`, but Operation Core does not yet cross-check that `previewProvenance.qualityMetrics.v6Metrics.methodId` matches payload `method`.

## User-Decision Points

None for Domain E.

Later Wave68 / Domain F work should rerun or repair the PSD import semantic Playwright flow before claiming full browser-level stability, and should decide after comparison whether a v6 backend becomes the final non-temporary path.
