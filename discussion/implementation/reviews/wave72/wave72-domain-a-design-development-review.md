# Wave72 Domain A Design / Development Compliance Review

## Verdict

`pass`

Fix loop 1 resolves the previous Domain A blocking findings. The Rotation Deformer edit UX implementation is now acceptable for Design / Development Compliance.

The Editor package-wide typecheck still fails, but the remaining failures are outside the reviewed Domain A source files: parallel Project Storage tests, a non-Domain-A editor-session history fixture, and the shared/unmodified canvas render scene adapter. I classify those as residual integration/shared risks rather than Domain A blockers.

## Scope Reviewed

Reviewed from the updated Domain A report, prior review artifact, current source/diff, focused tests, typecheck output, source organization guard, dependency guard, and diff whitespace check.

Domain A files reviewed:

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

Boundary-only notes:

- Parallel Domain B Project Storage / portable bundle / App Bar / workspace files were not reviewed as Domain A.
- `packages/authoring-core/src/index.ts` remains barrel-only where observed.
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts` is not a Domain A changed file, but it still contributes a package-wide Editor typecheck failure.

## Basis Documents Used

- `discussion/implementation/orchestration/wave72-plan.md`, especially sections 3, 5, 7.1, 7.2, 9, 14, 15, 16.
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`

## Findings

No remaining blocking Domain A Design / Development findings.

### Resolved: Renderer helper import/use mismatch

Previous finding:

- `canvas-renderer.ts` imported/called `getRotationDeformerHandlePositions`, but `rotation-deformer-handles.ts` exported `listRotationDeformerHandlePositions`.

Current evidence:

- `apps/editor/src/workspace/canvas/canvas-renderer.ts:12`-`15` imports `listRotationDeformerHandlePositions`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:353` calls `listRotationDeformerHandlePositions`.
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:39` exports `listRotationDeformerHandlePositions`.
- The Domain A missing-export type error no longer appears in `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`.

### Resolved: Scalar Rotation angle keyform test narrowing

Previous finding:

- `rotation-deformer-editing.test.ts` read `candidate.value` from a key union without narrowing.

Current evidence:

- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:543`-`557` reads angle keys through a narrowed scalar helper.
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:559`-`570` defines `isScalarAngleKey`, checking both `"value" in key` and numeric `statePatch`.
- The previous Domain A `TS2339` error no longer appears in Editor package typecheck output.

## Policy Compliance Table

| Area | Status | Evidence / notes |
|---|---|---|
| Architecture / module boundaries | `pass` | Operation payloads, authoring mutation validation, canvas projection/evaluation, handle math, gesture commit, hook wiring, renderer state, and inspector payload creation remain responsibility-scoped. |
| Source organization | `pass` | New files are scoped to handle math, gesture creation, interaction hook, and tests. `node scripts/check-source-organization.mjs` passed. |
| `index.ts` barrel-only rule | `pass` | No Domain A implementation logic was placed in an `index.ts`; observed dirty `packages/authoring-core/src/index.ts` remains re-export-only. |
| Operation mutation boundary | `pass` | Rotation `pivot` / `restAngleDegrees` edits travel through `UpdateRigControlPayloadSchema`, Operation Core, and Authoring Core validation/mutation. |
| Validation / wrong-kind rejection | `pass` | Authoring Core rejects non-finite rotation fields and wrong-kind updates; Operation Core maps diagnostics to `operation.updateRigControl.*` IDs. |
| Deterministic behavior | `pass` | Rotation handle projection/hit-test helpers are pure and covered; canvas preview/evaluation passes explicit `rotationPreview`. |
| GUI preview vs committed package state | `pass` | Canvas drag preview stays in hook state/projection preview until `finishPointerDrag` commits through the gesture controller. |
| Single undoable gesture path | `pass` | Gesture commit controller uses `commitOnce`; hook-level tests now cover preview, pointer-up commit, pointer-cancel no commit, and single history entry. |
| Keyform-aware angle editing | `pass` | Exact editable keyforms update via `commitEditKeyformKey`; between-key / missing-current-keyform state stays locked rather than silently creating ambiguous keyform state. |
| Parented / nested unsupported state | `pass` | Parented Rotation canvas editing is explicitly locked with `parentedUnsupported`; hook tests cover disabled renderer state and no commit/history entry. |
| Renderer scope | `pass` | Renderer changes are limited to drawing Rotation handles and using interaction state; no renderer architecture rewrite observed. |
| Dependency policy | `pass` | No dependency manifest/lockfile changes were found for Domain A; dependency guard passed. |
| Schema / ID conventions | `pass` | New operation diagnostic IDs use dot-separated lower camelCase and existing ID schemas are reused. |
| Warp / mesh preservation | `pass` | Domain A did not change mesh generation algorithms; focused regression tests around existing rig behavior passed. |
| Forbidden scope | `pass` | No Project Storage, portable save/load UI, browser-local slot, archive/filesystem/File System Access API, Viewer/Runtime View, or mesh-generation scope was implemented by Domain A. |

