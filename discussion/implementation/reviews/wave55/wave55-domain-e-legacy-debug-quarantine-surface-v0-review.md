# Wave55 Domain E Review: Legacy / Debug Quarantine Surface v0

> Role: independent Review-Sylph / clean context  
> Target: `wave55-legacy-debug-quarantine-surface-v0`  
> Verdict: `pass`

## Verdict

`pass`

Domain E の実装は、legacy/debug panels を Primary Authoring Workspace へ残す実装ではなく、非 primary / internal debug / quarantine surface として明示された最小 surface を追加している。G 統合前の component-level output として、Wave55 Domain A の所有境界と Domain E rubric を満たしている。

## Scope Reviewed

- `apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.ts`
- `apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`
- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave55/wave55-domain-a-reset-boundary-ownership-contract-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/development_convention/source-file-organization-policy.md`

Gnome の説明には依存せず、対象 source/test と basis docs を直接確認した。

## Blocking Findings

なし。

## Review Checks

### Quarantine Boundary

`pass`

`createLegacyDebugQuarantineSurface()` は root を `legacy-debug-quarantine-surface` として作り、`shellSurfaceKind: "debug-quarantine"`、`shellSurfaceGroup: "debug-quarantine"`、`shellSurfacePrimary: "false"`、`primaryAuthoringSurface: "false"`、`authoringWorkspaceFlow: "false"`、`internalDebugSurface: "true"`、`quarantineSurface: "true"` を付与している（`legacy-debug-quarantine-surface.ts:9`, `legacy-debug-quarantine-surface.ts:31`, `legacy-debug-quarantine-surface.ts:33`-`legacy-debug-quarantine-surface.ts:43`）。

これは Wave55 plan / Domain A が求める「通常 authoring flow ではない legacy/debug quarantine」と整合する。実装は live App Shell cutover、primary removal、final routing、full Diagnostics/Evidence、full Codex/Automation、PSD task redesign、Product Preflight redesign を行っていない。

### Primary Absence vs Quarantine Presence Metadata

`pass`

root metadata は `primaryUiAbsence: "normal-authoring-workspace-does-not-mount-legacy-panels"` と `quarantinePresence: "legacy-panel-reachability-preserved-outside-primary-flow"` を分けて持つ（`legacy-debug-quarantine-surface.ts:19`-`legacy-debug-quarantine-surface.ts:20`, `legacy-debug-quarantine-surface.ts:42`-`legacy-debug-quarantine-surface.ts:43`）。boundary copy も Primary UI absence と quarantine / specialized surface presence を分離して説明している（`legacy-debug-quarantine-surface.ts:55`-`legacy-debug-quarantine-surface.ts:60`）。

対応 test は metadata 値、`authoringWorkspace` 非再利用、boundary text を検証している（`legacy-debug-quarantine-surface.test.ts:81`-`legacy-debug-quarantine-surface.test.ts:97`）。

### Legacy Panel Preservation

`pass`

渡された panel nodes は新規作成や text copy ではなく `panelHost.append(...panels)` で quarantine host 配下に移される（`legacy-debug-quarantine-surface.ts:73`-`legacy-debug-quarantine-surface.ts:83`）。panel count metadata も `panels.length` から設定される（`legacy-debug-quarantine-surface.ts:44`）。

対応 test は host children、parentElement、test id lookup、empty state 非表示を確認しており、passed node の到達性を十分に覆っている（`legacy-debug-quarantine-surface.test.ts:52`-`legacy-debug-quarantine-surface.test.ts:66`）。

### Non-Reuse of Primary Support Metadata

`pass`

quarantine root は `.authoring-workspace-support`、`legacy-support`、`authoringWorkspace` を root metadata として再利用していない（`legacy-debug-quarantine-surface.ts:10`-`legacy-debug-quarantine-surface.ts:16`, `legacy-debug-quarantine-surface.ts:31`-`legacy-debug-quarantine-surface.ts:39`）。

対応 test は root class、descendant class、descendant `shellSurfaceGroup === "legacy-support"`、`shellSurfaceId !== "authoringWorkspace"`、`shellSurfaceKind !== "authoring-workspace"` を検証している（`legacy-debug-quarantine-surface.test.ts:37`-`legacy-debug-quarantine-surface.test.ts:50`, `legacy-debug-quarantine-surface.test.ts:92`-`legacy-debug-quarantine-surface.test.ts:93`）。

### Empty State

`pass`

panel がない場合は host 配下に explicit empty state を置き、primary absence が期待状態で、Domain G が internal legacy/debug panels を接続するまで quarantine presence は空であることを示す（`legacy-debug-quarantine-surface.ts:79`-`legacy-debug-quarantine-surface.ts:80`, `legacy-debug-quarantine-surface.ts:90`-`legacy-debug-quarantine-surface.ts:97`）。

対応 test は count `0`、non-primary status、empty text、`Authoring Workspace` / `support panels` 文言の不在を確認している（`legacy-debug-quarantine-surface.test.ts:68`-`legacy-debug-quarantine-surface.test.ts:79`）。

### Source Organization

`pass`

実装 logic は named responsibility file `legacy-debug-quarantine-surface.ts` にあり、`index.ts` への substantial implementation logic 追加は確認されない。`apps/editor/src/ui/app-shell/index.ts` は存在しないため、barrel-only policy への違反はない。Orch 既知 verification として `node scripts/check-source-organization.mjs` は passed。

### Test Adequacy

`pass`

focused unit tests は rubric が求める metadata、non-primary boundary、support region class/group 非再利用、passed panel node preservation、empty state、primary absence vs quarantine presence の区別をすべて覆っている。

## Verification Considered

Orch 既知 verification:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`: passed, 5 tests. 初回 sandbox run は `spawn EPERM`、同じ targeted command は approval outside sandbox で passed。
- `node scripts/check-source-organization.mjs`: passed。
- `git diff --check -- apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.ts apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`: passed。

Reviewer は対象 source/test と basis docs を直接確認した。source files は編集していない。

## Non-Blocking Residual Risks

- この surface は unit-level / component-level で、live App Shell にはまだ配線されていない。これは Domain G の責務であり、Domain E の blocker ではない。
- 実ブラウザ上で quarantine route/drawer としての到達性、primary first viewport からの legacy absence、Diagnostics/Evidence / Codex/Automation との最終分離は未検証。Domain F/G/H の integration / e2e gate で確認が必要。
- `data-testid` は test-facing marker として残る。production behavior の根拠にしないことは G/F review で継続確認する。

## Gnome Fix Loop

不要。

## Consumption By Domain G/F

Domain G/F はこの surface を消費可能。G は non-primary route/drawer/internal surface としてのみ接続し、normal Primary Human UI や `authoring-workspace-support` replacement として mount してはならない。F は primary absence と quarantine presence を別 oracle として扱うべきである。
