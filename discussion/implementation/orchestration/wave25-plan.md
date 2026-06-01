# Wave 25 Plan: Minimum Rig Control v1 Authoring Runtime Slice

> Wave 25 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 25
- Wave name: `minimum-rig-control-v1-authoring-runtime-slice`
- Primary objective: Minimum Rig Control v1 を、authoring operation -> runtime hierarchy/evidence -> validator diagnostics -> editor/viewer UX -> fixture/e2e persistence smoke の一周で implementation-proven にする。

## 2. 次Wave選定

Wave 24 で Private Viewer v0 が実装され、保存済み package / active document を viewer 文脈で runtime inspection できるようになった。これにより、次の GUI authoring 機能は preview-only ではなく Viewer / Runtime surface で runtime-visible behavior を確認できる。

次の候補は real PSD / image intake、package archive/file I/O、AI repair、mask/clipping、full mesh editor、rig control に分かれる。real PSD / image intake と archive/file I/O は file picker / parser / image decode / archive / dependency approval が必要で、まだ安全な既定候補ではない。AI repair は runtime/model/validation diff の安定化後に価値が高いが、現在の MVP の大きな未達は rig control authoring / runtime behavior である。mask/clipping や full mesh editor も重要だが、MVP traceability では `parent-child-rigControl-diagonal` と `invalid-rigControl-cycle` が mvp-blocking として残っている。

そのため Wave 25 は、既存 package schema / operation payload / runtime graph adapter / Viewer / Runtime surface を使って、Minimum Rig Control v1 を通す。

- `rotation2d` rig control と child binding を authoring / operation lifecycle で supported にする。
- Runtime が parent-before-child hierarchy を deterministic に評価し、rig control transform / affected drawable summary / runtime diff / evidence を残す。
- Validator が rig control hierarchy cycle、missing child、invalid target、runtime evidence gap を deterministic diagnostics として出す。
- Editor から minimal rig control を作成し、child drawable または child rig control を bind し、Preview / Viewer で確認できる。
- Fixture と desktop/mobile e2e smoke で save/load 後の runtime-visible behavior を確認する。

これは Cubism deformation system、warp lattice full evaluator、direct physics output、direct vertex physics、canvas drag editor ではない。Private Prototype のための最小で説明可能な project-defined rig control workflow である。

## 3. Undine コンテキスト保護規約

Wave 25 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source implementation は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 24 は `Completed / implementation-proven`。
- Package/model format には rig control schema と `rig-controls-file-v1` がある。
- Operation payload には `createRotation2dRigControl`、`createWarpLattice2dRigControl`、`bindRigControlChild` が存在する。
- Authoring runtime graph adapter には `rotation2d` / `warpLattice2d` rig control mapping がある。
- Runtime graph / snapshot には rig controls が含まれる。
- Keyform target kind として `rigControl` は schema 上存在するが、runtime-visible rig control target application は過去 wave で future scope とされている。
- Viewer / Runtime surface は Wave 24 で追加され、runtime snapshot / diff / diagnostics を UI から確認できる。
- Current capability map では、rig control は「format / graph / runtime graph adapter / keyform target kind としての基盤はあるが、GUI制作と runtime-visible behavior は未完」と整理されている。

## 5. Design Decisions

