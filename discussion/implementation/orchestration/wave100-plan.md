# Wave 100 Plan: Viewer Variant Switching v0

> Wave100は、Wave99でEditor側に追加したVariant / Expression Managerの結果をViewer / Runtime Viewへ反映する。目的は、Viewer初期表示でProjectのdefault active selectionを使い、Runtime Controls上でsession-onlyにVariantを切り替えられ、`Original` / `Atlas Runtime` の両方で同じ完成品確認体験を得られるようにすることである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave100
- Wave name: `viewer-variant-switching-v0`
- Primary objective:
  - Viewer / Runtime ViewでVariant Groupごとのactive selectionを切り替えられるようにする。
  - Viewer初期表示ではProjectのdefault active selectionを反映し、すべてのVariant対象Drawableが同時表示される状態を解消する。
  - ViewerのVariant切り替えはsession-only preview stateとして扱い、Workspace / Portable JSON / Project default active selectionを変更しない。
  - Runtime Controls内に折りたたみ可能なVariants sectionを追加し、render source modeの下、parameter searchの上に配置する。
  - 折りたたみ時も現在のactive Variant summaryを見せ、parameter操作時の縦方向の視認性を守る。
  - `Original` と `Atlas Runtime` の両方で同じactive Variant selectionを使う。
  - Runtime Player側のVariant UI / hotkey / Browser Source protocol変更は対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- Viewer Variant UXは [../../design/screen-design/screens/viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md) と [../../design/screen-design/screens/variant-expression-manager.md](../../design/screen-design/screens/variant-expression-manager.md) に記録済み。
- Read-only SylphがViewer描画経路、Runtime Controls state、Wave99 Variant state、Canvas predicate、Runtime Export default behavior、既存テスト候補を調査済み。
- Sylph調査の結論は `ready_to_plan`。
- ユーザーは次の方針を採用済み:
  - ViewerにはVariant切り替えUIを置く。
  - Runtime Controls内に置き、Clean Stage上には置かない。
  - Variants sectionは折りたたみ可能にする。
  - Viewerでの切り替えはsession-onlyにする。
  - Projectのdefault active selectionはViewer操作で変更しない。
  - `Original` / `Atlas Runtime` の両方にVariant selectionを反映する。

Uncertainty:

- factual: low. Viewerの挿入点は調査済み。
- decision: low. 残るUX判断は初期collapsed state程度で、計画では折りたたみ初期を採用する。
- cost of wrong plan: medium. Viewerの完成品確認体験に直結するが、package formatやRuntime Playerへは広げないため、blast radiusは限定できる。

## 3. Accepted Decisions / Oracles

### 3.1 Viewer Variant Semantics

ViewerでのVariantは、完成品確認用の追加predicateである。

Conceptual rule:

```text
viewerVisible =
  existingViewerVisibilityPredicates
  AND variantVisibilityPredicate
```

Required:

- ProjectにVariant Groupが存在しない場合、Viewer表示は従来通り。
- ProjectにVariant Groupが存在する場合、Viewer初期表示はProjectのdefault active selectionを使う。
- Variant Groupに所属していないDrawableはvariant-neutralとして、Variant条件では通過する。
- Variant Groupに所属するDrawableは、Viewer-local active selectionに応じて表示/非表示が決まる。
- Variant falseは、parameter / keyform / opacity / dynamicsが表示を要求しても描画されない。
- Variant trueは、Parts visibility、Drawable visibility、keyform opacity、clipping、mesh / deformer評価を上書きしない。

Forbidden:

- Viewer操作でProjectのdefault active selectionを変更する。
- Viewer-local selectionをWorkspace Save / Portable JSONに保存する。
- Variantを `runtimeVisibility` へ直接書き込む。
- Variant Managerの編集UIをViewerへ流用する。
- Runtime Player UI / hotkey / protocol変更を含める。

### 3.2 Runtime Controls UX

Required:

- Runtime Controls内にVariants sectionを追加する。
- 配置順は次にする。

```text
Runtime Controls
  Render Source
  Variants
  Parameter Search
  Parameter Sliders
  Motion / Physics
```

