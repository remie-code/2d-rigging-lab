# Wave 36 Plan: Project-defined Portable Package Bundle v0

> Wave36で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave36
- Wave name: `project-defined-portable-package-bundle-v0`
- Primary objective: Wave31のactual byte intake、Wave34のbyte availability hardening、Wave35のsame-origin IndexedDB persistent byte storageを足場に、外部依存なしのproject-defined JSON bundle + base64 byte payloadで、project metadataとactual bytesを単一portable bundleとしてexport/importできる最小round-tripを実装する。ZIP/archive dependency、File System Access API、drag-drop、PSD parser、PNG/image decode、full renderer、pixel oracleには踏み込まない。

## 2. 次Wave選定

Wave35で、actual bytesは同一browser profile / same-origin IndexedDBに保存され、reload後もdigest / byteLength検証を通じてavailableへ復元できるようになった。

Wave36では **Project-defined Portable Package Bundle v0** を選ぶ。

理由:

- Wave35はbrowser-local persistenceであり、別browser profile、別PC、別originへ持ち出せるproject portabilityではない。
- 実利用ではPSDなどのsource fileを再選択せず、project metadataとactual bytesを一緒に移動できる最小export/importが必要になる。
- ZIPやFile System Access APIへ進むとdependency approvalやplatform policyが絡む。まずproject-defined JSON bundleに限定すれば、外部依存なしでportable round-tripのcontractを固められる。
- PSD parser / image decodeはまだ別の大きな判断である。Wave36ではbytesをparseせず、byte payload integrityとproject associationだけを扱う。

## 3. Undineコンテキスト保護規約

Wave36でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave31でbrowser `<input type=file>` actual-byte intake、digest / byteLength / mediaType / rights / provenance evidence、current-session byte registration、save/load reupload truthfulnessはimplementation-provenになっている。
- Wave34でdirect-call byte availability contract、validator `byteAvailability.*` diagnostics、editor current-session / reupload truthfulness bridge、direct-call fixtures、desktop/mobile e2e guardはimplementation-provenになっている。
- Wave35でsame-origin IndexedDB-backed raw byte persistence、digest / byteLength verified reload recovery、validator `persistentByteStorage.*` diagnostics、desktop/mobile persistent-byte e2e smokeはimplementation-provenになっている。
- 現時点では、project metadataとactual bytesを単一portable fileとしてexport/importする保証はない。
- ZIP writer/importer、standard archive format、File System Access API、directory picker、drag-drop、PSD parser、PNG/image decodeは未実装である。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave36のportable formatはproject-defined JSON bundle v0に限定する。ZIP、tar、compression、external archive libraryは使わない。
- Bundleにはpackage/project metadataとactual binary byte payloadを含める。byte payloadはbase64 encoded fieldとして扱う。
- Browser-local project JSONには巨大raw bytesやbase64 bytesを直列化しない。bytesを含むのは明示exportされたportable bundleだけとする。
- Bundle import時はmetadataを信用せず、payload bytesからdigest / byteLengthを再計算し、bundle metadataと一致した場合のみavailable扱いにする。
- Export時に参照binaryがunavailable / requiresReuploadの場合、Wave36 v0ではpartial bundleを作らず、export全体をtruthful errorとして失敗させる。
- Import成功時はcurrent-session byte registryとIndexedDB persistent byte storageへbytesを登録し、reload後のavailabilityもWave35と同じ経路で扱う。
- `test_data/sample_model.psd`はlocal byte-only fixtureとして使ってよいが、PSD parse / decodeはしない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- ZIP / tar / compressionなどのstandard archive format。
- External archive dependency、package manifest / lockfile変更。
- File System Access API、directory picker、native filesystem picker、drag-drop file input。
- PSD parser、PSD channel decode、PNG parser、PNG/image decode、texture materialization、media signature sniffing本格実装。
- Public tutorial asset distribution、demo capture scene、public/private asset splitの最終決定。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Cloud upload、cross-origin persistence guarantee、external HTTP/WebSocket/MCP transport、LLM provider integration。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave36-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- `discussion/implementation/waves/wave34/wave34-final-report.md`
- `discussion/implementation/reviews/wave34/wave34-clean-integration-review.md`
- `discussion/implementation/waves/wave35/wave35-final-report.md`
- `discussion/implementation/reviews/wave35/wave35-clean-integration-review.md`

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

