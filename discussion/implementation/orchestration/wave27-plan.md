# Wave 27 Plan: Mask / Clipping / Opacity Authoring v1

> Wave 27で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 27
- Wave name: `mask-clipping-opacity-authoring-v1`
- Primary objective: mask relation / semantic clipping / opacity authoringを、operation -> runtime evidence -> validator diagnostics -> editor/viewer UX -> fixture/e2e persistence smokeの一周でimplementation-provenにする。

## 2. 次Wave選定

Wave26でRig Control Keyform / Viewer Hardeningが`pass / implementation-proven`になり、Wave25後の残件リストにあった`Rig-control hardening`は一段閉じた。

次候補は大きく次に分かれる。

- `Mask / clipping / opacity authoring`
- `Part / texture / layer tree workflow`
- `Mesh editor completion`
- `Package Binary/File I/O Decision + Byte Intake Pilot v0`
- `AI repair / diff workflow`

このうちWave27では`Mask / clipping / opacity authoring`を選ぶ。

理由:

- Package/model formatには`masks-file-v1`と`MaskRelation` schemaがあり、authoring -> runtime graphにもenabled mask relationの写像がある。
- `setMaskRelation` operation type / payloadの足場がある一方、製品workflowとしてoperation / runtime evidence / validator / editor / e2eがまだ閉じていない。
- Drawable opacityはruntime preview/evidenceの足場があり、keyform targetとしても扱えるため、static opacity editorやrendererへ広げずに最小authoring evidenceへ切れる。
- real asset I/O、PSD parser、image decode、archive、dependency approvalを要求しない。
- Full renderer / pixel oracleなしでも、semantic mask relation / clipping intent / opacity evidenceとして検証できる。

Wave27は「実pixel clipping renderer」を作るwaveではない。Private Prototypeのcomposition authoringとして、mask relationとopacityの意図・runtime evidence・validator diagnostics・Viewer / Preview observationをtruthfulに残すwaveである。

## 3. Undineコンテキスト保護規約

Wave27でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- Review-Sylphはimplementation notesだけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、UndineはOrch-Sylph / subagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave26は`Completed / implementation-proven`。
- `MaskRelationSchema`は`maskRelationId`、`maskDrawableIds`、`targetDrawableIds`、`maskGroupHint`、`enabled`を持つ。
- `MasksFileSchema`は`masks-file-v1`として存在する。
- `setMaskRelation`はoperation type / payloadとして存在する。
- `toRuntimeGraphFromAuthoringGraph`はenabled mask relationをruntime graphの`masks`へ写像している。
- Runtime snapshotにはmask relation summaryを持つ足場がある。
- Drawable opacity / runtime visibility / draw orderは既存runtime previewとlayer controlsで一部扱える。
- `addKeyform` / `addKeyformGrid2d`はdrawable / opacity / visibility / drawOrder系target propertyの足場を持つ。
- Editorにはdraw order / visibility controls、Rig Controls、Viewer / Runtime surfaceがあるが、mask relation authoring panelとopacity authoring workflowはまだ製品一周として未完。

## 5. Design Decisions

- Wave27はMinimum Composition Authoring v1に限定する。
- Mask relationの最小単位は「1つ以上のmask drawable -> 1つ以上のtarget drawable」とする。
- Clippingはsemantic intent / runtime evidenceとして扱う。実pixel clipping、texture masking、SVG/Canvas/WebGL renderer correctnessはpass条件にしない。
- Opacityは最小scopeとして、既存keyform/evidence基盤を使ったdrawable opacity authoringまたはoperation evidenceに閉じる。新しい大規模timeline editorは作らない。
- Preview / Viewerはmask relationとopacityをtruthfulに表示する。視覚的表現を追加する場合も、pixel oracleではなくsemantic cueとして扱う。
- Invalid mask relationはdeterministic diagnosticsとして扱う。例: missing mask drawable、missing target drawable、self-mask、empty target、disabled relation evidence gap。
- Existing draw order / visibility / rig control / dynamics / source / PSD / binary workflowsを壊さない。
- Public `index.ts`はbarrel-onlyを維持する。

## 6. Non-Goals

