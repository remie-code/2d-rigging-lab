# Wave 20 Plan: PSD Spec Field Matrix And Adapter Boundary

> Wave 20 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 20
- Wave name: `psd-spec-field-matrix-and-adapter-boundary`
- Primary objective: Adobe公式PSD仕様と実サンプルPSDを先に性格付けし、その根拠に沿って `importPsdSourceAsset` を parser-free adapter result を受け取れる境界へ進める。

## 2. 次Wave選定

Wave 19 で、split PNG source layer の texture / part / preview relation は最小限 implementation-proven になった。実利用では split PNG より PSD が本命になるため、次に PSD import の入口を作る。

ただし、PSD は file format と Photoshop feature surface が大きい。いきなり parser 実装に入ると、公式仕様、依存選定、license、binary fixture、unsupported feature policy、package binary storage が同時に未決になる。

そのため Wave 20 は、最初に公式仕様とユーザー提供サンプルを根拠化する。その上で、将来の PSD parser が返す `layered-character-psd-profile-v1` adapter result を operation が受けられるようにする。

- Adobe公式仕様を MVP import 観点で field matrix 化する。
- `test_data/sample_model.psd` を rights-cleared sample として安全に characterization する。
- PSD bytes を完全に読む、または raster extraction するとは主張しない。
- Photoshop互換の合成、smart object、text、effect rendering は扱わない。
- `importPsdSourceAsset` は adapter supplied layer/group result がある場合だけ commit 可能にする。
- parser absent / parser result missing / unsupported PSD feature は deterministic diagnostic として残す。
- Wave 19 の texture preview / part mapping / provenance 経路を PSD source profile へ再利用する。

これは fake import ではなく、仕様根拠と parser 境界を先に固定するための実装waveである。

## 3. Undine コンテキスト保護の復元規約

Wave 20 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Orch-Sylph 自身が直接書いてよいのは orchestration report / completion report / review request などの `discussion/implementation/**` のみである。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- Undine は completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 19 は `Completed / implementation-proven`。
- `test_data/sample_model.psd` はユーザー提供の実PSDで、うちの検証に自由に使ってよい rights-cleared sample である。
- `test_data/sample_model.psd` の現在のファイルサイズは 22,406,225 bytes。
- Adobe official Photoshop File Formats Specification は PSD / PSB file format の一次情報として使う。
- Repo 内では `discussion/design/module-contract-design-decisions.md` と `discussion/design/module-contracts/package-file-format-contract.md` が既に Adobe PSD specification を参照している。
- `packages/package-format/src/source-manifest.ts` は `psd-source-v1` と `layered-character-psd-profile-v1` を既に許容している。
- `packages/operation-core/src/operation-type.ts` と `operation-payload.ts` は `importPsdSourceAsset` を既に持つ。
- `packages/operation-core/src/operation-registry.ts` は `importPsdSourceAsset` を登録しているが、現在は unsupported handler へ向いている。
- Wave 19 で texture preview reference、textureId、target partId、preview truthfulness、validator texture evidence、browser-local save/load は split PNG source path で実装済み。
- `PackageFileSet` は text entry 中心であり、PSD binary bytes を保存する設計ではない。
- `discussion/development_convention/dependency-policy.md` は、PSD / image tooling dependency を approval / license / provenance / scope review 後に限定している。

## 5. Design Decisions

