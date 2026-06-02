# Wave 30 Plan: Tutorial-like MVP Mini Model v0

> Wave 30で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 30
- Wave name: `tutorial-like-mvp-mini-model-v0`
- Primary objective: これまで個別に実装証明してきたauthoring / runtime / validator / editor / viewer sliceを、rights-clean synthetic tutorial mini model制作workflowとして一周させる。

## 2. 次Wave選定

Wave29でCanvas Mesh Editing v1は`pass / implementation-proven`になった。Wave29後の近い候補は主に次である。

- `Tutorial-like MVP mini model`
- `Package Binary/File I/O Decision + Byte Intake Pilot v0`
- `Full layer tree / part tree UX expansion`
- `Mesh topology / UV editor expansion`

Wave30では`Tutorial-like MVP mini model`を選ぶ。ただし、完成したチュートリアル教材や公開可能なsample distributionではなく、**Tutorial-like MVP Mini Model v0** として、Private Prototype内で1体の小さなsynthetic character modelを作る最小統合waveに切る。

理由:

- Wave27でmask / clipping / opacity、Wave28でpart / texture / layer tree、Wave29でcanvas mesh editingが閉じたため、MVPの主要authoring sliceを1つの制作flowへ束ねる時期に来ている。
- topology / UV editorへ進む前に、既存能力だけで「小さなモデルが作れる」証拠を作る方が、次の不足箇所を見つけやすい。
- actual binary bytes、file picker、PSD parser、image decode、archiveは依然としてrights / security / dependency判断ゲートが重い。Wave30では触れない。
- Tutorial-like integrationは、次にAI repair / validator preflight / demo-safe captureへ進む前の良い中間ゲートになる。

## 3. Undineコンテキスト保護規約

Wave30でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- Review-Sylphはimplementation notesだけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave15-Wave29で、generated drawable / deterministic mesh、layer controls、source metadata intake、texture-backed preview、part / texture / layer tree、mask / opacity、dynamics、Viewer / Runtime、rig control、rig-control keyform、canvas mesh editingは個別にimplementation-provenになっている。
- Editorはbrowser-local save/load、operation log、Preview / Viewer / Runtime surfaces、validation diagnostics、AI dry-run/read foundationを持つ。
- Current Viewerはeditor-internal semantic inspection surfaceであり、standalone app / full renderer / pixel oracleではない。
- Real PSD parser、PNG/image decode、file picker、archive import/export、actual binary upload、external dependencyは未実装であり、Wave30のnon-goalである。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave30のtutorial modelはrights-clean synthetic modelとする。外部画像、実PSD/PNG bytes、file picker、archive、image decodeは使わない。
- Tutorial mini modelは「小さな胸上モデル」を目標にする。最小構成は`body`、`head`、`face`、`mouth`、`eye`、`front_hair`、任意の`arm`程度に限定する。
- Tutorial recipeは既存operation / editor workflowの組み合わせで作る。新しい万能`createWholeModel` operationを追加しない。
- Tutorial outputはsemantic package / editor-state / runtime-viewer evidenceで証明する。pixel rendererや見た目の完成度をpass条件にしない。
- Modelは少なくとも次の能力を横断する:
  - part hierarchy / layer selection
  - generated drawable / mesh and canvas mesh edit evidence
  - existing texture metadata assignment
  - mask relation or opacity evidence
  - rotation2d rig control and keyform
  - minimal dynamics group evidence
  - Preview / Viewer / Validator report
  - browser-local save/load
- Tutorial UIは「minimum guided workflow」とする。完成教材、長文チュートリアル、動画、public demo captureは含めない。

## 6. Non-Goals