- Pixel-perfect clipping renderer / bitmap mask compositor。
- Full renderer、WebGL/canvas renderer、texture renderer、pixel oracle。
- Standalone viewer app。
- Real PSD parser、PNG/PSD/image decode、raster extraction。
- File picker、archive import/export、actual binary upload、external dependency。
- Cubism clipping / Cubism ArtMesh / Cubism Viewer compatibility。
- Layer tree full editor、drag-and-drop reorder、multi-select/lock/hide/select generalization。
- General timeline editor、multi-key opacity curve editor、animation export。
- Broad source organization policy rewrite。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave27-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave26/wave26-final-report.md`
- `discussion/implementation/reviews/wave26/wave26-clean-integration-review.md`

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

Wave27は既存schema / operation payload / runtime graph footingがあるため、初手からoperation、runtime、validatorを並列化できる。

ただし、contract fixturesとEditor UXはoperation/runtime/validatorの最小形に依存するため後段に置く。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Mask relation authoring / operation foundation | Parallel with B/C | Wave26 complete | `setMaskRelation`をauthoring session / operation lifecycleでsupportedにする |
| 1 | B. Runtime composition evidence hardening | Parallel with A/C | Wave26 complete | mask relationとopacityをruntime snapshot / diff / evidence / Viewer basisへ出す |
| 1 | C. Validator composition diagnostics | Parallel with A/B | Wave26 complete | missing/self/disabled/mismatch mask relationやopacity evidence gapをdeterministic diagnosticsにする |
| 2 | D. Composition contract fixtures | Solo or parallel after A/B/C narrow pass | A + B + C | mask relation + opacity evidenceのoperation/runtime/validator fixtureを固定する |
| 3 | E. Editor composition authoring UX | Solo | A + B + C + D | Editorでmask relation作成と最小opacity authoringを行いPreview / Viewerで観測する |
| 4 | F. Composition e2e persistence smoke | Solo | E | desktop/mobileでmask relation / opacity authoring -> save/load -> Viewer再検査を通す |
| 5 | G. Integration review and final report | Solo | F | final verification、clean integration review、map/final report更新を行う |

安全上の制約:

- Aはauthoring-core / operation-coreに限定し、runtime / validator / editor broad implementationには触らない。
- Bはruntime-coreに限定し、operation handler / validator / editor UIには触らない。
- Cはvalidator-coreと必要最小限のvalidator contract docsに限定する。
- Dはfixtures/contractsとfixture-facing testsを担当し、editor UIには触らない。
- Eはapps/editorのcomposition workflow/UIに限定し、runtime/validator broad implementationへ戻らない。必要ならA/B/Cへ差し戻す。
- Fはe2e / smoke / narrow test id or aria tweaksに限定する。
- Gはreports/maps/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave27-mask-relation-authoring-operation-foundation`

Purpose:

- `setMaskRelation`をsupported operationとして実装または不足分を補強する。
- Authoring sessionのmask relation mutation、dry-run / commit、operation log、model diff、package materializationを通す。
- Missing drawable、duplicate drawable、self-mask、empty relation、disabled relation updateをdeterministic diagnosticsとして扱う。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused operation / authoring tests
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- Editor UI implementation
- Full renderer / pixel oracle / actual clipping renderer
- External dependency / package manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- `setMaskRelation` dry-run / commit succeeds for valid mask -> target relation.
- Operation result, target refs, model diff, operation log, package materialization identify mask relation changes.
- Invalid mask / target relation emits deterministic diagnostics.
- Existing draw order / visibility / rig control / dynamics operations remain compatible.

Early escape:

- Mask relation semantics require product decision beyond semantic relation evidence.
- Package schema cannot represent the needed relation without broad schema redesign.

### B. `wave27-runtime-composition-evidence-hardening`

Purpose:

- Runtime snapshot / diff / evidenceにmask relationとopacityをtraceableに出す。
- Mask relationはsemantic clipping intentとして扱い、pixel clipping resultは作らない。
- Opacity keyform / drawable opacity evidenceがPreview / Viewer basisとして追跡できるようにする。

Allowed write scope:

