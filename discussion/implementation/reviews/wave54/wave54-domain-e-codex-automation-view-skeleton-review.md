# Wave54 Domain E レビュー: Codex / Automation View Skeleton

> Target: `wave54-codex-automation-view-skeleton`
> Role: independent Review-Sylph
> Verdict: `pass`

## 指摘事項

Blocking findings: なし。

Non-blocking findings: なし。

Review observations:

- 実装は `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts` と focused test の追加に留まっており、App Shell final routing、Toolbox enablement、Diagnostics / Evidence、PSD Import polish、generic task-window work へ越境していない。
- Skeleton は read-only / status-only の構造で、interactive control、provider/LLM、transport、proposal generation、auto-fix、auto-commit、semantic recognition、auto-rigging を実装していない。
- Domain E 単体の残リスクは、まだ App Shell へ統合されていないため、実画面 reachability / layout / close-back routing は後続 Domain G/H の検証対象に残る点である。これは Wave54 plan の分担通りで、Domain E の不備ではない。

## レビューレーン

### Design / Development Compliance

`pass`

Codex / Automation View spec は Proposal Review、AI Approval、AI Transcript、Command Surface Status、PSD import / structural scaffold command availability を扱う view として定義している。実装は同じ section set を `codexAutomationSections` として持ち、`proposal-review`、`ai-approval`、`ai-transcript`、`command-surface-status`、`psd-structural-scaffold-availability` を列挙している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:19`）。

Root surface は `section` として作られ、`shellSurfaces.codexAutomationView` の metadata と `codex-automation-skeleton` group を付与している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:83`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:89`）。Header status も "Bounded read-only skeleton" と明示しており、full Codex / Automation View completion を主張していない（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:100`）。

### Codex Policy Compliance

`pass`

Codex-friendly automation policy の禁止事項は、実装内で unavailable / blocked として明示されている。

- Repo/Editor-side proposal generation は unavailable とされ、proposal composer / generator / ranking / smart suggestion / command execution control は present しないと明記されている（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:26`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:27`）。
- Auto-fix と auto-commit は blocked とされている（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:36`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:37`）。
- Embedded provider/LLM、prompt input、model selection、provider settings、transport setup は追加しないと明記されている（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:43`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:46`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:47`）。
- Semantic recognition、auto-rigging、external HTTP/WebSocket/MCP transport は blocked / unavailable とされている（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:56`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:57`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:58`）。
- PSD structural scaffold は explicit PSD tree refs からの deterministic copying として表現され、semantic PSD recognition / automatic layer classification / smart recursive import / automatic rig placement は blocked とされている（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:66`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:67`, `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:68`）。

Active implementation scan では `fetch(`、`new WebSocket`、`WebSocket(`、`EventSource(`、`XMLHttpRequest`、`createServer(`、`listen(`、`addEventListener`、`onclick`、interactive element creation、`new OpenAI` は検出されなかった。広い禁止語 scan は "unavailable / blocked" の説明文を拾うだけで、active provider / transport / auto-execution 実装は確認されなかった。

### Parallel Ownership / Integration Boundary

`pass`

Domain A の ownership matrix では Domain E は `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts` と matching test のような narrowly named Codex / Automation skeleton を所有し、App Shell final routing、Toolbox route enablement、Diagnostics / Evidence content、proposal generation、LLM/provider、external transport を所有しない。

今回の skeleton は `createCodexAutomationViewSkeleton()` を export するだけで、App Shell へ mount していない（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts:83`）。Repository scan でも `createCodexAutomationViewSkeleton` の参照は同 source file と test file だけであり、`apps/editor/src/app/editor-app.ts`、`apps/editor/src/ui/app-shell/app-shell.ts`、`apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts` への final route wiring はなかった。

既存 App Shell には legacy Codex panels の `shellSurfaces.codexAutomationView` metadata が残るが、これは Domain A report の current surface inventory と一致する既存分類であり、Domain E が panel migration や final integration を行った形跡ではない。

### Test Adequacy

`pass`

Focused unit tests は Domain E のリスクに対して十分である。

- Root surface metadata、aria labels、read-only skeleton wording、interactive element absence を検証している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts:15`）。
- Required navigation sections と section map order を検証している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts:30`）。
- Automation policy boundary、blocked capabilities、external Codex/LLM ownershipを検証している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts:49`）。
- PSD structural command availability が explicit / deterministic で、automatic layer classification が blocked の文脈にあることを検証している（`apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts:65`）。

この test は skeleton の構造と policy boundary に集中しており、App Shell reachability や Toolbox enablement を検証していない。これは G/H 所有の integration / regression scope であり、Domain E の focused test としては適切である。

### Source Organization

`pass`

New production source file は Codex / Automation View skeleton という単一責務にまとまっており、`index.ts` 実装、catch-all file、shared broad utility 追加はない。Test file も対象 component の focused unit test と minimal DOM fake に限られている。

`node scripts/check-source-organization.mjs --source-root apps/editor/src/ui/app-shell` は pass した。

## Verification

- Read basis documents:
  - `discussion/implementation/orchestration/wave54-plan.md`
  - `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`
  - `discussion/implementation/reviews/wave54/wave54-domain-a-boundary-current-surface-inventory-review.md`
  - `discussion/design/codex-friendly-automation-policy.md`
  - `discussion/design/screen-design/screens/codex-automation-view.md`
  - `discussion/design/screen-design/screens/authoring-workspace.md`
  - `discussion/development_convention/source-file-organization-policy.md`
- Reviewed target source/test files with line references:
  - `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts`
  - `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts`
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts`
  - Initial sandbox run failed with `spawn EPERM` while loading Vite/esbuild config.
  - Escalated rerun passed: 1 file, 4 tests.
- `node scripts/check-source-organization.mjs --source-root apps/editor/src/ui/app-shell`: pass.
- `node scripts/check-production-testid-boundary.mjs --source-root apps/editor/src/ui/app-shell`: pass.
- `rg` scan for active transport / provider / interactive execution constructs in `codex-automation-view-skeleton.ts`: no active implementation matches.
- `rg` scan for `createCodexAutomationViewSkeleton` usage under `apps/editor/src`: only source/test references; no App Shell final routing.
- `rg -n '[ \t]$'` over the two target files: no trailing whitespace matches.
- `git diff --check -- apps/editor/src/ui/app-shell/codex-automation-view-skeleton.ts apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts`: no output. Because the files are currently untracked, direct trailing-whitespace scan above was used as the meaningful whitespace check.

## User-Decision Points

なし。

Escalation が必要になるのは、後続 integration が full Codex / Automation View implementation、proposal generation、semantic recognition、auto-rigging、auto-fix、auto-commit、embedded provider/LLM、external HTTP/WebSocket/MCP transport、または App Shell final routing を Domain E に戻す必要があると判明した場合である。

## Verdict

`pass`

Domain E は Wave54 の Codex / Automation View skeleton として受領可能である。実装は read-only / status-only skeleton に留まり、Codex automation policy と Domain A の parallel ownership boundary を満たしている。
