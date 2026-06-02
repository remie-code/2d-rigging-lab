# Wave 32 Plan: WarpLattice2d Rig Control Authoring / Evaluator v0

> Wave32で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave32
- Wave name: `warp-lattice2d-rig-control-authoring-evaluator-v0`
- Primary objective: AC-MVP-009に残っている`warpLattice2d`の穴を、project-defined semantic rig-controlとして1waveで閉じる。Wave25-Wave26の`rotation2d` rig-control / keyform / Viewer evidenceを足場にし、`warpLattice2d`のauthoring、operation/session evidence、runtime semantic evaluator、validator diagnostics、Editor / Preview / Viewer workflow、desktop/mobile e2e smokeまでを最小範囲でimplementation-provenにする。

## 2. 次Wave選定

Wave31でbrowser `<input type=file>` actual-byte intake pilotは完了した。次の候補は、persistent binary/archive、full layer tree、mesh topology/UV、AI repair、public demo boundary、または`warpLattice2d`である。

Wave32では **WarpLattice2d Rig Control Authoring / Evaluator v0** を選ぶ。

理由:

- 直近の残件監査で、AC-MVP-009が`rotation2d`と`warpLattice2d`の両方を要求している一方、Wave25-Wave26は`rotation2d`中心で、`warpLattice2d`はruntime上もunsupported no-op evidenceに留まると整理された。
- 既にpackage schema / runtime normalized graphには`warpLattice2d`の足場があり、外部dependency、PSD parser、image decode、archive、full rendererへ踏み込まずに進められる。
- Persistent binary / archive / PSD parserはユーザー資産、dependency、storage policyに判断ゲートが広がる。Wave32ではそこを増やさず、semantic authoring能力のAC gapを閉じる。
- Full layer treeやmesh topology/UVも重要だが、AC mismatchとして最も明確なのは`warpLattice2d`である。

この選定は「AC-MVP-009を維持する」前提に立つ。もし`warpLattice2d`をMVPから外す方針に変えるなら、実装ではなくAC / scenario / traceability更新waveへ切り替える。

## 3. Undineコンテキスト保護規約

Wave32でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave25でproject-defined `rotation2d` rig-control creation / child binding / runtime hierarchy evidence / validator diagnostics / Editor workflowはimplementation-provenになっている。
- Wave26で`rigControl:angleDegrees` keyform operation / runtime affected drawable evidence / validator hardening / Editor keyform UX / Viewer reinspectionはimplementation-provenになっている。
- `packages/package-format/src/model-files.ts`には`warpLattice2d` rig-control schemaがあり、`bindSpace`、`domainBounds`、`latticeColumns`、`latticeRows`、`restControlPoints`、`interpolationMethod: "bilinear-grid-v1"`を持つ。
- `packages/authoring-core/src/runtime-graph-rig-controls.ts`は`warpLattice2d`をruntime graphへ写せる。
- `packages/runtime-core/src/rig-control-evaluation.ts`は現状、`warpLattice2d`を`evaluationStatus: "unsupported"`、`unsupportedReason: "warpLattice2dEvaluatorFutureScope"`として正直に扱う。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave32の`warpLattice2d`はproject-defined semantic evaluatorであり、Cubism deformer互換を主張しない。
- 最小latticeは2x2以上を許すが、Editor v0は2x2を主動線にする。`restControlPoints.length`は`latticeColumns * latticeRows`と一致させる。
- Runtimeは`domainBounds`内のdrawable verticesに対して`bilinear-grid-v1`のsemantic displacementを適用し、bounds / vertexHash / runtime diff / Viewer evidenceへ反映する。`domainBounds`外のverticesはv0ではpass-throughとする。
- Keyformで動かす最小propertyはproject-definedの`controlPointOffsets`とする。値はcontrol point順の`Vec2[]`で、`replace`と`additiveDelta`だけを許す。Domain Aで最終property名とpatch shapeを固定し、他domainはそこに従う。
- 評価状態は、unsupported no-opから`evaluated` / `disabled` / `blocked`へ昇格する。unsupportedは不正propertyや将来scopeを検出した場合のdiagnosticとして残してよい。
- Editor UIは最小フォームでよい。full canvas lattice gizmo、drag handle editor、timeline editorは含めない。
- Preview / Viewerはsemantic evidenceを表示する。full renderer、pixel oracle、texture sampling correctnessは扱わない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Cubism deformer compatibility、Cubism SDK/Core、Cubism形式import/export。
- Full renderer、pixel oracle、Photoshop-compatible raster correctness。
- Canvas lattice gizmo、free-form lattice editor、advanced timeline editor。
- Direct physics output、cloth/collision/IK、Cubism Physics compatibility。
- Mesh topology editor、UV editor、atlas packing。
- PSD parser、PNG/image decode、archive import/export、persistent binary storage、drag-drop、File System Access API。
- LLM provider integration、external HTTP/WebSocket/MCP transport。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave32-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave25/wave25-final-report.md`
- `discussion/implementation/waves/wave26/wave26-final-report.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave32は既存schemaのfuture footingを実装証拠へ昇格するwaveである。contract / runtime / validator / editor draftを先に並列化し、operation/session/e2eへ合流させる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Warp lattice contract / package footing | Parallel with B/C/D | Wave26 + Wave31 complete | `controlPointOffsets` property、lattice cardinality、runtime evidence shape、package/contract fixture expectationsを固定する |
| 1 | B. Runtime warp lattice evaluator / evidence | Parallel with A/C/D, coordinate schema needs | Existing runtime footing | `unsupported` no-opをsemantic bilinear evaluatorへ昇格し、drawable vertices / bounds / diff / evidenceに反映する |
| 1 | C. Validator warp lattice diagnostics | Parallel with A/B/D, coordinate check IDs | Existing validator rig-control checks | lattice shape、domain bounds、runtime evidence missing/stale/mismatch、unsupported propertyをdeterministic diagnosticsにする |
| 1 | D. Editor warp lattice workflow draft | Parallel with A/B/C | Existing rig-control panel | create/bind/keyform用のstate/view model/UI draftを作る。commit wiringはEへ残す |
| 2 | E. Authoring operation / session integration | Solo after A-D | A + B + C + D | create warp lattice、bind child、add control point offset keyform、operation log / model diff / package materialization / editor-session commandをつなぐ |
| 3 | F. Fixtures and browser e2e smoke | Solo after E | E | deterministic fixtureとdesktop/mobile e2eでcreate -> bind -> keyform -> Preview / Viewer -> save/load再観測を証明する |
| 4 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、map/backlog/current capability更新を行う |

