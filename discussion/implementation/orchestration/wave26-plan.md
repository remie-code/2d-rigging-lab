# Wave 26 Plan: Rig Control Keyform / Viewer Hardening

> Wave 26で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 26
- Wave name: `rig-control-keyform-viewer-hardening`
- Primary objective: Wave25のMinimum Rig Control v1を、keyform-to-rigControl authoring/evidence、negative UX、Viewer / validation report hardening、e2e persistence smokeで一段硬くする。

## 2. 次Wave選定

Wave25後の残件リストでは、次wave候補として`Rig-control hardening`、`Mask / clipping / opacity authoring`、`Package Binary/File I/O Decision + Byte Intake Pilot v0`が挙がっている。

このうち、Wave26では`Rig-control hardening`を選ぶ。

理由:

- Wave25直後で、rig-control authoring/runtime/validator/editor/viewerの基盤がすでに揃っている。
- `rotation2d` / semantic hardeningに閉じれば、追加のユーザー判断が不要。
- file picker、archive、PSD parser、image decode、external dependency、rights/provenance拡張を避けられる。
- Mask / clipping / opacity authoringに移る前に、Wave25で作ったrig-control surfaceの実装証拠を厚くできる。

Wave26は「新しい大機能」ではなく、Wave25のrig-control workflowを製品ワークフローとして扱いやすくするhardening waveである。

## 3. Undineコンテキスト保護規約

Wave26でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- Review-Sylphはimplementation notesだけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、UndineはOrch-Sylph / subagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave25は`Completed / implementation-proven`。
- `createRotation2dRigControl`と`bindRigControlChild`はsupported operationとして存在する。
- runtime-coreには`rotation2d` rig-control hierarchy evaluation、keyform sample application、affected drawable / child rig-control evidenceがある。
- authoring-core / operation-coreはkeyform target kindとして`rigControl`を扱える。
- Viewer / Runtime surfaceはrig-control local/world transform、affected targets、validation diagnosticsを表示できる。
- ただし、GUI上でrig-control keyformを作成して、そのruntime-visible resultをPreview / Viewer / validation report / persistence smokeまで一周する製品証拠はまだ薄い。
- `warpLattice2d`は既存schema/payloadのfuture-compatible footingとして残すが、full evaluatorは未実装でありWave26対象外。

## 5. Design Decisions

- Wave26は`rotation2d` rig-control hardeningに限定する。
- keyform-to-rigControlの主対象propertyは`angleDegrees`とする。
- `restAngleDegrees`、`translation`、`scale`などの既存対応propertyは壊さないが、GUI一周のpass条件にはしない。
- Runtime behaviorはsemantic transform / affected drawable summary / runtime diff / evidenceとして証明する。pixel-level renderer oracleは扱わない。
- Viewer / Runtimeはeditor-internal surfaceのまま育てる。standalone viewer化はしない。
- Negative UXは、missing target、unsupported property、invalid patch shape、cycle / blocked hierarchy、warp lattice unsupported evidenceをtruthfulに見せる範囲に留める。
- Quality sidecarは、source organizationとtest coverageの確認をWave26 gateに組み込む。大規模なsource guard再設計やfresh checkout infrastructure新設はWave26 scopeにしない。

## 6. Non-Goals

- `warpLattice2d` full evaluator / lattice editing UI。
- Cubism Deformer / Cubism ArtMesh / Cubism Viewer compatibility。
- Direct vertex physics、direct rigControl physics output、cloth/collision/IK。
- Canvas drag rig editor、gizmo handles、multi-control timeline editor。
- Full renderer、pixel oracle、WebGL/canvas rendering。
- Standalone viewer app。
- Real PSD parser、PNG/PSD/image decode、raster extraction。
- File picker、archive import/export、actual binary upload、external dependency。
- AI natural-language rig authoring / LLM provider integration。
- Package archive/file I/O decision wave。
- Broad source organization policy rewrite。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave26-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave25/wave25-final-report.md`
- `discussion/implementation/reviews/wave25/wave25-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md` when machine-readable IDs/check IDs are edited
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave26はWave25と違い、foundationを一から作るwaveではない。既存のrig-control/keyform/runtime/viewer footingをhardeningするため、初手から一定の並列性を取れる。

ただしEditor UXはoperation/runtime/validator evidenceの最小形に依存するため、UI domainは後段に置く。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Rig-control keyform operation / fixture hardening | Parallel with B/C | Wave25 complete | `addKeyform` -> `rigControl:angleDegrees` のoperation/evidence/fixtureを製品証拠として固定する |
| 1 | B. Runtime rig-control keyform evidence hardening | Parallel with A/C | Wave25 complete | keyform sampleが`rotation2d` local/world transform、affected drawable、runtime diffへ出ることを強化する |
| 1 | C. Validator / report hardening | Parallel with A/B | Wave25 complete | keyform-driven rig-control runtime evidence、negative states、report refsのdiagnosticsを厚くする |
| 2 | D. Editor rig-control keyform authoring UX | Solo | A + B + C | Editorからrig-control keyformを作成し、Preview / Viewerで確認できるworkflowを通す |
| 3 | E. Viewer / evidence presentation and e2e persistence smoke | Solo | D | Viewer report、save/load、desktop/mobile smoke、negative UX観測を通す |
| 4 | F. Quality gate and integration report | Solo | E | source organization、test adequacy、final verification、clean integration review、map/final reportを行う |

安全上の制約:

- Aは`operation-core`、authoring keyform mutation tests、contract fixturesを中心に担当する。
- Bは`runtime-core`を中心に担当し、editor UIやvalidator broad implementationには触らない。
- Cは`validator-core`とvalidator contract docsの必要最小限に限定する。
- Dは`apps/editor`のworkflow/state/UIに限定し、runtime/validator broad implementationへ戻らない。必要ならA/B/Cへ差し戻す。
- Eはe2e、viewer/evidence presentationの仕上げ、test id / ariaの小修正に限定する。
- Fは統合・検証・報告を担当する。source fixが必要な場合は小さなGnome修正として明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave26-rig-control-keyform-operation-fixture-hardening`

