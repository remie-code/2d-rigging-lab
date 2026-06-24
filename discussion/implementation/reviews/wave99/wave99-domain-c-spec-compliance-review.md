# Wave99 Domain C Spec Compliance Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-manager-editor-ui-canvas-preview`
Verdict: `pass`

## Scope

This review checked Wave99 Domain C only: the Editor Variant Manager route/UI,
session-local preview active selection, Add Drawables picker, membership/default
editors, and Canvas preview predicate integration.

I reviewed source and tests directly. I did not review Domain D final
integration as complete and did not modify implementation source.

## Findings

No blocking spec compliance findings.

## Compliance Checks

| Requirement | Result | Evidence |
|---|---|---|
| `activeEntry === "variants"` has an explicit route and opens `VariantManagerScreen`. | Pass | `apps/editor/src/workspace/authoring-workspace.tsx:42`, `apps/editor/src/workspace/authoring-workspace.tsx:58`; route test at `apps/editor/src/workspace/authoring-workspace.test.ts:34`. |
| Parameter Bar is hidden for the Variant Manager route. | Pass | `apps/editor/src/workspace/authoring-workspace.tsx:99`; route test asserts no Parameter Bar at `apps/editor/src/workspace/authoring-workspace.test.ts:34`. |
| Back returns to the neutral Authoring Workspace entry. | Pass | `apps/editor/src/workspace/variants/variant-manager-screen.tsx:198`; test at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:84`. |
| Existing workspace without variants opens an empty manager. | Pass | Empty manager branch at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:315`; test at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:76`. |
| Group create/rename/mode edit/delete is wired through operation-backed commands. | Pass | UI handlers at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:129`, `:152`, `:381`; command wrappers at `apps/editor/src/features/variants/model/variant-session-commands.ts:39`, `:49`, `:59`; tests at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:35`, `:53`, `:71`. |
| Variant create/rename/delete works and last single-select Variant delete is blocked. | Pass | UI handlers at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:176`, `:617`; command wrappers at `apps/editor/src/features/variants/model/variant-session-commands.ts:69`, `:79`, `:89`; test at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:91`. |
| Add Drawables picker uses a Parts Tree-like hierarchy with default collapsed containers and eligible/total counts. | Pass | Projection at `apps/editor/src/features/variants/model/variant-manager-projection.ts:153`; picker UI at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:729`; test at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:35`. |
| Picker eligibility covers eligible, not bound, already in other group, and already in this group. | Pass | Eligibility branches at `apps/editor/src/features/variants/model/variant-manager-projection.ts:482`; bound set derives from `rigControls[].childDrawableIds` at `apps/editor/src/features/variants/model/variant-manager-projection.ts:504`; test at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:52`. |
| Remove target drawable and membership matrix are present. | Pass | Add/remove/membership handlers at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:489`, `:532`; matrix component at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:833`; command wrappers at `apps/editor/src/features/variants/model/variant-session-commands.ts:99`, `:109`, `:119`; membership test at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:125`. |
| Same drawable can belong to multiple Variants in the same group, while cross-group ownership is blocked by picker/operation baseline. | Pass | Membership command test at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:125`; picker disables other-group targets at `apps/editor/src/features/variants/model/variant-manager-projection.ts:482`; projection test at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:52`. |
| Default active editor persists to project graph state. | Pass | UI wiring at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:450`; command wrapper at `apps/editor/src/features/variants/model/variant-session-commands.ts:129`; test at `apps/editor/src/features/variants/model/variant-session-commands.test.ts:125`. |
| Preview active selection is session-local and not persisted/dirtying. | Pass | Provider state is React state at `apps/editor/src/features/editor-session/editor-session-context.tsx:632`; setter only updates preview state at `apps/editor/src/features/editor-session/editor-session-context.tsx:1591`; preview reconciliation at `apps/editor/src/features/variants/model/variant-preview-state.ts:9`; canvas test asserts no session mutation/dirtying at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:31`. |
| Canvas preview composes Variant predicate with existing visibility instead of replacing it. | Pass | Optional predicate path at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:242`; AND composition at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:320`; projection pass-through at `apps/editor/src/workspace/canvas/canvas-projection.ts:198`; CanvasPreviewPanel creates Domain B predicate at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:148`. |
| Default active fallback is used when no preview active selection is supplied. | Pass | Domain B predicate call from CanvasPreviewPanel at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:148`; focused test at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:58`. |
| Check strip covers no groups, invalid references, and duplicate ownership. | Pass | Checks at `apps/editor/src/features/variants/model/variant-manager-projection.ts:338`; strip UI at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:926`; projection test at `apps/editor/src/features/variants/model/variant-manager-projection.test.ts:84`. |
| Compatibility boundaries were respected. | Pass | Domain C changed only `apps/editor/src/**` plus reports/maps; no `apps/runtime-player/src`, runtime/render package, dependency manifest/lockfile, or Texture Atlas target/signature/packing/mutation diffs were found in the review checks. |

## Out-of-Scope Checks

- No Runtime Player Variant UI, hotkeys, or Browser Source protocol changes were
  found.
- No Runtime Export schema/materialization changes were made by Domain C beyond
  consuming the Domain B predicate/export baseline.
- No Texture Atlas algorithm/signature changes were found in Domain C scope.
- No Workspace Save format changes were found in Domain C scope.
- No Capture From Current State or smart grouping implementation was found.
- No permanent Authoring Workspace Variant switcher was added.

## Basis Documents Used

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/toolbox.md`
- Domain A report and spec/design/test review baseline under
  `discussion/implementation/waves/wave99/` and
  `discussion/implementation/reviews/wave99/`
- Domain B report and spec/design/test review baseline under
  `discussion/implementation/waves/wave99/` and
  `discussion/implementation/reviews/wave99/`
- Gnome Domain C report:
  `discussion/implementation/waves/wave99/wave99-domain-c-variant-manager-editor-ui-canvas-preview-report.md`

## Source And Tests Reviewed

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/variants/model/variant-manager-projection.ts`
- `apps/editor/src/features/variants/model/variant-preview-state.ts`
- `apps/editor/src/features/variants/model/variant-session-commands.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/variants/variant-manager-screen.tsx`
- `apps/editor/src/features/variants/model/variant-manager-projection.test.ts`
- `apps/editor/src/features/variants/model/variant-session-commands.test.ts`
- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `apps/editor/src/workspace/authoring-workspace.test.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
- Existing canvas regression tests:
  `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`,
  `apps/editor/src/workspace/canvas/canvas-projection.test.ts`

## Commands Run

Passed:

```text
pnpm.cmd typecheck
```

```text
pnpm.cmd exec vitest run apps/editor/src/features/variants/model/variant-session-commands.test.ts apps/editor/src/features/variants/model/variant-manager-projection.test.ts apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/variants/variant-manager-screen.test.ts
```

Result: initial sandboxed run failed with `spawn EPERM` while Vitest/Vite
loaded esbuild; elevated rerun passed, 6 files / 19 tests.

```text
pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts
```

Result: elevated run passed, 2 files / 36 tests.

```text
node scripts/check-source-organization.mjs
node scripts/check-dependencies.mjs
git diff --check -- apps/editor/src discussion/implementation/waves/wave99
```

Result: passed. `git diff --check` emitted only LF-to-CRLF working-copy
warnings.

Additional read-only checks:

```text
git diff --name-only -- apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src package.json pnpm-lock.yaml
git diff --name-only -- packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts packages/authoring-core/src/texture-atlas-packing.ts packages/authoring-core/src/texture-atlas-mutations.ts
rg checks for StructureTreePanel reuse, Runtime Player/hotkey/protocol, Capture From Current State, and smart grouping terms in Domain C files
```

Result: no Domain C forbidden-scope implementation found.

Not run:

- Full repository test suite.
- `pnpm install`, per task instruction.

## Residual Risks

- `CanvasPreviewPanel` consumes provider-scoped preview active selections, so a
  preview state chosen in the Manager can continue to affect any Authoring
  Workspace CanvasPreviewPanel until reset/load/reconciliation. This is
  session-local and no permanent workspace switcher was added, so I do not
  classify it as a spec blocker, but Domain D may want to confirm whether
  "Back to neutral workspace" should also reset preview to defaults.
- UI coverage is mostly SSR/component, projection, command, and canvas
  projection tests. There is no browser E2E for interactive picker/matrix
  workflows in this Domain C lane.
- Batch add is implemented as repeated single-drawable operation commits,
  matching the available Domain A operations but producing multiple history
  entries.

## Verdict

`pass`
