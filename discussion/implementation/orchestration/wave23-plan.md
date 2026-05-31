# Wave 23 Plan: Minimum Open Dynamics v1 Vertical Slice

> Wave 23 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 23
- Wave name: `minimum-open-dynamics-v1-vertical-slice`
- Primary objective: Current MVP の未達である Minimum Open Dynamics v1 を、authoring operation -> runtime/evidence -> validator -> editor preview -> save/load smoke の一周で implementation-proven にする。

## 2. 次Wave選定

Wave 20-21 は PSD を parser-free adapter/profile source として扱う契約・永続化・UI投影を固めた。Wave 22 は package-local binary asset reference/storage metadata boundary を固めた。ただし、real PSD parser、file picker、archive import/export、image decode、actual binary upload はいずれもまだ設計判断が必要で、次に当然実装してよい対象ではない。

一方、AC / scenario / design / implementation の照合では、Minimum Open Dynamics v1 が Current MVP に含まれているにもかかわらず、operation lifecycle 上は dynamics 系 operation が未登録または unsupported のままで、GUI authoring -> runtime preview -> validator evidence の製品ワークフロー証拠が不足している。

そのため Wave 23 は、外部依存や実ファイルI/Oに踏み込まず、既存の package schema / runtime state / preview foundation を使って、最小の deterministic dynamics workflow を通す。

- Minimal dynamics group を authoring / operation lifecycle に追加する。
- Runtime が deterministic に dynamics state / computed output を評価し、snapshot / diff / evidence に残す。
- Validator が dynamics semantic checks を出す。
- Editor で dynamics group を作成し、preview reset/run の最小UXを持つ。
- Browser save/load と e2e smoke で確認する。

これは Cubism Physics 互換や高度な物理simulationではない。Private Prototype のための最小で説明可能な Open Dynamics v1 の縦切りである。

## 3. Undine コンテキスト保護の復元規約

Wave 23 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 22 は `Completed / implementation-proven`。
- Wave 22 は real asset I/O boundary foundation を実装済みだが、actual file picker / archive import-export / binary upload / image decode は未実装。
- `operationTypes` には dynamics / rig / mask 系が存在するが、operation registry 上の dynamics workflow はまだ製品ワークフローとして未実装または unsupported。
- Runtime は keyform 1D/Grid2D、runtime state、runtime snapshot、dynamics state/snapshot foundation を持つ。
- Editor は embedded preview、createDrawable / generateMesh、source intake、save/load、operation/evidence panels を持つ。
- Validator は rights/source/PSD/binary の evidence は強くなったが、dynamics semantic checks は設計ほど広くない。
- Current MVP 上は Minimum Open Dynamics v1、viewer/preview確認、validator evidence が残る大きな未達領域である。

## 5. Design Decisions

- Wave 23 は Minimum Open Dynamics v1 の vertical slice に限定する。
- Dynamics は deterministic runtime sequence として評価する。randomness、wall-clock依存、browser frame timing依存は禁止。
- 最初の対象は parameter-driven output dynamics に絞る。hair / accessory / cloth を表現する名前は使ってよいが、Cubism Physics互換とは主張しない。
- Runtime evidence は operation result / snapshot / diff / validator report から追跡できるようにする。
- Editor は minimal controls に限定する。full graph editor、timeline editor、collision editor、automatic tuning は扱わない。
- Existing keyform / preview / persistence workflow を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- Cubism Physics compatibility。
- Direct vertex physics / cloth simulation / collision / IK。
- Direct rigControl physics output。
- Timeline bake、animation editor、motion export。
- AI automatic dynamics tuning。
- Real PSD parser、file picker、archive import/export、actual binary upload。
- New external dependency。
- Standalone private viewer app。
- Mask/clipping full workflow、rig control full evaluator。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/reviews/wave22/wave22-clean-integration-review.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約や設計全文を自分で読み込まない。詳細規約と設計は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Dynamics workflow は operation / authoring の入口が shared bottleneck になる。Domain A が pass するまで runtime / validator / editor は開始しない。Domain A 後は runtime evidence と validator semantic checks を並列化し、両方が pass したら editor UX と fixtures/evidence を並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Dynamics authoring mutation and operation handlers | Solo | Wave 22 complete | minimal dynamics group を authoring session と operation lifecycle に追加する |
| 2 | B. Runtime dynamics sequence, diff, and evidence | Parallel with C | A | deterministic dynamics evaluation / snapshot / diff / evidence を固める |
| 2 | C. Validator dynamics semantic checks | Parallel with B | A | dynamics group / parameter relation / runtime evidence diagnostics を固める |
| 3 | D. Editor dynamics panel and preview run UX | Parallel with E | B + C | editor から dynamics group を作成し preview reset/run を確認できるようにする |
| 3 | E. Dynamics fixtures and contract evidence | Parallel with D | B + C | package / operation / runtime / validator evidence fixture を固定する |
| 4 | F. Dynamics e2e and persistence smoke | Solo | D + E | browser save/load / preview / validation smoke を確認する |
| 5 | G. Integration review and final report | Solo | F | final verification、clean integration review、map更新、final report |

