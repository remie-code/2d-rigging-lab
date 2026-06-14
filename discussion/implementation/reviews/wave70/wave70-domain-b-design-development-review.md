# Wave70 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Review lane: Design / Development Compliance Review
- Target: `wave70-editor-v6d-mainline-selector-removal`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed the requested Domain B implementation directly from source and diff, not only from the Gnome report.

Basis documents used:

- `discussion/implementation/orchestration/wave70-plan.md` sections 1-9, 11, 13-16
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Changed files inspected:

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md`
- `discussion/implementation/waves/wave70/_map.md`

## Findings

No blocking findings.

No warning findings.

## Compliance Notes

### Architecture / Module Boundary

Pass. Domain B source changes are confined to the expected Editor state, command, context, inspector, and e2e files. The Domain B source diff stat covers only seven Editor files. The report and map are documentation artifacts. A targeted manifest/renderer check showed no diff under `packages/render-webgl2`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `apps/editor/package.json`.

Domain A package changes are present in the worktree and were treated as the dependency for the new method/source IDs, not as Domain B scope.

### Operation Boundary

Pass. Preview remains non-committal Editor draft state: `previewMeshDraft` calls `createGeneratedMeshForDrawable` with `DEFAULT_MESH_GENERATION_METHOD` and stores the result in `meshDraft` only (`apps/editor/src/features/editor-session/editor-session-context.tsx:655`, `apps/editor/src/features/editor-session/editor-session-context.tsx:672`). Apply remains routed through the command wrapper: `applyMeshDraft` calls `commitGenerateMesh` with the preview mesh, previewed method, and preview provenance (`apps/editor/src/features/editor-session/editor-session-context.tsx:693`). `commitGenerateMesh` delegates to `commitSingleOperation` with `operationType: "generateMesh"` (`apps/editor/src/features/editor-session/model/editor-session-commands.ts:283`).

The command tests assert default support-ring provenance and preview-geometry commit preservation, including transform-history markers for method/source/backend (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:625`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:717`).

### UX Compliance

Pass. The visible product control remains presets: the preset definitions are still `largeMotion`, `standard`, and `lowMotion` (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:40`), and the inspector renders only those preset buttons for generation choice (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:259`).

The previous backend selector abstraction is removed from normal state exports and tests assert it is absent (`apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:39`). The inspector no longer renders `mesh-tool-backend-selector`; the e2e assertion checks the visible selector count is zero, no `Experimental backend` text is present, and no visible backend/v6D/v6E/v6F buttons are available (`apps/editor/e2e/psd-import.e2e.spec.ts:261`).

The remaining UI summary presents quality/result information instead of an algorithm-choice control: `Generation result`, contour counts, fallback steps, support rings, and support band rows are summaries only (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:188`). This does not replace the removed selector with another selector.

### Source Organization

Pass. No `index.ts` or broad catch-all files were created or expanded. The changes remove selector-specific state rather than adding a new abstraction. The reported `node scripts/check-source-organization.mjs` result is pass.

### ID / Schema Safety

Pass. The Editor default is the required machine-readable method ID `auto-outline-v6d-contour-band-support-rings` (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:62`). Domain A contract integration defines the matching method, source, and backend IDs (`packages/authoring-core/src/mesh-generation-contract.ts:12`, `packages/authoring-core/src/mesh-generation-contract.ts:22`, `packages/authoring-core/src/mesh-generation-contract.ts:32`, `packages/authoring-core/src/mesh-generation-contract.ts:100`).

The default preview provenance helper keeps IDs machine-readable and strips the method suffix only for the current default; legacy explicit methods still get method-bearing suffixes (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70`, `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:179`). No new machine-readable IDs with spaces were found in the reviewed integration paths.

### Historical Display Safety

Pass. Old v6A/v6B/v6C/v6D/v6E/v6F source IDs are mapped to generic `Legacy contour mesh` copy (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:496`). Old v6D/v6E/v6F fallback methods and backend IDs are also genericized rather than shown as normal user choices (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:540`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:633`).

The command test keeps explicit legacy v6D/v6E/v6F preview provenance paths covered while adding the improved v6D support-ring case (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`).

### Forbidden Scope

Pass. No renderer changes, dependency additions, old method deletion, semantic auto-selection, side-by-side comparison UX, or replacement backend selector were found in the Domain B source diff. V2.6 remains visible only as historical formatting/fallback display support, not as the Editor default or a normal selector option (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:507`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:553`).

## Validation Reviewed

Reviewed validation reported by Orch-Sylph / Gnome:

- Focused Vitest: sandbox esbuild `spawn EPERM`; outside-sandbox pass, 2 files / 17 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- Focused PSD import e2e: sandbox Playwright `spawn EPERM`; outside-sandbox pass, 9 tests.
- `git diff --check -- <Domain B files + report/map>`: pass with CRLF working-copy warnings only.

Reviewer rerun:

- `git diff --check -- apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/workspace/panels/mesh-tool-inspector.tsx apps/editor/e2e/psd-import.e2e.spec.ts discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md discussion/implementation/waves/wave70/_map.md`: pass with CRLF working-copy warnings only.

No full test suite was rerun by this reviewer.

## Residual Risks

- Visual quality and support-ring tuning on broader artwork remain outside this design/development compliance lane and should be handled by Domain C / human visual review.
- Unknown future backend/source IDs would currently fall through to raw ID text in some formatter defaults. The required historical v6D/v6E/v6F paths are covered and generic, so this is not blocking for Domain B.

## User-Decision Points

None.
