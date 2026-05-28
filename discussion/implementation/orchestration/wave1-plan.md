# Wave 1 実装計画: contracts-foundation

> 状態: Draft for user review  
> 作成日: 2026-05-29  
> 主な対象: `packages/contracts`  
> 目的: 依存関係上の最上流である shared contracts を実装し、後続 wave の並列実装を安全にする

## 1. この計画の位置付け

Wave 1 は feature 実装ではない。

Wave 1 の目的は、`package-format`、`operation-core`、`runtime-core`、`validator-core`、GUI、AI、fixtures が共通して参照する ID / DTO / diagnostic / diff / runtime evidence contract を `packages/contracts` に実装することである。

依存関係上、最初に実装すべきドメインは `contracts-foundation` である。

理由:

- `module-boundaries.md` では `contracts` が全モジュールの最上流依存である。
- `typescript-contracts.md` は branded ID、共通 primitive、diagnostic、diff、runtime state / sequence artifact を定義している。
- 後続の `package-format`、`runtime-core`、`validator-core`、`operation-core` は、これらの型と Zod schema がないと安定して実装できない。
- `index.ts` 巨大化を避けるため、Wave 1 から責務別ファイル分割を実装単位にする必要がある。

## 2. Basis

### Orchestration basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `.codex/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave0-plan.md`
- `discussion/implementation/waves/wave0/integration-review.md`

### Design basis

- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`

### Development convention basis

- `discussion/development_convention/repository-structure-policy.md`
- `discussion/development_convention/module-boundary-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/review-and-pr-policy.md`
- `discussion/development_convention/subagent-workflow-policy.md`

## 3. Repository facts

- Wave 0 は 2026-05-28 に `pass`。
- `package.json`、`pnpm-workspace.yaml`、`tsconfig.json`、`vitest.config.ts` は存在する。
- `packages/contracts`、`packages/package-format`、`packages/runtime-core`、`packages/operation-core`、`packages/validator-core` の skeleton は存在する。
- `packages/contracts/src/index.ts` は現時点では barrel-only である。
- `generated/dependencies/dependency-registry.json` は存在する。
- 現時点の dependency registry には `zod` がまだ登録されていない。
- `typescript-contracts.md` の code sketch は Zod を前提にしているため、Wave 1 では Zod dependency gate が必要である。

## 4. Wave 1 の非目標

Wave 1 では実装しない:

- package file format read/write
- package normalization
- operation dry-run / commit / undo / redo
- runtime evaluation algorithm
- Minimum Open Dynamics v1 solver
- validator check registry / validation rules
- GUI / viewer
- AI command execution
- fixtures generation tool
- acceptance runner
- JSON Schema generator
- Cubism SDK/Core、Cubism parser、Live2D model loader

Wave 1 の成果物は `contracts` package の境界定義であり、後続 module の behavior 実装ではない。

## 5. 依存関係から見た実装順

### 結論

最初に実装する domain は `contracts-zod-and-core` とする。

この domain は次の 2 つを直列に扱う:

1. Zod dependency gate
2. branded ID / primitive / common enum の最小 contract 実装

Zod dependency gate を先に置く理由:

- `contracts` package の external DTO schema は Zod source of truth である。
- `zod` は runtime dependency として `packages/contracts` 側に必要になる。
- `dependency-policy.md` は dependency 追加前の registry / license / purpose evidence を要求している。
- root lockfile と dependency registry は共有ファイルなので、並列 domain に触らせると競合しやすい。

## 6. Orch-Sylph 並列性設計

Wave 1 は「全体としては contracts 1 package」だが、内部依存は段階式である。

したがって、最初から全 domain を並列化してはいけない。並列化できるのは、core ID / primitive が固まった後の一部だけである。

### 推奨 orchestration shape

```text
Undine L0
  -> Orch-Sylph: wave1-contracts-zod-and-core       # 直列、最初に実行
  -> Orch-Sylph: wave1-contracts-diagnostics        # core 後に parallel 可能
  -> Orch-Sylph: wave1-contracts-runtime-evidence   # core 後に parallel 可能
  -> Orch-Sylph: wave1-contracts-diff-envelopes     # diagnostics + runtime-evidence 後
  -> Orch-Sylph: wave1-contracts-integration        # 最後に index/export/test/report 統合
  -> Undine: wave integration review
