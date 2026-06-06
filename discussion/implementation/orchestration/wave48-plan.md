# Wave 48 Plan: PSD Group-Aware Import Plan / Explicit Leaf Approval v0

> Wave48で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave48
- Wave name: `psd-group-aware-import-plan-explicit-leaf-approval-v0`
- Primary objective: Wave47で実装済みになった「明示選択した複数PSD leaf layerのbatch intake」を、PSD group / document から候補leaf layerを列挙する import plan preview へ拡張する。ユーザーは候補一覧、unsupported/hidden/collision、byte estimate、generated scaffold planを確認し、明示承認したleaf layer listだけを既存batch intakeへ流す。ただしall-layer one-click import、recursive group auto import、drag-drop、archive/filesystem、Photoshop風full compositing、renderer/pixel oracle、texture correctness oracleは実装しない。

## 2. 次Wave選定

Wave47は、`test_data/sample_model.psd` の `headwear`、`eyewear`、`tie / tie` をユーザー明示選択のleaf layer batchとしてprivate/local project assetへ取り込み、generated texture/drawable/mesh/part scaffold evidenceへ接続し、`psdMultiLayerBatchFocused`でsave/load/persistence boundaryを確認した。

次の自然な実用化ステップは、手でleaf layer refを選ぶ負担を減らし、PSD group / document から候補leaf layerを一覧化して、取り込み前に安全に確認できること。いきなりall-layer importへ進むと、hidden layer、group semantics、unsupported features、collision、メモリ上限、partial failure、命名、将来のPhotoshop風合成との境界が混ざる。Wave48では **import plan preview / explicit leaf approval** を選び、候補生成と承認境界を先に実装する。

理由:

- PSD主入力の次の実用ブロッカーは、ユーザーが大量のleaf layerを手で探さず、候補を確認して選べること。
- Wave47のbatch materialization / operation / validator / e2e基盤を再利用できる。
- group-aware candidate discoveryを先に固定すると、将来のall-layer importやrecursive group importの仕様を安全に検討できる。
- 自動全取り込みではなく、import plan previewとleaf-level explicit approvalにすることで、ユーザー判断と証跡が残り、partial failureも理解しやすい。
- 「ユーザー判断なしに進められる」ことは優先価値にしない。今回はPSD主入力を実用化するための依存順として選ぶ。

## 3. Undineコンテキスト保護規約

Wave48でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave47 final verification / clean integration reviewは`pass`である。
- `@webtoon/psd@0.4.0`のdirect importは、Editor/browser approved adapterとWave44 scriptsに限定されている。
- Editorは明示PSD import、browser session parse、layer tree表示、単一selected layer materialization、複数leaf layer batch materialization / add-to-project workflowを持つ。
- Package / operation / validatorは、parser-free batch layer materialization evidenceをgenerated texture/drawable/mesh/part scaffoldへ接続できる。
- Focused e2e `psdMultiLayerBatchFocused` は `headwear`、`eyewear`、`tie / tie` を `part_root` 配下generated scaffoldへ取り込む。
- 現時点では、PSD group / document からcandidate leaf layersを抽出し、import plan previewとして表示・承認するworkflowはない。
- all-layer one-click import、recursive group auto import、drag-drop、archive/filesystem、Photoshop風full compositing、renderer/pixel oracle、texture sampling correctnessは未実装である。

## 5. Design Decisions

- Wave48は「候補生成されたleaf layer listをユーザーが明示承認する」ことを対象にする。groupそのものをasset化しない。
- Group-aware discoveryは、指定groupまたはdocument root配下のleaf layerを候補として列挙する。ただし、取り込み実行はleaf-level approved listに変換してからWave47 batch intakeを使う。
- v0はall-layer one-click importを名乗らない。root/document全体から候補を列挙できる場合でも、それはimport plan previewであり、自動取り込みではない。
- Hidden layer、unsupported layer、empty/zero-size layer、duplicate name/ref、generated id/name collision、byte cap超過、private/local provenance欠落は、candidate planのper-layer statusとして表示する。
- Materialized bytesはWave46/Wave47と同じくprivate/local project binary assetとして扱う。source PSD bytes、raw parser object、public/demo asset claimは永続化しない。
- Canonical materialized media typeは`application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`。
- Import planはsession evidenceとして扱う。package persistence capabilityとしてsource PSD bytesやraw parser objectを保存しない。
- Parser dependency importは既存approved Editor/browser adapter boundaryに留める。`packages/**`、validator、runtimeへdirect parser importしない。

