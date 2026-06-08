# Wave 56 Plan: Legacy Editor Purge / Fresh Workspace Placeholder v0

> 旧 `apps/editor` GUI / e2e / GUI由来ドキュメントを物理削除し、GUI非依存のheadless baselineを作り直したうえで、UX駆動の新Editor起動直後画面をplaceholderとして立ち上げる計画。

## 1. 状態

- Status: Planned
- Target wave: Wave56
- Wave name: `legacy-editor-purge-fresh-workspace-placeholder-v0`
- Primary objective: 旧 `apps/editor` を完全削除し、旧GUI/e2e/GUI改善wave成果物を汚染源としてワークスペースから排除する。そのうえで、GUI非依存unit tests + typecheck + 旧GUI/e2e標準参照なし、というheadless baselineを成立させ、UX駆動で作り直した新しい起動直後Authoring Workspace placeholderを表示可能にする。

## 2. Planning Gate Result

Planning Gate result before this plan: `Discuss first` -> `Plan directly`.

Accepted user decisions:

- 旧 `apps/editor` は再利用候補ではなく削除対象である。
- 旧GUI由来の事実抽出も汚染源になり得るため、原則として行わない。
- 削除に必要な機械的依存確認だけは許可する。
- 旧GUI前提ドキュメントは物理削除する。`superseded`隔離では足りない。
- 最初に作るものはPSD import縦断sliceではなく、ユーザーが起動直後に目にする新Editorの画面骨格である。
- 各機能はplaceholderでよい。画面構成、導線、領域の意味がわかることを最初の目標にする。
- headless baselineは、当面はGUI非依存unit tests、typecheck、標準scriptsから旧GUI/e2e参照が消えていることを基準にする。

Primary basis:

- [Editor Rebuild / Purge Policy](../../design/screen-design/editor-rebuild-purge-policy.md)
- [Screen Design Scope and Principles](../../design/screen-design/scope-and-principles.md)
- [Screen Design Overview](../../design/screen-design/overview.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Toolbox Component](../../design/screen-design/components/toolbox.md)
- [Codex-Friendly Automation Policy](../../design/codex-friendly-automation-policy.md)
- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)

## 3. Design Boundary

Wave56 is not a continuation of the Wave51-Wave55 legacy UI improvement path.

Wave56 replaces that path with a purge-and-rebuild baseline:

- Delete old GUI instead of improving or quarantining it.
- Delete old GUI e2e instead of preserving it as a gate.
- Delete old GUI improvement documents instead of keeping them as normal implementation basis.
- Recreate a new GUI shell from screen-design target UX.
- Keep Codex-facing automation philosophy intact: Editor/repo expose deterministic operations; Editor does not infer, propose, auto-classify, auto-rig, auto-fix, or auto-commit.

## 4. Initial UX Target

The first visible GUI target is the startup workspace skeleton:

```text
起動直後
  -> Primary Workspace Shell
      -> App Bar
      -> Toolbox
      -> Parts / Structure Tree placeholder
      -> Canvas / Preview placeholder
      -> Inspector placeholder
      -> Parameter Bar placeholder
      -> Task / View placeholder entry points
```

Required feel:

- 起動直後に、Editorとしての作業空間が見える。
- ユーザーが「PSD Import、Mesh、Rig、Parameter、Atlas、Dynamics、Viewerが将来どこから開くか」を理解できる。
- 旧 `Task Summary`、raw refs、diagnostics evidence、operation payload、test id、Codex/debug-heavy panelは表示されない。
- placeholderは未実装機能を正直に示してよいが、旧GUIの詳細表示を復活させてはならない。

Non-goal for the first UX:

- PSD import実処理の完成。
- Mesh / Rig / Atlas / Parameter / Variant / Dynamicsの実装。
- 新e2e体系の完成。
- renderer / pixel oracle。
- full visual design system。

## 5. Headless Baseline

Wave56のheadless baselineは次で足りる。

- GUI非依存unit testsが通る。
- typecheckが通る。
- 標準 `check` / scripts / workspace / package設定から旧 `apps/editor` GUI、旧e2e、focused e2e、production `data-testid` guard参照が消えている。
- 旧GUIを直せという検証圧力が標準経路から消えている。

このbaselineは新GUI品質保証ではない。旧GUIを削除した後、非GUIコアが壊れていないことを示す暫定の足場である。

