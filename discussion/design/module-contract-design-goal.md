# Module Contract Design Goal

> 状態: Discussion note / goal preparation  
> 目的: 既存の MVP Authoring-to-Runtime Draft を、TypeScript + Web 実装に向けた contract-first module design へ具体化するためのゴールと必要粒度を記録する。

## 1. 背景

### 1.1 リポジトリ事実

- MVP は GUI Editor 必須の Authoring-to-Runtime 一周として定義されている。
- 技術スタックの第一候補は Web-first TypeScript として合意済みである。
- `discussion/design/mvp-authoring-runtime/` には、MVP縦切り、Open Model Package、GUI Editor、Runtime評価、Validator、AI Agent Interface の Draft 設計がある。
- 既存Draftは方向性、責務分担、論点整理としては有用だが、実装者がそのままモジュールを分担実装できるほどの TypeScript interface contract には落ちていない。

### 1.2 設計判断

- 既存Draftは破棄せず、次の contract-first 設計の入力として扱う。
- 次の設計フェーズのゴールは、抽象設計を増やすことではなく、サブエージェントが別モジュールを並列実装しても齟齬が発生しない interface contract を固定することである。
- TypeScript + Web が決まっているため、概念名だけではなく TypeScript の `type` / `interface` / public API / DTO / module boundary の粒度まで落とす。
- 設計成果物は、上位AC、シナリオ、参照レポートへのトレーサビリティを持つ必要がある。
- 各出力ファイルについて、出力構造、フォーマット、置き場所、読み手、検証方法を明示する必要がある。

## 2. なぜ module contract design が必要か

MVP実装は、規模と責務の性質からサブエージェント並列化される可能性が高い。

その場合、次が曖昧だと各エージェントが別々の前提で実装してしまう。

- module が所有する state
- module が知らないべき state
- module 間で受け渡す DTO
- stable ID の型と生成・参照規則
- operation request / response / diff / dry-run の形
- runtime evaluation input / output の形
- diagnostics / validation report の check ID と severity
- GUI state と runtime-visible state の境界
- file format と TypeScript contract の対応
- fixtures と contract tests の期待出力

したがって、次の `/goal` は「MVP実装」ではなく、まず「TypeScript module contract design」を目的にするべきである。

## 3. Contract-first 設計で決めるべき粒度

### 3.1 Module boundary

少なくとも次の module または package 境界を候補として定義する。

| Module | 主責務 | 境界で固定すべきもの |
|---|---|---|
| `contracts` | 全モジュール共有の型、ID、DTO、diagnostic語彙 | branded ID、DTO、snapshot、operation、report、diff |
| `package-format` | Open Model Package の読み書き、schema対応 | file layout、JSON DTO、loader input/output |
| `authoring-core` | GUI制作中の authoring graph と Editor-only state | authoring graph型、selection/lock/hide、dirty revision |
| `operation-core` | GUI/AI/migration/repair からの変更入口 | operation request/response、precondition、dry-run、commit、undo |
| `runtime-core` | normalized runtime graph の deterministic evaluation | evaluation input/output、snapshot、evaluator versions、epsilon policy |
| `validator-core` | schema/reference/semantic/runtime validation | check registry、profile、validation report |
| `renderer-adapter` | runtime snapshot の描画 | renderer input、texture binding、viewport state |
| `editor-ui` | GUI Editor の画面、操作、preview接続 | UI event -> operation mapping、test id、GUI evidence |
| `viewer-ui` | 保存済みpackageのruntime inspection | viewer state、parameter slider、snapshot表示 |
| `ai-interface` | AI dry-run、diff、repair candidate、revalidation | command schema、transport非依存API、approval boundary |
| `fixtures` / `contract-tests` | モジュール間契約の固定 | sample package、invalid package、expected report/snapshot |

モジュール名は実装時に変更してよいが、責務境界と公開contractは設計で固定する。

### 3.2 Shared TypeScript contracts

次の型は、設計段階で TypeScript の形まで落とす。

