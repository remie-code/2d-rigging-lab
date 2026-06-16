# Wave75 Domain A Design / Development Compliance Review

## Verdict

pass

## Basis Reviewed

- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/waves/wave74/wave74-final-integration-report.md`
- `discussion/implementation/reviews/wave74/wave74-final-clean-integration-review.md`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`
- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- Current diffs for Wave75 Domain A source/tests, package/dependency diffs, and `git diff --name-status HEAD`.

## Findings

No blocking findings.

No needs-change findings.

### Resolved Prior Finding: Wave75 Domain A app type errors

The previous review blocked on app-level TypeScript errors in Wave75-changed files. Fix Loop 1 resolves those errors:

- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:37` now declares `materializeKeyform` on `RotationTranslationEditMode`, not `RotationAngleEditMode`.
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:520` consumes that translation-mode variant, and `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:733` returns the now-declared mode.
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:114` narrows the angle keyform set before reading `keys[*].value`.
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:10` imports `ParameterId`; the helper references at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:818` and `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:874` are now typed.
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:154` and `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:186` add the read-model `keyformSetCount` / `keyformKeyCount` fields.

`pnpm.cmd --dir apps/editor run typecheck` still fails, but the remaining errors are outside the Wave75 Domain A changed files: `editor-session-context-history.test.ts`, `editor-project-storage.test.ts`, `canvas-render-scene-adapter.ts`, and `project-storage-screen.test.ts`. I treat those as pre-existing or other-lane app typecheck debt, not as blocking findings for this Design / Development Compliance lane.

## Compliance Summary

- Module boundary: compliant. Rotation translation keyform materialization remains in editor authoring/model/gesture paths, not runtime interpolation or package format.
- Operation boundary: compliant. Materialized translation keyforms are committed through sequential `commitEditKeyformKey` operation calls at `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:241`, and value edits route through existing `editKeyformKey` paths. I found no hidden direct package/runtime mutation.
- Deterministic behavior: compliant. `createMaterializedEditKeyformPayloads` sorts/deduplicates source keys, requires exact current key context, and uses fallback translation for non-current materialized keys. The interaction path sources key positions from the same Rotation angle keyform set for the active parameter.
- UI responsibility split: compliant. Per-card keyform Add/Update/Delete controls are removed from Parameter Binding cards; Canvas handles and Parameter Bar are the authoring routes. Parameter Binding remains a value/inspection/edit surface.
- Rig Tool / Parameter Keyform / Canvas Preview design: compliant for this wave. Rotation basic Inspector keeps operation-worthy Name/Parent fields, setup transform is compact, duplicate opacity/basic summary rows are removed, and Canvas proof stays on overlay/interaction data rather than raw runtime payloads.
- Source organization: compliant. No new broad catch-all files or entrypoint implementation were introduced; guard passed.
- Dependency policy: compliant. No manifest or lockfile diff was found; dependency guard passed.
- Forbidden scope: compliant. Reviewed diffs do not introduce mesh generation, runtime interpolation rewrite, renderer architecture, package format/schema, Viewer/Runtime View, browser-local save/archive/filesystem, Cubism, external transport, or LLM/provider work. `packages/**` changes remain test evidence from Wave74, not Wave75 Domain A production changes.

## Verification Commands Run

- `git diff --name-status HEAD`: reviewed current dirty worktree scope.
- `git diff -- apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`: confirmed Fix Loop 1 source/test changes.
- `pnpm.cmd --dir apps/editor run typecheck`: failed, but only outside Wave75 Domain A changed files as noted above.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`: passed, 5 files / 29 tests. Rerun was escalated because this Vitest path repeatedly hits sandbox `esbuild spawn EPERM`.
- `pnpm.cmd typecheck`: passed for the root/package TypeScript scope.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0 with CRLF normalization warnings only.
- `git diff -- package.json pnpm-lock.yaml apps/editor/package.json packages/authoring-core/package.json packages/runtime-core/package.json packages/operation-core/package.json packages/package-format`: no output.
- Forbidden-scope filename scan over `git diff --name-only HEAD -- packages apps`: no matches; `rg` exited 1 after CRLF warnings from `git diff`.

I did not independently rerun Playwright e2e in this fix-loop review. The Gnome report records the browser workflow passes, and this lane focused on source/design/development compliance and the prior typecheck blocker.

## Residual Risks

- Full `apps/editor` package typecheck still has unrelated app errors outside Wave75 Domain A. They should be handled by the owning lane or a separate app typecheck cleanup, but they are not introduced by the reviewed Fix Loop 1 files.
- Root `pnpm typecheck` remains a weak signal for editor UI work because root `tsconfig.json` excludes `apps/editor/src`.
- Parameter Binding value editors commit immediately when an exact current key exists. This is consistent with removing per-card Update buttons, but it may create denser history entries during slider/numeric edits. Slider performance/history optimization remains out of Wave75 scope.
- The Playwright handle workflow depends on overlay geometry and hover probing. It is acceptable for this wave but may need maintenance if Rotation handle geometry changes.

## User-Decision Points

None.
