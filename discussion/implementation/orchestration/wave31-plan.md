# Wave 31 Plan: Package Binary / File I/O Decision + Browser Byte Intake Pilot v0

> Wave31で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書と`.agents/skills/implementation-orchestration/SKILL.md`を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave31
- Wave name: `package-binary-file-io-byte-intake-pilot-v0`
- Primary objective: Wave22のpackage-local binary reference / storage metadata boundaryを、ブラウザの`<input type=file>`による実byte intake pilotへ進める。PSD parserやimage decodeには入らず、actual bytesをdigest / byteLength / mediaType / rights / provenance付きでpackage-local binary境界へ載せ、Editor / Validator / e2eでtruthfulに確認する。

## 2. 次Wave選定

Wave30で、rights-clean synthetic tutorial mini modelはsemantic authoring workflowとして一周した。次の大きな分岐は、mesh topology / UV editor、AI repair、public tutorial / demo boundary、またはactual binary/file intakeである。

Wave31では **Package Binary / File I/O Decision + Browser Byte Intake Pilot v0** を選ぶ。

理由:

- 実際の利用ケースはPSD中心になりやすいが、PSD parserへ進む前に、実byteの受け入れ、rights/provenance、digest、storage truthfulness、validator boundaryを先に固める必要がある。
- Wave20-Wave22でmetadata / package-local binary referenceはあるが、Editorがactual bytesを受け取るpilotはまだない。
- archive / parser / image decode / dependencyを同時に入れると判断ゲートが広がりすぎる。Wave31では`<input type=file>`だけに限定して、安全な最小byte-intakeを作る。
- `test_data/sample_model.psd`は、ユーザーが自由使用を許可した実PSD sampleとして、byte-intake smokeの入力に使える。ただしWave31ではPSDを解析・decodeしない。

## 3. Undineコンテキスト保護規約

Wave31でも、Undineは実装詳細を直接抱え込まない。

- Undineはobjective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- UndineはdomainごとにOrch-Sylphを起動し、Orch-Sylphがdomain内のGnome実装、Review-Sylphレビュー、needs_fix loop、completion reportを完結させる。
- Orch-Sylph自身は実装担当ではない。source implementationは必ず別コンテキストのGnomeへ委譲し、レビューは必ず別コンテキストのReview-Sylphへ委譲する。
- Orch-SylphがGnome / Review-Sylphの分離を実行できない場合、Orch-Sylph自身で実装せず`escalate` / `blocked`として報告する。
- 長時間待機になっても、UndineとOrch-Sylphはsubagent処理を打ち切らない。
- 各source implementation domainには`discussion/development_convention/source-file-organization-policy.md`を渡し、巨大source file、catch-all file、実装入り`index.ts`を防ぐ。

## 4. Repository Facts

- Wave22でpackage-local binary asset entries/references、in-memory text+binary package file-set、digest / byteLength / mediaType / rights / provenance validator evidence、truthful missing-bytes/storage UXはimplementation-provenになっている。
- Wave20-Wave21でparser-free PSD adapter/profile pathはimplementation-provenだが、real PSD bytes parsing、image decode、raster extractionは未実装である。
- Wave30でsynthetic tutorial mini model workflowはimplementation-provenになったが、real asset bytes、file picker、parser、archive、image decodeはnon-goalのまま残っている。
- Existing public `index.ts` files must remain barrel-only.

## 5. Design Decisions

- Wave31のfile intakeは`<input type=file>`に限定する。drag-drop、File System Access API、directory picker、archive import/exportは含めない。
- 入力byteはpackage-local binary asset boundaryに載せる。最小証拠はdigest、byteLength、declared mediaType、source filename、rights、provenance、storage status、availabilityである。
- Browser-local save/loadでは、actual bytesが永続化されない場合はtruthfulに`missing` / `ephemeral` / `requiresReupload`として表示する。永続化できないことを隠さない。
- `test_data/sample_model.psd`はbyte-intake e2e / characterization inputとして使ってよい。ただしPSD parser、PSD layer extraction、Photoshop-compatible compositing、texture materializationは行わない。
- PNG decodeやtexture sampling correctnessは扱わない。入力がPNG風mediaTypeでもbyte metadataとして扱う。
- External dependency、package manifest、lockfile変更は行わない。

## 6. Non-Goals

