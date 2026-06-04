# Wave 40 Plan: Codex-facing Rigging Edit Proposal API / Diff Validation Surface v0

> Wave40で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave40
- Wave name: `codex-facing-rigging-edit-proposal-api-diff-validation-surface-v0`
- Primary objective: Codexが推論して作成した2D rigging編集proposalをrepo/tool側が安全に受け取り、schema validation、operation catalog照合、dry-run、standalone diff、rerun validation / Product Preflight、approval-gated commit、transcript/evidence記録までを提供する。Wave40ではrepo側のrepair candidate generation / ranking、LLM provider、prompt template、natural-language repair、auto-fix / automatic commit、external transport、parser/image decode、archive/filesystem implementation、full renderer、pixel oracle、Cubism compatibilityには踏み込まない。

## 2. 次Wave選定

Wave39でMVP-wide Product Preflight Reportが`implementation-proven`になった。これにより、Codexは現在状態、preflight、validator evidenceを読み、2D rigging編集方針を推論する足場を得た。

ただし、現在のrepo/tool側にはまだ、Codexが作った編集proposalを安全に検証・差分化・承認・記録するためのまとまったAPI surfaceがない。

Wave40では **Codex-facing Rigging Edit Proposal API / Diff Validation Surface v0** を選ぶ。

理由:

- 最新の責務境界に合っている。AI推論と修復案生成はCodex側の責務であり、repo/tool側はdeterministic API surfaceを提供する。
- 既存のAI read / validate / dry-run / approval / transcript foundationを活かせる。
- Product Preflight v0を「Codexが読む状態」として使い、repo側はproposalの安全性、差分、validation結果、承認の根拠を返せる。
- Archive/filesystem、real parser/decode、renderer/pixel、public demo、Cubism compatibilityより追加判断が少なく、現在のPrivate Prototype方針を変えずに進められる。

## 3. Undineコンテキスト保護規約

Wave40でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave8でAI dry-run command foundation、Wave9でapproval UI / transcript persistence、Wave10でAI read / inspection / validation command foundationは`implementation-proven`になっている。
- Wave39でProduct Preflight Report contract、validator aggregation、package/runtime evidence bridge、AI observation helper/schema、Editor Product Preflight workflow/UI、desktop/mobile e2eは`implementation-proven`になっている。
- `packages/ai-interface`はdeterministic read/inspect/validate/dry-run/commit/log/transcript surfaceを持つ。
- 現時点では、Codex-submitted rigging edit proposalのまとまったintake API、proposal schema validation、operation catalog照合、standalone diff、rerun validation command surfaceは未実装である。
- AI推論、修復案生成、candidate ranking、natural-language judgmentはCodex側の責務である。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave40はCodex-facingなproposal intake / validation / diff / approval surfaceに限定する。
- repo/tool側はrepair candidateを生成しない。Codexが作成したproposalを入力として扱う。
- Proposalはoperation sequence、対象ID、期待するpreflight/validation context、ユーザー承認に必要な説明用metadataを持てる。ただし自然言語推論そのものはrepo側で実行しない。
- Operation catalogは、Codexが利用可能なoperation、required inputs、unsupported boundaries、approval requirementをdeterministicに読めるようにする。
- Dry-run / diff / rerun validationはcommitしないpreview pathとして提供する。
- Commitは既存approval lifecycleを通す。Wave40ではauto-commitしない。
- Transcript / evidenceには、proposal receipt、validation result、diff result、approval decision、commit resultを記録する。
- UIはCodex proposalを確認するsurfaceに限定する。repo側が「AIが候補を生成した」と主張するUI文言は使わない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- repo-side repair candidate generation、candidate ranking、repair reasoning。
- LLM provider integration、prompt template、natural-language repair。
- Autonomous repair、auto-fix、automatic commit、batch auto-apply。
- External HTTP / WebSocket / MCP transport、外部caller adapter。
- Arbitrary model rewriting、unsupported operationの無理な変換。
- Real PSD parser、PNG/image decode、raster extraction、Photoshop-compatible compositing。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementation。
- Full renderer、standalone viewer、pixel oracle、texture sampling correctness assertion。
- Cubism SDK/Core互換、Cubism形式import/export。
- Public tutorial asset distribution、demo capture scene、final disclaimer。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave40-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave39/wave39-final-report.md`
- `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
- `discussion/implementation/waves/wave8/wave8-final-report.md`
- `discussion/implementation/waves/wave9/wave9-final-report.md`
- `discussion/implementation/waves/wave10/wave10-final-report.md`
- `discussion/implementation/reports/current-capability-backlog-rewrite-summary-2026-06-04.md`

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

