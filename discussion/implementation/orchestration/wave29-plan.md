# Wave 29 Plan: Canvas Mesh Editing v1

> Wave 29で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 29
- Wave name: `canvas-mesh-editing-v1`
- Primary objective: Wave17のrow/button based mesh vertex nudgeを、Editor上の最小canvas mesh editing workflowへ拡張する。

## 2. 次Wave選定

Wave28でPart / Texture / Layer Tree Workflow v1は`pass / implementation-proven`になった。Wave28後の近い候補は主に次の4つである。

- `Mesh editor completion`
- `Tutorial-like MVP mini model`
- `Package Binary/File I/O Decision + Byte Intake Pilot v0`
- `Full layer tree / part tree UX expansion`

Wave29では`Mesh editor completion`を直接の候補として選ぶ。ただし、1waveで「full mesh editor」を名乗らない。範囲は **Canvas Mesh Editing v1** に切る。

理由:

- Wave17で`moveMeshVertex` operation、stable `vertexStableIds`、runtime evidence、editor row nudge、save/load、desktop/mobile e2eは既に実装証明済み。
- Wave28でpart / texture / layer selection、lock、editor-hide、Viewer evidenceが閉じたため、mesh editing対象のdrawableをEditor上で選び、編集guardとPreview / Viewer evidenceへつなぐ足場が整った。
- Tutorial-like MVP mini modelへ進む前に、GUI上で「頂点を直接選んで動かす」証拠を作る方が、後続の小モデル制作workflowを組みやすい。
- Asset I/O / PSD parser / actual image bytesは、dependency、rights、security、file picker、archive方針の判断ゲートが重く、次waveで安全に混ぜない方がよい。

Wave29は、canvas drag / multi-vertex translate / mesh selection / topology diagnostics / semantic Preview-Viewer evidenceを扱う。UV editor、mesh topology editing、triangulation algorithm、full renderer、pixel oracleは含めない。

## 3. Undineコンテキスト保護規約

Wave29でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- Review-Sylphはimplementation notesだけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave17はgenerated drawable / deterministic meshを対象に、row/button based `moveMeshVertex` nudgeをoperation、runtime evidence、editor preview、operation log、package file set、browser-local save/load、desktop/mobile e2eまで証明した。
- `moveMeshVertex` payloadは複数`vertexDeltas`を扱える。既存UIは主に1頂点row nudgeで使っている。
- Meshは`vertices`、`uvs`、`triangles`、`vertexStableIds`を持つ。
- Runtime / previewはmesh polygon and geometry summaryを扱うが、full rendererやpixel-level mesh correctness oracleはない。
- Wave28でlayer selection、lockedIds、editorHiddenIds、part/texture/layer evidenceが追加された。
- `index.ts`はbarrel-onlyを維持する必要がある。

## 5. Design Decisions

- Wave29の最小scopeは、canvas上でmesh verticesを選択し、単一または複数頂点をtranslateして、既存`moveMeshVertex` operationでcommitすること。
- Multi-vertex translateは、既存operationの複数`vertexDeltas`を使う。新operation追加は必要な場合だけに限定する。
- Canvas dragはSVG / DOM / pointer event levelのsemantic interactionとする。WebGL/canvas rendererやpixel oracleは使わない。
- Topology/UVは直接編集しない。ただし、validatorとPreview / Viewer evidenceはtriangle index、degenerate triangle、vertexStableIds length、UV count mismatchをdeterministicに報告できるようにする。
- Locked layerはmesh edit commitをguardする。editor-only hideはruntime outputを変えず、編集対象のUI表示/選択にだけ影響する。
- Preview / Viewerはmesh selection、moved vertices、bounds / vertex hash / topology summaryをsemantic evidenceとして表示する。
- Save/load後もmesh edit selection stateの必要最小限とmesh coordinate変更が復元・再観測できるようにする。

## 6. Non-Goals

