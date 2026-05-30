# Wave 18 Domain C Completion: Editor Source Intake Draft UI / State

## verdict

`pass`

Domain C の許可範囲内で、split PNG source intake の draft state / view model / minimal UI を追加した。UI は draft confirmation までに限定し、operation payload commit は行っていない。

## orchestration evidence

- Orch-Sylph は source implementation files を直接編集していない。
- Gnome implementation context: `019e78c5-dd11-79a0-9abb-a1b73e18fc8c` (`Gnome the 24th`)
- Review-Sylph context: `019e78d2-98b1-7e80-bf3f-6c103a648e66` (`Sylph the 25th`)
- Review report: `discussion/implementation/reviews/wave18/wave18-editor-source-intake-draft-ui-state-review.md`
- Review verdict: `pass`

## changed files

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/source-assets/index.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/editor.css`
- `discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`

## implementation summary

- `SourceIntakeDraftState` を追加し、`manifestPath`、`sourceAssetId`、`contentHash`、`defaultPartId`、`placementPolicy`、source layer rows、rights/provenance metadata を draft として保持するようにした。
- `SourceIntakeDraftViewModel` を追加し、manifest / placement / rights / provenance / layer rows / validation diagnostics を UI 表示用に投影した。
- `source-assets` UI として `Source Intake` panel / form を追加した。form submit は `confirmSourceIntakeDraft` を呼び、valid draft を app-local state に保存するだけで operation commit は行わない。
- `editor-app.ts` では `sourceIntakeDraft` を workflow とは別の app-local draft state として保持し、load/reset 時に sample default へ戻す。
- `app-shell` へ panel を追加したが、既存の preview / create parameter / drawable authoring / layer controls / mesh vertex controls の callback と配置は維持した。

## stable test ids / labels

- `sourceIntake.panel`: source intake panel
- `sourceIntake.form`: `aria-label="Confirm split PNG source intake draft"`
- `sourceIntake.confirm`: draft confirmation button
- `sourceIntake.summary`: manifest / placement / rights / provenance summary
- `sourceIntake.diagnostics`: local draft validation diagnostics
- `sourceIntake.layerRows`: source layer rows region, `aria-label="Split PNG source layer rows"`
- `sourceIntake.addLayer`: add draft layer row button
- `sourceIntake.manifestPath`: Split PNG manifest path input
- `sourceIntake.placementPolicy`: Placement policy select
- `sourceIntake.rightsStatus`: Rights status select
- `createSourceIntakeLayerRowTestId(sourceLayerId)`: dynamic layer row test id, e.g. `sourceIntake.layer.layer_body`
- Main accessible labels: `Source Intake`, `Split PNG manifest path`, `Placement policy`, `Rights status`, `Creator`, `License`, `Source layer row N`

## verification commands and results

- `pnpm.cmd --filter @private-2d-rigging-lab/editor test -- source-intake app-shell`
  - result: failed as a command shape. It ran all editor tests from `apps/editor`, and pre-existing relative-path tests failed with `apps/editor/apps/editor/...` and `apps/editor/fixtures/...` ENOENT. Source-intake and app-shell tests in that run passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - result: pass after sandbox escalation. 3 files / 19 tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - result: pass after sandbox escalation.
- `pnpm.cmd run check:source`
  - result: pass. Source organization guard passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui/source-assets apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`
  - result: pass with LF-to-CRLF working-copy warnings only; no whitespace errors.
- `rg -n "[ \t]+$" <Domain C new source/test/report files>`
  - result: pass. No trailing whitespace matches.
- Review-Sylph clean review
  - result: pass. Blocking findingsなし。

## source organization evidence

- `apps/editor/src/editor-state/index.ts` remains barrel-only; only `export * from ...` statements were added.
- `apps/editor/src/ui/source-assets/index.ts` is barrel-only.
- Draft data ownership is split into `source-intake-draft-state.ts`.
- UI projection is split into `source-intake-view-model.ts`.
- UI rendering is split into `source-intake-panel.ts` and `source-intake-form.ts`.
- No production logic was added to `index.ts`, and no catch-all source file was introduced.

## remaining risks / user-decision points

- Domain C intentionally does not commit `importSplitPngSourceAsset` or `setRightsMetadata`; Domain D must connect the confirmed draft to workflow/session commit semantics.
- `contentHash` は draft に保持されるが Domain C validation では必須化していない。Domain D/integration で operation-ready 条件として必須警告にするか判断する。
- `blocked` rights は draft metadata として表現できる。Domain D は blocked rights draft を successful import として扱わないこと。
- Layer rows are metadata-only. Real PNG bytes, file picker, image decoding, texture atlas generation, and actual texture rendering remain future scope.
- No blocking user decision point was found for Domain C.
