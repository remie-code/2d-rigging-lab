# Wave 14 Plan: Editor Embedded Preview Foundation

> Wave 14 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 14
- Wave name: `editor-embedded-preview-foundation`
- Primary objective: Wave 13 で固めた runtime snapshot / diff / Grid2D evidence を、editor 内のユーザー可視 preview と parameter controls に接続する。

## 2. Wave 14 の主目的

Wave 13 までで、package / authoring / operation / runtime / validation / AI command / evidence の基盤はかなり揃った。一方で、ユーザーが editor 上で「parameter を動かすと drawable / mesh / opacity / visibility / draw order がどう変わるか」を確認する surface はまだない。

Wave 14 は、Standalone Private Viewer へ飛ぶ前の最小で堅い product slice として、editor に embedded preview を追加する。目的は本格 renderer を作ることではなく、既存 runtime evaluation の結果を editor 画面で deterministically 観測できるようにすること。

この wave の pass 後、ユーザーは browser editor 上で preview-ready sample package を開き、parameter slider を動かし、runtime snapshot 由来の visual / diagnostic / sample summary を確認できる。

## 3. Undine コンテキスト保護の復元規約

Wave 14 でも、Undine が詳細実装コンテキストを直接抱え込まないことを明示的な制約にする。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は原則として Gnome / Review-Sylph を直接起動しない。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、Orch-Sylph の completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- この節は context compaction 後に orchestration skill の内容が薄れた場合の復元規約であり、Wave 14 起動時に必読とする。

## 4. Repository Facts

- Wave 13 final report により、runtime diff dedicated fields、Grid2D evidence / fixture、AI/editor `addKeyformGrid2d` runtime-visible evidence は pass 済み。
- `apps/editor` は Vite + vanilla TypeScript の browser editor で、現在は package/project persistence、operation log、evidence panel、AI approval/transcript を持つ。
- `apps/editor/src/ui/app-shell/app-shell.ts` は現状 editor shell を構成するが、preview panel はない。
- `apps/editor/src/editor-state/editor-view-model.ts` と `apps/editor/src/editor-state/editor-semantic-state.ts` は package / operation / evidence / AI 状態を持つが、preview-only parameter values や preview snapshot summary は持たない。
- `apps/editor/src/editor-workflow/workflow-controller.ts` は create parameter、project save/load/reset、AI dry-run/approval を扱うが、preview parameter update は扱わない。
- `apps/editor/src/editor-session/browser-sample-package.ts` の sample package は現状 preview-ready な parameter / keyform を十分に含まず、slider-driven visual change の oracle として弱い。
- Public `index.ts` は barrel-only を維持する必要がある。preview 実装を巨大な `index.ts` や catch-all file に寄せてはいけない。

## 5. Design Decisions

- Wave 14 は editor embedded preview foundation を扱う。Standalone Private Viewer app は future scope に残す。
- Preview は runtime snapshot 由来の状態を表示する。UI 側で runtime semantics を再実装した fake preview を作らない。
- Rendering は本格 renderer ではなく、runtime snapshot / evaluated drawable geometry から作る simple deterministic preview でよい。SVG / canvas のどちらでもよいが、Domain D が既存 UI 構造に合う最小実装を選ぶ。
- Preview parameter values は preview-only UI state とし、operation log や package file set へ勝手に永続化しない。package load/reset 時は document default へ戻す。
- Preview-ready sample package は Wave 14 の visible workflow oracle とする。少なくとも 1 つ以上の parameter slider が runtime-visible drawable / mesh / opacity / visibility / draw order 変化を起こすこと。
- UI は existing editor shell の作業画面として追加する。landing page や marketing hero は作らない。
- Source files は単一責務に分け、preview projection、preview state、preview UI、sample package、e2e verification を混ぜない。

## 6. Non-Goals

- Standalone Private Viewer app は作らない。
- Full renderer、texture pipeline、PSD import、split PNG import、mesh editing UI は扱わない。
- Drawable / mesh authoring workflow の本格 GUI は扱わない。
- Mask / rigControl / dynamics authoring UI は扱わない。
- 外部 HTTP / WebSocket / MCP transport は扱わない。
- LLM provider integration は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave14-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave13/wave13-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 13 の completion / review / integration report

