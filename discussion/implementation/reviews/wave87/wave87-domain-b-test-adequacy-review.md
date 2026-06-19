# Wave87 Domain B Test Adequacy Review

## Verdict

pass

## Findings

- Blocking findings: none.
- Non-blocking residual risk: the Atlas screen tests use `renderToStaticMarkup` plus projection/command helper calls rather than a stateful browser or Testing Library click flow for `Generate Preview` -> `Apply Atlas`. The source wiring is direct (`texture-atlas-task-screen.tsx:57-75`, `texture-atlas-task-screen.tsx:127-134`) and the helpers/command path are covered (`texture-atlas-task-screen.test.ts:181-270`), so this is not blocking for Domain B test adequacy.

## Scope Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`

Source/tests inspected:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- Related routing tests: `diagnostics-screen.test.ts`, `viewer-runtime-screen.test.ts`, `workspace-toolbox.test.ts`
- Domain A atlas test references: `packages/authoring-core/src/texture-atlas-mutations.test.ts`

## Coverage Matrix

| Required evidence | Adequacy | Evidence |
|---|---|---|
| Toolbox `Texture Atlas` opens the dedicated Atlas Task screen | Adequate | Toolbox data contains `{ id: "atlas", label: "Texture Atlas" }` (`workspace-data.ts:46`), Toolbox activation calls `setActiveEntry(entry)` (`workspace-toolbox.tsx:27-28`, `workspace-toolbox.tsx:73`), `AuthoringWorkspaceContent` routes `activeEntry === "atlas"` to `TextureAtlasTaskScreen` (`authoring-workspace.tsx:34-50`), and tests cover both route and Toolbox click (`texture-atlas-task-screen.test.ts:292-327`). |
| Back navigation returns to Authoring Workspace and does not open PSD import | Adequate | Back calls `setActiveEntry("import")` only (`texture-atlas-task-screen.tsx:98-102`), and the test asserts one `setActiveEntry("import")` call plus no `openPsdImport` call (`texture-atlas-task-screen.test.ts:307-318`). |
| Screen displays Included / Excluded / Warnings counts | Adequate | Sidebar renders the three summary metrics (`texture-atlas-task-screen.tsx:259-276`), and the static render test asserts counts `2 / 1 / 0` (`texture-atlas-task-screen.test.ts:273-289`). |
| Unbound Drawable Pool items appear as excluded, not included | Adequate | Fixture leaves `DRAW_POOL` out of `rigControls[].childDrawableIds` while preserving it in the pool part (`texture-atlas-task-screen.test.ts:389-414`). Projection maps Domain A excluded targets to rows (`atlas-task-projection.ts:159-165`) and labels `unboundDrawablePool` as `Unbound drawable in Drawable Pool` (`atlas-task-projection.ts:242-245`). Tests assert the pool row is excluded (`texture-atlas-task-screen.test.ts:172-178`) and rendered (`texture-atlas-task-screen.test.ts:285-286`). |
| Hidden bound drawables appear as included with hidden indication | Adequate | Fixture makes `DRAW_HIDDEN` runtime-hidden and bound to the rig (`texture-atlas-task-screen.test.ts:398-414`). Projection carries `currentlyHidden` and `hiddenReasonLabel` from Domain A (`atlas-task-projection.ts:150-157`), UI renders the hidden badge (`texture-atlas-task-screen.tsx:482-502`), and tests assert included order plus `Currently hidden` (`texture-atlas-task-screen.test.ts:163-170`, `texture-atlas-task-screen.test.ts:285`). |
| Generate Preview populates atlas preview state | Adequate | Screen `generatePreview` stores `createTextureAtlasTaskPreviewState(...)` in component state (`texture-atlas-task-screen.tsx:57-65`). The helper calls Domain A `createTextureAtlasPreview()` with settings and hidden part options (`atlas-task-projection.ts:171-192`), and tests assert a ready preview and two placements (`texture-atlas-task-screen.test.ts:181-207`). |
| Apply Atlas is disabled before valid preview and enabled after valid preview | Adequate | Projection sets `canApply` only for ready, non-stale previews with placements (`atlas-task-projection.ts:130-140`), and the Apply button is disabled from that flag (`texture-atlas-task-screen.tsx:127-130`). Tests assert initial disabled markup (`texture-atlas-task-screen.test.ts:273-289`), ready `canApply === true` (`texture-atlas-task-screen.test.ts:203-206`), and stale `canApply === false` (`texture-atlas-task-screen.test.ts:219-242`). |
| Apply calls Domain A mutation and updates project state | Adequate | Command helper imports/calls Domain A `applyTextureAtlasPreview` on a cloned session (`texture-atlas-session-command.ts:7`, `texture-atlas-session-command.ts:23-35`). Provider records the returned session into editor history/state (`editor-session-context.tsx:790-824`). Test applies a real Domain A preview and asserts generated layout summary, body/hidden texture refs, pool preservation, dirty state, and no mutation of the original session (`texture-atlas-task-screen.test.ts:245-270`). |
| Stale preview guard works when settings or target inputs change | Adequate | Signature includes revisions, hidden part ids, settings, included/excluded/warning summaries, packable UVs, texture sizes, and byte summary (`atlas-task-projection.ts:195-239`). Projection converts signature mismatch into stale status and warning (`atlas-task-projection.ts:120-128`, `atlas-task-projection.ts:361-368`). Tests cover settings change and texture target input change (`texture-atlas-task-screen.test.ts:208-242`). |
| Existing workspace routing behavior touched by Atlas route has focused regression evidence | Adequate | Atlas route is added to the same dedicated-screen conditional as Viewer/Diagnostics and suppresses `ParameterBar` (`authoring-workspace.tsx:44-56`, `authoring-workspace.tsx:91`). Existing Diagnostics and Viewer route tests still cover their dedicated routes/back behavior (`diagnostics-screen.test.ts:178-210`, `viewer-runtime-screen.test.ts:172-243`, `viewer-runtime-screen.test.ts:509-512`), and they were rerun with the Atlas test set. |
| Tests do not assert UI-local atlas behavior while source bypasses Domain A APIs | Adequate | Projection imports/calls Domain A `selectTextureAtlasTargets()` and `createTextureAtlasPreview()` (`atlas-task-projection.ts:10-13`, `atlas-task-projection.ts:109-112`, `atlas-task-projection.ts:176-182`); apply command imports/calls Domain A mutation (`texture-atlas-session-command.ts:7`, `texture-atlas-session-command.ts:23-29`). The tests exercise these helpers against real atlas fixtures, not mocked target selection/packing (`texture-atlas-task-screen.test.ts:152-270`). |
| Reported checks are plausible and sufficient | Adequate | Domain B report records focused Atlas UI tests, related routing tests, typecheck, source organization, dependency guard, and diff check (`wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md:92-103`). I reran the focused UI/routing tests and guard checks listed below. |

