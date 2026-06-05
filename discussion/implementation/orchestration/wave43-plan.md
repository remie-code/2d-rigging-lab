# Wave 43 Plan: Validator Contract / Evidence Naming Consistency v0

> Wave43で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave43
- Wave name: `validator-contract-evidence-naming-consistency-v0`
- Primary objective: Wave31以降で増えたbyte availability、persistent byte storage、portable bundle、transport capability、topology/UV、warp lattice、Product Preflight、Codex proposal関連のvalidator diagnostics / evidence / report surfaceを、validator contract prose、diagnostic policy、traceability、focused checkerで同期する。Wave43では新しいproduct capabilityを主張せず、実装済みsurfaceの説明・検査・命名一貫性を締める。

## 2. 次Wave選定

Wave42はquality gate / focused e2e registry / source guardrailsを完了し、今後の大きいproduct waveに入るためのrepository safetyを少し強くした。

一方で、[remaining-work-backlog.md](../remaining-work-backlog.md)には、validator contract proseが新しいbyte availability、portable bundle、transport、topology/UV、warp lattice、Product Preflight diagnosticsを適切な粒度で列挙するようrefreshすべき、という品質負債が残っている。これはarchive/filesystem、real PSD/PNG parser/decode、renderer/pixel oracle、public/demo assets、Cubism policy reconsiderationのような大きいproduct priority判断なしで進められる。

Wave43では **Validator Contract / Evidence Naming Consistency v0** を選ぶ。

理由:

- 追加のproduct方針判断なしで進められる。
- Wave31-W42の新しいvalidator/evidence/report surfaceが、古いcontract proseに埋もれるリスクを下げる。
- 次にreal parser/decodeやrenderer/pixel oracleへ進む場合でも、何をvalidatorが証明し、何を証明しないかの境界が読みやすくなる。
- Wave42で作ったguard / focused registry / source organization policyを使って、docsとcodeのズレを小さく検出できる。

## 3. Undineコンテキスト保護規約

Wave43でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- `discussion/design/module-contracts/validator-contract.md` はvalidator module contract proseの主要な入口である。
- `discussion/development_convention/diagnostic-policy.md` と `discussion/development_convention/schema-and-id-conventions.md` はdiagnostic ID、schema、naming方針のbasisである。
- `packages/validator-core/src/check-catalog.ts` はvalidator check catalogの主要なsource registrationである。
- `packages/validator-core/src/product-preflight-report.ts`、`product-preflight-report-diff*.ts`、`validation-report*.ts`、`runtime-evidence-report.ts`、`operation-evidence-report.ts`、各`validators/**`にはWave31以降のdiagnostic/evidence/report surfaceが広がっている。
- Wave42により、source organization guard、focused e2e registry/list/check/single-selection runner、dependency / forbidden-scope guard self-testが存在する。
- 現時点ではreal PSD/PNG parser/decode、archive/filesystem implementation、full renderer、pixel oracle、Cubism compatibility、repo-side LLM/provider/repair generationは未実装であり、Wave43でも実装しない。

## 5. Design Decisions

- Wave43はcontract / evidence / diagnostic consistency waveであり、新しいproduct capabilityを実装しない。
- Contract prose refreshは、実装済みsurfaceを説明する。将来予定やunsupported項目を、実装済みとして書かない。
- Evidence naming cleanupは、public schema-breaking renameを原則避ける。schema変更が必要になる場合は`escalate`し、Wave43で無理に進めない。
- Source changesを行う場合は、既存のschema / fixture / report behaviorを壊さず、small helper、catalog coverage test、deterministic checkerの範囲に限定する。
- Checkerはdeterministicで、network、external dependency、external tool downloadに依存しない。
- Product Preflight durability/export、release/demo gate、real parser/decode、renderer/pixel oracle、Cubism compatibility、repo-side AI repairはWave43のscope外である。

## 6. Non-Goals

- Product Preflight persisted/exported artifact、CI/release gate、demo gate。
- real PSD/PNG parser、image decode、raster extraction、texture materialization、compositing。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementation。
- full renderer、standalone viewer、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- LLM provider integration、prompt template、natural-language repair、repo-side repair generation/ranking、auto-fix、automatic commit、external transport。
- Broad schema-breaking rename、fixture churn、application UI feature work。
- Broad refactor only to make prose or checker nicer.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave43-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave42/wave42-final-report.md`
- `discussion/implementation/reviews/wave42/wave42-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `packages/validator-core/src/check-catalog.ts`
- domainごとのtarget source / docs / tests

