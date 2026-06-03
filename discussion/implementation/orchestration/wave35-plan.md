# Wave 35 Plan: Browser-Local Persistent Binary Storage v0

> Wave35で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave35
- Wave name: `browser-local-persistent-binary-storage-v0`
- Primary objective: Wave31のcurrent-session byte intakeとWave34のdirect-call byte availability contractを足場に、同一ブラウザ内でactual bytesをIndexedDBへ保存し、browser-local reload後もreuploadなしでbyte availabilityを復元できる最小persistent binary storageを実装する。Archive import/export、PSD parser、PNG/image decode、File System Access API、drag-drop、external dependencyには踏み込まない。

## 2. 次Wave選定

Wave34で、current-session bytes、missing current-session bytes、`requiresReupload`、stale verified summary、availability mismatchをdirect caller / validator / editor sessionがdeterministicに扱えるようになった。

Wave35では **Browser-Local Persistent Binary Storage v0** を選ぶ。

理由:

- 実PSD/PNG parserやarchiveへ進む前に、actual bytesを「同一ブラウザ内で再利用できる」最小storage boundaryを固める必要がある。
- Wave31時点ではreload後にraw bytesが消え、reuploadが必要だった。Wave34でそのtruthfulnessは固まったため、次はtruthfulに`available`へ戻せる保存経路を作るのが自然である。
- ZIP/archive、File System Access API、external dependencyは判断ゲートが大きい。まずbrowser-native IndexedDBに限定すると、依存追加なしで1waveに切れる。
- これはproject export/importではない。保存範囲は同一browser profile / same-origin local app storageに限定する。

## 3. Undineコンテキスト保護規約

Wave35でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave31でbrowser `<input type=file>` actual-byte intake、digest / byteLength / mediaType / rights / provenance evidence、current-session byte registration、save/load reupload truthfulnessはimplementation-provenになっている。
- Wave34でdirect-call byte availability contract、validator `byteAvailability.*` diagnostics、editor current-session / reupload truthfulness bridge、direct-call fixtures、desktop/mobile e2e guardはimplementation-provenになっている。
- 現時点では、browser-local reload後にactual raw bytesを永続化して再利用する保証はない。
- Package archive writer/importer、persistent binary upload/storage、File System Access API、directory picker、ZIP dependency、PSD parser、PNG/image decodeは未実装である。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave35の永続化手段はbrowser-native IndexedDBに限定する。LocalStorage/base64保存、archive、filesystem pickerは使わない。
- Persistent storageはsame-origin / same-browser-profile内の利便性機能であり、portable package archiveではない。
- IndexedDBへ保存するraw bytesは、binary asset id / package-relative path / digest / byteLength / package identity / package revision に紐づける。
- Reload後はIndexedDBからbytesを取り出し、digest / byteLengthを再検証できた場合のみavailable扱いにする。検証できない場合は`requiresReupload`またはmissing/corrupt diagnosticsへ落とす。
- Saved browser-local project dataには巨大raw bytesを直列化しない。Project metadataとIndexedDB stored byte recordを分離する。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Package archive import/export、ZIP dependency、portable project package。
- File System Access API、directory picker、native filesystem picker、drag-drop file input。
- PSD parser、PSD channel decode、PNG/image decode、texture materialization、media signature sniffing本格実装。
- Public tutorial asset distribution、demo capture scene、public/private asset splitの最終決定。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Cloud upload、external HTTP/WebSocket/MCP transport、LLM provider integration。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave35-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- `discussion/implementation/waves/wave34/wave34-final-report.md`
- `discussion/implementation/reviews/wave34/wave34-clean-integration-review.md`

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