## Verification Considered

Reviewer-run verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - sandbox run failed with known `esbuild` `spawn EPERM`
  - escalated rerun passed: 4 files, 27 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `node scripts/check-dependencies.mjs`: passed
- `git diff --check -- apps/editor/src/workspace/authoring-workspace.tsx apps/editor/src/workspace/atlas/atlas-task-projection.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`: exit 0, LF/CRLF working-copy warnings only

I did not rerun Domain A package/core tests in this lane. Domain A test adequacy already passed, and Domain B source/tests use the exported Domain A APIs rather than duplicating selection, packing, or apply logic.

## Test Gaps / Residual Risks

- The UI test suite is mostly static render plus pure projection/command tests. This is enough for Domain B evidence, but a future browser/jsdom interaction test would be stronger for actual button-driven `Generate Preview` -> enabled `Apply Atlas`.
- Provider history integration is source-reviewed and the command helper is tested, but there is no focused provider-level assertion that the `Apply Texture Atlas` history label is recorded. This is not blocking because the project-state update path is covered through `commitTextureAtlasPreview()`.
- Canvas/Viewer visual parity after Apply remains final-integration territory. Domain B verifies routing and mutation wiring, not pixel rendering after atlas application.

## User-Decision Points

- No blocking user decision is needed for Domain B test adequacy.
- The existing residual product decision remains: whether Atlas Apply should later become a full Operation Core command instead of the current narrow editor-session command wrapper.