## Forbidden-Scope Evidence

- No new dependencies or package manifest / lockfile changes were found in Domain A.
- `node scripts/check-dependencies.mjs` passed.
- Domain A did not implement Project Storage, portable bundle Open/Save, browser-local save slots, ZIP/archive/native filesystem/File System Access API, directory picker, drag-drop import/export, Viewer, Runtime View, or mesh generation changes.
- Parallel Domain B dirty/untracked files remain present and are not claimed as Domain A.
- `git diff --check` over Domain A files and the updated Domain A report passed, with CRLF conversion warnings only.

## Verification Run

- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: failed, but no Domain A changed files were reported after fix loop 1.
  - Remaining non-Domain-A/shared failures observed:
    - `src/features/editor-session/editor-session-context-history.test.ts`
    - `src/features/project-storage/model/editor-project-storage.test.ts`
    - `src/workspace/canvas/canvas-render-scene-adapter.ts`
    - `src/workspace/project-storage/project-storage-screen.test.ts`
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts`: passed, 6 files / 65 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check` over Domain A files and the updated Domain A report: passed, CRLF conversion warnings only.

## Residual Risks and Recommendations

- Editor package-wide typecheck still needs a shared/integration cleanup before final wave closure. It is not a Domain A blocker after fix loop 1 because the remaining errors are outside the Domain A changed source set.
- Full Playwright Rotation editing remains unproven. For Design / Development Compliance this is acceptable because the implementation has focused operation, authoring, projection, inspector, gesture, hook lifecycle, undo/redo, and parented-lock coverage. Test Adequacy / final integration should decide whether a browser path is required before closing the wave.
- The parented/nested direct canvas edit block is deterministic and tested. A more visible user-facing explanation could still improve UX, but the current state is not silently mutating incorrect coordinates.

## Fix Loop 2 Spot Re-review

Verdict remains `pass`.

Fix loop 2 added `EditorSessionProvider` testability props and a stateful provider/context selection preservation test. I do not see a Domain A design/development blocker in those changes:

- `EditorSessionProviderProps` adds optional `initialSession` and `initialSelection` only (`apps/editor/src/features/editor-session/editor-session-context.tsx:317`-`320`).
- The default product path still renders `<EditorSessionProvider>` without either prop (`apps/editor/src/app/editor-app.tsx:8`), so normal behavior keeps the empty session and `null` selection defaults.
- `initialSession` is cloned before becoming provider state (`apps/editor/src/features/editor-session/editor-session-context.tsx:330`-`338`), so tests do not share mutable caller-owned session state with provider internals.
- `initialSelection` is only the initial `useState` seed (`apps/editor/src/features/editor-session/editor-session-context.tsx:346`); it does not bypass normal selection commands after mount.
- The provider test now reads live `context.selection` across `selectRigControl`, `updateRigControl`, keyform edit, undo, and redo instead of asserting a local constant (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:159`-`250`).

Spot verification:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts`: passed, 7 files / 74 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: still fails, but no failures were attributable to `initialSession` / `initialSelection` or the new Rotation selection preservation path. Remaining failures are the existing branded mesh fixture cast, Project Storage fixture typing, and shared `canvas-render-scene-adapter.ts` tuple narrowing.
- `git diff --check` over fix loop 2 files and the updated report: passed, CRLF conversion warnings only.

Residual note: `EditorSessionProviderProps` is exported because the provider itself is exported, so these props are technically available to app code. Current usage search shows no production caller passing them, and they are narrow initial-state seeds rather than ongoing mutation hooks. If this provider becomes a public reusable API later, document these as test/bootstrap-only inputs or move fixture bootstrapping behind a test helper.
