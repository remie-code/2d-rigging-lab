# Wave70 Domain B Test Adequacy Review

- Verdict: `pass`
- Review lane: Test Adequacy Review
- Target: `wave70-editor-v6d-mainline-selector-removal`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed the Domain B test adequacy against the Wave70 plan and Domain A dependency, using direct diffs and file reads rather than the Gnome report alone.

Basis documents used:

- `discussion/implementation/orchestration/wave70-plan.md` sections 1-9, 11, 13-16
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md`
- `discussion/implementation/waves/wave70/_map.md`

Changed Domain B files inspected directly:

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Diffs inspected:

- `git diff -- apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `git diff -- apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/workspace/panels/mesh-tool-inspector.tsx apps/editor/e2e/psd-import.e2e.spec.ts`
- `git diff -- discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md discussion/implementation/waves/wave70/_map.md`

Note: the Domain B report/map are untracked in this workspace, so the last diff command produced no tracked diff output; the files were read directly.

## Acceptance-to-Test Coverage

| Acceptance / risk item | Coverage verdict | Evidence |
|---|---:|---|
| Visible backend selector is gone | Covered | State unit test asserts backend selector exports are absent in `mesh-tool-state.test.ts:39-42`. E2E asserts no visible `mesh-tool-backend-selector`, no `Experimental backend`, and no visible `v6D`/`v6E`/`v6F`/`backend` button in `psd-import.e2e.spec.ts:261-263`. A source grep for `mesh-tool-backend-selector`, `Experimental backend`, `Preview .*backend`, `MESH_GENERATION_BACKEND_OPTIONS`, `MeshGenerationBackendOption`, `backendOptionId`, and `parseMeshGenerationBackendOptionId` across the state/context/inspector files returned no matches. |
| Presets remain visible and working | Covered | Presets remain the state model in `mesh-tool-state.ts:40-58`; the unit test asserts the three product presets in `mesh-tool-state.test.ts:31-36`; the Inspector renders `MESH_GENERATION_PRESETS` as `Preview <label> mesh` buttons in `mesh-tool-inspector.tsx:259-276`; E2E clicks `Preview Standard mesh` and observes draft preview in `psd-import.e2e.spec.ts:255-258`, `psd-import.e2e.spec.ts:283-285`, and `psd-import.e2e.spec.ts:293-295`. |
| Normal preview default is `auto-outline-v6d-contour-band-support-rings` | Covered | Default constant is set in `mesh-tool-state.ts:61-63`; preview path passes that method to `createGeneratedMeshForDrawable` in `editor-session-context.tsx:655-664` and stores it in the draft at `editor-session-context.tsx:672-676`; unit tests assert the default constant in `mesh-tool-state.test.ts:13-18`. |
| Normal apply/default command path uses improved v6D, not V2.6 fallback | Covered | `commitGenerateMesh` defaults its method argument to `DEFAULT_MESH_GENERATION_METHOD` in `editor-session-commands.ts:275-280`; the command unit test builds a real v6 fixture and expects support-ring method/source/backend transform history in `editor-session-commands.test.ts:612-635`. E2E also asserts the visible source is not `Soft apron mesh` and the generation result contains `Contour support mesh` in `psd-import.e2e.spec.ts:255-258`. |
| Preview does not mutate committed mesh until Apply | Covered by existing semantic path | E2E observes `Draft preview` / canvas `draft` before Apply and `Generated` / canvas `committed` after Apply in `psd-import.e2e.spec.ts:255-299`. Regenerate/cancel returns from `Replacement draft` to `Generated` in `psd-import.e2e.spec.ts:301-306`, preserving the draft/commit boundary. |
| Apply commits the previewed improved-v6D mesh and provenance | Covered | Context Apply passes `meshDraft.mesh`, `meshDraft.method`, and preview provenance into `commitGenerateMesh` in `editor-session-context.tsx:687-708`. Unit test creates preview output, commits it, and compares committed vertices/UVs/triangles/stable IDs to the preview mesh in `editor-session-commands.test.ts:680-716`; it also asserts transform history markers for method, `previewMesh`, source, output kind, and backend in `editor-session-commands.test.ts:717-725`. |
| Old v6D/v6E/v6F explicit preview provenance remains safe | Covered | The command test iterates improved v6D plus old v6D/v6E/v6F cases in `editor-session-commands.test.ts:639-665`; each case is generated through `createGeneratedMeshForDrawable`, checked for matching v6 metrics, committed, and provenance-asserted in `editor-session-commands.test.ts:680-725`. |
| Historical old v6D/v6E/v6F display/formatter safety | Adequately source-reviewed; residual low test gap | UI source/fallback/backend formatters map old v6A-v6F ids to generic `Legacy contour mesh` rather than throwing or presenting them as selectable normal choices in `mesh-tool-inspector.tsx:494-504`, `mesh-tool-inspector.tsx:538-548`, and `mesh-tool-inspector.tsx:631-641`. There is no direct unit test for these private formatter branches, but explicit old-method preview/provenance commit coverage exists and the normal UI e2e proves the selector is not visible. This is not a blocking Domain B test gap. |
| Focused PSD import -> mesh preview/apply semantic path remains stable | Covered | The focused PSD import e2e path opens Mesh, previews Standard mesh, validates draft overlay attributes, applies mesh, sees `Generated` and committed overlay status, then checks regenerate/cancel behavior in `psd-import.e2e.spec.ts:246-306`. Orch-Sylph reran the supported focused command and it passed, 9 tests. |
| Source organization/typecheck guard for test changes | Covered as supporting validation | Orch-Sylph reran `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, and `git diff --check -- <Domain B files + report/map>` successfully; `git diff --check` only reported CRLF working-copy warnings. |

## Findings

No blocking or non-blocking test adequacy findings.

The assertions are meaningful rather than snapshot-only:

- Selector removal is tested at both code/export level and UI semantic level.
- Default routing is tested through real mesh generation/provenance expectations, not only a constant comparison.
- Apply behavior compares committed mesh geometry against the previewed mesh and asserts provenance markers.
- E2E covers the user-visible PSD import -> Mesh Tool -> preview -> Apply path.

## Validation Reviewed

Reviewed Orch-Sylph rerun results:

| Command | Reviewed result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox pass, 2 files / 17 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import` | Sandbox failed with Playwright `spawn EPERM`; outside-sandbox pass, 9 tests. |
| `git diff --check -- <Domain B files + report/map>` | Pass with CRLF working-copy warnings only. |

I did not rerun the full test set in this review lane; the review focused on adequacy of the focused tests and inspected the source/diff evidence directly.

## Test Gaps / Residual Risks

- Low residual risk: historical committed meshes with old v6D/v6E/v6F provenance are source-reviewed through formatter branches and partly covered by explicit old preview commit tests, but there is no dedicated UI test that mounts an already-committed old-v6D/v6E/v6F mesh and checks the Inspector label. Given the Wave70 goal is selector removal/default promotion, the current coverage is sufficient and this does not block Domain B.
- Visual quality of the improved support-ring mesh on broader artwork is intentionally outside Domain B test adequacy. Domain B proves routing, provenance, and UX semantics; Domain C / human visual review remains the right place for broader visual tuning risk.

## User-Decision Points

None.

## Verdict

`pass`
