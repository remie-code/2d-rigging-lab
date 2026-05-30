# Wave 17 Domain D Review: editor mesh vertex controls UI

- verdict: `pass`
- reviewer: Review-Sylph
- target: `wave17-editor-mesh-vertex-controls-ui`
- review lanes: Design / Development Compliance Review, Test Adequacy Review, UI / Accessibility smoke review

## Review Context Separation Evidence

本レビューは、Domain D 実装担当 Gnome とは別コンテキストの Review-Sylph として実施した。

- Gnome implementation context: `019e7898-52d8-7a31-8f89-28ceb6dd3d76` (`Gnome the 14th`)
- Review-Sylph context: this review context, separate from the implementation context
- Source implementation files / tests は編集していない。書き込みは、この委譲された review report の新規作成のみ。
- Gnome の完了報告だけに依存せず、basis documents、指定 diff、untracked source の直接読解、focused verification の再実行で確認した。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-runtime-evidence-regression-review.md`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`
- `discussion/implementation/reviews/wave17/wave17-editor-mesh-edit-workflow-state-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`

## Changed Files / Diff Reviewed

Scoped diff reviewed with:

`git diff -- apps/editor/src/ui/drawable-authoring apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles apps/editor/src/editor-state/editor-test-ids.ts discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`

Tracked modified files reviewed:

- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/editor-state/editor-test-ids.ts`

Untracked / new files read directly:

- `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`

Worktree には Domain A/B/C 由来の package/editor-session/editor-workflow/editor-state 変更も残っているが、Domain D の実装差分としては扱っていない。Domain D の対象差分は、指定された UI / shell / app / style / test-id / report 範囲に収まっている。

## Verification Performed / Considered

Gnome reported verification considered:

- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`: pass after sandbox EPERM escalated rerun, 3 files / 20 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: pass after sandbox EPERM escalated rerun and one test callback fix
- `pnpm.cmd run check:source`: pass
- scoped `git diff --check`: pass, LF/CRLF warning only

Independent review verification performed:

- Focused Vitest command:
  - sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`
  - escalated rerun passed: 3 files / 20 tests
- Editor typecheck:
  - sandbox run failed with `EPERM` opening `node_modules/.../typescript/bin/tsc`
  - escalated rerun passed
- `pnpm.cmd run check:source`: pass
- Scoped `git diff --check -- ...`: pass, LF/CRLF warnings only
- Browser screenshot / accessibility-tree inspection was not performed in this review context; no callable Browser tool was exposed through tool discovery. Domain E remains responsible for browser-level desktop/mobile and a11y smoke.

## Findings

Blocking findings: none.

Warnings: none.

No actionable finding requires a Gnome fix loop for Domain D.

## Design / Development Compliance Review

`pass`.

- Mesh vertex controls are implemented in a focused new UI file, not folded into a broad panel file. `createMeshVertexControls` receives `MeshEditViewModel` and renders selected mesh status, editable rows, and nudge controls in `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:16`.
- The UI passes Domain C command objects through instead of rebuilding operation payload semantics. Each button receives `vertex.nudgeCommands.*` and the click handler calls `options.onNudgeVertex(options.command)` directly in `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:101`, `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:117`, `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:129`, `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:139`, and `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:190`.
- Drawable authoring composition preserves generated drawable creation, Wave16 layer status/list controls, and adds mesh controls in the same panel before the drawable list in `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts:42` through `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts:56`.
- App shell wiring exposes `onNudgeMeshVertex` and passes it into the drawable authoring panel in `apps/editor/src/ui/app-shell/app-shell.ts:45` and `apps/editor/src/ui/app-shell/app-shell.ts:125`.
- The mounted editor app calls `workflow.nudgeMeshVertex(command)` and re-renders immediately after the operation in `apps/editor/src/app/editor-app.ts:36`. This is the needed UI-shell connection for preview visual and mesh edit status/result updates.
- Stable Domain E-facing ids were added for controls/status/rows/buttons in `apps/editor/src/editor-state/editor-test-ids.ts:13`, `apps/editor/src/editor-state/editor-test-ids.ts:14`, `apps/editor/src/editor-state/editor-test-ids.ts:48`, and `apps/editor/src/editor-state/editor-test-ids.ts:51`.
- Source organization complies with the policy. `apps/editor/src/ui/drawable-authoring/index.ts` remains barrel-only, `apps/editor/src/editor-state/index.ts` and `apps/editor/src/editor-session/index.ts` remain re-export surfaces, and `check:source` passed. The new `mesh-vertex-controls.ts` is 193 lines and has a single UI-control responsibility.

## Test Adequacy Review

`pass`.

- Drawable authoring panel tests cover rendering mesh controls alongside existing drawable UI, editable vertex status, stable row test id, nudge button accessible label, and callback payload equality with the view-model command in `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:43` and `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:96`.
- App shell tests cover callback wiring from authoring controls in `apps/editor/src/ui/app-shell/app-shell.test.ts:103`.
- App shell tests also cover the visible effect after a nudge: preview polygon points change, preview summary remains coherent, and mesh edit status contains `moveMeshVertex committed` in `apps/editor/src/ui/app-shell/app-shell.test.ts:128`.
- Existing preview/drawable co-location and layer-control regressions are retained in `apps/editor/src/ui/app-shell/app-shell.test.ts:191` and the existing layer callback/boundary tests.
- Fixed test id uniqueness remains covered by `apps/editor/src/editor-state/editor-test-ids.test.ts:7`.
- Independent focused Vitest rerun passed 3 files / 20 tests, and editor typecheck passed after sandbox escalation.

The coverage is adequate for Domain D. Browser e2e save/load and mobile screenshot smoke are correctly deferred to Domain E.

## UI / Accessibility Smoke Review

`pass` at DOM/CSS smoke level.

- The controls section has an accessible heading association via `aria-labelledby` in `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:22`.
- Mesh edit status uses `role="status"` and an explicit accessible label in `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:68` through `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:70`.
- Nudge controls are real `<button type="button">` elements with per-vertex `aria-label` values in `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:179` through `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts:190`.
- CSS includes `min-width: 0` and `overflow-wrap: anywhere` on status/table text surfaces, fixed table layout, and responsive mobile table-to-block behavior in `apps/editor/src/styles/editor.css:482`, `apps/editor/src/styles/editor.css:531`, `apps/editor/src/styles/editor.css:554`, and `apps/editor/src/styles/editor.css:952`.
- The structure does not introduce nested cards. Mesh controls are a subsection inside the existing drawable authoring panel, and mobile rows use the same responsive table-card pattern already used by drawable/parameter lists.

No text-overflow or incoherent-overlap risk is apparent from the DOM structure and CSS. The remaining browser-level visual check belongs to Domain E.

## Remaining Risks / Open Verification Items

- Browser-level desktop/mobile screenshot and a11y smoke were not run in this review context. Domain E should verify create drawable -> nudge vertex -> preview update -> save/load and mobile layout.
- The UI intentionally exposes deterministic per-row nudge buttons only. Full canvas editing, drag selection, multi-vertex editing, UV/topology editing, and user-configurable step controls remain future scope.
- No user-decision point is blocking Domain D.

## Verdict

`pass`. Domain D meets the assigned UI, shell wiring, test id, source organization, and focused verification requirements. No needs-fix loop is recommended.