- `packages/runtime-core/src/**`
- runtime focused tests
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Operation handler implementation
- Validator broad implementation
- Editor UI implementation
- Pixel renderer / SVG clipping oracle / WebGL/canvas renderer
- Image decode / actual bitmap masking

Pass evidence:

- Runtime snapshot lists enabled mask relations deterministically.
- Runtime diff/evidence exposes mask relation changes and opacity changes with stable paths.
- Disabled relation is represented truthfully or omitted with clear evidence semantics.
- Existing keyform / rig-control / dynamics / viewer runtime tests remain compatible.

Early escape:

- Runtime evidence cannot express mask relation without schema redesign.
- Any pass criterion depends on pixel clipping output.

### C. `wave27-validator-composition-diagnostics`

Purpose:

- Mask relation semantic checksを追加または補強する。
- Missing mask drawable、missing target drawable、self-mask、duplicate relation、disabled/evidence mismatch、runtime evidence gapをdeterministic diagnosticsとして扱う。
- Opacity evidence gapやout-of-range opacityは既存schemaとruntime evidenceに合わせて必要最小限で確認する。

Allowed write scope:

- `packages/validator-core/src/**`
- validator focused tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad MVP-wide preflight report redesign
- External dependency / manifest changes

Pass evidence:

- Valid mask relation validates with runtime evidence.
- Missing/self/mismatch cases emit deterministic diagnostics.
- Existing source/PSD/binary/dynamics/viewer/rig-control validators remain compatible.
- Validator contract/check catalog drift is either absent or narrowly documented.

Early escape:

- Severity policy requires user decision.
- Validator would need to become a renderer or runtime evaluator.

### D. `wave27-composition-contract-fixtures`

Purpose:

- Mask relation + opacity evidenceのcontract fixtureを固定する。
- Operation result、package materialization、runtime snapshot/diff、validation report、Viewer-facing evidenceをdeterministic fixtureとして残す。

Allowed write scope:

- `fixtures/contracts/**`
- focused fixture tests under operation / runtime / validator packages
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency / manifest changes

Pass evidence:

- Fixture proves `setMaskRelation` operation -> package masks -> runtime evidence -> validator report.
- Fixture covers at least one invalid mask relation diagnostic.
- Opacity evidence is represented either through existing drawable opacity/keyform path or explicit fixture evidence.
- Expected outputs are deterministic and rights-clean.

Early escape:

- Fixture requires actual image/mask bytes.
- Expected semantic evidence cannot be made deterministic.

### E. `wave27-editor-composition-authoring-ux`

Purpose:

