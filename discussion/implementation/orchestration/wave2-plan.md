# Wave 2 Plan: Package / Runtime / Validator Foundation

> 状態: Draft / 起動前計画
> 作成日: 2026-05-29
> 対象 wave: Wave 2
> Root coordinator: Undine
> 実行単位: 1 wave
> 主目的: Wave 1 の public contracts を入力として、package-format / runtime-core / validator-core の最小実装基盤と最小契約 fixture を作る。

## 1. Wave 2 の狙い

Wave 2 は UI、AI、operation-core の実装に入る前に、下流 module が共有する「保存パッケージ」「runtime 評価入口」「validator report 入口」を実装可能な状態へ進める。

この wave では次を完了条件にする。

- `package-format` が契約上の package DTO / file DTO を Zod で parse できる。
- `runtime-core` が `NormalizedRuntimeGraph`、初期 `RuntimeStateDto`、最小 runtime snapshot 生成 API を持つ。
- `validator-core` が package / runtime 入力を受け、`ValidationReportDto` を組み立てられる。
- `minimal-valid-package` 相当の最小 fixture / test oracle が存在し、3 module の結合が smoke test で通る。
- `index.ts` は barrel export に留め、実装責務は単一責務ファイルに分割する。

## 2. 上流ゲート

### Repository facts

- Wave 0 は monorepo scaffold / package skeleton / guard scripts を完了済み。
- Wave 1 は `packages/contracts` の contracts foundation を完了済み。
- Wave 1 final verification は `pnpm check`、contracts package test、dependency/source organization check が pass。
- 既存 package skeleton は `contracts`、`package-format`、`runtime-core`、`operation-core`、`validator-core`。
- `authoring-core`、`renderer-adapter`、`editor-ui`、`viewer-ui`、`ai-interface` の package skeleton は現時点では存在しない。

### Wave 2 start gate

Wave 2 は Wave 1 final report が pass であることを前提に開始する。

Basis:

- [../waves/wave1/wave1-final-report.md](../waves/wave1/wave1-final-report.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

## 3. 依存関係判断

### Dependency facts

`module-boundaries.md` による依存は次の通り。

| Module | 依存 | Wave 2 判断 |
|---|---|---|
| `package-format` | `contracts` | Wave 2 で最初に実装可能 |
| `runtime-core` | `contracts` | Wave 2 で最初に実装可能 |
| `validator-core` | `contracts`, `package-format`, `runtime-core` | package/runtime 完了後に実装 |
| `fixtures-contract-tests` | `contracts`, `package-format`, `runtime-core`, `validator-core` | validator 完了後に最小 fixture を作成 |
| `operation-core` | `contracts`, `authoring-core` | Wave 2 では起動しない |

### Design decision

Wave 2 は `package-format` と `runtime-core` を並列投入し、その成果を受けて `validator-core`、最後に最小 fixture / integration を投入する。

`operation-core` は Wave 2 では実装しない。理由は `authoring-core` 境界が未実装であり、operation 実装を先行すると mutation boundary が曖昧になるため。

## 4. 並列投入設計

```text
Wave 1 contracts pass
  ├─ A. wave2-package-format-foundation
  └─ B. wave2-runtime-core-foundation
       ↓ A/B pass
  ├─ C. wave2-validator-core-foundation
       ↓ C pass
  ├─ D. wave2-minimal-contract-fixture
       ↓ D pass
  └─ E. wave2-integration-review-and-final-report
```

### 並列 group 1

`A` と `B` は同時起動できる。

- 両者は `contracts` のみを implementation dependency とする。
- `runtime-core` は `package-format` を import してはならない。
- `package-format` は `runtime-core` を import してはならない。runtime graph 変換が必要な場合でも、Wave 2 では runtime-facing adapter を package-format 内へ抱え込まず、型境界を明確にして integration domain へエスカレーションする。

### serial group 2

`C` は `A/B` の completion report と public exports を読んでから起動する。

### serial group 3

`D` は `C` の validator report 出力が安定してから起動する。

### final group

`E` は全 domain completion report と review report を読み、public barrel、dependency guard、source organization、full verification を確認して final report を書く。

## 5. Domain A: `wave2-package-format-foundation`

### Target

`package-format` に package directory layout と package DTO schema の最小実装基盤を作る。

### Dependencies

- `packages/contracts`
- `zod`

`zod` は Wave 1 で approved dependency として導入済み。`package-format` が直接 Zod schema を所有する場合、package manifest と dependency registry の scope 更新が必要。

### Allowed write scope

- `packages/package-format/package.json`
- `packages/package-format/src/**`
- `packages/package-format/test/**` または責務に対応する `src/**/*.test.ts`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave2/**`
- `discussion/implementation/reviews/wave2/**`

### Forbidden write scope

- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/operation-core/**`
- `packages/contracts/**` unless early escape is approved
- `apps/**`
- proprietary / Cubism runtime or parser assets

### Required basis documents

- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

### Expected implementation shape

- `index.ts` は re-export のみ。
- schema family は責務別ファイルに分割する。
- 推奨ファイル例:
  - `package-manifest.ts`
  - `source-manifest.ts`
  - `model-graph.ts`
  - `model-files.ts`
  - `asset-metadata.ts`
  - `parse-result.ts`
  - `package-document.ts`
- Wave 2 では filesystem package reader / writer を完備しない。DTO parse と in-memory package document 組み立てを優先する。
- PSD parser、image parser、archive format は実装しない。

### Required tests

- mandatory file DTO schema が valid minimal object を parse できる。
- invalid schemaVersion / missing required field が fail する。
- split PNG fallback / generated fixture source asset kind を parse できる。
- `index.ts` が barrel として public export を提供する。

### Early escape triggers

- package DTO に contracts 側の未定義 primitive が必要になった。
- runtime graph 変換を `package-format` が所有すべきか判断が割れる。
- 新規 external dependency が必要になった。
- package reader/writer の filesystem IO が wave scope に入り始めた。

## 6. Domain B: `wave2-runtime-core-foundation`

### Target

`runtime-core` に runtime API、normalized graph 型、初期 runtime state、最小 snapshot 生成を実装する。

### Dependencies

- `packages/contracts`
- `zod`

`runtime-core` は `package-format` を import しない。

### Allowed write scope

- `packages/runtime-core/package.json`
- `packages/runtime-core/src/**`
- `packages/runtime-core/test/**` または責務に対応する `src/**/*.test.ts`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave2/**`
- `discussion/implementation/reviews/wave2/**`

### Forbidden write scope

- `packages/package-format/**`
- `packages/validator-core/**`
- `packages/operation-core/**`
- `packages/contracts/**` unless early escape is approved
- `apps/**`
- renderer / browser / WebGL implementation

### Required basis documents

- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

### Expected implementation shape

- `index.ts` は re-export のみ。
- runtime graph 型、evaluation input/options、state creation、snapshot assembly、comparison policy を責務別に分割する。
- 推奨ファイル例:
  - `normalized-runtime-graph.ts`
  - `runtime-input.ts`
  - `runtime-options.ts`
  - `initial-state.ts`
  - `snapshot.ts`
  - `runtime-core.ts`
  - `snapshot-comparison.ts`
- Wave 2 では full mesh deformation、grid interpolation、rig hierarchy、dynamics solver 完成を狙わない。
- ただし `createInitialRuntimeState` と `evaluateRuntimeSequence` の public shape は固定する。

### Required tests

- empty dynamics graph から initial `RuntimeStateDto` を生成できる。
- active dynamics group の initial state が group 数と identity を満たす。
- minimal graph から non-empty draw list snapshot を生成できる。
- package identity mismatch / hash unavailable など、実装した範囲の diagnostics が安定 ID で返る。
- `runtime-core` が `package-format` を import していない。

### Early escape triggers

- runtime snapshot schema が contracts の public exports から作れない。
- package DTO と runtime normalized graph の責務境界が曖昧になる。
- full evaluator 実装をしないと minimal snapshot test が成立しない。
- renderer adapter または package IO が必要になった。

## 7. Domain C: `wave2-validator-core-foundation`

### Target

`validator-core` に check catalog / validation profile / report builder / minimal package-runtime validation を実装する。

### Dependencies

- `packages/contracts`
- `packages/package-format`
- `packages/runtime-core`
- `zod`

### Allowed write scope

- `packages/validator-core/package.json`
- `packages/validator-core/src/**`
- `packages/validator-core/test/**` または責務に対応する `src/**/*.test.ts`
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave2/**`
- `discussion/implementation/reviews/wave2/**`

### Forbidden write scope

- `packages/package-format/**` except integration fix explicitly coordinated by Undine
- `packages/runtime-core/**` except integration fix explicitly coordinated by Undine
- `packages/operation-core/**`
- `packages/contracts/**` unless early escape is approved
- `apps/**`

### Required basis documents

- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

### Expected implementation shape

- `index.ts` は re-export のみ。
- check catalog、profile、summary aggregation、report builder、minimal validators を分割する。
- 推奨ファイル例:
  - `check-catalog.ts`
  - `validation-profile.ts`
  - `validation-summary.ts`
  - `validation-report.ts`
  - `report-builder.ts`
  - `validators/package-schema.ts`
  - `validators/runtime-load.ts`
- Wave 2 では全 check を実装しない。catalog と report DTO の安定化、minimal-valid-package の pass/fail 判定を優先する。
- repair candidate 自動生成は実装しない。schema / empty list handling までに留める。

### Required tests

- check catalog に主要 check ID が登録される。
- empty checks の summary が pass になる。
- blocking/error check を含む summary が fail になる。
- minimal package + minimal runtime snapshot から pass report を生成できる。
- invalid missing required file / empty draw list の代表 check が report に出る。

### Early escape triggers

- validator が package-format / runtime-core の private implementation details に依存し始めた。
- acceptance evidence / GUI operation log 実装が必要になった。
- repair candidate / operation-core 連携が wave scope に入り始めた。

## 8. Domain D: `wave2-minimal-contract-fixture`

### Target

3 module を結合する最小 fixture / contract test を作る。

### Dependencies

- Domain A pass
- Domain B pass
- Domain C pass

### Allowed write scope

- `fixtures/contracts/minimal-valid-package/**`
- `packages/package-format/src/**/*.test.ts`
- `packages/runtime-core/src/**/*.test.ts`
- `packages/validator-core/src/**/*.test.ts`
- `discussion/implementation/waves/wave2/**`
- `discussion/implementation/reviews/wave2/**`

### Forbidden write scope

- production logic changes unless Undine が integration fix として明示許可する。
- PSD binary assets.
- proprietary / Cubism assets or compatibility oracle.

### Required basis documents

- [../../design/module-contracts/fixtures-and-contract-tests.md](../../design/module-contracts/fixtures-and-contract-tests.md)
- [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)

### Expected implementation shape

- `minimal-valid-package` の fixture manifest と最小 package JSON 群を作る。
- runtime expected artifact は summary snapshot に留める。
- validation expected artifact は pass report に留める。
- exact binary equality より semantic JSON assertion を優先する。

### Required tests

- fixture package DTO が `package-format` で parse できる。
- fixture graph が `runtime-core` で summary snapshot 化できる。
- fixture が `validator-core` で pass report を返す。

### Early escape triggers

- fixture に rights-clean source art が必要になる。
- full PSD / PNG parser が必要になる。
- expected artifact の比較器設計が wave scope を超える。

## 9. Domain E: `wave2-integration-review-and-final-report`

### Target

Wave 2 全体の integration review と final report を作成する。

### Allowed write scope

- `packages/*/src/index.ts` barrel export 調整
- `package.json` / package manifests の必要最小限の dependency script 調整
- `generated/dependencies/dependency-registry.json`
- `discussion/implementation/waves/wave2/**`
- `discussion/implementation/reviews/wave2/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`

### Required verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm check:deps`
- `pnpm check:source`
- `pnpm check`
- targeted tests:
  - `pnpm exec vitest run packages/package-format/src packages/runtime-core/src packages/validator-core/src`
- `git diff --check -- . ':!pnpm-lock.yaml'`

### Integration review checklist

- `runtime-core` does not import `package-format`。
- `package-format` does not import `runtime-core`。
- `validator-core` imports public exports only。
- `index.ts` files are barrel-only or documented exceptions。
- source files are split by responsibility。
- no implementation domain used proprietary / Cubism oracle。
- dependency registry reflects direct runtime dependencies。
- reports and reviews are written under Wave 2 paths。

## 10. Subagent / Orch-Sylph execution policy

Wave 2 起動時、Undine は次の順で Orch-Sylph を投入する。

1. `wave2-package-format-foundation` と `wave2-runtime-core-foundation` を並列起動。
2. 両方が `pass` になるまで待機。`needs_fix` は同 domain loop 内で解消する。
3. `wave2-validator-core-foundation` を起動。
4. `wave2-minimal-contract-fixture` を起動。
5. Undine clean context integration review を実施。
6. final report を書く。

Undine は起動済み subagent の処理を途中で打ち切らない。context interruption が避けられない場合でも、対象 domain を incomplete / blocked / escalated として記録し、wave gate を通さない。

## 11. Review lanes

各 domain は次の review lane を必須とする。

- Design / Development Compliance Review
- Test Adequacy Review

Review-Sylph には実装者の説明だけでなく、実際の差分、basis documents、verification result を渡す。

## 12. Wave 2 非目標

- `operation-core` の mutation 実装。
- `authoring-core` 新規 package 導入。
- editor / viewer / renderer / AI interface 実装。
- PSD parser / PNG parser / archive reader の導入。
- Cubism SDK/Core、`.moc3`、`.model3.json`、`.cmo3` 等の読み込みや互換検証。
- full runtime evaluator 完成。
- full acceptance runner 完成。

## 13. User decision points

Wave 2 起動前の user decision は不要。

ただし次のいずれかが発生した場合は Undine に戻してユーザー判断を求める。

- `authoring-core` を Wave 2 で追加しないと進めない。
- 新規 external dependency が必要。
- package-format と runtime-core の責務境界が契約文書から一意に決められない。
- fixture に rights-clean binary asset が必要。
- contracts の public exports 変更が必要。

## 14. Wave 2 pass criteria

Wave 2 は次を満たすと pass。

- Domain A/B/C/D が pass。
- Integration review が pass。
- final report が作成されている。
- full verification が pass。
- `index.ts` 肥大化が起きていない。
- 次 wave が `operation-core` / `authoring-core` / UI のいずれを先に扱うべきか、final report に判断材料が残っている。
