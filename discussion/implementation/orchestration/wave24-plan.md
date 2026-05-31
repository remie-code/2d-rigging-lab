# Wave 24 Plan: Private Viewer v0 Runtime Inspection Surface

> Wave 24 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 24
- Wave name: `private-viewer-v0-runtime-inspection-surface`
- Primary objective: 保存済み package / active document を viewer 文脈で runtime inspection できる editor 内 Viewer / Runtime surface を作り、parameter override、runtime snapshot / diff、validation diagnostics、preview-vs-viewer equivalence smoke を一周で implementation-proven にする。

## 2. 次Wave選定

Wave 23 で Minimum Open Dynamics v1 は、authoring operation、runtime evidence、validator diagnostics、editor preview run/reset、fixture、desktop/mobile persistence smoke まで通った。

次の候補は PSD 実読み込み、Rig control、advanced dynamics、viewer/preview 拡張に分かれる。PSD 実読み込みは file picker / parser / decode / archive / dependency approval が必要で、Wave 24 の安全な既定候補ではない。Rig control は重要だが、runtime behavior を人間が確認する viewer surface が弱いまま進めると preview-only evidence に寄りやすい。Advanced dynamics は Wave 23 の最小 Open Dynamics を超え、Cubism Physics 互換や direct vertex physics へ誤って広がるリスクがある。

そのため Wave 24 は、外部依存や実ファイルI/Oを増やさず、既存 runtime / validator / editor / persistence foundation を使って Private Viewer v0 を実装する。

- 同一 editor app 内に Viewer / Runtime tab または同等の runtime inspection surface を追加する。
- 保存済み package / active document から viewer 文脈の runtime snapshot を作る。
- Viewer 上で parameter override を操作し、runtime snapshot / diff / validation diagnostics を確認できる。
- Editor embedded preview と Viewer の結果を summary / targeted snapshot で比較できる。
- Browser save/load と desktop/mobile e2e smoke で確認する。

これは standalone viewer app、full renderer、WebGL/canvas renderer、actual texture decode、archive/file I/O ではない。Private Prototype の中で viewer runtime behavior を inspection できる最小 surface である。

## 3. Undine コンテキスト保護規約

Wave 24 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source implementation は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 23 は `Completed / implementation-proven`。
- Editor embedded preview は存在し、parameter/keyform/drawable/mesh/source/dynamics の runtime-derived visual / summary を持つ。
- Standalone private viewer app は未実装。Wave 24 では standalone app ではなく、同一 editor app 内の Viewer / Runtime surface として進める。
- Runtime-core は runtime state、snapshot、diff、keyform evaluation、dynamics evaluation を持つ。
- Validator-core は package/runtime evidence、source/PSD/binary/dynamics diagnostics を持つ。
- Browser-local save/load、operation log hydration、desktop/mobile e2e smoke 基盤は存在する。
- Real PSD parser、image decode、actual binary upload、archive import/export、OS/browser file picker、external dependency addition は未実装で、Wave 24 では扱わない。

## 5. Design Decisions

- Wave 24 は Private Viewer v0 を editor 内 runtime inspection surface として実装する。
- Viewer surface は editor embedded preview と別の確認文脈を持つが、同一 app 内に置く。standalone app 分割は future scope。
- Viewer evaluation は deterministic で、wall-clock / browser frame timing に依存しない。
- Parameter override は viewer session state として扱い、authoring operation と混同しない。
- Save/load 後に authored package から viewer snapshot を再計算できることを確認する。preview evidence の永続化を必須にしない。
- Preview-vs-Viewer 一致は、まず summary と targeted snapshot 比較に限定する。pixel-perfect renderer oracle は future scope。
- Existing editor preview / source intake / dynamics / keyform workflows を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- Standalone private viewer app。
- WebGL / canvas full renderer、pixel-level render oracle。
- Actual PSD parser、PNG/PSD/image decode、raster extraction。
- File picker、drag/drop upload、archive import/export、filesystem I/O、actual binary upload。
- New external dependency。
- Cubism SDK/Core、Cubism Viewer compatibility、Cubism Physics compatibility。
- Rig control full authoring/runtime vertical slice。
- Advanced dynamics graph/timeline/collision/IK/cloth simulation。
- Timeline animation editor、motion export、demo capture surface。
- AI repair / natural language command expansion。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave24-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave23/wave23-final-report.md`
- `discussion/implementation/reviews/wave23/wave23-clean-integration-review.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/validator-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約や設計全文を自分で読み込まない。詳細規約と設計は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Viewer workflow は viewer 文脈の runtime evaluation / session contract が shared bottleneck になる。Domain A が pass するまで UI / validator / equivalence fixture は開始しない。Domain A 後は、UI surface、validator/report integration、preview-vs-viewer fixture を並列化できる。E2E は UI と fixture がそろってから単独で実行し、最後に統合レビューを行う。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Viewer evaluation foundation | Solo | Wave 23 complete | active document / saved package から viewer runtime snapshot / diff / parameter override を作る基盤 |
| 2 | B. Viewer UI surface | Parallel with C/D | A | editor 内 Viewer / Runtime surface、parameter sliders、snapshot/diff/diagnostics表示 |
| 2 | C. Viewer validator and report integration | Parallel with B/D | A | viewer load/evaluation diagnostics、validation report refs、AI-readable report integration |
| 2 | D. Preview-vs-Viewer equivalence fixtures | Parallel with B/C | A | keyform/drawable/dynamics の同一入力で preview/viewer summary または targeted snapshot 比較を固定 |
| 3 | E. Viewer e2e and persistence smoke | Solo | B + C + D | save/load -> Viewer open -> parameter操作 -> snapshot/diagnostics/equivalence smoke |
| 4 | F. Integration review and final report | Solo | E | final verification、clean integration review、map更新、final report |

