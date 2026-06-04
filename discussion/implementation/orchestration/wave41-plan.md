# Wave 41 Plan: Product Preflight Read / Diff / Report Ergonomics v0

> Wave41で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave41
- Wave name: `product-preflight-read-diff-report-ergonomics-v0`
- Primary objective: Wave39のProduct Preflight v0とWave40のCodex proposal rerun validation surfaceを土台に、Product Preflight reportをCodexとEditorが読みやすく、比較しやすく、根拠へ辿りやすくする。Wave41ではdeterministic report diff、category/status transition summary、evidence/diagnostic navigation、rerun affordance、AI-readable read/diff command surface、Editor comparison workflow、fixtures/e2eを実装する。

## 2. 次Wave選定

Wave40でCodex-submitted proposalのvalidation、diff preview、rerun validation / Product Preflight、approval-gated commitが`implementation-proven`になった。

次に必要なのは、Codexとユーザーが「proposal前後でProduct Preflightがどう変わったか」を安定して読めるsurfaceである。

Wave41では **Product Preflight Read / Diff / Report Ergonomics v0** を選ぶ。

理由:

- 追加のユーザー判断なしで進められる。Product Preflight v0はsession-generated read-only reportのままにする。
- Wave39/40の成果を直接強化する。Codex proposal workflowが、validation結果だけでなくProduct Preflight reportの変化を読めるようになる。
- Archive/filesystem、real parser/decode、renderer/pixel oracle、public/demo gate、Cubism compatibilityより境界が明確で、現在のPrivate Prototype方針を変えない。
- 将来のProduct Preflight durability/exportやacceptance/demo gateへ進む前に、read/diff/reportのdeterministic semanticsを固められる。

## 3. Undineコンテキスト保護規約

Wave41でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave39 Product Preflight v0は、required categories、statuses、evidence refs、diagnostic refs、blocking reasons、recommended actions、unsupported claims、not-evaluated claimsを持つsession-generated read-only reportとして実装済み。
- Wave40 Codex proposal surfaceは、proposal validation、dry-run diff preview、preview/post-commit rerun validation / Product Preflight bridge、approval lifecycle、transcript/evidence recording、Editor proposal review workflowを持つ。
- `packages/ai-interface`はdeterministic read/inspect/validate/dry-run/commit/log/transcriptとCodex proposal operation catalog / validation / approval lifecycleを持つ。
- 現時点では、Product Preflight report同士のstandalone deterministic diff、category/status transition summary、AI-readable preflight diff command、Editor上のbefore/after comparison workflowは未実装である。
- Product Preflight v0はまだsession-generatedであり、persisted package artifact、exported report、release/demo acceptance gateではない。

## 5. Design Decisions

- Wave41はProduct Preflight reportのread/diff/report ergonomicsに限定する。
- Product Preflight v0はsession-generated read-only reportのまま扱う。persisted/exported package artifactにはしない。
- Report diffはdeterministicな構造化比較として実装する。自然言語要約、AI判断、repair recommendation生成はrepo側で実行しない。
- Diffはcategory/status transition、blocking reason change、diagnostic/evidence refsのadded/removed/changed、recommended action change、unsupported/not-evaluated claim changeを扱う。
- Evidence navigationは既存evidence/diagnostic refsを辿りやすくするUI/command surfaceに限定する。ファイルシステムや外部ビューアを開かない。
- Rerun affordanceは既存Product Preflight rerun / proposal rerun validation surfaceを見やすく接続する。自動修復や自動commitは行わない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Product Preflight persisted artifact、exported report file、release acceptance runner、demo gate。
- repo-side repair candidate generation、candidate ranking、repair reasoning。
- LLM provider integration、prompt template、natural-language repair。
- Autonomous repair、auto-fix、automatic commit、batch auto-apply。
- External HTTP / WebSocket / MCP transport、外部caller adapter。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementation。
- Real PSD/PNG parser、image decode、raster extraction、texture materialization。
- Full renderer、standalone viewer、pixel oracle、texture sampling correctness assertion。
- Cubism SDK/Core互換、Cubism形式import/export。
- Public tutorial/demo asset distribution。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave41-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave39/wave39-final-report.md`
- `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
- `discussion/implementation/waves/wave40/wave40-final-report.md`
- `discussion/implementation/reviews/wave40/wave40-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave41はProduct Preflight diff contractを先に固定し、その後validator diff engineとAI/editor-session command bridgeを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Product Preflight diff contract foundation | Solo first | Wave40 complete | report diff、category transition、evidence/diagnostic ref change、rerun affordance response shapeを固定する |
| 2 | B. Validator report diff and evidence navigation engine | Parallel with C | A | Product Preflight report同士をdeterministicに比較し、status/category/evidence/diagnostic/recommended-action changeを返す |
| 2 | C. AI / editor-session preflight read-diff command bridge | Parallel with B | A | Codex-facing commandとEditor session bridgeでpreflight read/diff/rerun affordanceを提供する |
| 3 | D. Editor Product Preflight comparison workflow | Parallel with E | B + C | Editorでcurrent/previous/proposal-preview report、diff summary、evidence navigation、rerun affordanceを読めるようにする |
| 3 | E. Product Preflight diff fixtures and focused coverage | Parallel with D | B + C | rights-clean fixtures、focused unit tests、fixture/traceability registrationでdiff semanticsを固定する |
| 4 | F. Product Preflight diff e2e smoke | Solo after D/E | D + E | desktop/mobileでrun -> change/proposal preview -> rerun -> report diff -> evidence navigationを確認する |
| 5 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはvalidator/report diff engineに限定し、AI commandやEditor UIを実装しない。
- CはAI/editor-session bridgeに限定し、validator diff engineやEditor UIを再設計しない。
- DはEditor workflow/UIに限定し、diff engineやAI contractを再設計しない。
- Eはfixtures/tests/traceabilityに限定する。source defectを発見した場合は勝手に広げず差し戻す。
- Fはe2eに限定する。UI test-idやminor wiring以外のsource fixが必要な場合は差し戻す。
- Gはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave41-product-preflight-diff-contract-foundation`