- Variant Groupがない場合、Variants sectionは表示しない。
- Variants sectionは初期collapsedにする。
- collapsed時もactive Variant summaryを表示する。
- expanded時はGroupごとの操作を出す。
- `singleSelect` Groupは1つだけ選ぶUIにする。
- `multiToggle` GroupはON/OFFできるUIにする。
- `Reset variants` はViewer-local selectionをProject default active selectionへ戻す。
- Runtime Controlsのparameter resetとVariant resetを混同しない。

Accepted:

- sectionのcollapsed stateはsession-local UI stateでよい。
- Variant Group / Variant数が多い場合、compact rowsやpopoverへ逃がしてよい。
- Runtime Controlsのoverride countは既存parameter override countのままでよい。Variant変更をそこへ混ぜる必要はない。

### 3.3 Render Source Interaction

Required:

- `Original` と `Atlas Runtime` は同じViewer-local active Variant selectionを使う。
- `Atlas Runtime` がmissing/staleでdisabledまたはfallbackしても、Viewer-local active Variant selectionは維持する。
- `Atlas Runtime` は、Variant predicate適用済みのoriginal projectionからremapされる。

Forbidden:

- Atlas source cacheにVariant selectionを混ぜて、不要なcache invalidationを起こす。
- Variant切り替えでTexture Atlas artifactをstaleにする。
- `Atlas Runtime` 専用の別Variant stateを作る。

## 4. Primary Basis

Design basis:

- [../../design/screen-design/screens/viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md)
- [../../design/screen-design/screens/variant-expression-manager.md](../../design/screen-design/screens/variant-expression-manager.md)
- [../../design/screen-design/_map.md](../../design/screen-design/_map.md)

Implementation baseline:

- [wave99-plan.md](wave99-plan.md)
- [../waves/wave99/wave99-final-integration-report.md](../waves/wave99/wave99-final-integration-report.md)
- [../reviews/wave99/wave99-final-clean-integration-review.md](../reviews/wave99/wave99-final-clean-integration-review.md)
- Wave99 follow-up fix for Variant Manager event currentTarget snapshot bug, verified by focused Variant Manager tests and typecheck.

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts from planning inventory:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`: owns local `runtimeControlsState`, `renderSourceMode`, runtime playback frame/reset state, and atlas source cache.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`: `createViewerRuntimeCleanStageProjection` builds parameter values, evaluates dynamics, then calls `createCanvasRenderProjection(session, null, { parameterValues, editorHiddenPartIds })`.
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`: receives original `CanvasRenderProjection`; `original` returns unchanged; `atlasRuntime` remaps from original projection.
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`: Runtime Controls UI host.
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`: currently contains parameter overrides/search, not Variant state.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`: computes `visible = runtimeVisibility && !hiddenByPart && variantVisibilityPredicate(drawableId)` when predicate is provided.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`: Canvas already creates `createVariantVisibilityPredicate` from session preview active selections.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`: Wave99 has provider-wide Manager preview state; Viewer should not use it directly.
- `apps/editor/src/features/variants/model/variant-preview-state.ts`: active selection reconciliation/default helper candidates.
- `packages/authoring-core/src/variant-evaluation.ts`: pure predicate helper.
- `packages/package-format/src/model-variants.ts`: Variant group/mode/default data shape.
- `packages/authoring-core/src/runtime-export-materialization.ts`: Runtime Export uses default active selection, not preview state.

## 5. Wave Strategy

Wave100 should run as a narrow single implementation domain plus final integration.

