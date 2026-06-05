# Wave 46 Plan: PSD Selected Layer Texture Intake / Part Mapping v0

> Wave46で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave46
- Wave name: `psd-selected-layer-texture-intake-part-mapping-v0`
- Primary objective: Wave45でEditor上に乗った明示PSD import / layer tree workflowを、実際にrigging素材として使える最小経路へ進める。ユーザーが明示選択したPSD layerをprivate/local project assetとしてmaterializeし、source layer / texture / drawable / part mapping evidenceへ接続する。ただしPSD全layer一括展開、drag-drop、archive/filesystem、Photoshop風full compositing、renderer/pixel oracle、texture correctness oracleは実装しない。

## 2. 次Wave選定

Wave45は、ユーザーがEditorで明示選択したPSDをbrowser session内でparseし、document metadata、layer/group tree、unsupported/notEvaluated summary、selected layer materialization evidence summaryを表示できるところまでを`implementation-proven`にした。`@webtoon/psd@0.4.0`はEditor/browser explicit PSD import adapterにだけscope拡張され、parser import boundary guardも追加された。

一方で、Wave45のmaterializationはまだsummary evidenceであり、選択layerを実際のproject texture / drawable / partとして使う経路はない。PSDを主入力とするなら、次に必要なのは「PSD layer treeを眺める」から「選択layerをrigging素材に取り込む」への移行である。

Wave46では **PSD Selected Layer Texture Intake / Part Mapping v0** を選ぶ。

理由:

- PSD主経路の次の依存ブロッカーは、選択layerをproject assetとして使えること。
- Wave19/28までのtexture-backed preview / part mapping foundation、Wave31/35/36のbyte intake / persistent storage / portable bundle、Wave44/45のPSD parser evidenceが接続可能になっている。
- いきなりgeneral PSD materializationやfull compositingへ進むより、選択layer単位の明示操作に絞る方が安全で、Editor UXとしても確認しやすい。
- private/local user-selected PSD由来assetとして扱えば、public demo assetや配布素材の判断を避けつつ、実用価値を上げられる。
- 「ユーザー判断なしに進められる」こと自体は優先価値にしない。今回の選定は、PSD主入力方針の実用化に必要な依存順として選ぶ。

## 3. Undineコンテキスト保護規約

Wave46でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。
- parser dependencyやmaterialized bytesを扱うdomainには`discussion/development_convention/dependency-policy.md`とfixture/provenance方針を渡し、approved adapter boundaryを逸脱しない。

## 4. Repository Facts

- Wave45 final verification / clean integration reviewは`pass`である。
- `@webtoon/psd@0.4.0`のdirect importは、Editor/browser PSD parser adapterとWave44 scriptsに限定されている。
- Editor PSD Import workflowは、user-selected file input、32 MiB `File.size` preflight、browser session parse、layer tree display、selected layer materialization summaryを持つ。
- Wave45 focused e2e `psdImportFocused`は、`test_data/sample_model.psd` upload、parse、layer tree display、save/load boundary、parser payload非永続化を検証する。
- Existing project supports generated drawable、texture-backed preview foundation、part/layer workflow、browser-local byte persistence、project-defined portable JSON bundle。
- 現時点では、PSD selected layerをactual project texture/drawable/part mappingとして取り込むworkflowはない。
- PSD full compositing、general all-layer materialization、texture sampling correctness、renderer/pixel oracleは未実装である。

## 5. Design Decisions