## 6. Non-Goals

- PSD all-layer one-click import、recursive group auto import、group transform、automatic part hierarchy inference。
- Drag-drop、directory picker、File System Access API、ZIP/archive/native filesystem/cloud transport。
- PNG image set workflow expansion。
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、mask/clipping/color-management correctness。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来visual bytesのpublic screenshots/exports/bundles。
- repo-side AI repair generation/ranking、natural-language repair、LLM provider integration、auto-fix、automatic commit、external transport。
- Broad refactor of part/texture/drawable systems only to make group-aware import convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave47/wave47-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-h-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44-Wave47 PSD parser/materialization/import/intake reports and reviews
- domainごとのtarget source / tests / e2e files

UndineはEditor source、parser source、operation source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave48は最初にimport plan boundaryとsample PSD group/root candidate policyを固定する。その後、browser candidate plannerとpackage/operation import plan evidence bridgeを並列化し、Editor UXとvalidator alignmentを進め、focused e2eとdocs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Import plan boundary / sample group inventory | Solo first | Wave47 complete | group/root candidate discovery、leaf approval boundary、hidden/unsupported/collision/byte cap semantics、sample target group/rootを固定する |
| 2 | B. Browser PSD import plan candidate service | Parallel with C | A | approved Editor/browser parser adapterからgroup/root配下leaf candidate planを生成し、per-layer statusとbyte estimateを返す |
| 2 | C. Package / operation import plan evidence bridge | Parallel with B | A | parser-free import plan approval evidenceを既存batch intake operationへ接続し、approved leaf listとcandidate plan hashを記録する |
| 3 | D. Editor import plan preview / explicit approval UX | Parallel with E | B + C | PSD Import panelでgroup/root candidate preview、filter、approval、batch intake実行、result summaryを表示する |
| 3 | E. Validator / Product Preflight import plan diagnostics | Parallel with D | C | import plan candidate/approval evidence、hidden/unsupported/collision/byte cap/not-approved statesをdiagnostic/refへ接続する |
| 4 | F. Focused e2e / persistence / parser-boundary regression | Solo after D/E | D + E | sample PSD group/root candidate previewからapproved leaf listをbatch intakeし、save/load/portable boundaryをfocused e2eで固定する |
| 5 | G. Documentation / traceability refresh | Solo after F | F | capability map、backlog、maps、fixture/traceabilityをWave48実装済み範囲へ同期する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

安全上の制約:

- Aはshared import plan semantics ownerであり、複数Gnomeに分割しない。
- BはEditor/browser candidate planning serviceに限定し、package/operation persistenceやvalidator diagnosticsを変更しない。
- Cはpackage/operation import plan bridgeに限定し、Editor UIやparser importを変更しない。
- DはEditor UXに限定し、package contractやvalidator diagnosticsを変更しない。
- Eはvalidator/Product Preflight diagnosticsに限定し、Editor UIやparser implementationを変更しない。
- Fはfocused e2e/regression/guardに限定し、product behaviorの追加実装をしない。
- Gはdocs/maps/traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave48-import-plan-boundary-sample-group-inventory`

Purpose:

- group/root candidate discoveryとleaf-level explicit approval boundaryを固定する。
- `test_data/sample_model.psd`からfocused e2eに使う安定group/root candidate targetを確認する。
- hidden layer、unsupported layer、empty/zero-size layer、duplicate/collision、byte cap、not-approved leafの扱いを整理する。

Allowed write scope:

- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`
- narrow backlog/capability note only if needed

Forbidden:

- Source implementation
- dependency registry / package manifest / lockfile changes
- public demo asset claims
- all-layer one-click import / recursive group auto import / full compositing / renderer / pixel oracle claims

### B. `wave48-browser-psd-import-plan-candidate-service`

Purpose:

- Wave47 batch materialization前段として、approved Editor/browser parser adapter境界内でgroup/root配下leaf candidate planを生成する。
- per-layer candidate status、byte estimate、selection default、unsupported/hidden/collision reason、candidate plan digestを返す。

Allowed write scope:

- `apps/editor/src/**` only for browser import plan candidate service / workflow state helpers
- focused Editor tests
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- `packages/**`
- dependency scope changes
- broad UI workflow owned by Domain D
- full compositing / renderer / pixel oracle
- all-layer one-click import / recursive group auto import