- Real PSD parser、PSD channel decode、raster extraction、Photoshop-compatible compositing。
- PNG / image decode、texture sampling correctness、atlas packing。
- Archive import/export、ZIP dependency、filesystem project import/export。
- Drag-drop、File System Access API、directory picker。
- Persistent large binary storage guarantee。Wave31ではtruthful metadata / availability / reupload boundaryを優先する。
- Full renderer、pixel oracle、standalone viewer。
- Cubism SDK/Core、Cubism形式import/export、Cubism compatibility claim。
- Public tutorial asset distribution、demo capture scene。

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave31-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave30/wave30-final-report.md`
- `discussion/implementation/reviews/wave30/wave30-clean-integration-review.md`

各Orch-Sylphへ渡すdomain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/waves/wave30/wave30-final-report.md`
- domainごとのtarget source files
- domainごとの既存tests / fixtures

Undineは全規約や設計全文を自分で読み込まない。詳細規約と設計はOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave31はactual byte intakeへの境界拡張であるため、contract / validator / editor draft / sample characterizationを先に並列化し、その後operation/session/e2eへ合流させる。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Package binary byte-intake contract boundary | Parallel with B/C/D | Wave30 complete | package-format / contracts側でbyte-intake result、storage truthfulness、binary file-set evidence boundaryを固める |
| 1 | B. Validator byte availability / rights preflight | Parallel with A/C/D, coordinate schema needs | Wave30 complete | actual byte availability、digest、mediaType、rights/provenance、unsupported parser/decode claimsをdeterministic diagnosticsへ載せる |
| 1 | C. Editor source intake file-input draft state | Parallel with A/B/D | Wave30 complete | `<input type=file>`用draft state / view model / UI draftを作り、operation commit wiringはまだ行わない |
| 1 | D. Byte sample characterization and fixture basis | Parallel with A/B/C | Wave30 complete | `test_data/sample_model.psd`をbyte-only sampleとしてcharacterizeし、rights-clean fixture/e2e basisを固定する |
| 2 | E. Binary byte registration operation / session integration | Solo after A-D | A + B + C + D | actual bytesをoperation/session/package-local binary boundaryへ登録し、operation log / package evidenceへ載せる |
| 3 | F. Editor byte intake workflow and truthful persistence UX | Solo after E | E | Editorからfile input -> digest/provenance -> validator -> save/load truthfulness -> reupload boundaryを確認できるようにする |
| 4 | G. Contract fixtures and browser e2e byte-intake smoke | Solo after F | F | deterministic fixtureとdesktop/mobile e2eでsample PSD bytesをmetadata-onlyに取り込む |
| 5 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、map/backlog/final report更新を行う |

安全上の制約:

- Aはpackage-format / contractsに限定し、Editor UIやoperation handlerへ触らない。
- Bはvalidator-coreに限定し、operationやEditor UIへ触らない。
- CはEditor draft state / UIに限定し、operation commit / session wiringへ触らない。
- Dはfixture basis / characterization / tests basisに限定し、source implementationへ触らないか、必要最小限のfixture-only testに留める。
- Eはoperation-core / authoring-core / editor-sessionの統合に限定し、UI redesignやvalidator broad redesignへ戻らない。
- FはEditor workflow / UI integrationに限定し、package/validator broad implementationへ戻らない。必要ならA/B/Eへ差し戻す。
- Gはe2e / fixtureに限定する。overflowやUI blockerが出た場合はsource/UI corrective domainへescalateする。
- Hはreports/maps/backlog/review統合を担当する。source fixが必要な場合はGnomeへ明示委譲し、Review-Sylphで再レビューする。

## 9. Domain Assignments

### A. `wave31-package-binary-byte-intake-contract-boundary`

Purpose:

- Actual byte intakeをpackage-local binary boundaryへ載せるためのcontract / package-format表現を固める。
- Existing binary asset / package file-set boundaryを活用し、必要な最小DTOやsummaryだけを追加する。

Allowed write scope:

- `packages/contracts/src/**`
- `packages/package-format/src/**`
- focused package-format / contracts tests
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- Editor UI / e2e implementation
- Operation handler implementation
- Validator broad implementation
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Byte intake result / package-local binary evidence can represent digest, byteLength, mediaType, filename, rights/provenance, storage status, and availability.
- Public `index.ts` changes, if any, are barrel-only.

### B. `wave31-validator-byte-availability-rights-preflight`

Purpose:

- Actual bytesのavailable/missing/mismatch、rights/provenance、unsupported parser/decode/archive claimsをdeterministic diagnosticsへ載せる。

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator tests
- `discussion/design/module-contracts/validator-contract.md` only if directly required
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Parser / image decode / archive validation beyond metadata and byte-header truthfulness
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Valid byte-intake metadata passes.
- Missing bytes, digest mismatch, byteLength mismatch, mediaType mismatch, missing rights/provenance, unsupported parser/decode claims emit stable diagnostics.

### C. `wave31-editor-source-intake-file-input-draft`

Purpose:

- Editor Source Intakeに`<input type=file>`用のdraft state / view model / UI draftを追加する。
- File選択後にfilename、byteLength、declared mediaType、rights/provenance draft、storage truthfulnessを表示できるようにする。
- Operation commit wiringはDomain E/Fへ残す。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/source-assets/**`
- focused editor state / UI tests
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/**`
- `packages/**`
- e2e files
- drag-drop / File System Access API
- broad app shell redesign
- External dependency / manifest / lockfile changes

Pass evidence:

- File input draft state is deterministic and truthful before commit.
- UI does not imply PSD parsing, PNG decode, archive import, or renderer correctness.

### D. `wave31-byte-sample-characterization-fixture-basis`

Purpose:

- `test_data/sample_model.psd`をbyte-only inputとしてcharacterizeし、fixture/e2e basisを固定する。
- PSD semanticsは読まず、byteLength、digest、mediaType expectation、rights/provenance basisだけを扱う。

Allowed write scope:

- `fixtures/contracts/**`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- PSD parser / decode / raster extraction
- New binary asset distribution policy claims
- Editor UI implementation
- External dependency / manifest / lockfile changes

Pass evidence:

- Sample is documented as byte-only, user-provided, rights-cleared for local tests.
- Expected digest/byteLength evidence is deterministic.

### E. `wave31-binary-byte-registration-operation-session`

Purpose:

- Actual bytesをoperation/session/package-local binary boundaryへ登録し、operation log / package materialization / validator evidenceへつなぐ。
- Existing binary asset reference operationが使えるなら活用し、必要な場合のみ小さな operation extension を追加する。

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/**`
- `apps/editor/src/editor-session/**`
- focused operation / authoring / session tests
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- Editor broad UI redesign
- Parser / image decode / archive import/export
- External dependency / manifest / lockfile changes
- `index.ts` implementation logic

Pass evidence:

- Actual byte intake produces auditable operation/session evidence.
- Package-local binary metadata and availability are coherent with validator diagnostics.
- Browser storage limitations are represented truthfully.

### F. `wave31-editor-byte-intake-workflow-truthful-persistence`

Purpose:

- Editorからfile input -> byte metadata/digest -> rights/provenance -> commit -> validation -> save/load truthfulness -> reupload boundaryを一周できるようにする。

Allowed write scope:

- `apps/editor/src/editor-state/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-session/**`
- `apps/editor/src/app/editor-app.ts` for narrow wiring
- `apps/editor/src/ui/source-assets/**`
- focused editor tests
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- File System Access API / drag-drop / directory picker
- Parser / image decode / archive import/export
- Full renderer / pixel oracle
- External dependency / manifest / lockfile changes

Pass evidence:

- Editor workflow can intake actual file bytes and show digest/availability/rights/provenance.
- Save/load does not pretend to preserve large binary bytes unless it actually does; missing/reupload state is visible and validator-readable.

### G. `wave31-contract-fixtures-and-e2e-byte-intake-smoke`

Purpose:

- Contract fixtureとdesktop/mobile e2eで、actual bytes intake -> metadata/evidence -> save/load truthfulness -> reupload or missing-byte diagnosticsを確認する。

Allowed write scope:

- `fixtures/contracts/**`
- `apps/editor/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- focused fixture tests
- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`

Forbidden:

- Broad editor/source implementation
- Parser / image decode / archive import/export
- E2E assertion weakening to hide missing-byte truthfulness
- External dependency / manifest / lockfile changes

Pass evidence:

- `test_data/sample_model.psd` or deterministic local bytes can be selected as file input in e2e.
- E2E verifies byte metadata, validator state, save/load truthfulness, and no parser/decode claims.

### H. `wave31-integration-review-and-final-report`

Purpose:

- Domains A-Gを統合し、final verification、clean integration review、final report、map/backlog更新を行う。

Allowed write scope:

- `discussion/implementation/waves/wave31/**`
- `discussion/implementation/reviews/wave31/**`
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
- Clean integration reviewがbinary intake contract、validator、editor workflow、e2e、orchestration complianceを確認する。
- Final report records residual risks honestly, including no parser, no image decode, no archive, no full renderer, no pixel oracle, no public asset distribution.

## 10. Subagent / Orch-Sylph Execution Policy

Wave31起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain A / B / C / DのOrch-Sylphを並列投入する。
2. Domain A-Dが`pass`したら、UndineはDomain EをOrch-Sylphに委譲する。
3. Domain Eが`pass`したら、UndineはDomain FをOrch-Sylphに委譲する。
4. Domain Fが`pass`したら、UndineはDomain GをOrch-Sylphに委譲する。
5. Domain Gが`pass`したら、UndineはDomain HをOrch-Sylphに委譲する。
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

- Byte Intake Truthfulness: actual bytes、metadata、storage availability、missing/reupload状態を正直に表現しているか。
- Rights / Provenance: source filename、rights、provenance、local sample扱いがAI-readableか。
- Validator Evidence: byte availability / mismatch / unsupported claimsがdeterministic diagnosticsになっているか。
- Operation / Package Integrity: operation log、model diff、package materialization、binary refsがcoherentか。
- UI / Accessibility: file inputとstate表示がdesktop/mobileで破綻せず、parser/decode/rendererを暗示しないか。
- Persistence: save/load後にbytesが消える場合、それをtruthfulに表示・検証できるか。
- Non-Goals: parser、image decode、archive、File System Access API、drag-drop、full renderer、pixel oracle、Cubism互換、public distributionに逸脱していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope非逸脱を満たすか。
- Test Adequacy: unit / fixture / editor / e2eがdomain riskに見合うか。
- Orchestration Compliance: Orch-Sylph自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domainごとの最小verification:

- Domain A: package-format / contracts focused tests、typecheck
- Domain B: validator focused tests、diagnostic stability tests
- Domain C: editor state / source-assets UI focused tests、editor typecheck
- Domain D: fixture/sample characterization checks
- Domain E: operation / authoring / editor-session focused tests
- Domain F: editor workflow / UI focused tests、editor typecheck
- Domain G: focused contract fixture tests、desktop/mobile e2e byte-intake smoke
- Domain H: final full verification and clean integration review

最終verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`
- dependency manifest diff check
- forbidden-scope scan for parser / image decode / archive / File System Access API / drag-drop / external dependency / Cubism compatibility / pixel oracle / full renderer claims

## 13. Early Escape / User Decision Points

Orch-Sylphは次の場合、独断で大きな設計変更をせず`escalate`する。

- `<input type=file>`以外のfile input mechanismが必要になる。
- PSD parser、PNG decode、image dependency、archive dependencyが必要になる。
- Actual bytesを永続化するためにIndexedDB/localStorage/base64 storageなどの大きな方針判断が必要になる。
- User-facing rights/provenance policyが不足し、sampleや実assetの扱いを判断できない。
- Browser securityやfile handling boundaryで追加ユーザー判断が必要になる。
- Parallel domainsが同じfilesを編集する必要を発見した。
- Source fileが巨大化し、単一責務分割なしでは実装できない。

現時点では、`<input type=file>`、metadata/digest boundary、truthful ephemeral/missing-byte handling、no dependencyに限定するなら、実装起動前の追加ユーザー判断は不要とみなす。

## 14. Pass Criteria

Wave31は次を満たしたときpassとする。

- Browser Editorでactual file bytesを選択し、byteLength / digest / mediaType / filename / rights / provenanceを取得できる。
- 取得したbytesはpackage-local binary boundaryへ登録され、operation log / package materialization / validator evidenceへつながる。
- Validatorがavailable / missing / mismatch / rights-provenance gap / unsupported parser-decode claimsをdeterministicに報告する。
- Save/load後のbyte availabilityがtruthfulに表示される。bytesが永続化されない場合はmissing/reupload stateとして扱う。
- `test_data/sample_model.psd`またはdeterministic local bytesでdesktop/mobile e2e smokeが通る。
- No PSD parser、no PNG/image decode、no archive import/export、no drag-drop、no File System Access API、no external dependency、no Cubism compatibility claim、no full renderer、no pixel oracle、no public asset distribution。
- `index.ts`はbarrel-onlyのままで、巨大source file / catch-all source fileが増えていない。
- Domain completion、clean integration review、final reportが`discussion/implementation/`配下に残る。
