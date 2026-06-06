# Wave 47 Plan: PSD Explicit Multi-Layer Batch Intake / Part Scaffolding v0

> Wave47で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave47
- Wave name: `psd-explicit-multi-layer-batch-intake-part-scaffolding-v0`
- Primary objective: Wave46で実装済みになった「明示選択された1つのPSD layerをprivate/local project texture assetとして取り込み、texture/drawable/part mapping evidenceへ接続する」経路を、ユーザーが明示選択した複数leaf layerのbatch intakeへ拡張する。PSD主入力の実用化に向け、複数パーツを一度に取り込める最小経路を作る。ただしall-layer import、recursive group import、drag-drop、archive/filesystem、Photoshop風full compositing、renderer/pixel oracle、texture correctness oracleは実装しない。

## 2. 次Wave選定

Wave46は、`test_data/sample_model.psd` の `headwear` / `psd:root/layer[0]` をprivate/local materialized project assetとして取り込み、texture/drawable/part mapping evidenceへ接続し、focused `psdImportFocused` e2eでsave/load/persistence boundaryを確認した。

次に必要なのは、1 layer単位の実証を、実際のモデリング作業で使える「複数PSD layerの明示取り込み」へ広げること。いきなり全layer再帰importへ進むと、layer命名、group semantics、part scaffold、partial failure、メモリ上限、UI確認、将来のfull compositingとの境界が一気に混ざる。Wave47では **explicit multi-layer batch intake** を選び、ユーザーが選んだleaf layerだけを対象にする。

理由:

- PSD主入力方針の次の実用ブロッカーは、複数パーツをPSDから取り込めること。
- Wave46のsingle-layer materialization / package operation / validator diagnosticsを再利用できる。
- 「全layerを自動で正しく取り込む」より、「ユーザーが選んだ複数leaf layerを安全に取り込む」方が検証可能で、UX上も失敗を理解しやすい。
- batch importの失敗・重複・命名・part destinationを先に整えると、将来のall-layer importやgroup-aware importの土台になる。
- 「ユーザー判断なしに進められる」ことは優先価値にしない。今回はPSD主入力の実用化に必要な依存順として選ぶ。

## 3. Undineコンテキスト保護規約

Wave47でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave46 final verification / clean integration reviewは`pass`である。
- `@webtoon/psd@0.4.0`のdirect importは、Editor/browser approved adapterとWave44 scriptsに限定されている。
- Editorは明示PSD import、browser session parse、layer tree表示、単一selected layer materialization / add-to-project workflowを持つ。
- Package / operation / validatorは、parser-free selected layer materialization evidenceをtexture/drawable/part mappingへ接続できる。
- `psdImportFocused`は`headwear` layerをexisting `part_root`へ取り込むfocused e2eを持つ。
- 現時点では、複数PSD layerを一括選択し、batchとしてmaterialize / intake / part scaffoldするworkflowはない。
- all-layer import、recursive group import、drag-drop、archive/filesystem、Photoshop風full compositing、renderer/pixel oracle、texture sampling correctnessは未実装である。

## 5. Design Decisions

- Wave47は「ユーザーが明示選択した複数leaf layer」を対象にする。groupそのもの、recursive group import、all-layer importは扱わない。
- v0のbatchは小さく保つ。Domain Aで`test_data/sample_model.psd`から安定した複数leaf layer target setを確認し、e2eでは代表的な少数layerを対象にする。
- Materialized bytesはWave46と同じくprivate/local project binary assetとして扱う。source PSD bytes、raw parser object、public/demo asset claimは永続化しない。
- Canonical materialized media typeはWave46と同じ`application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`。
- Batch resultはper-layer evidenceを持つ。失敗したlayerを隠さず、unsupported / missing / stale / duplicate / collisionを表示する。
- Part scaffolding v0は、選択済みparent part配下にlayer path由来の新規part/drawable/textureを生成する最小形を推奨する。既存partへ全部を押し込む動作だけに固定しない。
- Atomicityは過剰主張しない。実装がall-or-nothing transactionを安全に提供できない場合、preflight済みper-layer resultとpartial failure semanticsをtruthfulに表示する。silent partial successは禁止する。
- Parser dependency importは既存approved Editor/browser adapter boundaryに留める。`packages/**`、validator、runtimeへdirect parser importしない。

