# Wave 22 Plan: Real Asset I/O Boundary Foundation

> Wave 22 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 22
- Wave name: `real-asset-io-boundary-foundation`
- Primary objective: real PSD parser へ進む前に、package binary file-set、asset reference、rights/provenance、validator、editor failure UX の境界を実装し、将来の real image bytes / PSD bytes を受け止める土台を作る。

## 2. 次Wave選定

Wave 20-21 で parser-free PSD adapter/profile path は実装済みになった。PSD は実利用の本命だが、次に parser へ直接進むのは危険である。未決のまま残っているのは、parser そのものより手前の asset I/O 境界である。

現状の主要ギャップ:

- `PackageFileSet` は text entry 中心。
- PSD / PNG bytes の package storage がない。
- OS file picker、archive import/export、binary storage failure UX がない。
- texture preview は metadata と data URL / fallback 中心で、package-local bytes materialization ではない。
- real PSD parser / image decoder / dependency selection は未承認。

そのため Wave 22 は real parser 実装ではなく、binary asset を package 内でどう参照・保存・検証・表示するかを先に固める。

## 3. Undine コンテキスト保護の復元規約

Wave 22 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 21 は `Completed / implementation-proven`。
- PSD adapter/profile evidence は structured `psdProfile` として永続化できる。
- `importPsdSourceAsset` は parser-free adapter metadata を materialize できる。
- Editor は structured PSD profile を summary / evidence / AI inspection に projection できる。
- No real PSD parser、no file picker、no binary package storage、no image decode。
- `PackageFileSet` は text entry 中心で、binary package lifecycle は未設計。
- Wave 21 final report の recommended next wave は real asset I/O boundary design。

## 5. Design Decisions

