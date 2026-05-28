# Wave 3 Plan: Authoring / Operation Foundation

> 状態: Draft / 起動前計画
> 作成日: 2026-05-29
> 対象 wave: Wave 3
> Root coordinator: Undine
> 実行単位: 1 wave
> 主目的: `authoring-core` 境界を実装として導入し、その上で `operation-core` の DTO / operation log / 最小 dry-run / commit lifecycle を作る。

## 1. Wave 3 の狙い

Wave 3 は GUI / AI 実装へ進む前に、すべての編集が通る mutation boundary を作る。

Wave 2 で `package-format` / `runtime-core` / `validator-core` の基盤はできた。次の blocker は、`operation-core` が前提にしている dirty `AuthoringGraph` と `AuthoringSession` がまだ存在しないこと。

この wave では次を完了条件にする。

- `packages/authoring-core` を導入し、package DTO から dirty authoring session を作れる。
- `operation-core` が operation DTO / request / result / log entry を Zod source of truth として公開する。
- `operation-core` が最小 operation subset を dry-run / commit でき、dry-run は session を変えず、commit は authoring revision と operation log を更新する。
- `minimal-operation-create-parameter` 相当の fixture / contract test で、operation boundary が通ることを確認する。
- `index.ts` は barrel export に留め、実装責務は単一責務ファイルに分割する。

## 2. 上流ゲート

### Repository facts

- Wave 0 は monorepo scaffold / package skeleton / guard scripts を完了済み。
- Wave 1 は `packages/contracts` の contracts foundation を完了済み。
- Wave 2 は `package-format` / `runtime-core` / `validator-core` foundation と `minimal-valid-package` fixture を完了済み。
- 既存 package skeleton は `contracts`、`package-format`、`runtime-core`、`operation-core`、`validator-core`。
- `packages/authoring-core` は現時点で存在しない。
- `pnpm-workspace.yaml` は `packages/*` を含むため、`packages/authoring-core` を追加すれば workspace package として扱える。

### Wave 3 start gate

Wave 3 は Wave 2 final report が pass であることを前提に開始する。

Basis:

- [../waves/wave2/wave2-final-report.md](../waves/wave2/wave2-final-report.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

## 3. 依存関係判断

### Dependency facts

| Module | 現状 | 依存 | Wave 3 判断 |
|---|---|---|---|
| `authoring-core` | package 未作成 | `contracts`, `package-format` DTOs | Wave 3 で最初に導入する |
| `operation-core` DTO / schemas | package skeleton のみ | `contracts`, `zod` | `authoring-core` と並列実装可能 |
| `operation-core` lifecycle | 未実装 | `contracts`, `authoring-core` | authoring-core + operation DTO 完了後に実装 |
| `editor-ui` / `ai-interface` | package 未作成 | `operation-core`, `runtime-core`, `validator-core` | Wave 3 では起動しない |
| `renderer-adapter` / `viewer-ui` | package 未作成 | `runtime-core` | Wave 3 では起動しない |

### Design decision

Wave 3 では `packages/authoring-core` を導入する。これは新しい要求ではなく、既存の module boundary と Wave 2 final report が示す blocker 解消である。

ただし Wave 3 では production `authoring-core -> runtime-core` dependency は導入しない。`AuthoringGraph` から `NormalizedRuntimeGraph` への adapter は設計上必要だが、現行の dependency graph は `authoring-core` の allowed dependency を `contracts` / `package-format` に閉じている。runtime graph adapter は後続 wave で境界を再確認して扱う。

Wave 3 の `operation-core` はまず model diff / operation log / authoring session mutation foundation に集中し、runtime snapshot / validation report generation は空配列または future integration hook に留める。

## 4. 並列投入設計

```text
Wave 2 pass
  ├─ A. wave3-authoring-core-session-foundation
  └─ B. wave3-operation-contract-dto-foundation
       ↓ A/B pass
  ├─ C. wave3-operation-lifecycle-foundation
       ↓ C pass
  ├─ D. wave3-minimal-operation-fixture
       ↓ D pass
  └─ E. wave3-integration-review-and-final-report
```

### 並列 group 1

`A` と `B` は同時起動できる。

- `authoring-core` は dirty authoring graph / session state を作る。
- `operation-core` DTO foundation は AuthoringGraph 実装に依存せず、operation request / result / log DTO を Zod と contracts から実装できる。
- 両 domain の write scope は `packages/authoring-core/**` と `packages/operation-core/**` で分離する。

### serial group 2

`C` は `A/B` の completion report と public exports を読んでから起動する。

`C` は `operation-core` lifecycle を実装し、必要な場合のみ `authoring-core` の public API への小さな統合 fix を Undine に報告してから行う。

### serial group 3

`D` は `C` の minimal dry-run / commit lifecycle が安定してから起動する。

### final group

`E` は全 domain completion report と review report を読み、public barrel、dependency guard、source organization、full verification を確認して final report を書く。

## 5. Domain A: `wave3-authoring-core-session-foundation`

### Target

`packages/authoring-core` を新設し、package DTO から dirty authoring session を作る最小基盤を実装する。

### Dependencies

- `packages/contracts`
- `packages/package-format`

`authoring-core` は Wave 3 では `runtime-core`、`operation-core`、`validator-core` を import しない。

### Allowed write scope

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/**`
- `packages/authoring-core/test/**` if needed
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`

### Forbidden write scope

- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `packages/package-format/**` unless early escape is approved
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md](../../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Wave 2 public exports from `packages/package-format/src/index.ts`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル例:
  - `authoring-graph.ts`
  - `authoring-session.ts`
  - `authoring-revision.ts`
  - `from-package-document.ts`
  - `graph-selectors.ts`
  - `authoring-mutations.ts`
  - `dependency-boundary.test.ts`
- `AuthoringSession` は package identity、package revision、authoring revision、dirty flag、authoring graph を持つ。
- `AuthoringGraph` は package DTO 由来の model-visible collections を保持する。
- mutation helper は最小限にし、operation lifecycle で必要な `createParameter` 相当を支えられる程度に留める。
- editor-only selection / lock / viewport / DOM state は実装しない。
- production `toRuntimeGraph` は Wave 3 では実装しない。必要なら future hook として型だけに留め、runtime-core import は避ける。

### Required tests

- `minimal-valid-package` fixture または in-memory package document から authoring session を作れる。
- session clone / dry-run 用 copy が元 session を mutate しない。
- minimal mutation helper が authoring revision / dirty flag を期待通り更新する。
- `authoring-core` が `runtime-core`、`operation-core`、`validator-core` を import していない。

### Early escape triggers

- `authoring-core` が `runtime-core` の `NormalizedRuntimeGraph` 型を import しないと進められない。
- package DTO から authoring graph への ownership が package-format と衝突する。
- editor-only state を authoring-core がどこまで所有するか判断が必要になる。
- 新規 external dependency が必要になる。

## 6. Domain B: `wave3-operation-contract-dto-foundation`

### Target

`operation-core` に operation catalog、payload schemas、request/result/log schemas を実装する。

### Dependencies

- `packages/contracts`
- `zod`

この domain は `authoring-core` を import しない。

### Allowed write scope

- `packages/operation-core/package.json`
- `packages/operation-core/src/**`
- `packages/operation-core/test/**` if needed
- `discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md`

### Forbidden write scope

- `packages/authoring-core/**`
- `packages/package-format/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../design/module-contracts/typescript-contracts.md](../../design/module-contracts/typescript-contracts.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Wave 1 public exports from `packages/contracts/src/index.ts`

### Expected implementation shape

- `index.ts` は re-export のみ。
- 推奨ファイル例:
  - `operation-type.ts`
  - `payloads/import-source.ts`
  - `payloads/model-edit.ts`
  - `payloads/dynamics.ts`
  - `payloads/rig-control.ts`
  - `operation-request.ts`
  - `operation-result.ts`
  - `operation-log-entry.ts`
  - `operation-precondition.ts`
- Large operation payload union を `index.ts` や単一 catch-all file に置かない。
- execution lifecycle は実装しない。DTO / schema / public export foundation に限定する。

### Required tests

- representative operation payloads が parse できる。
- `dryRunOperation` 用 request は `dryRun=true` を保持できる。
- operation result / log entry が required fields を parse できる。
- invalid operation type / invalid ID prefix が fail する。
- `index.ts` は barrel-only。

### Early escape triggers

- operation DTO が contracts に未実装の shared schema を必要とする。
- operation catalog が大きすぎて source organization policy に抵触しそうになる。
- operation execution logic がこの domain に入り始めた。

## 7. Domain C: `wave3-operation-lifecycle-foundation`

### Target

`operation-core` に最小 dry-run / commit lifecycle を実装する。

### Dependencies

- Domain A pass
- Domain B pass
- `packages/contracts`
- `packages/authoring-core`

Wave 3 の lifecycle は `runtime-core` / `validator-core` を直接呼ばない。runtime / validation artifacts は後続 integration hook として空配列または optional fields に留める。

### Allowed write scope

- `packages/operation-core/src/**`
- `packages/operation-core/test/**` if needed
- `packages/operation-core/package.json`
- `discussion/implementation/waves/wave3/wave3-operation-lifecycle-foundation-completion.md`

If an `authoring-core` public API gap blocks lifecycle implementation, report it to Undine. A narrow coordinated edit to `packages/authoring-core/src/**` may be approved inside this serial domain, but it must be documented in the completion report.

### Forbidden write scope

- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/contracts/**`
- `apps/**`
- `fixtures/**`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- Domain A/B completion reports

### Expected implementation shape

- 推奨ファイル例:
  - `operation-core.ts`
  - `operation-registry.ts`
  - `preconditions.ts`
  - `lifecycle/dry-run.ts`
  - `lifecycle/commit.ts`
  - `operation-log.ts`
  - `operations/create-parameter.ts`
- Minimal operation subset は `createParameter` を第一候補にする。
- `dryRunOperation` は cloned authoring session に適用し、元 session を mutate しない。
- `commitOperation` は authoring session を mutate し、operation log entry を返す。
- `modelDiff` は stable ID / operation ID を含む最小 diff を返す。
- `runtimeDiff` / `validationDiff` は Wave 3 では optional / empty のまま許容する。
- undo / redo は public shape だけ、または `not_implemented` / rejected result でよい。実装する場合も最小に留める。

### Required tests

- `createParameter` dry-run returns `status="dry_run"` and does not mutate original session.
- `createParameter` commit returns `status="committed"` and increments authoring revision / operation log.
- invalid request or duplicate parameter precondition rejects without mutation.
- operation log entry has operation ID, transaction ID, actor, surface, payload, result, target IDs, provenance ID.
- `operation-core` does not import GUI / AI / renderer packages.

### Early escape triggers

- operation lifecycle cannot be implemented without runtime graph adapter.
- operation result cannot be represented using existing contracts diff schemas.
- authoring-core public API needs broad redesign.
- operation log provenance fields require rights/provenance policy decision beyond current contract.

## 8. Domain D: `wave3-minimal-operation-fixture`

### Target

最小 operation fixture / contract test を追加し、authoring-core と operation-core の境界を検証する。

### Dependencies

- Domain C pass

### Allowed write scope

- `fixtures/contracts/minimal-operation-create-parameter/**`
- `packages/authoring-core/src/**/*.test.ts`
- `packages/operation-core/src/**/*.test.ts`
- `discussion/implementation/waves/wave3/wave3-minimal-operation-fixture-completion.md`

### Forbidden write scope

- production source changes unless Undine が integration fix として明示許可する。
- `packages/contracts/**`
- `packages/package-format/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `apps/**`
- binary / proprietary / Cubism assets
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`

### Required basis documents

- [../../design/module-contracts/fixtures-and-contract-tests.md](../../design/module-contracts/fixtures-and-contract-tests.md)
- [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- Domain C completion report

### Expected implementation shape

- Fixture should be text JSON only.
- Minimal fixture should include:
  - baseline package / authoring input reference;
  - operation request for `createParameter`;
  - expected dry-run result summary;
  - expected commit result / operation log summary;
  - expected model diff summary.
- Do not require GUI operation evidence yet. GUI evidence remains future editor-ui / acceptance scope.

### Required tests

- fixture request parses through operation-core DTOs.
- dry-run fixture does not mutate session.
- commit fixture mutates session and produces expected log/diff summary.

### Early escape triggers

- operation fixture needs GUI evidence to be meaningful.
- operation result requires runtime / validator artifact generation before lifecycle is stable.
- fixture format conflicts with existing fixture contract.

## 9. Domain E: `wave3-integration-review-and-final-report`

### Target

Wave 3 全体の integration review と final report を作成する。

### Allowed write scope

- `packages/*/src/index.ts` barrel export 調整
- `package.json` / package manifests の必要最小限の dependency script 調整
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave3/**`
- `discussion/implementation/reviews/wave3/**`
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
  - `pnpm exec vitest run packages/authoring-core/src packages/operation-core/src`
- boundary searches:
  - `authoring-core` has no `runtime-core` / `operation-core` / `validator-core` import.
  - `operation-core` has no GUI / AI / renderer import.
- `git diff --check -- . ':!pnpm-lock.yaml'`

### Integration review checklist

- `packages/authoring-core` exists and is included by workspace.
- `authoring-core` depends only on allowed package foundations.
- `operation-core` uses `authoring-core` as mutation boundary.
- dry-run does not mutate original authoring session.
- commit mutates only through authoring-core public API and produces operation log evidence.
- `index.ts` files are barrel-only or documented exceptions.
- source files are split by responsibility.
- dependency registry reflects direct runtime dependencies.

## 10. Subagent / Orch-Sylph execution policy

Wave 3 起動時、Undine は次の順で Orch-Sylph を投入する。

1. `wave3-authoring-core-session-foundation` と `wave3-operation-contract-dto-foundation` を並列起動。
2. 両方が `pass` になるまで待機。`needs_fix` は同 domain loop 内で解消する。
3. `wave3-operation-lifecycle-foundation` を起動。
4. `wave3-minimal-operation-fixture` を起動。
5. Undine clean context integration review を実施。
6. final report を書く。

Undine は起動済み subagent の処理を途中で打ち切らない。context interruption が避けられない場合でも、対象 domain を incomplete / blocked / escalated として記録し、wave gate を通さない。

## 11. Review lanes

各 domain は次の review lane を必須とする。

- Design / Development Compliance Review
- Test Adequacy Review

Review-Sylph には実装者の説明だけでなく、実際の差分、basis documents、verification result を渡す。

## 12. Wave 3 非目標

- editor-ui / viewer-ui / ai-interface の実装。
- GUI operation evidence generation。
- PSD parser / image parser / import adapter implementation。
- production package reader / writer。
- production authoring-to-runtime graph adapter。
- runtime snapshot / validation report generation inside operation-core。
- undo / redo の完全実装。
- HTTP / WebSocket / MCP adapter。
- Cubism SDK/Core、`.moc3`、`.model3.json`、`.cmo3` 等の読み込みや互換検証。

## 13. User decision points

Wave 3 起動前の user decision は不要。

ただし次のいずれかが発生した場合は Undine に戻してユーザー判断を求める。

- `authoring-core` が `runtime-core` を import しないと成立しない。
- `operation-core` の最小 lifecycle が runtime / validator artifact generation を必須にする。
- `AuthoringGraph` と package DTO の ownership が衝突する。
- operation log provenance semantics が現行契約から一意に決まらない。
- 新規 external dependency が必要。
- contracts の public exports 変更が必要。

## 14. Wave 3 pass criteria

Wave 3 は次を満たすと pass。

- Domain A/B/C/D が pass。
- Integration review が pass。
- final report が作成されている。
- full verification が pass。
- `index.ts` 肥大化が起きていない。
- `authoring-core` が dirty authoring graph owner として成立している。
- `operation-core` が mutation gateway として dry-run / commit の最小証拠を出せる。
- 次 wave が runtime adapter / richer operations / GUI foundation のどれを先に扱うべきか、final report に判断材料が残っている。
