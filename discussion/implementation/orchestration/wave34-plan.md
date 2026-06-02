# Wave 34 Plan: Byte Intake Preflight Direct-Call Contract Hardening v0

> Wave34で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave34
- Wave name: `byte-intake-preflight-direct-call-contract-hardening-v0`
- Primary objective: Wave31で導入したbrowser actual-byte intakeのcurrent-session境界を、direct callerやvalidator利用者が誤用しないように硬化する。save/load後のraw bytes欠落、`requiresReupload`、stale verified summary、availability mismatchをdeterministicに扱い、archive / persistent storage / parser / image decodeへ進む前の契約を固める。

## 2. 次Wave選定

Wave33でLayer Tree Direct Manipulation / Part Tree UX v0はimplementation-provenになった。次の大きな候補には、package archive / persistent binary storage、mesh topology / UV editor、AI repair / diff workflow、public tutorial / demo asset boundary、layer tree follow-upがある。

Wave34では **Byte Intake Preflight Direct-Call Contract Hardening v0** を選ぶ。

理由:

- Wave31のactual byte intakeはcurrent-session限定であり、browser-local save/load後はraw bytesを保持せず、reuploadが必要である。この境界をdirect callerが誤用すると、stale summaryやavailabilityの嘘が入りやすい。
- 残件リスト上でも、stale verified summary禁止、availability明示、`requiresReupload`扱いの契約強化は小さなvalidator / contract hardening taskとして扱える。
- Package archive / persistent storage、PNG decode、PSD parserへ進む前に、byte availability contractを固める方が安全である。
- このwaveはユーザー判断が必要なstorage方式、ZIP/image/parser dependency、File System Access APIへ踏み込まないため、1waveで閉じやすい。

## 3. Undineコンテキスト保護規約

Wave34でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave22でpackage-local binary asset entries/references、in-memory text+binary package file-set、digest / byteLength / mediaType / rights / provenance validator evidence、truthful missing-bytes/storage UXはimplementation-provenになっている。
- Wave31でbrowser `<input type=file>` actual-byte intake、current-session byte registration、validator diagnostics、save/load reupload truthfulness、byte-only local sample fixture、desktop/mobile e2e smokeはimplementation-provenになっている。
- Wave31はpersistent binary storage guarantee、archive import/export、drag-drop、File System Access API、PSD parser、PNG/image decodeを扱っていない。
- Wave33でlayer tree direct manipulationはimplementation-provenになったが、native drag/drop、multi-select、recursive delete、group transformはfuture scopeである。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave34はdirect caller向けのpreflight / validator contract hardeningに限定する。
- Raw bytesがcurrent sessionにない状態は、`available`として扱わない。必要なら`requiresReupload`またはmissing-byte相当の状態として明示する。
- Verified summaryやbyte evidenceは、対象package identity / package revision / binary ref / digest / byteLength / availability sourceに対してstaleでないことを検証できる形にする。
- Direct callerがstale verified summaryを渡した場合、validatorはpassにしない。deterministic diagnosticを返す。
- Editor save/load pathは、reloaded projectでraw bytesがない事実を維持し、validator / evidenceへ同じtruthfulnessを伝える。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Persistent binary storageの実装、IndexedDB / base64 / localStorage storage方針決定。
- Package archive import/export、ZIP dependency、filesystem project import/export。
- Drag-drop、File System Access API、directory picker。
- PNG / image decode、media signature sniffingの本格実装、texture materialization。
- Real PSD parser、PSD channel decode、raster extraction、Photoshop-compatible compositing。
- Public tutorial asset distribution、demo capture scene、public/private asset splitの最終決定。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Layer tree native drag/drop、multi-select bulk operations、group transform、recursive delete/delete-with-reassign。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave34-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- `discussion/implementation/waves/wave33/wave33-final-report.md`
- `discussion/implementation/reviews/wave33/wave33-clean-integration-review.md`

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

