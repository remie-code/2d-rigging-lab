# Wave 28 Plan: Part / Texture / Layer Tree Workflow v1

> Wave 28で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 28
- Wave name: `part-texture-layer-tree-workflow-v1`
- Primary objective: 既存のpart / texture / drawable / source-layer足場を、Editorで扱える最小のPart / Texture / Layer Tree workflowとして一周させる。

## 2. 次Wave選定

Wave27でMask / Clipping / Opacity Authoring v1は`pass / implementation-proven`になった。Wave27後の残件リストでは、近いwave候補として次が残っている。

- `Part / texture / layer tree workflow`
- `Mesh editor completion`
- `Tutorial-like MVP mini model`
- `Package Binary/File I/O Decision + Byte Intake Pilot v0`

Wave28では`Part / texture / layer tree workflow`を選ぶ。

理由:

- `ModelPart` schema、drawable `partId` / `textureId`、texture atlas、source layer texture metadata、draw order / runtime visibility、editor state `selection` / `lockedIds` / `editorHiddenIds` の足場がすでにある。
- Wave19はtexture-backed previewとsource layer -> part / texture mapping foundationを閉じたが、既存drawableをpart tree上で再編成し、texture assignmentを確認し、selection / lock / editor-hideをEditor layer treeとして扱う製品workflowはまだ薄い。
- Wave27でcomposition workflowが閉じたため、次は「作ったdrawable群を整理して編集対象として扱う」workflowを厚くするのが自然。
- real PNG/PSD bytes、file picker、archive、image decode、full renderer、pixel oracleを要求しない。

Wave28は「full layer tree editor」や「real texture pipeline完成」ではない。Private Prototypeのeditor product workflowとして、part hierarchy、drawable assignment、texture assignment、layer selection / lock / editor-only hide、Preview / Viewer evidence、save/load smokeをtruthfulに閉じるwaveである。

## 3. Undineコンテキスト保護規約

Wave28でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- Review-Sylphはimplementation notesだけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、UndineはOrch-Sylph / subagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave27は`Completed / implementation-proven`。
- `ModelPartSchema`は`partId`、`displayName`、`parentPartId`、`childPartIds`、`drawableIds`を持つ。
- `DrawableSchema`は`partId`、`textureId`、`runtimeVisibility`、`baseDrawOrder`を持つ。
- `EditorStateFileSchema`は`selection`、`lockedIds`、`editorHiddenIds`を持つ。
- `createDrawableWithMesh`はdrawableをpartへ追加し、source layerへdrawable mappingを反映する。
- Operation catalogには`createPart`、`setDrawablePart`、`setDrawableTexture`に相当するoperationはまだない。
- Wave16でdrawable draw order / runtime visibilityの最小workflowは実装済み。
- Wave19でtexture atlas / preview assets / source layer -> part / texture mapping / texture-backed preview foundationは実装済み。
- Wave27でViewer / Runtimeはsemantic composition evidenceを表示できるが、part tree / editor layer stateの製品workflow evidenceはまだ薄い。

## 5. Design Decisions

- Wave28はMinimum Part / Texture / Layer Tree Workflow v1に限定する。
- Part workflowの最小scopeは、part作成、part display name update、drawable-to-part reassignment、part hierarchy evidenceとする。
- Texture workflowの最小scopeは、既存texture atlas entryへのdrawable texture assignment / replacementと、missing texture diagnosticsのtruthful displayとする。新規image bytesやdecodeは扱わない。
- Layer Tree workflowの最小scopeは、part-grouped drawable tree、selection、lock、editor-only hide、既存runtime visibility / draw order controlsとの区別をEditor上で表現すること。
- `lockedIds`は編集操作のguardであり、runtime outputを変えない。
- `editorHiddenIds`はEditor-only visibilityであり、`runtimeVisibility`とは別のpreview / UI stateとして扱う。
- Preview / Viewerはpart / texture / layer stateをsemantic evidenceとして表示する。pixel-level rendering correctnessはpass条件にしない。
- Existing draw order / runtime visibility / mask / opacity / rig control / dynamics / source / PSD / binary workflowsを壊さない。
- Public `index.ts`はbarrel-onlyを維持する。