- branded stable IDs: `PackageId`, `DrawableId`, `MeshId`, `PartId`, `ParameterId`, `KeyformSetId`, `DeformerId`, `MaskRelationId`, `OperationId`, `ValidationReportId`, `RuntimeSnapshotId`
- Open Model Package DTO: manifest、graph、drawables、meshes、parameters、keyforms、deformers、masks、draw order、editor state、rights、provenance
- internal graph: `AuthoringGraph`, `NormalizedRuntimeGraph`
- runtime: `RuntimeEvaluationInput`, `RuntimeEvaluationOptions`, `RuntimeSnapshot`, `RuntimeDiagnostic`
- operations: `OperationRequest`, operation-specific payloads, `OperationResult`, `OperationDiff`, `DryRunResult`
- validation: `Diagnostic`, `CheckId`, `ValidationProfile`, `ValidationReport`, `RepairCandidate`
- diffs: `ModelDiff`, `RuntimeDiff`, `ValidationDiff`
- AI command: `AiCommandRequest`, `AiCommandResponse`, `AiDryRunCommand`, `AiRepairCandidate`

重要なのは、保存JSON DTO、内部状態、UI状態、runtime入力を同じ型で雑に共有しないことである。

### 3.3 DTO / internal state / UI state の分離

設計では次を別物として扱う。

| 種別 | 例 | 所有者 |
|---|---|---|
| package DTO | `model/drawables.json`, `model/deformers.json` | `package-format` |
| authoring state | dirty graph、編集中keyform、operation draft | `authoring-core` |
| Editor-only state | selection、lock、editor hide、active tool、overlay | `editor-ui` / `authoring-core` |
| normalized runtime graph | runtime評価用に解決済みのgraph | `runtime-core` input |
| runtime snapshot | evaluated drawable state、diagnostics、draw list | `runtime-core` output |
| validation report | check結果、evidence、repair candidate | `validator-core` |
| AI command DTO | dry-run request、diff response、approval metadata | `ai-interface` |

この分離がない場合、Editor-only state が Runtime / Viewer / Validator に混入し、MVPの設計原則を壊す。

### 3.4 Operation contract

`operation-core` は、GUI操作、AI structured command、migration、repair candidate適用の共通入口である。

次を operation ごとに固定する。

- operation type
- request payload
- target IDs
- preconditions
- validation before apply
- model mutation
- produced diagnostics
- operation log entry
- undo / redo policy
- dry-run result
- model diff / runtime diff / validation diff
- related AC / scenario

初期候補:

- `importSourceAsset`
- `createDrawable`
- `generateMesh`
- `moveMeshVertex`
- `createParameter`
- `addKeyform`
- `createRotation2dDeformer`
- `createWarpLattice2dDeformer`
- `bindDeformerChild`
- `setMaskRelation`
- `setDrawOrder`
- `setRuntimeVisibility`
- `setRightsMetadata`

### 3.5 Runtime evaluation contract

Runtime core は次のような純粋な境界を持つべきである。

```ts
evaluateRuntime(
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInput,
  options: RuntimeEvaluationOptions
): RuntimeSnapshot
```

設計で固定すること:

- `NormalizedRuntimeGraph` の最小型
- parameter override の形
- evaluation profile: `preview`, `viewer`, `validatorStrict`, `aiDryRun`
- snapshot detail: `summary`, `targeted`, `full`
- evaluator version policy
- epsilon policy
- deterministic comparison rule
- disabled future layers の表現
- diagnostics phase と severity

### 3.6 Validator and diagnostics contract

Validator は、Editor warning、Viewer diagnostics、AI-readable report、Acceptance Runner で語彙を共有する。

設計で固定すること:

- check ID registry の命名規則
- severity: `info`, `warning`, `error`, `blocking`
- status: `pass`, `warning`, `fail`, `needs_review`, `not_applicable`
- validation profile: editor incremental、viewer、strict、acceptance
- report JSON format
- repair candidate format
- check と AC / scenario の traceability

### 3.7 GUI / AI automation contract

Web-first GUI は、AI Agent が Playwright 等で検証できるように構造化された観測面を持つ必要がある。

設計で固定すること:

- UI event と operation type の対応
- canvas操作を operation payload へ変換する規則
- stable `data-testid` または role / label 命名規則
- GUI authoring evidence の記録形式
- AI dry-run 結果を表示する画面
- repair candidate 承認UIの境界

### 3.8 Fixtures and contract tests

サブエージェント並列実装の齟齬を減らすため、契約は fixture と expected output で固定する。