- Editorにminimum Composition / Mask / Opacity workflowを追加する。
- User can select mask drawable(s), target drawable(s), enable/disable relation, commit `setMaskRelation`, and observe semantic evidence in Preview / Viewer.
- User can author or observe minimal drawable opacity evidence without adding a general timeline editor.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/editor-app.ts` for narrow app-level callback wiring only
- `apps/editor/src/ui/**` for focused composition/mask panel files
- focused editor tests
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Full canvas mask editor / brush editor / paint UI
- Broad app shell redesign
- Broad `apps/editor/src/app/**` rewiring beyond the single callback bridge needed for composition authoring
- External dependency / manifest changes

Pass evidence:

- Editor UI can create/update a mask relation.
- Preview / Viewer shows mask relation and opacity evidence truthfully.
- Invalid input is rejected with user-visible deterministic messaging.
- Save/load restores authored mask relation and opacity evidence.
- Desktop/mobile layout and labels remain coherent enough for e2e.

Early escape:

- UI requires broad layer tree redesign.
- Opacity workflow requires a general timeline editor.
- Preview/Viewer behavior cannot be expressed without runtime changes beyond Domain B.

### F. `wave27-composition-e2e-persistence-smoke`

Purpose:

- Browser smokeでmask relation authoring -> opacity evidence -> Preview / Viewer inspection -> save/load -> Viewer reinspectionを確認する。
- Desktop / mobile viewportとbasic accessibility/layoutを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / manifest changes

Pass evidence:

- Composition workflow passes desktop/mobile smoke.
- Save/load preserves mask relation and opacity evidence.
- Viewer / Runtime surface shows semantic composition evidence after load.
- Existing rig-control/dynamics/source/PSD/binary/viewer e2e does not regress.

Early escape:

- E2E reveals broad UI architecture issue.
- Browser smoke cannot observe behavior without full renderer / pixel oracle.

### G. `wave27-integration-review-and-final-report`

Purpose:

- Domain A-F completion reportsを統合し、final verification、clean integration review、final report、map更新を行う。
- Source organization、test adequacy、forbidden-scope containment、orchestration complianceをWave27 gateとして確認する。

Allowed write scope:

- `discussion/implementation/waves/wave27/**`
- `discussion/implementation/reviews/wave27/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` for narrow Wave27 contract fixture registration only
- `discussion/tests/traceability/test-traceability-matrix.md` for narrow Wave27 evidence registration only

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad test documentation rewrite beyond Wave27 fixture / evidence registration.

Pass evidence:

- Final verificationがtypecheck / unit / e2e / source guard / dependency guard / diff checkを含む。
- Clean integration reviewがoperation/runtime/validator/editor/viewer/e2eとorchestration complianceを確認する。
- Final report records residual risks honestly, including no pixel clipping oracle and no full renderer.

## 10. Subagent / Orch-Sylph Execution Policy

Wave27起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / CのOrch-Sylphを並列投入する。
2. Domain A / B / Cが`pass`したら、UndineはDomain DをOrch-Sylphに委譲する。
3. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
4. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
5. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
6. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
7. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
8. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
9. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
10. 長時間処理でも、Undineは待機を理由にsubagentを打ち切らない。

各Orch-Sylph assignmentには、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各domain completion前に最低限以下を確認する。

- Composition Semantics: mask relation / clipping intent / opacity evidenceがproject-defined semantic workflowとして説明可能か。
- Operation Integrity: dry-run / commit / operation log / evidenceがcoherentか。
- Runtime Evidence: mask relation、opacity、snapshot / diffが追跡可能か。
- Validator Evidence: composition diagnosticsがAI-readableか。
- Viewer / Preview Evidence: editor previewとViewer / Runtimeでsemantic composition behaviorを確認できるか。
- UI / Accessibility: editor workflowがtruthfulで、desktop/mobile layoutとlabelsが破綻していないか。
- Persistence: save/load後にmask relationとopacity evidenceが残り、viewer snapshotを再計算できるか。
- Non-Goals: pixel oracle、full renderer、Cubism互換、file picker、parser、image decode、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core focused tests、snapshot/diff/evidence tests、viewer compatibility tests
- Domain C: validator focused tests、check catalog / contract alignment tests
- Domain D: fixture / contract focused tests
- Domain E: editor state / workflow / UI focused tests、editor typecheck
- Domain F: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain G: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / image decode / archive / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Mask relation semanticsが複数候補に分かれ、製品判断が必要。
- Opacity workflowがstatic opacity editor、keyform authoring、timeline editorのどれを主にするか決めないと進められない。
- Runtime evidence / validator schemaの互換変更が必要。
- Editor UXがfull layer tree / canvas mask editor / drag-and-drop reorderを要求する。
- Preview / Viewer evidenceがfull renderer / pixel oracleなしでは観測不能。
- External dependency、file picker、parser、image decode、Cubism compatibility、actual binary uploadが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、semantic mask relation、minimal drawable opacity evidence、editor-internal Preview / Viewer inspectionに限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave27は次を満たしたときpassとする。

- `setMaskRelation`をauthoring operationとしてdry-run / commitできる。
- Runtimeがmask relation / opacity evidenceをsnapshot / diff / evidenceに残せる。
- Validatorがmask relation / opacity semantic checksをdeterministic diagnosticsとして出せる。
- Editorからmask relationと最小opacity authoringを行い、Preview / Viewer / Runtime surfaceでsemantic evidenceを確認できる。
- Save/loadとdesktop/mobile e2e smokeが通る。
- Existing keyform / drawable / mesh / source / PSD / binary / dynamics / viewer / rig-control workflowsを壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no pixel oracle、no full renderer。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
