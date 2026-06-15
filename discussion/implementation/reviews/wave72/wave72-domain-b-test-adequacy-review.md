# Wave72 Domain B Test Adequacy Review

## Verdict

`pass`

Fix loop 1 addressed the prior blocking test adequacy gaps. Domain B now has layered evidence across authoring-core round-trip, Editor storage service, Provider state replacement/error handling, App Bar/Open handoff, Project Storage status/error rendering, and focused Playwright browser save/load.

Remaining risks are non-blocking: the browser E2E is intentionally broad and can fail if unrelated PSD import / mesh / rig / parameter UI contracts regress, and a few transient reset branches remain implementation-inspection-only because there is no narrow public Provider setup path for mesh/rig drafts and operation feedback.

## Scope Reviewed

Reviewed updated Domain B source, tests, report, and prior review artifact:

- `discussion/implementation/orchestration/wave72-plan.md`, especially Sections 5, 7.3, 7.4, 10, 12, 14, 15, 16.
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/index.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/project-storage/model/browser-portable-project-transfer.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/features/project-storage/model/project-storage-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`

Basis docs considered:

- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/rig-tool.md` for state-preservation context.
- `discussion/design/screen-design/components/parameter-keyform.md` for state-preservation context.

## Test Matrix

| Requirement / evidence item | Status | Evidence | Notes |
|---|---:|---|---|
| AuthoringSession with texture bytes, mesh, warp deformer, rotation deformer, parameters, and keyforms round-trips through package document and portable bundle | Covered | `packages/authoring-core/src/portable-project-bundle.test.ts:34`, `:55`-`:76`, fixture at `:140`-`:355` | Fixture includes texture bytes, mesh vertices/UVs/triangles, rotation pivot/rest/keyed angle, warp hierarchy/offset keyforms, drawable opacity keyform, textureAtlas binary ref, source/provenance/rights. |
| Portable bundle reuses existing package-defined format | Covered | `packages/authoring-core/src/portable-project-bundle.ts:63`-`:68`, `:83`-`:85`; report `:45`, `:101`-`:106` | Editor imports through authoring-core; no new save format or direct editor package-format dependency. |
| Editor storage service export/import | Covered | `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:29`-`:50` | Covers file name, payload count, imported display name, drawable equality, and restored bytes. |
| Editor storage invalid bundle classification | Covered | `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:52`-`:58`; Provider error path at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:338`-`:359` | Now covered at service and Provider/user-visible state level. |
| Editor storage missing bytes / missing payload classification | Covered | `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:60`-`:84`; Provider missing payload path at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:365`-`:394` | Export missing bytes remains service-level; import missing payload is Provider-level with session preservation and issue metadata. |
| Editor storage digest mismatch classification | Covered | `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:86`-`:107`; Provider digest path at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:400`-`:435` | Provider test preserves current session and exposes `digestMismatch` metadata. |
| Provider save status | Covered | `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:255`-`:274`; implementation `apps/editor/src/features/editor-session/editor-session-context.tsx:527`-`:551` | Verifies dirty -> saved and storage status after export. |
| Provider load replacement | Covered | `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:280`-`:331`; implementation `apps/editor/src/features/editor-session/editor-session-context.tsx:559`-`:571` | Verifies loaded project identity and parameters replace previous session. |
| Provider reset/clear transient state after load | Covered enough for pass | implementation clears at `apps/editor/src/features/editor-session/editor-session-context.tsx:447`-`:461`; test seeds/asserts selection, PSD modal, parameter values, collapsed parts, hidden parts, undo/redo at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:286`-`:304`, `:322`-`:328` | Mesh/rig draft and feedback reset branches remain implementation-inspection-only, documented in report `:36`-`:37`; acceptable because committed mesh/rig restoration is covered by E2E. |
| Failed import preserves current project/session | Covered | `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:338`-`:359`, `:365`-`:394`, `:400`-`:435`; implementation catch path `apps/editor/src/features/editor-session/editor-session-context.tsx:572`-`:579` | Covers invalid bundle, missing payload, and digest mismatch. |
| App Bar Save Project wiring | Covered | `apps/editor/src/workspace/app-bar.tsx:123`-`:128`; `apps/editor/src/workspace/app-bar.test.ts:136`-`:144`; E2E `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:61`-`:65` | Unit click and browser download capture both covered. |
| App Bar Open Project / file handoff | Covered enough for pass | handler used by component at `apps/editor/src/workspace/app-bar.tsx:37`, `:107`-`:118`, helper `:141`-`:150`; test `apps/editor/src/workspace/app-bar.test.ts:157`-`:175`; E2E upload `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:67`-`:72` | Unit covers file input -> `openProjectFile(file)` handoff and clearing input. E2E covers hidden input upload by label. Direct native file-picker opening is not automatable but not a blocking gap. |
| Project Storage task discoverability | Covered | `apps/editor/src/workspace/authoring-workspace.tsx:31`-`:40`; `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:93`-`:103`; workspace data previously reviewed at `apps/editor/src/workspace/workspace-data.ts:40`-`:49` | Storage task render and controls are covered. |
| Project Storage saved/loaded status rendering | Covered | `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:105`-`:131`, `:133`-`:159` | Covers messages, file names, bundle/loaded bytes labels, and operation. |
| Project Storage error rendering | Covered | `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:161`-`:188`; implementation `apps/editor/src/workspace/project-storage/project-storage-screen.tsx:128`-`:150` | Covers status label, error code, issue code/message, target path, and file name. |
| Browser/e2e save-load path | Covered | `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:8`-`:114` | Imports PSD, applies mesh, authors opacity keyform, creates rotation + parent warp deformers, saves via download, reloads/reset, opens via hidden file input, and asserts restored tree/render/mesh/keyform/deformer state. |
| Binary assets preserved | Covered | authoring-core round-trip `packages/authoring-core/src/portable-project-bundle.test.ts:55`-`:76`; Editor service `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:29`-`:50`; E2E renderability after reload/open `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:73`-`:77` | Binary byte preservation has unit/service evidence and browser-level rendered artwork evidence. |
| Browser-local save excluded / forbidden storage boundaries | Covered by diff/report and dependency guard | report `:56`-`:58`, `:93`-`:96`, `:99`-`:105`; browser transfer uses Blob/object URL in `apps/editor/src/features/project-storage/model/browser-portable-project-transfer.ts:6`-`:39` | No IndexedDB/localStorage/File System Access/native/cloud/ZIP path introduced in Domain B. |
| No mesh regression from Domain B | Covered by scope and E2E | E2E applies/restores committed mesh at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:25`-`:33`, `:88`-`:93`; report `:104` | Domain B did not alter mesh generation algorithm; browser test proves saved/restored generated mesh remains usable. |

## Prior Findings Status

### User-visible storage error paths

Resolved.

Provider tests now cover invalid JSON, missing payload, and digest mismatch import failures while asserting the current session object is preserved and `projectStorage` exposes status, action, file name, error code, and issue metadata:

- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:338`-`:359`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:365`-`:394`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:400`-`:435`