### C. `wave48-package-operation-import-plan-approval-bridge`

Purpose:

- Parser-free import plan candidate / approval evidenceをoperation evidenceへ接続する。
- Approved leaf listだけをWave47 batch operationへ流すためのbridgeを作る。
- Candidate plan digest、approval selection、not-approved candidates、collision/preflight summaryを記録する。

Allowed write scope:

- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- focused package/operation tests
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- direct parser dependency import in `packages/**`
- Editor UI
- validator-core diagnostics
- public schema-breaking rename unless escalated
- full renderer / pixel oracle / texture correctness oracle

### D. `wave48-editor-import-plan-preview-explicit-approval-ux`

Purpose:

- Editor PSD Import panelでgroup/root candidate planを生成・表示し、ユーザーがleaf candidatesを明示承認してbatch intakeを実行できるUXを追加する。
- Candidate table / summaryとしてhidden、unsupported、byte estimate、generated scaffold preview、collision、not-approvedを表示する。
- All-layer importに見える文言や、groupを直接importする文言を避ける。

Allowed write scope:

- `apps/editor/src/**`
- `apps/editor/e2e/**` only for narrow test-id hooks if needed
- focused Editor tests
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- native drag-drop
- directory picker / File System Access API / archive
- all-layer one-click import / recursive group auto import
- full renderer / Photoshop compositing preview
- package contract changes
- public demo asset wording

### E. `wave48-validator-product-preflight-import-plan-diagnostics`

Purpose:

- Import plan candidate / approval evidenceをvalidator / Product Preflightへ接続する。
- hidden/unsupported candidate、not-approved candidate、candidate plan mismatch、approval mismatch、byte cap blocked、collision/preflight blocked、private/local provenance missingをtruthfulに診断する。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator/Product Preflight tests
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- Editor UI
- Product Preflight persisted/exported artifact
- full renderer / pixel oracle proof

### F. `wave48-psd-import-plan-focused-e2e-persistence-regression`

Purpose:

- `test_data/sample_model.psd`でDomain Aが固定したgroup/root candidate planを生成し、承認したleaf listをbatch intakeし、save/load/portable boundary、parser import boundaryをfocused e2e/regressionで固定する。
- Raw parser objectやpublic demo asset claimが永続化されないことを検査する。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**` focused e2e registry/guard updates if required
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control

### G. `wave48-docs-traceability-boundary-refresh`

Purpose:

- capability map、remaining backlog、implementation maps、fixture/traceability rowsをWave48実装範囲に同期する。
- group-aware import plan / explicit leaf approvalが実装済みになる範囲と、all-layer one-click import / recursive group auto import / full compositing / renderer等の未実装範囲を分ける。

Allowed write scope:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave48

### H. `wave48-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave48/**`
- `discussion/implementation/reviews/wave48/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave48 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave48起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain D / Eを投入する。D/Eはparallel可能だが、Editor projection fileが衝突する場合は片方を待機させる。
4. Domain D / Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
5. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
6. Domain Gが`pass`したら、UndineはDomain HをOrch-Sylphに委譲する。
7. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
8. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
9. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
10. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
11. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。

各Orch-Sylph assignmentには、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各domain completion前に最低限以下を確認する。

- PSD Input Direction: group-aware import plan / explicit leaf approvalに絞られており、all-layer one-click importやrecursive group auto importへscope creepしていないか。
- Candidate Plan Boundary: candidate discovery、default selection、not-approved status、hidden/unsupported/collision/byte capがtruthfulか。
- Approval Boundary: materialization実行はapproved leaf listに限定され、group/rootそのものを自動importしていないか。
- Materialized Asset Boundary: private/local provenance、source hash、layer ref、digest/byteLength/mediaType、parser/extraction optionsがper-approved-layerで揃っているか。
- Part Scaffold Consistency: generated texture/drawable/mesh/part ids、parent part、collision handling、operation evidenceが既存contractと矛盾していないか。
- Persistence Truthfulness: raw parser object、source PSD bytes、raw/visual materialized bytes、portable bundle claimsが実装済み範囲と一致しているか。
- Parser Boundary: `@webtoon/psd` direct importがapproved adapter / Wave44 scriptsから漏れていないか。
- Source Organization: source editsがbarrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Test Adequacy: candidate plan generation、approval、batch intake、validator diagnostics、focused e2eがdomain riskに見合うか。
- Non-Goals: drag-drop、archive/filesystem、all-layer one-click import、recursive group auto import、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: boundary report/review, sample group/root inventory, `git diff --check`
- Domain B: import plan candidate service tests, hidden/unsupported/collision/byte cap/default selection cases, parser import boundary scan
- Domain C: package/operation import plan approval bridge tests, parser-free compatibility tests
- Domain D: Editor import plan preview / explicit approval workflow tests
- Domain E: validator/Product Preflight focused tests for import plan, approval, not-approved/hidden/unsupported/collision diagnostics
- Domain F: focused e2e group/root plan preview -> approved leaf list -> batch intake/save-load regression, import-boundary guard
- Domain G: docs/map/traceability consistency checks and `git diff --check`
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- Wave48 focused import plan e2e/regression command
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `pnpm run check:source`
- `pnpm run check:deps`
- relevant Wave42/Wave43/Wave44 guard scripts if still expected by plan and available
- `git diff --check -- apps packages scripts fixtures test_data generated discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for all-layer one-click import、drag-drop、archive/filesystem、recursive group auto import、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair/LLM/autofix claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Candidate planを実装するには、all-layer one-click importやrecursive group auto importへ進む必要がある。
- Group/root candidate discoveryが既存PSD layer tree evidenceでは安定して表現できず、parser scope expansionが必要になる。
- Approval boundaryやnot-approved candidate statusがoperation/package evidenceと衝突し、truthful UXで表現できない。
- Materialized layer bytesをproject/persistent assetとして保存する方針がWave46/Wave47 storage/provenance方針と衝突する。
- Selected layer materialization requires new image encode/decode dependency or parser scope expansion.
- Browser memory/performance requires workerization or size cap changes beyond a conservative default.
- Existing texture/part/drawable mapping cannot accept parser-free import plan evidence without public schema-breaking changes.
- Save/load/portable bundle semantics require a product decision.
- Direct parser import is needed in packages/runtime/validator.
- Drag-drop、archive/filesystem、File System Access API、directory picker、remote URL、OS watcherが必要になる。
- Full compositing、renderer/pixel oracle、texture sampling correctnessが必要になる。
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

Wave48 plan自体は、うちの推奨として「group-aware import plan / explicit leaf approval」を次priorityに選ぶ。これはWave47までのPSD主入力方針からの保守的拡張であり、起動前に必須の追加質問はない。ただし、ユーザーがWave48で「all-layer one-click import」「recursive group auto import」「drag-drop/filesystem」「renderer/pixel oracle」を優先したい場合は、この計画を起動前に差し替える。

## 14. Pass Criteria

Wave48は次を満たしたときpassとする。

- group/root candidate discovery、import plan preview、explicit leaf approval、not-approved status、hidden/unsupported/collision/byte cap semanticsが記録されている。
- `test_data/sample_model.psd`からfocused e2eで使うgroup/root candidate targetが確認されている。
- Editorでユーザーがgroup/root candidate planを生成し、leaf candidatesを明示承認し、approved listだけをbatch materialize/add-to-projectできる。
- Import plan evidenceにcandidate plan digest、source PSD hash/byteLength、candidate layer refs/path/name、candidate statuses、approval selection、generated scaffold preview、private/local provenanceが含まれる。
- Approved leaf layerだけがWave47 batch intake pathへ接続され、not-approved/unsupported/hidden/collision candidatesがsilentに取り込まれない。
- Editorでcandidate plan、approval state、batch result、per-layer success/failure、destination parent part、generated texture/drawable/mesh/part summary、private/local provenanceを確認できる。
- Save/loadまたはportable boundaryがtruthfulに検証され、raw parser objectやpublic demo asset claimが永続化されない。
- Validator/Product Preflightがimport plan candidate/approval evidence、not-approved/hidden/unsupported/collision/byte cap/partial statesをtruthfulに診断できる。
- Focused e2eまたは同等のbrowser regressionが`test_data/sample_model.psd`からgroup/root import planを生成し、approved leaf listをproject asset化するworkflowを検証する。
- No all-layer one-click import、no recursive group auto import、no PNG workflow expansion、no drag-drop、no archive/filesystem、no full compositing、no renderer/pixel oracle、no Cubism compatibility claim、no public sample PSD demo asset、no repo-side repair generation、no LLM/provider integration。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