Wave36はportable bundle contractとbinary payload integrityを扱うため、shared contractを先に固定し、その後package-format実装とvalidator diagnosticsを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Portable bundle contract foundation | Solo first | Wave35 complete | project-defined JSON bundle v0のmetadata / payload / version / binary reference contractを固定する |
| 2 | B. Package-format bundle writer/importer | Parallel with C | A | in-memory package metadata + actual bytesをbundleへexportし、import時にbase64 decodeとintegrity検証を行う |
| 2 | C. Validator bundle integrity diagnostics | Parallel with B | A | malformed bundle、unsupported version、missing payload、digest / byteLength mismatchをdeterministic diagnosticsへ載せる |
| 3 | D. Editor bundle export/import workflow | Solo after B/C | B + C | Browser Editorでexport/import UIを提供し、import bytesをcurrent-sessionとIndexedDBへ登録する |
| 4 | E. Bundle round-trip fixture and e2e | Solo after D | D | desktop/mobileでbyte intake -> persistent storage -> export -> reset -> import -> no-reupload availabilityを確認する |
| 5 | F. Integration review and final report | Solo after E | E | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared contract ownerであり、複数Gnomeに分割しない。
- Bはpackage-format pure functionに限定し、browser APIやEditor UIへ触らない。
- Cはvalidator-core中心に限定し、bundle writer/importerやEditor UIへ触らない。
- DはEditor workflow / UI / session integrationに限定し、package-format contractを再設計しない。
- Eはfixtures / e2e / traceabilityに限定する。B/C/Dのsource defectを発見した場合は勝手に広げず差し戻す。
- Fはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave36-portable-bundle-contract-foundation`

Purpose:

- Project-defined portable bundle v0を表すcontract / package-format evidenceを固定する。
- Bundle version、package identity、package revision、binary asset id、package-relative path、digest、byteLength、mediaType、rights、provenance、payload encodingを表せるようにする。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused contracts / package-format tests
- `discussion/design/module-contracts/package-file-format-contract.md` if directly required
- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`

Forbidden:

- Editor export/import UI implementation
- Validator broad implementation
- ZIP / File System Access API / parser / image decode implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Bundle v0 evidence is additive and does not claim ZIP/archive compatibility.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave36-package-format-bundle-writer-importer`

Purpose:

- Package-format pure functionとしてportable bundle export / importを実装する。
- Export時にactual bytesをbase64 payloadとしてbundleへ含める。
- Import時にpayload bytesをdecodeし、digest / byteLength / mediaType / binary reference consistencyを検証する。

Allowed write scope:

- `packages/package-format/src/**`
- focused package-format tests
- `fixtures/contracts/**` only if narrow contract fixture is needed
- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`

Forbidden:

- Browser API / IndexedDB直接依存
- Editor UI implementation
- Validator-core broad implementation
- ZIP / compression / external archive dependency
- Manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- In-memory package metadata + binary bytesのexport/import round-tripが通る。
- Referenced binary bytesがunavailable / requiresReuploadの場合、partial bundleを作らずdeterministic failureになる。
- Unsupported version、missing payload、digest mismatch、byteLength mismatchがdeterministic failureになる。

### C. `wave36-validator-bundle-integrity-diagnostics`

Purpose:

- Bundle / binary payload integrityをvalidatorがdeterministicに扱えるようにする。
- Missing required binary、unsupported bundle version、missing payload、digest mismatch、byteLength mismatch、availability mismatchをAI-readable diagnosticsへ載せる。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`

Forbidden:

- Package-format writer/importer implementation
- Editor export/import UI implementation
- Archive / File System Access API / parser / image decode validation beyond bundle integrity truthfulness
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid verified bundle evidence passes.
- Missing / corrupt / unsupported bundle evidence emits stable diagnostics and does not silently pass.

### D. `wave36-editor-bundle-export-import-workflow`

Purpose:

- Editorでcurrent project + available bytesをportable bundleとしてexportできるようにする。
- Portable bundleをfile inputからimportし、検証済みbytesをcurrent-session byte registryとIndexedDB persistent byte storageへ登録する。
- Invalid bundle importはmetadataを壊さずtruthful error / unavailable stateへ落とす。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- focused editor session / workflow / UI tests
- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`

Forbidden:

- Package-format contract redesign beyond Domain B API usage
- Validator broad implementation
- PSD / PNG parser
- Image decode
- File System Access API / directory picker / drag-drop
- Full renderer / pixel oracle
- External dependency / manifest / lockfile changes

Pass evidence:

- Export / import UIがdesktop/mobileで操作可能である。
- Export対象binaryがunavailable / requiresReuploadの場合、partial bundleを作らずユーザーにtruthful errorを表示する。
- Import成功後、元ファイルを再選択せずavailable bytesとして扱える。
- Invalid bundle importが安全に失敗し、project metadataを壊さない。

### E. `wave36-bundle-roundtrip-fixture-e2e`

Purpose:

- Fixtureとdesktop/mobile e2eで、file intake -> IndexedDB persist -> bundle export -> project reset -> bundle import -> no-reupload availability -> validator observationを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI/test-id/wiring only if needed
- `fixtures/contracts/**`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`

Forbidden:

- Broad source implementation in packages/**
- E2E assertion weakening to hide bundle failure
- PSD parse / decode
- Image pixel assertion
- File System Access API / drag-drop
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke proves bundle import後に元file再選択なしでbytes availableになる。
- Malformed bundle / digest mismatch fallback remains truthful and validator-readable.

### F. `wave36-integration-review-and-final-report`

Purpose:

- Domains A-Eを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave36/**`
- `discussion/implementation/reviews/wave36/**`
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
- Clean integration reviewがportable bundle contract、package-format writer/importer、validator diagnostics、editor export/import workflow、e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no ZIP/archive dependency, no File System Access API, no parser, no image decode, no full renderer, no pixel oracle.

## 10. Subagent / Orch-Sylph Execution Policy

Wave36起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain B / CのOrch-Sylphを並列投入する。
3. Domain B / Cが`pass`したら、UndineはDomain DをOrch-Sylphに委譲する。
4. Domain Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
5. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
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

- Portability Truthfulness: project-defined JSON bundleをZIP/archive standardやfilesystem persistenceとして誇張していないか。
- Byte Integrity: import時にdigest / byteLength / mediaType / binary referenceを再検証しているか。
- Byte Availability: import後のavailable / missing / corrupt / requires-reuploadが正直か。
- Validator Evidence: diagnosticsがdeterministicでAI-readableか。
- UI / Accessibility: export/import stateがdesktop/mobileで観測可能で、parser/decode/rendererを暗示しないか。
- Non-Goals: ZIP/archive dependency、File System Access API、drag-drop、parser、image decode、full renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / package-format focused tests、typecheck
- Domain B: package-format focused tests、valid / invalid bundle round-trip tests
- Domain C: validator focused tests、diagnostic stability tests
- Domain D: editor-session / editor-workflow / editor-state / UI focused tests
- Domain E: focused e2e portable bundle round-trip smoke on desktop/mobile
- Domain F: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for ZIP/archive dependency / File System Access API / drag-drop / parser / image decode / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- Project-defined JSON bundleだけでは要件を満たせず、ZIP / filesystem / cloud / external dependencyが必要になる。
- Browser download / file inputだけではUX要件を満たせず、File System Access API、drag-drop、directory pickerが必要になる。
- Browser-local project JSONへbase64 bytesを常時直列化する必要が出る。
- PSD parser、PNG decode、image dependency、media signature sniffing本格実装が必要になる。
- Import後のIndexedDB persistence guaranteeについて、product guaranteeの判断が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、project-defined JSON bundle、base64 byte payload、no dependency、no parserに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave36は次を満たしたときpassとする。

- Browser Editorでcurrent project metadataとavailable actual bytesをproject-defined portable JSON bundleとしてexportできる。
- Export対象binaryがunavailable / requiresReuploadの場合、partial bundleを作らずtruthful errorで止まる。
- Exportされたbundleをimportし、payload bytesからdigest / byteLengthを再検証したうえでavailableへ復元できる。
- Import成功後、current-session byte registryとIndexedDB persistent byte storageへbytesが登録され、元file再選択なしで利用できる。
- Malformed bundle、unsupported version、missing payload、digest mismatch、byteLength mismatchはsilent passせず、truthful error / unavailable / validator diagnosticsへ落ちる。
- Browser-local project dataに巨大raw bytesを直列化せず、metadata、persistent storage、portable bundleの境界を保つ。
- Desktop/mobile e2eでexport/import後のno-reupload availabilityとfallback truthfulnessを確認できる。
- No ZIP/archive dependency、no File System Access API、no drag-drop、no PSD parser、no PNG/image decode、no external dependency、no Cubism compatibility claim、no full renderer、no pixel oracle。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