- Real PSD / PNG / image bytes intake。
- File picker、drag-drop actual files、File System Access API。
- Image decode、raster extraction、texture sampling correctness。
- Package archive import/export。
- External dependency、package manifest / lockfile change。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Mesh topology editor、UV editor、automatic triangulation。
- Advanced dynamics / physics / collision / IK。
- Full timeline editor、motion export、lip sync。
- Public tutorial documentation、demo capture scene、distribution-ready sample asset。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave29/wave29-final-report.md`
- `discussion/implementation/reviews/wave29/wave29-clean-integration-review.md`

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
- relevant Wave15-Wave29 final reports as needed by domain
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave30は統合waveだが、初手はrecipe / runtime evidence / validator preflight / editor stateを並列化できる。

ただし、full tutorial fixture、Editor guided workflow、browser e2eは前段domainの成果に依存する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Tutorial mini model recipe foundation | Parallel with B/C/D | Wave29 complete | rights-clean synthetic mini model recipe / seed / operation sequence基盤を固める |
| 1 | B. Runtime / Viewer tutorial evidence summary | Parallel with A/C/D | Wave29 complete | tutorial modelの横断runtime / viewer evidence summaryを作る |
| 1 | C. Tutorial readiness validator / preflight | Parallel with A/B/D | Wave29 complete | mini modelが必要sliceを満たすかdeterministicに診断する |
| 1 | D. Editor tutorial state / guided workflow draft | Parallel with A/B/C | Wave29 complete | guided workflow state、step labels、selection/readiness view modelを固める |
| 2 | E. Tutorial mini model contract fixtures | Solo after A/B/C | A + B + C | recipe -> package -> runtime/viewer -> validator/preflightのfixtureを固定する |
| 3 | F. Editor tutorial mini model workflow UX | Solo after A-D/E | A + B + C + D + E | Editorからsynthetic mini modelを作り、Preview / Viewer / validationへつなぐ |
| 4 | G. Browser e2e tutorial model smoke | Solo after F | F | desktop/mobileでcreate tutorial model -> inspect/edit -> save/load -> reinspectionを通す |
| 5 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはrecipe / operation sequence / package materialization foundationに限定し、Editor UIやruntime/validator broad implementationには触らない。
- Bはruntime-core / editor-preview / Viewer-facing projectionに限定し、operation handlerやEditor UIには触らない。
- Cはvalidator-coreと必要最小限のvalidator contract docsに限定する。
- DはEditor state / UI draftに限定し、operation commit wiringには触らない。
- Eはfixtures/contractsとfixture-facing testsを担当し、Editor UIには触らない。
- Fはapps/editorのworkflow/UI統合に限定し、package/runtime/validator broad implementationへ戻らない。必要ならA/B/Cへ差し戻す。
- Gはe2e / smoke / narrow test id or aria tweaksに限定する。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave30-tutorial-mini-model-recipe-foundation`

Purpose:

- Rights-clean synthetic tutorial mini modelのrecipe / seed / operation sequence基盤を実装する。
- Existing operationsを組み合わせ、part / texture / mesh / mask / rig-control / keyform / dynamics / editor-state evidenceへつながるdeterministic inputを作る。
- 新しい万能operationではなく、既存operation lifecycleとpackage materializationに乗る形を優先する。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused recipe / operation sequence tests
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Editor UI implementation
- Runtime evaluator broad implementation
- Validator broad implementation
- Real asset bytes / parser / image decode
- External dependency / package manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Synthetic tutorial recipe can deterministically produce a model with parts, drawables, meshes, texture metadata, mask/opacity, rig-control keyform, and dynamics evidence inputs.
- Operation sequence is auditable through operation log / model diff / package materialization.
- Existing operation lifecycle remains compatible.

Early escape:

- Tutorial model requires actual image bytes or parser.
- Existing operation lifecycle cannot express the recipe without a broad new operation.
- Minimum model spec is too ambiguous to implement safely.

### B. `wave30-runtime-viewer-tutorial-evidence-summary`

Purpose:

- Tutorial mini modelのruntime / Preview / Viewer evidenceを横断summaryとして表示・検証しやすくする。
- part / layer / mesh / mask / rig / keyform / dynamicsのpresenceと主要refsをAI-readableにする。

Allowed write scope:

- `packages/runtime-core/src/**`
- `apps/editor/src/editor-preview/**`
- focused runtime / editor-preview tests
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Operation handler implementation
- Validator broad implementation
- Editor UI implementation
- Full renderer / pixel oracle
- Real image decode / texture sampling correctness
- External dependency / manifest changes

Pass evidence:

- Runtime / Viewer summary reports tutorial model parts, drawables, mesh edits, mask/opacity, rig-control keyform, and dynamics evidence deterministically.
- Summary distinguishes semantic readiness from rendered correctness.
- Existing Viewer / Runtime tests remain compatible.

Early escape:

- Summary requires shared schema redesign beyond Wave30.
- Evidence requires full renderer / pixel oracle.

### C. `wave30-tutorial-readiness-validator-preflight`

Purpose:

- Tutorial mini model readinessをvalidator / preflightとして追加する。
- Required slicesのpresence、stale evidence、missing refs、unsupported claimsをdeterministic diagnosticsとして出す。

Allowed write scope:

- `packages/validator-core/src/**`
- validator focused tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Operation handler implementation
- Runtime evaluator implementation
- Editor UI implementation
- Broad MVP-wide preflight redesign beyond tutorial readiness
- External dependency / manifest changes

Pass evidence:

- Valid tutorial mini model passes readiness profile.
- Missing part / mesh / mask / rig / keyform / dynamics / viewer evidence cases emit deterministic diagnostics.
- Unsupported real-asset / renderer / Cubism claims are rejected or reported truthfully.

Early escape:

- Readiness profile becomes a broad MVP product report instead of tutorial-specific gate.
- Severity policy requires user decision.

### D. `wave30-editor-tutorial-state-guided-workflow-draft`

Purpose:

- Editor state/view modelにtutorial recipe state、guided step status、readiness summary、selected tutorial targetを追加する。
- This domain may create focused UI draft components for display, but it does not commit operations.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**` for focused tutorial draft/view components
- focused editor state / UI tests
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/**`
- `packages/**`
- e2e files
- Broad app shell redesign
- External dependency / manifest changes

Pass evidence:

- View model can represent tutorial steps and readiness state deterministically.
- Steps map to existing capabilities without claiming real asset import or full renderer.
- Existing editor state workflows remain compatible.

Early escape:

- Guided workflow needs broad app shell redesign.
- Step semantics require unresolved user-facing tutorial content decisions.

### E. `wave30-tutorial-mini-model-contract-fixtures`

Purpose:

- Tutorial mini modelのcontract fixtureを固定する。
- Recipe / operation sequence -> package graph -> runtime/viewer evidence -> validator readiness report -> editor-state readiness evidenceをdeterministic fixtureとして残す。

Allowed write scope:

- `fixtures/contracts/**`
- focused fixture tests under operation / runtime / validator packages
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Editor UI implementation
- Runtime/validator broad implementation beyond fixture-facing fixes
- Pixel-level renderer oracle
- Real asset bytes / PSD parser / image decode fixtures
- External dependency / manifest changes

Pass evidence:

- Fixture proves the tutorial mini model crosses part / texture / mesh / mask / rig / keyform / dynamics / viewer / validator evidence.
- Fixture covers at least one invalid readiness diagnostic.
- Expected outputs are deterministic and rights-clean.

Early escape:

- Fixture requires actual image/texture bytes.
- Expected semantic evidence cannot be made deterministic.

### F. `wave30-editor-tutorial-mini-model-workflow-ux`

Purpose:

- Editorにminimum guided workflowを追加し、synthetic tutorial mini modelを作成・検査できるようにする。
- User can create the tutorial model, inspect its parts/layers/mesh/rig/dynamics/mask evidence, perform a small existing edit, and observe Preview / Viewer / Validator readiness.

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/editor-app.ts` for narrow app-level callback wiring only
- `apps/editor/src/ui/**` for focused tutorial workflow files
- focused editor tests
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Runtime evaluator broad implementation
- Validator broad implementation
- File picker / asset I/O / parser / image decode
- Full renderer / pixel oracle
- Public tutorial content system
- Broad app shell redesign
- External dependency / manifest changes

Pass evidence:

- Editor UI can create or load the synthetic tutorial mini model.
- Guided workflow surfaces readiness steps truthfully.
- Preview / Viewer shows the mini model semantic evidence.
- Save/load restores the mini model and readiness state.
- Existing major workflows remain compatible.

Early escape:

- UI requires broad tutorial/content architecture.
- Tutorial workflow requires real assets, renderer, or parser.
- Existing editor state/session boundaries cannot support the integration without broad refactor.

### G. `wave30-tutorial-mini-model-e2e-persistence-smoke`

Purpose:

- Browser smokeでcreate tutorial mini model -> inspect readiness -> perform small edit -> Preview / Viewer inspection -> save/load -> reinspectionを確認する。
- Desktop / mobile viewportとbasic accessibility/layoutを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`

Forbidden:

- Broad editor implementation
- Runtime/operation/validator broad fixes without domain差し戻し
- Asset I/O / file picker / parser / image decode work
- External dependency / manifest changes

Pass evidence:

- Tutorial mini model workflow passes desktop/mobile smoke.
- Save/load preserves tutorial package, editor-state readiness, and Viewer / Runtime evidence.
- Existing part/texture/layer, mesh, mask/opacity, rig-control, dynamics, source/PSD/binary, and viewer e2e do not regress, or adjacent smoke coverage is rerun and recorded.

Early escape:

- E2E reveals broad UI architecture issue.
- Browser smoke cannot observe behavior without full renderer / pixel oracle.

### H. `wave30-integration-review-and-final-report`

Purpose:

- Domain A-G completion reportsを統合し、final verification、clean integration review、final report、map/backlog更新を行う。
- Source organization、test adequacy、forbidden-scope containment、orchestration complianceをWave30 gateとして確認する。

Allowed write scope:

- `discussion/implementation/waves/wave30/**`
- `discussion/implementation/reviews/wave30/**`
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
- Final report records residual risks honestly, including no real assets, no parser, no full renderer, no pixel oracle, no public tutorial asset distribution.

## 10. Subagent / Orch-Sylph Execution Policy

Wave30起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Tutorial Model Coherence: parts / layers / drawables / meshes / rig / dynamics / masks / keyformsが1つのmini modelとしてcoherentか。
- Operation Integrity: recipe / operation sequence / dry-run / commit / operation log / model diff / evidenceがcoherentか。
- Runtime / Viewer Evidence: tutorial readinessと各slice evidenceが追跡可能か。
- Validator Evidence: tutorial readiness diagnosticsがAI-readableか。
- UI / Accessibility: guided workflowがtruthfulで、desktop/mobile layoutとlabelsが破綻していないか。
- Persistence: save/load後にtutorial model、editor state、Viewer / Runtime evidenceを再計算できるか。
- Non-Goals: real asset bytes、file picker、parser、image decode、archive、full renderer、pixel oracle、Cubism互換、public sample distributionに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / runtime / validator / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、operation lifecycle tests、typecheck
- Domain B: runtime-core / editor-preview focused tests、viewer evidence tests
- Domain C: validator focused tests、readiness / diagnostic tests
- Domain D: editor state / guided workflow draft focused tests、editor typecheck
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

- Tutorial mini modelに実PSD/PNG bytes、file picker、image decode、archiveが必要になる。
- Tutorial workflowがpublic sample distributionやdemo capture policyを要求する。
- Minimum model specが既存sliceで表現できず、新しい大きなdomain primitiveが必要になる。
- UIが大規模tutorial/content architectureを要求する。
- Runtime / Viewer evidenceがfull renderer / pixel oracleなしでは観測不能。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、rights-clean synthetic model、existing operations、semantic Preview / Viewer / Validator evidenceに限定するなら、追加のユーザー判断は不要。

## 14. Pass Criteria

Wave30は次を満たしたときpassとする。

- Rights-clean synthetic tutorial mini modelをEditorまたはcontract fixtureからdeterministically作成できる。
- Mini modelはpart / texture / layer / mesh / mask or opacity / rig-control keyform / dynamicsを横断する。
- Operation log、model diff、package materialization、runtime / viewer evidence、validator readiness reportが一貫して残る。
- Editor guided workflowでmini modelを作成・検査でき、Preview / Viewer / Validator readinessを確認できる。
- Save/loadとdesktop/mobile e2e smokeが通る。
- Existing part/texture/layer、mesh、mask/opacity、rig-control、dynamics、source/PSD/binary、viewer workflowsを壊していない。
- No external dependency、no file picker/parser/archive/image decode/actual binary upload、no Cubism compatibility claim、no pixel oracle、no full renderer、no public sample distribution。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