- Wave 22 は real asset I/O boundary foundation に限定する。
- Package-format に binary asset entry / binary asset reference / digest / byte length / media type / storage status を導入する。
- Binary asset は rights/provenance と結びつけられる必要がある。
- Real file picker、archive writer、image decode、PSD parser は実装しない。
- Binary fixture は rights-clean deterministic test bytes のみに限定し、PSD / PNG / third-party image bytes は追加しない。
- Editor は file picker を出さず、binary asset availability / missing bytes / package-local reference / storage unsupported を truthful に表示する。
- Runtime-core には binary asset implementation detail を漏らさない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- Actual PSD parser。
- PNG / PSD image decode。
- Raster extraction、Photoshop-compatible compositing。
- OS file picker。
- ZIP / archive import-export implementation。
- External dependency addition for image, archive, or filesystem handling。
- `test_data/sample_model.psd` のコピー、fixture化、再配布。
- Texture atlas packing、UV editor、Canvas/WebGL renderer。
- Standalone viewer implementation。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave22-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave21/wave21-final-report.md`
- `discussion/implementation/reviews/wave21/wave21-clean-integration-review.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- `discussion/implementation/waves/wave21/wave21-final-report.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Binary asset boundary は package-format contract と file-set representation が upstream bottleneck になる。Domain A/B が pass するまで、operation / validator / editor は開始しない。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Binary asset contract and I/O policy basis | Solo | Wave 21 complete | binary asset entry/reference/policyを package-format と discussion artifact に固定する |
| 2 | B. Package binary file-set read/write foundation | Solo | A | text + binary entry を持つ package file set の in-memory read/write基盤を実装する |
| 3 | C. Binary source/texture reference materialization | Parallel with D | B | source/texture metadata が package-local binary refs を持てるようにする |
| 3 | D. Binary asset validator diagnostics | Parallel with C | B | missing bytes / digest mismatch / media type / rights provenance diagnostics を追加する |
| 4 | E. Binary asset fixtures and contract evidence | Parallel with F | C + D | rights-clean deterministic byte fixtureで evidence を固定する |
| 4 | F. Editor binary asset boundary UX | Parallel with E | C + D | file pickerなしで binary availability / missing bytes / storage unsupported を表示する |
| 5 | G. Asset I/O boundary smoke and persistence | Solo | E + F | browser-local save/load と binary-reference truthfulness smoke を確認する |
| 6 | H. Integration review and final report | Solo | G | final verification、clean integration review、map更新、final report |

安全上の制約:

- A/B は `packages/package-format/**` を独占する。
- C は operation-core / authoring-core を担当し、validator / editor には触らない。
- D は validator-core を担当し、operation / editor には触らない。
- E は fixtures/contracts と fixture tests を担当し、editor UI には触らない。
- F は editor projection / UI / workflow tests を担当し、fixtures/contracts には触らない。
- G は e2e / smoke に限定する。広い source fix が必要なら該当 domain へ差し戻す。
- External dependency、file picker、actual parser、image decode、archive implementation が必要になったら `escalate` する。

## 9. Domain Assignments

### A. `wave22-binary-asset-contract-and-io-policy-basis`

Purpose:

- package-format に binary asset entry / binary asset reference / digest / byte length / media type / storage status の contract を追加する。
- asset I/O policy artifact を discussion に残し、binary bytes、file picker、archive、fixture、rights/provenance の扱いを整理する。

Write scope:

- `packages/package-format/src/**`
- package-format focused tests
- `discussion/implementation/waves/wave22/wave22-asset-io-boundary-policy.md`
- discussion completion / review reports

Forbidden:

- Operation handler implementation
- Validator implementation
- Editor implementation
- External dependency
- Actual PSD/PNG binary fixture
- Archive writer / file picker

Pass evidence:

- Binary asset reference DTO can represent package-local bytes without loading them.
- Policy artifact separates implemented boundary from future parser/file/archive work.
- Rights/provenance fields can be associated without binary decode.
- Existing text package fixtures remain compatible.

Early escape:

- Package-file contract requires broad migration beyond one wave.
- Binary bytes cannot be represented without archive/import-export redesign.

### B. `wave22-package-binary-file-set-foundation`

Purpose:

- package-format の file set に text entry と binary entry の両方を扱う in-memory foundation を追加する。
- Hash / byte length / media type verification helper を追加する。
- Archive or filesystem I/O は future scope のままにする。

Write scope:

- `packages/package-format/src/package-file-set*.ts`
- `packages/package-format/src/*binary*.ts` if needed
- package-format focused tests
- discussion completion / review reports

Forbidden:

- ZIP/archive implementation
- Node filesystem picker or browser File API UI
- External dependency
- PSD/PNG decode

Pass evidence:

- In-memory binary entry can be stored and read with deterministic digest / size / media type.
- Existing text file-set behavior remains compatible.
- Failure modes for missing bytes / digest mismatch are represented.

Early escape:

- Current file-set abstraction cannot accept binary without broad package persistence redesign.

### C. `wave22-binary-source-texture-reference-materialization`

Purpose:

- source asset / texture metadata が package-local binary asset refs を持てるようにする。
- PSD structured profile と texture preview relation が binary refs を参照できる foundation を追加する。
- Parser-free / decode-free truthfulness を維持する。

Write scope:

- `packages/operation-core/src/**` focused files
- `packages/authoring-core/src/**` focused files
- focused operation / authoring tests
- discussion completion / review reports

Forbidden:

- Validator implementation
- Editor UI implementation
- PSD/PNG decode
- File picker
- External dependency

Pass evidence:

- Source/texture metadata can reference package-local binary assets.
- Missing binary payload remains diagnostic / pending state, not false success.
- Existing PSD structured profile and split PNG metadata paths remain compatible.

Early escape:

- Operation materialization requires actual file bytes or browser File API.
- Source/texture ownership cannot be represented without broad schema redesign.

### D. `wave22-binary-asset-validator-diagnostics`

Purpose:

- Validator が binary asset refs、missing bytes、digest mismatch、media type mismatch、rights/provenance gaps を診断できるようにする。
- PSD / texture / source manifest の binary reference consistency を確認する。

Write scope:

- `packages/validator-core/src/**`
- focused validator tests
- discussion completion / review reports

Forbidden:

- Operation handler implementation
- Editor UI implementation
- Binary decode
- Runtime-core binary schema
- External dependency

Pass evidence:

- Valid binary asset refs pass.
- Missing bytes / digest mismatch / media type mismatch / missing provenance are deterministic diagnostics.
- No image decode or raster assumptions are made.

Early escape:

- Validator report cannot express binary asset diagnostics without broader report redesign.

### E. `wave22-binary-asset-fixtures-and-contract-evidence`

Purpose:

- Rights-clean deterministic test bytes を使った binary asset fixture を追加する。
- PSD / image bytes ではなく、binary file-set / reference / digest / rights/provenance evidence を固定する。

Write scope:

- `fixtures/contracts/**`
- package / operation / validator fixture tests
- discussion completion / review reports

Forbidden:

- Actual PSD / PNG / third-party image bytes
- `test_data/sample_model.psd` copy
- Editor UI implementation
- External dependency

Pass evidence:

- Binary fixture proves package-local binary reference and digest evidence.
- Fixture explicitly states it is generated deterministic test bytes, not image/PSD content.
- Validation report covers binary reference diagnostics.

Early escape:

- Fixture policy for deterministic binary bytes is unclear.

### F. `wave22-editor-binary-asset-boundary-ux`

Purpose:

- Editor が binary asset availability / missing bytes / storage unsupported を truthful に表示する。
- File picker は出さず、package-local binary refs と future-scope import/export limitations をユーザーに誤認させない。

Write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-state/**`
- `apps/editor/src/ui/source-assets/**`
- `apps/editor/src/ui/**` focused asset summary files
- focused editor tests
- discussion completion / review reports

Forbidden:

- OS file picker
- Browser File API import implementation
- Image decode
- Archive import/export
- Broad app shell redesign

Pass evidence:

- Editor summarizes binary refs and missing bytes without claiming decode/import.
- PSD structured profile projection remains compatible.
- Long diagnostics wrap and accessible labels remain coherent.

Early escape:

- Truthful UX requires actual file import workflow.
- Existing editor state cannot represent binary availability without broad redesign.

### G. `wave22-asset-io-boundary-smoke-and-persistence`

Purpose:

- Browser smoke で binary asset reference / missing bytes / save-load truthfulness を確認する。
- PSD structured profile path と split PNG metadata path が壊れていないことを確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow UI test-id / aria tweaks if needed
- discussion completion / review reports

Forbidden:

- File picker
- Image decode
- Actual binary file upload
- Archive import/export
- Broad source fixes without domain差し戻し

Pass evidence:

- Binary refs survive browser save/load as metadata.
- Missing bytes / unsupported storage state is visible and truthful.
- PSD and split PNG metadata paths still work.

Early escape:

- E2E requires real browser File API import.

### H. `wave22-integration-review-and-final-report`

Purpose:

- Domain A-G completion reports を統合し、final verification と clean integration review を行う。
- Wave22 final report、current capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave22/**`
- `discussion/implementation/reviews/wave22/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Source code edits。source fix が必要な場合は該当 domain へ差し戻す。

Pass evidence:

- Final verification が typecheck / unit / e2e / source guard / dependency guard / diff check を含む。
- Clean integration review が binary boundary、truthfulness、fixture policy、compatibility、test adequacy、orchestration compliance を確認する。

## 10. Subagent / Orch-Sylph Execution Policy

Wave 22 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B の Orch-Sylph を単独投入し、completion report を待つ。
3. Domain B が `pass` したら、Undine は Domain C / D の Orch-Sylph を並列投入する。
4. Domain C / D が `pass` したら、Undine は Domain E / F の Orch-Sylph を並列投入する。
5. Domain E / F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
6. Domain G が `pass` したら、Undine は Domain H を Orch-Sylph に委譲する。
7. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
8. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Binary Boundary Truthfulness: binary refs と actual bytes / decode / file picker を混同していないか。
- Dependency Policy Compliance: archive/image/filesystem dependency を追加していないか。
- Rights / Provenance: binary refs が rights/provenance と追跡可能か。
- Package Compatibility: existing text file-set / PSD structured profile / split PNG metadata を壊していないか。
- Validator Evidence: missing bytes / digest mismatch / media type / provenance diagnostics が AI-readable か。
- UI / Accessibility: missing bytes / storage unsupported が truthful に表示され、layout と label が破綻していないか。
- Fixture Policy: deterministic test bytes と実画像/PSD bytes を混同していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / validator / fixture / editor / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: package-format contract tests、policy artifact review、typecheck
- Domain B: package-format file-set tests、digest/size/media type tests、typecheck
- Domain C: operation-core / authoring-core focused tests
- Domain D: validator focused tests
- Domain E: fixture / contract focused tests
- Domain F: editor state / UI focused tests、editor typecheck
- Domain G: editor e2e smoke、compatibility smoke、a11y/layout smoke
- Domain H: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`、`pnpm run check:deps`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `pnpm run check:deps`
- `git diff --check -- <Wave22 scope>`
- dependency manifest diff check
- parser/file-picker/decode/archive/raster scan over changed production files

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Binary package storage requires archive/import-export implementation.
- External dependency is needed.
- Browser File API / OS file picker is needed.
- Actual PSD / PNG decode is needed.
- Fixture policy requires real image or PSD bytes.
- Package-file-set migration is broader than one wave.
- Runtime-core would need binary implementation detail.
- Parallel domains discover overlapping write scopes.

現時点では、in-memory binary file-set boundary、binary refs、validator diagnostics、editor truthful UX に限定するなら、追加のユーザー判断は不要。real parser、real image bytes decode、file picker、archive import/export は別wave判断が必要。

## 14. Pass Criteria

Wave 22 は次を満たしたとき pass とする。

- Package-format can represent text + binary file-set entries and package-local binary asset refs.
- Binary asset refs include digest / byte length / media type / rights/provenance hooks.
- Source/texture metadata can refer to package-local binary assets without claiming decode/import.
- Validator detects missing bytes, digest mismatch, media type mismatch, and provenance gaps.
- Fixtures prove binary boundary using rights-clean deterministic test bytes, not PSD/image bytes.
- Editor truthfully displays binary availability / missing bytes / storage unsupported without file picker.
- Browser smoke proves save/load persistence of binary refs and compatibility with PSD structured profile and split PNG metadata paths.
- No external dependency, no file picker, no image decode, no PSD parser, no archive implementation.
- `index.ts` is barrel-only and no giant catch-all file is introduced.
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
