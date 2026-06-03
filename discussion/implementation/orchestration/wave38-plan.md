# Wave 38 Plan: Mesh Topology / UV Editor Expansion v0

> Wave38で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave38
- Wave name: `mesh-topology-uv-editor-expansion-v0`
- Primary objective: Wave29のCanvas Mesh Editing v1を足場に、既存頂点の移動だけでなく、boundedなmesh topology編集とUV直接編集をEditor / operation / runtime evidence / validator / fixture / e2eへ拡張する。Wave38ではautomatic triangulation、atlas packing、real texture bytes、image decode、full renderer、pixel oracle、Cubism compatibilityには踏み込まない。

## 2. 次Wave選定

Wave37で、package archive / filesystem import-exportへ進む前のtransport capability boundaryは閉じた。ただし、actual ZIP/archive writer/importer、File System Access API、directory picker、drag-dropはdependency approvalやbrowser API / UX / security方針の判断が必要である。

Wave38では **Mesh Topology / UV Editor Expansion v0** を選ぶ。

理由:

- 追加ユーザー判断や外部依存承認なしに、自律的に進められる実装境界である。
- Wave29でcanvas/SVG上のmesh vertex selection / translateはimplementation-provenになっているが、vertex / triangle topology編集、UV直接編集、topology revision evidenceはまだ未実装である。
- 実画像decodeやpixel rendererへ進む前に、semantic mesh topology / UV evidenceを固めると、後続のtexture pipelineやrenderer検証の土台になる。
- Layer tree native drag/dropやpublic demo assetよりも、既存mesh authoring workflowとの連続性が高い。

## 3. Undineコンテキスト保護規約

Wave38でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave17で最小mesh vertex nudge workflowはimplementation-provenになっている。
- Wave29でCanvas Mesh Editing v1として、canvas/SVG selection、single/multi-vertex translate、semantic Preview / Viewer / Runtime mesh evidence、validator mesh diagnostics、fixture、desktop/mobile e2eはimplementation-provenになっている。
- Wave30でrights-clean synthetic mini modelがあり、mesh authoringを含むsemantic tutorial workflowはimplementation-provenになっている。
- Wave36でactual bytesのportable JSON bundle round-trip、Wave37でtransport capability truthfulnessはimplementation-provenになっているが、real texture bytes / image decode / renderer correctnessは未実装である。
- 現時点では、vertex/edge/face creation/delete、retopology、UV direct edit、atlas packing、automatic triangulation、real texture sampling correctnessは未実装である。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave38はsemantic mesh topology / UV authoringの最小拡張に限定する。
- Topology編集はbounded operationsにする。automatic triangulationやfreeform retopologyは扱わない。
- 初期scopeは、既存drawable meshに対するadd vertex、remove unreferenced vertex、add triangle by existing vertices、remove triangle、move UV pointを候補とする。実装時に安全な最小subsetへ絞ってよい。
- Operation evidence、runtime evidence、Viewer evidence、validator diagnosticsはtopology revision / vertex stable IDs / triangle stable IDs / UV count / UV bounds / orphan refsをAI-readableに扱う。
- UV編集はsemantic coordinate editingであり、real texture sampling correctnessやpixel oracleを主張しない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Automatic triangulation、retopology algorithm、mesh optimization。
- Atlas packing、texture atlas generation、UV unwrap。
- Real texture bytes decode、PNG/image decode、texture materialization。
- Full renderer、pixel oracle、texture sampling correctness assertion。
- Cubism mesh/deformer compatibility、Cubism SDK/Core import/export。
- PSD parser、PNG parser、raster extraction。
- File System Access API、drag-drop、ZIP/archive implementation。
- Advanced animation/timeline mesh editing。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave38-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave29/wave29-final-report.md`
- `discussion/implementation/reviews/wave29/wave29-clean-integration-review.md`
- `discussion/implementation/waves/wave37/wave37-final-report.md`
- `discussion/implementation/reviews/wave37/wave37-clean-integration-review-sylph-final.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave38はmesh topology / UV contractを先に固定し、その後operation/runtime側とvalidator diagnosticsを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Mesh topology / UV contract foundation | Solo first | Wave29 complete | topology edit operations、UV edit evidence、stable ID / revision contractを固定する |
| 2 | B. Operation / package / runtime topology application | Parallel with C | A | bounded topology/UV operationsをauthoring lifecycle、package materialization、runtime/viewer evidenceへ接続する |
| 2 | C. Validator topology / UV diagnostics hardening | Parallel with B | A | topology mutation、orphan refs、invalid triangles、UV mismatch/bounds/stale evidenceをdeterministic diagnosticsへ載せる |
| 3 | D. Editor canvas topology / UV workflow | Solo after B/C | B + C | Editor canvas/SVGで最小topology editとUV editを操作できるようにする |
| 4 | E. Fixture and e2e topology / UV smoke | Solo after D | D | rights-clean fixtureとdesktop/mobile e2eでedit -> Preview/Viewer/Validator -> save/load再観測を確認する |
| 5 | F. Integration review and final report | Solo after E | E | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはoperation / authoring / package / runtime evidenceに限定し、Editor UIやvalidator broad redesignへ触らない。
- Cはvalidator-core中心に限定し、operation implementationやEditor UIへ触らない。
- DはEditor workflow / UI / state projectionに限定し、operation contractを再設計しない。
- Eはfixtures / e2e / traceabilityに限定する。B/C/Dのsource defectを発見した場合は勝手に広げず差し戻す。
- Fはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave38-mesh-topology-uv-contract-foundation`

Purpose:

- Mesh topology / UV editのcontractを固定する。
- Bounded topology operations、UV edit operation、topology revision、vertex / triangle stable IDs、operation evidence shapeを定義する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/operation-core/src/**`
- `packages/package-format/src/**`
- focused contracts / operation / package-format tests
- `discussion/design/module-contracts/package-file-format-contract.md` if directly required
- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`

Forbidden:

- Editor UI implementation
- Validator broad implementation
- Runtime broad implementation beyond contract shape
- Automatic triangulation / atlas packing / renderer / image decode implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Contract is additive and does not claim automatic triangulation, renderer correctness, or Cubism compatibility.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave38-operation-package-runtime-topology-application`

