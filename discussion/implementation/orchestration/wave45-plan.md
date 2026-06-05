# Wave 45 Plan: Editor Explicit PSD Import UX / Browser Parser Bridge v0

> Wave45で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave45
- Wave name: `editor-explicit-psd-import-ux-browser-parser-bridge-v0`
- Primary objective: Wave44のscripts-only PSD parser/materialization pilotを、Editor内の明示的なPSD file selection workflowへ接続する。ユーザーが選んだPSDをbrowser sessionでparseし、layer/group tree、PSD source profile、selected layer materialization evidenceをEditor UXとpackage/session evidenceに載せる。ただしdrag-drop、archive/filesystem、general PSD materialization、Photoshop風full compositing、renderer/pixel oracleは実装しない。

## 2. 次Wave選定

Wave44は、`test_data/sample_model.psd`をexplicit pathでparseし、document metadata、layer/group tree、selected `headwear` layerのraw-RGBA materialization digest evidenceを得るところまでを`implementation-proven`にした。parser dependencyは`@webtoon/psd@0.4.0`としてscripts-only dev/test fixture smoke scopeに登録され、production packages / Editor / runtimeには直接importされていない。

一方で、現時点ではユーザーがEditor上でPSDを選択してparseするUXはない。PSDを主入力とする方針に対して、Node scriptだけでPSDを扱える状態は、プロダクトの主経路としてはまだ遠い。次に必要なのは、既存のbrowser selected-byte intake / persistence surfaceとWave44のparser evidenceをつなぎ、Editor内でPSD layer treeを確認できる最小vertical sliceである。

Wave45では **Editor Explicit PSD Import UX / Browser Parser Bridge v0** を選ぶ。

理由:

- PSDを主入力とする以上、Editor上で「明示選択されたPSDを読む」経路が次の依存ブロッカーである。
- Wave31-W36でbrowser byte intake、IndexedDB byte restore、portable bundleがあり、Wave44でPSD parser/materialization evidenceがあるため、接続する材料が揃っている。
- Editor UXに入る前にgeneral PSD materializationやfull compositingへ進むと、ユーザーが操作できるプロダクト価値が見えにくくなる。
- drag-dropやarchive/filesystemではなく、既存file inputのexplicit selectionに絞れば、permission / security / UX riskを抑えられる。
- 「ユーザー判断なしに進められる」こと自体は優先価値にしない。今回は、PSD主経路へ近づける依存関係上の自然な次段として選ぶ。

## 3. Undineコンテキスト保護規約

Wave45でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。
- dependency scopeを変更するdomainには`discussion/development_convention/dependency-policy.md`を渡し、license/provenance/security確認なしにregistry scopeを広げない。

## 4. Repository Facts

- Wave44 Domain H final verificationは`pass`で、Review-Sylph clean integration reviewも`pass`として記録済み。
- `@webtoon/psd@0.4.0`は、現状`dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo` scopeで登録されている。
- `scripts/wave44-psd-parser-smoke.mjs`と`wave44-psd-layer-materialization.mjs`は、Node explicit pathで`test_data/sample_model.psd`をparse/materializeできる。
- `test_data/sample_model.psd`はprivate/local fixtureであり、public demo materialではない。
- `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`はcompact evidence JSONであり、raw/visual bytesは保存していない。
- Browser file input actual byte intake、current-session byte evidence、same-origin IndexedDB byte restore、portable JSON bundle v0は実装済み。
- Editor Viewer/Previewはsemantic inspection/runtime evidenceであり、full renderer / pixel oracleではない。
- EditorにはPSD file selectionからbrowser parserを実行し、layer/group treeを表示するworkflowはまだない。

## 5. Design Decisions