```

### 並列化してよい範囲

`wave1-contracts-diagnostics` と `wave1-contracts-runtime-evidence` は、次の条件を守る場合に限り並列化してよい。

- どちらも `contracts-zod-and-core` 完了後に開始する。
- 書き込みファイルが重ならない。
- `src/index.ts` を編集しない。
- `package.json`、`pnpm-lock.yaml`、`generated/dependencies/dependency-registry.json` を編集しない。
- shared test fixture や integration test を編集しない。
- export の統合は `wave1-contracts-integration` に任せる。

### 並列化してはいけない範囲

次は直列にする。

- Zod dependency 追加
- `packages/contracts/package.json`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `packages/contracts/src/index.ts`
- cross-domain integration test
- Wave 1 completion / integration report

理由は、これらが共有状態または wave gate の判断点だからである。

## 7. Domain assignments

### 7.1 `wave1-contracts-zod-and-core`

#### 目的

Zod dependency を承認/evidence 化し、contracts package の最小基盤を作る。

#### 依存

- Wave 0 pass

#### Allowed write scope

- `packages/contracts/package.json`
- `packages/contracts/src/brand.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/primitives.ts`
- `packages/contracts/src/enums.ts`
- `packages/contracts/src/*core*.test.ts`
- `generated/dependencies/dependency-registry.json`
- `pnpm-lock.yaml`

#### Forbidden write scope

- `packages/contracts/src/index.ts`
- `packages/package-format/**`
- `packages/runtime-core/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `apps/**`
- `fixtures/**`
- `discussion/design/**`
- `discussion/acceptance-criteria/**`
- `discussion/scenarios/**`

#### 実装内容

- `Brand<T, BrandName>` helper
- branded ID type
- branded ID Zod schema
- finite number / vector / rect / transform DTO
- common enum のうち、後続 domain が必要とするもの
- ID prefix validation tests
- primitive schema tests
- dependency registry への `zod` 追加

#### 注意

`zod` の exact version は implementation 時に lockfile と registry に記録する。計画文書では固定しない。

### 7.2 `wave1-contracts-diagnostics`

#### 目的

validation report、runtime diff、AI repair などが共通利用する diagnostic vocabulary を実装する。

#### 依存

- `wave1-contracts-zod-and-core`

#### Allowed write scope

- `packages/contracts/src/check-id.ts`
- `packages/contracts/src/target-ref.ts`
- `packages/contracts/src/diagnostics.ts`
- `packages/contracts/src/diagnostics.test.ts`

#### 実装内容

- `CheckId`
- `CheckStatus`
- `Severity`
- `ValidationProfile`
- `TargetKind`
- `TargetRefDto`
- `DiagnosticDto`
- default array fields の parse tests
- invalid check ID tests

#### 並列性

`wave1-contracts-runtime-evidence` と並列可能。

### 7.3 `wave1-contracts-runtime-evidence`

#### 目的

runtime-core、validator-core、fixtures、acceptance runner が共有する runtime state / sequence evidence contract を実装する。

#### 依存

- `wave1-contracts-zod-and-core`

#### Allowed write scope

- `packages/contracts/src/runtime-state.ts`
- `packages/contracts/src/runtime-sequence.ts`
- `packages/contracts/src/runtime-artifact-refs.ts`
- `packages/contracts/src/runtime-evidence.test.ts`

#### 実装内容

- `RuntimeDynamicsGroupStateSchema`
- `RuntimeResetReasonSchema`
- `RuntimeSourceSurfaceSchema`
- `RuntimeEvaluationStrictnessSchema`
- `RuntimeStateArtifactRefSchema`
- `RuntimeStateSequenceArtifactRefSchema`
- `RuntimeStateDtoSchema`
- `RuntimeSequenceFrameSchema`
- `RuntimeEvaluationContextSchema`
- `RuntimeStateSequenceArtifactSchema`
- artifact ref path pattern tests
- default policy parse tests

#### 並列性

`wave1-contracts-diagnostics` と並列可能。

### 7.4 `wave1-contracts-diff-envelopes`

#### 目的

operation-core、AI、validator が共有する diff envelope を実装する。

#### 依存

- `wave1-contracts-diagnostics`
- `wave1-contracts-runtime-evidence`

#### Allowed write scope

- `packages/contracts/src/json-value.ts`
- `packages/contracts/src/field-change.ts`
- `packages/contracts/src/model-diff.ts`
- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/validation-diff.ts`
- `packages/contracts/src/diff-envelopes.test.ts`

#### 実装内容

- `JsonPointerSchema`
- recursive `JsonValueSchema`
- `FieldChangeDto`
- `ModelDiffDto`
- `RuntimeDiffDto`
- `ValidationDiffDto`
- schemaVersion literal tests
- default array tests

#### 並列性

直列。diagnostic と runtime evidence の両方に依存する。

### 7.5 `wave1-contracts-integration`

#### 目的

contracts package の public surface、tests、review evidence を統合する。

#### 依存

- Wave 1 の全実装 domain

#### Allowed write scope

- `packages/contracts/src/index.ts`
- `packages/contracts/src/package-info.ts`
- `packages/contracts/src/package-info.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `discussion/implementation/reviews/wave1/**`
- `discussion/implementation/waves/wave1/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`

#### 実装内容

- `index.ts` を barrel-only に保つ
- public export が期待どおり import できることを integration test で確認する
- Wave 1 completion report を書く
- Review-Sylph report を書く
- Wave 1 integration review を書く

#### 並列性

直列。最後に 1 domain として実施する。

## 8. File split recommendation

`packages/contracts/src/index.ts` は re-export のみ。

推奨ファイル:

```text
packages/contracts/src/
  brand.ts
  ids.ts
  primitives.ts
  enums.ts
  check-id.ts
  target-ref.ts
  diagnostics.ts
  runtime-artifact-refs.ts
  runtime-state.ts
  runtime-sequence.ts
  json-value.ts
  field-change.ts
  model-diff.ts
  runtime-diff.ts
  validation-diff.ts
  index.ts
```

禁止:

- `types.ts`
- `schemas.ts`
- `utils.ts`
- `helpers.ts`
- large `index.ts`
- すべての DTO / schema を 1 ファイルに詰め込む実装

## 9. Review strategy

各 domain は少なくとも次の 2 lane の review を受ける。

1. Design / Development Compliance Review
2. Test Adequacy Review

Review-Sylph には実装者の説明だけではなく、次を渡す。

- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- domain の changed files または diff
- 実行した verification summary

## 10. Verification

Wave 1 の completion gate では次を実行する。

```text
pnpm install
pnpm typecheck
pnpm test
pnpm test:unit
pnpm check:deps
pnpm check:source
pnpm check
```

加えて、contracts package の targeted test を実行する。

```text
pnpm exec vitest run packages/contracts/src
```

`pnpm install` が network / registry / approval で止まる場合は、Wave 1 を pass にしてはいけない。blocked command と理由を report に残す。

## 11. Expected reports

| Artifact | Path |
|---|---|
| Wave 1 plan | `discussion/implementation/orchestration/wave1-plan.md` |
| Domain review reports | `discussion/implementation/reviews/wave1/*.md` |
| Domain completion reports | `discussion/implementation/waves/wave1/*.md` |
| Integration review | `discussion/implementation/waves/wave1/integration-review.md` |
| Final Wave 1 report | `discussion/implementation/waves/wave1/wave1-final-report.md` |

Report 本文は日本語で書く。

## 12. Completion gate

Wave 1 は次を満たすまで pass ではない。

- `zod` dependency が registry / manifest / lockfile に記録されている。
- `packages/contracts` が `typescript-contracts.md` の Wave 1 対象 contract を実装している。
- `src/index.ts` が barrel-only である。
- catch-all source file がない。
- branded ID prefix validation tests がある。
- diagnostic / runtime evidence / diff envelope tests がある。
- `pnpm check` が pass している。
- `check:deps` が pass している。
- `check:source` が pass している。
- Review-Sylph report がある。
- integration review がある。
- 未解決の source conflict または user decision point がない。

## 13. Early escape

次の場合は Wave 1 を止めて Undine に返す。

- `zod` dependency の license / registry / install が承認できない。
- `typescript-contracts.md` と active development convention が矛盾する。
- `RuntimeEvaluationProfileSchema` の deprecated 扱いを実装でどう表現するかが blocking になる。
- `TargetRefDto.id` を generic string のままにするか discriminated typed union に変える必要が出る。
- sequence length semantics を `contracts` schema で refine すべきか、validator-core に委ねるべきかが blocking になる。
- domain が `packages/contracts` 以外の package behavior を実装し始める。
- `index.ts` または catch-all file が大きくなり始める。

## 14. 次の user decision 候補

現時点では Wave 1 開始前に必須の user decision はない。

ただし、実装中に次が blocking になった場合は確認が必要である。

- `RuntimeEvaluationProfileSchema` を legacy export として残すか、deprecated note のみとするか。
- `TargetRefDto.id` を generic string として実装するか、target kind ごとに typed ID union にするか。
- sequence length rule を Zod refine に入れるか、validator-core の diagnostic に委ねるか。