Purpose:

- Product Preflight report diff contractを固定する。
- Category/status transition、blocking reason change、diagnostic/evidence ref change、recommended action change、unsupported/not-evaluated claim change、rerun affordance response shapeを定義する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/validator-core/src/**` narrow type adapters only if directly required
- focused contracts / validator tests
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- Editor UI implementation
- AI command implementation
- persisted/exported Product Preflight artifact
- release/demo acceptance gate
- repo-side repair/candidate generation
- LLM/provider/prompt/natural-language repair
- auto-fix / automatic commit
- archive/filesystem/parser/image/renderer/Cubism work
- external dependency / manifest / lockfile changes
- `index.ts` implementation logic

### B. `wave41-validator-report-diff-evidence-navigation-engine`

Purpose:

- Product Preflight report同士をdeterministicに比較する。
- Category/status transition、blocking reason、diagnostic/evidence refs、recommended actions、unsupported/not-evaluated claimsの差分を返す。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- AI command implementation
- Editor UI implementation
- persisted/exported report artifact
- release/demo gate
- repo-side repair/candidate generation
- LLM/natural-language repair
- external dependency / manifest / lockfile changes
- parser/image/archive/renderer/Cubism work

### C. `wave41-ai-editor-session-preflight-read-diff-bridge`

Purpose:

- Codex-facing deterministic command surfaceとしてProduct Preflight read/diff/rerun affordanceを提供する。
- Editor sessionからcurrent report、previous report、proposal-preview rerun resultを比較できるbridgeを作る。

Allowed write scope:

- `packages/ai-interface/src/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**` narrow bridge only if required
- focused ai-interface / editor-session tests
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- Editor broad UI implementation
- validator diff engine redesign
- external transport adapter
- repo-side proposal generation / repair generation
- LLM/provider/prompt/natural-language repair
- auto-fix / automatic commit
- persisted/exported report artifact
- archive/filesystem/parser/image/renderer/Cubism work

### D. `wave41-editor-product-preflight-comparison-workflow`

Purpose:

- Editor上でProduct Preflightのcurrent/previous/proposal-preview report、diff summary、category transitions、evidence/diagnostic refs、rerun affordanceを読めるようにする。
- UI文言は「deterministic report comparison」であり、repo側AIが判断・修復・候補生成していると誤解させない。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**` narrow wiring only if required
- `apps/editor/src/editor-workflow/**` narrow UI-state wiring only if required
- focused editor tests
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- validator diff engine redesign
- AI command redesign
- auto-fix / automatic commit
- LLM-like UI claims、natural-language repair claims
- persisted/exported report artifact UI claims
- release/demo acceptance gate claims
- parser/image/archive/filesystem/renderer/Cubism UI claims
- external dependency / manifest / lockfile changes

### E. `wave41-product-preflight-diff-fixtures-focused-coverage`

Purpose:

- Rights-clean fixturesとfocused testsで、no-change、improvement、regression、unsupported/not-evaluated change、evidence/diagnostic ref changeを固定する。
- Fixture manifest / traceability matrixへWave41 coverageを狭く登録する。

Allowed write scope:

- `fixtures/contracts/**`
- focused tests under affected packages
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- Broad source implementation in `apps/**` or `packages/**`
- E2E assertion weakening
- Real asset / parser / image decode fixtures
- external dependency / manifest / lockfile changes
- repo-side repair/candidate generation

### F. `wave41-product-preflight-diff-e2e-smoke`

Purpose:

- Desktop/mobile e2eで、Product Preflight run -> project/proposal preview change -> rerun -> report diff -> evidence navigation -> approval-safe non-auto behaviorを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI test-id/wiring only if needed
- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`

Forbidden:

- Broad package implementation
- E2E assertion weakening
- auto-fix / automatic commit
- repo-side repair/candidate generation
- parser/image/archive/filesystem/renderer/Cubism work
- external dependency / manifest / lockfile changes

### G. `wave41-integration-review-and-final-report`

Purpose:

- Domains A-Fを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave41/**`
- `discussion/implementation/reviews/wave41/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad test documentation rewrite unless fixture/traceability registration is explicitly needed and narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave41起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain D / EのOrch-Sylphを並列投入する。
4. Domain D / Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
5. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
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

- Product Preflight Boundary: reportはsession-generated read-onlyのままで、persisted/exported artifactやrelease/demo gateを主張していないか。
- Diff Truthfulness: unsupported / not-evaluated / manual-required casesを偽の改善やrepair actionにしていないか。
- AI Boundary: repo/tool側がrepair generation、candidate ranking、LLM、natural-language repair、auto-fixを主張していないか。
- Evidence Navigation: evidence/diagnostic refsがdeterministicで、stale reportや存在しないrefに依存していないか。
- Approval Safety: proposal workflowと接続する場合もautomatic commitが発生しないか。
- UI / Accessibility: desktop/mobileでreport diff、category transitions、evidence refs、rerun affordanceが読めるか。
- Non-Goals: parser、image decode、archive/filesystem、renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / validator schema focused tests、typecheck
- Domain B: validator-core Product Preflight diff focused tests
- Domain C: ai-interface / editor-session command bridge focused tests
- Domain D: editor-state / UI / app focused tests
- Domain E: fixture regressions、traceability / fixture manifest registration check
- Domain F: focused e2e Product Preflight diff smoke on desktop/mobile
- Domain G: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for persisted/exported Product Preflight artifact claims、release/demo gate claims、repo-side repair generation / candidate ranking / LLM provider / natural-language repair / auto-fix / external transport / parser / image decode / archive/filesystem implementation / renderer / pixel oracle / Cubism compatibility claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Product Preflight persisted/exported package artifactが必要になる。
- Release/demo acceptance gateやpublic demo policyが必要になる。
- repo-side repair candidate generation、candidate ranking、repair reasoningが必要になる。
- LLM provider、prompt template、natural-language repairが必要になる。
- Auto-fix、automatic commit、approval bypassが必要になる。
- External HTTP/WebSocket/MCP transportや外部caller adapterが必要になる。
- Parser/image decode、archive/filesystem implementation、renderer/pixel oracle、Cubism compatibility claimが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、Product Preflightをsession-generated read-only reportのまま比較・参照・再実行しやすくする範囲に限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave41は次を満たしたときpassとする。

- Product Preflight report diff contractが定義されている。
- Product Preflight report同士をdeterministicに比較し、category/status transition、blocking reason、diagnostic/evidence refs、recommended actions、unsupported/not-evaluated claimsの変化を読める。
- Codex-facing command surfaceからProduct Preflight read/diff/rerun affordanceを取得できる。
- Editor上でcurrent/previous/proposal-preview report、diff summary、evidence navigation、rerun affordanceを確認できる。
- Rights-clean fixturesとfocused testsでno-change、improvement、regression、unsupported/not-evaluated change、evidence/diagnostic ref changeを確認できる。
- Desktop/mobile e2eでProduct Preflight diff workflowを確認できる。
- Product Preflight v0はsession-generated read-only reportのままで、persisted/exported artifact、release/demo gate、repair system、AI judgment surfaceにはなっていない。
- No repo-side repair generation、no candidate ranking、no LLM provider、no natural-language repair、no auto-fix、no external transport、no parser/image decode、no archive/filesystem implementation、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
