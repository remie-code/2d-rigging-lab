# Wave 44 Plan: PSD Parser Dependency / Layer Raster Materialization Pilot v0

> Wave44で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave44
- Wave name: `psd-parser-dependency-layer-raster-materialization-pilot-v0`
- Primary objective: PSDを主入力フォーマットとして扱うため、dependency / license / security / fixture boundaryを固定し、`test_data/sample_model.psd`を明示パスでparseして、layer tree / part候補 / selected layer raster materializationの最小証跡を実装する。Wave44ではEditor file picker、PNG image set workflow、Photoshop風full compositing、full renderer、pixel oracleは実装しない。

## 2. 次Wave選定

Wave43はvalidator contract / evidence naming consistencyを完了し、Wave31以降に増えたbyte availability、portable bundle、transport capability、Product Preflight、Codex proposalなどのvalidator/evidence/report surfaceを、contract prose、diagnostic policy、traceability、checkerで同期した。

一方で、現在のAsset I/Oはbrowser selected byte intake、parser-free PSD adapter/profile metadata、split PNG source metadataに留まっている。real PSD layer parse、PSD decode、raster extraction、texture/materializationは未実装であり、実際にLive2Dモデル制作へ近づけるには、PSDを読んでlayer treeとlayer画像を取り出す境界を避けて通れない。

Wave44では **PSD Parser Dependency / Layer Raster Materialization Pilot v0** を選ぶ。

理由:

- PSDは主入力フォーマットである。実利用の大半はPSDを想定し、PNG image set workflowは主経路にしない。
- `test_data/sample_model.psd` が利用可能になっており、実PSDに対するparse/materialization evidenceを作れる。
- Editor UXやViewer maturityへ進む前に、dependency、license、security、fixture provenance、acceptance oracleを固定する必要がある。
- Wave42/43でsource organization、dependency guard、validator contract consistencyが強化されており、外部parser依存とreal asset pipelineの入口を検証しやすくなっている。
- 「ユーザー判断なしに進められる」こと自体は優先価値にしない。必要なユーザー判断を避けてプロダクトの正しい方向から外れる方が問題である。

## 3. Undineコンテキスト保護規約

Wave44でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。
- dependencyを扱うdomainには`discussion/development_convention/dependency-policy.md`を渡し、license/provenance/security確認なしにmanifest/lockfileを変更しない。

## 4. Repository Facts

- `test_data/sample_model.psd` は、ユーザーが実際にLive2D制作時に使用したPSDであり、Wave44で自由に利用してよい。
- browser file-input actual byte intake、same-origin IndexedDB byte restore、project-defined portable JSON bundle v0は実装済み。
- parser-free PSD adapter/profile metadataとsplit PNG source metadata workflowは実装済みだが、real PSD parse/decode/raster extraction/materializationは未実装である。
- Product Preflight / validatorはunsupported / not-evaluated / semantic evidence onlyの境界を表現できる。
- Editor Viewer/Previewはsemantic inspection/runtime evidenceであり、full rendererやpixel oracleではない。
- 現時点ではPSD parser dependency、image decode dependency、archive/filesystem dependency、renderer dependencyは導入されていない。
- Cubism SDK/Core、Cubism形式import/export、`.moc3`、`.model3.json`、Cubism Physics compatibilityはnon-goalのままである。

## 5. Design Decisions

- Wave44はPSDを主対象にする。PNG image set workflowは主対象にせず、必要な互換境界が見つかった場合だけfuture scopeとして記録する。
- Wave44の入力はNode-first explicit path workflowとする。Node test/scriptでは明示パス、将来のEditorではuser file input / dropで明示選択されたfileのみを対象にする。自動directory scan、remote URL、archive expansion、OS watcherは含めない。
- 新規dependencyは必要なら追加してよい。ただしDomain Aでdependency/license/provenance/security/browser-or-node suitabilityを確認し、manifest / lockfile変更はDomain B以降で意図して行う。
- `test_data/sample_model.psd`由来の派生artifactは、作業しやすさと検証容易性のため必要ならrepositoryに残してよい。ただしprivate/local fixture由来と明示し、public distributable demo assetとして扱わない。
- Wave44はreal PSDからlayer tree、part候補、selected layer raster materialization evidenceを得る。Photoshop風の最終合成再現は実装しない。
- Unsupported Photoshop featuresは、実装済みとしてclaimせず、`unsupported` / `notEvaluated` / diagnostic evidenceとして表現する。
- Parser adapter、materialization、diagnostic helpersは単一責務のsource fileに分割し、public `index.ts`はbarrel-onlyに保つ。
- Codex側inference、repair proposal generation、natural-language repairはrepo側責務ではない。