## 6. Non-Goals

- PSD all-layer import、recursive group import、group transform、automatic part hierarchy inference。
- Drag-drop、directory picker、File System Access API、ZIP/archive/native filesystem/cloud transport。
- PNG image set workflow expansion。
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、mask/clipping/color-management correctness。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来visual bytesのpublic screenshots/exports/bundles。
- repo-side AI repair generation/ranking、natural-language repair、LLM provider integration、auto-fix、automatic commit、external transport。
- Broad refactor of part/texture/drawable systems only to make batch import convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave47-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave46/wave46-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-h-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44-Wave46 PSD parser/materialization/import/intake reports and reviews
- domainごとのtarget source / tests / e2e files

UndineはEditor source、parser source、operation source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave47は最初にbatch boundaryとstable sample layer targetを固定する。その後、browser materialization batch serviceとoperation/package batch bridgeを並列化し、Editor UXとvalidator alignmentを進め、focused e2eとdocs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Batch layer boundary / sample target inventory | Solo first | Wave46 complete | explicit multi-layer batchの対象、上限、per-layer result、part scaffold、atomicity表現、sample PSD target setを固定する |
| 2 | B. Browser multi-layer materialization service | Parallel with C | A | approved Editor/browser parser adapterから複数leaf layerをmaterializeし、per-layer private/local candidate evidenceを返す |
| 2 | C. Package / operation batch intake and part scaffold bridge | Parallel with B | A | parser-free batch evidenceをtexture/drawable/part scaffold operation evidenceへ接続し、duplicate/collision/partial semanticsを扱う |
| 3 | D. Editor multi-layer selection / batch intake UX | Parallel with E | B + C | PSD Import panelで複数leaf layer選択、batch preflight、destination parent、result summaryを表示する |
| 3 | E. Validator / Product Preflight batch diagnostics | Parallel with D | C | per-layer materialized asset、duplicate/collision、missing/stale/mismatch、partial batch stateをdiagnostic/refへ接続する |
| 4 | F. Focused e2e / persistence / parser-boundary regression | Solo after D/E | D + E | sample PSDの複数leaf layer batch intake、save/load/portable boundary、parser boundaryをfocused e2eで固定する |
| 5 | G. Documentation / traceability refresh | Solo after F | F | capability map、backlog、maps、fixture/traceabilityをWave47実装済み範囲へ同期する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

安全上の制約:

- Aはshared batch semantics ownerであり、複数Gnomeに分割しない。
- BはEditor/browser materialization serviceに限定し、package/operation persistenceやvalidator diagnosticsを変更しない。
- Cはpackage/operation bridgeに限定し、Editor UIやparser importを変更しない。
- DはEditor UXに限定し、package contractやvalidator diagnosticsを変更しない。
- Eはvalidator/Product Preflight diagnosticsに限定し、Editor UIやparser implementationを変更しない。
- Fはfocused e2e/regression/guardに限定し、product behaviorの追加実装をしない。
- Gはdocs/maps/traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave47-batch-layer-boundary-sample-target-inventory`

Purpose:

- explicit multi-layer batch intakeの対象、上限、per-layer result、part scaffold、atomicity表現を固定する。
- `test_data/sample_model.psd`からe2eに使う安定leaf layer target setを確認する。
- selected leaf layer、group、hidden layer、unsupported layer、duplicate/collisionの扱いを整理する。

Allowed write scope:

- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`
- narrow backlog/capability note only if needed

Forbidden:

- Source implementation
- dependency registry / package manifest / lockfile changes
- public demo asset claims
- all-layer import / recursive group import / full compositing / renderer / pixel oracle claims

### B. `wave47-browser-multi-layer-materialization-service`

Purpose:

- Wave46 selected-layer materialization serviceを、明示選択された複数leaf layerのper-layer materialization resultへ拡張する。
- batch preflight、batch total cap、per-layer failure、unsupported layer type、duplicate selectionをstructured evidenceとして返す。