## 6. Non-Goals

- Full drag-and-drop layer tree editor。
- Multi-select bulk operations / group transform / reorder generalization。
- Full part tree UX、rename/delete/reparentの全機能。
- Real PNG/PSD bytes intake、image decode、raster extraction、actual binary upload。
- File picker、archive import/export、filesystem integration、external dependency。
- Full renderer、pixel oracle、texture sampling correctness、WebGL/canvas renderer。
- UV editor、atlas packer、mesh topology editor。
- Cubism part / drawable / clipping compatibility。
- General timeline editor、animation export、standalone viewer。
- Broad source organization policy rewrite。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave27/wave27-final-report.md`
- `discussion/implementation/reviews/wave27/wave27-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md` when machine-readable IDs/check IDs are edited
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave28は既存schemaの足場があるため、初手からoperation、runtime/preview evidence、validator、editor draft stateを並列化できる。

ただし、Editor commit workflow、contract fixture、browser e2eはoperation/runtime/validator/editor-stateの最小形に依存するため後段に置く。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Part / texture authoring operation foundation | Parallel with B/C/D | Wave27 complete | `createPart` / `updatePart` / `setDrawablePart` / `setDrawableTexture`相当の最小operationとauthoring mutationを固める |
| 1 | B. Runtime / Preview / Viewer layer-tree evidence | Parallel with A/C/D | Wave27 complete | part hierarchy、drawable part/texture state、editor-hidden/runtime-visible distinctionをsemantic evidenceへ出す |
| 1 | C. Validator part / texture / layer diagnostics | Parallel with A/B/D | Wave27 complete | part cycle、missing part/texture、drawable membership mismatch、locked/editor-hidden evidence gapをdeterministic diagnosticsへ出す |
| 1 | D. Editor layer-tree draft state / view model | Parallel with A/B/C | Wave27 complete | part-grouped tree、selection、lock、editor-hide、texture labelsのstate/UI draftを固める |
| 2 | E. Part / texture / layer contract fixtures | Solo after A/B/C | A + B + C | operation -> package graph -> runtime/viewer evidence -> validator reportのfixtureを固定する |
| 3 | F. Editor workflow integration | Solo after A-D/E | A + B + C + D + E | Editorからpart作成、drawable reassign、texture assignment、select/lock/editor-hideをcommit/observeする |
| 4 | G. Browser e2e persistence smoke | Solo after F | F | desktop/mobileでlayer tree workflow -> save/load -> Viewer/Preview再検査を通す |
| 5 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、map/final report更新を行う |

安全上の制約:

- Aはauthoring-core / operation-coreに限定し、Editor UIやruntime/validator broad implementationには触らない。
- Bはruntime-core / editor-preview / Viewer-facing projectionに限定し、operation handlerやEditor UIには触らない。
- Cはvalidator-coreと必要最小限のvalidator contract docsに限定する。
- DはEditor state / focused layer-tree UI draftに限定し、operation commit wiringには触らない。
- Eはfixtures/contractsとfixture-facing testsを担当し、Editor UIには触らない。
- Fはapps/editorのworkflow/UI統合に限定し、package/runtime/validator broad implementationへ戻らない。必要ならA/B/Cへ差し戻す。
- Gはe2e / smoke / narrow test id or aria tweaksに限定する。
- Hはreports/maps/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave28-part-texture-authoring-operation-foundation`

Purpose:

- Part作成、part display name update、drawable-to-part reassignment、drawable texture assignment / replacementの最小operationを実装または不足分を補強する。
- Authoring session mutation、dry-run / commit、operation log、target refs、model diff、package materializationを通す。
- Missing part、part cycle、duplicate child、missing drawable、missing texture、locked target preconditionをdeterministic diagnosticsとして扱う。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused operation / authoring tests
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- Editor UI implementation
- Full layer tree UI implementation
- External dependency / package manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid part creation/update and drawable part reassignment can dry-run / commit.
- Valid drawable texture assignment can dry-run / commit using an existing texture atlas entry.
- Operation result, target refs, model diff, operation log, and package materialization identify part/texture changes.
- Invalid part/texture targets emit deterministic diagnostics.
- Existing createDrawable, setDrawOrder, setRuntimeVisibility, setMaskRelation, rig-control, dynamics operations remain compatible.

Early escape:

- Part semantics require delete/reparent/full part tree design before minimal workflow can pass.
- Texture assignment requires actual image bytes or decode.
- Operation surface must be split differently to avoid unsafe broad payload changes.

### B. `wave28-runtime-preview-viewer-layer-tree-evidence`

Purpose:

- Runtime snapshot / diff / evidence and editor Preview / Viewer basisにpart hierarchy、drawable part membership、texture assignment、editor-hidden/runtime-visible distinctionをtraceableに出す。
- Layer state is semantic evidence. It is not a full renderer or pixel oracle.

Allowed write scope:

- `packages/runtime-core/src/**`
- `apps/editor/src/editor-preview/**`
- focused runtime / editor-preview tests
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Operation handler implementation
- Validator broad implementation
- Editor UI implementation
- Pixel renderer / WebGL/canvas renderer
- Image decode / actual bitmap texture sampling
- External dependency / manifest changes

Pass evidence:

- Runtime / Viewer-facing evidence lists part hierarchy and drawable membership deterministically.
- Runtime diff/evidence exposes part/texture changes with stable paths.
- Editor Preview can distinguish runtime hidden, editor-hidden, locked, selected, texture unresolved, and texture-backed states truthfully.
- Existing mask / opacity / rig-control / dynamics / viewer runtime tests remain compatible.

Early escape:

- Runtime evidence cannot express part tree without schema redesign.
- Any pass criterion depends on pixel rendering output.
- Editor-only state cannot be projected without broad app shell redesign.

### C. `wave28-validator-part-texture-layer-diagnostics`

Purpose:

- Part / texture / layer semantic checksを追加または補強する。
- Missing part、part parent/child mismatch、part cycle、drawable membership mismatch、missing texture atlas entry、texture/source mismatch、editor-state stale refsをdeterministic diagnosticsとして扱う。
- Editor-only selection/lock/hideはpackage runtime failureにしない。stale refs / unsupported claimsだけをdiagnosticにする。

Allowed write scope:

- `packages/validator-core/src/**`
- validator focused tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad MVP-wide preflight report redesign
- External dependency / manifest changes

Pass evidence:

- Valid part/texture/layer state validates with runtime/viewer evidence.
- Missing/cycle/mismatch cases emit deterministic diagnostics.
- Editor-only hidden/locked/selected stale refs are reported without changing runtime semantics.
- Existing source/PSD/binary/dynamics/viewer/rig-control/mask validators remain compatible.

Early escape:

- Severity policy requires user decision.
- Validator would need to become a renderer or Editor state evaluator.
- Package schema and validator contract disagree on part hierarchy semantics.

### D. `wave28-editor-layer-tree-draft-state-view-model`

Purpose:

- Editor state/view modelにpart-grouped layer tree、drawable selection、lock、editor-only hide、texture labels / missing texture stateを追加する。
- This domain may create focused UI draft components for layer tree display, but it does not commit operations.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**` for focused layer-tree draft/view components
- focused editor state / UI tests
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/**`
- `packages/**`
- e2e files
- Broad app shell redesign
- External dependency / manifest changes

Pass evidence:

- Layer tree view model groups drawables by part and includes texture / runtime visibility / editor-hidden / locked / selected labels.
- Selection, lock, and editor-only hide draft actions update editor state deterministically.
- Editor-only hide is not confused with runtime visibility.
- Existing drawable list / composition / rig-control / source intake UI tests remain compatible.

Early escape:

- UI requires full drag-and-drop tree editor or multi-select bulk workflow.
- Layer-tree state cannot be represented without broad app shell redesign.
- Existing editor-state boundaries are too tangled and need broader refactor.

### E. `wave28-part-texture-layer-contract-fixtures`

Purpose:

- Part / texture / layer workflowのcontract fixtureを固定する。
- Operation result、package materialization、runtime / viewer evidence、validator report、editor-state evidenceをdeterministic fixtureとして残す。

Allowed write scope:

- `fixtures/contracts/**`
- focused fixture tests under operation / runtime / validator packages
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency / manifest changes

Pass evidence:

- Fixture proves part create/update -> drawable reassign -> texture assignment -> runtime/viewer evidence -> validator report.
- Fixture covers at least one invalid part/texture diagnostic.
- Editor-only selection/lock/hide fixture evidence is deterministic and does not claim runtime rendering semantics.
- Expected outputs are deterministic and rights-clean.

Early escape:

- Fixture requires actual image/texture bytes.
- Expected semantic evidence cannot be made deterministic.

### F. `wave28-editor-part-texture-layer-workflow-ux`

Purpose:

- Editorにminimum Part / Texture / Layer Tree workflowを追加する。
- User can create/update a part, assign drawable to part, assign existing texture to drawable, select/lock/editor-hide a layer, and observe semantic evidence in Preview / Viewer.
- User can still use existing draw order / runtime visibility controls without confusing them with editor-only hide.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/editor-app.ts` for narrow app-level callback wiring only
- `apps/editor/src/ui/**` for focused layer-tree / part / texture panel files
- focused editor tests
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Full drag-and-drop tree editor
- Broad app shell redesign
- General renderer rewrite
- External dependency / manifest changes

Pass evidence:

- Editor UI can create/update a part and move an existing drawable into it.
- Editor UI can assign an existing texture atlas entry to a drawable and report missing/unresolved texture truthfully.
- Selection, lock, and editor-only hide are visible and persisted as editor state.
- Preview / Viewer shows part / texture / layer evidence truthfully.
- Save/load restores authored part / texture / layer editor state.
- Desktop/mobile layout and labels remain coherent enough for e2e.

Early escape:

- UI requires broad layer tree redesign.
- Texture assignment requires actual file bytes or image decode.
- Preview/Viewer behavior cannot be expressed without runtime changes beyond Domain B.

### G. `wave28-part-texture-layer-e2e-persistence-smoke`

Purpose:

- Browser smokeでpart作成 -> drawable part reassignment -> texture assignment -> layer select/lock/editor-hide -> Preview / Viewer inspection -> save/load -> reinspectionを確認する。
- Desktop / mobile viewportとbasic accessibility/layoutを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / manifest changes

Pass evidence:

- Part / texture / layer tree workflow passes desktop/mobile smoke.
- Save/load preserves part hierarchy, drawable membership, texture assignment, selected/locked/editor-hidden state.
- Viewer / Runtime surface shows semantic part / texture / layer evidence after load.
- Existing composition/rig-control/dynamics/source/PSD/binary/viewer e2e does not regress, or adjacent smoke coverage is rerun and recorded.

Early escape:

- E2E reveals broad UI architecture issue.
- Browser smoke cannot observe behavior without full renderer / pixel oracle.

### H. `wave28-integration-review-and-final-report`

Purpose:

- Domain A-G completion reportsを統合し、final verification、clean integration review、final report、map更新を行う。
- Source organization、test adequacy、forbidden-scope containment、orchestration complianceをWave28 gateとして確認する。

Allowed write scope:

- `discussion/implementation/waves/wave28/**`
- `discussion/implementation/reviews/wave28/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad test documentation rewrite unless fixture/traceability registration is explicitly needed and narrow.

Pass evidence:

- Final verificationがtypecheck / unit / e2e / source guard / dependency guard / diff checkを含む。
- Clean integration reviewがoperation/runtime/validator/editor/viewer/e2eとorchestration complianceを確認する。
- Final report records residual risks honestly, including no full renderer, no pixel oracle, no real image decode, and no full drag-and-drop layer tree.

## 10. Subagent / Orch-Sylph Execution Policy

Wave28起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / C / DのOrch-Sylphを並列投入する。
2. Domain A / B / Cが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
3. Domain A / B / C / D / Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
4. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
5. Domain Gが`pass`したら、UndineはDomain HをOrch-Sylphに委譲する。
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

- Part Semantics: part hierarchy / drawable membership / stable orderがcoherentか。
- Texture Integrity: texture atlas entry / preview asset / drawable texture assignmentがtruthfulか。
- Layer Tree Semantics: selection / lock / editor-only hide / runtime visibility / draw orderが混同されていないか。
- Operation Integrity: dry-run / commit / operation log / model diff / evidenceがcoherentか。
- Runtime / Viewer Evidence: part / texture / layer state、snapshot / diffが追跡可能か。
- Validator Evidence: part / texture / layer diagnosticsがAI-readableか。
- UI / Accessibility: editor workflowがtruthfulで、desktop/mobile layoutとlabelsが破綻していないか。
- Persistence: save/load後にpart / texture / editor layer stateが残り、viewer snapshotを再計算できるか。
- Non-Goals: full renderer、pixel oracle、Cubism互換、file picker、parser、image decode、external dependency、full drag-and-drop tree editorに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core / editor-preview focused tests、snapshot/diff/evidence tests
- Domain C: validator focused tests、check catalog / contract alignment tests
- Domain D: editor state / layer-tree UI focused tests、editor typecheck
- Domain E: fixture / contract focused tests
- Domain F: editor state / workflow / UI focused tests、editor typecheck
- Domain G: editor e2e smoke、desktop/mobile、save/load、a11y/layout smoke
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for file picker / parser / image decode / archive / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Part hierarchy semanticsがdelete/reparent/full tree editorなしでは決められない。
- Lock / editor-hideの意味がruntime visibilityやvalidation severityと衝突する。
- Texture assignmentがactual image bytes、PNG decode、file picker、archive、external dependencyを要求する。
- Runtime evidence / validator schemaの互換変更が必要。
- Editor UXがfull drag-and-drop layer tree、multi-select bulk edit、full canvas tree editorを要求する。
- Preview / Viewer evidenceがfull renderer / pixel oracleなしでは観測不能。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、semantic part hierarchy、existing texture atlas assignment、editor-only selection/lock/hide、editor-internal Preview / Viewer inspectionに限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave28は次を満たしたときpassとする。

- Part作成 / updateとdrawable part reassignmentをauthoring operationとしてdry-run / commitできる。
- Existing texture atlas entryへのdrawable texture assignmentをauthoring operationとしてdry-run / commitできる。
- Runtime / Preview / Viewerがpart hierarchy、drawable membership、texture assignment、selection/lock/editor-hide/runtime visibilityのsemantic evidenceをtruthfulに残せる。
- Validatorがpart / texture / layer semantic checksをdeterministic diagnosticsとして出せる。
- Editorからpart / texture / layer tree workflowを操作でき、Preview / Viewer / Runtime surfaceでsemantic evidenceを確認できる。
- Save/loadとdesktop/mobile e2e smokeが通る。
- Existing keyform / drawable / mesh / source / PSD / binary / dynamics / viewer / rig-control / mask workflowsを壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no pixel oracle、no full renderer、no full drag-and-drop tree editor。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