```text
Batch 1:
  Domain A: Viewer Variant Switching Integration

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Viewer-local state, projection predicate insertion, Runtime Controls UI, and focused tests are one coherent change. Splitting them would increase review overhead without meaningful parallelism.
- Package format, Workspace Save, Runtime Export metadata, and Canvas preview were already delivered in Wave99 and should not be reopened.
- Runtime Player Variant switching is a later scope and must remain out of this wave.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Viewer Variant Switching Integration | Wave99 final pass and accepted Viewer Variant design | Single implementation domain | Add Viewer-local Variant selection, projection predicate insertion, collapsible Runtime Controls section, focused tests |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate Viewer Variant behavior, source organization, no out-of-scope Runtime Player/package changes, reports/reviews/maps |

## 6. Domain A: Viewer Variant Switching Integration

Domain id: `wave100-viewer-variant-switching-integration`

Purpose:

- Make Viewer / Runtime View respect Variant default active selection and provide session-only Variant switching in Runtime Controls.

Allowed write scope:

- `apps/editor/src/workspace/viewer/**`
- `apps/editor/src/features/variants/model/**` only for narrow reusable helper extraction that does not alter Project semantics.
- focused tests under `apps/editor/src/workspace/viewer/**`
- focused tests under `apps/editor/src/features/variants/model/**` if helper extraction occurs.
- Domain A report/review files under `discussion/implementation/waves/wave100/` and `discussion/implementation/reviews/wave100/`

Forbidden write scope:

- `packages/package-format/src/**`
- `packages/authoring-core/src/**`, except importing existing APIs.
- `packages/operation-core/src/**`
- `apps/runtime-player/src/**`
- `packages/runtime-core/src/**`
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- Texture Atlas algorithm or artifact format files.
- Runtime Export materialization files.
- Workspace Save / Portable JSON files.
- package dependencies / lockfile.

Required implementation:

- Add Viewer-local active Variant selection state in `ViewerRuntimeScreen`.
- Initialize Viewer-local selection from Project default active selection.
- Reconcile Viewer-local selection when `session.graph.variantGroups` changes.
- Reset Viewer-local selection to Project default active selection when the user triggers `Reset variants`.
- Keep Viewer-local selection non-persistent and non-dirty.
- Create Viewer Variant predicate using `createVariantVisibilityPredicate`.
- Pass the predicate into Viewer clean-stage projection before render source remap.
- Ensure the same predicate affects `Original` and `Atlas Runtime`.
- Keep atlas source/cache behavior independent of Variant selection.
- Add `RuntimeControls` props/state for:
  - variant groups.
  - viewer-local active selections.
  - set active selection callback.
  - reset variants callback.
  - collapsed/expanded section UI state.
- Add collapsible `Variants` section:
  - hidden when no Variant Groups exist.
  - placed below render source mode and above parameter search.
  - initial collapsed.
  - collapsed summary remains visible.
  - expanded controls support `singleSelect` and `multiToggle`.
  - reset button returns to defaults.
- Avoid importing `VariantManagerScreen` into Viewer.
- Extract or reuse small formatting helpers where useful, but do not create a broad shared UI abstraction.

Out of scope:

- Runtime Player Variant switching UI.
- Runtime Player hotkeys.
- Browser Source protocol changes.
- Project default active selection editing.
- Variant Manager membership/default editing.
- Workspace Save / Portable JSON changes.
- Runtime Export changes.
- Texture Atlas stale policy changes.
- Authoring Workspace permanent Variant switcher.
- Canvas preview changes except tests needed to ensure no regression.
- E2E/browser visual screenshot proof unless the implementation agent finds a cheap existing pattern.

Required tests:

- Viewer with no Variant Groups renders no Variants section and preserves existing behavior.
- Viewer initial projection applies Project default active selection.
- Inactive assigned Drawable is hidden in Viewer `Original`.
- Variant-neutral Drawable remains controlled only by existing visibility predicates.
- Viewer-local selection can switch a `singleSelect` Group and update projection visibility.
- Viewer-local selection can toggle `multiToggle` Group and update projection visibility.
- `Reset variants` restores Project default active selection.
- Viewer-local selection does not mutate `session.graph.variantGroups` and does not dirty Project state.
- `Atlas Runtime` respects the same Variant visibility after remap.
- Runtime Controls order is render source, Variants, parameter search.
- Variants section is initially collapsed and shows active summary while collapsed.
- Expanded section exposes usable controls for `singleSelect` and `multiToggle`.

Recommended focused commands:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer`
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts`
- `pnpm.cmd typecheck`

Escalate if:

- Viewer cannot receive a Variant predicate without broad Canvas projection rewrite.
- `Atlas Runtime` remap drops visibility information and requires Runtime Export/package changes.
- Runtime Controls component structure requires a broader redesign than the accepted Viewer Variant UX.
- A user-visible choice arises about persisting Viewer Variant selection.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave100-final-integration-clean-review`

Dependencies:

- Domain A `pass`, or explicit `needs_fix` loop resolution.

Purpose:

- Verify that Viewer Variant switching works end-to-end and does not reopen Wave99 persistence/export scope.
- Record reports, reviews, and closeout artifacts.

Allowed write scope:

- `discussion/implementation/waves/wave100/**`
- `discussion/implementation/reviews/wave100/**`
- implementation maps if status updates are required.

Required checks:

- Domain A report and review lanes present.
- Focused Viewer tests pass.
- Focused Variant predicate tests pass.
- Focused Canvas Variant visibility tests still pass, or explicit classification if the exact test file differs.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Runtime Player UI/hotkey/protocol changes.
  - no package-format / operation-core / runtime-export materialization changes.
  - no Texture Atlas algorithm or stale policy changes.
  - no dependency / lockfile changes.
  - no Project default active mutation from Viewer controls.

## 8. Review Policy

Domain A requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- Viewer initial state uses Project default active selection.
- Viewer Variant switching is session-only.
- Viewer Variant switching does not mutate Project default active selection.
- Viewer Variant switching does not mark the project dirty.
- Variants section is hidden when no groups exist.
- Variants section is collapsible and summary-visible.
- Variant predicate applies to both `Original` and `Atlas Runtime`.
- Runtime Player and Runtime Export are not changed.

Design / Development Review must explicitly check:

- Viewer-local state is owned by Viewer, not by Variant Manager provider preview state.
- `VariantManagerScreen` is not imported into Viewer.
- Predicate insertion happens before render source remap.
- Atlas cache/source resolution does not include Variant selection unnecessarily.
- Runtime Controls state does not become a broad catch-all file.
- Source organization policy is respected.
- no new dependencies.

Test Adequacy Review must explicitly check:

- no-variant behavior.
- default active initial behavior.
- single-select switching.
- multi-toggle switching.
- reset variants.
- non-persistence / non-dirty behavior.
- `Original` and `Atlas Runtime` projection behavior.
- Runtime Controls placement / collapsed summary behavior.

## 9. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave100/wave100-domain-a-viewer-variant-switching-integration-report.md`
- `discussion/implementation/waves/wave100/wave100-final-integration-report.md`
- `discussion/implementation/waves/wave100/_map.md`

Review reports:

- `discussion/implementation/reviews/wave100/wave100-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave100/wave100-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave100/wave100-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave100/wave100-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave100/_map.md`

## 10. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Preserve Viewer `Original` / `Atlas Runtime` behavior outside Variant predicate insertion.
- Keep Viewer Variant selection session-only.
- Do not mutate Project default active selection from Viewer.
- Do not implement Runtime Player UI / hotkeys / Browser Source protocol.
- Do not change package format, Runtime Export, Workspace Save, or Texture Atlas stale policy.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat persisted Viewer Variant selection as blocking.
- Treat Project default active mutation from Viewer as blocking.
- Treat Runtime Player / Runtime Export / package-format changes as out-of-scope unless explicitly justified and escalated.
- Treat dependency/lockfile changes as blocking unless explicitly escalated.

## 11. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave100 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.
- Must not pass the wave gate while a child is incomplete, running, or unresolved.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.
- Must not implement source changes directly.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 12. Out of Scope

- Runtime Player Variant UI.
- Runtime Player hotkeys.
- Runtime Player Browser Source protocol.
- OBS / capture interaction changes.
- Runtime Export schema/materialization changes.
- Package format changes.
- Workspace Save / Portable JSON changes.
- Texture Atlas target selection, packing, artifact format, or stale policy changes.
- Canvas preview redesign.
- Variant Manager editing UX changes.
- Authoring Workspace permanent Variant switcher.
- Project default active selection editing from Viewer.
- Mesh generation changes.
- Deformer / parameter / dynamics changes.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
