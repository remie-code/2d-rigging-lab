# Wave 37 Plan: Package Archive / Filesystem Import-Export Decision Boundary v0

> Wave37で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave37
- Wave name: `package-archive-filesystem-boundary-v0`
- Primary objective: Wave31/34/35/36で実装証明されたactual byte intake、byte availability、IndexedDB restore、project-defined portable JSON bundle round-tripを足場に、package archive / filesystem import-exportへ進むためのdecision boundary、capability contract、truthful diagnostics、Editor capability UIを実装する。Wave37ではZIP dependency、File System Access API、directory picker、drag-drop、PSD/PNG parser、image decode、full renderer、pixel oracleには踏み込まない。

## 2. 次Wave選定

Wave36で、project metadataとactual bytesはproject-defined JSON bundleとしてexport/importできるようになった。Import後はcurrent-session byte registryとIndexedDB persistent storageへbytesを戻せる。

Wave37では **Package Archive / Filesystem Import-Export Decision Boundary v0** を選ぶ。

理由:

- Portable JSON bundle v0の次に必要なのは、standard archiveやOS filesystemへ進む前のcapability / decision boundaryである。
- ZIPやFile System Access APIはdependency approval、browser support、security、UX、rights/provenanceの判断が重い。実装へ飛ぶ前に、何をsupported / unsupported / future-gatedとして扱うかをcontract化する必要がある。
- Editorには既にdownload/file inputによるportable bundle round-tripがある。Wave37ではその機能を誇張せず、archive/filesystem未対応をtruthfulに表示し、将来実装の拡張点を作る。
- PSD parser / image decodeはarchive/filesystemとは別の大きな判断であり、Wave37には混ぜない。

## 3. Undineコンテキスト保護規約

Wave37でも、Undineは実装詳細を直接抱え込まない。

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
- Wave36でproject-defined portable JSON bundle v0、base64 payload export/import、digest / byteLength / mediaType再検証、`portableBundle.*` diagnostics、Editor export/import UI、desktop/mobile portable round-trip e2eはimplementation-provenになっている。
- 現時点では、ZIP / tar / compressionなどのstandard archive writer/importer、File System Access API、directory picker、drag-drop、PSD parser、PNG/image decodeは未実装であり、supported claimもない。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave37はarchive/filesystem本体実装ではなく、decision boundaryとcapability contractを実装する。
- Supported transportはWave36のproject-defined portable JSON bundleを明示する。
- ZIP/archive dependency、File System Access API、directory picker、drag-dropはfuture-gated capabilityとして扱い、利用可能であるかのように表示しない。
- Unsupported capabilityはsilent no-opにせず、validator diagnostics / Editor UI / AI-readable reportでtruthfulに表現する。
- Dependency approvalが必要になる実装はWave37では行わない。必要になった場合は`escalate`する。
- Browser-local IndexedDBはbest-effort same-origin storageであり、OS filesystem persistenceやcloud persistenceとして扱わない。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- ZIP / tar / compression writer/importer本体実装。
- JSZipなどのexternal archive dependency追加。
- File System Access API、directory picker、native filesystem picker、drag-drop file input。
- PSD parser、PSD channel decode、PNG parser、PNG/image decode、texture materialization、media signature sniffing本格実装。
- Cloud persistence、cross-profile sync、external HTTP/WebSocket/MCP transport。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Public tutorial asset distribution、demo capture scene、public/private asset splitの最終決定。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave37-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave36/wave36-final-report.md`
- `discussion/implementation/reviews/wave36/wave36-clean-integration-review-sylph.md`

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

Wave37はdecision boundaryを扱うため、shared capability contractを先に固定し、その後package-format boundaryとvalidator diagnosticsを並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Archive/filesystem capability contract foundation | Solo first | Wave36 complete | supported / unsupported / future-gated transport capabilityとdecision boundaryを固定する |
| 2 | B. Package-format transport boundary and unsupported archive guards | Parallel with C | A | portable JSON bundleをsupported transportとして明示し、ZIP/archive/filesystem routesをfuture-gated deterministic resultにする |
| 2 | C. Validator transport capability diagnostics | Parallel with B | A | unsupported archive/filesystem capability claims、missing/corrupt transport evidence、dependency-gated routesをAI-readable diagnosticsへ載せる |
| 3 | D. Editor transport capability UI and workflow truthfulness | Solo after B/C | B + C | Editorでportable JSON bundleはsupported、ZIP/File System Access/drag-dropはfuture-gatedとしてtruthfulに表示する |
| 4 | E. Capability fixture and e2e guard | Solo after D | D | desktop/mobileでportable bundle route remains supported、unsupported routes do not masquerade as availableを確認する |
| 5 | F. Integration review and final report | Solo after E | E | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはshared capability contract ownerであり、複数Gnomeに分割しない。
- Bはpackage-format transport boundaryに限定し、Editor UIやvalidator broad redesignへ触らない。
- Cはvalidator-core中心に限定し、package-format writer/importerやEditor UIへ触らない。
- DはEditor workflow / UI / state projectionに限定し、package-format contractを再設計しない。
- Eはfixtures / e2e / traceabilityに限定する。B/C/Dのsource defectを発見した場合は勝手に広げず差し戻す。
- Fはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave37-archive-filesystem-capability-contract-foundation`

