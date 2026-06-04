# Wave 42 Plan: Quality Gate Tightening / E2E Registry and Source Guardrails v0

> Wave42で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave42
- Wave name: `quality-gate-e2e-registry-source-guardrails-v0`
- Primary objective: Wave41までに広がった実装面を安全に維持するため、source organization guard、focused e2e registry / replay、dependency / forbidden-scope guard、traceability / documentation consistency を小さく強化する。Wave42では新しいproduct capabilityを主張せず、既存のPrivate Prototype方針とnon-goal境界を守るためのverification surfaceを実装する。

## 2. 次Wave選定

Wave39からWave41で、Product Preflight report、Codex proposal surface、Product Preflight diff/read ergonomicsが`implementation-proven`になった。

Product Preflight は、現在の趣味/個人利用ツールの範囲では session-generated read-only report のままにする受理済み判断がある。Codex は read/diff/rerun affordance から必要なPreflight情報を取得できるため、persisted/exported artifact、CI/release gate、demo gate、Codex以外の外部ツール向けPreflight artifactは、具体的な必要が出るまでスコープ外である。

次の大きいproduct directionとしては、archive/filesystem、real parser/decode、renderer/pixel oracle、public/demo asset policy、Cubism policy reconsiderationがある。ただし、これらはユーザー判断または依存関係/セキュリティ/権利/UX gateを伴う。

Wave42では **Quality Gate Tightening / E2E Registry and Source Guardrails v0** を選ぶ。

理由:

- 追加のproduct方針判断なしで進められる。
- 40wave以上の実装で増えたfocused e2e、source files、guard scriptsを整理し、今後の大きいwaveの安全性を上げる。
- `index.ts` barrel-only、巨大/catch-all source file回避、forbidden dependency / forbidden claim containment、focused e2e replayを明確化できる。
- archive/filesystemやreal parser/decodeなどの判断前に、verification基盤を少し固める方がリスクを下げる。

## 3. Undineコンテキスト保護規約

Wave42でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- `scripts/check-source-organization.mjs` は、`index.ts` barrel-only と broad catch-all source file names を検査する。
- `scripts/check-dependencies.mjs` は、forbidden Cubism / Live2D / proprietary dependency and asset declarations を検査する。
- root `package.json` は `typecheck`、`test:unit`、`test:e2e`、`check:source`、`check:deps` を持つ。
- `apps/editor/e2e/` には多数のfocused smoke scriptsがある。Wave41の`product-preflight-diff-smoke.mjs`はstandalone direct verificationとして受理されている。
- 現時点では、focused e2e scriptsを一覧化して選択実行するregistry、source guardのblind-spot regression fixture、forbidden-scope / non-goal claim guardの小さな分類補助はまだ整理されていない。
- Product Preflight durability/export、CI/release gate、demo gate、外部ツール向けPreflight artifactは、具体的な必要が出るまでスコープ外。
- Archive/filesystem、real parser/decode、renderer/pixel oracle、Cubism compatibilityは未実装であり、Wave42では実装しない。

## 5. Design Decisions

- Wave42はquality gate implementation waveであり、新しいproduct capabilityを実装しない。
- Guard scriptsはdeterministicで、network、external dependency、external tool downloadに依存しない。
- Focused e2e registryは、既存のdirect-run focused smokeを発見しやすく、必要なものを明示的にreplayできるようにする。全focused e2eを無条件に`pnpm test:e2e`へ追加して実行時間を肥大化させない。
- Source guard hardeningは、既存sourceの意図しない巨大化/catch-all化/barrel違反を捕まえる。既存のlarge legitimate filesを無理に一括リファクタしない。
- Forbidden dependency / forbidden claim guardは、Cubism/renderer/parser/archive/LLM/auto-fixなどの非目標実装や依存追加を検出しやすくする。negative assertions、non-goal docs、fixture false flagsは誤検出しないよう分類する。
- Documentation / traceability refreshは、guard scriptsの使い方と境界を記録する範囲に限定する。広い設計文書の書き換えはしない。

## 6. Non-Goals

