# Wave 39 Plan: MVP-wide Validator Product Report / Preflight v0

> Wave39で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave39
- Wave name: `mvp-validator-product-preflight-report-v0`
- Primary objective: 既存のpackage / runtime / viewer / validator / editor evidenceを横断し、MVP-wideなproduct preflight reportとして読める形に束ねる。Wave39ではrepair candidate generation、LLM provider、natural-language repair、real PSD/PNG parser、image decode、full renderer、pixel oracle、archive/filesystem implementationには踏み込まない。

## 2. 次Wave選定

Wave37でarchive / filesystem transport decision boundaryは閉じ、Wave38でbounded mesh topology / UV editor expansionも閉じた。ただし、次の候補にはそれぞれ判断ゲートがある。

- ZIP/archive、File System Access API、drag-drop、cloud/cross-profile persistenceはdependency / browser API / UX / security判断が必要である。
- Advanced topology、automatic triangulation、atlas packingはalgorithm / UX / test oracle判断が必要である。
- Public tutorial / demo assetはrights-clean policyとpublic/private split判断が必要である。
- AI repair / diff workflowは有力だが、先に横断preflight reportが安定している方がrepair候補やrerun validationの根拠を作りやすい。

Wave39では **MVP-wide Validator Product Report / Preflight v0** を選ぶ。

理由:

- 追加ユーザー判断や外部依存承認なしに、自律的に進められる。
- Wave30以降、tutorial readiness、byte availability、persistent storage、portable bundle、transport capability、topology / UV diagnosticsなどのtargeted diagnosticsが増えたが、製品として横断して読む入口がまだ弱い。
- Public demo、AI repair、final acceptance runnerへ進む前に、何がpass / warn / fail / not_supported / not_evaluatedかをAI-readableかつuser-visibleに整理できる。
- 既存実装を束ねる支援waveであり、real asset parserやrendererなどの大きな設計判断を先送りできる。

## 3. Undineコンテキスト保護規約

Wave39でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave10でAI read / inspection / validation command foundationはimplementation-provenになっている。
- Wave24でeditor-internal Viewer / Runtime inspection surfaceはimplementation-provenになっている。
- Wave27 / Wave28 / Wave29 / Wave32 / Wave33 / Wave38で、composition、part / layer / texture、mesh、rig-control、topology / UVのsemantic evidenceとvalidator diagnosticsが段階的に実装されている。
- Wave30でrights-clean synthetic tutorial mini modelとtutorial readiness profile / preflight diagnosticsはimplementation-provenになっている。
- Wave31 / Wave34 / Wave35 / Wave36 / Wave37で、byte intake、byte availability、persistent byte storage、portable JSON bundle、transport capability diagnosticsがimplementation-provenになっている。
- 現時点では、MVP全域を単一の製品preflight reportとして横断するfinal acceptance runner / product reportは未実装である。
- AI assistantはread / validate / dry-run / approval / transcriptまではあるが、repair candidate generation、standalone diff、rerun validation product workflowは未実装である。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave39は、既存validator / evidenceを横断してproduct preflight reportへ集約する。
- ReportはAI-readableかつEditor UIで読める形にする。
- Report categoryは最小でも、model structure、authoring workflow evidence、runtime/viewer evidence、mesh topology / UV、composition、rig-control / dynamics、asset bytes、persistence / transport、tutorial / demo readiness、unsupported claimsを区別する。
- Status vocabularyは`pass` / `warn` / `fail` / `not_supported` / `not_evaluated`のようなtruthfulな分類を持つ。実装時に既存schemaとの整合で名前は調整してよい。
- Existing targeted diagnosticsを捨てず、preflight reportはdiagnostic refs / evidence refs / blocking reason / recommended next actionを持つ集約層にする。
- Wave39ではrepair候補の自動生成や自動適用は扱わない。AI repair / diff workflowは、preflight reportを足場に次wave以降で扱う。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- LLM provider integration、prompt template、natural-language repair。
- Repair candidate generation、repair ranking、auto-fix、automatic commit。
- Standalone model diff product workflow、repair後rerun validation product workflow。
- Real PSD parser、PNG/image decode、raster extraction、Photoshop-compatible compositing。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementation。
- Full renderer、standalone viewer、pixel oracle、texture sampling correctness assertion。
- Cubism SDK/Core互換、Cubism形式import/export。
- Public tutorial asset distribution、demo capture scene、final disclaimer。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave39-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave30/wave30-final-report.md`
- `discussion/implementation/waves/wave37/wave37-final-report.md`
- `discussion/implementation/waves/wave38/wave38-final-report.md`

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

Wave39はpreflight report contractを先に固定し、その後validator aggregationとruntime/package/AI bridgeを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Preflight report contract foundation | Solo first | Wave38 complete | product preflight report category / status / evidence refs / diagnostic refsを固定する |
| 2 | B. Validator product report aggregation | Parallel with C | A | 既存diagnosticsをMVP-wide reportへ集約し、blocking / warning / not-supportedをdeterministicに分類する |
| 2 | C. Runtime / package / AI evidence bridge | Parallel with B | A | package identity、runtime/viewer evidence、transport/byte availability、AI inspection surfaceからpreflightを読める接続を作る |
| 3 | D. Editor preflight workflow | Parallel with E after B/C | B + C | Editor上でproduct preflight reportを実行・表示・保存後再観測できるようにする |
| 3 | E. Preflight fixtures and focused coverage | Parallel with D after B/C | B + C | rights-clean fixtures、contract/unit tests、traceability registrationでreport behaviorを固定する |
| 4 | F. Preflight e2e smoke | Solo after D/E | D + E | desktop/mobile e2eでpreflight report -> save/load ->再観測を確認する |
| 5 | G. Integration review and final report | Solo after F | F | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはvalidator-core中心に限定し、Editor UIやAI command hostを実装しない。
- Cはruntime / package / AI interfaceの橋渡しに限定し、validator aggregationやEditor UIを実装しない。
- DはEditor workflow / UI / state projectionに限定し、validator category設計を変更しない。
- Eはfixtures / focused tests / traceabilityに限定する。B/C/Dのsource defectを発見した場合は勝手に広げず差し戻す。
- Fはe2eに限定する。UI test-idやminor wiring以外のsource fixが必要な場合は差し戻す。
- Gはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave39-preflight-report-contract-foundation`