- Wave45はEditor内のexplicit PSD file selectionを対象にする。drag-drop、directory picker、archive expansion、remote URL、OS watcherは含めない。
- `@webtoon/psd`をEditor/browser runtimeで使うかはDomain Aでdependency scopeを再評価し、問題なければregistry scopeを狭く拡張する。安全性やbundle/browser suitabilityに問題があれば`escalate`する。
- Parser importはEditor/browser PSD import adapterに閉じる。operation-core、validator-core、runtime-coreなどのproduction package sourceへparser依存を漏らさない。
- Editorは選択PSDのdocument metadata、layer/group tree、visibility/opacity/bounds、unsupported/notEvaluated feature summary、selected layer materialization evidence summaryを表示する。
- Package/session evidenceはparser-free PSD evidence contractに落とし込み、raw parser objectを保存しない。
- Selected layer materializationは、Wave44と同じくcompact evidenceを主対象にする。raw/visual bytesの永続化、public demo asset化、Photoshop合成previewはしない。
- Existing byte intake / persistence semanticsを維持し、save/load後は「PSD bytes availability」と「parse result/session evidence」の境界をtruthfulに表示する。
- Product Preflightはsession-generated read-onlyのまま。persisted/exported Preflight artifact、CI/release/demo gateは実装しない。

## 6. Non-Goals

- Drag-drop、directory picker、File System Access API、ZIP/archive/native filesystem/cloud transport。
- PNG image set import workflow expansion。
- General PSD materialization across all layers。
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、mask/clipping/color-management correctness。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来のpublic screenshots/exports/bundles。
- repo-side AI repair generation/ranking、natural-language repair、LLM provider integration、auto-fix、automatic commit、external transport。
- Broad refactor of Editor workflow or package source only to make the import UX convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave44/wave44-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-h-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44 Domain B-F reports/reviews relevant to PSD parser/materialization evidence
- domainごとのtarget source / tests / e2e files

UndineはEditor source、parser source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave45は最初にbrowser parser dependency scope / trust boundaryを固定する。その後、browser parser bridgeとpackage/session evidence bridgeを並列化し、Editor UX、validator/Product Preflight、e2e regression、docs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Browser parser dependency scope / trust boundary | Solo first | Wave44 complete | `@webtoon/psd`をEditor/browserで使うscope、bundle/security/provenance、registry update方針を固定する |
| 2 | B. Browser PSD parser bridge and session evidence | Parallel with C | A | Editor/browser側で明示選択PSD bytesをparseし、parser-free PSD evidenceへ変換するadapter/serviceを実装する |
| 2 | C. Package / operation PSD import evidence bridge | Parallel with B | A | Parsed PSD source profile/layer tree/materialization evidenceをpackage/session operation evidenceに接続する |
| 3 | D. Editor explicit PSD import UX / layer tree workflow | Solo after B/C | B + C | File inputからPSDを選択し、parse status、layer/group tree、selected layer evidenceをEditorに表示する |
| 3 | E. Validator / Product Preflight UX diagnostics alignment | Parallel with D after B/C | B + C | Browser import evidenceをvalidator/Product Preflight statusへtruthfulに接続し、unsupported scopeを表示できるようにする |
| 4 | F. Focused e2e and regression evidence | Solo after D/E | D + E | `sample_model.psd` file upload smoke、save/load boundary、no raw bytes/public asset claim、parser import guardを固定する |
| 5 | G. Documentation / traceability refresh | Solo after F | F | capability map、backlog、maps、traceabilityをWave45実装済み範囲へ同期する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

安全上の制約:

- Aはshared dependency scope ownerであり、複数Gnomeに分割しない。
- BはEditor/browser parser bridgeに限定し、operation/package persistenceやvalidator diagnosticsを変更しない。
- Cはpackage/session evidence bridgeに限定し、Editor UIを変更しない。
- DはEditor UXに限定し、parser dependency scopeやpackage contractを変更しない。
- Eはvalidator/Product Preflight diagnostics alignmentに限定し、Editor UIやparser implementationを変更しない。
- Fはe2e/regression/guardに限定し、product behaviorの追加実装をしない。
- Gはdocs/maps/traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave45-browser-parser-dependency-scope-trust-boundary`

Purpose:

- `@webtoon/psd@0.4.0`をEditor/browser runtimeで使うためのdependency scope拡張可否を確認する。
- Browser/bundle suitability、license/provenance/security、large-file trust boundary、parser failure behavior、private/local fixture policyを固定する。
- `generated/dependencies/dependency-registry.json`のscope更新が必要なら狭く実施する。

Allowed write scope:

- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`
- dependency/trust boundary docs under Wave45 report scope

Forbidden:

- Editor implementation
- Package/runtime/parser bridge implementation
- Product source changes outside dependency registry
- public demo asset claims

### B. `wave45-browser-psd-parser-bridge-session-evidence`

Purpose:

- Browser selected PSD bytesを`@webtoon/psd`でparseし、Wave44/Domain Cのparser-free PSD evidence shapeへ変換するEditor-local adapter/serviceを実装する。
- Parser failure、unsupported feature、parse status、sample metadata/layer tree summaryをsession evidenceとして扱う。

Allowed write scope:

- `apps/editor/src/**` parser bridge / workflow service files
- focused Editor unit tests if present
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- package-format / operation-core contract changes
- validator-core diagnostics
- UI workflow components owned by Domain D
- drag-drop / archive / File System Access API
- full compositing / renderer / pixel oracle

### C. `wave45-package-operation-psd-import-evidence-bridge`

Purpose:

- Browser parse resultからparser-free PSD source profile、layer tree、selected layer materialization evidenceをpackage/session operation evidenceへ接続する。
- Existing parser-free PSD adapter/profile compatibilityとsave/load boundaryを維持する。

Allowed write scope:

- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- focused package/operation tests
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- direct `@webtoon/psd` import in packages
- Editor UI
- validator-core diagnostics
- public schema-breaking rename unless escalated
- full compositing / renderer / pixel oracle

### D. `wave45-editor-explicit-psd-import-layer-tree-ux`

Purpose:

- Editorに明示PSD選択workflowを追加し、parse status、document metadata、group/layer tree、visibility/opacity/bounds、selected layer evidence summaryを表示する。
- Existing browser byte intake / persistence statusと矛盾しないUXにする。
- `test_data/sample_model.psd`をe2eでupload可能なworkflowにする。

Allowed write scope:

- `apps/editor/src/**`
- `apps/editor/e2e/**` only for narrow workflow helpers if needed
- focused Editor tests
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- Native drag-drop implementation
- Directory picker / File System Access API
- full renderer / pixel oracle / Photoshop compositing preview
- package contract changes
- direct public demo asset wording

### E. `wave45-validator-product-preflight-psd-import-diagnostics`

Purpose:

- Editor/browser PSD import evidenceをvalidator / Product Preflightのstatus、blocking reason、unsupported/notEvaluated claimsに接続する。
- Missing bytes、parse failure、unsupported features、selected materialization availabilityをtruthfulに表示できるようにする。

Allowed write scope:

- `packages/validator-core/src/**`
- Product Preflight focused tests
- `apps/editor/src/**` only for narrow report projection if Domain D does not own the same files; otherwise coordinate/escalate
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- broad Editor UI workflow changes
- Product Preflight persisted/exported artifact
- release/demo gate

### F. `wave45-psd-import-focused-e2e-regression`

Purpose:

- `test_data/sample_model.psd` upload/parse/layer-tree workflowをfocused e2e/regressionとして固定する。
- Save/load boundary、private/local fixture wording、no raw/visual bytes persisted、no production parser importsを検証する。

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**` focused e2e registry/guard updates if required
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control

### G. `wave45-docs-traceability-boundary-refresh`

Purpose:

- capability map、remaining backlog、implementation maps、fixture/traceability rowsをWave45実装範囲に同期する。
- Editor PSD import UXが実装済みになる範囲と、drag-drop/general PSD/full compositing/renderer/pixel等の未実装範囲を分ける。

Allowed write scope:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave45

### H. `wave45-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave45/**`
- `discussion/implementation/reviews/wave45/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave45 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave45起動時の実行単位はdomainごとのOrch-Sylphである。

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

- PSD Input Direction: PSDが主入力であり、PNG workflowやarchive/drag-dropへscope creepしていないか。
- Dependency / Trust Boundary: `@webtoon/psd` scope拡張がlicense/provenance/security/browser suitabilityとregistryに記録されているか。
- Parser Boundary Truthfulness: browser parserが証明する範囲と、unsupported/notEvaluated範囲を誤主張していないか。
- Editor UX Truthfulness: parse status、byte availability、save/load後の再parse/reupload状態がtruthfulか。
- Source Organization: source editsがbarrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Contract / Schema Consistency: parser-free PSD evidence、operation evidence、validator/Product Preflight refsが矛盾していないか。
- Test Adequacy: sample PSD upload、layer tree display、save/load boundary、parser import guard、validator diagnosticsがdomain riskに見合うか。
- Non-Goals: drag-drop、archive/filesystem、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side AI repair等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: dependency registry/scope diff, browser suitability/security review, `pnpm run check:deps`
- Domain B: focused Editor parser bridge tests, parser failure cases, no package/runtime parser import scan
- Domain C: package/operation evidence tests, parser-free compatibility tests
- Domain D: Editor workflow tests or focused UI checks for PSD selection/layer tree display
- Domain E: validator/Product Preflight focused tests for browser import evidence and unsupported claims
- Domain F: focused e2e upload/parse/layer-tree regression with `test_data/sample_model.psd`
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
- Wave45 focused PSD import e2e/regression command
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `node scripts/check-source-organization-fixtures.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/run-focused-e2e.mjs --check`
- `node scripts/check-dependencies-guard-self-test.mjs`
- `node scripts/check-wave43-validator-contract-coverage.mjs`
- parser import scan: allowed only in explicitly scoped Editor/browser parser bridge; no direct parser imports in package/runtime/validator source
- `git diff --check -- package.json pnpm-lock.yaml generated apps packages scripts fixtures test_data discussion/implementation discussion/development_convention discussion/tests`
- dependency manifest/lockfile/registry status check
- forbidden-scope scan for PNG workflow expansion、drag-drop、archive/filesystem、full compositing、renderer/pixel oracle、Cubism、public demo asset、repo-side repair/LLM/autofix claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- `@webtoon/psd`をbrowser/editor runtimeへ持ち込むlicense/provenance/security/bundle riskが受理できない。
- Dependency scope expansionに追加ユーザー承認が必要になる。
- Browser parserが`test_data/sample_model.psd`を実用的にparseできない、またはUIを固める前に別parser選定が必要になる。
- Package/runtime/validatorへdirect parser importが必要になる。
- Drag-drop、archive/filesystem、File System Access API、directory picker、remote URL、OS watcherが必要になる。
- Full compositing、renderer/pixel oracle、texture sampling correctnessが必要になる。
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Public schema-breaking renameやfixture-wide churnが必要になる。
- Existing large filesを広くリファクタしないとguardが通らない。
- Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

実行前に明示的なユーザー判断を求めるなら、論点は1つだけである: `@webtoon/psd`をscripts-onlyからEditor/browser parser bridge用へscope拡張することをWave45のDomain Aで再評価し、問題なければ進めるか。うちの推奨は、Domain Aにこの判断を委譲し、危険が見つかった場合だけ`escalate`する方針である。

Wave45後のproduct priority選択はscope外として残す。候補はgeneral PSD materialization、drag-drop、archive/filesystem、renderer/pixel oracle、advanced topology/UV、public/demo assets、Cubism policy reconsiderationである。

## 14. Pass Criteria

Wave45は次を満たしたときpassとする。

- `@webtoon/psd`のEditor/browser parser bridge scopeがdependency registryとpolicyに記録されている、または安全に拡張できず`escalate`として明確に記録されている。
- Editorでユーザーが明示選択したPSD fileをbrowser session内でparseできる。
- `test_data/sample_model.psd` upload workflowでdocument metadata、layer/group tree、visibility/opacity/bounds、unsupported/notEvaluated summaryがEditorに表示される。
- Parser resultはparser-free PSD evidence contractへ変換され、raw parser objectをpackage/session stateへ保存しない。
- Selected layer materialization evidence summaryをEditor/validator/Product Preflightがtruthfulに扱える。raw/visual bytesは永続化せず、public demo asset claimもしない。
- Save/loadまたはreload後のbyte availability / reparse requirement / missing bytes stateがtruthfulに表示される。
- Focused e2eまたは同等のbrowser regressionが`test_data/sample_model.psd`のupload/parse/layer tree workflowを検証する。
- No PNG workflow expansion、no drag-drop、no archive/filesystem、no full compositing、no renderer/pixel oracle、no Cubism compatibility claim、no public sample PSD demo asset、no repo-side repair generation、no LLM/provider integration。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。