## 6. Non-Goals

- 旧 `apps/editor` の再利用可能性調査。
- 旧 `apps/editor` sourceからのUX/状態/コンポーネント事実抽出。
- 旧GUIと新GUIの移行互換。
- 旧e2eの修復。
- 旧GUI documentのsuperseded隔離。
- PSD import、mesh、rig、atlas、parameter、variant、dynamics、viewer各機能の完成。
- 外部HTTP / WebSocket / MCP transport。
- LLM/provider integration。
- semantic recognition、proposal generation、auto-rigging、auto-fix。
- Cubism互換、Cubism形式の読み書き、SDK/Core連携。
- public demo asset work。

## 7. Dependency / Parallel Design

Wave56は削除のblast radiusが大きいため、最初は機械的依存境界を固定してから実装domainを走らせる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Purge manifest / baseline contract | Solo first | Purge policy + screen design | 削除対象、保持対象、標準検証、write scopeを確定する |
| 2 | B. Legacy app / e2e / GUI-doc physical purge | Parallel with C only if A allows | A | 旧 `apps/editor`、旧e2e、旧GUI前提docsを物理削除する |
| 2 | C. Headless scripts / typecheck baseline | Parallel with B only if A allows | A | package scripts、workspace、tsconfig、checkをGUI非依存baselineへ切り替える |
| 3 | D. Fresh editor app scaffold | Solo after B+C | B + C | 旧資産とは別に新Editor appの最小起動基盤を作る |
| 4 | E. Fresh Authoring Workspace placeholder | Solo or split after D | D | 起動直後のPrimary Workspace Shell placeholderを作る |
| 5 | F. Verification / contamination guard | Solo after E | B + C + E | 旧GUI参照不在、headless baseline、new placeholder起動を検証する |
| 6 | G. Docs / map cleanup | Solo after F | F | 削除後のmap、backlog、screen-design文書を同期する |
| 7 | H. Integration review and final report | Solo after G | G | clean final review、final report、残リスク整理を行う |

Parallelism rule:

- BとCはAがwrite ownershipを明確化できた場合のみ並列可能。
- D/E/F/G/Hは原則直列。旧資産削除後の基準線が崩れやすいため、並列を欲張らない。

## 8. Domain Assignments

### A. `wave56-purge-manifest-baseline-contract`

Purpose:

- 旧GUI削除のmanifestを作る。
- 削除対象カテゴリと保持対象カテゴリを確定する。
- B-Hのwrite scopeとverification oracleを固定する。
- 旧GUI sourceの意味的調査を禁止し、削除に必要な機械的参照確認だけを許可する。

Allowed write scope:

- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Allowed investigation:

- `rg` 等による旧 `apps/editor` / e2e / focused e2e / testid guardの参照元確認。
- package scripts、workspace、tsconfig、CI/check scriptの機械的参照確認。

Forbidden:

- 旧 `apps/editor` sourceのUX/状態/コンポーネント再利用調査。
- source implementation。
- 旧GUIを残す方向の提案。

Expected output:

- Purge manifest。
- Headless baseline contract。
- B-H write ownership matrix。
- Physical deletion list。
- User decision required / no decision required の明記。

### B. `wave56-legacy-app-e2e-gui-doc-physical-purge`

Purpose:

- Aのmanifestに従って、旧 `apps/editor` GUI / e2e / 旧GUI前提ドキュメントを物理削除する。
- `_map.md` 等の通常導線から旧GUI前提artifactを外す準備をする。

Allowed write scope:

- `apps/editor/**`
- A-approved old GUI/e2e scripts under `scripts/**`
- A-approved old GUI/e2e docs under `discussion/**`
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Forbidden:

- 旧GUI sourceを読んで再利用判断すること。
- 旧GUIをquarantineとして残すこと。
- `packages/**` の削除。
- concept / AC / scenarios / target screen-design docs / Codex-friendly automation policyの削除。

Deletion safety:

- 削除対象はAのmanifestに限定する。
- destructive shell commandを使う場合は、対象pathがworkspace内かつmanifest内であることを確認する。
- 削除できない場合は、隠す・隔離するのではなく escalate する。

### C. `wave56-headless-scripts-typecheck-baseline`

Purpose:

- 旧GUI削除後も標準検証が意味を持つように、scripts / package config / workspace / tsconfigをheadless baselineへ切り替える。

Allowed write scope:

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig*.json`
- `scripts/**`
- package-level test/check configuration
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Required result:

- GUI非依存unit testsを走らせる標準経路。
- typecheckの標準経路。
- 旧 `apps/editor` / e2e / focused e2e / production `data-testid` guardへの標準参照削除。

Forbidden:

- 旧e2eを修復して残すこと。
- 旧GUI testをbaselineに混ぜること。
- package-levelロジック検証を削ること。

### D. `wave56-fresh-editor-app-scaffold`

Purpose:

- 旧 `apps/editor` 削除後、UX駆動で作り直す新Editor appの最小起動基盤を作る。
- 結果的に `apps/editor` というpathを再利用してよいが、旧sourceからの移植は禁止する。

Allowed write scope:

- `apps/editor/**`
- root/package/workspace configのDに必要な最小追記
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Required:

- 新規最小Vite/TypeScriptまたは既存repo方針に合うbrowser app scaffold。
- old GUI module/file nameへの依存なし。
- 旧 `apps/editor` sourceからのcopy/pasteなし。

Forbidden:

- 旧GUI component再作成。
- 旧e2e復活。
- PSD import実処理の接続。
- Codex/debug/evidence-heavy panelの復活。

### E. `wave56-fresh-authoring-workspace-placeholder`

Purpose:

- 起動直後のPrimary Workspace Shell placeholderを作る。
- 画面構成として、App Bar / Toolbox / Parts Tree / Canvas Preview / Inspector / Parameter Bar / Task/View entry pointsが理解できる状態にする。

Allowed write scope:

- `apps/editor/**`
- focused non-legacy unit/smoke tests if D/A approve
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Required visible regions:

- App Bar placeholder。
- Toolbox placeholder with future entries such as PSD Import, Mesh, Rig, Atlas, Parameter, Viewer。
- Parts / Structure Tree placeholder。
- Canvas / Preview placeholder。
- Inspector placeholder。
- Parameter Bar placeholder。
- Human-readable status area。

Forbidden visible content:

- `Task Summary`
- raw refs / operation IDs / diagnostic IDs / evidence paths
- command payloads
- test ids
- old panel names as UI content
- Codex/debug-heavy normal panels

### F. `wave56-verification-contamination-guard`

Purpose:

- 削除と再構築が狙い通りであることを確認する。

Allowed write scope:

- narrow verification scripts if A approves
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Required verification:

- GUI非依存unit tests pass。
- typecheck pass。
- 標準 `check` が旧e2e / focused e2e / production `data-testid` guardに依存しない。
- `rg` 等で旧GUI汚染源の主要path参照が標準経路に残っていないことを確認。
- 新Editor placeholderが起動またはbuild可能であることを確認。
- 起動直後UIに禁止文字列が出ないことを、必要なら軽量browser/screenshotで確認。

Forbidden:

- 旧e2eを再導入すること。
- 旧GUI text oracleを新規検証に使うこと。
- GUI未完成を理由に旧GUIを戻すこと。

### G. `wave56-docs-map-cleanup`

Purpose:

- 旧GUI削除後のdocument mapを同期する。
- 旧GUI前提docへの通常導線を消す。
- 新正本として、Purge Policyとscreen-design目標UXを残す。

Allowed write scope:

- `discussion/_map.md`
- `discussion/design/screen-design/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`

Forbidden:

- 旧GUI前提docの温存を前提にしたmap導線。
- unsupported capability claim。
- concept / AC / scenarioの方針変更。

### H. `wave56-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、clean final reviewとfinal reportを記録する。

Allowed write scope:

- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`
- narrow final map/backlog bookkeeping if needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Wave56 passを、headless baselineまたはplaceholder起動確認なしで出すこと。

## 9. Subagent / Orch-Sylph Execution Policy

Wave56起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`し、B/C並列が安全と明示した場合のみ、UndineはDomain B/Cを並列投入してよい。
3. Domain B/Cが`pass`したら、UndineはDomain Dを投入する。
4. Domain Dが`pass`したら、UndineはDomain Eを投入する。
5. Domain Eが`pass`したら、UndineはDomain Fを投入する。
6. Domain Fが`pass`したら、UndineはDomain Gを投入する。
7. Domain Gが`pass`したら、UndineはDomain Hを投入する。
8. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
9. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、tests、UX ACを根拠にレビューする。
10. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
11. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
12. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。`wait` timeoutはpolling timeoutであり、失敗判定ではない。
13. Undineのroot context保護は最優先である。Undineは広域source/diff/test棚卸を自分で実施せず、必要な調査をdomainへ委譲する。

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 10. Review Lanes

Every domain review must check:

- Purge Boundary: 旧GUI/e2e/GUI-doc汚染源が残っていない、またはAのmanifest外として明示されている。
- No Legacy Reuse: 旧 `apps/editor` sourceの再利用判断やcopy/pasteがない。
- Headless Baseline: GUI非依存unit tests、typecheck、標準checkの基準が成立している。
- Script Hygiene: 標準scriptsが旧e2e/focused e2e/testid guardへ戻っていない。
- Fresh UX: 新Authoring Workspace placeholderがscreen-designの目標構造に従う。
- Human UI Cleanliness: 起動直後UIにinternal/debug/evidence/Codex-heavy textが出ない。
- Codex-Friendly Boundary: Editor側に提案・意味推定・自動分類・自動riggingを入れていない。
- Orchestration Compliance: Orch-Sylphが実装せず、Gnome実装とReview-Sylphレビューが分離されている。
- Root Context Protection: Undineが広域source/diff/test棚卸を実施していない。

## 11. Verification Plan

Final verification target set:

- GUI非依存unit tests: A/C/Fが決めた標準コマンド。
- Typecheck: A/C/Fが決めた標準コマンド。
- Standard check: 旧GUI/e2eを含まないこと。
- `rg` or equivalent reference guard for old GUI/e2e standard-path references.
- New editor placeholder build/start smoke if D/E add a browser app.
- `git diff --check -- discussion apps packages scripts package.json pnpm-workspace.yaml tsconfig.json`

No required final verification:

- 旧 `pnpm test:e2e`。
- focused e2e registry。
- Wave42 GUI/e2e quality gate。
- production `data-testid` guard。
- PSD import focused e2e。

These may be physically deleted or removed from standard path by Wave56.

## 12. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- 旧 `apps/editor` 削除がpackages側の非GUIcore削除を要求する。
- GUI非依存unit testsとtypecheckの標準経路を作れない。
- `apps/editor` を消すためにconcept / AC / scenarios / target screen-design docsの削除が必要になる。
- 新Editor placeholderを作る前に、UI library選定などユーザー判断が必要になる。
- 新GUI placeholderに旧GUI source再利用が必要だと判断される。
- 旧e2eを残さないと標準checkが成立しない。
- 削除対象がAのmanifest外へ広がる。

No additional user question is required before starting Wave56 under this plan.

## 13. Pass Criteria

Wave56 passes when:

- 旧 `apps/editor` は物理削除され、その後に必要なら新Editor appとして作り直されている。
- 旧GUI/e2e/GUI改善wave成果物の通常参照導線が削除されている。
- 旧GUI前提ドキュメントは物理削除され、汚染源としてワークスペースに残っていない。
- GUI非依存unit testsが通る。
- typecheckが通る。
- 標準 `check` / scripts / workspace / package設定から旧GUI/e2e/focused e2e/production `data-testid` guard参照が消えている。
- 新Editorを起動またはbuildすると、起動直後にPrimary Workspace Shell placeholderが見える。
- PlaceholderにはApp Bar、Toolbox、Parts / Structure Tree、Canvas / Preview、Inspector、Parameter Bar、Task/View entry pointsがある。
- 起動直後UIに `Task Summary`、raw refs、operation IDs、diagnostics IDs、evidence paths、command payloads、test ids、Codex/debug-heavy panelが表示されない。
- 新GUIは旧 `apps/editor` sourceからのcopy/pasteや再利用判断に基づいていない。
- No Mesh generation, Texture Atlas, Parameter Manager, Variant Manager, full PSD import workflow, renderer/pixel oracle, external transport, semantic recognition, proposal generation, auto-rigging, auto-fix, Cubism compatibility, or public demo asset work is introduced.
- Domain completion reports、Review-Sylph reviews、final integration report、clean review、map/backlog updates are recorded under `discussion/implementation/`.
