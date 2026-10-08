# Wave 102 Plan: Runtime Export Variant Visibility Foundation

> Wave102は、Runtime Player Live ControllerでVariant / 差分切替を実装する前提として、Runtime Exportがruntime時のVariant切替に必要なvisibility情報を保持できるようにする。Player UIは作らず、Runtime Export schema / materialization / compatibility / validationにスコープを閉じる。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave102
- Wave name: `runtime-export-variant-visibility-foundation`
- Primary objective:
  - Runtime Export Drawableに、Variant適用前のbase visibilityを表す `baseVisible` 相当のfieldを追加する。
  - 既存 `visible` は後方互換のため残し、default active Variant selection適用後のinitial visibilityとして扱う。
  - 新規Runtime Export materializationでは、全Drawableに `baseVisible` と `visible` の両方を出力する。
  - Runtime Export variants metadataとexported Drawable setの整合性を検証または正規化する。
  - 旧Runtime Export without `baseVisible` のparse/read compatibilityを壊さない。
  - Runtime Player Live Controller UI、Player active Variant selection、Stage / Browser Source同期は対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Read-only Sylph調査により、Runtime Exportには `model.variants` metadataが存在するが、Player runtime切替にはまだ不足していることが確認済み。
- 不足の主因は、default active Variant selectionが `drawables[].visible` に焼き込まれており、Drawable単位のpre-variant base visibilityがRuntime Exportに独立して残っていないこと。
- 次のLive Controller実装へ進む前に、Runtime Export側で `baseVisible && variantPredicate(activeSelection)` を評価できる土台を作る必要がある。
- ユーザーは、Player UIよりRuntime Export補強を先に行う方針を採用済み。

Uncertainty:

- factual: low. schema/materialization/Player loaderの現状調査は完了済み。
- decision: low. `visible`を残して後方互換、`baseVisible`相当を追加する方向は合意済み。
- cost of wrong plan: medium. Runtime Export contractはPlayerと将来broadcast appの基盤なので、UIへ進む前に小さく正す。

## 3. Accepted Decisions / Oracles

### 3.1 Visibility Semantics

Runtime Export Drawable visibilityは、今後2層で扱う。

Required:

- `baseVisible`:
  - pre-variant visibility。
  - 現行materializationでVariant predicate適用前に使っている `normalizedDrawable.visible` 相当。
  - 将来Playerがruntime Variant selectionを評価する時のbase条件。
- `visible`:
  - default active Variant selectionを適用したinitial visibility。
  - 既存Runtime Player / loader / rendererが現在読んでいる後方互換field。
  - 旧Runtime Export consumerの挙動を壊さないため残す。

Conceptual rule for new exports:

```text
baseVisible = normalizedDrawable.visible
visible     = baseVisible && variantVisibilityPredicate(defaultActiveSelection, drawableId)
```

Future Player rule, not implemented in this wave:

```text
runtimeVisible = baseVisible && variantVisibilityPredicate(activeSelection, drawableId)
```

Forbidden:

- `visible` を削除する。
- `visible` の意味をbase visibilityへ置き換える。
- `hiddenAtApply` をRuntime Export base visibilityとして流用する。
- Atlas placement metadataをvisibility contractの代替にする。

### 3.2 Backward Compatibility

Required:

- Existing Runtime Export files without `baseVisible` remain parseable.
- For legacy exports, consumers may treat missing `baseVisible` as unavailable/legacy.
- New materialized Runtime Export files must include `baseVisible` for every exported Drawable.
- Tests must cover both:
  - legacy export without `baseVisible`;
  - new export with `baseVisible`.

Accepted:

- Legacy exports without `baseVisible` do not need to support runtime Variant switching.
- Live Controller implementation can later disable Variant switching for legacy exports and ask the user to re-export.

### 3.3 Variant Metadata Consistency

Runtime Export already includes `model.variants`; Wave102 must make it safer for future Player runtime switching.

Required:

- Runtime Export variant metadata must reference exported Drawable ids consistently, or be filtered/sanitized to exported Drawable ids.
- Default active selections must remain present and valid for every exported Variant Group.
- Variant membership and target drawable ids should not reference Drawable ids missing from the exported runtime model, unless a deterministic warning/compatibility path is explicitly documented.
- Existing package-format validation for group/mode/default consistency must remain.