Undine はすべての設計規約・実装規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Wave 14 は editor preview の foundation を先に作り、その後 sample と workflow state を並列で固め、最後に UI / e2e / integration を直列 gate にする。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. preview runtime projection foundation | Solo | Wave 13 complete | runtime snapshot を editor preview view model へ変換する基盤を作る |
| 2 | B. preview-ready sample package | Parallel with C | A | slider-driven visual change を持つ sample package を作る |
| 2 | C. preview controls and workflow state | Parallel with B | A | preview-only parameter values と controller actions を作る |
| 3 | D. embedded preview panel UI | Solo | B + C | editor shell に preview panel / sliders / diagnostics を接続する |
| 4 | E. preview e2e and accessibility smoke | Solo | D | desktop/mobile smoke、slider visual change、basic a11y を検証する |
| 5 | F. integration review and final report | Solo | E | clean integration review、修正反映、final report を完了する |

Batch 2 だけを並列化する。UI integration は app shell / workflow wiring の衝突が起きやすいため、Domain D に集約する。

## 9. Domain Assignments

### A. `wave14-preview-runtime-projection-foundation`

Purpose:

- Runtime snapshot / diff / diagnostics を editor preview 用の小さな projection に変換する。
- UI に渡す preview DTO を作り、geometry / bounds / draw order / visibility / opacity / keyform sample count を deterministically 表現する。
- Preview rendering が runtime semantics を再実装しないよう、runtime-core 由来の評価結果を唯一の source of truth にする。

Write scope:

- `apps/editor/src/editor-preview/**`
- `apps/editor/src/editor-preview/*.test.ts`
- `apps/editor/src/editor-state/*preview*` は projection type の最小追加のみ可
- `apps/editor/src/editor-workflow/*preview*` は projection helper の最小追加のみ可

Pass evidence:

- sample runtime snapshot から preview DTO を生成する focused test がある。
- draw order / visibility / opacity / bounds / keyform sample summary が stable に並ぶ。
- preview DTO は DOM に依存しない。
- barrel-only `index.ts` を崩さない。

Early escape:

- editor から runtime-core を利用するために package dependency 構成の大幅変更が必要になる場合。
- runtime snapshot に preview 表現に必要な最低限の geometry が不足しており、runtime-core contract の設計判断が必要になる場合。

### B. `wave14-preview-ready-sample-package`

Purpose:

- Browser editor 初期 sample を preview workflow の oracle として使える状態にする。
- 少なくとも 1 つ以上の parameter と keyform を持ち、slider を動かすと runtime-visible visual change が発生する package にする。
- Grid2D は可能なら含める。ただし sample が過大になる場合は 1D keyform を優先し、Grid2D は後続に残す。

Write scope:

- `apps/editor/src/editor-session/browser-sample-package.ts`
- `apps/editor/src/editor-session/browser-sample-package.test.ts`
- 必要最小限の fixture / expected snapshot test

Pass evidence:

- sample package が既存 package parser / validator / runtime evaluation を通る。
- parameter default / min / max / current value が slider に使える。
- runtime evaluation で mesh geometry、opacity、visibility、または draw order のいずれかが変化する。
- sample package は private prototype 用であり、Cubism format や external asset dependency を持たない。

Early escape:

- preview-ready sample を作るために mesh / drawable schema の追加設計が必要になる場合。
- sample package が大きくなり、fixture としてレビュー困難になる場合。

### C. `wave14-preview-controls-and-workflow-state`

Purpose:

- Editor semantic state に preview-only parameter values を追加する。
- Workflow controller に preview parameter set / reset actions を追加する。
- Package load / reset / save の既存 flow と preview state の関係を明確化する。

Write scope:

- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/*preview*.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- focused editor workflow tests

Pass evidence:

- preview parameter value update が package document を直接 mutate しない。
- package load/reset 時に preview values が document defaults へ戻る。
- view model に slider 表示に必要な label / range / value / disabled state がある。
- existing createParameter / project persistence / AI approval tests が壊れない。

Early escape:

- preview values を package persistence に含めるべきか設計判断が必要になる場合。
- existing editor state shape が preview state を足すには不安定で、大きな state redesign が必要になる場合。

### D. `wave14-embedded-preview-panel-ui`

Purpose:

- Editor shell に preview panel を追加する。
- Runtime projection DTO と preview controls を使って、parameter sliders、reset control、simple visual preview、diagnostic / sample summary を表示する。
- Desktop / mobile の既存 editor layout に自然に収める。

Write scope:

- `apps/editor/src/ui/preview-panel/**`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/**`
- `apps/editor/src/editor-state/editor-test-ids.ts` または既存 test id helper
- focused UI tests

Pass evidence:

- Editor first screen に preview panel が表示される。
- Slider 操作で preview visual または snapshot summary が変化する。
- Hidden drawable / opacity / draw order がある場合、preview 表現と summary が矛盾しない。
- Compact panels / controls の text overflow や incoherent overlap がない。
- UI card nesting を増やさず、既存 editor shell の密度に合う。

Early escape:

- Existing shell layout が preview panel を入れるには大幅な redesign を要求する場合。
- Runtime DTO から安全に描画できる geometry がなく、UI が fake preview になってしまう場合。

### E. `wave14-preview-e2e-and-accessibility-smoke`

Purpose:

- Preview workflow を browser-level smoke で固定する。
- Desktop / mobile viewport で preview panel が表示され、slider 操作により visual / summary が変化することを検証する。
- Basic accessibility と keyboard control の regression を追加する。

Write scope:

- `apps/editor/src/**/*.test.ts` の preview/UI focused tests
- `scripts/**editor*e2e*.mjs` または既存 e2e script
- `apps/editor/**e2e**` が既存 convention に合う場合のみ
- discussion completion / review reports

Pass evidence:

- `pnpm test:e2e` または既存 editor e2e command で preview smoke が走る。
- Desktop / mobile viewport の両方で preview panel が layout 破綻しない。
- Slider 操作で deterministic な DOM attribute / text / visual state の変化を検証する。
- a11y smoke で slider label、button name、preview region name が確認できる。

Early escape:

- Current e2e harness が preview visual change を安定検証できず、testing strategy の再設計が必要になる場合。
- Browser automation / screenshot verification が sandbox 制約で実行できない場合。

### F. `wave14-integration-review-and-final-report`

Purpose:

- Domain A-E の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 14 final report と maps を更新する。

Write scope:

- `discussion/implementation/waves/wave14/**`
- `discussion/implementation/reviews/wave14/**`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- integration review が UI / runtime / state / source organization / test adequacy を含む。
- final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 14 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 14 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C がどちらも `pass` したら、Undine は Domain D を Orch-Sylph に委譲する。
4. Domain D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
5. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は domain 内で Gnome 実装と Review-Sylph レビューを分離し、needs_fix loop を自分の domain 内で閉じる。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

Orch-Sylph への domain assignment には必ず次を含める。

- target / wave / dependency
- allowed write scope
- forbidden write scope
- basis docs
- required tests
- review lanes
- completion report path
- early escape condition
- `discussion/development_convention/source-file-organization-policy.md`

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Runtime Truthfulness: preview が runtime snapshot / diff / diagnostics 由来であり、UI fake semantics になっていないか。
- Product Workflow: user が sample package を開き、parameter を動かし、visible result を確認できるか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / workflow / UI / e2e が domain risk に見合うか。
- Determinism: snapshot projection、draw order、slider effect、diagnostic summary が deterministic か。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: editor-preview focused tests、editor typecheck
- Domain B: sample package parsing / runtime evaluation focused tests
- Domain C: editor state / workflow focused tests
- Domain D: preview panel focused UI tests、editor typecheck
- Domain E: editor e2e smoke、a11y smoke
- Domain F: `pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- .`
- untracked file whitespace check if new fixtures/reports are untracked

Frontend 変更を含むため、可能なら final integration で local editor を起動し、desktop/mobile viewport の preview screenshot または browser smoke を記録する。

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Preview として表示できる runtime geometry が不足し、runtime-core contract 変更が必要になる。
- Preview state を package persistence に保存するかどうかの product decision が必要になる。
- Existing editor layout の大幅 redesign が必要になる。
- Full renderer / texture pipeline がないと visible preview として成立しない。
- Sample package を rights-clean / private prototype fixture として維持できない。
- E2E / browser verification が現在の sandbox で安定実行できない。

## 14. Pass Criteria

Wave 14 は次を満たしたとき pass とする。

- Editor 内に embedded preview panel があり、runtime snapshot 由来の visual / summary を表示できる。
- Preview-ready sample package があり、parameter slider によって runtime-visible change が発生する。
- Preview-only parameter state は package / operation log を勝手に mutate しない。
- Desktop / mobile の browser smoke で preview panel と slider interaction が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