安全上の制約:

- A は operation-core / authoring-core の dynamics operation foundation を独占する。
- B は runtime-core と operation evidence integration を担当し、editor UIには触らない。
- C は validator-core を担当し、operation handlerには触らない。
- D は editor workflow/UI を担当し、runtime/validator broad implementation には触らない。
- E は fixtures/contracts と fixture tests を担当し、editor UIには触らない。
- F は e2e / smoke に限定する。広い source fix が必要なら該当 domain へ差し戻す。

## 9. Domain Assignments

### A. `wave23-dynamics-authoring-operation-foundation`

Purpose:

- Minimal Open Dynamics v1 の authoring mutation と operation handler を追加する。
- `createDynamicsGroup` または既存 operation type に沿った dynamics creation/update path を supported operation にする。
- Dry-run / commit / operation log / model diff / package materialization の最低限を通す。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused operation / authoring tests
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- Editor UI implementation
- External dependency
- Cubism Physics compatibility claim
- `index.ts` implementation logic

Pass evidence:

- Dynamics group create dry-run / commit succeeds.
- Unsupported lifecycle test is updated to reflect supported operation where appropriate.
- Operation evidence can identify dynamics target parameters.
- Existing operations remain compatible.

Early escape:

- Existing dynamics schema is insufficient and requires contract redesign beyond one wave.
- Operation semantics conflict with MVP design docs.

### B. `wave23-runtime-dynamics-sequence-diff-evidence`

Purpose:

- Minimal dynamics evaluation を deterministic runtime sequence として実装する。
- Runtime snapshot / diff / evidence に dynamics state、input/output parameter relation、computed output を残す。
- Preview が使える runtime projection を提供する。

Write scope:

- `packages/runtime-core/src/**`
- operation evidence helper files only if needed for runtime evidence wiring
- focused runtime / operation evidence tests
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Editor UI implementation
- Validator broad implementation
- Authoring operation handler changes outside narrow integration fixes
- Direct vertex physics
- Non-deterministic timing dependency

Pass evidence:

- Same input sequence yields same dynamics output.
- Runtime snapshot includes dynamics evidence without requiring a viewer app.
- Runtime diff exposes dynamics-relevant changes.
- Existing keyform runtime tests remain compatible.

Early escape:

- Dynamics semantics require product decision on solver behavior.
- Runtime evidence cannot represent computed output without contract redesign.

### C. `wave23-validator-dynamics-semantic-checks`

Purpose:

- Dynamics group / parameter relation / runtime evidence の validator checks を追加する。
- Missing target parameter、invalid source parameter、unstable output、runtime evidence gap を AI-readable diagnostics として出す。
- Check catalog / validator contract drift を可能な範囲で整える。

Write scope:

- `packages/validator-core/src/**`
- validator focused tests
- validator contract docs only if small and directly tied to new check IDs
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad validator report redesign

Pass evidence:

- Valid minimal dynamics package validates.
- Invalid dynamics relation produces deterministic diagnostics.
- Runtime evidence gap is visible.
- Existing source/binary/PSD validators remain compatible.

Early escape:

- Validator severity policy for dynamics requires user decision.
- Check catalog alignment requires broad documentation rewrite.

### D. `wave23-editor-dynamics-panel-preview-run-ux`

Purpose:

- Editor に minimal Dynamics panel / workflow を追加する。
- User can create a minimal dynamics group, run/reset preview sequence, and see computed output/evidence.
- UI は deterministic open dynamics として説明し、Cubism Physics互換とは主張しない。

