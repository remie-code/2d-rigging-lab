# Wave69 Domain E Report: Editor V6D / V6E / V6F Selector Final Integration

- Verdict: `done`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-editor-v6d-v6e-v6f-selector-final-integration`
- Date: 2026-06-14
- Implementer: Gnome

## Implementation Summary

- Replaced the Mesh Tool temporary visible backend selector choices from v6A/v6B/v6C to:
  - `auto-outline-v6d-contour-constrainautor`
  - `auto-outline-v6e-contour-poly2tri`
  - `auto-outline-v6f-contour-custom-cdt`
- Preserved the Editor default backend option and command default as `auto-outline-v2.6-soft-apron`.
- Extended Mesh Tool Inspector labels for v6D/v6E/v6F method/source/backend/fallback formatting.
- Added v6F custom CDT compact diagnostic rows and changed shared Constrainautor / Poly2Tri diagnostic labels to match v6D/v6E when those candidates are previewed.
- Reconciled canonical v6E registry status from `deferred` to `implemented`.
- Removed the v6E route-local status override from `mesh-generation.ts` so the routed preview/apply path reads the canonical registry status.
- Updated editor command, authoring-core, operation-core, and PSD import E2E expectations for v6D/v6E/v6F preview/apply provenance.

## Files Changed

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md`

## Basis Coverage Self-Report

| Requirement | Status | Evidence |
|---|---|---|
| User can explicitly preview v6D/v6E/v6F for a selected Drawable | implemented | `MESH_GENERATION_BACKEND_OPTIONS` now exposes only default v2.6 plus v6D/v6E/v6F; PSD import E2E clicks the v6D backend selector. |
| v6A/v6B/v6C are not presented as current visible comparison choices | implemented | `mesh-tool-state.test.ts` asserts selector methods exclude v6A/v6B/v6C. Legacy formatter cases remain only for historical/headless provenance display. |
| Preview shows successful backend output or fallback | implemented | Inspector shows `v6 output`, fallback summary, source, counts, region/rejected counts, and backend-specific diagnostics. |
| Apply commits previewed mesh and provenance correctly | implemented | Editor command test now commits preview meshes for v6D, v6E, and v6F and asserts preview source/backend/output provenance. Operation-core preview provenance tests remain passing. |
| Default V2.6 behavior remains unchanged | implemented | `DEFAULT_MESH_GENERATION_METHOD` and `DEFAULT_MESH_GENERATION_BACKEND_OPTION_ID` unchanged; default test still asserts `auto-outline-v2.6-soft-apron`. |
| Existing PSD import / mesh preview / mesh apply semantic path remains stable | implemented | Focused Playwright PSD import -> Mesh preview/apply semantic test passed. |
| v6D/E/F shared contour pipeline status is final-integrated | implemented | v6D/v6E/v6F registry entries are canonical `implemented`; v6E route no longer reports implemented through a route-local override. |
| v6A triangulation / row-major interior placement not reused | implemented by upstream, preserved | Domain E did not edit backend algorithms and did not route visible selector to v6A. |
| v6F remains first-class custom candidate | implemented | v6F appears as a visible selector option and operation/authoring tests assert first-class backend output provenance. |
| Quality/fallback metadata distinguishes success from fallback | implemented | Inspector displays `backend-output`, `fallback-output`, or `blocked`; tests assert backend-output for v6D/E/F previews and blocked metadata for v6D/E/F empty/missing inputs. |
| Mesh tests avoid exact triangle-layout overfit | implemented | Added/updated assertions use method/source/backend/output metadata and DTO geometry equality for preview commit, not exact v6D/E/F triangle layout expectations. |

## Intentionally Deferred Basis Items

- Final backend selection is not made in Wave69.
- Side-by-side comparison UI remains out of scope.
- Permanent product UX for backend library choice remains out of scope.
- Full visual-quality judgment for v6D/v6E/v6F remains a human visual comparison decision.

## Mesh Generation Contract Trace

| Surface | Evidence |
|---|---|
| Editor selector surface | Visible backend option IDs now target v6D/v6E/v6F while retaining the default v2.6 option. |
| Authoring registry | v6D, v6E, and v6F all record `backendImplementationStatus: "implemented"`. |
| Routing | v6E route now uses `getV6MeshGenerationCandidate("auto-outline-v6e-contour-poly2tri")` directly. |
| Operation provenance | Operation-core test records v6E backend-output provenance from canonical implemented status; v6D/v6F branches remain first-class. |
| Preview/apply | Editor command test commits v6D/v6E/v6F preview meshes and checks preview source, backend, and backend-output provenance. |

## Must-Not Compliance Evidence

- Did not change any render package. Existing `packages/render-webgl2/**` NEAREST changes were left untouched.
- Did not switch the default from `auto-outline-v2.6-soft-apron`.
- Did not choose a final v6 backend.
- Did not edit v6D/v6E/v6F backend algorithm files.
- Did not add dependencies or modify manifests/lockfiles.
- Did not auto-select backend from part name, drawable name, or image semantics.

## Validation

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | sandbox failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: 4 files / 99 tests |
| `pnpm.cmd typecheck` | passed |
| `pnpm.cmd test:e2e:psd-import --grep "generates an initial mesh draft"` from `apps/editor` | passed: 1 Playwright semantic PSD import -> mesh preview/apply test |
| `node scripts/check-source-organization.mjs` | passed |
| `node scripts/check-dependencies.mjs` | passed |
| `git diff --check -- <Domain E changed files>` | passed; Git emitted CRLF working-copy warnings only |

## Residual Risk Classification

- Low selector integration risk: focused unit tests and the semantic E2E confirm v6D/v6E/v6F are the visible current comparison choices and v6A/v6B/v6C are not.
- Low preview/apply provenance risk: editor command and operation-core tests cover previewed v6D/v6E/v6F method/source/backend output propagation.
- Medium visual-quality risk remains by design: Wave69 does not select a final backend and automated tests do not replace human visual comparison.
- Low status-alignment risk: canonical v6E registry and route are aligned. The v6E backend implementation file still contains a same-value local `implemented` override from Domain C; it was not edited because backend algorithm files were outside Domain E write scope.

## User Decision Points For Final Backend Selection

- Choose whether v6D, v6E, v6F, or none should become the future default after visual comparison.
- Decide whether v6E's hole-like fallback is acceptable or whether true hole handling is required before promotion.
- Decide whether v6F's custom v0 triangulation quality is sufficient despite the recorded medium geometry risk.
- Decide when to remove or hide the temporary backend selector after a final backend decision.