Wave34は契約硬化waveであるため、shared contractを先に直列で固め、その後validatorとEditor/session callerの整合を並列に進める。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Byte availability direct-call contract foundation | Solo first | Wave33 complete | direct caller向けのbyte availability / verified summary / requiresReupload契約とtest oracleを固定する |
| 2 | B. Validator stale-summary and reupload diagnostics | Parallel with C | A | stale verified summary、missing current bytes、availability mismatch、requiresReuploadをdeterministic diagnosticsへ載せる |
| 2 | C. Editor session / workflow byte truthfulness bridge | Parallel with B | A | save/load後やdirect validation callでraw bytes欠落をtruthfulに渡し、stale summaryを再利用しない |
| 3 | D. Fixtures, direct-call regressions, and e2e guard | Solo after B/C | B + C | direct-call regression、fixture、desktop/mobile smokeで誤用防止を確認する |
| 4 | E. Integration review and final report | Solo after D | D | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはvalidator-core中心に限定し、Editor UIやoperation handlerへ戻らない。
- CはEditor session / workflow / minimal UI stateに限定し、validator broad redesignへ戻らない。
- Dはfixture / tests / e2eに限定する。source fixが必要な場合は対象domainへ差し戻す。
- Eはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave34-byte-availability-direct-call-contract-foundation`

Purpose:

- Direct callerがbyte availabilityを判定するための最小contractを固定する。
- Stale verified summary、package revision mismatch、binary ref mismatch、digest / byteLength mismatch、`requiresReupload`をtest oracleとして表現できるようにする。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused contracts / package-format tests
- `discussion/design/module-contracts/package-file-format-contract.md` if directly required
- `discussion/implementation/waves/wave34/**`
- `discussion/implementation/reviews/wave34/**`

Forbidden:

- Editor UI implementation
- Validator broad implementation
- Archive / persistent storage / parser / image decode implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Direct-call byte availability contract can distinguish available current-session bytes, missing bytes, and requires-reupload state.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave34-validator-stale-summary-reupload-diagnostics`

Purpose:

- Validatorがdirect caller由来のstale verified summaryやavailability mismatchをdeterministic diagnosticsとして拒否できるようにする。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave34/**`
- `discussion/implementation/reviews/wave34/**`

Forbidden:

- Editor UI implementation
- Operation handler implementation
- Parser / image decode / archive validation beyond byte availability truthfulness
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid current-session byte evidence passes.
- Stale package revision、binary ref mismatch、digest mismatch、byteLength mismatch、missing current bytes、requires-reupload stateがstable diagnosticsになる。

### C. `wave34-editor-session-byte-truthfulness-bridge`

Purpose:

- Editor save/load後やdirect validation callで、raw bytesがない状態をtruthfulにvalidatorへ渡す。
- Stale verified summaryや古いavailable stateをUI/sessionが再利用しないようにする。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- narrow UI wiring only if needed
- focused editor session / workflow tests
- `discussion/implementation/waves/wave34/**`
- `discussion/implementation/reviews/wave34/**`

Forbidden:

- Broad Editor UI redesign
- New file input mechanism、drag-drop、File System Access API
- Archive / persistent storage / parser / image decode implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Save/load後のprojectはraw bytes availableを主張せず、requires-reupload / missing-byte stateをvalidator-readableに保つ。
- Direct validation callがstale summaryを再利用しない。

### D. `wave34-direct-call-fixtures-and-e2e-guard`

Purpose:

- Contract fixture、direct-call regression、desktop/mobile e2eで、byte availability誤用がpassしないことを確認する。

Allowed write scope:

- `fixtures/contracts/**`
- `apps/editor/e2e/**`
- focused test files
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave34/**`
- `discussion/implementation/reviews/wave34/**`

Forbidden:

- Broad source implementation
- E2E assertion weakening to hide stale summary / reupload truthfulness
- Parser / image decode / archive import/export
- External dependency / manifest / lockfile changes

Pass evidence:

- Direct-call stale summary fixture fails with deterministic diagnostics.
- Browser save/load / reupload truthfulness remains observable on desktop and mobile.

### E. `wave34-integration-review-and-final-report`

Purpose:

- Domains A-Dを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave34/**`
- `discussion/implementation/reviews/wave34/**`
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
- Clean integration reviewがcontract、validator、editor/session caller、fixtures/e2e、orchestration complianceを確認する。
- Final report records residual risks honestly, including no persistent storage, no archive, no parser, no image decode, no File System Access API, no full renderer, no pixel oracle.

## 10. Subagent / Orch-Sylph Execution Policy

Wave34起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain DをOrch-Sylphに委譲する。
4. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
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

- Byte Availability Truthfulness: current-session bytes、missing bytes、requires-reupload、stale summaryを正直に表現しているか。
- Direct-Call Safety: validator direct callerが古いverified summaryやavailable stateを使ってpassできないか。
- Validator Evidence: diagnosticsがdeterministicでAI-readableか。
- Editor / Session Integrity: save/load後のreupload stateを崩していないか。
- Non-Goals: persistent storage、archive、parser、image decode、File System Access API、drag-drop、full renderer、pixel oracle、Cubism互換、public distributionに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / package-format focused tests、typecheck
- Domain B: validator focused tests、diagnostic stability tests
- Domain C: editor-session / editor-workflow focused tests、editor typecheck
- Domain D: focused fixture tests、desktop/mobile e2e guard
- Domain E: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for persistent storage / archive / parser / image decode / File System Access API / drag-drop / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Persistent binary storage、IndexedDB/localStorage/base64などのstorage方式判断が必要になる。
- Archive import/export、ZIP dependency、filesystem project import/exportが必要になる。
- PSD parser、PNG decode、image dependency、media signature sniffing本格実装が必要になる。
- `<input type=file>`以外のfile input mechanismが必要になる。
- Direct caller contractを変えると既存package schemaのbreaking migrationが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、current-session byte availability、stale summary rejection、requires-reupload truthfulness、no dependencyに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave34は次を満たしたときpassとする。

- Direct caller向けのbyte availability contractが、available current-session bytes、missing bytes、requires-reupload、stale verified summaryを区別できる。
- Validatorがstale summary、package revision mismatch、binary ref mismatch、digest / byteLength mismatch、missing current bytes、requires-reupload stateをdeterministic diagnosticsとして扱う。
- Editor save/load後にraw bytes availableを誤って主張せず、validator-readableなreupload / missing-byte stateを保つ。
- Direct-call regression、contract fixture、desktop/mobile e2e guardで誤用防止が確認される。
- No persistent storage、no archive import/export、no File System Access API、no drag-drop、no PSD parser、no PNG/image decode、no external dependency、no Cubism compatibility claim、no full renderer、no pixel oracle。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
