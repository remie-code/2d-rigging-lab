# Wave 4 Plan: Runtime / Validation Evidence Integration

> 状態: Draft / 起動前計画  
> 作成日: 2026-05-29  
> 対象 wave: Wave 4  
> Root coordinator: Undine  
> 実行単位: 1 wave  
> 主目的: Wave 3 で作った authoring / operation mutation boundary に、runtime snapshot と validation report evidence を接続する。

## 1. Wave 4 の狙い

Wave 4 は GUI / AI 実装へ進む前に、operation result が model diff だけでなく runtime / validation evidence を返せる状態にする。

Wave 3 時点では `commitOperation` / `dryRunOperation` は authoring session を正しく mutate / clone できるが、`runtimeDiff`、`validationDiff`、runtime snapshot refs、validation report refs はまだ空である。GUI と AI は operation result を信頼して進むため、この wave では evidence 接続を先に固める。

この wave では次を完了条件にする。

- `AuthoringGraph` / `AuthoringSession` から `NormalizedRuntimeGraph` を作る production adapter がある。
- Runtime evidence helper が、runtime snapshot / final runtime state / runtime diff を生成できる。
- Validator evidence helper が、runtime snapshot を含む validation report と validation diff を生成できる。
- `operation-core` が evidence provider を通じて dry-run / commit result に runtime / validation evidence を載せられる。
- `createParameter` fixture か新規 fixture で、operation result から runtime / validation evidence まで通ることを確認する。
- `index.ts` は barrel export に留め、実装責務は単一責務ファイルに分割する。

## 2. 上流ゲート

### Repository facts

- Wave 0 は monorepo scaffold / package skeleton / guard scripts を完了済み。
- Wave 1 は `packages/contracts` foundation を完了済み。
- Wave 2 は `package-format` / `runtime-core` / `validator-core` foundation と `minimal-valid-package` fixture を完了済み。
- Wave 3 は `authoring-core`、`operation-core` DTO / lifecycle、`minimal-operation-create-parameter` fixture を完了済み。
- Wave 3 final report は、次 wave として authoring-to-runtime integration、runtime / validation evidence hook、package revision / operation log persistence の優先順位決定を推奨している。

### Wave 4 start gate

Wave 4 は Wave 3 final report が pass であることを前提に開始する。

Basis:

- [../waves/wave3/wave3-final-report.md](../waves/wave3/wave3-final-report.md)
- [../waves/wave3/integration-review.md](../waves/wave3/integration-review.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

## 3. 依存関係判断

### Dependency facts

| Module / concern | 現状 | 依存 | Wave 4 判断 |
|---|---|---|---|
| `authoring-core` runtime adapter | 未実装 | `authoring-core`, `runtime-core` type/API | Wave 4 で最初に導入する |
| runtime evidence helper | `runtime-core` foundation は存在 | `runtime-core`, `contracts` | adapter と並列実装可能 |
| validator evidence report / diff | `validator-core` foundation は存在 | `validator-core`, `contracts`, runtime snapshot DTO | adapter と並列実装可能 |
| operation evidence hook | 未実装 | Domain A/B/C, `operation-core` | A/B/C pass 後に実装 |
| runtime / validation evidence fixture | 未実装 | Domain D | D pass 後に実装 |
| editor-ui / ai-interface | 未実装 | operation result evidence | Wave 4 では起動しない |

### Design decision

Wave 4 では `AuthoringGraph` から `NormalizedRuntimeGraph` を作る adapter を production 実装として導入する。

Module boundary 文書には `authoring-core` の public API として `toRuntimeGraph` が記載されている一方、Wave 3 では dependency graph の不整合を避けるため production `authoring-core -> runtime-core` dependency を延期した。Wave 4 ではこの延期を解消し、次の狭いルールで進める。

- `authoring-core` は adapter 用に `runtime-core` の public type / graph shape へ依存してよい。
- `runtime-core` は `authoring-core` を import しない。
- `operation-core` は runtime / validator を直接所有しない。runtime / validation evidence は `OperationEvidenceProvider` などの provider 境界で注入する。
- provider の実装は fixture / integration test で `authoring-core` adapter、`runtime-core` evidence helper、`validator-core` report helper を接続して証明する。

この方針であれば、operation-core が GUI / AI / renderer / transport と結合せず、runtime / validator evidence を扱う足場だけを持てる。

## 4. 並列投入設計

```text
Wave 3 pass
  ├─ A. wave4-authoring-runtime-adapter-foundation
  ├─ B. wave4-runtime-evidence-helper-foundation
  └─ C. wave4-validator-evidence-report-foundation
       ↓ A/B/C pass
  ├─ D. wave4-operation-evidence-hook-foundation
       ↓ D pass
  ├─ E. wave4-runtime-validation-evidence-fixture
       ↓ E pass
  └─ F. wave4-integration-review-and-final-report
```

### 並列 group 1

`A`、`B`、`C` は同時起動できる。

- `A` は `authoring-core` の graph adapter を実装する。
- `B` は `runtime-core` の runtime snapshot / state / diff helper を実装する。
- `C` は `validator-core` の validation report / validation diff helper を実装する。
- write scope は `packages/authoring-core/**`、`packages/runtime-core/**`、`packages/validator-core/**` に分離する。

### serial group 2

`D` は `A/B/C` の completion report と public exports を読んでから起動する。

`D` は `operation-core` に evidence provider hook を追加し、既存 `dryRunOperation` / `commitOperation` の mutation semantics を壊さずに runtime / validation evidence を result に統合する。

### serial group 3

`E` は `D` の hook が安定してから起動し、fixture / contract test で integration evidence を固定する。

### final group

`F` は全 domain completion report と review report を読み、dependency guard、source organization、full verification を確認して final report を書く。

## 5. Domain A: `wave4-authoring-runtime-adapter-foundation`

### Target

`authoring-core` に `AuthoringSession` / `AuthoringGraph` から `NormalizedRuntimeGraph` を作る adapter を追加する。

### Dependencies

- `packages/authoring-core`
- `packages/runtime-core`
- `packages/contracts`
- `packages/package-format`

### Allowed write scope

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/**`
- `discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`

### Forbidden write scope

- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/package-format/**`
- `packages/runtime-core/**` except reading public types
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Wave 3 `authoring-core` completion / review reports

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル例:
  - `to-runtime-graph.ts`
  - `runtime-graph-parameters.ts`
  - `runtime-graph-drawables.ts`
  - `runtime-graph-dynamics.ts`
  - `runtime-graph-rig-controls.ts`
  - `runtime-graph-keyforms.ts`
  - `runtime-graph-adapter.test.ts`
- Adapter は package DTO 由来の authoring graph collections を `NormalizedRuntimeGraph` に変換する。
- Minimal fixture で存在する parameters / drawables / meshes / dynamics / masks / draw order を lossless に近い形で渡す。
- editor-only selection / lock / viewport / DOM state は runtime graph に入れない。
- `runtime-core` は `authoring-core` を import しない。

### Required tests

- `minimal-valid-package` 由来の authoring session から runtime graph を作れる。
- runtime graph の package identity、revision、parameters、drawables、draw order が期待通り。
- Adapter 経由の graph を `runtime-core` の `createInitialRuntimeState` / `evaluateRuntimeFrame` に渡せる。
- dependency boundary test を Wave 4 方針に更新し、`authoring-core -> runtime-core` は adapter 用に許容しつつ `operation-core` / `validator-core` は禁止する。

### Early escape triggers

- `authoring-core -> runtime-core` dependency が既存 guard / module boundary と矛盾して解消できない。
- Adapter が `package-format` の DTO ownership を奪う必要がある。
- Runtime graph conversion に runtime-core 側の型変更が広範に必要。
- 新規 external dependency が必要。

## 6. Domain B: `wave4-runtime-evidence-helper-foundation`

### Target

`runtime-core` に operation / validator / fixture が使える runtime evidence helper を追加する。

### Dependencies

- `packages/runtime-core`
- `packages/contracts`

この domain は `authoring-core`、`operation-core`、`validator-core` を import しない。

### Allowed write scope

- `packages/runtime-core/src/**`
- `discussion/implementation/waves/wave4/wave4-runtime-evidence-helper-foundation-completion.md`

### Forbidden write scope

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/package-format/**`
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/fixtures-and-contract-tests.md](../../design/module-contracts/fixtures-and-contract-tests.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Wave 2 runtime-core final reports

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル例:
  - `runtime-evidence.ts`
  - `runtime-evidence-defaults.ts`
  - `runtime-state-artifacts.ts`
  - `runtime-diff-builder.ts`
  - `runtime-evidence.test.ts`
- `NormalizedRuntimeGraph` から initial state、baseline snapshot、candidate snapshot、final state を作る helper を提供する。
- `compareRuntimeSnapshots` を利用し、`RuntimeDiffDto` を result に載せられる形にする。
- RuntimeState artifact refs / sequence refs は generated evidence refs として扱い、file IO は実装しない。
- Package file IO、editor state、renderer は扱わない。

### Required tests

- Minimal runtime graph から baseline / candidate snapshot と final state を作れる。
- Snapshot comparison から `RuntimeDiffDto` を生成できる。
- Runtime state refs は `RuntimeStateArtifactRefSchema` / `RuntimeStateSequenceArtifactRefSchema` に適合する。
- `runtime-core` が package-format / authoring-core / operation-core / validator-core を import していない。

### Early escape triggers

- runtime evidence helper が authoring graph を直接読む必要が出る。
- artifact ref generation に package writer / filesystem IO が必要になる。
- `RuntimeDiffSchema` が現状の snapshot comparison で表現できない。

## 7. Domain C: `wave4-validator-evidence-report-foundation`

### Target

`validator-core` に runtime snapshot evidence と validation diff を扱う最小 helper を追加する。

### Dependencies

- `packages/validator-core`
- `packages/runtime-core`
- `packages/package-format`
- `packages/contracts`

この domain は `authoring-core` / `operation-core` を import しない。

### Allowed write scope

- `packages/validator-core/src/**`
- `discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md`

### Forbidden write scope

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/runtime-core/**` except reading public DTOs/API
- `packages/package-format/**`
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Wave 2 validator-core final reports

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル例:
  - `validation-diff-builder.ts`
  - `runtime-evidence-report.ts`
  - `operation-evidence-report.ts`
  - `validators/runtime-evidence.ts`
  - `runtime-evidence-report.test.ts`
- Runtime snapshot IDs を validation report evidence に含められる。
- baseline / candidate validation report から `ValidationDiffDto` を生成できる。
- operation log presence を evidence として report に渡せる。
- Acceptance profile の GUI evidence full implementation は Wave 4 では扱わない。

### Required tests

- Runtime snapshot ありの validation report が evidence.runtimeSnapshotIds を保持する。
- baseline / candidate report から newFailures / resolvedFailures / severityChanges の最小 diff を生成できる。
- operation log present / absent の evidence flag を report に反映できる。
- `validator-core` が authoring-core / operation-core / editor-ui / ai-interface を import していない。

### Early escape triggers

- validation diff に contracts の schema 変更が必要。
- runtime evidence report が operation-core DTO を直接読む必要が出る。
- Acceptance profile の GUI evidence policy を決めないと進められない。

## 8. Domain D: `wave4-operation-evidence-hook-foundation`

### Target

`operation-core` に runtime / validation evidence provider hook を追加し、dry-run / commit result に evidence を統合する。

### Dependencies

- Domain A pass
- Domain B pass
- Domain C pass
- `packages/operation-core`
- `packages/authoring-core`
- `packages/contracts`

Production `operation-core` は `runtime-core` / `validator-core` を直接 import しない方針を基本とする。必要な runtime / validation evidence は provider interface で注入する。

### Allowed write scope

- `packages/operation-core/src/**`
- `packages/operation-core/package.json`
- `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`

If an `authoring-core` public API gap blocks package revision update or graph snapshot capture, report it to Undine. A narrow coordinated edit to `packages/authoring-core/src/**` may be approved inside this serial domain, but it must be documented in the completion report.

### Forbidden write scope

- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `packages/package-format/**`
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Domain A/B/C completion and review reports

### Expected implementation shape

- 推奨ファイル例:
  - `operation-evidence-provider.ts`
  - `operation-evidence-result.ts`
  - `lifecycle/evidence.ts`
  - `operation-revision.ts`
  - `operation-evidence.test.ts`
- Evidence provider は baseline / candidate authoring session、operation request、operation result、target IDs を入力にし、runtime diff、validation diff、generated runtime snapshot IDs、runtime state refs、validation report IDs、final runtime state を返す。
- `dryRunOperation` は original session を mutate せず、provider も clone/candidate を扱う。
- `commitOperation` は authoring mutation と operation log entry を維持し、commit 成功時に package revision update を扱う。
- Provider が未指定の場合は Wave 3 と同じ最小 behavior を保つ。
- Unsupported operation / precondition rejection は evidence provider を呼ばず、mutation もしない。

### Required tests

- Provider なしでは Wave 3 の dry-run / commit tests が引き続き pass。
- Provider ありの dry-run は runtimeDiff / validationDiff / generated refs を result に載せ、original session を mutate しない。
- Provider ありの commit は committed result と log entry に generated runtime snapshot IDs / validation report IDs を反映する。
- Duplicate parameter rejection は provider を呼ばず mutation もしない。
- `operation-core` production source が GUI / AI / renderer / transport を import していない。

### Early escape triggers

- operation result に evidence を載せるには contracts schema 変更が必要。
- provider 注入ではなく operation-core の direct runtime / validator dependency が不可避になる。
- package revision semantics が user decision なしに決まらない。
- operation log entry schema と generated evidence refs が矛盾する。

## 9. Domain E: `wave4-runtime-validation-evidence-fixture`

### Target

Runtime / validation evidence 付き operation fixture / contract test を追加し、A/B/C/D の integration を検証する。

### Dependencies

- Domain D pass

### Allowed write scope

- `fixtures/contracts/minimal-operation-runtime-evidence/**`
- `fixtures/contracts/minimal-operation-create-parameter/**` if extending existing fixture is cleaner
- `packages/authoring-core/src/**/*.test.ts`
- `packages/runtime-core/src/**/*.test.ts`
- `packages/validator-core/src/**/*.test.ts`
- `packages/operation-core/src/**/*.test.ts`
- `discussion/implementation/waves/wave4/wave4-runtime-validation-evidence-fixture-completion.md`

### Forbidden write scope

- production source changes unless Undine が integration fix として明示許可する。
- `packages/contracts/**`
- `packages/package-format/**`
- `apps/**`
- binary / proprietary / Cubism assets
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/fixtures-and-contract-tests.md](../../design/module-contracts/fixtures-and-contract-tests.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- Domain D completion report

### Expected implementation shape

- Fixture should be text JSON only.
- Minimal fixture should include:
  - baseline package / authoring input reference;
  - operation request for `createParameter`;
  - expected runtime snapshot summary;
  - expected validation report summary;
  - expected runtime diff / validation diff summary;
  - expected operation result evidence summary.
- Do not require GUI evidence yet. GUI evidence remains future editor-ui / acceptance scope.

### Required tests

- Fixture request parses through operation-core DTOs.
- Evidence provider wiring produces runtime snapshot IDs and validation report IDs.
- Dry-run fixture does not mutate original session and still returns runtime / validation evidence.
- Commit fixture mutates session, updates package revision semantics as defined in Domain D, appends log entry, and produces expected evidence summaries.

### Early escape triggers

- Runtime / validation evidence needs filesystem artifact writing to be meaningful.
- Operation result requires GUI evidence before runtime / validation evidence can be trusted.
- Fixture format conflicts with existing fixture contract.

## 10. Domain F: `wave4-integration-review-and-final-report`

### Target

Wave 4 全体の integration review と final report を作成する。

### Allowed write scope

- package manifests の必要最小限の dependency adjustment
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave4/**`
- `discussion/implementation/reviews/wave4/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`

### Required verification

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check:deps`
- `pnpm check:source`
- `pnpm check`
- targeted tests:
  - `pnpm exec vitest run packages/authoring-core/src packages/runtime-core/src packages/validator-core/src packages/operation-core/src`
- boundary searches:
  - `runtime-core` has no `authoring-core` / `operation-core` / `validator-core` import.
  - `validator-core` has no `authoring-core` / `operation-core` / GUI / AI import.
  - `operation-core` has no GUI / AI / renderer / transport import.
- `git diff --check -- . ':!pnpm-lock.yaml'`

### Integration review checklist

- `authoring-core` can produce `NormalizedRuntimeGraph` from `AuthoringSession`.
- `runtime-core` can produce snapshot / final state / runtime diff evidence from normalized graph.
- `validator-core` can produce validation report evidence and validation diff.
- `operation-core` keeps Wave 3 mutation semantics when provider is absent.
- `operation-core` includes runtime / validation evidence when provider is supplied.
- dry-run remains non-mutating.
- commit updates operation log and package revision semantics as defined in Domain D.
- `index.ts` files are barrel-only or documented exceptions.
- source files are split by responsibility.
- dependency registry and lockfile reflect direct runtime dependencies.

## 11. Subagent / Orch-Sylph execution policy

Wave 4 起動時、Undine は次の順で Orch-Sylph を投入する。

1. `wave4-authoring-runtime-adapter-foundation`、`wave4-runtime-evidence-helper-foundation`、`wave4-validator-evidence-report-foundation` を並列起動。
2. A/B/C が `pass` になるまで待機。`needs_fix` は同 domain loop 内で解消する。
3. `wave4-operation-evidence-hook-foundation` を起動。
4. `wave4-runtime-validation-evidence-fixture` を起動。
5. Undine clean context integration review を実施。
6. final report を書く。

Undine は起動済み subagent の処理を途中で打ち切らない。context interruption が避けられない場合でも、対象 domain を incomplete / blocked / escalated として記録し、wave gate を通さない。

## 12. Review lanes

各 domain は次の review lane を必須とする。

- Design / Development Compliance Review
- Test Adequacy Review

Review-Sylph には実装者の説明だけでなく、実際の差分、basis documents、verification result を渡す。

## 13. Wave 4 非目標

- editor-ui / viewer-ui / ai-interface の実装。
- GUI operation evidence generation。
- PSD parser / image parser / import adapter implementation。
- production package reader / writer / archive writer。
- operation log JSONL filesystem persistence。
- full operation catalog implementation。
- full keyform / rig control / mesh evaluator implementation。
- HTTP / WebSocket / MCP adapter。
- Cubism SDK/Core、`.moc3`、`.model3.json`、`.cmo3` 等の読み込みや互換検証。

## 14. User decision points

Wave 4 起動前の user decision は原則不要。

ただし次のいずれかが発生した場合は Undine に戻してユーザー判断を求める。

- `authoring-core -> runtime-core` の狭い dependency では adapter が成立しない。
- operation-core が runtime-core / validator-core を直接 import しないと evidence hook が成立しない。
- `OperationResultSchema` / `OperationLogEntrySchema` の contracts 変更が必要。
- package revision update の意味論が current plan だけでは決められない。
- runtime / validation evidence に filesystem artifact writing が必須になる。
- 新規 external dependency が必要。

## 15. Wave 4 pass criteria

Wave 4 は次を満たすと pass。

- Domain A/B/C/D/E が pass。
- Integration review が pass。
- final report が作成されている。
- full verification が pass。
- `index.ts` 肥大化が起きていない。
- authoring session から runtime snapshot / validation report evidence まで接続されている。
- dry-run は non-mutating のまま runtime / validation evidence を返せる。
- commit は operation log と evidence refs を返せる。
- GUI / AI 実装が operation result evidence を前提に進められる判断材料が final report に残っている。