安全上の制約:

- A は runtime-core と viewer session adapter の入口を担当し、UI 表示を作り込まない。
- B は editor UI / workflow を担当し、runtime evaluator / validator の広範実装に触らない。
- C は validator-core と report integration を担当し、UI broad implementation に触らない。
- D は fixtures/contracts と snapshot comparison tests を担当し、editor UI に触らない。
- E は e2e / smoke に限定する。広い source fix が必要なら該当 domain へ差し戻す。
- F は report/map/review 統合を担当する。source fix が必要なら小さな integration fix を Gnome に委譲し、Review-Sylph で再レビューする。

## 9. Domain Assignments

### A. `wave24-viewer-evaluation-foundation`

Purpose:

- 保存済み package / active document から viewer 文脈の runtime snapshot を作る foundation を追加する。
- Viewer session の parameter override を RuntimeState に適用し、snapshot / diff / evidence を deterministic に得る。
- `surface: "viewer"` 相当の evidence または report metadata を残せる形にする。

Write scope:

- `packages/runtime-core/src/**`
- narrow editor session adapter files under `apps/editor/src/editor-session/**` if needed
- focused runtime/editor-session tests
- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`

Forbidden:

- Editor UI surface implementation
- Validator broad implementation
- File picker / parser / archive / image decode / actual binary upload
- External dependency
- Standalone viewer app
- `index.ts` implementation logic

Pass evidence:

- Same package + same parameter override yields same viewer snapshot.
- Parameter override changes viewer snapshot/diff deterministically.
- Existing editor preview/runtime tests remain compatible.
- Viewer evaluation can consume Wave 23 dynamics output without Cubism Physics claims.

Early escape:

- Viewer context requires package schema redesign beyond one wave.
- Runtime semantics conflict between editor preview and viewer.
- Parameter override policy requires user decision.

### B. `wave24-editor-viewer-runtime-surface`

Purpose:

- Editor 内に Viewer / Runtime surface を追加する。
- Viewer parameter sliders、runtime snapshot summary、runtime diff、validation diagnostics、package identity / save-load state を表示する。
- Existing embedded preview と混同しないが、同一 app 内で遷移できるようにする。

Write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/ui/**`
- focused editor tests
- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- Full app shell redesign
- File picker / parser / image decode / actual binary upload
- Standalone viewer app
- External dependency

Pass evidence:

- User can open Viewer / Runtime surface inside editor.
- Parameter slider changes update viewer snapshot summary.
- Snapshot / diff / diagnostics are visible and truthful.
- Desktop/mobile layout and accessible labels remain coherent.

Early escape:

- UI requires broad navigation redesign.
- Viewer UI cannot be expressed without runtime changes beyond Domain A.
- Validation display requires a report contract redesign beyond Domain C.

### C. `wave24-viewer-validator-report-integration`

Purpose:

- Viewer load/evaluation context の diagnostics と report references を整える。
- Viewer runtime snapshot / diff / validation report を AI-readable に参照できるようにする。
- Existing validator checks を壊さず、viewer-specific evidence gap を必要最小限で扱う。

Write scope:

- `packages/validator-core/src/**`
- validator/report focused tests
- validator contract docs only if small and directly tied to new check IDs
- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`

Forbidden:

- Editor UI implementation
- Runtime evaluator implementation
- Broad validator report redesign
- File picker / parser / image decode / actual binary upload
- External dependency

Pass evidence:

- Valid viewer snapshot/report path validates.
- Missing or stale viewer evidence produces deterministic diagnostics if applicable.
- Existing source/PSD/binary/dynamics validators remain compatible.
- Report refs are stable enough for AI/read command inspection.

Early escape:

- Viewer validation severity policy requires user decision.
- Existing validator report schema cannot represent viewer context without broad redesign.

### D. `wave24-preview-viewer-equivalence-fixtures`

Purpose:

- Preview と Viewer が同じ runtime input に対して整合することを deterministic fixture で示す。
- 最初の oracle は pixel-perfect ではなく、snapshot summary、effective parameters、targeted keyform/drawable/dynamics fields の比較に限定する。

Write scope:

- `fixtures/contracts/**`
- focused fixture tests under `packages/runtime-core/**`, `packages/validator-core/**`, and only narrow editor test helpers if essential
- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency

Pass evidence:

- Fixture proves preview/viewer summary equivalence for at least one package with parameter/keyform/dynamics behavior.
- Expected outputs are deterministic.
- Existing Wave 23 dynamics fixture remains compatible.

Early escape:

- Existing preview projection cannot be compared to viewer snapshot without contract redesign.
- Expected equivalence cannot be made deterministic.

### E. `wave24-viewer-e2e-and-persistence-smoke`

Purpose:

- Browser smoke で save/load -> open Viewer / Runtime surface -> parameter操作 -> snapshot/diff/diagnostics/equivalence evidence を確認する。
- Desktop / mobile viewport と accessibility basics を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency

Pass evidence:

- Viewer workflow passes desktop/mobile smoke.
- Save/load後に Viewer snapshot を再計算できる。
- Parameter override and diagnostics are observable.
- Existing dynamics/source/PSD/binary e2e does not regress.

Early escape:

- E2E reveals broad UI architecture issue.
- Viewer state cannot be restored/recomputed without package contract change.

### F. `wave24-integration-review-and-final-report`

Purpose:

- Domain A-E completion reports を統合し、final verification と clean integration review を行う。
- Wave24 final report、current capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave24/**`
- `discussion/implementation/reviews/wave24/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Orch-Sylph 自身による source code edits。source fix が必要な場合は Gnome に明示委譲し、Review-Sylph で再レビューする。

Pass evidence:

- Final verification が typecheck / unit / e2e / source guard / dependency guard / diff check を含む。
- Clean integration review が viewer semantics、runtime evidence、validator evidence、UI/e2e、orchestration compliance を確認する。
- Maps and final report record residual risks honestly.

## 10. Subagent / Orch-Sylph Execution Policy

Wave 24 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C / D の Orch-Sylph を並列投入する。
3. Domain B / C / D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
4. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
5. 各 Orch-Sylph は自分で source 実装せず、domain 内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
6. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
7. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
8. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
9. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Viewer Semantics: editor preview と別文脈の viewer runtime inspection として truthful か。
- Runtime Evidence: snapshot / diff / parameter override / dynamics output が追跡可能か。
- Validator Evidence: viewer-related diagnostics / report refs が AI-readable か。
- Preview-vs-Viewer Equivalence: summary / targeted snapshot 比較が deterministic か。
- UI / Accessibility: desktop/mobile layout と labels が破綻していないか。
- Persistence: save/load 後に viewer snapshot を再計算できるか。
- Non-Goals: file picker、parser、image decode、archive、external dependency、Cubism compatibility、standalone app に逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: runtime-core focused tests、viewer session adapter tests、typecheck
- Domain B: editor state / workflow / UI focused tests、editor typecheck
- Domain C: validator focused tests、report ref / diagnostics tests
- Domain D: fixture / runtime snapshot comparison focused tests
- Domain E: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain F: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`、`pnpm run check:deps`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / image decode / archive / external dependency / Cubism compatibility claim

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Viewer を standalone app に切り出す必要が出た。
- Viewer snapshot / preview projection の semantic mismatch があり、product decision が必要。
- Parameter override の保存・永続化 policy が未決で実装が進められない。
- Pixel-level renderer oracle、actual image decode、real asset bytes が必要になる。
- External dependency、file picker、archive import/export、Cubism compatibility が必要になる。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、同一 editor app 内 Viewer / Runtime surface、metadata/package-only runtime evaluation、summary + targeted snapshot equivalence に限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave 24 は次を満たしたとき pass とする。

- Editor 内で Viewer / Runtime surface を開ける。
- 保存済み package / active document から viewer runtime snapshot を deterministic に作れる。
- Parameter override により viewer snapshot / diff が deterministic に変化する。
- Viewer surface に snapshot summary、diff、diagnostics、package identity が表示される。
- Preview-vs-Viewer の summary / targeted snapshot equivalence fixture が通る。
- Save/load と desktop/mobile e2e smoke が通る。
- Existing Dynamics / keyform / drawable / mesh / source / PSD / binary workflows を壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
