# Wave70 Domain B Spec Compliance Review

- Verdict: `pass`
- Review lane: Spec Compliance Review
- Target: `wave70-editor-v6d-mainline-selector-removal`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed basis documents:

- `discussion/implementation/orchestration/wave70-plan.md`, sections 1-9, 11, and 13-16.
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`.
- `discussion/implementation/reviews/wave70/wave70-domain-a-spec-compliance-review.md`.
- `discussion/implementation/reviews/wave70/wave70-domain-a-design-development-review.md`.
- `discussion/implementation/reviews/wave70/wave70-domain-a-test-adequacy-review.md`.
- `discussion/design/screen-design/components/mesh-tool.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/development_convention/operation-policy.md`.

Reviewed implementation evidence directly:

- `git diff --` over the requested Domain B files.
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`.
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`.
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`.
- `apps/editor/e2e/psd-import.e2e.spec.ts`.
- `discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md`.
- `discussion/implementation/waves/wave70/_map.md`.

Domain A is treated as an already-present dependency. I only checked that Domain B uses the Domain A method/source/backend IDs consistently.

## Basis Requirement Classification

| Requirement / basis item | Classification | Evidence |
|---|---|---|
| Visible backend algorithm selector is removed or hidden from Mesh Tool. | implemented | Backend option type/list/parser exports are absent from `mesh-tool-state.ts`; the default-only state is at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:61`. Inspector imports only presets from mesh state at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:16`-`20`, holds only `presetId` state at line `42`, and renders no backend selector section in the current file. E2E asserts visible `mesh-tool-backend-selector` count is `0` at `apps/editor/e2e/psd-import.e2e.spec.ts:261`. |
| Product-facing presets remain visible and working. | implemented | Presets remain `largeMotion`, `standard`, and `lowMotion` at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:40`-`59`. Inspector renders preset buttons from `MESH_GENERATION_PRESETS` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:260`-`278`; preset clicks call `previewMeshDraft` at lines `128`-`132`. Unit test asserts the preset IDs at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:31`-`36`. |
| Normal Editor mesh preview default routes to `auto-outline-v6d-contour-band-support-rings`. | implemented | `DEFAULT_MESH_GENERATION_METHOD` is `auto-outline-v6d-contour-band-support-rings` at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:61`-`63`. `previewMeshDraft` passes that method and provenance method into `createGeneratedMeshForDrawable` at `apps/editor/src/features/editor-session/editor-session-context.tsx:655`-`664` and stores it on the draft at lines `672`-`676`. |
| Apply/default command route uses the improved v6D support-ring method. | implemented | `commitGenerateMesh` defaults its method parameter to `DEFAULT_MESH_GENERATION_METHOD` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275`-`281`. Command test asserts transform history includes `generateMesh:auto-outline-v6d-contour-band-support-rings`, support-ring source, backend output, and backend ID at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:625`-`635`. |
| Preview does not mutate committed mesh; Apply commits the previewed mesh. | implemented | Preview stores generated output only in `meshDraft` at `apps/editor/src/features/editor-session/editor-session-context.tsx:649`-`682`. Apply passes `meshDraft.mesh` into `commitGenerateMesh` at `apps/editor/src/features/editor-session/editor-session-context.tsx:692`-`707`. Unit test verifies committed vertices/UVs/triangles/stable IDs equal the preview mesh at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:711`-`716`. E2E checks draft state before Apply and committed state after Apply at `apps/editor/e2e/psd-import.e2e.spec.ts:293`-`299`. |
| Preview -> Apply provenance is preserved. | implemented | Apply forwards preview source, fallback reason/steps, and quality metrics as preview provenance at `apps/editor/src/features/editor-session/editor-session-context.tsx:701`-`705`. Unit test asserts `meshSource:previewMesh`, `previewMeshSource`, `meshQuality:v6ActualSource`, `meshQuality:v6Output`, and `meshQuality:v6Backend` at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:717`-`725`. |
| v6D/v6E/v6F algorithm choice is not normal user-facing UX. | implemented | `rg` over `apps/editor` found old selector strings only in negative tests. Inspector's user-facing v6 summaries are generic: `Generation result`, `Contour counts`, `Support rings`, `Support band`, and `Constraint quality` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:186`-`229`. E2E asserts no visible role button with `v6D`, `v6E`, `v6F`, or `backend` in the accessible name at `apps/editor/e2e/psd-import.e2e.spec.ts:263`. |
| Existing mesh summary may show counts and quality/fallback status, while avoiding algorithm/library choice as primary UX. | implemented | Inspector retains source, counts, max edge/area/min angle, v6 output state, contour counts, fallback steps, support ring counts, and constraint quality at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:164`-`229`. Old backend IDs are formatted as generic labels by `formatV6Backend` at lines `631`-`641`. |
| Historical old v6D/v6E/v6F preview/provenance data remains safe. | implemented | Formatter maps old v6D/v6E/v6F source IDs to `Legacy contour mesh` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:494`-`504`, old fallback methods to `Legacy contour mesh` at lines `538`-`548`, and old backend IDs to `Legacy contour mesh` at lines `631`-`641`. Unit test explicitly commits preview meshes for improved v6D plus old v6D/v6E/v6F and checks geometry/provenance preservation at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`-`725`. |
| Tests prove visible Editor options do not expose v6D/v6E/v6F backend selection. | implemented | Unit test asserts backend selector exports are absent at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:39`-`42`. E2E asserts selector absence and no v6D/v6E/v6F/backend button at `apps/editor/e2e/psd-import.e2e.spec.ts:261`-`263`. |
| Command/default paths must not silently fall back to V2.6. | implemented | Default method is improved v6D at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:61`-`63`, and command default imports that constant at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:21` and uses it at line `280`. E2E asserts the displayed source is not `Soft apron mesh` after normal preview at `apps/editor/e2e/psd-import.e2e.spec.ts:255`-`258`. Remaining v2.6 strings in Inspector are historical/fallback formatter cases at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:507` and `553`. |
| Operation provenance distinguishes improved v6D backend output. | implemented | Domain A supplies the method/source/backend contract at `packages/authoring-core/src/mesh-generation-contract.ts:99`-`105`. Domain B command test asserts the improved support-ring method/source/backend and backend-output provenance in transform history at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:625`-`635`. |
| Fallback and blocked output provenance remains distinguishable through Preview -> Apply. | implemented | Domain B apply forwards `fallbackReason`, `fallbackSteps`, and `qualityMetrics` from the preview result into commit provenance at `apps/editor/src/features/editor-session/editor-session-context.tsx:701`-`705`. Domain A owns the typed fallback/blocked contract; Domain B does not strip those fields. |
| V2.6 remains callable as an older method unless removal is explicitly required. | not relevant | Domain B did not remove package methods. In Editor scope, V2.6 remains only as historical/fallback display handling at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:507` and `553`; normal defaults no longer route to it. |
| Do not replace selector with another algorithm-choice UI. | implemented | Inspector renders preset and actions sections only for normal generation controls at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:260`-`320`. No alternate backend-option state, option list, or preview-backend handler remains in the current file. |
| Do not remove presets. | implemented | See preset evidence above at `mesh-tool-state.ts:40`-`59` and Inspector lines `260`-`278`. |
| Do not auto-select algorithms from part names, drawable names, or semantic image recognition. | implemented | Preview routing depends only on selected drawable, selected preset density, and `DEFAULT_MESH_GENERATION_METHOD` at `apps/editor/src/features/editor-session/editor-session-context.tsx:649`-`664`. No semantic auto-selection path was added. |
| Do not claim side-by-side comparison UX as mandatory scope. | explicit non-goal | Wave70 section 16 marks side-by-side visual diff UI out of scope. Domain B removes the comparison selector and does not add a comparison surface. |
| Do not reopen renderer/WebGL texture quality work. | not relevant | Domain B diff is limited to Editor files and discussion reports/maps. No renderer package files are in the reviewed Domain B diff. |
| Use v6D lineage IDs, not public `v6g` IDs. | implemented | Domain B uses `auto-outline-v6d-contour-band-support-rings` and `outline-v6d-contour-band-support-rings-rgba`. `rg` over the reviewed Editor files found no `v6g`, `auto-outline-v6g`, or `outline-v6g` matches. |
| Machine-readable IDs contain no spaces. | implemented | Added/used method/source/backend IDs are kebab-case and space-free; Domain B did not add new space-containing machine-readable IDs. |
| GUI mutation routes through Operation Core. | implemented | Apply calls `commitGenerateMesh`, which wraps an Operation Core `generateMesh` operation at `apps/editor/src/features/editor-session/editor-session-context.tsx:692`-`707` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275`-`292`. |

## Findings

No blocking or required-change findings.

| ID | Severity | Finding | Evidence / disposition |
|---|---|---|---|
| W70-B-SPEC-I-001 | informational | Inspector still contains internal formatter cases for old v6D/v6E/v6F IDs. This is intentional historical display safety, not a visible backend selector. | Old source/method/backend cases are mapped to generic labels at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:494`-`504`, `538`-`548`, and `631`-`641`. Tests also keep old preview provenance safe at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`-`725`. |

## Validation Reviewed Or Rerun

Reviewed Orch-Sylph validation summary:

| Command | Reviewed result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox pass, 2 files / 17 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import` | Sandbox failed with Playwright `spawn EPERM`; outside-sandbox pass, 9 tests. |
| `git diff --check -- <Domain B files + report/map>` | Pass with CRLF working-copy warnings only. |