Wave35はstorage boundaryを扱うため、shared contractを先に固定し、その後Editor storage adapterとvalidator diagnosticsを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Persistent binary storage contract foundation | Solo first | Wave34 complete | IndexedDB-backed browser-local persistent storageのmetadata / availability evidence / package-format contractを固定する |
| 2 | B. Editor IndexedDB byte store and session restore | Parallel with C | A | file intake時にbytesをIndexedDBへ保存し、reload後に再検証してcurrent availabilityへ戻す |
| 2 | C. Validator persistent storage availability diagnostics | Parallel with B | A | stored bytes missing/corrupt/stale/revision mismatchをdeterministic diagnosticsへ載せる |
| 3 | D. Editor UX and e2e persistent-byte smoke | Solo after B/C | B + C | desktop/mobileでfile intake -> save/load -> no-reupload availability -> missing/corrupt fallbackを確認する |
| 4 | E. Integration review and final report | Solo after D | D | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- BはEditor storage/session integrationに限定し、validator broad redesignへ戻らない。
- Cはvalidator-core中心に限定し、IndexedDB adapterやEditor UIへ触らない。
- DはUX / e2e / fixture registrationに限定する。B/Cのsource defectを発見した場合は勝手に広げず差し戻す。
- Eはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave35-persistent-binary-storage-contract-foundation`

Purpose:

- Browser-local persistent binary storageを表すcontract / package-format evidenceを固定する。
- Stored byte recordがpackage identity、package revision、binary asset id、package-relative path、digest、byteLength、mediaType、storage backend、storedAt / verifiedAtを表せるようにする。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused contracts / package-format tests
- `discussion/design/module-contracts/package-file-format-contract.md` if directly required
- `discussion/implementation/waves/wave35/**`
- `discussion/implementation/reviews/wave35/**`

Forbidden:

- Editor IndexedDB implementation
- Validator broad implementation
- Archive / File System Access API / parser / image decode implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Persistent browser-local storage evidence is additive and does not claim portable archive semantics.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave35-editor-indexeddb-byte-store-session-restore`

Purpose:

- Editor file intake時にactual bytesをIndexedDBへ保存する。
- Browser-local save/load後にIndexedDBからbytesを読み戻し、digest / byteLength検証を通った場合のみavailableへ復元する。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- focused editor session / workflow / state tests
- `discussion/implementation/waves/wave35/**`
- `discussion/implementation/reviews/wave35/**`

Forbidden:

- `packages/validator-core/**`
- Package contract changes beyond Domain A API
- Broad Editor UI redesign
- File System Access API / directory picker / drag-drop
- Archive / parser / image decode implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Reload後にstored bytesを検証し、availableへ戻せる。
- IndexedDB未対応、store missing、digest mismatch、byteLength mismatchはtruthfulにreupload / unavailableへ落ちる。

### C. `wave35-validator-persistent-storage-availability-diagnostics`

Purpose:

- Persistent storage evidenceをvalidatorがdeterministicに扱えるようにする。
- Stored bytes missing、corrupt、stale package revision、binary ref mismatch、digest / byteLength mismatchをAI-readable diagnosticsへ載せる。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave35/**`
- `discussion/implementation/reviews/wave35/**`

Forbidden:

- Editor IndexedDB implementation
- Archive / File System Access API / parser / image decode validation beyond storage availability truthfulness
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid verified browser-local stored bytes pass.
- Missing / corrupt / stale persistent evidence emits stable diagnostics and does not silently pass.

### D. `wave35-editor-ux-e2e-persistent-byte-smoke`

Purpose:

- Editor UXとdesktop/mobile e2eで、file intake -> IndexedDB persist -> browser-local save/load -> no-reupload availability -> validator observationを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI/test-id/wiring only if needed
- `fixtures/contracts/**` only for metadata-only fixture registration if needed
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave35/**`
- `discussion/implementation/reviews/wave35/**`

Forbidden:

- Broad source implementation in packages/**
- E2E assertion weakening to hide storage failure
- Archive / File System Access API / drag-drop
- Parser / image decode / renderer / pixel oracle
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke proves reload after byte intake can recover bytes from browser-local persistent storage without reupload.
- Missing/corrupt store fallback remains truthful and validator-readable.

### E. `wave35-integration-review-and-final-report`

Purpose:

- Domains A-Dを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave35/**`
- `discussion/implementation/reviews/wave35/**`
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
- Clean integration reviewがcontract、IndexedDB editor storage、validator diagnostics、e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no archive, no File System Access API, no parser, no image decode, no full renderer, no pixel oracle.

## 10. Subagent / Orch-Sylph Execution Policy

Wave35起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Storage Truthfulness: browser-local persistent storageをportable archiveやfilesystem persistenceとして誇張していないか。
- Byte Availability: reload後のavailable / missing / corrupt / requires-reuploadが正直か。
- Data Integrity: digest / byteLength / package identity / package revision / binary refの検証があるか。
- Validator Evidence: diagnosticsがdeterministicでAI-readableか。
- UI / Accessibility: storage stateがdesktop/mobileで観測可能で、parser/decode/rendererを暗示しないか。
- Non-Goals: archive、File System Access API、drag-drop、parser、image decode、full renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / package-format focused tests、typecheck
- Domain B: editor-session / editor-workflow / editor-state focused tests、IndexedDB unavailable/missing/corrupt path tests
- Domain C: validator focused tests、diagnostic stability tests
- Domain D: focused e2e persistent-byte smoke on desktop/mobile
- Domain E: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for archive / File System Access API / drag-drop / parser / image decode / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- IndexedDBだけでは要件を満たせず、archive / filesystem / cloud / external dependencyが必要になる。
- Browser storage quota、private browsing、cross-origin persistenceなどで、product guaranteeの判断が必要になる。
- Raw bytesをbrowser-local project JSONへbase64直列化する必要が出る。
- PSD parser、PNG decode、image dependency、media signature sniffing本格実装が必要になる。
- File System Access API、drag-drop、directory pickerが必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、IndexedDBによる同一ブラウザ内のbest-effort persistent storage、no dependency、no archive、no parserに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave35は次を満たしたときpassとする。

- Browser Editorでactual file bytesを取り込んだ後、IndexedDBへraw bytesを保存できる。
- Browser-local save/load後にIndexedDBからbytesを読み戻し、digest / byteLength検証後にavailableへ復元できる。
- Missing/corrupt/stale stored bytesはsilent passせず、requires-reupload / unavailable / validator diagnosticsへ落ちる。
- Saved project dataに巨大raw bytesを直列化せず、metadataとbrowser-local stored bytesの境界を保つ。
- Desktop/mobile e2eでreload後のno-reupload availabilityとfallback truthfulnessを確認できる。
- No archive import/export、no File System Access API、no drag-drop、no PSD parser、no PNG/image decode、no external dependency、no Cubism compatibility claim、no full renderer、no pixel oracle。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