Undineは全validator/evidence source全文を自分で読み込まない。詳細規約、source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave43は最初にvalidator/evidence inventoryとcanonical coverage matrixを固定し、その後docs refresh、catalog/checker hardening、evidence wording scanを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Validator / evidence inventory foundation | Solo first | Wave42 complete | Wave31-W42で増えたdiagnostic/evidence/report surfaceを棚卸し、canonical coverage matrixとWave43 checker targetを固定する |
| 2 | B. Validator contract prose refresh | Parallel with C/D | A | `validator-contract.md`を実装済みvalidator/evidence/report surfaceに合わせて更新し、unsupported境界を明示する |
| 2 | C. Diagnostic policy / schema convention sync | Parallel with B/D | A | `diagnostic-policy.md` / `schema-and-id-conventions.md` / traceabilityの命名・ID規約を実装済みcheck IDsに合わせて狭く同期する |
| 2 | D. Catalog coverage checker and tests | Parallel with B/C | A | `check-catalog.ts` とcontract/docsの代表的なcoverageズレを検出するdeterministic checker / testsを追加する |
| 3 | E. Evidence naming consistency guard / source-safe cleanup | Solo after B/C/D | B + C + D | runtime/viewer/validator evidence wordingのpositive claimを検査し、schema-breakingなしで直せる小さなsource/doc wordingのみ修正する |
| 4 | F. Integration review and final report | Solo after E | E | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared inventory ownerであり、複数Gnomeに分割しない。
- Bは主に`validator-contract.md`に限定し、source codeを変更しない。
- Cはdevelopment convention / traceability同期に限定し、`validator-contract.md`やsource codeを変更しない。
- Dはchecker / focused testsに限定し、contract prose本文の編集をしない。
- EはB/C/Dの結果を受けた小さなconsistency guard / wording cleanupに限定する。schema-breaking renameやfixture-wide updateが必要なら`escalate`する。
- Fはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave43-validator-evidence-inventory-foundation`

Purpose:

- Wave31-W42で増えたdiagnostic/evidence/report surfaceを棚卸しする。
- byte availability、persistent byte storage、portable bundle、transport capability、topology/UV、warp lattice、Product Preflight、Codex proposal関連のcoverage matrixを作る。
- Wave43で同期するdocs/checkerの境界を固定する。

Allowed write scope:

- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`
- `scripts/**` only if a small inventory helper is needed

Forbidden:

- Product source changes under `apps/editor/src/**` or broad `packages/**`
- `validator-contract.md` final prose rewrite
- manifest / lockfile changes
- product capability implementation
- parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport work

### B. `wave43-validator-contract-prose-refresh`

Purpose:

- `discussion/design/module-contracts/validator-contract.md` を、実装済みvalidator diagnostics / Product Preflight / evidence / report surfaceに合わせて更新する。
- unsupported / semantic evidence only / product capability boundaryを明示する。

Allowed write scope:

- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`

Forbidden:

- Source code edits
- `diagnostic-policy.md` / `schema-and-id-conventions.md` edits
- Product capability claims
- parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport claims

### C. `wave43-diagnostic-policy-schema-traceability-sync`

Purpose:

- `diagnostic-policy.md`、`schema-and-id-conventions.md`、traceability rowsを、現行check IDs / evidence labels / Wave42 guard entry pointsに合わせて狭く同期する。
- validator contract proseと矛盾しない命名・ID規約を明示する。

Allowed write scope:

- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`

Forbidden:

- Source code edits
- `validator-contract.md` edits
- Product capability claims
- broad traceability rewrite

### D. `wave43-validator-contract-coverage-checker`

Purpose:

- validator catalog / docs / coverage matrixの代表的なズレを検出するdeterministic checkerまたはfocused testを追加する。
- 新しいcheckerはWave42 guard surfaceと矛盾せず、実行していないbrowser coverageを主張しない。

Allowed write scope:

- `scripts/**`
- `packages/validator-core/src/check-catalog*.test.ts` or narrowly scoped validator-core tests if needed
- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`

Forbidden:

- `validator-contract.md` prose rewrite
- `diagnostic-policy.md` / `schema-and-id-conventions.md` prose rewrite
- broad validator implementation changes
- manifest / lockfile changes
- product capability implementation

### E. `wave43-evidence-naming-consistency-guard`

Purpose:

- runtime/viewer/validator evidence wordingが、semantic evidence only、Product Preflight、unsupported parser/archive/renderer/Cubism境界を誤主張していないか確認する。
- schema-breakingなしで直せる小さなnaming / wording / report label cleanupだけを実施する。

Allowed write scope:

- Narrow evidence/report helpers under `packages/runtime-core/src/**` and `packages/validator-core/src/**` if directly required
- focused tests for those helpers
- `scripts/**` for a deterministic evidence wording guard if needed
- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`

Forbidden:

- Public schema-breaking rename
- fixture-wide churn only for naming preference
- Editor UI feature changes
- product capability implementation
- parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport work
- manifest / lockfile changes

### F. `wave43-integration-review-and-final-report`

Purpose:

- Domains A-Eを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave43/**`
- `discussion/implementation/reviews/wave43/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless guard registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave43起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / C / DのOrch-Sylphを並列投入する。
3. Domain B / C / Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
4. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
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

- Contract Truthfulness: 実装済みsurfaceだけを説明し、future / unsupportedを実装済みとして書いていないか。
- Diagnostic Coverage: `check-catalog.ts`、diagnostic policy、validator contract proseの代表的なcoverageが整合しているか。
- Evidence Naming: semantic evidence only、Product Preflight、runtime/viewer evidence、unsupported parser/archive/renderer/Cubism境界を誤主張していないか。
- Source Organization: source editsがある場合、barrel-only `index.ts`、catch-all file、巨大source file guardを満たすか。
- Test Adequacy: checker / unit / focused regression がdomain riskに見合うか。
- Non-Goals: Product Preflight persisted/exported artifact、release/demo gate、parser/archive/filesystem/renderer/Cubism/LLM/autofix/external transport等に逸脱していないか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: inventory helper or direct search evidence, Wave43 coverage matrix review
- Domain B: validator contract prose consistency scan and `git diff --check`
- Domain C: diagnostic/schema/traceability consistency checks and `git diff --check`
- Domain D: new checker/test command, `pnpm run check:source`, `pnpm run check:deps`
- Domain E: focused unit/checker tests for evidence wording; no schema-breaking fixture churn
- Domain F: final full verification and clean integration review

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
- Wave43で追加されたvalidator contract / evidence consistency checker
- `git diff --check -- packages/validator-core packages/runtime-core scripts discussion/design discussion/development_convention discussion/tests discussion/implementation`
- dependency manifest diff/status check
- forbidden-scope scan for Product Preflight persisted/exported artifact claims、release/demo gate claims、repo-side repair generation / candidate ranking / LLM provider / natural-language repair / auto-fix / external transport / parser / image decode / archive/filesystem implementation / renderer / pixel oracle / Cubism compatibility claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Product capability implementationが必要になる。
- Product Preflight persisted/exported package artifact、release/demo acceptance gateが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Public schema-breaking renameやfixture-wide churnが必要になる。
- Existing large filesを広くリファクタしないとguardが通らない。
- Parser/image decode、archive/filesystem implementation、renderer/pixel oracle、Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

現時点では、contract / evidence / diagnostic consistencyに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

次のproduct priority選択はWave43のscope外として残す。候補はarchive/filesystem、real PSD/PNG parser/decode、renderer/pixel oracle、advanced topology/UV、layer tree UX、public/demo assets、Cubism policy reconsiderationである。

## 14. Pass Criteria

Wave43は次を満たしたときpassとする。

- Validator contract proseがWave31-W42の主要なdiagnostic/evidence/report surfaceを、実装済み範囲として適切な粒度で列挙している。
- Diagnostic policy / schema conventions / traceabilityが、現行check IDs、semantic evidence only、unsupported境界を矛盾なく説明している。
- Validator catalogとcontract/docsの代表的なズレを検出するdeterministic checkerまたはfocused regressionが追加されている。
- Evidence naming / wording cleanupが、schema-breakingなしで実施されている、またはschema-breakingが必要な箇所を明確にfuture scopeへ残している。
- No product capability claim、no Product Preflight persisted/exported artifact、no release/demo gate、no repo-side repair generation、no candidate ranking、no LLM provider、no natural-language repair、no auto-fix、no external transport、no parser/image decode、no archive/filesystem implementation、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