- Wave46は「明示選択されたPSD layer」を対象にする。全layer一括展開、自動part生成、recursive group importは扱わない。
- Materialized layer bytesは、user-selected PSD由来のprivate/local project assetとして扱う。public demo asset、配布素材、sample PSD由来public screenshot/export/bundleとは扱わない。
- Materialized assetの保存は既存のproject binary asset / package-local byte storage / portable bundleの範囲で扱う。保存できない場合は、session-onlyとしてtruthfulに表示し、`implementation-proven`を過剰主張しない。
- Parser dependency importはWave45 approved Editor/browser adapter boundaryに留める。packages/runtime/validatorへdirect parser importしない。
- Package/operation evidenceはparser-free evidence、source layer ref、source PSD hash/byteLength、parser version、extraction options、materialized mediaType/digest/byteLength、private/local provenanceを保持する。
- Texture-backed Preview / Viewerはexisting semantic / texture-backed evidenceに接続する。pixel correctness、Photoshop equivalent compositing、blend/effects/mask/color profile correctnessは主張しない。
- Selected layerからnew/selected partへmappingできる最小UXを目指す。meshは既存のgenerated/minimal meshや既存drawable mechanismを使い、automatic retopologyやatlas packingは実装しない。
- Product Preflightはsession-generated read-onlyのまま。persisted/exported Preflight artifact、CI/release/demo gateは実装しない。

## 6. Non-Goals

- PSD all-layer import、group recursive import、bulk materialization。
- Drag-drop、directory picker、File System Access API、ZIP/archive/native filesystem/cloud transport。
- PNG image set import workflow expansion。
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、mask/clipping/color-management correctness。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来のpublic screenshots/exports/bundles。
- repo-side AI repair generation/ranking、natural-language repair、LLM provider integration、auto-fix、automatic commit、external transport。
- Broad refactor of part/texture/drawable systems only to make PSD intake convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave45/wave45-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-h-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44/Wave45 PSD parser/materialization/import reports and reviews
- domainごとのtarget source / tests / e2e files

UndineはEditor source、parser source、operation source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave46は最初にmaterialized asset storage / provenance / UX boundaryを固定する。その後、Editor materialization serviceとpackage/operation texture/part evidence bridgeを並列化し、Editor UXとvalidator alignmentを進め、focused e2eとdocs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Materialized layer asset boundary / storage policy | Solo first | Wave45 complete | selected layer materializationの保存範囲、mediaType、private/local provenance、part/drawable destination、stale source handlingを固定する |
| 2 | B. Browser selected-layer materialization service | Parallel with C | A | Editor approved parser adapterからselected layer bytes/evidenceを生成し、private/local byte asset candidateを作る |
| 2 | C. Package / operation texture intake and part mapping bridge | Parallel with B | A | parser-free selected layer materialization evidenceをsource layer / texture / drawable / part mapping operation evidenceへ接続する |
| 3 | D. Editor selected layer intake UX / part mapping workflow | Parallel with E | B + C | PSD Import panelからlayerを選択し、materialize/add-to-project操作、destination part、result summaryを表示する |
| 3 | E. Validator / Product Preflight materialized asset diagnostics | Parallel with D | C | materialized PSD layer asset、missing/stale bytes、private/local provenance、unsupported scopeをdiagnostic/refへ接続する |
| 4 | F. Focused e2e / persistence / parser-boundary regression | Solo after D/E | D + E | sample PSD selected layerをproject asset化し、save/load/portable boundary、preview evidence、import-boundary guardを固定する |
| 5 | G. Documentation / traceability refresh | Solo after F | F | capability map、backlog、maps、fixture/traceabilityをWave46実装済み範囲へ同期する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

安全上の制約:

- Aはshared materialized asset/storage/provenance ownerであり、複数Gnomeに分割しない。
- BはEditor/browser materialization serviceに限定し、package/operation persistenceやvalidator diagnosticsを変更しない。
- Cはpackage/operation bridgeに限定し、Editor UIやparser importを変更しない。
- DはEditor UXに限定し、package contractやvalidator diagnosticsを変更しない。
- Eはvalidator/Product Preflight diagnosticsに限定し、Editor UIやparser implementationを変更しない。
- Fはfocused e2e/regression/guardに限定し、product behaviorの追加実装をしない。
- Gはdocs/maps/traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave46-materialized-layer-asset-boundary-storage-policy`

Purpose:

- Selected PSD layer materializationの保存/非保存境界を固定する。
- mediaType、digest/byteLength、source PSD hash、source layer ref、parser version、extraction options、private/local provenance、destination part/drawable semanticsを決める。
- Existing binary storage / portable bundle / browser persistenceへの接続方針を整理する。

Allowed write scope:

- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`
- narrow backlog/capability note only if needed