- Product Preflight persisted/exported artifact、release acceptance runner、demo gate。
- repo-side repair candidate generation、candidate ranking、repair reasoning。
- LLM provider integration、prompt template、natural-language repair。
- Autonomous repair、auto-fix、automatic commit、batch auto-apply。
- External HTTP / WebSocket / MCP transport、外部caller adapter。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementation。
- Real PSD/PNG parser、image decode、raster extraction、texture materialization。
- Full renderer、standalone viewer、pixel oracle、texture sampling correctness assertion。
- Cubism SDK/Core互換、Cubism形式import/export。
- Broad refactor of application/package source only to satisfy newly introduced guardrails.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave42-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave41/wave41-final-report.md`
- `discussion/implementation/reviews/wave41/wave41-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget scripts / docs / tests
- domainごとの既存verification commands

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave42は最初にverification registry / guard boundaryを固定し、その後source guard、e2e registry runner、dependency / forbidden-scope guardを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Verification registry and quality gate boundary foundation | Solo first | Wave41 complete | focused e2e registry、guard categories、quality gate reporting shape、non-goal classification policyを固定する |
| 2 | B. Source organization guard hardening | Parallel with C/D | A | `check-source-organization`のblind spotsを小さく埋め、barrel-only / catch-all / large-file guard regressionを追加する |
| 2 | C. Focused e2e registry and replay runner | Parallel with B/D | A | `apps/editor/e2e` focused smokeをregistry化し、選択実行/一覧化/直接実行のverification surfaceを整える |
| 2 | D. Dependency and forbidden-scope guard refinement | Parallel with B/C | A | dependency/asset forbidden patternsとnon-goal claim scanの小さな分類補助を追加し、false-positiveを抑える |
| 3 | E. Documentation and traceability guard refresh | Solo after B/C/D | B + C + D | guard usage、focused e2e registry、source organization policy、traceability rowsを狭く同期する |
| 4 | F. Integration review and final report | Solo after E | E | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared verification boundary ownerであり、複数Gnomeに分割しない。
- Bはsource organization guardに限定し、e2e runnerやdependency guardを変更しない。
- Cはfocused e2e registry / replay runnerに限定し、application UIやpackage sourceを変更しない。
- Dはdependency / forbidden-scope guardに限定し、source organization guardやe2e runnerを変更しない。
- Eはdocumentation / traceability syncに限定する。source fixが必要な場合は該当domainへ差し戻す。
- Fはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave42-verification-registry-quality-gate-boundary-foundation`

Purpose:

- Wave42のquality gate対象を固定する。
- Focused e2e registry、guard category、guard report shape、non-goal classification policyを最小実装として定義する。

Allowed write scope:

- `scripts/**`
- focused script tests or fixture files if needed
- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`

Forbidden:

- Application/product source changes under `apps/editor/src/**` or `packages/**`
- Product Preflight persisted/exported artifact
- release/demo gate implementation
- parser/image/archive/filesystem/renderer/Cubism work
- external dependency / manifest / lockfile changes
- broad e2e aggregate runtime expansion

### B. `wave42-source-organization-guard-hardening`

Purpose:

- `scripts/check-source-organization.mjs` のblind spotsを小さく埋める。
- Barrel-only `index.ts`、forbidden catch-all files、巨大/catch-all化しやすいsource fileを検出するregressionを追加する。

Allowed write scope:

- `scripts/check-source-organization.mjs`
- source-organization guard test fixtures / focused tests
- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`

Forbidden:

- Broad refactor of existing large application/package files only to satisfy new guardrails
- E2E registry / dependency guard edits
- Product capability source changes
- external dependency / manifest / lockfile changes

### C. `wave42-focused-e2e-registry-replay-runner`

Purpose:

- Existing focused e2e smoke scriptsをregistry化し、一覧化、選択実行、必要なdirect verificationをしやすくする。
- Aggregate `pnpm test:e2e`を無条件に肥大化させない。

Allowed write scope:

- `scripts/**` for focused e2e registry / runner
- `apps/editor/e2e/**` registry metadata or narrow test-id references only if needed
- root/editor package scripts only if narrowly required and no new dependencies
- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`

Forbidden:

- Broad Editor UI/source implementation
- E2E assertion weakening
- Product capability implementation
- external dependency / manifest / lockfile changes
- parser/image/archive/filesystem/renderer/Cubism work

### D. `wave42-dependency-forbidden-scope-guard-refinement`

Purpose:

- `scripts/check-dependencies.mjs` と関連guardを、forbidden dependency / asset / non-goal claim containmentの観点で小さく強化する。
- Negative assertions、fixture false flags、non-goal documentationを誤検出しない分類補助を追加する。

Allowed write scope:

- `scripts/check-dependencies.mjs`
- focused dependency/forbidden-scope guard fixtures / tests
- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`

Forbidden:

- Source organization guard edits
- E2E runner edits
- package manifest / lockfile changes
- Product capability implementation
- parser/image/archive/filesystem/renderer/Cubism work

### E. `wave42-quality-gate-docs-traceability-refresh`

Purpose:

- Wave42で追加/更新したguardの使い方、対象、non-goal境界をdocs/traceabilityへ狭く同期する。
- Source organization policyとquality verification entry pointsを、実装済みguardに合わせて更新する。

Allowed write scope:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md` if directly required
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`

Forbidden:

- Broad design rewrite
- Product capability claims
- Source code edits
- Persisted/exported Product Preflight、release/demo gate、parser/archive/renderer/Cubism claims

### F. `wave42-integration-review-and-final-report`

Purpose:

- Domains A-Eを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave42/**`
- `discussion/implementation/reviews/wave42/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless guard registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave42起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Quality Gate Boundary: product capabilityを新規主張していないか。
- Source Organization: barrel-only `index.ts`、catch-all file、巨大source file guardが単一責務を壊していないか。
- E2E Registry Truthfulness: focused e2eの一覧化/選択実行が、実行していないcoverageを主張していないか。
- Dependency / Forbidden Scope: parser、image decode、archive/filesystem、renderer、Cubism、LLM、auto-fix等の非目標依存/claimを検出できるか。
- False Positive Containment: negative assertions、non-goal docs、fixture false flagsを誤検出しすぎないか。
- Non-Goals: Product Preflight persisted/exported artifact、release/demo gate、repo-side repair generation、auto-fix、external transport等に逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: guard tests / fixture tests / direct script runs がdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: registry/boundary focused tests or direct script checks
- Domain B: `node scripts/check-source-organization.mjs` plus focused guard fixture tests
- Domain C: focused e2e registry list/check command and at least one direct focused replay dry path if feasible
- Domain D: `node scripts/check-dependencies.mjs` plus focused forbidden dependency/scope fixture tests
- Domain E: docs/traceability registration checks
- Domain F: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- focused e2e registry/list command introduced by Wave42
- representative direct focused e2e smoke command if registry runner supports it
- `git diff --check -- scripts apps/editor/e2e apps/editor packages fixtures/contracts discussion/implementation discussion/development_convention discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for Product Preflight persisted/exported artifact claims、release/demo gate claims、repo-side repair generation / candidate ranking / LLM provider / natural-language repair / auto-fix / external transport / parser / image decode / archive/filesystem implementation / renderer / pixel oracle / Cubism compatibility claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Product capability implementationが必要になる。
- Product Preflight persisted/exported package artifact、release/demo acceptance gateが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Existing large filesを広くリファクタしないとguardが通らない。
- Aggregate e2e runtimeを大きく増やす必要がある。
- Parser/image decode、archive/filesystem implementation、renderer/pixel oracle、Cubism compatibility claimが必要になる。
- repo-side repair generation、LLM provider、natural-language repair、auto-fixが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。

現時点では、品質ゲート強化に限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave42は次を満たしたときpassとする。

- Focused e2e registry / replay surfaceが追加または整理され、focused smokeの一覧化と直接verificationがしやすい。
- Source organization guardがbarrel-only、catch-all、巨大化/単一責務逸脱のblind spotsを小さく検出できる。
- Dependency / forbidden-scope guardが、非目標依存や危険なclaimをより明確に検出できる。
- Guard testsまたはfixture-based regressionsで、positive/negative casesが確認されている。
- Documentation / traceabilityがWave42 quality gate surfaceを狭く記録している。
- No product capability claim、no Product Preflight persisted/exported artifact、no release/demo gate、no repo-side repair generation、no candidate ranking、no LLM provider、no natural-language repair、no auto-fix、no external transport、no parser/image decode、no archive/filesystem implementation、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