Wave40はCodex proposal API contractを先に固定し、その後operation catalog / proposal validationとdry-run diff / rerun validation bridgeを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Codex proposal API contract foundation | Solo first | Wave39 complete | Codex-submitted proposal、operation catalog response、proposal validation、diff preview、rerun validation、approval/evidence response shapeを固定する |
| 2 | B. Operation catalog and proposal intake validation | Parallel with C | A | Codexが利用可能なoperation catalogを読み、Codex-submitted proposalをschema/catalog/preflight contextに照らして検証する |
| 2 | C. Dry-run diff and rerun validation bridge | Parallel with B | A | Proposal previewとしてdry-run、standalone diff、rerun validation / Product Preflightを返す |
| 3 | D. Approval-gated commit and transcript evidence bridge | Parallel with F | B + C | Validated proposalを既存approval lifecycleへ接続し、proposal/diff/validation/decision/commit evidenceをtranscriptへ残す |
| 3 | F. Proposal fixtures and focused coverage | Parallel with D | B + C | rights-clean fixturesとfocused testsでvalid proposal、invalid proposal、unsupported operation、diff/rerun validation statesを固定する |
| 4 | E. Editor proposal review workflow | Solo after D | D | Editor上でCodex proposal、validation result、diff preview、rerun validation、approval-safe commit pathを確認できるようにする |
| 5 | G. Proposal API / diff validation e2e smoke | Solo after E/F | E + F | desktop/mobile e2eでproposal intake -> validation -> diff -> rerun validation -> approval-safe behaviorを確認する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはoperation catalog / proposal intake validationに限定し、dry-run diffやEditor UIを実装しない。
- Cはpreview diff / rerun validation bridgeに限定し、proposal generationやUIを実装しない。
- Dはapproval / transcript evidence bridgeに限定し、UIやcandidate policyを実装しない。
- EはEditor workflow / UI / app wiringに限定し、proposal validationやdiff engineを再設計しない。
- Fはfixtures / focused tests / traceabilityに限定する。B/C/D/Eのsource defectを発見した場合は勝手に広げず差し戻す。
- Gはe2eに限定する。UI test-idやminor wiring以外のsource fixが必要な場合は差し戻す。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave40-codex-proposal-api-contract-foundation`

Purpose:

- Codex-facing rigging edit proposal APIのcontractを固定する。
- Proposal DTO、operation catalog DTO、proposal validation result、dry-run diff preview result、rerun validation / Product Preflight result、approval/evidence response shapeを定義する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/ai-interface/src/**`
- focused contracts / ai-interface tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- Editor UI implementation
- repo-side proposal/candidate generation implementation
- Diff/rerun execution implementation
- LLM provider / prompt / natural-language repair
- External HTTP/WebSocket/MCP transport
- Parser / image decode / archive / renderer / Cubism work
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Contract is additive, Codex-facing, provider-free, approval-gated, and truthful.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave40-operation-catalog-proposal-validation`

Purpose:

- Codexが利用可能なoperation catalogをdeterministicに読めるようにする。
- Codex-submitted proposalをschema、catalog、target refs、preflight context、unsupported boundariesに照らして検証する。
- Unsupported / not-evaluated / user-decision-requiredな領域を、偽のrepair actionに変換せずtruthfulに返す。

Allowed write scope:

- `packages/ai-interface/src/**`
- focused ai-interface tests
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- repo-side proposal/candidate generation
- Diff/rerun validation implementation
- Editor UI implementation
- Validator aggregation redesign
- LLM provider / prompt / natural-language repair
- Auto-fix / automatic commit
- External transport
- Parser / image decode / archive / renderer / Cubism work
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Operation catalog output is stable and useful to Codex.
- Invalid / unsupported proposal is rejected or marked non-committable deterministically.
- No candidate generation or ranking is implemented.

### C. `wave40-dry-run-diff-rerun-validation-bridge`

Purpose:

- Validated proposalをcommitせずpreviewし、dry-run evidence、standalone diff、rerun validation / Product Preflight resultを返す。
- Preview stateとcommitted stateを混同しない。

Allowed write scope:

- `packages/operation-core/src/**`
- `packages/authoring-core/src/**`
- `packages/package-format/src/**`
- `packages/validator-core/src/**`
- focused operation / authoring / package-format / validator tests
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- repo-side proposal/candidate generation
- Editor UI implementation
- Auto-commit / approval bypass
- LLM provider / natural-language repair
- External transport
- Parser / image decode / archive / renderer / Cubism work
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Preview diff is deterministic and does not mutate committed state.
- Rerun validation / Product Preflight result is tied to preview state or explicit post-commit state, not stale evidence.

### D. `wave40-approval-transcript-evidence-bridge`

Purpose:

- Validated proposal previewを既存approval lifecycleへ接続する。
- Proposal receipt、validation result、diff result、rerun validation result、approval decision、commit resultをtranscript/evidence refsへ残す。

Allowed write scope:

- `packages/ai-interface/src/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**` narrow wiring only if required
- focused ai-interface / editor-session tests
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- Editor broad UI implementation
- repo-side proposal/candidate generation
- Auto-fix / automatic commit / approval bypass
- LLM-like UI claims、natural-language repair claims
- Parser / image decode / archive/filesystem / renderer / pixel / Cubism claims
- External dependency / manifest / lockfile changes

Pass evidence:

- Commit cannot happen without approval.
- Transcript/evidence records proposal validation, diff/rerun validation, approval decision, and commit result.

### E. `wave40-editor-proposal-review-workflow`

Purpose:

- Editor上でCodex proposal、proposal validation result、diff preview、rerun validation / Product Preflight、approval-safe commit pathを確認できるようにする。
- UIはCodexが作成したproposalの確認surfaceであり、repo側AIが候補を生成したと誤解させない。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**` narrow wiring only if required
- `apps/editor/src/editor-workflow/**` narrow UI-state wiring only if required
- focused editor tests
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- Proposal validation / diff engine redesign
- repo-side proposal/candidate generation
- Auto-fix / automatic commit
- LLM-like UI claims、natural-language repair claims
- Parser / image decode / archive/filesystem / renderer / pixel / Cubism UI claims
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobileでproposal、validation result、diff preview、rerun validation、approval-safe behaviorを読める。
- UI text does not imply LLM, natural-language repair, repo-side candidate generation, auto-fix, parser, renderer, archive/filesystem, or Cubism support.

### F. `wave40-proposal-fixtures-focused-coverage`

Purpose:

- Rights-clean fixturesとfocused testsで、valid proposal、invalid proposal、unsupported proposal、diff preview、rerun validationを固定する。
- Fixture manifest / traceability matrixへWave40 coverageを狭く登録する。

Allowed write scope:

- `fixtures/contracts/**`
- focused tests under affected packages
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- Broad source implementation in `apps/**` or `packages/**`
- E2E assertion weakening
- Real asset / parser / image decode fixtures
- External dependency / manifest / lockfile changes

Pass evidence:

- Representative proposal / diff / validation fixtures are deterministic and rights-clean.
- Traceability records Wave40 as Codex-facing proposal API / diff validation coverage, not LLM, repo-side repair generation, or auto-fix completion.

### G. `wave40-proposal-api-diff-validation-e2e-smoke`

Purpose:

- Desktop/mobile e2eで、Codex proposal intake -> validation -> diff preview -> rerun validation / Product Preflight -> approval-safe behaviorを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI test-id/wiring only if needed
- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`

Forbidden:

- Broad package implementation
- E2E assertion weakening
- Auto-fix / automatic commit without approval
- repo-side proposal/candidate generation
- Parser / image decode / archive/filesystem / renderer / pixel / Cubism work
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke proves Codex-facing proposal API / diff validation workflow can be run and read.
- Approval lifecycle is respected and no automatic commit occurs.

### H. `wave40-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave40/**`
- `discussion/implementation/reviews/wave40/**`
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
- Clean integration reviewがcontract、operation catalog/proposal validation、dry-run diff/rerun validation、approval/transcript bridge、Editor workflow、fixtures/e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no repo-side repair generation, no LLM provider, no natural-language repair, no auto-fix, no external transport, no parser, no renderer, no archive/filesystem implementation.

## 10. Subagent / Orch-Sylph Execution Policy

Wave40起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain D / FのOrch-Sylphを並列投入する。
4. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
5. Domain E / Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
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

- AI Boundary: repo/tool側がproposal生成、candidate ranking、LLM、natural-language repair、auto-fixを主張していないか。
- Proposal Intake Truthfulness: unsupported / manual / not-evaluated casesを偽のrepair actionにしていないか。
- Approval Safety: commitが既存approval lifecycleを必ず通るか。
- Diff / Validation Evidence: preview diffとrerun validationがdeterministicでstale evidenceに依存していないか。
- Transcript Evidence: proposal、validation、diff、approval、commitの証跡がAI-readableか。
- UI / Accessibility: desktop/mobileでproposal、diff、validation resultが読めるか。
- Non-Goals: parser、image decode、archive/filesystem、renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / ai-interface schema focused tests、typecheck
- Domain B: ai-interface operation catalog / proposal validation focused tests
- Domain C: operation / authoring / package-format / validator focused tests
- Domain D: ai-interface / editor-session transcript and approval focused tests
- Domain E: editor-state / UI / app focused tests
- Domain F: fixture regressions、traceability / fixture manifest registration check
- Domain G: focused e2e proposal API / diff validation smoke on desktop/mobile
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for repo-side repair generation / candidate ranking / LLM provider / natural-language repair / auto-fix / external transport / parser / image decode / archive/filesystem implementation / renderer / pixel oracle / Cubism compatibility claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- repo-side repair candidate generation、candidate ranking、repair reasoningが必要になる。
- LLM provider、prompt template、natural-language repairが必要になる。
- Auto-fix、automatic commit、approval bypassが必要になる。
- External HTTP/WebSocket/MCP transportや外部caller adapterが必要になる。
- Parser/image decode、archive/filesystem implementation、renderer/pixel oracle、Cubism compatibility claimが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、Codex-proposed operationをrepo/tool側がdeterministicに検証・diff化・validation rerun・approval-gated commit・evidence記録する範囲に限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave40は次を満たしたときpassとする。

- Codex-facing rigging edit proposal API contractが定義されている。
- Codexが利用できるoperation catalogをdeterministicに読める。
- Codex-submitted proposalをschema、catalog、target refs、preflight context、unsupported boundariesに照らして検証できる。
- Proposal previewでdry-run、standalone diff、rerun validation / Product Preflightを確認できる。
- Commitは既存approval lifecycleを通り、automatic commitは発生しない。
- Transcript/evidenceにproposal receipt、validation、diff、approval、commit resultが残る。
- Editor上でproposal、validation result、diff preview、rerun validation、approval-safe behaviorを確認できる。
- Rights-clean fixturesとfocused testsでvalid / invalid / unsupported proposal、diff、rerun validation statesを確認できる。
- Desktop/mobile e2eでproposal intake -> validation -> diff -> rerun validation -> approval-safe behaviorを確認できる。
- No repo-side repair generation、no candidate ranking、no LLM provider、no natural-language repair、no auto-fix、no external transport、no parser/image decode、no archive/filesystem implementation、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
