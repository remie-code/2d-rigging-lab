# Wave 33 Plan: Layer Tree Direct Manipulation / Part Tree UX v0

> Wave33で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave33
- Wave name: `layer-tree-direct-manipulation-part-tree-ux-v0`
- Primary objective: Wave28のminimum form-based Part / Texture / Layer Tree Workflowを、実際のtree上で扱いやすい製品UXへ拡張する。既存`createPart` / `updatePart` / `setDrawablePart` / `setDrawableTexture`を活かしつつ、tree上のrename、reparent、drawable reassignment、texture assignment、selection / lock / editor-hide維持、empty-leaf part deleteを、operation evidence、validator/runtime/viewer evidence、Editor UI、fixture、desktop/mobile e2eまで1waveで閉じる。

## 2. 次Wave選定

Wave32で、AC-MVP-009に残っていたproject-defined `warpLattice2d` authoring / evaluatorは一段閉じた。残る近い候補は、full layer tree / part tree UX、mesh topology / UV、package archive / persistent binary storage、AI repair、public tutorial / demo boundaryである。

Wave33では **Layer Tree Direct Manipulation / Part Tree UX v0** を選ぶ。

理由:

- Backlog上のP0候補では、Wave28のminimum form-based layer workflowがまだ「製品として触りやすいtree UX」まで届いていない。
- 既に`updatePart`はdisplayNameとparentPartIdを扱えるため、rename/reparentは新概念追加ではなく、既存operationをtree UXへ露出する実装で進められる。
- `deletePart`は未実装なので、Wave33では安全な最小範囲として **empty leaf part only** に限定して追加する。子partやdrawableを持つpartの削除、recursive delete、bulk deleteは扱わない。
- Asset I/O、archive、PSD/image decode、renderer/pixel、Cubism互換へ踏み込まず、semantic editor workflowを前進させられる。
- Native browser drag-and-drop、multi-select bulk operations、group transformは大きくなりやすい。Wave33では明示ボタン/メニュー/inline controlsでdirect manipulationを実現し、native drag-and-dropはfuture scopeに残す。

## 3. Undineコンテキスト保護規約

Wave33でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave28で`createPart`、`updatePart`、`setDrawablePart`、`setDrawableTexture`はoperation / editor workflow / validator / fixture / e2eまでimplementation-provenになっている。
- `UpdatePartPayloadSchema`は`displayName`とnullable `parentPartId`を扱えるため、renameとreparentのoperation footingは既にある。
- `deletePart`相当のoperationは現状見当たらない。
- Current layer tree panelはフォーム中心で、tree上のinline/direct manipulationとしてはまだ薄い。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave33のpart deleteはempty leaf partに限定する。子part、drawable、mask relation、rig-control、dynamicsなどを持つpartはblocking diagnosticで拒否する。
- Rename / reparentは既存`updatePart`を使う。新operationは原則`deletePart`だけにする。
- Reparentはcycle、missing parent、locked target、no-opを既存/拡張diagnosticsで明示する。
- UIはtree rowのinline controls / action menu / explicit buttonsを優先する。Native browser drag-and-drop APIは扱わない。
- Multi-select bulk operations、group transform、recursive delete、delete-with-reassignは含めない。
- Runtime / Viewer / Validatorはsemantic evidenceを更新する。full renderer、pixel oracle、texture sampling correctnessは扱わない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Native browser drag-and-drop tree editor。
- Multi-select bulk operations、group transform、recursive delete、delete-with-reassign。
- Full renderer、pixel oracle、texture sampling correctness。
- PSD parser、PNG/image decode、archive import/export、persistent binary storage、File System Access API。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- LLM provider integration、external HTTP/WebSocket/MCP transport。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave33-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/implementation/waves/wave32/wave32-final-report.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave33はoperation foundation、runtime/validator evidence、editor draftを先に並列化し、その後production workflow、fixture/e2e、integrationへ合流する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Part tree operation / authoring foundation | Parallel with B/C/D | Wave28 + Wave32 complete | `deletePart` empty-leaf operation、既存`updatePart` rename/reparent evidence hardening、operation log / model diff / package materializationを固める |
| 1 | B. Runtime / Viewer part tree evidence hardening | Parallel with A/C/D | Wave28 complete | rename/reparent/delete後のpart hierarchy、drawable membership、Viewer evidence、runtime diff refsをsemantic evidenceとして安定させる |
| 1 | C. Validator part tree direct-manipulation diagnostics | Parallel with A/B/D | Wave28 complete | delete blockers、reparent blockers、stale editor/runtime evidence、part hierarchy mismatchをdeterministic diagnosticsへ載せる |
| 1 | D. Editor layer tree direct-manipulation draft UX | Parallel with A/B/C | Wave28 complete | layer tree row上のrename/reparent/delete draft、drawable reassignment、texture assignment、selection/lock/hideのview model/UI draftを作る |
| 2 | E. Editor workflow / session / app-shell integration | Solo after A-D | A + B + C + D | production Editorからdirect manipulationをcommitし、Preview / Viewer / validation evidenceへつなぐ |
| 3 | F. Fixtures and desktop/mobile e2e smoke | Solo after E | E | rights-clean semantic fixtureとdesktop/mobile e2eでtree edit -> save/load -> Preview / Viewer再観測を確認する |
| 4 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、map/backlog/current capability更新を行う |