Purpose:

- Bounded mesh topology / UV operationsをauthoring lifecycle、operation log、model diff、package materialization、runtime / Viewer evidenceへ接続する。
- Topology revisionとstable IDsをsave/load後も再観測できるようにする。

Allowed write scope:

- `packages/operation-core/src/**`
- `packages/authoring-core/src/**`
- `packages/package-format/src/**`
- `packages/runtime-core/src/**`
- focused tests for these packages
- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`

Forbidden:

- Editor UI implementation
- Validator-core broad implementation
- Automatic triangulation / retopology algorithm
- Real texture bytes / image decode / renderer / pixel oracle
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Supported operations produce deterministic operation evidence and package/runtime/viewer evidence.
- Invalid topology edits fail deterministically and do not corrupt mesh state.

### C. `wave38-validator-topology-uv-diagnostics`

Purpose:

- Mesh topology / UV edit evidenceをvalidatorがdeterministicに扱えるようにする。
- Invalid triangle refs、duplicate/degenerate triangles、orphaned vertices、UV count mismatch、UV coordinate bounds、stale topology revision、runtime/viewer evidence mismatchをAI-readable diagnosticsへ載せる。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`

Forbidden:

- Operation implementation
- Editor UI implementation
- Renderer / pixel oracle / image decode validation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid topology / UV evidence passes.
- Invalid topology / stale evidence emits stable diagnostics and does not silently pass.

### D. `wave38-editor-canvas-topology-uv-workflow`

Purpose:

- Editor canvas/SVG上でbounded topology editとUV editを操作できるようにする。
- Existing mesh selection / vertex translate workflowを壊さず、topology / UV edit modeを追加する。
- Unsupported automatic triangulation / atlas / renderer claimsを表示しない。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**` narrow wiring only if required
- focused editor tests
- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`

Forbidden:

- Automatic triangulation / retopology algorithm
- Real texture bytes / image decode
- Full renderer / pixel oracle
- File System Access API / drag-drop / ZIP/archive implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobileで最小topology / UV edit controlsが操作可能である。
- Existing vertex move workflow remains operable.
- UI text does not imply renderer/pixel/image decode/automatic triangulation support.

### E. `wave38-topology-uv-fixture-e2e`

Purpose:

- Rights-clean fixtureとdesktop/mobile e2eで、topology edit / UV edit -> package materialization -> Preview / Viewer / Validator -> save/load再観測を確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI/test-id/wiring only if needed
- `fixtures/contracts/**`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`

Forbidden:

- Broad source implementation in packages/**
- E2E assertion weakening to hide topology / UV failure
- Image pixel assertion
- Real texture decode
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke proves bounded topology / UV editing and save/load reinspection.
- Negative path confirms invalid topology edit is rejected truthfully.

### F. `wave38-integration-review-and-final-report`

Purpose:

- Domains A-Eを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave38/**`
- `discussion/implementation/reviews/wave38/**`
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
- Clean integration reviewがcontract、operation/runtime evidence、validator diagnostics、Editor workflow、e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no automatic triangulation, no atlas packing, no image decode, no full renderer, no pixel oracle.

## 10. Subagent / Orch-Sylph Execution Policy

Wave38起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain DをOrch-Sylphに委譲する。
4. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
5. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
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

- Topology Truthfulness: supported topology editsとunsupported triangulation/retopologyを誇張していないか。
- UV Evidence: UV editがsemantic evidenceとして記録され、texture sampling correctnessを主張していないか。
- Runtime / Viewer Evidence: topology revision、stable IDs、bounds/hash、UV evidenceがAI-readableか。
- Validator Evidence: diagnosticsがdeterministicでAI-readableか。
- UI / Accessibility: topology / UV edit controlsがdesktop/mobileで観測可能か。
- Non-Goals: automatic triangulation、atlas packing、real texture decode、full renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / operation / package-format focused tests、typecheck
- Domain B: operation / authoring / package-format / runtime focused tests
- Domain C: validator focused tests、diagnostic stability tests
- Domain D: editor-session / editor-workflow / editor-state / UI focused tests
- Domain E: focused e2e topology / UV edit smoke on desktop/mobile
- Domain F: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for automatic triangulation / atlas packing / image decode / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Automatic triangulation、retopology algorithm、atlas packingが必要になる。
- Real texture bytes、PNG/image decode、pixel renderer、texture sampling oracleが必要になる。
- Cubism mesh/deformer compatibility claimが必要になる。
- File System Access API、drag-drop、archive/filesystem implementationが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、semantic topology / UV edit、no dependency、no renderer、no image decodeに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave38は次を満たしたときpassとする。

- Bounded mesh topology editとUV editのcontract / operation evidenceが定義されている。
- Supported topology / UV operationsがoperation log、model diff、package materialization、runtime / Viewer evidenceへ反映される。
- Invalid topology / stale evidence / UV mismatchがvalidator diagnosticsへdeterministicに落ちる。
- Editor canvas/SVGで最小topology / UV edit workflowを操作できる。
- Desktop/mobile e2eでedit -> Preview / Viewer / Validator -> save/load再観測を確認できる。
- Existing Wave29 vertex move workflowが壊れていない。
- No automatic triangulation、no atlas packing、no real texture decode、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