Recommended:

- Prefer preserving group definitions while filtering memberships/targetDrawableIds to exported Drawable ids if the current export target filter drops drawables.
- If filtering would make a group meaningless, keep parse/validation deterministic and report the chosen behavior in the domain report.

Forbidden:

- Change Editor Variant Manager semantics.
- Change Viewer Variant semantics.
- Add Player UI assumptions to package-format.

### 3.4 Runtime Player Boundary

Wave102 prepares data for Player but does not implement Player switching.

Allowed:

- Narrow Runtime Player type/test adjustment only if existing parser or compile compatibility requires it.
- Legacy/runtime export loading tests may be updated to accept `baseVisible` being present.

Forbidden:

- Add `Live Controller` page.
- Add active Variant selection state in Player.
- Add IPC/bridge messages for Variant selection.
- Change Stage Window or Browser Source runtime rendering behavior.
- Persist Player last active Variant selection.

## 4. Primary Basis

Design / UX basis:

- [../../runtime-player/screens/live-controller-page.md](../../runtime-player/screens/live-controller-page.md)
- [../../design/screen-design/screens/variant-expression-manager.md](../../design/screen-design/screens/variant-expression-manager.md)
- [../../design/screen-design/screens/viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md)

Implementation / wave baseline:

- [wave92-plan.md](wave92-plan.md)
- [../waves/wave92/wave92-final-integration-report.md](../waves/wave92/wave92-final-integration-report.md)
- [../reviews/wave92/wave92-final-clean-integration-review.md](../reviews/wave92/wave92-final-clean-integration-review.md)
- [wave99-plan.md](wave99-plan.md)
- [../waves/wave99/wave99-final-integration-report.md](../waves/wave99/wave99-final-integration-report.md)
- [wave100-plan.md](wave100-plan.md)
- [../waves/wave100/wave100-final-integration-report.md](../waves/wave100/wave100-final-integration-report.md)
- [wave101-plan.md](wave101-plan.md)
- [../waves/wave101/wave101-final-integration-report.md](../waves/wave101/wave101-final-integration-report.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)
- [../../development_convention/schema-and-id-conventions.md](../../development_convention/schema-and-id-conventions.md)

Known source facts from inventory:

- `packages/package-format/src/runtime-export.ts`
  - Runtime Export schema has optional `model.variants`.
  - `RuntimeExportDrawableSchema` currently has `visible` but no `baseVisible`.
- `packages/package-format/src/model-variants.ts`
  - Variant Group schema has `mode`, `variants`, `targetDrawableIds`, `memberships`, `defaultActive`.
- `packages/authoring-core/src/runtime-export-materialization.ts`
  - Materialization currently computes `visible` as `normalizedDrawable.visible && variantVisibilityPredicate(drawableId)`.
  - `model.variants` is cloned into Runtime Export when Variant Groups exist.
- `packages/authoring-core/src/variant-evaluation.ts`
  - Contains reusable pure Variant predicate/default selection logic.
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
  - Currently ignores `model.variants` and maps `NormalizedDrawable.visible = drawable.visible`.
- `apps/runtime-player/src/stage/stage-renderer/**`
  - Currently renders based on `drawable.visible` / evaluated snapshot visibility.
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
  - No active Variant selection message exists.

## 5. Wave Strategy

Wave102 should run as a single implementation domain plus final integration.

```text
Batch 1:
  Domain A: Runtime Export Variant Visibility Foundation

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Package schema, authoring-core materialization, and focused compatibility tests are tightly coupled.
- Splitting package-format and authoring-core into separate domains would add coordination cost without meaningful parallelism.
- Player UI/transport is explicitly out of scope, keeping the domain bounded.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Runtime Export Variant Visibility Foundation | Wave92 Runtime Export baseline and Wave99/100 Variant baseline | Single implementation domain | Add `baseVisible`/pre-variant visibility to Runtime Export schema/materialization, preserve legacy parse, validate/filter Variant metadata against exported Drawable set |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate contract, compatibility, tests, forbidden Player UI scope, reports/reviews/maps |

## 6. Domain A: Runtime Export Variant Visibility Foundation

Domain id: `wave102-runtime-export-variant-visibility-foundation`

Purpose:

- Make Runtime Export carry enough visibility information for future runtime Variant switching, without implementing Player switching yet.

Allowed write scope:

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/model-variants.ts` only if narrow exported helper/type compatibility is needed.
- `packages/package-format/src/**/*.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/variant-evaluation.ts` only for narrow pure helper reuse if needed.
- `packages/authoring-core/src/**/*.test.ts`
- `apps/runtime-player/src/**` only for narrow compile/test compatibility if existing types require it; no UI/behavioral switching.
- Domain A report/review files under `discussion/implementation/waves/wave102/` and `discussion/implementation/reviews/wave102/`.