Write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/ui/**`
- focused editor tests
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O
- Full graph/timeline/collision editor
- Broad app shell redesign

Pass evidence:

- Dynamics group can be created from editor UI.
- Preview reset/run updates projected dynamics output.
- Save/load restores dynamics workflow state where applicable.
- Accessible labels and mobile layout remain coherent.

Early escape:

- UI requires broad navigation redesign.
- Preview behavior cannot be expressed without runtime changes beyond Domain B.

### E. `wave23-dynamics-fixtures-contract-evidence`

Purpose:

- Minimal dynamics fixture を追加し、operation result、runtime snapshot/diff、validation report、editor evidence の contract evidence を固定する。
- Dynamics vertical slice が AC-MVP-010/012/013 にどう接続するかを fixtureで示す。

Write scope:

- `fixtures/contracts/**`
- focused fixture tests under package / operation / runtime / validator packages
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- External dependency
- Real asset bytes or PSD/parser fixtures

Pass evidence:

- Fixture proves dynamics operation -> runtime evidence -> validator report.
- Expected outputs are deterministic.
- Existing fixtures remain compatible.

Early escape:

- Fixture requires undefined dynamics semantics.
- Expected runtime evidence cannot be made deterministic.

### F. `wave23-dynamics-e2e-and-persistence-smoke`

Purpose:

- Browser smoke で dynamics group creation -> preview run/reset -> save/load -> validation/evidence を確認する。
- Desktop / mobile viewport と accessibility basics を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser work

Pass evidence:

- Dynamics workflow passes desktop/mobile smoke.
- Save/load preserves dynamics group and preview-relevant state.
- Existing PSD/binary/source intake e2e does not regress.

Early escape:

- E2E reveals broad UI architecture issue.
- Dynamics state cannot persist without package contract change.

### G. `wave23-integration-review-and-final-report`

Purpose:

- Domain A-F completion reports を統合し、final verification と clean integration review を行う。
- Wave23 final report、current capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave23/**`
- `discussion/implementation/reviews/wave23/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Source code edits。source fix が必要な場合は該当 domain へ差し戻す。

Pass evidence:

- Final verification が typecheck / unit / e2e / source guard / diff check を含む。
- Clean integration review が dynamics semantics、runtime evidence、validator evidence、UI/e2e、orchestration compliance を確認する。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 23 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C が `pass` したら、Undine は Domain D / E の Orch-Sylph を並列投入する。
4. Domain D / E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
5. Domain F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Dynamics Semantics: deterministic で説明可能な Minimum Open Dynamics v1 か。
- Operation Integrity: dry-run / commit / operation log / evidence が coherent か。
- Runtime Evidence: snapshot / diff / computed output が追跡可能か。
- Validator Evidence: dynamics semantic diagnostics が AI-readable か。
- UI / Accessibility: editor workflow が truthful で、desktop/mobile layout と label が破綻していないか。
- Persistence: save/load 後に dynamics group と preview-relevant state が残るか。
- Non-Goals: Cubism Physics互換、direct vertex physics、asset I/O、file picker、external dependency に逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: operation-core / authoring-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core focused tests、runtime diff/evidence tests、typecheck
- Domain C: validator focused tests、check catalog alignment tests
- Domain D: editor state / workflow / UI focused tests、editor typecheck
- Domain E: fixture / contract focused tests
- Domain F: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain G: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave23 scope>`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / external dependency / Cubism compatibility claim

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Dynamics solver semantics が複数候補に分かれ、製品判断が必要。
- Existing package / runtime dynamics schema と MVP design が矛盾する。
- Runtime evidence に computed output を表現できず contract redesign が必要。
- Editor UX が full graph/timeline editor を要求する。
- Validator severity policy が未決で実装が進められない。
- External dependency、file picker、asset I/O、Cubism compatibility が必要になる。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、minimal deterministic dynamics group / operation / runtime evidence / validator / editor preview / e2e に限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave 23 は次を満たしたとき pass とする。

- Minimal dynamics group を authoring operation として dry-run / commit できる。
- Runtime が deterministic dynamics output を snapshot / diff / evidence に残せる。
- Validator が dynamics semantic checks を deterministic diagnostics として出せる。
- Editor から dynamics group を作成し、preview reset/run で出力を確認できる。
- Save/load と desktop/mobile e2e smoke が通る。
- Existing PSD / binary / source intake / keyform workflows を壊していない。
- No external dependency、no asset I/O expansion、no Cubism Physics compatibility claim。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
