# Wave99 Domain C Design / Development Compliance Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-manager-editor-ui-canvas-preview`
Verdict: `pass`

Report path: `discussion/implementation/reviews/wave99/wave99-domain-c-design-development-review.md`

## Scope

This review checked Wave99 Domain C only: Editor Variant Manager UI, session-local preview active selection, and Canvas preview predicate integration. Domain A/B source changes were treated as accepted baseline and were not re-reviewed as Domain C implementation.

I reviewed source and tests directly, not only the Gnome report. No implementation source files were modified by this review.

## Findings

No blocking findings.

## Compliance Checks

| Check | Result | Evidence |
|---|---|---|
| Domain C stayed in allowed Editor scope | Pass | Domain C changed `apps/editor/src/**` plus report/map artifacts. `git diff --name-only` for `package.json`, `pnpm-lock.yaml`, Runtime Player, runtime/render packages, and Texture Atlas target/signature/packing/mutation files returned no files. Current worktree also contains Domain A/B baseline diffs, but those are not Domain C edits. |
| Explicit `variants` route and dedicated Manager screen | Pass | `apps/editor/src/workspace/authoring-workspace.tsx:42` derives `showVariants`; `:50` includes it in dedicated route rendering; `:58` to `:59` renders `VariantManagerScreen`. Route test asserts `data-testid="variant-manager-screen"` at `apps/editor/src/workspace/authoring-workspace.test.ts:47`. |
| Parameter Bar hidden for Variant Manager | Pass | `apps/editor/src/workspace/authoring-workspace.tsx:99` to `:101` suppresses `ParameterBar` when `showVariants` is true. Test assertion is at `apps/editor/src/workspace/authoring-workspace.test.ts:54`. |
| Back returns to neutral workspace | Pass | `VariantManagerScreen` uses `setActiveEntry("workspace")` at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:198`; test verifies this at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:84` to `:95`. |
| GUI mutations route through Operation Core / history path | Pass | Variant command wrappers clone the session, parse an Operation Core request, set `actor: "human"`, `surface: "gui"`, `dryRun: false`, and call `commitOperation` at `apps/editor/src/features/variants/model/variant-session-commands.ts:143` to `:154`. `EditorSessionProvider` exposes these through `runCommandWithHistory`, e.g. `createVariantGroup` at `apps/editor/src/features/editor-session/editor-session-context.tsx:1498` and related methods through `:1588`. |
| Preview active selection is session-local and non-mutating | Pass | Preview state is React provider state at `apps/editor/src/features/editor-session/editor-session-context.tsx:632`; it is reconciled from graph/defaults at `:715` and updated by `setVariantPreviewActiveSelection` via `setVariantPreviewActiveSelectionsState` at `:1591` to `:1605`. It is not added to package-format, authoring-core persistence, or operation-core. Canvas test asserts no dirty/session mutation at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:31` to `:55`. |
| Default active selection remains project mutation | Pass | Manager default-active editor calls `setVariantDefaultActiveSelection` with the selected group id at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:450` to `:456`. Session command tests verify default active is saved into graph state at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:125`. |
| Canvas integration is narrow and optional | Pass | `CanvasEvaluationOptions` adds optional `variantVisibilityPredicate` at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:128`; default is `() => true` at `:242`; final visibility remains `runtimeVisibility && !hiddenByPart && variantVisibilityPredicate(drawableId)` at `:320` to `:323`. Projection passes the option only when supplied at `apps/editor/src/workspace/canvas/canvas-projection.ts:198` to `:200`. |
| Canvas uses Domain B shared predicate | Pass | `CanvasPreviewPanel` imports `createVariantVisibilityPredicate` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:1`, builds it from `session.graph.variantGroups` and `variantPreviewActiveSelections` at `:148` to `:154`, and passes it into projection at `:163` to `:170`. |
| Dedicated picker projection avoids `StructureTreePanel` reuse | Pass | Variant picker uses a dedicated projection in `apps/editor/src/features/variants/model/variant-manager-projection.ts:153`; `rg StructureTreePanel apps/editor/src/workspace/variants apps/editor/src/features/variants` found no matches. It uses only `getPartOrderedChildren` and collapsed-state helper (`:8`, `:166`). |
| Picker eligibility follows design boundaries | Pass | Bound drawables are derived from rig control `childDrawableIds` at `apps/editor/src/features/variants/model/variant-manager-projection.ts:504` to `:506`. Eligibility blocks same-group already-added, other-group ownership, and unbound drawables at `:482` to `:499`. Projection tests cover collapsed hierarchy/counts and eligibility states at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:35` to `:80`. |
| Manager UI covers mutation surfaces without direct graph edits | Pass | Create/update/delete group, variant operations, add targets, membership updates, and default/preview selection calls all go through `useEditorSession` methods in `apps/editor/src/workspace/variants/variant-manager-screen.tsx:54` to `:69`, `:138`, `:369`, `:418`, `:450`, `:459`, `:491`, `:532` to `:548`. |
| Validation/check strip exists for loaded bad data | Pass | Projection emits no-group, missing drawable, duplicate owner, missing membership, and default-active diagnostics at `apps/editor/src/features/variants/model/variant-manager-projection.ts:346` to `:428`. Tests cover these checks at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:84`. |
| Runtime Player, Runtime Export, Texture Atlas, dependencies unaffected | Pass | No Domain C diffs in Runtime Player, runtime/render packages, package manifests, lockfile, Runtime Export materialization/schema, or Texture Atlas target/signature/packing/mutation files. Dependency guard passed. |
| Source organization policy | Pass | New files are responsibility-specific: operation wrappers, preview state, picker/manager projection, screen, and focused tests. No `index.ts` or broad catch-all files were added. `node scripts/check-source-organization.mjs` passed. |

## Basis Documents Used

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- Domain A report/reviews listed for Wave99 baseline
- Domain B report/reviews listed for Wave99 baseline
- `discussion/implementation/waves/wave99/wave99-domain-c-variant-manager-editor-ui-canvas-preview-report.md`

## Source And Tests Reviewed

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/variants/model/variant-session-commands.ts`
- `apps/editor/src/features/variants/model/variant-preview-state.ts`
- `apps/editor/src/features/variants/model/variant-manager-projection.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/variants/variant-manager-screen.tsx`
- `apps/editor/src/features/variants/model/variant-session-commands.test.ts`
- `apps/editor/src/features/variants/model/variant-manager-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `apps/editor/src/workspace/authoring-workspace.test.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
- Existing Canvas regression tests: `canvas-evaluation.test.ts`, `canvas-projection.test.ts`