安全上の制約:

- Aはcontract/package/evidence shapeに限定し、Editor UIやruntime algorithmへ踏み込まない。
- Bはruntime-coreに限定し、operation handlerやEditor UIへ触らない。
- Cはvalidator-coreに限定し、operationやEditor UIへ触らない。
- DはEditor draft state / UIに限定し、operation commit / session wiringへ触らない。
- Eはauthoring-core / operation-core / editor-sessionの統合に限定し、runtime algorithmやvalidator broad redesignへ戻らない。
- Fはfixtures / e2eに限定する。UI blockerが出た場合はsource/UI corrective domainへescalateする。
- Gはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave32-warp-lattice-contract-package-footing`

Purpose:

- `warpLattice2d` v0のcontractを固定する。
- `controlPointOffsets`のpatch shape、control point ordering、lattice cardinality、domainBounds扱い、runtime evidence fieldsを明文化し、必要なschema / fixture expectationを小さく追加する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused contracts / package-format tests
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- Runtime algorithm implementation
- Operation handler implementation
- Editor UI implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- `warpLattice2d` package shape and keyform patch convention are deterministic and AI-readable.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave32-runtime-warp-lattice-evaluator-evidence`

Purpose:

- `warpLattice2d`を`unsupported` no-opから最小semantic evaluatorへ昇格する。
- `domainBounds`内のdrawable verticesへbilinear displacementを適用し、bounds / vertexHash / runtime diff / Viewer-facing evidenceへ反映する。

Allowed write scope:

- `packages/runtime-core/src/**`
- focused runtime tests
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Full renderer / pixel oracle
- Cubism deformer compatibility claim
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Enabled `warpLattice2d` evaluates deterministically.
- Disabled / blocked / invalid patch states are explicit.
- Existing `rotation2d` evidence remains stable.

### C. `wave32-validator-warp-lattice-diagnostics`

Purpose:

- `warpLattice2d`のlattice cardinality、domainBounds、restControlPoints、keyform patch shape、runtime evidence、Viewer evidenceをdeterministic diagnosticsへ載せる。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Runtime algorithm implementation
- Broad validator report redesign
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid `warpLattice2d` package/runtime evidence passes.
- Missing/mismatched runtime evidence, invalid lattice shape, stale evidence, unsupported property, and malformed patch emit stable diagnostics.

### D. `wave32-editor-warp-lattice-workflow-draft`

Purpose:

- Editor Rig Controls panelに、2x2 `warpLattice2d` create/bind/keyform draft stateと最小UIを追加する。
- Commit wiringやsession command実装はDomain Eへ残す。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/rig-control-panel/**`
- focused editor state / UI tests
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `packages/**`
- e2e implementation
- Full canvas lattice gizmo
- External dependency / manifest / lockfile changes

Pass evidence:

- UI state can represent 2x2 warp lattice draft and control point offset draft.
- UI copy does not imply Cubism compatibility, pixel render correctness, or full lattice editor.

### E. `wave32-warp-lattice-authoring-operation-session`

Purpose:

- `warpLattice2d` create/bind/keyform commit pathをoperation lifecycleとeditor-sessionへ統合する。
- Operation log、model diff、package materialization、runtime/validator evidence providerを一貫させる。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- narrow wiring in `apps/editor/src/app/**` only if required
- focused operation / authoring / editor-session tests
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- Runtime algorithm redesign
- Validator broad redesign
- Full UI redesign
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Editor/session can commit create/bind/keyform operations for `warpLattice2d`.
- Operation evidence and package materialization are coherent with runtime and validator evidence.

### F. `wave32-warp-lattice-fixtures-and-e2e-smoke`

Purpose:

- Contract fixtureとdesktop/mobile e2eで、create -> bind drawable -> add control point offset keyform -> Preview / Viewer evidence -> save/load再観測を確認する。

Allowed write scope:

- `fixtures/contracts/**`
- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- focused fixture tests
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`

Forbidden:

- Broad editor/source implementation
- E2E assertion weakening to hide evidence mismatch
- Full renderer / pixel oracle assertions
- External dependency / manifest / lockfile changes

Pass evidence:

- E2E verifies semantic deformation evidence and save/load reinspection.
- Fixture proves runtime/validator/editor evidence using rights-clean semantic JSON only.

### G. `wave32-integration-review-and-final-report`

Purpose:

- Domains A-Fを統合し、final verification、clean integration review、final report、map/backlog/current capability更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave32/**`
- `discussion/implementation/reviews/wave32/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless traceability / fixture registration is directly required.

Pass evidence:

- Final verificationがtypecheck / unit / e2e / source guard / dependency guard / diff checkを含む。
- Clean integration reviewがcontract、runtime、validator、editor workflow、e2e、orchestration complianceを確認する。
- Final report records residual risks honestly, including no Cubism deformer compatibility, no full renderer, no pixel oracle, no full lattice gizmo, no PSD/image/archive expansion.

## 10. Subagent / Orch-Sylph Execution Policy

Wave32起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / C / DのOrch-Sylphを並列投入する。
2. Domain A-Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
3. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
4. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
5. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
6. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
7. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
8. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
9. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。

各Orch-Sylph assignmentには、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各domain completion前に最低限以下を確認する。

- Warp Lattice Semantics: project-defined `warpLattice2d`としてdeterministicで説明可能か。
- Contract Shape: `controlPointOffsets`、control point ordering、lattice cardinality、domainBoundsの扱いが一貫しているか。
- Runtime Evidence: vertices、bounds、vertexHash、runtime diff、Viewer evidenceがsemantic deformationを示すか。
- Validator Evidence: invalid/missing/stale/mismatch/unsupported statesがdeterministic diagnosticsになっているか。
- Editor UX: minimum workflowがdesktop/mobileで破綻せず、Cubism互換やpixel rendererを暗示しないか。
- Non-Goals: full renderer、pixel oracle、Cubism compatibility、PSD/image/archive、File System Access API、external dependencyへ逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / package-format focused tests、typecheck
- Domain B: runtime-core focused tests、snapshot/diff regression
- Domain C: validator-core focused tests、diagnostic stability tests
- Domain D: editor state / rig-control panel focused tests、editor typecheck
- Domain E: authoring / operation / editor-session focused tests
- Domain F: focused contract fixture tests、desktop/mobile e2e warp-lattice smoke
- Domain G: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for Cubism compatibility / full renderer / pixel oracle / PSD parser / image decode / archive / File System Access API / external dependency claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- `warpLattice2d`をAC-MVP-009から外すべきだと判断した場合。
- Cubism deformer compatibility、full renderer、pixel oracleが必要になる場合。
- 2x2 minimum form workflowでは成立せず、full canvas lattice gizmoやtimeline editorが必要になる場合。
- `controlPointOffsets`のproperty shapeが既存keyform/operation contractに収まらない場合。
- Runtime evaluatorがdrawable vertex semantic deformationだけでは成立せず、mesh topology/UV/texture samplingへ踏み込む必要が出た場合。
- Parallel domainsが同じfilesを編集する必要を発見した場合。
- Source fileが巨大化し、単一責務分割なしでは実装できない場合。

現時点では、project-defined 2x2 `warpLattice2d`、`controlPointOffsets` keyform、semantic runtime evidence、Editor minimum form workflowに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave32は次を満たしたときpassとする。

- Package/authoring modelが`warpLattice2d`のlattice cardinality、domainBounds、restControlPoints、`controlPointOffsets` keyform conventionを表現できる。
- Editorから2x2 `warpLattice2d` rig controlを作成し、drawableへbindし、control point offset keyformを追加できる。
- Operation log / model diff / package materialization / editor-session evidenceが`warpLattice2d` authoringを記録する。
- Runtimeが`warpLattice2d`をunsupported no-opではなくsemantic evaluatorとして扱い、affected drawable vertices / bounds / vertexHash / runtime diff / Viewer evidenceへ反映する。
- Validatorがvalid warp lattice evidenceを通し、invalid lattice shape、missing/stale runtime evidence、malformed patch、unsupported propertyをdeterministic diagnosticsにする。
- Contract fixtureとdesktop/mobile e2e smokeがcreate -> bind -> keyform -> Preview / Viewer -> save/load再観測を確認する。
- No Cubism deformer compatibility claim、no full renderer、no pixel oracle、no full lattice gizmo、no PSD parser、no PNG/image decode、no archive import/export、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