- Wave 20 は PSD spec field matrix、sample characterization、parser adapter boundary、metadata-backed PSD profile materialization に限定する。
- Domain A は source code を変更しない。公式仕様と sample PSD から、後続実装の根拠になる persistent artifact を作る。
- `test_data/sample_model.psd` は参照してよいが、別 fixture directory へコピーしない。
- 外部 PSD parser / image library は追加しない。`package.json` / lockfile の dependency change は Wave20 non-goal。
- `importPsdSourceAsset` は adapter supplied layer/group result がある場合だけ commit できる。
- Adapter result は PSD layer/group metadata、bounds、opacity、visibility、unsupported feature list、texture preview references、target part mapping を表現する。
- Unsupported PSD features は runtime-core に漏らさず、source manifest diagnostics / validation diagnostics / operation diagnostics に留める。
- Wave 19 の deterministic data URL preview path は fixture/e2e 用に使ってよいが、実PSD raster extraction と混同しない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- PSD binary parser の本実装。
- PSD layer tree extraction from actual file bytes の完全対応。
- Raster pixel extraction、Photoshop互換合成、smart object / text / effect rendering。
- 外部 PSD parser / image dependency の追加。
- `test_data/sample_model.psd` のコピー、再配布、または package fixture 化。
- OS file picker、package archive import/export、binary file set design。
- Full texture atlas packing、UV editing、WebGL/canvas renderer。
- Runtime-core への PSD固有構造の導入。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave19/wave19-final-report.md`

Domain A に渡す spec / sample basis:

- Adobe Photoshop File Formats Specification: `https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/`
- `discussion/design/module-contract-design-decisions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `test_data/sample_model.psd`

Source implementation domains に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約や PSD 仕様全文を自分で読み込まない。詳細規約と仕様は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

PSD import は仕様理解と operation payload が shared bottleneck になる。Domain A を preflight、Domain B を upstream serialization point にする。A が pass するまで source implementation は起動しない。B が pass するまで C/D/E は起動しない。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. PSD spec field matrix and sample characterization | Solo | Wave 19 complete | Adobe公式仕様と `test_data/sample_model.psd` を MVP import 観点で根拠化する |
| 2 | B. PSD adapter result DTO and operation payload gate | Solo | A | parser-free adapter result contract、payload schema、unsupported/parser-missing gate を固定する |
| 3 | C. PSD import operation materialization | Parallel with D | B | `importPsdSourceAsset` の metadata-backed commit path を実装する |
| 3 | D. PSD profile validator diagnostics | Parallel with C | B | unsupported feature / source profile / texture-provenance diagnostics を固める |
| 4 | E. PSD fixtures and contract evidence | Parallel with F if write scope is clean | C + D | adapter-result fixtures と evidence を追加する |
| 4 | F. Editor PSD source intake mode | Parallel with E if write scope is clean | B + C | manual/profile-driven PSD mode を Source Intake に追加する。file picker/parser は扱わない |
| 5 | G. PSD intake e2e / persistence smoke | Solo | E + F | GUI から PSD adapter result path -> drawable -> preview -> save/load を検証する |
| 6 | H. Integration review and final report | Solo | G | clean integration review、map更新、final report を完了する |

安全上の制約:

- A は source code を編集しない。仕様と sample characterization の discussion artifact のみを書く。
- B は `payloads/import-source.ts` / operation registry 周辺を独占する。
- C と D は operation implementation と validator implementation で write scope を分ける。
- E と F は fixture/evidence と editor UI を分ける。ただし同じ operation payload に戻る必要がある場合は直列化する。
- External dependency が必要になったら implementation を止め、dependency proposal / user decision に escalate する。
- Parser結果が actual PSD parsing と誤認される命名・UI・evidence は blocking とする。

## 9. Domain Assignments

### A. `wave20-psd-spec-field-matrix-and-sample-characterization`

Purpose:

- Adobe Photoshop File Formats Specification のうち、MVP PSD import に関係する section を要約する。
- PSD header、color mode data、image resources、layer/mask info、layer records、channel image data、additional layer info、group/section divider、mask、compression を `layered-character-psd-profile-v1` adapter result fields へ mapping する。
- `test_data/sample_model.psd` を rights-cleared sample として安全に characterization する。
- supported / deferred / unsupported feature matrix を作る。
- 後続 domain が「何を実装し、何を実装しないか」を判断できる境界を作る。

Write scope:

- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/reviews/wave20/**` の review report

Forbidden:

- Source code changes
- Dependency changes
- `test_data/sample_model.psd` のコピー、加工、別directoryへの複製
- Full PSD parser implementation
- Raster extraction
- Photoshop rendering compatibility claims

Pass evidence:

- 公式一次情報 URL が記録されている。
- sample PSD の file size、checksum、header facts は安全に取得できる範囲で記録されている。
- sample characterization が full parser 実装を要求する場合、その事実を記録して stop / escalate している。
- Adapter field mapping が supported / deferred / unsupported の分類を持つ。
- 後続 source implementation domain が使える compact basis になっている。

Early escape:

- 公式仕様と既存 contract の間に矛盾がある。
- sample PSD の characterization に parser dependency が必要になる。
- sample PSD が MVP happy path として使えないほど複雑で、synthetic adapter fixture へ切り替える必要がある。
- unsupported feature severity に product policy decision が必要になる。

### B. `wave20-psd-adapter-result-dto-operation-payload-gate`

Purpose:

- `ImportPsdSourceAssetPayload` に parser-free adapter result を表現する schema を追加する。
- Adapter result がない場合は、現行と同等に explicit unsupported / parser-missing diagnostic を返せる gate を残す。
- Domain A の field matrix に沿って、PSD source profile の layer/group/bounds/opacity/visibility/unsupportedFeatures/texture preview/target part mapping を payload上で表現する。

Write scope:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts` は handler gate wiring の最小差分のみ
- `packages/package-format/src/source-manifest.ts` は schema gap がある場合の最小差分のみ
- focused operation payload tests
- discussion completion / review reports

Forbidden:

- External PSD parser / image dependency
- `package.json` / lockfile changes
- Editor UI implementation
- Validator implementation
- `index.ts` implementation logic

Pass evidence:

- Adapter supplied PSD result payload validates.
- Missing adapter result yields deterministic diagnostic path.
- Unsupported PSD feature list can be represented without runtime-core dependency.
- Source file organization review passes.

Early escape:

- Payload shape requires actual PSD parser output before it can be defined.
- Parser result vs package source manifest conflicts with existing contract.
- Dependency or binary asset approval is required.

### C. `wave20-psd-import-operation-materialization`

Purpose:

- `importPsdSourceAsset` を adapter-result-present path で commit 可能にする。
- PSD source asset / layer metadata / texture preview refs / target part mapping / rights / provenance を authoring session と package assets に materialize する。
- Parser absent / parser result missing / unsupported feature diagnostics を operation result に残す。

Write scope:

- `packages/operation-core/src/operations/import-psd-source-asset*.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts` の置換または互換維持
- `packages/operation-core/src/operation-registry.ts`
- `packages/authoring-core/src/source-asset-mutations.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- focused operation / authoring tests
- discussion completion / review reports

Forbidden:

- PSD binary read / image decode
- External parser dependency
- Editor UI implementation
- Validator broad implementation
- Runtime-core PSD-specific changes
- `index.ts` implementation logic

Pass evidence:

- `importPsdSourceAsset` dry-run / commit succeeds when adapter result is present.
- Commit creates `psd-source-v1` / `layered-character-psd-profile-v1` source asset records.
- Texture preview metadata and source layer -> part / texture relation are preserved.
- Missing parser result and unsupported features are deterministic diagnostics.
- Previous unsupported path remains truthful when no adapter result is supplied.

Early escape:

- Current authoring mutations cannot distinguish split PNG vs PSD source without broad redesign.
- Texture preview path requires binary asset storage.
- Operation registry cannot preserve unsupported fallback and supported adapter path coherently.

### D. `wave20-psd-profile-validator-diagnostics`

Purpose:

- PSD source profile validation diagnostics を追加する。
- Unsupported PSD features、missing layer provenance、missing texture preview、source-layer mismatch を AI-readable report に出す。
- Runtime-core に PSD-specific structure が漏れていないことを確認する。

Write scope:

- `packages/validator-core/src/**`
- `fixtures/contracts/**` は Domain E と衝突しない compact fixture scaffolding のみ
- focused validator tests
- discussion completion / review reports

Forbidden:

- Operation handler implementation
- Editor UI implementation
- External parser dependency
- Runtime-core PSD-specific schema
- `index.ts` implementation logic

Pass evidence:

- Valid adapter-backed PSD source profile can validate.
- Unsupported PSD feature diagnostic is structured and source-targeted.
- Missing provenance / texture preview / source-layer mismatch are detected.
- Generated / split PNG validators remain compatible.

Early escape:

- Unsupported PSD feature severity needs product policy decision.
- Validator contract cannot express source import diagnostics without redesign.

### E. `wave20-psd-fixtures-and-contract-evidence`

Purpose:

- Synthetic adapter-result fixturesとして `psd-import-happy-path` と `psd-unsupported-layer` を追加する。
- 可能なら Domain A の sample characterization をもとに、`test_data/sample_model.psd` 由来の metadata shape に近い synthetic fixture を作る。ただしPSD bytesは fixture 化しない。
- Operation result、model diff、source manifest、texture preview metadata、validation report の evidence を固定する。

Write scope:

- `fixtures/contracts/psd-import-happy-path/**`
- `fixtures/contracts/psd-unsupported-layer/**`
- focused fixture tests under package / operation / validator packages
- discussion completion / review reports

Forbidden:

- Actual PSD binary fixture
- `test_data/sample_model.psd` のコピー
- Third-party asset / unreviewed image bytes
- External parser dependency
- Editor UI implementation

Pass evidence:

- Happy path fixture proves PSD adapter result -> source manifest / drawable / part / texture mapping.
- Unsupported-layer fixture proves unsupported feature diagnostics without runtime leakage.
- Rights/provenance metadata is present and clean.
- Fixture names do not imply actual PSD bytes were parsed.

Early escape:

- Rights-clean synthetic fixture policy is unclear.
- Fixture would require binary PSD or parser library to be meaningful.

### F. `wave20-editor-psd-source-intake-mode`

Purpose:

- Source Intake UI に PSD mode を追加し、manual/profile-driven adapter result を入力できるようにする。
- File picker / parser ではなく、将来 parser result に相当する layer/profile metadata の入力・確認に限定する。

Write scope:

- `apps/editor/src/editor-state/source-intake-*.ts`
- `apps/editor/src/ui/source-assets/**`
- `apps/editor/src/editor-session/source-import-command.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- focused editor state / UI / workflow tests
- discussion completion / review reports

Forbidden:

- OS file picker
- PSD parser / image decode
- Broad app shell redesign
- Validator implementation
- `index.ts` implementation logic

Pass evidence:

- UI can choose PSD adapter/profile mode without claiming file parsing.
- User-entered PSD layer metadata maps to `importPsdSourceAsset`.
- Existing split PNG source intake remains compatible.
- Accessible controls and long diagnostic wrapping remain intact.

Early escape:

- UI wording cannot avoid implying actual PSD file parsing.
- Source Intake shared state becomes too broad and needs a prior refactor.

### G. `wave20-psd-intake-e2e-and-persistence-smoke`

Purpose:

- Browser smoke で PSD adapter profile intake -> createDrawable -> preview -> save/load を固定する。
- Desktop / mobile viewport と basic a11y を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed for smoke
- discussion completion / review reports

Pass evidence:

- PSD mode から adapter-result-like metadata を登録できる。
- Imported PSD source layer を使って createDrawable / generateMesh に進める。
- Preview は deterministic texture path を表示し、actual PSD parse とは扱わない。
- Save/load 後も source layer / textureId / partId / preview relation が残る。
- Desktop / mobile の両方で layout overflow と accessible names を確認する。

Early escape:

- E2E が actual file picker / parser を要求する。
- Browser storage が PSD adapter metadata を保存できない。
- UI が PSD parsing 済みと誤認させる。

### H. `wave20-integration-review-and-final-report`

Purpose:

- Domain A-G の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 20 final report、capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave20/**`
- `discussion/implementation/reviews/wave20/**`
- `discussion/implementation/current-capability-map.md`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- Integration review が PSD Spec Basis、Sample Characterization、PSD Profile Truthfulness、Dependency Policy Compliance、Source Layer Mapping、Texture Preview Persistence、Validator Evidence、UI / Accessibility、Source Organization、Test Adequacy、Orchestration Compliance を含む。
- Final report に verification commands、known residuals、next-wave recommendation がある。
- Final report に各 Orch-Sylph の delegated Gnome / Review-Sylph context id が記録される。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 20 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B の Orch-Sylph を単独投入し、completion report を待つ。
3. Domain B が `pass` したら、Undine は Domain C / D の Orch-Sylph を並列投入する。
4. Domain C / D が `pass` したら、Undine は Domain E / F を投入する。write scope 衝突が見えた場合は直列化する。
5. Domain E / F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
6. Domain G が `pass` したら、Undine は Domain H を Orch-Sylph に委譲する。
7. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。Domain A も調査 artifact 作成担当と review 担当を分ける。
8. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
9. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
10. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
11. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Domain A の assignment には、次の追加文も含める。

```text
Domain A は source code を変更しない。公式仕様と test_data/sample_model.psd の安全な characterization を discussion artifact としてまとめ、後続 domain の basis にすること。full PSD parser 実装または dependency が必要になった場合は実装せず escalate すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- PSD Spec Basis: Adobe公式仕様への参照と field mapping が一次情報に基づいているか。
- Sample Characterization: `test_data/sample_model.psd` の扱いが rights-cleared reference に留まり、コピーや過剰な parse claim をしていないか。
- PSD Profile Truthfulness: actual PSD binary parse と adapter-result materialization を混同していないか。
- Dependency Policy Compliance: PSD / image parser dependency を追加していないか。追加が必要なら dependency approval に escalate しているか。
- Source Layer Mapping: PSD source layer -> textureId -> partId -> drawable の関係が追跡可能か。
- Texture Preview Persistence: Wave 19 の preview metadata / save-load 経路を壊していないか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Rights / Provenance: source asset rights / provenance / unsupported feature diagnostics が追跡できるか。
- Validator Evidence: unsupported feature / missing provenance / missing texture / mismatch が AI-readable diagnostics として観測できるか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / validator / workflow / UI / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: discussion artifact review、official source URL check、sample file existence / checksum / header-fact recording
- Domain B: operation payload schema focused tests、typecheck
- Domain C: operation-core / authoring-core focused tests、typecheck
- Domain D: validator focused tests
- Domain E: fixture / contract focused tests
- Domain F: editor state / source-assets UI / workflow focused tests、editor typecheck
- Domain G: editor e2e smoke、a11y/layout smoke
- Domain H: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave20 scope>`
- untracked file whitespace check if new fixtures/reports are untracked

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Adobe公式仕様と既存 source manifest / operation contract が矛盾する。
- `test_data/sample_model.psd` の characterization に full parser / dependency が必要になる。
- `test_data/sample_model.psd` が MVP happy path の根拠として不適切で、synthetic fixture への切り替え判断が必要になる。
- External PSD parser / image library が必要になる。
- Dependency manifest / lockfile change が必要になる。
- Actual PSD bytes / raster extraction / binary package storage が必要になる。
- Adapter result の仕様が既存 source manifest / operation contract と矛盾する。
- Unsupported PSD feature severity を product policy として決める必要がある。
- UI が actual PSD parsing 済みと誤認される。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、spec field matrix、sample characterization、parser-free adapter result、synthetic fixture に限定するなら、ユーザー判断は不要。real PSD parser、actual PSD binary fixture、package PSD byte storage、file picker を同時に求める場合は別wave判断が必要。

## 14. Pass Criteria

Wave 20 は次を満たしたとき pass とする。

- `wave20-psd-spec-field-matrix.md` が Adobe公式仕様の sections と MVP adapter fields の対応を supported / deferred / unsupported で示している。
- `wave20-psd-sample-characterization.md` が `test_data/sample_model.psd` の rights、size、checksum、安全に得られた header/sample facts、利用上の制約を記録している。
- `importPsdSourceAsset` が adapter supplied PSD profile result に対して dry-run / commit できる。
- Missing parser result / parser absent / unsupported feature が deterministic diagnostic になる。
- PSD source asset が `psd-source-v1` / `layered-character-psd-profile-v1` として source manifest、provenance、rights、operation log、package file set に残る。
- PSD source layer から textureId / partId / preview relation を追跡できる。
- Validator / operation evidence が PSD source profile、unsupported feature、rights/provenance、texture relation を観測できる。
- GUI から PSD adapter/profile mode を使い、createDrawable / generateMesh / preview / save-load に進める。
- Desktop / mobile e2e smoke で PSD adapter intake workflow が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