Purpose:

- MVP-wide product preflight reportのcontractを固定する。
- Category、status、severity、diagnostic refs、evidence refs、blocking reasons、unsupported / not-evaluated claimsを定義する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/validator-core/src/**` narrow schema/test integration if required
- focused contracts / validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Editor UI implementation
- AI command host implementation
- Validator broad aggregation beyond contract hook
- Real parser / image decode / renderer / archive implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Report contract is additive and truthful.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave39-validator-product-report-aggregation`

Purpose:

- Existing validator diagnosticsをMVP-wide product preflight reportへ集約する。
- Existing targeted diagnosticsを保持しつつ、category status、blocking issue、warning、not-supported capability、not-evaluated evidenceをAI-readableに返す。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Editor UI implementation
- AI command host implementation
- Runtime/package broad implementation
- Real parser / image decode / renderer / pixel oracle validation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid MVP-like package produces deterministic preflight status categories.
- Known unsupported claims remain explicitly not-supported or fail, not silently pass.
- Existing targeted diagnostic behavior is not weakened.

### C. `wave39-runtime-package-ai-evidence-bridge`

Purpose:

- Package identity / revision、runtime / viewer evidence、asset byte availability、transport capability、AI inspection resultからpreflight reportを一貫して読めるようにする。
- AI assistantからpreflight resultを観測できる入口を、existing read / validate command foundationに沿って追加または拡張する。

Allowed write scope:

- `packages/package-format/src/**`
- `packages/runtime-core/src/**`
- `packages/ai-interface/src/**`
- focused package-format / runtime / ai-interface tests
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Validator aggregation implementation
- Editor UI implementation
- Repair candidate generation / repair ranking / auto-fix
- External HTTP/WebSocket/MCP transport
- Real parser / image decode / renderer / archive implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- AI-facing preflight observation is deterministic and transcript-compatible.
- Runtime/viewer/package evidence refs are preserved without claiming renderer or pixel correctness.

### D. `wave39-editor-preflight-workflow`

Purpose:

- Editor上でproduct preflight reportを実行・表示できるworkflowを追加する。
- Category summary、blocking issues、warnings、not-supported / not-evaluated sectionsをtruthfulに表示する。
- Save/load後にpreflightを再実行して同じ意味のreportを観測できるようにする。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**` narrow wiring only if required
- focused editor tests
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Validator category redesign
- AI repair / auto-fix UI
- Renderer / pixel / image decode UI claims
- File System Access API / drag-drop / ZIP/archive implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobileでpreflight reportが読める。
- UI text does not imply repair, renderer, image decode, archive/filesystem, or Cubism support.

### E. `wave39-preflight-fixtures-focused-coverage`

Purpose:

- Rights-clean fixturesとfocused testsで、pass / warn / fail / not_supported / not_evaluatedの代表ケースを固定する。
- Fixture manifest / traceability matrixへWave39 coverageを狭く登録する。

Allowed write scope:

- `fixtures/contracts/**`
- focused tests under affected packages
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Broad source implementation in `apps/**` or `packages/**`
- E2E assertion weakening to hide report failure
- Real asset / parser / image decode fixtures
- External dependency / manifest / lockfile changes

Pass evidence:

- Representative preflight report fixtures are deterministic.
- Traceability records Wave39 as product report / preflight coverage, not renderer/parser/demo completion.

### F. `wave39-preflight-e2e-smoke`

Purpose:

- Desktop/mobile e2eで、Editor preflight report実行、category observation、blocking/warning truthfulness、browser-local save/load後の再観測を確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI test-id/wiring only if needed
- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`

Forbidden:

- Broad package implementation
- E2E assertion weakening
- Real parser / image decode / renderer / archive implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke proves preflight report can be run and read.
- Save/load after preflight preserves enough project state to rerun report truthfully.

### G. `wave39-integration-review-and-final-report`

Purpose:

- Domains A-Fを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave39/**`
- `discussion/implementation/reviews/wave39/**`
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
- Clean integration reviewがcontract、validator aggregation、runtime/package/AI bridge、Editor workflow、fixtures/e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no AI repair, no LLM provider, no parser, no renderer, no archive/filesystem implementation.

## 10. Subagent / Orch-Sylph Execution Policy

Wave39起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Report Truthfulness: supported / unsupported / not-evaluated / failを誇張せず分類しているか。
- Validator Integrity: existing targeted diagnosticsを弱めていないか。
- Evidence Linking: diagnostic refs、runtime/viewer refs、package refs、AI transcript refsがAI-readableか。
- UI / Accessibility: desktop/mobileでpreflight reportが読みやすく、text overflowがないか。
- Non-Goals: AI repair、LLM provider、parser、image decode、archive/filesystem、renderer、pixel oracle、Cubism互換に逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / validator schema focused tests、typecheck
- Domain B: validator focused tests、diagnostic/category stability tests
- Domain C: package-format / runtime-core / ai-interface focused tests
- Domain D: editor-session / editor-workflow / editor-state / UI focused tests
- Domain E: fixture regressions、traceability / fixture manifest registration check
- Domain F: focused e2e preflight smoke on desktop/mobile
- Domain G: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for AI repair / LLM provider / parser / image decode / archive/filesystem implementation / renderer / pixel oracle / Cubism compatibility claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- LLM provider、prompt template、natural-language repairが必要になる。
- Repair candidate generation、repair ranking、auto-fix、automatic commitが必要になる。
- Standalone diff product workflowやrepair後rerun validation workflowまで必要になる。
- Real PSD/PNG parser、image decode、raster extraction、texture sampling oracleが必要になる。
- Full renderer、standalone viewer、pixel oracleが必要になる。
- ZIP/archive writer/importer、File System Access API、directory picker、drag-drop implementationが必要になる。
- External dependencyやmanifest/lockfile変更が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、既存diagnostics / evidenceを横断preflight reportに束ねる範囲に限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave39は次を満たしたときpassとする。

- MVP-wide product preflight reportのcontract / category / status / evidence refsが定義されている。
- Existing validator diagnosticsを弱めず、preflight reportへdeterministicに集約できる。
- Runtime / Viewer / package / AI inspection surfaceからpreflight reportをAI-readableに観測できる。
- Editor上でpreflight reportを実行・表示でき、desktop/mobileで読める。
- Rights-clean fixturesとfocused testsで代表的なpass / warn / fail / not_supported / not_evaluatedを確認できる。
- Desktop/mobile e2eでpreflight report -> save/load -> rerun observationを確認できる。
- No AI repair、no LLM provider、no parser、no image decode、no archive/filesystem implementation、no full renderer、no pixel oracle、no Cubism compatibility claim、no external dependency。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