Reviewer reran / inspected:

| Command | Result |
|---|---|
| `git diff -- <Domain B files + report/map>` | Reviewed directly. Domain B source diff is the seven Editor files; report/map were untracked at review time and read directly. |
| `git diff --check -- <Domain B files + report/map>` | Pass; CRLF working-copy warnings only. |
| `rg -n "mesh-tool-backend-selector\|Experimental backend\|Preview .*backend\|MESH_GENERATION_BACKEND\|DEFAULT_MESH_GENERATION_BACKEND\|parseMeshGenerationBackendOption\|MeshGenerationBackendOption\|v6D Contour\|v6E Contour\|v6F Custom" apps/editor` | Only negative tests matched. |
| `rg -n "auto-outline-v6g\|outline-v6g\|v6G\|v6g" <reviewed Editor paths>` | No matches. |
| `rg -n "auto-outline-v2\\.6-soft-apron\|default-v2-6-soft-apron\|outline-v2-6-soft-apron" <reviewed Editor paths>` | Only historical/fallback formatter cases remain in `mesh-tool-inspector.tsx`. |

I did not rerun Vitest/typecheck/e2e because Orch-Sylph already recorded outside-sandbox passes after known sandbox `spawn EPERM` failures.

## Residual Risks

- Broader visual quality/tuning of the new support-ring default remains a Domain C / human visual review risk, not a Domain B selector/default compliance blocker.
- Historical old-method display safety is covered by formatter behavior and preview commit tests, but not by a dedicated browser fixture containing already-persisted old-method provenance. The current risk is low because the formatter covers the old IDs directly.
- Browser plugin visual inspection was not available to Gnome per the Domain B report, so this spec review relies on source, unit tests, and Playwright e2e evidence.

## User-Decision Points

None for Domain B spec compliance.

## Recommendation

Accept Domain B as `pass` for Spec Compliance Review. The visible backend selector is removed, presets remain the visible user control, normal preview/apply routes to `auto-outline-v6d-contour-band-support-rings`, preview-to-Apply provenance is preserved, and v6D/v6E/v6F algorithm selection is no longer normal Editor UX.
