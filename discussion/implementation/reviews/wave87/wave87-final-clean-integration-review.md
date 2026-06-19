# Wave87 Final Clean Integration Review

## Verdict

Verdict: `pass`.

Wave87 `texture-atlas-task-v0` satisfies the final clean integration gate. I found no blocking integration findings. Domain B's initial Operation Core escalation is resolved by Fix Loop 1, and the remaining issues are correctly recorded as residual risks or future user-decision points rather than Wave87 blockers.

## Scope Reviewed

- Wave target: `wave87-final-integration-clean-review-map-closeout`.
- Review role: independent final clean integration review.
- Reviewed from source, tests, plan, screen specs, development policies, implementation reports, review lanes, fix-loop reports, final integration report, and maps.
- Write scope honored: this review artifact only.

## Basis Documents Used

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/_map.md`
- Domain A report and three Domain A reviews under `discussion/implementation/waves/wave87/` and `discussion/implementation/reviews/wave87/`
- Domain B report, initial Domain B reviews, Fix Loop 1 report, and three Fix Loop 1 re-reviews
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- Wave87 wave/review maps and parent implementation/orchestration maps
- Development conventions: UX-backed package logic, source organization, dependency, operation, and schema/id policies

## Findings

| Severity | Finding | Evidence | Required action |
|---|---|---|---|
| none | No blocking integration finding. Wave87 meets the accepted Texture Atlas v0 plan and UX scope after Fix Loop 1. | Domain A and B review lanes pass, Domain B initial `escalate` is explicitly resolved by Fix Loop 1 re-reviews, and source inspection confirms the resolved implementation. | None. |
| residual | Actual atlas preview canvas is covered by source/projection/render tests, not a Playwright screenshot or real-browser canvas pixel check. | `atlas-task-projection.ts` creates RGBA preview bytes, `texture-atlas-task-screen.tsx` paints them with `ImageData` / `putImageData`, and tests assert byte pixels plus canvas markup. | Track as future hardening only. |
| residual | Canvas / Viewer parity is semantic/projection-level, not strict before/after rendered pixel equivalence. | Final report records focused Canvas texture-byte projection, Viewer runtime, and clean-stage tests passing, while noting no pixel-equivalence oracle. | Accept for Wave87; decide later if atlas parity needs browser pixel proof. |
| residual | Broader Canvas test run has one unrelated Dynamics preview failure. | Final report records the failure in `projects Dynamics preview additive output through Canvas keyform evaluation`, outside Wave87 atlas files. | Not a Wave87 blocker; address in future Dynamics work. |

## Plan / UX Compliance

Pass.

Wave87 delivers the accepted Texture Atlas Task v0 behavior:

- Dedicated Texture Atlas task route from the existing Toolbox entry.
- Large preview area plus target summary, settings, included/excluded/warning lists, Generate Preview, and Apply Atlas.
- v0 single-page deterministic packing only.
- No Inspector-based atlas UI, manual rect editor, multi-page optimizer, camera/tracking, or workspace export workflow.

Source evidence:

- `AuthoringWorkspaceContent` routes `activeEntry === "atlas"` to `TextureAtlasTaskScreen` and suppresses `ParameterBar`.
- `texture-atlas-task-screen.tsx` renders preview, settings, summary, lists, Generate Preview, and guarded Apply.
- `texture-atlas-task-screen.test.ts` covers route, Back, Toolbox activation, summary/list rendering, stale guard, and operation-backed Apply.

## Operation Core Boundary

Pass.

The initial Domain B design/development review correctly escalated the user-facing Apply path because it bypassed Operation Core. Fix Loop 1 resolves that issue.

Current facts:

- `applyTextureAtlasPreview` is a registered Operation Core operation type, payload, id path, registry entry, and public export.
- `commitTextureAtlasPreview()` creates an Operation Core request and calls `commitOperationAsync()`.
- The operation handler recreates the preview from current session/settings/hidden ids, rejects stale or failed previews, applies the Domain A mutation, and returns model-diff/log evidence.
- Sync lifecycle calls reject with `operation.applyTextureAtlasPreview.asyncLifecycleRequired`, so the async digest path is explicit.

Residual risk:

- Operation `runtimeDiff` and validation refs remain empty unless an evidence provider is supplied. The atlas-specific model diff is meaningful and tested, so this is not blocking for Wave87.

## Image Preview

Pass.

The initial rectangle-only preview concern is resolved. Domain B Fix Loop 1 adds actual generated atlas artwork preview:

- `createTextureAtlasPageRgbaBytes(preview)` produces raw RGBA page bytes from Domain A preview data.
- `createTextureAtlasTaskProjection()` exposes those bytes as `previewPage.image`.
- `AtlasPreviewImageLayer` paints them to a canvas with `putImageData`.
- Placement overlays and labels remain above the image layer.
- Tests assert preview image dimensions, byte length, red/green source pixels at expected atlas positions, canvas markup, and placement overlay markup.

The lack of Playwright/browser pixel proof is recorded as residual hardening, not a blocker.

## Target Selection

Pass.

Wave87 target selection matches the accepted semantics:

- Runtime/rig-bound texture-backed Drawables are included.
- Runtime-hidden bound Drawables remain included and get hidden metadata.
- Drawables under editor-hidden Parts remain included and get hidden metadata when editor hidden ids are provided.
- Unbound Drawable Pool Drawables are excluded as `unboundDrawablePool`.

Source/test evidence:

- `selectTextureAtlasTargets()` builds the bound set from `rigControls[].childDrawableIds`.
- Hidden reasons are metadata after inclusion, not inclusion criteria.
- Domain A and Domain B tests assert hidden included rows and unbound pool exclusions.

## Persistence / Save-Load

Pass.

Wave87 persists the required layout and generated asset meaning:

- `TextureAtlasEntry.dimensions` and `TextureAtlasLayoutSummary` are optional extensions under `texture-atlas-v1`.
- Layout summary records page, settings, algorithm id, placements, original texture ids, UV rects, hidden metadata, and generated operation id when applied through Operation Core.
- Generated atlas bytes are registered as package-local raw RGBA binary assets.
- Source texture entries are retained.
- Generated atlas bytes are not embedded into the operation payload or package JSON as raw/base64 atlas data.

Evidence:

- `package-document.test.ts` parses layout summary shape.
- `texture-atlas-mutations.test.ts` proves generated metadata and binary bytes survive portable bundle export/import.
- Operation Core tests assert log payload excludes `textureBytes` and `atlasBytes`.

## Canvas / Viewer Risk

Pass with recorded residual risk.

The final validation evidence is sufficient for Wave87:

- Focused Canvas projection test for runtime RGBA bytes passed.
- Viewer runtime route tests passed.
- Viewer clean-stage tests passed.
- Atlas Apply updates the same drawable texture refs and mesh UVs consumed by Canvas/Viewer projections.

Residual risk is honestly recorded: this is not a strict browser-rendered before/after pixel-equivalence proof.

## Forbidden Scope

Pass.

I found no forbidden scope in the reviewed Wave87 source:

- No Workspace Directory Export, directory picker, filesystem save, ZIP/archive export, or File System Access API implementation.
- No manual atlas placement editor or multi-page optimization.
- No camera capture/tracking.
- No Cubism SDK, `.moc3`, `.model3.json`, `.physics3.json`, or compatibility implementation.
- No new dependency or package manifest/lockfile diff.
- No broad renderer rewrite or unrelated Viewer/Dynamics/Mesh/Deformer/keyform feature addition.

The only base64/data URL hit in the focused source search is the existing `TexturePreviewReferenceSchema` deterministic preview data URL branch in `texture-atlas.ts`; the generated atlas page and operation payload do not use it.

## Map / Report Trace

Pass.

The maps and reports trace the wave honestly:

- Domain A is recorded as `pass`.
- Domain B initial state is recorded as `escalate` due to Operation Core boundary.
- Domain B Fix Loop 1 is recorded as resolving the escalation with Operation Core-backed Apply and actual atlas image preview.
- Final integration report is correctly `provisional pass pending final clean review`.
- Wave/review/implementation/orchestration maps currently mark the final clean review as pending.

That pending state is expected before this artifact exists and is not a needs-change finding. Parent closeout should update maps and final report after this review is accepted.

## Test Adequacy

Pass.

The focused tests are adequate for a final Wave87 gate:

- Target selection: hidden bound included, pool unbound excluded, deterministic warnings.
- Packing: deterministic single-page layout and cannot-fit failure.
- Apply mutation: generated texture entry, raw RGBA bytes, drawable refs, UV rewrite, topology preservation, already-applied guard.
- Persistence: package schema parse and portable bundle export/import.
- Operation Core: registry, async-only sync rejection, commit, dry run, stale layout rejection, failed preview rejection, model diff/log evidence.
- UI: route, Back, Toolbox entry, counts/lists/settings, preview image bytes, stale guard, operation-backed command helper.
- Canvas/Viewer: focused Canvas texture-byte projection plus Viewer runtime/clean-stage coverage.

## Verification Considered

Parent validation considered:

- `pnpm.cmd typecheck`: passed.
- Focused Wave87 Vitest suite: 10 files / 62 tests passed outside sandbox after known sandbox esbuild `spawn EPERM`.
- Focused Canvas texture-byte projection: 1 test passed.
- Source organization guard: passed.
- Dependency guard: passed.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

Reviewer-side verification:

- Inspected Wave87 source/test surfaces directly.
- Checked dependency manifest/lockfile diff for Wave87 package areas: no diff.
- Ran focused source searches for forbidden scope and Operation Core / target selection / persistence / preview evidence.

I did not rerun Vitest/typecheck in this review lane because parent supplied successful outside-sandbox results and the sandbox `esbuild` failure mode was already recorded.

## Residual Risks

- No Playwright/browser screenshot or canvas-pixel check proves the preview canvas paints in a real browser.
- Canvas / Viewer parity is not a strict rendered pixel-equivalence oracle.
- One unrelated broader Canvas Dynamics preview test failure remains outside Wave87.
- `dryRunOperationAsync()` / `commitOperationAsync()` names may need future API confirmation.
- The operation payload includes expected layout summary metadata; large models may make operation log payloads larger.
- Operation Core atlas `runtimeDiff` and validation refs remain empty unless a future evidence provider supplies them.
- Operation Core currently consumes atlas layout schemas through a narrow authoring-core re-export; a future package-boundary pass may prefer direct package-format dependency policy.

## User-Decision Points

- No blocking user decision is required to accept Wave87.
- Workspace Directory Export remains out of scope and should be planned separately before directory picker, filesystem save, ZIP/archive, or user-visible atlas image export work.
- Decide later whether async Operation Core API names are permanent.
- Decide later whether expected layout summary should remain the operation payload identity or be replaced by a smaller preview identity.
- Decide later whether actual atlas preview and Canvas/Viewer parity need browser pixel proof before the next atlas hardening gate.
- Decide later whether GUI operation logs should become durable package/export artifacts beyond the current operation outcome/history integration.