## Commands Run

Passed:

```text
pnpm.cmd typecheck
```

```text
pnpm.cmd exec vitest run apps/editor/src/features/variants/model/variant-session-commands.test.ts apps/editor/src/features/variants/model/variant-manager-projection.test.ts apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/variants/variant-manager-screen.test.ts
```

Result: 6 files / 19 tests passed. Run was escalated for Vitest/esbuild process spawning.

```text
pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts
```

Result: 2 files / 36 tests passed. Run was escalated for Vitest/esbuild process spawning.

```text
node scripts/check-source-organization.mjs
node scripts/check-dependencies.mjs
git diff --check -- apps/editor/src discussion/implementation/waves/wave99
```

Result: passed. `git diff --check` emitted LF-to-CRLF working-copy warnings only.

Additional read-only checks:

- `git status --short -uall`
- `git diff --name-only` for forbidden runtime/player/render/dependency/Texture Atlas scopes
- `rg` checks for `StructureTreePanel`, DnD-specific imports, Runtime Player hotkeys, and Capture From Current State in Domain C Variant UI files

Not run:

- Full repository test suite.
- `pnpm install`, per dependency/no-install scope.

## Residual Risks

- UI coverage is SSR/pure projection focused; no browser E2E or visual screenshot verification was run for the new Manager layout.
- Preview active selection is provider-wide session state. After using the Manager, any `CanvasPreviewPanel` reads it until reset/load/transient reset. This remains non-persistent and non-dirty, but future UX may need an explicit normal-workspace indicator or reset-on-exit decision.
- `Add selected` commits one Operation Core mutation per drawable because Domain A exposes single-drawable operations, so history granularity is per drawable rather than one batch action.

## Decision Needed

No user design decision is needed for this review. Verdict: `pass`.