- Wave 25 は Minimum Rig Control v1 に限定する。
- 最初の runtime-visible target は `rotation2d` rig control とする。
- `bindRigControlChild` は child drawable と child rig control を扱うが、まず parent-before-child order と cycle-free hierarchy を deterministic に確認する。
- `createWarpLattice2dRigControl` と warp lattice deformation evaluator は future scope。既存 payload / schema を壊さないが、この wave の pass 条件にしない。
- Runtime behavior は deterministic な semantic transform / affected drawable summary として証明する。pixel-level renderer oracle は扱わない。
- Rig control は direct physics output ではない。Dynamics から直接 rig control physics を駆動する機能は future scope。
- Existing keyform / dynamics / viewer / preview workflow を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- Warp lattice full evaluator / lattice editing UI。
- Cubism Deformer / Cubism ArtMesh / Cubism Viewer compatibility。
- Direct vertex physics、direct rigControl physics output、cloth/collision/IK。
- Canvas drag rig editor、gizmo handles、multi-control timeline editor。
- Full renderer、pixel oracle、WebGL/canvas rendering。
- Real PSD parser、PNG/PSD/image decode、raster extraction。
- File picker、archive import/export、actual binary upload、external dependency。
- AI repair / natural language rig authoring。
- Standalone viewer app。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave25-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave24/wave24-final-report.md`
- `discussion/implementation/reviews/wave24/wave24-clean-integration-review.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md` when machine-readable rigControl IDs/check IDs are edited
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約や設計全文を自分で読み込まない。詳細規約と設計は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Rig control workflow は authoring / operation lifecycle の入口が shared bottleneck になる。Domain A が pass するまで runtime / validator / fixture は開始しない。Domain A 後は runtime hierarchy/evidence、validator diagnostics、contract fixture を並列化できる。Editor UX は runtime/validator/fixture の最小 contract がそろってから進め、最後に e2e と統合レビューを行う。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Rig control authoring and operation foundation | Solo | Wave 24 complete | `createRotation2dRigControl` / `bindRigControlChild` を authoring session と operation lifecycle に追加する |
| 2 | B. Runtime rig control hierarchy and evidence | Parallel with C/D | A | parent-before-child evaluation、rig control transform state、snapshot/diff/evidence を固める |
| 2 | C. Validator rig control semantic checks | Parallel with B/D | A | cycle / missing child / invalid target / runtime evidence gap diagnostics を固める |
| 2 | D. Rig control fixtures and contract evidence | Parallel with B/C | A | parent-child rig control fixture と invalid cycle fixture を deterministic に固定する |
| 3 | E. Editor rig control panel and viewer workflow | Solo | B + C + D | editor で rig control 作成/bind、preview/viewer 確認、diagnostics 表示を通す |
| 4 | F. Rig control e2e and persistence smoke | Solo | E | browser save/load、Viewer / Runtime inspection、desktop/mobile smoke を確認する |
| 5 | G. Integration review and final report | Solo | F | final verification、clean integration review、map更新、final report |

安全上の制約:

- A は authoring-core / operation-core の rig control operation foundation を独占する。
- B は runtime-core を担当し、operation handler / editor UI / validator broad implementation に触らない。
- C は validator-core を担当し、operation handler / runtime evaluator / editor UI に触らない。
- D は fixtures/contracts と fixture tests を担当し、editor UI には触らない。
- E は editor workflow/UI を担当し、runtime/validator broad implementation には触らない。
- F は e2e / smoke に限定する。広い source fix が必要なら該当 domain へ差し戻す。
- G は report/map/review 統合を担当する。source fix が必要なら小さな integration fix を Gnome に委譲し、Review-Sylph で再レビューする。

## 9. Domain Assignments

### A. `wave25-rig-control-authoring-operation-foundation`

Purpose:

- Minimum Rig Control v1 の authoring mutation と operation handler を追加する。
- `createRotation2dRigControl` と `bindRigControlChild` を supported operation にする。
- Dry-run / commit / operation log / model diff / package materialization の最低限を通す。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused operation / authoring tests
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Runtime rig control evaluator implementation
- Validator broad implementation
- Editor UI implementation
- Warp lattice full evaluator
- External dependency / package manifest / lockfile changes
- Cubism compatibility claim
- `index.ts` implementation logic

Pass evidence:

- Rotation2d rig control create dry-run / commit succeeds.
- Bind child drawable and child rig control dry-run / commit succeeds or reports deterministic invalid target diagnostics.
- Operation log and model diff identify rig control target refs.
- Package materialization includes rig controls and graph roots/relations correctly.
- Existing operations remain compatible.

Early escape:

- Existing rig control schema is insufficient and requires contract redesign beyond one wave.
- Parent/root relationship semantics conflict with package graph design.
- `bindRigControlChild` target policy requires user decision.

### B. `wave25-runtime-rig-control-hierarchy-evidence`

Purpose:

- Minimum Rig Control v1 runtime behavior を deterministic に評価する。
- Parent-before-child hierarchy、rotation2d transform state、affected drawable / child rig control summary、runtime snapshot / diff / evidence を残す。
- Viewer / Runtime surface が使える runtime projection を提供する。

Write scope:

- `packages/runtime-core/src/**`
- focused runtime tests
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Operation handler implementation
- Validator broad implementation
- Editor UI implementation
- Warp lattice deformation evaluator
- Direct vertex physics / direct rigControl physics output
- Non-deterministic timing dependency

Pass evidence:

- Same input graph/state yields same rig control runtime output.
- Parent-before-child order is deterministic.
- Runtime snapshot / diff expose rig control changes and affected targets.
- Existing keyform / dynamics / viewer tests remain compatible.

Early escape:

- Runtime transform semantics require product decision.
- Rig control evidence cannot represent affected targets without contract redesign.
- Keyform-to-rigControl target application requires broader redesign than this wave.

### C. `wave25-validator-rig-control-semantic-checks`

Purpose:

- Rig control hierarchy / child binding / runtime evidence の validator checks を追加する。
- Cycle、missing parent/child target、invalid child target kind、runtime evidence gap を deterministic diagnostics として出す。
- Check catalog / validator contract drift を必要最小限で整える。

Write scope:

- `packages/validator-core/src/**`
- validator focused tests
- validator contract docs only if small and directly tied to new check IDs
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad validator report redesign
- External dependency / package manifest / lockfile changes

Pass evidence:

- Valid parent-child rig control package validates.
- Cycle fixture produces deterministic `rigControl.cycle` or equivalent formal diagnostic.
- Missing child / invalid target diagnostics are deterministic.
- Existing source/PSD/binary/dynamics/viewer validators remain compatible.

Early escape:

- Rig control severity policy requires user decision.
- Existing check catalog requires broad documentation rewrite.

### D. `wave25-rig-control-fixtures-contract-evidence`

Purpose:

- `parent-child-rigControl-diagonal` と `invalid-rigControl-cycle` 相当の contract evidence を固定する。
- Operation result、runtime snapshot/diff、validation report、viewer-facing evidence を deterministic fixture として残す。

Write scope:

- `fixtures/contracts/**`
- focused fixture tests under operation / runtime / validator packages
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency / package manifest / lockfile changes

Pass evidence:

- Fixture proves rig control operation -> runtime hierarchy evidence -> validator report.
- Invalid cycle fixture proves blocking diagnostic.
- Expected outputs are deterministic.
- Existing Wave 24 viewer equivalence fixture remains compatible.

Early escape:

- Fixture requires undefined rig control transform semantics.
- Expected runtime evidence cannot be made deterministic.

### E. `wave25-editor-rig-control-panel-viewer-workflow`

Purpose:

- Editor に minimal Rig Control panel / workflow を追加する。
- User can create a rotation2d rig control, bind child drawable / child rig control where available, and inspect result in Preview / Viewer / Runtime surface.
- UI は project-defined rig control として説明し、Cubism互換とは主張しない。

Write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/ui/**`
- focused editor tests
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Full canvas drag editor / gizmo / timeline editor
- Broad app shell redesign
- External dependency / package manifest / lockfile changes

Pass evidence:

- Rig control can be created from editor UI.
- Child binding can be performed or blocked with deterministic user-visible diagnostics.
- Preview / Viewer shows rig control runtime evidence or affected target summary.
- Save/load restores authored rig control workflow state where applicable.
- Accessible labels and mobile layout remain coherent.

Early escape:

- UI requires broad navigation redesign.
- Preview / Viewer behavior cannot be expressed without runtime changes beyond Domain B.

### F. `wave25-rig-control-e2e-and-persistence-smoke`

Purpose:

- Browser smoke で rig control creation -> bind child -> Preview / Viewer inspection -> save/load -> validation/evidence を確認する。
- Desktop / mobile viewport と accessibility basics を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / package manifest / lockfile changes

Pass evidence:

- Rig control workflow passes desktop/mobile smoke.
- Save/load preserves rig control and child binding.
- Viewer / Runtime surface shows runtime evidence after load.
- Existing dynamics/source/PSD/binary/viewer e2e does not regress.

Early escape:

- E2E reveals broad UI architecture issue.
- Rig control state cannot persist without package contract change.

### G. `wave25-integration-review-and-final-report`

Purpose:

- Domain A-F completion reports を統合し、final verification と clean integration review を行う。
- Wave25 final report、current capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave25/**`
- `discussion/implementation/reviews/wave25/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Orch-Sylph 自身による source code edits。source fix が必要な場合は Gnome に明示委譲し、Review-Sylph で再レビューする。

Pass evidence:

- Final verification が typecheck / unit / e2e / source guard / dependency guard / diff check を含む。
- Clean integration review が operation/runtime/validator/editor/viewer/e2e と orchestration compliance を確認する。
- Maps and final report record residual risks honestly.

## 10. Subagent / Orch-Sylph Execution Policy

Wave 25 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C / D の Orch-Sylph を並列投入する。
3. Domain B / C / D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
4. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
5. Domain F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は自分で source 実装せず、domain 内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
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

- Rig Control Semantics: project-defined Minimum Rig Control v1 として deterministic で説明可能か。
- Operation Integrity: dry-run / commit / operation log / evidence が coherent か。
- Runtime Evidence: hierarchy order、transform state、affected targets、snapshot / diff が追跡可能か。
- Validator Evidence: rig control diagnostics が AI-readable か。
- Viewer / Preview Evidence: editor preview と Viewer / Runtime で runtime-visible behavior を確認できるか。
- UI / Accessibility: editor workflow が truthful で、desktop/mobile layout と labels が破綻していないか。
- Persistence: save/load 後に rig control と child binding が残り、viewer snapshot を再計算できるか。
- Non-Goals: Cubism互換、warp lattice full evaluator、direct physics、file picker、parser、image decode、external dependency に逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: operation-core / authoring-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core focused tests、snapshot/diff/evidence tests、viewer compatibility tests
- Domain C: validator focused tests、check catalog alignment tests
- Domain D: fixture / contract focused tests
- Domain E: editor state / workflow / UI focused tests、editor typecheck
- Domain F: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain G: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`、`pnpm run check:deps`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / image decode / archive / external dependency / Cubism compatibility / warp lattice full evaluator / direct physics claims

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Rig control transform semantics が複数候補に分かれ、製品判断が必要。
- Existing package / runtime rig control schema と MVP design が矛盾する。
- Runtime evidence に affected targets / hierarchy order を表現できず contract redesign が必要。
- Keyform-to-rigControl target application が広範 redesign を要求する。
- Editor UX が canvas drag / gizmo / timeline editor を要求する。
- External dependency、file picker、parser、image decode、Cubism compatibility、direct physics が必要になる。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、rotation2d rig control / child binding / parent-before-child runtime evidence / semantic viewer inspection に限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave 25 は次を満たしたとき pass とする。

- Rotation2d rig control を authoring operation として dry-run / commit できる。
- Child drawable / child rig control binding が operation として扱える。
- Runtime が deterministic parent-before-child rig control behavior を snapshot / diff / evidence に残せる。
- Validator が rig control semantic checks を deterministic diagnostics として出せる。
- Editor から rig control を作成し、Preview / Viewer / Runtime surface で runtime-visible evidence を確認できる。
- Parent-child rig control fixture と invalid cycle fixture が通る。
- Save/load と desktop/mobile e2e smoke が通る。
- Existing Dynamics / keyform / drawable / mesh / source / PSD / binary / viewer workflows を壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no direct physics claim。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