- Full mesh topology editor。
- Vertex / edge / face creation or deletion。
- Automatic triangulation / retopology。
- Full UV editor or atlas packing。
- Texture sampling correctness。
- Full renderer、pixel oracle、WebGL/canvas renderer correctness。
- Cubism deformer compatibility。
- Keyform-scoped mesh vertex edits。
- Physics / dynamics direct vertex simulation。
- File picker、parser、image decode、archive import/export、actual binary upload、external dependency。
- Tutorial-like complete character model制作。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave29-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/implementation/reviews/wave28/wave28-clean-integration-review.md`

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

Wave29は既存`moveMeshVertex`とWave28 layer workflowがあるため、operation hardening、runtime/preview evidence、validator diagnostics、editor canvas stateを初手から並列化できる。

ただし、contract fixture、Editor workflow integration、browser e2eは前段domainの成果に依存するため後段に置く。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Mesh edit operation hardening | Parallel with B/C/D | Wave17 + Wave28 complete | multi-vertex translate、lock-aware precondition bridge、operation diff/evidenceを固める |
| 1 | B. Runtime / Preview / Viewer mesh edit evidence | Parallel with A/C/D | Wave17 + Wave28 complete | moved vertices、selection、bounds/hash、topology summaryをsemantic evidenceへ出す |
| 1 | C. Validator mesh topology diagnostics | Parallel with A/B/D | Wave17 + Wave28 complete | triangle index、degenerate triangle、vertexStableIds/UV mismatch、stale selectionをdeterministic diagnosticsへ出す |
| 1 | D. Editor canvas mesh selection state / view model | Parallel with A/B/C | Wave17 + Wave28 complete | hit testing、single/multi selection、drag command draft、locked/editor-hidden distinctionを固める |
| 2 | E. Mesh edit contract fixtures | Solo after A/B/C | A + B + C | multi-vertex translate -> package graph -> runtime/viewer evidence -> validator reportのfixtureを固定する |
| 3 | F. Editor canvas mesh workflow UX | Solo after A-D/E | A + B + C + D + E | Editorからcanvas select/drag/nudge/commit、Preview / Viewer observation、save/loadを通す |
| 4 | G. Browser e2e persistence smoke | Solo after F | F | desktop/mobileでcanvas mesh editing -> save/load -> Viewer/Preview再検査を通す |
| 5 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはauthoring-core / operation-coreに限定し、Editor UIやruntime/validator broad implementationには触らない。
- Bはruntime-core / editor-preview / Viewer-facing projectionに限定し、operation handlerやEditor UIには触らない。
- Cはvalidator-coreと必要最小限のvalidator contract docsに限定する。
- DはEditor state / focused canvas mesh edit view modelに限定し、operation commit wiringには触らない。
- Eはfixtures/contractsとfixture-facing testsを担当し、Editor UIには触らない。
- Fはapps/editorのworkflow/UI統合に限定し、package/runtime/validator broad implementationへ戻らない。必要ならA/B/Cへ差し戻す。
- Gはe2e / smoke / narrow test id or aria tweaksに限定する。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave29-mesh-edit-operation-hardening`

Purpose:

- Existing `moveMeshVertex`をCanvas Mesh Editing v1に耐える形へhardeningする。
- 複数頂点translate、operation log、target refs、model diff、package materialization、no-op / duplicate / missing vertex diagnosticsを確認・補強する。
- Editor locked layer guardと矛盾しないprecondition bridgeを設計する。operation-coreがeditor stateを直接知る必要がある場合はescalateする。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused operation / authoring tests
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- Editor UI implementation
- Topology creation/deletion operation
- External dependency / package manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Multi-vertex translate dry-run / commit works through existing or narrowly extended `moveMeshVertex`.
- Model diff and operation log identify every moved stable vertex.
- Invalid missing/duplicate/empty/no-op cases remain deterministic.
- Existing single vertex row nudge workflow remains compatible.

Early escape:

- Canvas editing requires a new broad operation family rather than bounded `moveMeshVertex` hardening.
- Lock semantics require operation-core to depend on editor-state.
- Topology edit becomes necessary for pass.

### B. `wave29-runtime-preview-viewer-mesh-edit-evidence`

Purpose:

- Runtime / Preview / ViewerにCanvas Mesh Editing v1のsemantic evidenceを追加または補強する。
- Moved vertices、selected vertices、bounds / vertex hash、topology summary、editor-hidden/runtime-visible/locked distinctionをtraceableにする。

Allowed write scope:

- `packages/runtime-core/src/**`
- `apps/editor/src/editor-preview/**`
- focused runtime / editor-preview tests
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Operation handler implementation
- Validator broad implementation
- Editor UI implementation
- Pixel renderer / WebGL/canvas renderer
- Image decode / actual bitmap texture sampling
- External dependency / manifest changes

Pass evidence:

- Runtime / Viewer-facing evidence lists mesh vertices, moved vertex refs, bounds/hash, and topology summary deterministically.
- Preview can distinguish selected, moved, locked, editor-hidden, runtime-hidden, and texture-backed states truthfully.
- Existing mask / part / texture / rig-control / dynamics / viewer runtime tests remain compatible.

Early escape:

- Evidence cannot be expressed without shared schema redesign.
- Any pass criterion depends on pixel rendering output.
- Preview evidence requires broad app shell redesign.

### C. `wave29-validator-mesh-topology-diagnostics`

Purpose:

- Mesh semantic checksを追加または補強する。
- Invalid triangle index、degenerate triangle、vertexStableIds length mismatch、UV count mismatch、stale selected vertex refs、missing mesh evidenceをdeterministic diagnosticsとして扱う。

Allowed write scope:

- `packages/validator-core/src/**`
- validator focused tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad MVP-wide preflight report redesign
- External dependency / manifest changes

Pass evidence:

- Valid mesh edit state validates with runtime/viewer evidence.
- Invalid triangle/UV/stable-id/stale-selection cases emit deterministic diagnostics.
- Editor-only selection issues do not become runtime rendering failures.
- Existing validators remain compatible.

Early escape:

- Severity policy requires user decision.
- Validator would need to become a renderer or triangulator.
- Package schema and validator contract disagree on mesh semantics.

### D. `wave29-editor-canvas-mesh-selection-view-model`

Purpose:

- Editor state/view modelにcanvas mesh selection、hit testing、multi-selection、drag command draft、keyboard/numeric nudge draft、locked/editor-hidden distinctionを追加する。
- This domain may create focused UI draft components for canvas mesh edit display, but it does not commit operations.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**` for focused mesh canvas draft/view components
- focused editor state / UI tests
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/**`
- `packages/**`
- e2e files
- Broad app shell redesign
- External dependency / manifest changes

Pass evidence:

- View model can project editable mesh vertices to canvas coordinates and hit targets.
- Single and multi selection state is deterministic.
- Drag/nudge draft commands can be produced without committing operations.
- Locked/editor-hidden/runtime-hidden distinctions are clear.

Early escape:

- UI requires full canvas editor architecture rewrite.
- Multi-selection cannot be represented without broad app shell redesign.
- Direct manipulation requires renderer/pixel oracle.

### E. `wave29-mesh-edit-contract-fixtures`

Purpose:

- Canvas Mesh Editing v1のcontract fixtureを固定する。
- Multi-vertex translate、package materialization、runtime / viewer evidence、validator report、editor-state selection evidenceをdeterministic fixtureとして残す。

Allowed write scope:

- `fixtures/contracts/**`
- focused fixture tests under operation / runtime / validator packages
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency / manifest changes

Pass evidence:

- Fixture proves generated mesh -> multi-vertex translate -> runtime/viewer evidence -> validator report.
- Fixture covers at least one invalid topology diagnostic.
- Editor-only selection evidence is deterministic and does not claim runtime rendering semantics.

Early escape:

- Fixture requires actual image/texture bytes.
- Expected semantic evidence cannot be made deterministic.

### F. `wave29-editor-canvas-mesh-workflow-ux`

Purpose:

- Editorにminimum canvas mesh editing workflowを追加する。
- User can select mesh vertices on a canvas/SVG surface, drag or nudge them, commit through existing operation lifecycle, observe semantic Preview / Viewer evidence, and save/load.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/editor-app.ts` for narrow app-level callback wiring only
- `apps/editor/src/ui/**` for focused mesh canvas / mesh edit panel files
- focused editor tests
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Full topology/UV editor
- Broad app shell redesign
- General renderer rewrite
- External dependency / manifest changes

Pass evidence:

- Editor UI can select one or more mesh vertices and move them through operation lifecycle.
- Locked layers block mesh edits without committing operations.
- Preview / Viewer shows moved vertices and mesh evidence truthfully.
- Save/load restores mesh coordinates and minimum editor mesh selection state.
- Existing row nudge and drawable/layer/part workflows remain compatible.

Early escape:

- UI requires broad canvas architecture redesign.
- Mesh edit requires topology mutation or triangulation.
- Preview/Viewer behavior cannot be expressed without runtime changes beyond Domain B.

### G. `wave29-canvas-mesh-edit-e2e-persistence-smoke`

Purpose:

- Browser smokeでcreate/import drawable -> generate mesh -> select vertex on canvas -> multi-vertex or drag/nudge edit -> Preview / Viewer inspection -> save/load -> reinspectionを確認する。
- Desktop / mobile viewportとbasic accessibility/layoutを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / manifest changes

Pass evidence:

- Canvas mesh edit workflow passes desktop/mobile smoke.
- Save/load preserves moved vertices and mesh evidence.
- Viewer / Runtime surface shows semantic mesh edit evidence after load.
- Existing mesh row nudge, part/texture/layer, composition, rig-control, dynamics, source/PSD/binary, and viewer e2e do not regress, or adjacent smoke coverage is rerun and recorded.

Early escape:

- E2E reveals broad UI architecture issue.
- Browser smoke cannot observe behavior without full renderer / pixel oracle.

### H. `wave29-integration-review-and-final-report`

Purpose:

- Domain A-G completion reportsを統合し、final verification、clean integration review、final report、map/backlog更新を行う。
- Source organization、test adequacy、forbidden-scope containment、orchestration complianceをWave29 gateとして確認する。

Allowed write scope:

- `discussion/implementation/waves/wave29/**`
- `discussion/implementation/reviews/wave29/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad test documentation rewrite unless fixture/traceability registration is explicitly needed and narrow.

Pass evidence:

- Final verificationがtypecheck / unit / e2e / source guard / dependency guard / diff checkを含む。
- Clean integration reviewがoperation/runtime/validator/editor/viewer/e2eとorchestration complianceを確認する。
- Final report records residual risks honestly, including no topology editor, no UV editor, no full renderer, no pixel oracle, no real image decode, and no full canvas renderer.

## 10. Subagent / Orch-Sylph Execution Policy

Wave29起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / C / DのOrch-Sylphを並列投入する。
2. Domain A / B / Cが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
3. Domain A / B / C / D / Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
4. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
5. Domain Gが`pass`したら、UndineはDomain HをOrch-Sylphに委譲する。
6. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
7. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
8. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
9. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
10. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。

各Orch-Sylph assignmentには、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各domain completion前に最低限以下を確認する。

- Mesh Edit Semantics: selected vertices / moved vertices / bounds / stable IDsがcoherentか。
- Operation Integrity: dry-run / commit / operation log / model diff / evidenceがcoherentか。
- Runtime / Viewer Evidence: mesh edit state、snapshot / diff、Preview / Viewer evidenceが追跡可能か。
- Validator Evidence: topology / UV / stable ID diagnosticsがAI-readableか。
- UI / Accessibility: canvas edit workflowがtruthfulで、desktop/mobile layoutとlabelsが破綻していないか。
- Persistence: save/load後にmesh coordinateと必要最小限のeditor selection stateが残り、viewer snapshotを再計算できるか。
- Non-Goals: topology editor、UV editor、full renderer、pixel oracle、Cubism互換、file picker、parser、image decode、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core / editor-preview focused tests、snapshot/diff/evidence tests
- Domain C: validator focused tests、check catalog / contract alignment tests
- Domain D: editor state / canvas mesh UI draft focused tests、editor typecheck
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

- Canvas mesh editingがfull renderer / pixel oracleなしでは観測不能。
- Multi-vertex editにtopology mutation、triangulation、UV editorが必須になる。
- Lock / editor-hideの意味がruntime visibilityやvalidator severityと衝突する。
- Existing `moveMeshVertex`では支えられず、広いoperation family設計が必要になる。
- Editor UXが大規模canvas architecture rewriteを要求する。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、existing `moveMeshVertex`、SVG/semantic canvas interaction、editor-only selection、Preview / Viewer text/DTO evidenceに限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave29は次を満たしたときpassとする。

- Canvas/SVG上でmesh vertexを選択し、単一または複数頂点をmoveできる。
- Moveはauthoring operationとしてdry-run / commitでき、operation log、model diff、package materializationに残る。
- Runtime / Preview / Viewerがmoved vertices、bounds/hash、topology summary、selection/lock/editor-hide/runtime visibilityのsemantic evidenceをtruthfulに残せる。
- Validatorがmesh topology / stable ID / UV consistency checksをdeterministic diagnosticsとして出せる。
- Editorからcanvas mesh edit workflowを操作でき、Preview / Viewer / Runtime surfaceでsemantic evidenceを確認できる。
- Save/loadとdesktop/mobile e2e smokeが通る。
- Existing mesh row nudge、part/texture/layer、mask/opacity、rig-control、dynamics、source/PSD/binary、viewer workflowsを壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no pixel oracle、no full renderer、no topology editor、no UV editor。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