Project Storage component tests now cover error code, issue code/message, target path, and file name visibility at `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:161`-`:188`.

### App Bar Open Project handoff

Resolved enough for pass.

The component now uses exported `createOpenProjectFileChangeHandler` at `apps/editor/src/workspace/app-bar.tsx:37`, with the helper defined at `:141`-`:150`. The test proves selected `File` handoff and input clearing at `apps/editor/src/workspace/app-bar.test.ts:157`-`:175`. The Playwright test also uploads the saved bundle through the hidden input label at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:67`-`:72`.

### Load reset coverage

Resolved enough for pass.

The Provider test now seeds and asserts reset of collapsed and editor-hidden parts in addition to selection, PSD modal, parameter values, and undo/redo (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:286`-`:304`, `:322`-`:328`). Mesh/rig draft and feedback reset branches are still not directly seeded, but the report documents why (`discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md:36`-`:37`) and the browser E2E proves committed mesh/rig state survives save/load.

### Project Storage saved/loaded/error display

Resolved.

Saved and loaded states are covered at `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts:105`-`:159`; error display is covered at `:161`-`:188`.

### Browser/e2e save-load evidence

Resolved.

The new Playwright test covers the Section 10 browser path with a real PSD import, mesh application, keyform authoring, rotation and warp deformer creation, browser download capture, reload/reset, hidden input upload, and restored tree/render/mesh/keyform/deformer assertions (`apps/editor/e2e/portable-project-save-load.e2e.spec.ts:8`-`:114`).

## Residual Risks

- The new browser E2E is intentionally broad. It provides strong user-path evidence, but it can fail from unrelated regressions in PSD import, mesh, rig, parameter, or task UI. That is acceptable for a focused wave gate, but the failure owner may not always be Domain B.
- App Bar Open's native file picker click is not directly unit-tested because native picker behavior is not meaningfully automatable. The tested handoff covers the deterministic part of the component, and the E2E covers file upload through the same input.
- Mesh/rig draft and operation feedback reset branches are not directly asserted through Provider setup. The public context lacks a narrow deterministic setup path for those transient branches without invoking broader mesh/rig UI behavior. This remains a low residual risk because load replacement resets the helper in source and committed mesh/rig preservation is browser-tested.
- The authoring-core round-trip fixture includes source/provenance/rights records, but explicit equality assertions focus on meshes, rig controls, parameters, keyforms, textureAtlas, and binary bytes. This is acceptable for Domain B because package document schema parsing and bundle import/export cover the represented package fields.

## Review Validation Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
  - Sandbox attempt failed before collection with esbuild `spawn EPERM`.
  - Re-run outside sandbox passed: 5 files, 24 tests.
  - Note: this current run has 24 tests, not the 23 tests recorded in the updated Gnome report.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - Sandbox attempt hit `4173` already-in-use before server start.
  - Re-run outside sandbox passed: 1 test.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts -g "imports a fixture PSD"`
  - Re-run outside sandbox passed: 9 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/editor/e2e/portable-project-save-load.e2e.spec.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.tsx apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`
  - Passed with CRLF normalization warnings only.

## Recommended Commands Before Integration Gate

No Domain B blocking test gaps remain. Before Wave72 integration closeout, run the combined wave/integration validation:

```powershell
pnpm.cmd typecheck
pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts
pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts
node scripts/check-source-organization.mjs
node scripts/check-dependencies.mjs
git diff --check
```

## User Decision Points

None.