安全上の制約:

- Aはauthoring-core / operation-coreに限定し、Editor UIやruntime/validator broad redesignへ踏み込まない。
- Bはruntime-core / viewer-facing evidenceに限定し、operation handlerやEditor UIへ触らない。
- Cはvalidator-coreに限定し、operationやEditor UIへ触らない。
- DはEditor state / UI draftに限定し、operation commit / session wiringへ触らない。
- EはEditor workflow / session / app-shell wiringに限定し、operation/validator/runtime broad redesignへ戻らない。
- Fはfixtures/e2eに限定する。UI blockerが出た場合はEへescalateする。
- Gはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave33-part-tree-operation-authoring-foundation`

Purpose:

- `deletePart` empty-leaf operationを追加する。
- Existing `updatePart` rename/reparent evidenceを確認し、必要な最小hardeningを行う。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- focused authoring / operation tests
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- Editor UI implementation
- Runtime / validator broad implementation
- Recursive delete / delete-with-reassign
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Empty leaf part delete can dry-run / commit with operation log, model diff, target refs, package materialization.
- Non-empty part delete is rejected deterministically.

### B. `wave33-runtime-viewer-part-tree-evidence-hardening`

Purpose:

- Rename / reparent / delete後のpart hierarchyとdrawable membershipをRuntime / Viewer evidenceで確認できるようにする。

Allowed write scope:

- `packages/runtime-core/src/**`
- focused runtime tests
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Full renderer / pixel oracle
- Cubism compatibility claim
- External dependency / manifest / lockfile changes

Pass evidence:

- Runtime / Viewer evidence reflects part rename, parent change, deleted empty part absence, and drawable membership stability.

### C. `wave33-validator-part-tree-direct-manipulation-diagnostics`

Purpose:

- Direct manipulationで起きるpart hierarchy不整合、delete blockers、stale evidenceをdeterministic diagnosticsとして扱う。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Runtime algorithm implementation
- Broad validator report redesign
- External dependency / manifest / lockfile changes

Pass evidence:

- Valid direct-manipulation evidence passes.
- Missing parent, cycle, duplicate child, non-empty delete, stale editor/runtime/viewer evidence emit stable diagnostics.

### D. `wave33-editor-layer-tree-direct-manipulation-draft`

Purpose:

- Layer tree row上でrename、reparent、empty-leaf delete、drawable reassignment、texture assignmentをdraftできるstate / view model / UIを追加する。
- Commit wiringはDomain Eへ残す。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/layer-tree/**`
- focused editor state / UI tests
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `packages/**`
- Native browser drag-and-drop
- Multi-select bulk UI
- Full UI redesign
- External dependency / manifest / lockfile changes

Pass evidence:

- Tree UI can express direct rename/reparent/delete drafts and preserves selection / lock / editor-hide state.
- UI copy does not imply drag-and-drop, recursive delete, renderer correctness, or Cubism compatibility.

### E. `wave33-editor-layer-tree-workflow-session-integration`

Purpose:

- Production Editorからtree direct manipulationをcommitし、operation/session/workflow/app-shell、Preview / Viewer / validation evidenceへつなぐ。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/app/**`
- `apps/editor/src/ui/app-shell/**`
- narrow follow-up in `apps/editor/src/editor-state/**` and `apps/editor/src/ui/layer-tree/**` only if required by integration
- focused editor workflow/session/app-shell tests
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- Operation / runtime / validator broad redesign
- Native browser drag-and-drop
- Full UI redesign
- External dependency / manifest / lockfile changes

Pass evidence:

- User can commit tree rename/reparent/delete/reassignment/texture assignment from production Editor UI.
- Browser-local save/load preserves resulting layer state and evidence.

### F. `wave33-layer-tree-fixtures-and-e2e-smoke`

Purpose:

- Contract fixtureとdesktop/mobile e2eで、tree direct manipulation -> Preview / Viewer / validation -> save/load再観測を確認する。

Allowed write scope:

- `fixtures/contracts/**`
- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- focused fixture tests
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`

Forbidden:

- Broad editor/source implementation
- E2E assertion weakening to hide evidence mismatch
- Full renderer / pixel oracle assertions
- Native browser drag-and-drop dependency
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile e2e verifies rename, reparent, empty-leaf delete rejection/pass path as scoped, save/load, Preview / Viewer reinspection.
- Fixture proves semantic JSON only.

### G. `wave33-integration-review-and-final-report`

Purpose:

- Domains A-Fを統合し、final verification、clean integration review、final report、map/backlog/current capability更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave33/**`
- `discussion/implementation/reviews/wave33/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unrelated to Wave33.

Pass evidence:

- Final verification、clean integration review、final reportが揃う。
- Residual risks and future scope are honest.

## 10. Subagent / Orch-Sylph Execution Policy

Wave33起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Part Tree Semantics: rename/reparent/deleteの意味がdeterministicで、part hierarchyを壊していないか。
- Operation / Package Integrity: operation log、model diff、package materialization、target refsがcoherentか。
- Validator / Runtime / Viewer Evidence: stale/missing/mismatch diagnosticsとViewer evidenceが正しいか。
- Editor UX: desktop/mobileで操作が成立し、text overflowやinaccessible controlsがないか。
- Non-Goals: native drag-and-drop、multi-select bulk、recursive delete、renderer/pixel、Cubism、PSD/image/archive、dependencyへ逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: authoring-core / operation-core focused tests、typecheck
- Domain B: runtime-core focused tests
- Domain C: validator-core focused tests
- Domain D: editor state / layer-tree UI focused tests、editor typecheck
- Domain E: editor session / workflow / app-shell focused tests、typecheck
- Domain F: focused contract fixture tests、desktop/mobile e2e layer-tree smoke
- Domain G: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for native drag/drop claim, recursive delete, renderer/pixel, Cubism, PSD parser, image decode, archive, File System Access API, external dependency claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Empty leaf deleteだけでは製品workflowとして成立せず、recursive deleteやdelete-with-reassignが必要になる。
- Native browser drag-and-dropやmulti-select bulk operationsがpass条件に必要になる。
- Part hierarchy semanticsが既存schemaと衝突する。
- Renderer/pixel correctnessやreal texture/image decodeが必要になる。
- External dependency、manifest、lockfile変更が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、明示controlsによるrename/reparent/empty-leaf delete/direct reassignmentに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave33は次を満たしたときpassとする。

- Editor layer tree上でpart rename、reparent、empty-leaf delete、drawable reassignment、texture assignmentを直接操作できる。
- Empty leaf deleteはoperationとしてdry-run / commitでき、非empty deleteはdeterministicに拒否される。
- Operation log / model diff / package materialization / runtime-viewer evidence / validator reportが一貫する。
- Preview / Viewer / Validatorがrename/reparent/delete後のpart hierarchyとdrawable membershipを確認できる。
- Browser-local save/load後にlayer tree stateとevidenceを再観測できる。
- Contract fixtureとdesktop/mobile e2e smokeが通る。
- No native drag-and-drop, no multi-select bulk, no recursive delete, no full renderer, no pixel oracle, no Cubism compatibility claim, no PSD/image/archive expansion, no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