必要なfixture候補:

- minimal valid package
- basic tutorial-like package with eye / mouth / hair / face angle
- invalid missing texture package
- invalid deformer cycle package
- invalid mask reference package
- out-of-range parameter dry-run case
- AI repair candidate dry-run case

各fixtureには、期待される validation report、runtime snapshot、diff を対応付ける。

## 4. 上位トレーサビリティ

次の対応表を設計成果物に必ず含める。

| Trace target | 目的 |
|---|---|
| AC -> module contract | 各ACをどのmodule/API/type/testが満たすかを示す |
| Scenario -> operation flow | 各scenarioを実行するGUI操作、operation、runtime snapshot、validation reportを示す |
| Module -> public API | 各moduleが公開する関数・型・DTOを示す |
| File format -> TypeScript DTO | package内JSONとTS型の対応を示す |
| Diagnostic check -> AC / scenario | check IDがどのAC/シナリオを支えるかを示す |
| Fixture -> expected output | contract testで何を固定するかを示す |

トレーサビリティがない設計は、実装時に「なぜこの型・APIが必要なのか」を失いやすい。

## 5. 出力ファイル構造・フォーマットで決めること

次の `/goal` では、設計成果物ごとに次を必ず明示させる。

- file path
- reader / owner
- purpose
- status
- required sections
- expected tables
- expected code blocks
- traceability requirements
- update rule
- verification method

候補となる設計出力:

| File | Role |
|---|---|
| `module-boundaries.md` | module責務、所有state、禁止依存、public API一覧 |
| `typescript-contracts.md` | shared ID、DTO、graph、snapshot、diagnostic、diff のTS型案 |
| `package-file-format-contract.md` | package内JSONファイルとTS DTOの対応 |
| `operation-contracts.md` | operation request/response/precondition/diff/log entry |
| `runtime-core-contract.md` | runtime評価API、normalized graph、snapshot、evaluator version |
| `validator-contract.md` | check registry、profiles、report schema、repair candidate |
| `gui-operation-contract.md` | UI event -> operation mapping、screen state、test id、GUI evidence |
| `ai-command-contract.md` | AI command schema、dry-run、diff、approval、revalidation |
| `fixtures-and-contract-tests.md` | fixture一覧、expected snapshot/report/diff、contract test方針 |
| `traceability-matrix.md` | AC / scenario / module / API / fixture の対応 |

実際のファイル名と分割は次の設計作業で調整してよい。

## 6. 実装時にエージェントが混乱しやすい情報

次の情報は、実装 `/goal` の前に決めておくべきである。

- repository内の実装package配置と import path
- `contracts` を最初に作るか、設計文書だけで止めるか
- JSON Schema / Zod / TypeScript type のどれをsource of truthにするか
- ID生成方式と branded type の実装方針
- package DTO と internal graph の変換責務
- runtime numeric precision と epsilon policy
- coordinate system
- operation log entry の最小必須項目
- GUI authoring evidence の必須証拠
- validation check ID のregistry管理方法
- fixture命名と expected output の保存場所
- subagentごとのwrite ownership境界

これらを曖昧にしたまま並列実装すると、型は似ているが互換しないモジュールが増える。

## 7. 次の /goal に向けた論点

次の `/goal` 指示文を作る前に、少なくとも次を決める。

1. 設計成果物は文書のみか、`packages/contracts` の型スケッチまで作るか。
2. TypeScript contract のsource of truthを何にするか。
3. 既存 `mvp-authoring-runtime` Draftを上書き具体化するか、`module-contracts/` のような下位ディレクトリを作るか。
4. 出力ファイルのテンプレートを先に固定するか。
5. サブエージェントレビューを含める場合、何をレビュー基準にするか。

## 8. 現時点の推奨

現時点では、既存Draftを破棄せず、`discussion/design/mvp-authoring-runtime/` 配下に module contract 設計の下位成果物を追加するのがよい。

次の設計フェーズでは、上位ACとシナリオから逆算して、TypeScript module boundary、shared contracts、operation contract、runtime contract、validator contract、GUI operation contract、AI command contract、fixture / contract test を具体化する。

これにより、後続の実装 `/goal` では、module単位でサブエージェントへ安全に分担できる。
