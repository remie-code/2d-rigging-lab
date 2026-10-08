# Wave85 Domain B Test Adequacy Review

## Verdict

pass

## Basis reviewed

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-warning-badge.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

## Scope reviewed

Domain B の Validate screen、App Bar / Toolbox badge、Diagnostics read-only list、jump action helper、Viewer exclusion のテスト妥当性を確認した。

Domain C らしい `features/editor-session/**` と `workspace/panels/**` の dirty changes は、Domain B の badge / screen / jump / Viewer negative coverage に直接関係する範囲以外はレビュー対象外とした。

## Fix loop 1 re-review

Previous blocking finding is resolved.

- App Bar badge coverage now uses a single Dynamics Group with missing input and missing output parameters, and expects `2 validation warnings` / `>2</span>` (`apps/editor/src/workspace/app-bar.test.ts:187`, `apps/editor/src/workspace/app-bar.test.ts:193`, `apps/editor/src/workspace/app-bar.test.ts:229`, `apps/editor/src/workspace/app-bar.test.ts:255`).
- Toolbox badge coverage uses the same same-category / same-target two-warning pattern and expects `2 validation warnings` / `>2</span>` (`apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:85`, `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:91`, `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:98`, `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts:124`).
- App Bar and Toolbox source still pass `createEditorDiagnosticsProjection(session).warningItemCount` into `DiagnosticsWarningBadge` (`apps/editor/src/workspace/app-bar.tsx:34`, `apps/editor/src/workspace/app-bar.tsx:88`, `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:22`, `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:81`).
- Duplicate Dynamics output jump coverage was added at helper and screen levels (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts:143`, `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts:170`, `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts:119`, `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts:130`).
- No new test adequacy issue was introduced by the fix-loop changes.

## Findings

No blocking findings.

The prior blocking finding about badge count test adequacy is fixed. The new fixtures distinguish warning item count from category count, target count, and boolean presence because both warning items are in the same Dynamics category and on the same Dynamics Group target.

## Requirement-to-test coverage matrix

| Requirement | Coverage | Assessment |
|---|---|---|
| Validate entry opens Diagnostics screen | `authoring-workspace.tsx:35`, `authoring-workspace.tsx:47`, `diagnostics-screen.test.ts:133` | Covered. `activeEntry="validate"` で dedicated Diagnostics screen が開き、Parameter Bar が出ないことを確認している。 |
| Badge appears when warning item count > 0 | `app-bar.test.ts:187`, `workspace-toolbox.test.ts:85` | Covered. App Bar / Toolbox とも non-empty projection で badge 表示を確認している。 |
| Badge absent when diagnostics empty | `app-bar.test.ts:197`, `workspace-toolbox.test.ts:79` | Covered. App Bar / Toolbox とも empty projection で badge absence を確認している。 |
| Badge count equals warning item count | `app-bar.test.ts:193`, `app-bar.test.ts:229`, `app-bar.test.ts:255`, `workspace-toolbox.test.ts:91`, `workspace-toolbox.test.ts:98`, `workspace-toolbox.test.ts:124` | Covered. Same-category / same-target two-warning fixtures assert `2`, so category count, target count, and boolean badge regressions would fail. |
| Diagnostics list is read-only and has no auto-fix / repair controls | `diagnostics-screen.test.ts:86`, `diagnostics-screen.test.ts:93`, `diagnostics-screen.test.ts:114`, `diagnostics-screen.tsx:150` | Covered enough for v0. Tests are mostly static markup checks, but source shows only jump action buttons and no mutation controls. |
| Jump actions call expected entry/tool/selection changes for mesh | `diagnostics-jump-actions.test.ts:47` | Covered. Authoring entry, Mesh tool, Drawable selection are asserted. |
| Jump actions call expected changes for deformer | `diagnostics-jump-actions.test.ts:76` | Covered. Authoring entry, Rig tool, Deformer tree selection are asserted. |
| Jump actions call expected changes for parameter | `diagnostics-jump-actions.test.ts:107` | Covered. Parameters entry and active parameter are asserted. |
| Jump actions call expected changes for dynamics | `diagnostics-jump-actions.test.ts:136` | Covered. Authoring entry, Dynamics tool, preview group selection are asserted. |
| Duplicate Dynamics output renders/covers multiple jump actions | `diagnostics-jump-actions.test.ts:143`, `diagnostics-jump-actions.test.ts:170`, `diagnostics-screen.test.ts:119`, `diagnostics-screen.test.ts:130` | Covered. Helper creates one command per valid duplicate-output action hint, and screen renders two jump buttons for two owner groups. |
| Unsafe missing deformer target does not invent a jump | `diagnostics-jump-actions.test.ts:191` | Covered. Missing keyform target Deformer stays non-jumpable. |
| Viewer does not show diagnostics badge/list/warnings | `viewer-runtime-screen.test.ts:204`, `viewer-runtime-screen.test.ts:213` | Covered. A session with diagnostics warnings is rendered on Viewer route and badge/list/warning prose are absent. |

## Verification assessment

Domain B report records these commands:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox run failed with esbuild `spawn EPERM`
  - escalated rerun passed: 5 files, 33 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `node scripts/check-dependencies.mjs`: passed
- `git diff --check -- apps/editor/src/workspace apps/editor/src/state discussion/implementation/waves/wave85 discussion/implementation/reviews/wave85`: passed with LF/CRLF warnings only

The command set is plausible and sufficient for the current Domain B suite, and the sandbox/escalation caveat is documented. This review did not rerun the commands. The previously missing multi-warning badge assertion is now present.

## Residual risks / user-decision points

- No user decision is needed.
- No browser visual QA was run per Domain B report. This is a residual layout risk, not a Domain B test adequacy blocker for the listed functional rubric.
- Read-only coverage relies partly on static markup absence checks for `auto-fix`, `repair`, and `<input`; source review supports the conclusion, but future additions should prefer role/test-id based assertions for any new action controls.