Purpose:

- `addKeyform`で`rigControl:angleDegrees`をtargetにするdry-run / commit / operation log / model diff / package materializationを製品証拠として固定する。
- parent-child rig-control fixtureへ、keyform-driven rotation evidenceを追加または専用fixtureを作る。
- unsupported target property / missing rig-control targetのoperation diagnosticsを補強する。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- `fixtures/contracts/**`
- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`

Forbidden:

- Runtime evaluator broad rewrite
- Validator broad rewrite
- Editor UI implementation
- `warpLattice2d` full evaluator
- External dependency / package manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- `rigControl:angleDegrees` keyform dry-run / commit succeeds.
- Operation result, operation log, model diff, package materializationがkeyform targetを追跡できる。
- Missing target / unsupported propertyがdeterministic diagnosticsになる。
- Existing mesh/drawable keyform operation tests remain compatible.

Early escape:

- Existing keyform target schemaでは`rigControl`の製品証拠を表現できない。
- `angleDegrees`以外をpass条件にしないと成立しない。

### B. `wave26-runtime-rig-control-keyform-evidence-hardening`

Purpose:

- `rotation2d` rig-control keyform sampleがlocal/world transform、affected drawable vertices/bounds、runtime snapshot/diff/evidenceに反映されることを強化する。
- Invalid patch shape / unsupported composition / unsupported propertyのruntime diagnosticsを固定する。
- `warpLattice2d` samplesはunsupported no-op evidenceとしてtruthfulに残す。

Allowed write scope:

- `packages/runtime-core/src/**`
- runtime focused tests
- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`

Forbidden:

- Operation handler implementation
- Validator broad rewrite
- Editor UI implementation
- Full renderer / pixel oracle
- Direct physics / warp lattice deformation evaluator

Pass evidence:

- Same input produces deterministic rig-control keyform runtime output.
- `angleDegrees` keyform changes local/world transform and affected drawable evidence.
- Runtime diff contains traceable rig-control changes.
- Invalid rig-control keyform patch emits deterministic diagnostics.
- Existing keyform / dynamics / viewer / rig-control tests remain compatible.

Early escape:

- Runtime diff field naming requires schema compatibility decision.
- Existing evidence cannot represent keyform-driven rig-control behavior without contract redesign.

### C. `wave26-validator-report-hardening`

Purpose:

- Validatorがkeyform-driven rig-control runtime evidenceを十分に確認できるようにする。
- Runtime evidence missing / mismatch diagnosticsの証拠を、keyform-driven local/world transformやsnapshot refsまで必要最小限に強化する。
- Validator contract / check catalog driftがあれば小さく整える。

Allowed write scope:

- `packages/validator-core/src/**`
- validator focused tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad MVP-wide preflight report redesign
- External dependency / manifest changes

Pass evidence:

- Valid keyform-driven rig-control package validates with runtime evidence.
- Missing/stale/mismatched rig-control runtime evidence is deterministic.
- Cycle / missing child / unsupported warp behavior from Wave25 does not regress.
- Existing source/PSD/binary/dynamics/viewer validators remain compatible.

Early escape:

- Severity policy or report shape requires product decision.
- Validator contract update becomes broad rather than targeted.

### D. `wave26-editor-rig-control-keyform-authoring-ux`

Purpose:

- Editorから`rotation2d` rig-controlの`angleDegrees` keyformを作成できる最小workflowを追加する。
- User can choose an existing parameter and rig-control, set key value and angle patch, commit the operation, and observe Preview / Viewer runtime evidence.
- UIはproject-defined rig-control keyformとしてtruthfulに表示し、Cubism互換とは主張しない。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/ui/rig-control-panel/**`
- focused editor tests
- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Canvas drag editor / gizmo / timeline editor
- Broad app shell redesign
- External dependency / manifest changes

Pass evidence:

- Editor UI can create a rig-control angle keyform.
- Preview / Viewer shows keyform-driven runtime behavior or explicit diagnostics.
- Invalid input is rejected with user-visible, deterministic messaging.
- Save/load restores authored rig-control keyform state.
- Desktop/mobile layout and labels remain coherent.

Early escape:

- Existing editor workflow cannot add this without broad refactor.
- Keyform authoring UI requires a general timeline/keyform editor instead of a minimal rig-control workflow.

### E. `wave26-viewer-evidence-e2e-persistence-smoke`

Purpose:

- Viewer / Runtime surface and evidence panels make keyform-driven rig-control behavior observable.
- Desktop/mobile e2e smoke proves create rig-control -> bind child -> add keyform -> Preview / Viewer inspection -> save/load -> Viewer reinspection.
- Negative UX smoke covers at least one deterministic rejected or diagnostic path.

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/ui/viewer-runtime/**`
- `apps/editor/src/editor-state/viewer-runtime-*`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / manifest changes

Pass evidence:

- E2E observes keyform-driven rig-control behavior in Preview / Viewer.
- Save/load preserves rig-control keyform and child binding.
- Viewer / Runtime surface recomputes evidence after load.
- Existing dynamics/source/PSD/binary/viewer/rig-control e2e does not regress.

Early escape:

- E2E reveals broad UI architecture issue.
- Browser smoke cannot observe behavior without full renderer / pixel oracle.

### F. `wave26-quality-gate-integration-report`

Purpose:

- Domain A-E completion reportsを統合し、final verification、clean integration review、final report、map更新を行う。
- Source organization / test adequacy / non-goal containmentをWave26 gateとして確認する。

Allowed write scope:

- `discussion/implementation/waves/wave26/**`
- `discussion/implementation/reviews/wave26/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。

Pass evidence:

- Final verificationがtypecheck / unit / e2e / source guard / dependency guard / diff checkを含む。
- Clean integration reviewがoperation/runtime/validator/editor/viewer/e2eとorchestration complianceを確認する。
- Final report records residual risks honestly, including `warpLattice2d` future scope and remaining asset I/O boundaries.

## 10. Subagent / Orch-Sylph Execution Policy

Wave26起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / CのOrch-Sylphを並列投入する。
2. Domain A / B / Cが`pass`したら、UndineはDomain DをOrch-Sylphに委譲する。
3. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
4. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
5. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
6. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
7. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
8. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
9. 長時間処理でも、Undineは待機を理由にsubagentを打ち切らない。

各Orch-Sylph assignmentには、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各domain completion前に最低限以下を確認する。

- Rig Control Keyform Semantics: `rotation2d:angleDegrees` keyformとしてdeterministicで説明可能か。
- Operation Integrity: dry-run / commit / operation log / evidenceがcoherentか。
- Runtime Evidence: local/world transform、affected drawable、snapshot / diffが追跡可能か。
- Validator Evidence: keyform-driven rig-control diagnosticsがAI-readableか。
- Viewer / Preview Evidence: editor previewとViewer / Runtimeでruntime-visible behaviorを確認できるか。
- UI / Accessibility: editor workflowがtruthfulで、desktop/mobile layoutとlabelsが破綻していないか。
- Persistence: save/load後にrig-control、child binding、keyformが残り、viewer snapshotを再計算できるか。
- Non-Goals: Cubism互換、warp lattice full evaluator、direct physics、file picker、parser、image decode、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、fixture tests、typecheck
- Domain B: runtime-core focused tests、snapshot/diff/evidence tests、viewer compatibility tests
- Domain C: validator focused tests、check catalog / contract alignment tests
- Domain D: editor state / workflow / UI focused tests、editor typecheck
- Domain E: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain F: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / image decode / archive / external dependency / Cubism compatibility / warp lattice full evaluator / direct physics claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- `rotation2d:angleDegrees`以外のrig-control keyform propertyをpass条件にしないと成立しない。
- Runtime diff / evidence schemaの互換変更が必要。
- Editor UXがgeneral timeline/keyform editorを要求する。
- Viewer evidenceがfull renderer / pixel oracleなしでは観測不能。
- `warpLattice2d` full evaluator、direct physics、Cubism compatibility、file picker、parser、image decode、external dependencyが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、`rotation2d:angleDegrees` keyform、semantic runtime evidence、editor-internal Viewer / Runtime inspectionに限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave26は次を満たしたときpassとする。

- `rigControl:angleDegrees` keyformをoperationとしてdry-run / commitできる。
- Runtimeがkeyform-driven `rotation2d` rig-control behaviorをsnapshot / diff / evidenceに残せる。
- Validatorがkeyform-driven rig-control runtime evidenceとnegative statesをdeterministic diagnosticsとして出せる。
- Editorからrig-control keyformを作成し、Preview / Viewer / Runtime surfaceでruntime-visible evidenceを確認できる。
- Save/loadとdesktop/mobile e2e smokeが通る。
- Existing keyform / drawable / mesh / source / PSD / binary / dynamics / viewer / rig-control workflowsを壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no direct physics claim、no warp lattice full evaluator。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