Allowed write scope:

- `apps/editor/src/**` only for browser materialization service / workflow state helpers
- focused Editor tests
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- `packages/**`
- dependency scope changes
- broad UI workflow owned by Domain D
- full compositing / renderer / pixel oracle
- all-layer import / recursive group import

### C. `wave47-package-operation-batch-intake-part-scaffold-bridge`

Purpose:

- Multiple selected PSD layer materialization evidenceをparser-free package/operation evidenceへ接続する。
- layer path由来のdeterministic texture/drawable/part scaffold、id collision、duplicate destination、partial failure semanticsを扱う。
- Existing single-layer operationを安全に再利用するか、必要ならbatch operationを追加する。ただしsilent partial successは禁止する。

Allowed write scope:

- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- focused package/operation tests
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- direct parser dependency import in `packages/**`
- Editor UI
- validator-core diagnostics
- public schema-breaking rename unless escalated
- full renderer / pixel oracle / texture correctness oracle

### D. `wave47-editor-multi-layer-selection-batch-intake-ux`

Purpose:

- Editor PSD Import panelで複数leaf layerを明示選択し、batch materialize/add-to-project操作を行えるUXを追加する。
- Destination parent part、generated part/drawable/texture summary、per-layer success/failure、private/local provenanceを表示する。
- Group選択やall-layer importに見えるUI wordingを避ける。

Allowed write scope:

- `apps/editor/src/**`
- `apps/editor/e2e/**` only for narrow test-id hooks if needed
- focused Editor tests
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- native drag-drop
- directory picker / File System Access API / archive
- all-layer import / recursive group import
- full renderer / Photoshop compositing preview
- package contract changes
- public demo asset wording

### E. `wave47-validator-product-preflight-batch-diagnostics`

Purpose:

- Batch PSD layer materialized asset / part scaffold evidenceをvalidator / Product Preflightへ接続する。
- per-layer missing/stale bytes、mediaType mismatch、duplicate/collision、partial batch state、private/local provenance、not public demo assetをtruthfulに診断する。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator/Product Preflight tests
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- Editor UI
- Product Preflight persisted/exported artifact
- full renderer / pixel oracle proof

### F. `wave47-psd-multi-layer-focused-e2e-persistence-regression`

Purpose:

- `test_data/sample_model.psd`でDomain Aが固定した複数leaf layerをbatch intakeし、texture/drawable/part scaffold summary、save/load/portable boundary、parser import boundaryをfocused e2e/regressionで固定する。
- Raw parser objectやpublic demo asset claimが永続化されないことを検査する。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**` focused e2e registry/guard updates if required
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control

### G. `wave47-docs-traceability-boundary-refresh`

Purpose:

- capability map、remaining backlog、implementation maps、fixture/traceability rowsをWave47実装範囲に同期する。
- explicit multi-layer batch intakeが実装済みになる範囲と、all-layer PSD import / recursive group import / full compositing / renderer等の未実装範囲を分ける。

Allowed write scope:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave47

### H. `wave47-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave47/**`
- `discussion/implementation/reviews/wave47/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave47 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave47起動時の実行単位はdomainごとのOrch-Sylphである。

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

- PSD Input Direction: explicit multi-layer batch intakeに絞られており、all-layer importやPNG workflowへscope creepしていないか。
- Batch Boundary: user-selected leaf layer、batch cap、per-layer result、partial failure semanticsがtruthfulか。
- Materialized Asset Boundary: private/local provenance、source hash、layer ref、digest/byteLength/mediaType、parser/extraction optionsがper-layerで揃っているか。
- Part Scaffold Consistency: generated texture/drawable/part ids、parent part、collision handling、operation evidenceが既存contractと矛盾していないか。
- Persistence Truthfulness: raw parser object、source PSD bytes、raw/visual materialized bytes、portable bundle claimsが実装済み範囲と一致しているか。
- Parser Boundary: `@webtoon/psd` direct importがapproved adapter / Wave44 scriptsから漏れていないか。
- Source Organization: source editsがbarrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Test Adequacy: batch selection、per-layer materialization、part scaffold、validator diagnostics、focused e2eがdomain riskに見合うか。
- Non-Goals: drag-drop、archive/filesystem、all-layer import、recursive group import、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: boundary report/review, sample target inventory, `git diff --check`
- Domain B: multi-layer materialization service tests, batch cap/failure/duplicate cases, parser import boundary scan
- Domain C: package/operation batch intake / part scaffold tests, parser-free compatibility tests
- Domain D: Editor multi-layer select/materialize/add-to-project workflow tests
- Domain E: validator/Product Preflight focused tests for batch materialized assets, partial/missing/stale/collision diagnostics
- Domain F: focused e2e multi-layer batch intake/save-load regression, import-boundary guard
- Domain G: docs/map/traceability consistency checks and `git diff --check`
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- Wave47 focused multi-layer batch e2e/regression command
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `pnpm run check:source`
- `pnpm run check:deps`
- relevant Wave42/Wave43/Wave44 guard scripts if still expected by plan and available
- `git diff --check -- apps packages scripts fixtures test_data generated discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for all-layer import、drag-drop、archive/filesystem、recursive group import、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair/LLM/autofix claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- User-selected leaf layer batchを実装するには、all-layer importやrecursive group importへ進む必要がある。
- Batch intakeのatomicityやpartial failure semanticsが既存operation lifecycleと衝突し、truthful UXで表現できない。
- Materialized layer bytesをproject/persistent assetとして保存する方針がWave46 storage/provenance方針と衝突する。
- Selected layer materialization requires new image encode/decode dependency or parser scope expansion.
- Browser memory/performance requires workerization or size cap changes beyond a conservative default.
- Existing texture/part/drawable mapping cannot accept parser-free batch materialization evidence without public schema-breaking changes.
- Save/load/portable bundle semantics require a product decision.
- Direct parser import is needed in packages/runtime/validator.
- Drag-drop、archive/filesystem、File System Access API、directory picker、remote URL、OS watcherが必要になる。
- Full compositing、renderer/pixel oracle、texture sampling correctnessが必要になる。
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

Wave47 plan自体は、うちの推奨として「explicit multi-layer batch intake」を次priorityに選ぶ。これはWave46までのPSD主入力方針からの保守的拡張であり、起動前に必須の追加質問はない。ただし、ユーザーがWave47で「全layer一括import」「recursive group import」「drag-drop/filesystem」「renderer/pixel oracle」を優先したい場合は、この計画を起動前に差し替える。

## 14. Pass Criteria

Wave47は次を満たしたときpassとする。

- explicit multi-layer batch intakeのboundary、batch cap、per-layer result、part scaffold、partial failure semanticsが記録されている。
- `test_data/sample_model.psd`からfocused e2eで使う複数leaf layer target setが確認されている。
- Editorでユーザーが複数leaf layerを明示選択し、batch materialize/add-to-project操作を実行できる。
- Batch materialization evidenceに、各layerのsource PSD hash/byteLength、source layer ref、parser version、extraction options、mediaType、digest、byteLength、private/local provenanceが含まれる。
- 複数materialized selected layerをtexture/drawable/part scaffold evidenceへ接続できる。
- Editorでbatch result、per-layer success/failure、destination parent part、generated texture/drawable/part summary、private/local provenanceを確認できる。
- Save/loadまたはportable boundaryがtruthfulに検証され、raw parser objectやpublic demo asset claimが永続化されない。
- Validator/Product Preflightがbatch materialized PSD layer assets、partial/missing/stale/collision/unsupported scopeをtruthfulに診断できる。
- Focused e2eまたは同等のbrowser regressionが`test_data/sample_model.psd`から複数leaf layerをproject asset化するworkflowを検証する。
- No all-layer import、no recursive group import、no PNG workflow expansion、no drag-drop、no archive/filesystem、no full compositing、no renderer/pixel oracle、no Cubism compatibility claim、no public sample PSD demo asset、no repo-side repair generation、no LLM/provider integration。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