Forbidden:

- Source implementation
- dependency registry / package manifest / lockfile changes
- public demo asset claims
- full compositing / renderer / pixel oracle claims

### B. `wave46-browser-selected-layer-materialization-service`

Purpose:

- Wave45 browser parser bridgeからselected PSD layerをmaterializeし、private/local materialized asset candidateとparser-free evidenceを生成する。
- Materialization failure、oversize、unsupported layer typeをstructured evidenceとして返す。

Allowed write scope:

- `apps/editor/src/**` only for browser materialization service / workflow state helpers
- focused Editor tests
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- `packages/**`
- dependency scope changes
- broad UI workflow owned by Domain D
- full compositing / renderer / pixel oracle
- all-layer import / recursive group import

### C. `wave46-package-operation-texture-intake-part-mapping-bridge`

Purpose:

- Selected PSD layer materialization evidenceをsource layer / texture / drawable / part mapping operation evidenceへ接続する。
- Existing texture-backed preview / part mapping foundationと互換を保つ。
- Parser-free evidenceのみを扱い、parser dependencyをpackagesへ入れない。

Allowed write scope:

- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- focused package/operation tests
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- direct parser dependency import in `packages/**`
- Editor UI
- validator-core diagnostics
- public schema-breaking rename unless escalated
- full renderer / pixel oracle / texture correctness oracle

### D. `wave46-editor-selected-layer-intake-part-mapping-ux`

Purpose:

- Editor PSD Import panelからlayerを選択し、materialize/add-to-project操作を行えるUXを追加する。
- Destination partを既存partまたは新規partとして選べる最小workflowを作る。
- Result summaryとしてmaterialized asset digest/byteLength、texture/drawable/part mapping、private/local provenanceを表示する。

Allowed write scope:

- `apps/editor/src/**`
- `apps/editor/e2e/**` only for narrow test-id hooks if needed
- focused Editor tests
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- native drag-drop
- directory picker / File System Access API / archive
- all-layer import / recursive group import
- full renderer / Photoshop compositing preview
- package contract changes
- public demo asset wording

### E. `wave46-validator-product-preflight-materialized-asset-diagnostics`

Purpose:

- PSD selected layer materialized asset / texture / part mapping evidenceをvalidator / Product Preflightへ接続する。
- Missing bytes、stale source PSD hash、unsupported layer materialization、private/local provenance、not public demo assetをtruthfulに診断する。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator/Product Preflight tests
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- Editor UI
- Product Preflight persisted/exported artifact
- full renderer / pixel oracle proof

### F. `wave46-psd-selected-layer-focused-e2e-persistence-regression`

Purpose:

- `test_data/sample_model.psd`でselected `headwear` layerをproject asset化し、texture/part mapping summary、save/load/portable boundary、parser import boundaryをfocused e2e/regressionで固定する。
- Raw parser objectやpublic demo asset claimが永続化されないことを検査する。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**` focused e2e registry/guard updates if required
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control

### G. `wave46-docs-traceability-boundary-refresh`

Purpose:

- capability map、remaining backlog、implementation maps、fixture/traceability rowsをWave46実装範囲に同期する。
- selected layer materialized asset / texture / part mappingが実装済みになる範囲と、general PSD materialization/full compositing/renderer等の未実装範囲を分ける。

Allowed write scope:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave46

### H. `wave46-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave46/**`
- `discussion/implementation/reviews/wave46/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave46 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave46起動時の実行単位はdomainごとのOrch-Sylphである。

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

- PSD Input Direction: selected PSD layer intakeに絞られており、all-layer importやPNG workflowへscope creepしていないか。
- Materialized Asset Boundary: private/local provenance、source hash、layer ref、digest/byteLength/mediaType、parser/extraction optionsが揃っているか。
- Persistence Truthfulness: raw parser object、source PSD bytes、raw/visual materialized bytes、portable bundle claimsが実装済み範囲と一致しているか。
- Parser Boundary: `@webtoon/psd` direct importがapproved adapter / Wave44 scriptsから漏れていないか。
- Part / Texture Mapping Consistency: source layer、texture、drawable、part mappingが既存contractと矛盾していないか。
- Source Organization: source editsがbarrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Test Adequacy: selected layer materialization、project asset persistence、part mapping、validator diagnostics、focused e2eがdomain riskに見合うか。
- Non-Goals: drag-drop、archive/filesystem、all-layer materialization、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side AI repair等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: boundary report/review, storage/provenance policy consistency, `git diff --check`
- Domain B: selected layer materialization service tests, failure/oversize cases, parser import boundary scan
- Domain C: package/operation texture/part mapping tests, parser-free compatibility tests
- Domain D: Editor selected layer materialize/add-to-project workflow tests
- Domain E: validator/Product Preflight focused tests for materialized asset/stale/missing diagnostics
- Domain F: focused e2e selected layer asset intake/save-load regression, import-boundary guard
- Domain G: docs/map/traceability consistency checks and `git diff --check`
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `pnpm smoke:wave44:psd-parser`
- `node scripts/wave44-psd-fixture-evidence-regression.mjs`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- Wave46 selected layer asset intake focused e2e/regression command
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `node scripts/check-source-organization-fixtures.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/run-focused-e2e.mjs --check`
- `node scripts/check-dependencies-guard-self-test.mjs`
- `node scripts/check-wave43-validator-contract-coverage.mjs`
- parser import scan: allowed only in approved Editor/browser parser adapter and Wave44 scripts
- `git diff --check -- apps packages scripts fixtures test_data generated discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for all-layer import、drag-drop、archive/filesystem、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair/LLM/autofix claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Materialized layer bytesをproject/persistent assetとして保存する方針が既存storage/provenance方針と衝突する。
- Selected layer materialization requires new image encode/decode dependency or parser scope expansion.
- Browser memory/performance requires workerization or size cap changes beyond a conservative default.
- Existing texture/part/drawable mapping cannot accept parser-free materialization evidence without public schema-breaking changes.
- Save/load/portable bundle semantics require a product decision.
- Direct parser import is needed in packages/runtime/validator.
- all-layer import、drag-drop、archive/filesystem、File System Access API、directory picker、remote URL、OS watcherが必要になる。
- Full compositing、renderer/pixel oracle、texture sampling correctnessが必要になる。
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

実行前に明示的なユーザー判断を求めるほどのblockerは現時点ではない。うちの推奨は、Domain Aでstorage/provenance boundaryを固定し、そこで既存方針と衝突が出た場合だけ`escalate`する方針である。

Wave46後のproduct priority選択はscope外として残す。候補はall-layer PSD import、drag-drop、archive/filesystem、renderer/pixel oracle、advanced topology/UV、public/demo assets、Cubism policy reconsiderationである。

## 14. Pass Criteria

Wave46は次を満たしたときpassとする。

- Selected PSD layer materializationのstorage/provenance boundaryが記録されている。
- Editorでユーザーが明示選択したPSD layerをmaterializeし、private/local project asset candidateとして扱える。
- Materialized asset evidenceにsource PSD hash/byteLength、source layer ref、parser version、extraction options、mediaType、digest、byteLength、private/local provenanceが含まれる。
- Materialized selected layerをsource layer / texture / drawable / part mapping evidenceへ接続できる。
- Editorでmaterialize/add-to-project結果、destination part、texture/drawable summary、private/local provenanceを確認できる。
- Save/loadまたはportable boundaryがtruthfulに検証され、raw parser objectやpublic demo asset claimが永続化されない。
- Validator/Product Preflightがmaterialized PSD layer asset、missing/stale bytes、unsupported scopeをtruthfulに診断できる。
- Focused e2eまたは同等のbrowser regressionが`test_data/sample_model.psd`からselected layerをproject asset化するworkflowを検証する。
- No all-layer import、no PNG workflow expansion、no drag-drop、no archive/filesystem、no full compositing、no renderer/pixel oracle、no Cubism compatibility claim、no public sample PSD demo asset、no repo-side repair generation、no LLM/provider integration。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。