Conditional write scope requiring explicit report justification:

- `packages/runtime-core/src/**` only if a type boundary needs `baseVisible` compatibility; behavioral changes must escalate.
- `packages/render-core/src/**` or `packages/render-webgl2/src/**` only if compile compatibility requires a type addition; rendering behavior changes must escalate.

Forbidden write scope:

- `apps/runtime-player/src/control/**` Live Controller UI.
- Runtime Player active Variant selection state.
- Runtime Player bridge/IPC messages for Variant selection.
- Stage Window / Browser Source render behavior changes.
- Player last active Variant persistence.
- Editor Variant Manager changes.
- Editor Viewer Variant switching changes.
- Texture Atlas packing/target selection changes.
- Runtime Export directory UX changes.
- Workspace Save / Portable JSON changes.
- new dependencies / lockfile.

Required implementation:

- Add `baseVisible` or equivalently named pre-variant visibility field to Runtime Export Drawable schema.
- Keep `visible` in Runtime Export Drawable schema.
- Ensure new materialized Runtime Export drawables emit:
  - `baseVisible = normalizedDrawable.visible`
  - `visible = baseVisible && defaultVariantPredicate(drawableId)`
- Preserve parse compatibility for legacy runtime exports without `baseVisible`.
- Ensure package-format types / parse helpers document the legacy case.
- Ensure Runtime Export `model.variants` remains valid when present.
- Validate or sanitize Variant metadata against exported Drawable ids:
  - `targetDrawableIds`
  - `memberships`
  - default selections
- Add deterministic tests for Variant metadata and base visibility.
- Keep current Player rendering behavior unchanged for now.

Out of scope:

- Live Controller page.
- Player runtime switching.
- Browser Source selection transport.
- Hotkeys.
- Player last active Variant save/restore.
- Mask/Variant UX policy changes beyond export consistency.

Required tests:

- New Runtime Export schema accepts drawables with `baseVisible` and `visible`.
- Legacy Runtime Export schema accepts drawables without `baseVisible`.
- Materialization emits `baseVisible` for every exported Drawable.
- Materialization preserves current `visible` as default-active evaluated initial visibility.
- For a default-inactive Variant Drawable:
  - `baseVisible` can be true;
  - `visible` is false.
- For a non-Variant Drawable:
  - `baseVisible` and `visible` match when no default predicate hides it.
- Runtime Export variants metadata is present when session has Variant Groups.
- Variant target/membership references missing exported Drawable ids are filtered, rejected, or otherwise handled deterministically with tests.
- Existing Runtime Export without Variant Groups remains valid.
- Existing Runtime Player loader/adapter tests continue to pass or are narrowly adjusted for optional `baseVisible` without changing render behavior.
- Runtime Export directory/export tests remain passing.

Recommended focused commands:

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts packages/package-format/src/package-document.test.ts`
- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-materialization.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts`
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader`
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation`
- `pnpm.cmd typecheck`

Escalate if:

- Adding `baseVisible` requires a Runtime Export schema version migration that would break old exports.
- Variant metadata cannot be reconciled with exported Drawable set without a product decision.
- Mask/clip relationships require a policy choice for Variant-disabled sources/targets.
- Player loader cannot tolerate optional `baseVisible` without broader runtime behavior changes.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave102-final-integration-clean-review-map-closeout`

Dependencies:

- Domain A `pass`, or explicit `needs_fix` loop resolution.

Purpose:

- Verify Runtime Export Variant visibility foundation is complete, bounded, and ready for a later Player Live Controller wave.
- Record reports, reviews, and closeout artifacts.

Allowed write scope:

- `discussion/implementation/waves/wave102/**`
- `discussion/implementation/reviews/wave102/**`
- implementation maps if status updates are required.
- narrow source/test fixes only if final clean review requires them.

Forbidden write scope:

- Live Controller UI.
- Runtime Player active Variant switching.
- Stage / Browser Source behavior changes.
- Workspace Save / Portable JSON changes.
- Texture Atlas changes.
- new dependencies / lockfile.

Required checks:

- Domain A report and review lanes exist.
- Focused package-format Runtime Export tests pass.
- Focused authoring-core Runtime Export materialization/assembly tests pass.
- Focused Runtime Player loader/runtime-evaluation compatibility tests pass if touched.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Live Controller UI.
  - no Runtime Player selection IPC/transport.
  - no Stage/Browser Source render behavior change.
  - no Texture Atlas changes.
  - no dependency/lockfile changes.

## 8. Review Policy

Domain A requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- `baseVisible`/pre-variant visibility is present in new exports.
- `visible` remains present and remains default-active evaluated initial visibility.
- legacy exports without `baseVisible` parse.
- Runtime Export Variant metadata is preserved and valid.
- Variant metadata references to exported Drawable ids are deterministic.
- Player UI/active switching is not implemented.
- Stage / Browser Source behavior is not changed.

Design / Development Review must explicitly check:

- package-format owns schema/type compatibility.
- authoring-core owns materialization and export-time consistency.
- Runtime Player changes, if any, are compatibility-only.
- `hiddenAtApply` is not abused as base visibility.
- no broad runtime/render refactor.
- no new dependencies.
- source organization policy is respected.

Test Adequacy Review must explicitly check:

- schema new/legacy cases.
- materialization base/default visibility split.
- default-inactive Variant Drawable case.
- non-Variant Drawable case.
- Variant metadata presence and consistency.
- existing Runtime Export no-variant case.
- Runtime Player compatibility, if any files are touched.

## 9. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| New exports include base visibility | authoring-core materialization test |
| `visible` remains default-evaluated | materialization test with default active Variant |
| Legacy exports without base visibility parse | package-format test |
| Variant metadata remains present | package-format/materialization test |
| Variant membership references exported drawables deterministically | package-format or authoring-core consistency test |
| Runtime Player behavior unchanged | focused loader/adapter test or explicit no-touch evidence |
| Live Controller UI not implemented | forbidden-scope review |
| No Stage/Browser Source behavior change | forbidden-scope review |

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave102/wave102-domain-a-runtime-export-variant-visibility-foundation-report.md`
- `discussion/implementation/waves/wave102/wave102-final-integration-report.md`
- `discussion/implementation/waves/wave102/_map.md`

Review reports:

- `discussion/implementation/reviews/wave102/wave102-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave102/wave102-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave102/wave102-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave102/wave102-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave102/_map.md`

## 11. Subagent Contract

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
- Keep `visible` backward-compatible.
- Do not implement Live Controller UI.
- Do not implement Player active Variant switching.
- Do not change Stage / Browser Source rendering behavior.
- Do not use atlas `hiddenAtApply` as Runtime Export base visibility.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat removal or semantic replacement of `visible` as blocking.
- Treat missing legacy parse coverage as blocking.
- Treat Player UI/active switching/Stage render behavior changes as out of scope unless explicitly escalated.
- Treat dependency/lockfile changes as blocking unless explicitly escalated.

## 12. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement unrelated Live Controller, Runtime Player switching, Workspace Save, Texture Atlas, Mesh generation, Deformer, keyform, Dynamics, camera, or transport features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check schema semantics, materialization semantics, compatibility, tests, and forbidden scope explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 13. Out of Scope

- Live Controller page.
- Runtime Player Variant UI.
- Runtime Player active Variant selection state.
- Runtime Player IPC/bridge/Browser Source messages for Variant selection.
- Player last active Variant persistence.
- Hotkeys.
- Stage Window / Browser Source render behavior changes.
- Editor Variant Manager changes.
- Viewer Variant behavior changes.
- Texture Atlas target extraction, packing, or artifact changes.
- Runtime Export directory UX changes.
- Workspace Save / Portable JSON changes.
- Mesh generation changes.
- Deformer/keyform/dynamics changes.
- Camera capture / face tracking input.
- OBS / Spout.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