## 6. Non-Goals

- PNG image set import workflowの拡張。
- Editor file picker / drag-drop / browser PSD import UXの本格実装。
- ZIP/archive writer/importer、File System Access API、directory picker、native filesystem、cloud/cross-profile persistence。
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、color profile再現。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Product Preflight persisted/exported artifact、CI/release gate、demo gate。
- repo-side repair generation/ranking、natural-language repair、LLM provider integration、auto-fix、automatic commit、external transport。
- Broad refactor only to install a parser or make materialization code convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave44-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave43/wave43-final-report.md`
- `discussion/implementation/reviews/wave43/wave43-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `test_data/sample_model.psd`
- domainごとのtarget source / docs / tests
- domainごとの既存verification commands

UndineはPSD parser source、validator source、package-format source全文を自分で読み込まない。詳細規約、source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave44は最初にdependency/security/fixture boundaryを固定し、その後parser smokeとcontract boundaryを並列化する。materializationとvalidator diagnosticsはparser/contractの結果を受けて並列化し、最後にfixture/evidence/docs/final reviewへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. PSD dependency / security / fixture boundary | Solo first | Wave43 complete | PSD parser dependency候補、license/provenance/security、`sample_model.psd`派生artifact方針、unsupported feature表現を固定する |
| 2 | B. PSD parser dependency and Node smoke | Parallel with C | A | 選定dependencyを導入し、explicit pathで`sample_model.psd`をparseしてmetadata/layer tree/raster capability evidenceを得る |
| 2 | C. PSD layer tree contract / profile boundary | Parallel with B | A | real PSD parse resultを受けるcontract/profile/materialization evidence境界を定義し、parser-free profile互換を保つ |
| 3 | D. PSD raster layer materialization pilot | Parallel with E | B + C | selected layer rasterをdeterministicにmaterializeし、digest/byteLength/mediaType/source layer/provenanceと結びつける |
| 3 | E. PSD validator provenance / security diagnostics | Parallel with D | B + C | parsed PSD/materialization/unsupported feature/malformed parseをvalidator/Product Preflight evidenceにtruthfulに反映する |
| 4 | F. PSD fixture evidence and Node regression | Solo after D/E | D + E | `sample_model.psd`と必要な派生artifactを使い、parser/materialization/validator evidenceをregressionとして固定する |
| 4 | G. Documentation / traceability boundary refresh | Solo after F | F | capability map、backlog、maps、traceabilityをWave44の実装済み範囲とunsupported範囲に同期する |
| 5 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

安全上の制約:

- Aはshared dependency/security/fixture ownerであり、複数Gnomeに分割しない。
- Bだけがdependency manifest / lockfile変更を担当する。Aの方針なしにdependencyを導入しない。
- Bはparser adapter / Node smokeに限定し、validator diagnosticsやdocs refreshを変更しない。
- Cはcontract/profile boundaryに限定し、dependency installやparser implementation detailを過剰に露出しない。
- Dはraster materialization pilotに限定し、full compositingやrenderer oracleを実装しない。
- Eはvalidator/Product Preflight diagnosticsに限定し、parser実装やdependency installを行わない。
- Fはfixture/evidence regressionに限定し、product UIを追加しない。
- Gはdocs/maps/traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave44-psd-dependency-security-fixture-boundary`

Purpose:

- PSD parser / decoder dependency候補を調査し、license、maintenance、Node/browser suitability、security posture、large file handling、layer raster extraction capabilityを整理する。
- `test_data/sample_model.psd`の利用方針、派生artifact配置、fixture provenance表記、private/local fixtureとpublic demo assetの分離を明文化する。
- Wave44で使うparser boundary、unsupported feature表現、early escape条件を固定する。

Allowed write scope:

- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/current-capability-map.md`
- dependency / fixture方針を記録する小さなdocs / reports

Forbidden:

- Source implementation
- Package manifest / lockfile changes
- Editor UI implementation
- Full compositing / full renderer / pixel oracle claim

### B. `wave44-psd-parser-dependency-node-smoke`

Purpose:

- Domain Aで選定したdependencyを導入する。
- explicit pathのNode script / testで`test_data/sample_model.psd`をparseし、document metadata、layer/group tree、layer bounds、visibility、opacity、raster extraction capabilityをstructured evidenceとして出す。
- Parser adapterを巨大な`index.ts`に置かず、単一責務のsource organizationに従って分割する。

Allowed write scope:

- `package.json`
- `pnpm-lock.yaml`
- PSD parser adapterに必要なnarrow package source under `packages/**`
- `scripts/**`
- parser smoke / unit tests
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Editor UI implementation
- Full compositing
- Archive/filesystem implementation
- PNG image set workflow expansion
- Validator/Product Preflight diagnostics implementation

### C. `wave44-psd-layer-tree-contract-profile-boundary`

Purpose:

- real PSD parse resultを受けるためのlayer tree / source profile / materialization evidence contractを定義または拡張する。
- parser-free PSD adapter/profileとの互換境界を維持する。
- unsupported Photoshop featuresをclaimせず、`unsupported` / `notEvaluated`として表現できるcontractを用意する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- `packages/operation-core/src/**`のDTO / adapter boundary
- contract / package-format unit tests
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Dependency install
- Parser dependency specific implementation detailの過剰露出
- Full compositing claim
- Editor UI implementation

### D. `wave44-psd-raster-layer-materialization-pilot`

Purpose:

- real PSD parse resultから、少なくともselected layer rasterをdeterministicにmaterializeするpilotを作る。
- materialized assetはdigest / byteLength / mediaType / source layer reference / provenanceと結びつける。
- `test_data/sample_model.psd`由来の派生artifactを残す場合、配置とprovenanceを明示する。

Allowed write scope:

- PSD materialization source under `packages/**`
- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- `fixtures/**`
- `test_data/derived/**`またはWave44固有fixture directory
- materialization tests
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Photoshop風full compositing
- Texture sampling correctness / pixel oracle
- Editor drag-drop / file picker implementation
- Public demo asset claim

### E. `wave44-psd-validator-provenance-security-diagnostics`

Purpose:

- validator / Product Preflight evidenceに、real PSD parse/materializationのprovenance、dependency boundary、unsupported feature、missing raster、unsafe/malformed parse failureをtruthfulに反映する。
- `parser/decode unsupported`だった従来のbacklog/capability表現を、Wave44の実装済み範囲に合わせて狭く更新できるようにする。

Allowed write scope:

- `packages/validator-core/src/**`
- validator fixtures / tests
- `packages/package-format/src/**`のdiagnostic接続
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Parser implementation
- Dependency install
- Full renderer / pixel oracle
- AI repair generation

### F. `wave44-psd-fixture-evidence-node-regression`

Purpose:

- `test_data/sample_model.psd`と必要な派生artifactを使い、Wave44のparser / layer tree / raster materialization / validator evidenceをregressionとして固定する。
- fixture manifest、traceability、source guardへの登録を行う。

Allowed write scope:

- `fixtures/**`
- `test_data/derived/**`
- `scripts/**`
- `packages/**/__tests__/**`
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Product UI追加
- Full compositing / renderer oracle
- Public demo asset化

### G. `wave44-docs-traceability-boundary-refresh`

Purpose:

- current capability map、remaining backlog、implementation maps、traceability、Wave44 final report下書きを、real PSD parser/materialization pilotの範囲に合わせて更新する。
- unsupportedのまま残るPNG workflow、full compositing、renderer/pixel、archive/filesystem、Cubismを明示する。
- 「ユーザー判断なし」を優先価値にしないnext-wave planning principleを維持する。

