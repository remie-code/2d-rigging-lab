# Wave 5 Plan: Package Persistence / Operation Log Foundation

> 状態: Draft / 起動前計画  
> 作成日: 2026-05-29  
> 対象 wave: Wave 5  
> Root coordinator: Undine  
> 実行単位: 1 wave  
> 主目的: Wave 4 で生成できるようになった runtime / validation evidence を、保存・再読込できる package artifact へ接続する。

## 1. Wave 5 の狙い

Wave 4 で operation result は runtime snapshot ID、runtime state ref、validation report ID、operation log entry を返せるようになった。ただし、これらはまだ durable package artifact ではない。

Wave 5 は GUI / AI 実装へ進む前に、次を最小実装する。

- committed operation が package revision を進める。
- operation log entry を JSONL として serialize / parse できる。
- `AuthoringSession` を保存可能な `PackageDocumentDto` へ戻せる。
- `PackageDocumentDto` を deterministic な package file set へ展開し、同じ file set から再読込できる。
- runtime snapshots / runtime states / validation reports を package-relative generated artifact として materialize できる。
- createParameter の commit から package file set、operation log JSONL、runtime / validation generated artifacts、reload validation まで通る fixture を追加する。

## 2. 上流ゲート

Wave 5 は Wave 4 final report が `pass` であることを前提に開始する。

Basis:

- [../waves/wave4/wave4-final-report.md](../waves/wave4/wave4-final-report.md)
- [../waves/wave4/integration-review.md](../waves/wave4/integration-review.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

## 3. Wave 5 の設計判断

### Decision

Wave 5 では OS filesystem / zip writer ではなく、まず package-relative text file set を production boundary とする。

理由:

- Browser save、Node filesystem、zip export は adapter が分かれる可能性がある。
- `package-format` が `operation-core` / `runtime-core` / `validator-core` の DTO 所有権を奪わないようにする。
- GUI / AI が必要とする durable artifact の前提は、package-relative path と text content の決定性で先に検証できる。

### Boundary rules

- `package-format` は package layout、JSON serialization、file set parse を所有する。ただし operation log / runtime snapshot / validation report の schema parse は所有しない。
- `operation-core` は operation log entry schema と JSONL codec を所有する。package file writing はしない。
- `authoring-core` は dirty `AuthoringSession` を `PackageDocumentDto` へ戻す adapter を所有する。package file writing はしない。
- `runtime-core` は runtime snapshot / runtime state / runtime state sequence artifact の materialization を所有する。package writer は呼ばない。
- `validator-core` は validation report artifact の materialization を所有する。operation mutation はしない。
- 統合 fixture だけが、各 module の public API を束ねて package file set と expected artifact を検証する。

### Package revision policy

Wave 5 では次の policy を採用する。

- commit 成功時、`session.packageRevision` は 1 回だけ increment される。
- revision increment は committed mutation 成功後、evidence provider と operation log entry 作成の前に行う。
- dry-run は original session を mutate しない。ただし candidate session / evidence は `basePackageRevision + 1` を temporary revision として扱う。
- rejected operation、unsupported operation、precondition failure は package revision、authoring revision、operation log を変えない。

この policy により、commit 後に保存される package manifest、runtime evidence、validation report、operation log が同じ candidate package revision を参照できる。

## 4. 依存関係と並列設計

```text
Wave 4 pass
  ├─ A. wave5-operation-revision-log-jsonl-foundation
  ├─ B. wave5-authoring-package-document-adapter-foundation
  ├─ C. wave5-package-file-set-writer-foundation
  ├─ D. wave5-runtime-evidence-artifact-materializer
  └─ E. wave5-validation-report-artifact-materializer
       ↓ A/B/C/D/E pass
  ├─ F. wave5-persisted-operation-evidence-fixture
       ↓ F pass
  └─ G. wave5-integration-review-and-final-report
```

### 並列 group 1

`A` から `E` は同時起動できる。

| Domain | Main module | 独立性 |
|---|---|---|
| A | `operation-core` | revision / log JSONL のみを扱い、package writer に依存しない |
| B | `authoring-core` | session -> package document adapter のみを扱い、operation lifecycle に依存しない |
| C | `package-format` | package document -> file set / file set -> document のみを扱い、operation/runtime/validator schema に依存しない |
| D | `runtime-core` | runtime evidence generated artifact のみを扱い、package writer に依存しない |
| E | `validator-core` | validation report generated artifact のみを扱い、operation mutation に依存しない |

### serial group 2

`F` は `A/B/C/D/E` の public exports と completion reports を読んでから起動する。ここで初めて、operation commit、authoring package document conversion、file set writer、runtime artifacts、validation artifacts を結合する。

### final group

`G` は全 domain completion report と review report を読み、dependency guard、source organization、full verification を確認して final report を書く。

## 5. Domain A: `wave5-operation-revision-log-jsonl-foundation`

### Target

`operation-core` に package revision policy と operation log JSONL codec を追加する。

### Allowed write scope

- `packages/operation-core/src/**`
- `discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md`

### Forbidden write scope

- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `fixtures/**`
- `apps/**`
- `pnpm-lock.yaml`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル:
  - `package-revision.ts`
  - `operation-log-jsonl.ts`
  - `operation-log-jsonl.test.ts`
  - revision lifecycle tests in existing lifecycle test file or focused new file
- Commit success path increments `session.packageRevision` exactly once.
- Dry-run candidate revision is temporary and original session remains unchanged.
- JSONL codec round-trips `OperationLogEntryDto` through schema parse.
- JSONL codec rejects invalid lines and preserves one-entry-per-line semantics.

### Required tests

- commit success increments `session.packageRevision` and appends exactly one log entry.
- stale `basePackageRevision` is rejected before mutation/log append.
- dry-run leaves original `packageRevision` unchanged.
- provider receives candidate revision `basePackageRevision + 1` for dry-run / commit evidence.
- operation log JSONL serialize / parse roundtrip passes.

## 6. Domain B: `wave5-authoring-package-document-adapter-foundation`

### Target

`authoring-core` に `AuthoringSession` から `PackageDocumentDto` を再構成する adapter を追加する。

### Allowed write scope

- `packages/authoring-core/src/**`
- `discussion/implementation/waves/wave5/wave5-authoring-package-document-adapter-foundation-completion.md`

### Forbidden write scope

- `packages/operation-core/**`
- `packages/package-format/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `fixtures/**`
- `apps/**`
- `pnpm-lock.yaml`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル:
  - `to-package-document.ts`
  - `package-document-manifest.ts`
  - `package-document-model-files.ts`
  - `package-document-assets.ts`
  - `package-document-adapter.test.ts`
- Adapter は base `PackageDocumentDto` を受け取り、manifest metadata を保持しつつ session graph / revision / updatedAt を反映する。
- `PackageDocumentSchema.parse` を通る DTO を返す。
- Editor-only dirty state は model body へ混ぜない。`dirty` は save 後に caller が扱う session state であり package file には保存しない。

### Required tests

- `minimal-valid-package` 由来 session を document に戻せる。
- parameter 追加後の document に parameter / stable order / revision が反映される。
- base manifest の package ID、createdAt、schemaVersions、evaluatorVersions、rights/provenance summary が保持される。
- public barrel から adapter を import できる。

## 7. Domain C: `wave5-package-file-set-writer-foundation`

### Target

`package-format` に deterministic package file set serializer / parser を追加する。

### Allowed write scope

- `packages/package-format/src/**`
- `discussion/implementation/waves/wave5/wave5-package-file-set-writer-foundation-completion.md`

### Forbidden write scope

- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `fixtures/**`
- `apps/**`
- `pnpm-lock.yaml`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル:
  - `package-file-set.ts`
  - `package-file-paths.ts`
  - `package-json-serialization.ts`
  - `package-file-set.test.ts`
- `serializePackageDocumentToFileSet(document, options)` は manifest / model / assets を package-relative JSON text entries にする。
- `parsePackageDocumentFromFileSet(fileSet)` は required files を読み、`PackageDocumentSchema` で parse する。
- optional generated artifact entries と `operations/log.jsonl` text は path validation だけ行い、内容 schema は各 owner module に任せる。
- path traversal、absolute path、backslash path は拒否する。

### Required tests

- `minimal-valid-package` document を file set に展開し、同じ file set から document を再読込できる。
- required package paths が manifest と一致する。
- JSON serialization が deterministic で末尾 newline を持つ。
- unsafe path が拒否される。

## 8. Domain D: `wave5-runtime-evidence-artifact-materializer`

### Target

`runtime-core` に runtime evidence から generated runtime artifacts を作る helper を追加する。

### Allowed write scope

- `packages/runtime-core/src/**`
- `discussion/implementation/waves/wave5/wave5-runtime-evidence-artifact-materializer-completion.md`

### Forbidden write scope

- `packages/package-format/**`
- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/validator-core/**`
- `packages/contracts/**` unless an existing runtime-state sequence schema bug blocks materialization and Undine approves escalation
- `fixtures/**`
- `apps/**`
- `pnpm-lock.yaml`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル:
  - `runtime-evidence-artifacts.ts`
  - `runtime-snapshot-artifacts.ts`
  - `runtime-state-sequence-artifacts.ts`
  - `runtime-evidence-artifacts.test.ts`
- Generated artifact paths:
  - `runtime/snapshots/*.runtime-snapshot.json`
  - `runtime/states/*.runtime-state.json`
  - `runtime/state-sequences/*.runtime-state-sequence.json`
- `buildRuntimeEvidence` が返す refs と実際に materialize できる artifact set が一致する。
- sequence artifact を作れない場合は sequence ref を返さない。ref と artifact の不一致を残さない。
- package IO は行わない。

### Required tests

- runtime evidence から snapshot artifact、final state artifact を作れる。
- sequence evaluation では `states[0]` initial / `states[i + 1]` post-frame の sequence artifact を作れる。
- generated refs と artifact paths が一致する。
- `runtime-core` が package-format / authoring-core / operation-core / validator-core を import していない。

## 9. Domain E: `wave5-validation-report-artifact-materializer`

### Target

`validator-core` に validation report artifact materializer を追加する。

### Allowed write scope

- `packages/validator-core/src/**`
- `discussion/implementation/waves/wave5/wave5-validation-report-artifact-materializer-completion.md`

### Forbidden write scope

- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**` except reading public types already allowed by validator-core dependency
- `packages/package-format/**`
- `packages/contracts/**`
- `fixtures/**`
- `apps/**`
- `pnpm-lock.yaml`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル:
  - `validation-report-artifacts.ts`
  - `validation-report-artifacts.test.ts`
- `ValidationReportDto` から `validation/reports/<reportId>.validation.json` artifact を作る。
- `operationLogPath` は `operations/log.jsonl` を canonical path として扱える。
- JSON serialization は deterministic で schema parse 済み DTO を出力する。

### Required tests

- validation report artifact path が report ID と一致する。
- artifact content は `ValidationReportSchema` で parse できる。
- `operationLogPresent=true` の report が `operations/log.jsonl` を evidence path として保持できる。
- `validator-core` が authoring-core / operation-core / editor-ui / ai-interface を import していない。

## 10. Domain F: `wave5-persisted-operation-evidence-fixture`

### Target

createParameter commit から package file set persistence / reload / evidence artifact presence まで通る fixture を追加する。

### Dependencies

- Domain A pass
- Domain B pass
- Domain C pass
- Domain D pass
- Domain E pass

### Allowed write scope

- `fixtures/contracts/minimal-operation-persisted-package/**`
- `packages/operation-core/src/**/*.test.ts`
- `packages/package-format/src/**/*.test.ts`
- `packages/authoring-core/src/**/*.test.ts`
- `packages/runtime-core/src/**/*.test.ts`
- `packages/validator-core/src/**/*.test.ts`
- `discussion/implementation/waves/wave5/wave5-persisted-operation-evidence-fixture-completion.md`

### Forbidden write scope

- production source changes unless Undine approves a narrow integration fix.
- `packages/contracts/**`
- `apps/**`
- binary / proprietary / Cubism assets
- `pnpm-lock.yaml`

### Expected fixture coverage

- baseline package document from `minimal-valid-package` or a focused derived fixture.
- commit request for `createParameter`.
- expected package file set summary.
- expected operation log JSONL summary.
- expected runtime artifact summary.
- expected validation artifact summary.
- reload summary proving saved document includes new parameter and package revision.

### Required tests

- commit mutates session, increments package revision, and appends log.
- operation log JSONL parses back to the committed log entry.
- `AuthoringSession` converts to `PackageDocumentDto`.
- package file set writer serializes and parser reloads the document.
- runtime snapshot/state artifacts and validation report artifacts are included in generated file entries.
- reloaded document parses through package-format and preserves committed parameter / revision.

## 11. Domain G: `wave5-integration-review-and-final-report`

### Target

Wave 5 全体の integration review と final report を作成する。

### Allowed write scope

- package manifests の必要最小限の dependency adjustment
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave5/**`
- `discussion/implementation/reviews/wave5/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`

### Required verification

- `pnpm install`
- targeted tests:
  - `pnpm exec vitest run packages/operation-core/src packages/authoring-core/src packages/package-format/src packages/runtime-core/src packages/validator-core/src`
- `pnpm typecheck`
- `pnpm check:deps`
- `pnpm check:source`
- `pnpm check`
- forbidden import searches:
  - `package-format` has no `authoring-core` / `operation-core` / `runtime-core` / `validator-core` import.
  - `runtime-core` has no package IO / package-format / authoring-core / operation-core / validator-core import.
  - `operation-core` has no package-format / runtime-core / validator-core / GUI / AI / renderer / transport import.
  - `validator-core` has no authoring-core / operation-core / GUI / AI import.
- `git diff --check -- . ':!pnpm-lock.yaml'`

## 12. Subagent / Orch-Sylph execution policy

Wave 5 起動時、Undine は次の順で Orch-Sylph を投入する。

1. `A` / `B` / `C` / `D` / `E` を並列起動する。
2. それぞれが `pass` になるまで待機する。`needs_fix` は同 domain loop 内で解消する。
3. `F` を起動し、A-E の public API を統合 fixture で固定する。
4. clean context integration review を実施する。
5. final report と map を更新する。

Undine は起動済み subagent の処理を途中で打ち切らない。context interruption が避けられない場合でも、対象 domain を incomplete / blocked / escalated として記録し、wave gate を通さない。

## 13. Review lanes

各 domain は次の review lane を必須とする。

- Design / Development Compliance Review
- Test Adequacy Review

Review-Sylph には実装者の説明だけでなく、実際の差分、basis documents、verification result を渡す。

## 14. Wave 5 非目標

- editor-ui / viewer-ui / ai-interface の実装。
- OS filesystem writer、browser File System Access adapter、zip/archive writer。
- PSD parser / image parser / import adapter implementation。
- full operation catalog implementation。
- undo / redo implementation。
- migration framework implementation。
- HTTP / WebSocket / MCP adapter。
- Cubism SDK/Core、`.moc3`、`.model3.json`、`.cmo3` 等の読み込みや互換検証。

## 15. User decision points

Wave 5 起動前の user decision は原則不要。

ただし次の場合は Undine に戻してユーザー判断を求める。

- package revision policy を commit increment / dry-run temporary revision 以外にしたい。
- core package writer に OS filesystem IO を含める必要が出た。
- `package-format` が operation/runtime/validator schema を直接 import しないと成立しない。
- runtime state sequence artifact を materialize するために contracts schema 変更が必要。
- 新規 external dependency が必要。

## 16. Wave 5 pass criteria

Wave 5 は次を満たすと pass。

- Domain A-E が pass。
- Domain F の persisted operation evidence fixture が pass。
- Integration review が pass。
- final report が作成されている。
- full verification が pass。
- `index.ts` 肥大化が起きていない。
- committed operation から saved package file set と operation log JSONL が作れる。
- runtime / validation evidence refs と generated artifact paths が一致している。
- reloaded package document が committed package revision と新規 parameter を保持している。