Purpose:

- Package transport / archive / filesystem capabilityを表すcontractを固定する。
- Supported transport、unsupported transport、future-gated transport、dependency-gated transportを区別する。
- Wave36 portable JSON bundle v0をsupported transportとして表現し、ZIP / File System Access / drag-dropをfuture-gatedとして表現する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused contracts / package-format tests
- `discussion/design/module-contracts/package-file-format-contract.md` if directly required
- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`

Forbidden:

- ZIP / compression implementation
- File System Access API / directory picker / drag-drop implementation
- Editor broad UI implementation
- Validator broad implementation
- PSD / PNG parser / image decode implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Capability contract is additive and does not claim ZIP/archive/filesystem support.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave37-package-format-transport-boundary-guards`

Purpose:

- Package-format側でtransport capability boundaryを扱えるようにする。
- Portable JSON bundle routeをsupportedとして残し、ZIP/archive/filesystem routeはfuture-gated deterministic resultへ落とす。
- Unsupported routeがsilent successやpartial export/importにならないようにする。

Allowed write scope:

- `packages/package-format/src/**`
- focused package-format tests
- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`

Forbidden:

- ZIP / tar / compression writer/importer
- Browser API / IndexedDB / File System Access API direct dependency
- Editor UI implementation
- Validator-core broad implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Supported portable JSON bundle route remains functional.
- ZIP/archive/filesystem requests return deterministic unsupported/future-gated result rather than pretending success.
- No external dependency or manifest/lockfile change.

### C. `wave37-validator-transport-capability-diagnostics`

Purpose:

- Transport capability evidenceをvalidatorがdeterministicに扱えるようにする。
- Unsupported archive/filesystem claims、future-gated capability use、dependency-gated route、missing/corrupt transport evidenceをAI-readable diagnosticsへ載せる。
- `portableBundle.*`、`byteAvailability.*`、`persistentByteStorage.*` diagnosticsと矛盾しないようにする。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` if directly required
- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`

Forbidden:

- Package-format writer/importer implementation
- Editor UI implementation
- ZIP / File System Access API / parser / image decode validation beyond capability truthfulness
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Supported portable JSON transport does not emit false unsupported diagnostics.
- Unsupported/future-gated transport claims emit stable diagnostics and do not silently pass.

### D. `wave37-editor-transport-capability-ui-truthfulness`

Purpose:

- Editorでtransport capability stateをtruthfulに表示する。
- Portable JSON bundle export/importはsupportedとして残す。
- ZIP/archive、File System Access API、directory picker、drag-dropはfuture-gated / unsupportedとして表示し、利用可能な機能のように見せない。

Allowed write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/**`
- `apps/editor/src/app/**` narrow wiring only if required
- focused editor tests
- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`

Forbidden:

- ZIP/archive implementation
- File System Access API / directory picker / drag-drop implementation
- PSD / PNG parser
- Image decode
- Full renderer / pixel oracle
- External dependency / manifest / lockfile changes

Pass evidence:

- Existing portable bundle export/import remains operable.
- Unsupported future routes are visibly unavailable/future-gated and cannot be triggered as successful operations.
- UI text does not imply ZIP/archive/filesystem/parser/decode support.

### E. `wave37-transport-capability-fixture-e2e`

Purpose:

- Fixtureとdesktop/mobile e2eで、portable JSON bundle route remains supported、unsupported ZIP/filesystem routes remain unavailable/future-gatedを確認する。
- Negative oracleとして、unsupported transport requestがtruthful diagnostic / UI stateへ落ちることを確認する。

Allowed write scope:

- `apps/editor/e2e/**`
- `apps/editor/src/**` narrow UI/test-id/wiring only if needed
- `fixtures/contracts/**`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`

Forbidden:

- Broad source implementation in packages/**
- E2E assertion weakening to hide transport capability failure
- ZIP / File System Access API / drag-drop
- PSD parse / decode
- Image pixel assertion
- External dependency / manifest / lockfile changes

Pass evidence:

- Desktop/mobile smoke confirms portable bundle route still works.
- Unsupported/future-gated route cannot masquerade as supported.

### F. `wave37-integration-review-and-final-report`

Purpose:

- Domains A-Eを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave37/**`
- `discussion/implementation/reviews/wave37/**`
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
- Clean integration reviewがtransport capability contract、package-format boundary、validator diagnostics、Editor UI truthfulness、e2e、non-goal containment、orchestration complianceを確認する。
- Final report records residual risks honestly, including no ZIP/archive implementation, no File System Access API, no drag-drop, no parser, no image decode, no full renderer, no pixel oracle.

## 10. Subagent / Orch-Sylph Execution Policy

Wave37起動時の実行単位はdomainごとのOrch-Sylphである。

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

- Transport Truthfulness: portable JSON bundle、ZIP/archive、filesystem、drag-dropのsupport stateを誇張していないか。
- Dependency Gate: dependency approvalなしにexternal archive libraryやmanifest/lockfile変更を入れていないか。
- Byte Integrity: Wave36 portable bundle routeのdigest / byteLength / mediaType検証が壊れていないか。
- Validator Evidence: diagnosticsがdeterministicでAI-readableか。
- UI / Accessibility: supported / unsupported / future-gated stateがdesktop/mobileで観測可能か。
- Non-Goals: ZIP/archive implementation、File System Access API、drag-drop、parser、image decode、full renderer、pixel oracle、Cubism互換、external dependencyに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: contracts / package-format focused tests、typecheck
- Domain B: package-format focused tests、supported/future-gated transport result tests
- Domain C: validator focused tests、diagnostic stability tests
- Domain D: editor-session / editor-workflow / editor-state / UI focused tests
- Domain E: focused e2e portable bundle route + unsupported route truthfulness smoke on desktop/mobile
- Domain F: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff/status check
- forbidden-scope scan for ZIP/archive implementation / File System Access API / drag-drop / parser / image decode / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- ZIP / tar / compression writer/importer本体実装が必要になる。
- JSZipなどのexternal dependencyやmanifest/lockfile変更が必要になる。
- File System Access API、directory picker、drag-dropが必要になる。
- Browser download/file inputだけでは要件を満たせず、OS filesystemやcloud persistenceのproduct decisionが必要になる。
- PSD parser、PNG decode、image dependency、media signature sniffing本格実装が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、dependency追加なしのcapability boundary、unsupported/future-gated diagnostics、Editor truthfulnessに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave37は次を満たしたときpassとする。

- Package transport capabilityとして、portable JSON bundle supported、ZIP/archive/File System Access/drag-drop future-gated or unsupportedを明示できる。
- Package-format boundaryがunsupported/future-gated routeをsilent successにせず、deterministic resultへ落とせる。
- Validatorがunsupported archive/filesystem claimsやfuture-gated route useをAI-readable diagnosticsとして報告できる。
- Editorがsupported portable bundle routeとunsupported/future-gated routeをtruthfulに表示できる。
- Existing portable JSON bundle export/import round-tripはdesktop/mobileで壊れていない。
- No ZIP/archive implementation、no external archive dependency、no File System Access API、no drag-drop、no PSD parser、no PNG/image decode、no external dependency、no Cubism compatibility claim、no full renderer、no pixel oracle。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