Allowed write scope:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`

Forbidden:

- Source implementation
- Unsupported capability claim
- Broad documentation rewrite not required by Wave44 evidence

### H. `wave44-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave44/**`
- `discussion/implementation/reviews/wave44/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave44 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave44起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain D / EのOrch-Sylphを並列投入する。
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

- PSD Input Direction: PSDが主入力であり、PNG image set workflowを主経路として広げていないか。
- Dependency / License / Provenance: parser/decode dependencyのlicense、provenance、security posture、Node/browser suitabilityが記録されているか。
- Parser Boundary Truthfulness: parseできる範囲、materializeできる範囲、unsupported Photoshop featureを誤主張していないか。
- Fixture Rights / Privacy: `test_data/sample_model.psd`由来artifactがprivate/local fixtureとして扱われ、public demo asset化していないか。
- Source Organization: source editsがある場合、barrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Contract / Schema Consistency: parser-free PSD profile、real PSD profile、validator diagnostics、Product Preflight evidenceが矛盾していないか。
- Test Adequacy: real sample smoke、materialization regression、validator diagnostics、guard testsがdomain riskに見合うか。
- Non-Goals: Editor file picker/drag-drop、archive/filesystem、full compositing、full renderer、pixel oracle、Cubism、repo-side AI repair等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: dependency/license/provenance/security matrix、fixture/provenance policy review
- Domain B: explicit path parse smoke for `test_data/sample_model.psd`, dependency import / parser adapter unit tests
- Domain C: contract serialization / roundtrip, parser-free profile compatibility, unsupported feature evidence cases
- Domain D: selected layer raster materialization smoke, digest / byteLength / mediaType stability, missing/unsupported raster case
- Domain E: validator diagnostics for parsed PSD profile, unsupported compositing feature non-claim, malformed / unavailable parser evidence case
- Domain F: fixture manifest consistency, Node parser/materialization regression, source organization / dependency guard compatibility
- Domain G: docs/map/traceability consistency checks and `git diff --check`
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `node scripts/check-source-organization-fixtures.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/run-focused-e2e.mjs --check`
- `node scripts/check-dependencies-guard-self-test.mjs`
- `node scripts/check-wave43-validator-contract-coverage.mjs`
- Wave44で追加されたPSD parser / materialization focused command
- `git diff --check -- package.json pnpm-lock.yaml packages scripts fixtures test_data discussion/implementation discussion/development_convention discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for PNG image set workflow expansion、Editor file picker/drag-drop implementation、archive/filesystem implementation、full compositing、full renderer、pixel oracle、Cubism compatibility、repo-side repair generation / candidate ranking / LLM provider / natural-language repair / auto-fix / external transport claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Viable PSD parser/decode dependencyが見つからない。
- Dependency license/provenance/security postureが不明またはリスクが高い。
- Package install / network access / dependency approvalが必要になる。
- `test_data/sample_model.psd`由来artifactのrepository保存方針が矛盾する。
- Parser dependencyがlayer raster extractionを安全に提供できない。
- Browser/editor UI integrationを実装しないとpassできない。
- Photoshop風full compositing、renderer/pixel oracle、texture sampling correctnessが必要になる。
- Archive/filesystem implementation、File System Access API、drag-drop、directory pickerが必要になる。
- Cubism compatibility claimが必要になる。
- Public schema-breaking renameやfixture-wide churnが必要になる。
- Existing large filesを広くリファクタしないとguardが通らない。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

Wave44起動前のプロダクト方向判断は、この文書の受理済み判断で固定する。実装中に新しい判断分岐が出た場合は、Orch-Sylphが質問を集約し、Undineがユーザーへ確認する。

Wave44後のproduct priority選択はscope外として残す。候補はEditor file picker / drag-drop、PSD UX integration、renderer/pixel oracle、archive/filesystem、advanced topology/UV、public/demo assets、Cubism policy reconsiderationである。

## 14. Pass Criteria

Wave44は次を満たしたときpassとする。

- Dependency/license/provenance/security/browser-or-node suitabilityの判断が記録されている。
- `test_data/sample_model.psd`をexplicit pathでparseでき、document metadata、layer/group tree、layer bounds、visibility、opacityなどのstructured evidenceが得られる。
- selected layer rasterを少なくとも1つdeterministicにmaterializeでき、digest / byteLength / mediaType / source layer reference / provenance evidenceを記録できる。安全に実現できない場合は`escalate`として明確に記録する。
- parser-free PSD adapter/profileとreal PSD parser profileのcontract boundaryが矛盾していない。
- validator / Product Preflightが、implemented PSD parse/materialization scope、unsupported Photoshop feature、malformed/unavailable parser evidenceをtruthfulに表現できる。
- `test_data/sample_model.psd`由来artifactがprivate/local fixtureとして扱われ、public distributable demo assetとして誤主張されていない。
- No PNG image set workflow expansion、no Editor file picker/drag-drop implementation、no archive/filesystem implementation、no full compositing、no full renderer、no pixel oracle、no Cubism compatibility claim、no repo-side repair generation、no LLM/provider integration。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。

