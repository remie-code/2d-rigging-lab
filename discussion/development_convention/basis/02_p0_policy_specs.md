# Development Convention Basis: P0 Policy Specs

## Status

Draft

## Purpose

この文書は、実装開始前に必須となる P0 開発規約ドキュメントについて、各規約が必ず決めるべき内容、必ず含めるべき Mermaid 図、必ず含めるべき表、必要な証拠、レビュー観点を定義する。

この文書は、各開発規約本文そのものではない。
各規約を作成するための **出力仕様** である。

---

## Scope

この文書は、以下の P0 開発規約を対象とする。

```text
discussion/development_convention/source-of-truth-policy.md
discussion/development_convention/repository-structure-policy.md
discussion/development_convention/module-boundary-policy.md
discussion/development_convention/schema-and-id-conventions.md
discussion/development_convention/runtime-and-dynamics-implementation-policy.md
discussion/development_convention/operation-policy.md
discussion/development_convention/testing-and-acceptance-policy.md
discussion/development_convention/diagnostic-policy.md
discussion/development_convention/implementation-orchestration-policy.md
```

P0 規約は、core 実装に入る前に Accepted にする。
P0 規約が Draft のままの場合、その規約が対象とする module の実装は開始しない。

---

## Common Requirements for All P0 Policies

すべての P0 規約は、`discussion/development_convention/basis/01_common_policy_template.md` の共通テンプレートに従う。

各規約は、最低限以下を含む。

* Status
* Purpose
* Scope
* Source Documents
* Required Decisions
* Required Diagrams
* Required Tables
* Rules
* Forbidden
* Required Evidence
* Review Checklist
* Conflict Handling
* Change Process
* Completion Gate

また、以下を必ず守る。

* Cubism SDK/Core、Cubism Viewer、Cubism Editor挙動、Cubism形式、Cubism Physics互換を implementation / test / acceptance oracle にしない。
* machine-readable ID に空白を使わない。
* MVP acceptance に関わる判断は、必ず evidence artifact によって確認できるようにする。
* 矛盾は黙って補完せず、Conflict Resolution Log に記録する。
* Clean Context Review を実施できるように、成果物だけで判断可能な情報を残す。

---

# 1. Source of Truth Policy

## Output Path

```text
discussion/development_convention/source-of-truth-policy.md
```

## Purpose

Source of Truth Policy は、実装者、サブエージェント、レビュワーが、どの文書を正本として扱うかを定義する。

この規約は、以下を防ぐ。

* AC / Scenario / Module Contract / Test Design の矛盾を実装者が勝手に補完すること。
* review memo の未反映事項を実装正本として扱うこと。
* historical research reports を implementation oracle にすること。
* Cubism関連資料を runtime / validator / test の正解として扱うこと。
* サブエージェントごとに異なる文書を正として実装すること。

## Required Decisions

### DEC-SOT-001: Source document categories

以下の文書カテゴリを定義する。

* AC / Scenario
* Module Contract
* Test Design
* Development Convention
* Review Memo / Fix Summary
* Research Reports
* Demo / Proposal documents

各カテゴリについて、以下を決める。

* 何を定義する文書か。
* 実装時にどのように参照するか。
* implementation oracle にしてよいか。
* acceptance oracle にしてよいか。
* 矛盾時にどう扱うか。

### DEC-SOT-002: Source of truth priority model

単純な上下順位ではなく、文書ごとの責務を明確化する。

最低限、次を定義する。

```text
AC / Scenario:
  要求・受け入れ条件の正本。

Module Contract:
  DTO / API / module boundary / runtime semantics の正本。

Test Design:
  fixture / expected artifact / acceptance evidence の正本。

Development Convention:
  作業方法、module責任、review gate、禁止事項の正本。

Review Memo:
  判断履歴。Accepted designへ反映されるまでは補助資料。

Research Reports:
  historical / risk review / capability observation。実装正本ではない。
```

### DEC-SOT-003: Conflict handling

矛盾が見つかった場合に、実装者が独自判断で処理してよいかを決める。

必須方針:

* 実装者・サブエージェントは、文書間矛盾を黙って補完してはならない。
* 矛盾は Conflict Resolution Log に記録する。
* blocking conflict は実装を止める。
* 修正後にどの文書が正本になったかを明記する。

### DEC-SOT-004: Review memo handling

`memo/gpt-5.5-pro-review/*.md` の扱いを決める。

最低限、以下を明記する。

* review memo は判断履歴であり、直接の実装正本ではない。
* review memo による決定は、accepted design / contract / test design / development policy に反映されて初めて実装正本になる。
* fix summary は反映確認の補助資料である。

### DEC-SOT-005: Research report handling

`discussion/reports/**` の扱いを決める。

必須方針:

* implementation oracle にしない。
* Cubism挙動の再現目標にしない。
* runtime / validator / test expected output の正解にしない。
* private research archive としてのみ扱う。

### DEC-SOT-006: Conflict Resolution Log location

Conflict Resolution Log をどこに置くかを決める。

候補:

```text
discussion/development_convention/conflicts/conflict-resolution-log.md
```

または各規約内に section として持つ。

どちらを採用するか、運用を決める。

## Required Mermaid Diagrams

### Diagram 1: Source of Truth Relationship

#### Mermaid type

```text
graph TD
```

#### Purpose

AC / Scenario / Module Contract / Test Design / Development Convention / Review Memo / Research Report の関係を示す。

#### Must include

* AC / Scenario
* Module Contract
* Test Design
* Development Convention
* Review Memo
* Research Reports
* Implementation
* Acceptance Runner

#### Must show

* AC / Scenario は要求の正本。
* Module Contract は実装契約の正本。
* Test Design は証明方法の正本。
* Review Memo は Accepted design へ反映されるまでは補助資料。
* Research Reports は implementation oracle ではない。

### Diagram 2: Conflict Resolution Flow

#### Mermaid type

```text
flowchart TD
```

#### Purpose

矛盾発見から解決までの流れを示す。

#### Must include

* conflict detected
* classify severity
* create conflict log entry
* identify affected documents
* resolve decision
* update source documents
* clean context review
* close conflict

## Required Tables

### Table 1: Source Document Responsibility Table

必須列:

| Column            | Meaning                    |
| ----------------- | -------------------------- |
| Document category | AC, contract, test design等 |
| Defines           | 何を定義するか                    |
| Used by           | 実装者、validator、runner等      |
| Can be oracle     | yes/no                     |
| Conflict handling | 矛盾時の扱い                     |

### Table 2: Conflict Severity Table

必須列:

| Column                      | Meaning                         |
| --------------------------- | ------------------------------- |
| Severity                    | blocking / warning / suggestion |
| Meaning                     | 影響                              |
| Required action             | 必要対応                            |
| Can implementation continue | yes/no                          |

### Table 3: Non-oracle Sources Table

必須列:

| Source | Why not oracle | Allowed usage |
| ------ | -------------- | ------------- |

## Required Evidence

* Conflict Resolution Log
* source document update history
* clean context review result
* accepted policy status

## Review Checklist

### Blocking

* [ ] Research reports が implementation oracle になっていない。
* [ ] Cubism関連資料が runtime / validator / test oracle になっていない。
* [ ] 矛盾処理が Conflict Resolution Log に定義されている。
* [ ] 文書カテゴリごとの責務が定義されている。

---

# 2. Repository Structure Policy

## Output Path

```text
discussion/development_convention/repository-structure-policy.md
```

## Purpose

Repository Structure Policy は、monorepo 内の物理構造、package分割、generated artifact配置、fixture配置、test runner配置を定義する。

この規約は、以下を防ぐ。

* schema / runtime / validator / tests が別々の前提で発展すること。
* generated evidence と authored source が混ざること。
* サブエージェントが必要な関連文書・tools・fixturesを見られないこと。
* module境界がrepository構成上曖昧になること。

## Required Decisions

### DEC-REPO-001: Monorepo topology

monorepo 採用は固定とする。

規約本文では、以下を必ず明記する。

* monorepo を採用する。
* 理由は、エージェント開発時に schema、runtime、validator、fixtures、tests、docs、generated evidence を同一workspaceで扱うため。
* multi-repo は採用しない。
* 実装開始前に workspace root から参照できるべき主要pathを定義する。

### DEC-REPO-002: Top-level directory layout

最低限、以下のtop-level directoryをどう配置するか決める。

```text
apps/
packages/
fixtures/
generated/
discussion/
tools/
scripts/
```

必要に応じて以下も検討する。

```text
tests/
docs/
memo/
```

### DEC-REPO-003: Apps layout

以下をどこに置くか決める。

* Editor app
* Viewer app
* developer preview app
* demo-safe capture tool

候補例:

```text
apps/editor/
apps/viewer/
apps/devtools/
```

### DEC-REPO-004: Packages layout

以下のpackageをどう分けるか決める。

* schema
* package-format
* operation-core
* runtime-core
* validator
* ai-command
* gui-core
* fixture-tools
* acceptance-runner
* demo-safe tools

候補例:

```text
packages/schema/
packages/operation-core/
packages/runtime-core/
packages/validator/
packages/ai-command/
packages/gui-core/
packages/fixture-tools/
packages/acceptance-runner/
```

### DEC-REPO-005: Fixture placement

fixtureの配置を決める。

最低限、以下を定義する。

* source fixture
* package fixture
* invalid fixture
* runtime fixture
* dynamics sequence fixture
* GUI evidence fixture
* AI dry-run fixture
* demo-safe fixture
* rights/provenance fixture

### DEC-REPO-006: Generated artifact placement

generated artifact の配置を決める。

最低限、以下を区別する。

```text
generated/runtime/snapshots/
generated/runtime/states/
generated/runtime/state-sequences/
generated/validation/
generated/diffs/
generated/gui-evidence/
generated/ai/
generated/demo-safe/
generated/acceptance/
```

また、package内部に存在する `runtime/states/` 等が authored source ではなく generated evidence であることも明記する。

### DEC-REPO-007: Discussion and design document placement

`discussion/` は設計・AC・Scenario・test design・development conventionの正本として扱う。

規約本文では、実装コードから `discussion/` を直接runtime dependencyにしないことを明記する。

### DEC-REPO-008: Tool visibility for agents

エージェント作業を前提として、以下を決める。

* エージェントが参照すべき文書path
* エージェントが編集してよいpath
* 生成物の出力path
* cross-module変更時の更新対象

## Required Mermaid Diagrams

### Diagram 1: Monorepo Layout

#### Mermaid type

```text
graph TD
```

#### Must include

* apps
* packages
* fixtures
* generated
* discussion
* tools/scripts
* memo

### Diagram 2: Generated Artifact Placement

#### Mermaid type

```text
graph TD
```

#### Must include

* runtime snapshots
* runtime states
* runtime state sequences
* validation reports
* diffs
* GUI evidence
* AI dry-run evidence
* demo-safe preflight reports
* acceptance runner results

### Diagram 3: Workspace Visibility for Agents

#### Mermaid type

```text
flowchart TD
```

#### Must include

* agent
* discussion documents
* packages
* fixtures
* generated artifacts
* review output

## Required Tables

### Table 1: Top-level Directory Responsibility Table

必須列:

| Directory | Purpose | Authored / Generated | Owner | Notes |
| --------- | ------- | -------------------- | ----- | ----- |

### Table 2: Package Responsibility Table

必須列:

| Package | Responsibility | May depend on | Must not depend on |
| ------- | -------------- | ------------- | ------------------ |

### Table 3: Generated Artifact Table

必須列:

| Artifact type | Path | Producer | Consumer | Authored source? |
| ------------- | ---- | -------- | -------- | ---------------- |

## Required Evidence

* repository layout document
* generated artifact policy
* package responsibility table

## Review Checklist

### Blocking

* [ ] monorepo前提が明記されている。
* [ ] generated artifact と authored source が分離されている。
* [ ] RuntimeState / RuntimeStateSequence の配置が定義されている。
* [ ] Cubism SDK/Core依存を入れる場所が存在しない。

---

# 3. Module Boundary Policy

## Output Path

```text
discussion/development_convention/module-boundary-policy.md
```

## Purpose

Module Boundary Policy は、各moduleの責務、依存方向、禁止依存、mutation境界を定義する。

この規約は、以下を防ぐ。

* Runtime Core が GUI に依存すること。
* Validator が GUI やAI assistantに依存すること。
* GUI / AI が Operation Core を通さず package を直接変更すること。
* schema定義が各moduleに重複すること。
* module cycle が発生すること。

## Required Decisions

### DEC-MODULE-001: Module list

P0時点で存在するmoduleを定義する。

最低限:

* schema
* package-format
* operation-core
* runtime-core
* validator
* ai-command
* gui-core
* editor app
* viewer app
* fixture-tools
* acceptance-runner
* demo-safe tools

### DEC-MODULE-002: Module responsibilities

各moduleの責務を決める。

例:

```text
runtime-core:
  NormalizedRuntimeGraph、RuntimeSequenceFrameDto、RuntimeStateDto、RuntimeEvaluationContextDtoを受け取り、RuntimeSnapshotDtoとnext RuntimeStateDtoを返す。

operation-core:
  package mutationの唯一の入口。

validator:
  package / runtime / evidence artifact を検査し、ValidationReportを返す。
```

### DEC-MODULE-003: Dependency direction

module間の依存方向を決める。

必ず定義する。

* allowed dependencies
* forbidden dependencies
* dependency cycle禁止
* schema packageの扱い

### DEC-MODULE-004: Runtime Core isolation

Runtime Core が以下に依存しないことを定義する。

* GUI
* filesystem
* Cubism SDK/Core
* Cubism Viewer
* AI assistant
* editor app

### DEC-MODULE-005: Operation mutation boundary

すべての package mutation は Operation Core 経由にする。

定義する。

* GUI mutation flow
* AI dry-run mutation flow
* validator repair candidate flow
* direct JSON mutation禁止

### DEC-MODULE-006: AI boundary

AI assistantが直接実行してよいこと、してはいけないことを定義する。

最低限:

* AI may inspect
* AI may propose dry-run operation
* AI must not commit without human approval
* AI must not mutate package directly

### DEC-MODULE-007: Acceptance runner boundary

Acceptance Runner がどのmoduleを呼ぶかを決める。

* fixture loader
* operation-core
* runtime-core
* validator
* demo-safe preflight
* AI dry-run interface
* evidence collector

## Required Mermaid Diagrams

### Diagram 1: Module Dependency DAG

#### Mermaid type

```text
graph TD
```

#### Must include

* schema
* operation-core
* runtime-core
* validator
* gui-core
* editor
* viewer
* ai-command
* fixture-tools
* acceptance-runner

#### Must show

* allowed dependency direction
* no cycles

### Diagram 2: Forbidden Dependency Diagram

#### Mermaid type

```text
graph TD
```

#### Must include forbidden edges

* runtime-core --> gui
* runtime-core --> Cubism SDK/Core
* AI --> direct package mutation
* GUI --> direct package mutation
* validator --> GUI

### Diagram 3: Mutation Boundary Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* GUI
* AI assistant
* Operation Core
* dry-run
* diff
* approval
* commit
* operation log

## Required Tables

### Table 1: Module Responsibility Table

| Module | Responsibility | Inputs | Outputs |
| ------ | -------------- | ------ | ------- |

### Table 2: Allowed Dependency Table

| From | May depend on | Reason |
| ---- | ------------- | ------ |

### Table 3: Forbidden Dependency Table

| From | Must not depend on | Reason | Violation |
| ---- | ------------------ | ------ | --------- |

### Table 4: Mutation Boundary Table

| Actor | May mutate package directly? | Required path |
| ----- | ---------------------------- | ------------- |

## Required Evidence

* module dependency diagram
* mutation operation log
* dependency check result
* clean context compliance review

## Review Checklist

### Blocking

* [ ] Runtime Core が GUI に依存していない。
* [ ] Runtime Core が Cubism SDK/Core に依存していない。
* [ ] GUI / AI が Operation Core を通さず mutationしていない。
* [ ] schema定義がmoduleごとに重複していない。
* [ ] module dependency cycle がない。

---

# 4. Schema and ID Conventions

## Output Path

```text
discussion/development_convention/schema-and-id-conventions.md
```

## Purpose

Schema and ID Conventions は、DTO、schema、enum、diagnostic ID、fixture ID、Test ID、artifact ref、machine-readable ID の命名・構造規約を定義する。

この規約は、以下を防ぐ。

* `rig control` のような空白入りID。
* DTO名とSchema名のズレ。
* artifact ref pathと例示pathの矛盾。
* check IDがschemaに通らないこと。
* Test ID / Fixture ID / Diagnostic IDの命名ばらつき。
* formal / candidate diagnostic の混同。

## Required Decisions

### DEC-SCHEMA-001: DTO and Schema naming

DTOとZod schemaの命名規則を決める。

例:

```text
RuntimeStateDto
RuntimeStateDtoSchema
RuntimeStateArtifactRefSchema
```

### DEC-SCHEMA-002: Machine-readable ID naming

machine-readable IDに空白を禁止する。

必ず定義する。

* camelCase
* kebab-case
* dot-separated check ID
* artifact path
* enum value

例:

```text
rigControl
runtime.stateSequenceLengthMismatch
invalid-rigControl-cycle
```

禁止例:

```text
rig control
runtime state sequence mismatch
invalid-rig control-cycle
```

### DEC-SCHEMA-003: Diagnostic ID convention

diagnostic ID の形式を決める。

例:

```text
runtime.stateSequenceLengthMismatch
dynamics.outputTargetDuplicate
demo.unsafeForbiddenTerm
```

formal / candidate classification との関係も定義する。

### DEC-SCHEMA-004: Test ID convention

Test ID の命名を決める。

例:

```text
TC-DYN-MISSING-DRIVER-001
TC-DEMO-UNSAFE-FORBIDDEN-TERM-001
```

### DEC-SCHEMA-005: Fixture ID convention

Fixture ID の命名を決める。

例:

```text
minimal-dynamics-hairSway
invalid-dynamics-missing-driver
demo-unsafe-forbidden-term
```

### DEC-SCHEMA-006: Artifact ref convention

artifact ref のpath規則を決める。

必ず含める。

```text
runtime/states/*.runtime-state.json
runtime/state-sequences/*.runtime-state-sequence.json
runtime/snapshots/*.runtime-snapshot.json
```

### DEC-SCHEMA-007: RuntimeState sequence semantics

RuntimeStateSequenceArtifact の命名・意味論をschema規約として明記する。

必須:

* `states[0] = initial state`
* `states[i + 1] = post-frame state`
* `states.length = frameCount + 1`

### DEC-SCHEMA-008: Deprecated schema handling

deprecated / legacy schema をどう扱うか決める。

例:

* `RuntimeEvaluationProfileSchema`
* legacy profile
* `runtime.profileMismatch`

## Required Mermaid Diagrams

### Diagram 1: Schema Ownership Flow

#### Mermaid type

```text
graph TD
```

#### Must include

* schema package
* runtime-core
* operation-core
* validator
* AI command
* tests

#### Must show

* schema source of truth
* consumers

### Diagram 2: Artifact Reference Structure

#### Mermaid type

```text
graph TD
```

#### Must include

* RuntimeStateArtifactRef
* RuntimeStateSequenceArtifactRef
* RuntimeSnapshotRef
* ValidationReportRef
* DiffRef

## Required Tables

### Table 1: ID Naming Table

| ID type | Format | Example | Forbidden example |
| ------- | ------ | ------- | ----------------- |

### Table 2: Artifact Ref Table

| Artifact | Path pattern | Points to | Generated? |
| -------- | ------------ | --------- | ---------- |

### Table 3: Deprecated Schema Table

| Deprecated schema | Replacement | Removal condition |
| ----------------- | ----------- | ----------------- |

## Required Evidence

* schema tests
* artifact ref validation tests
* ID scan result
* convention compliance review

## Review Checklist

### Blocking

* [ ] machine-readable IDに空白がない。
* [ ] artifact ref pathと例示pathが一致している。
* [ ] RuntimeState sequence semantics が明記されている。
* [ ] deprecated schemaが新規contractで使われていない。

---

# 5. Runtime and Dynamics Implementation Policy

## Output Path

```text
discussion/development_convention/runtime-and-dynamics-implementation-policy.md
```

## Purpose

Runtime and Dynamics Implementation Policy は、Runtime Core、Minimum Open Dynamics v1、RuntimeState、RuntimeSnapshot、RuntimeStateSequence、deterministic replay の実装規約を定義する。

この規約は、以下を防ぐ。

* hidden mutable runtime state。
* Dynamicsの非決定的挙動。
* final stateだけの不十分なreplay検証。
* Dynamicsがmesh vertexを直接書き換える誤実装。
* Runtime CoreがGUIやfilesystemに依存すること。
* Cubism Physics互換を目標にすること。

## Required Decisions

### DEC-RUNTIME-001: Runtime Core API

以下を定義する。

* `createInitialRuntimeState`
* `evaluateRuntimeFrame`
* `evaluateRuntimeSequence`

### DEC-RUNTIME-002: Explicit RuntimeState

Runtime Core は hidden mutable state を持たない。

必須:

* previous RuntimeStateDto を入力
* next RuntimeStateDto を出力
* RuntimeState artifact を generated evidence として扱う

### DEC-RUNTIME-003: RuntimeState sequence semantics

必須:

* `states[0] = initial state`
* `states[i + 1] = post-frame state`
* `states.length = frameCount + 1`

### DEC-RUNTIME-004: Minimum Open Dynamics v1 scope

Dynamicsの範囲を定義する。

含める:

* driver parameter
* weighted sum
* scalarDampedFollowV1
* computed output parameter
* fixed timestep

含めない:

* direct vertex physics
* cloth simulation
* collision
* IK
* Cubism Physics互換
* `.physics3.json`

### DEC-RUNTIME-005: Parameter layers

以下を定義する。

* authoredParameterValues
* computedParameterValues
* effectiveParameterValues

### DEC-RUNTIME-006: Deterministic replay

exact deterministic replay のpass条件を定義する。

必須:

* full RuntimeState sequence comparison
* `inputFramesHash`
* `runtimeEvaluationContext`
* `evaluatorVersionSummary`
* epsilon policy

### DEC-RUNTIME-007: RuntimeEvaluationContext

runtime evaluation mode の正本を定義する。

必須:

* source.surface
* source.operationId
* policy.strictness
* `policy.default({})`

## Required Mermaid Diagrams

### Diagram 1: Runtime Evaluation Pipeline

#### Mermaid type

```text
flowchart TD
```

#### Must include

* authored parameter
* Minimum Open Dynamics v1
* computed parameter
* effective parameter
* keyform
* parameter-grid
* rigControl
* mesh deformation
* draw list

### Diagram 2: RuntimeState Sequence

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* initial state
* frame 0
* state 1
* frame 1
* state 2
* final state

### Diagram 3: Dynamics Dataflow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* driver parameter
* weighted sum
* scalarDampedFollowV1
* output clamp
* computed output parameter

## Required Tables

### Table 1: Runtime API Table

| API | Input | Output | State handling |
| --- | ----- | ------ | -------------- |

### Table 2: Parameter Layer Table

| Layer | Producer | Consumer | Mutable by |
| ----- | -------- | -------- | ---------- |

### Table 3: Dynamics Scope Table

| Feature | MVP? | Reason |
| ------- | ---- | ------ |

### Table 4: Replay Evidence Table

| Evidence | Required for exact replay? | Notes |
| -------- | -------------------------- | ----- |

## Required Evidence

* RuntimeSnapshotDto
* RuntimeStateDto
* RuntimeStateSequenceArtifact
* RuntimeDiff
* deterministic replay result
* validation report

## Review Checklist

### Blocking

* [ ] Runtime Core が hidden mutable state を持っていない。
* [ ] exact replay が full state sequence を比較している。
* [ ] Dynamics が direct vertex physics を実装していない。
* [ ] Runtime Core が Cubism Physics互換をoracleにしていない。

---

# 6. Operation Policy

## Output Path

```text
discussion/development_convention/operation-policy.md
```

## Purpose

Operation Policy は、GUI、AI、validator repair、test fixture が model package を変更する際の唯一のmutation経路を定義する。

この規約は、以下を防ぐ。

* GUIがpackage JSONを直接変更すること。
* AIがhuman approvalなしにcommitすること。
* dry-runとcommitの境界が曖昧になること。
* operation logが不足し、変更理由を追えないこと。

## Required Decisions

### DEC-OP-001: Operation Core as mutation gateway

すべての model package mutation は Operation Core を通る。

### DEC-OP-002: Dry-run / commit boundary

以下を定義する。

* dry-run operation
* committed operation
* model diff
* runtime diff
* validation diff
* approval required

### DEC-OP-003: AI operation boundary

AI assistantの操作を定義する。

必須:

* AI may propose
* AI may dry-run
* AI must not commit without approval
* AI must not mutate package directly

### DEC-OP-004: Operation log

operation log の必須項目を決める。

必須候補:

* operationId
* actor
* surface
* target
* payload
* dryRun
* before / after revision
* generated evidence refs

### DEC-OP-005: Runtime sequence operation

`runDynamicsPreviewSequence` など、package mutationではないruntime/evidence operationの扱いを決める。

### DEC-OP-006: Undo / redo

MVPで扱うか、Post-MVPにするかを決める。

## Required Mermaid Diagrams

### Diagram 1: Operation Mutation Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* GUI
* AI
* Operation Core
* dry-run
* diff
* human approval
* commit
* operation log

### Diagram 2: AI Dry-run Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* AI request
* proposed operation
* dry-run
* diff
* validation
* approval boundary

## Required Tables

### Table 1: Operation Type Table

| Operation type | Mutates package? | Requires approval? | Evidence |
| -------------- | ---------------- | ------------------ | -------- |

### Table 2: Actor Permission Table

| Actor | May dry-run | May commit | Conditions |
| ----- | ----------- | ---------- | ---------- |

### Table 3: Operation Result Artifact Table

| Artifact | Produced by | Required? |
| -------- | ----------- | --------- |

## Required Evidence

* operation log
* model diff
* runtime diff
* validation diff
* AI dry-run response
* approval evidence

## Review Checklist

### Blocking

* [ ] GUIがOperation Coreを通さずmutationしていない。
* [ ] AIがapprovalなしにcommitしていない。
* [ ] dry-runとcommitが区別されている。
* [ ] operation evidenceが残っている。

---

# 7. Testing and Acceptance Policy

## Output Path

```text
discussion/development_convention/testing-and-acceptance-policy.md
```

## Purpose

Testing and Acceptance Policy は、テスト実装、fixture、expected artifact、acceptance runner、review gate、E2E、clean context review の運用規約を定義する。

この規約は、以下を防ぐ。

* テストなしで実装が進むこと。
* fixtureが存在してもTest IDに接続されないこと。
* final stateだけでexact deterministic replayを通すこと。
* candidate diagnosticだけでMVP blocking testを判定すること。
* 実装者の意図に依存したレビューになること。

## Required Decisions

### DEC-TEST-001: Test implementation is mandatory

実装PRには対応テストを必須とする。

### DEC-TEST-002: Test design source

`discussion/tests/**` をテスト設計の正本として扱う。

### DEC-TEST-003: Acceptance runner

Acceptance Runner の責務を定義する。

必須:

* fixture loading
* operation flow
* runtime evaluation
* validator
* diff
* demo-safe preflight
* AC result aggregation

### DEC-TEST-004: MVP blocking fixture handling

必須:

* `mvp-blocking` fixture はTest IDに接続される。
* 未接続なら非blockingへ下げるか、traceabilityを修正する。

### DEC-TEST-005: Exact deterministic replay

必須:

* full RuntimeState sequence comparison
* inputFramesHash
* runtimeEvaluationContext
* evaluatorVersionSummary
* epsilon policy

### DEC-TEST-006: Clean Context Test Review

Clean Context Reviewer による Test Adequacy Review を必須化する。

定義:

```text
作業担当者の会話文脈を共有していない別サブエージェントが、正本文書と成果物だけを根拠にレビューする。
```

### DEC-TEST-007: Development Compliance Review

開発規約準拠レビューを必須化する。

### DEC-TEST-008: E2E test category

E2Eテストを開発規約上のカテゴリとして定義する。

## Required Mermaid Diagrams

### Diagram 1: Acceptance Runner Pipeline

#### Mermaid type

```text
flowchart TD
```

#### Must include

* fixture
* operation flow
* package
* validator
* runtime snapshot
* runtime state sequence
* diff
* evidence
* AC result

### Diagram 2: Test Evidence Graph

#### Mermaid type

```text
graph LR
```

#### Must include

* AC
* Scenario
* Test ID
* Fixture
* Expected Artifact
* Oracle
* Acceptance Result

### Diagram 3: Review Gate Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* implementation
* automated tests
* Test Adequacy Review
* Development Compliance Review
* merge / reject

### Diagram 4: E2E Journey Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* Editor
* Operation Core
* Runtime Core
* Validator
* Viewer
* Acceptance Runner

## Required Tables

### Table 1: Test Profile Matrix

| Profile | Runs | Blocking? |
| ------- | ---- | --------- |

### Table 2: Evidence Requirement Table

| Test type | Required evidence |
| --------- | ----------------- |

### Table 3: Review Requirement Table

| Review | Reviewer | Required for |
|---|---|

### Table 4: E2E Test Table

| E2E ID | Journey | Evidence | Blocking |
|---|---|---|

## Required Evidence

* test results
* acceptance runner result
* runtime state sequence
* validation report
* GUI evidence
* AI dry-run evidence
* demo-safe preflight
* Test Adequacy Review
* Development Compliance Review

## Review Checklist

### Blocking

* [ ] 実装に対応するテストがある。
* [ ] `mvp-blocking` fixture がTest IDに接続されている。
* [ ] exact replay が全state sequenceを比較している。
* [ ] Clean Context Test Review がある。
* [ ] Development Compliance Review がある。
* [ ] Cubism関連oracleを使っていない。

---

# 8. Diagnostic Policy

## Output Path

```text
discussion/development_convention/diagnostic-policy.md
```

## Purpose

Diagnostic Policy は、validator diagnostic、formal / candidate 分類、severity、profile別扱い、MVP blocking testとの関係を定義する。

この規約は、以下を防ぐ。

* MVP blocking testがcandidate diagnosticだけに依存すること。
* diagnostic IDがschemaに合わないこと。
* severityやprofile挙動が不明なこと。
* validator contractとtest oracleがズレること。

## Required Decisions

### DEC-DIAG-001: Formal vs candidate diagnostics

diagnosticを以下に分類する。

```text
formal:
  validator contractに存在し、acceptance oracleとして使える。

candidate:
  将来候補。MVP blocking oracleとして単独使用しない。
```

### DEC-DIAG-002: Diagnostic ID format

diagnostic ID形式を定義する。

例:

```text
runtime.stateSequenceLengthMismatch
dynamics.outputTargetDuplicate
demo.unsafeForbiddenTerm
```

### DEC-DIAG-003: Severity model

以下を定義する。

* info
* warning
* error
* fail / blocking

### DEC-DIAG-004: Profile-specific behavior

interactive / strict / acceptance / demoSafe での扱いを定義する。

### DEC-DIAG-005: Candidate promotion process

candidate diagnostic を formal に昇格する手順を定義する。

### DEC-DIAG-006: Diagnostic as test oracle

MVP blocking testが参照してよいdiagnostic条件を定義する。

必須:

* formal diagnostic
* または explicit expected artifact

## Required Mermaid Diagrams

### Diagram 1: Diagnostic Lifecycle

#### Mermaid type

```text
stateDiagram-v2
```

#### Must include

* candidate
* formal
* deprecated
* removed

### Diagram 2: Diagnostic Use in Acceptance

#### Mermaid type

```text
flowchart TD
```

#### Must include

* validator diagnostic
* formal registry
* Test ID
* acceptance result

## Required Tables

### Table 1: Diagnostic Registry Table

| Diagnostic ID | Formal/Candidate | Severity | Profile behavior |
| ------------- | ---------------- | -------- | ---------------- |

### Table 2: Candidate Promotion Table

| Step | Requirement |
| ---- | ----------- |

### Table 3: Profile Severity Matrix

| Diagnostic | interactive | strict | acceptance | demoSafe |
| ---------- | ----------- | ------ | ---------- | -------- |

## Required Evidence

* validation report
* diagnostic registry
* acceptance runner result
* formal/candidate classification
* validator contract update record

## Review Checklist

### Blocking

* [ ] MVP blocking testがcandidate diagnosticだけに依存していない。
* [ ] formal diagnosticがvalidator contractに存在する。
* [ ] diagnostic IDが命名規約に従っている。
* [ ] profile別挙動が定義されている。

---

# 9. Implementation Orchestration Policy

## Output Path

```text
discussion/development_convention/implementation-orchestration-policy.md
```

## Purpose

Implementation Orchestration Policy は、実装フェーズで `/goal` を Undine と見なし、wave計画、domain cycle、subagent実装、two-lane review、fix loop、early escape、Integrator review、永続レポートを定義する。

この規約は、以下を防ぐ。

* `/goal` が全体オーケストレーター責務を持たないまま実装が始まること。
* Wave 0 を飛ばしてfeature実装へ入ること。
* Gnome実装、Review-Sylphレビュー、Integrator統合の責務が混ざること。
* Test Adequacy Review と Design / Development Compliance Review が混同されること。
* Clean Context Review をreview laneとして誤解すること。
* review report、domain completion report、integration review、final report が永続化されないこと。
* source-of-truth conflict、module boundary不明、test oracle不明、Cubism oracle圧力を早期脱出せず実装で補完すること。

## Required Decisions

### DEC-ORCH-001: `/goal` as Undine

`/goal` をL0オーケストレーターとして定義する。

### DEC-ORCH-002: Wave 0 development environment setup

Wave 0 を、feature implementation前の必須環境構築waveとして定義する。

### DEC-ORCH-003: Agent roles

Undine、Orch-Sylph、Gnome、Review-Sylph、Clean Context Review-Sylph、Integrator のroleを定義する。

### DEC-ORCH-004: Wave planning

dependency graph、wave list、domains、expected modified paths、required tests、required evidence、early escape risks、integration gate を含むwave planを定義する。

### DEC-ORCH-005: Orch-Sylph domain cycle

context collection、Gnome implementation、test execution、Review-Sylph two-lane review、fix loop、domain completion report のcycleを定義する。

### DEC-ORCH-006: Two-lane Review-Sylph model

Design / Development Compliance Review と Test Adequacy Review を分離する。
Design / Development Compliance Review は、Development Compliance Review に AC / Scenario / Module Contract への設計適合確認を加えたreview laneである。
Test Adequacy Review は、Review and PR Policy と同じ意味で使う。
Clean Context Review はreview laneではなく、作業担当者の会話文脈を共有しないreview execution modeである。

### DEC-ORCH-007: Loop control

fix loop の default max loop、max loop、差分が減らない場合の停止条件、Escalated扱いを定義する。

### DEC-ORCH-008: Early escape conditions

source-of-truth conflict、missing source of truth、multiple valid interpretations、module boundary unclear、test oracle unclear、candidate diagnostic only oracle、Operation Core bypass pressure、RuntimeState sequence semantics unclear、Cubism oracle pressure、dependency review required、rights/provenance missing を早期脱出条件として定義する。

### DEC-ORCH-009: Persistent report paths

Review-Sylph report、Orch-Sylph domain completion report、wave integration review、Undine final report の永続pathを定義する。

### DEC-ORCH-010: Integrator review

wave完了後に、schema / DTO / artifact ref / diagnostic / fixture / traceability / generated evidence / dependency / Cubism non-oracle / machine-readable ID / concurrent edit residue を横断確認するIntegrator reviewを定義する。

## Required Mermaid Diagrams

### Diagram 1: Project-specific Orchestration Hierarchy

#### Mermaid type

```text
graph TD
```

#### Must include

* `/goal` as Undine
* Orch-Sylph
* Gnome
* Review-Sylph
* Design / Development Compliance Review
* Test Adequacy Review
* Integrator

### Diagram 2: Wave Planning Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* goal received
* dependency graph
* Wave 0
* wave gate
* domain launch
* domain reviews
* integration review
* final report

### Diagram 3: Domain Implementation Loop

#### Mermaid type

```text
flowchart TD
```

#### Must include

* context collection
* Gnome implementation
* tests
* Review-Sylph
* Design / Development Compliance Review
* Test Adequacy Review
* fix loop
* domain completion report
* escalation to Undine

### Diagram 4: Early Escape Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* ambiguity or conflict detected
* classification
* stop domain loop
* early escape report
* Undine decision
* user/source-of-truth decision when required

### Diagram 5: Review Artifact Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* Review-Sylph report
* design/development compliance section
* test adequacy section
* domain completion report
* Integrator review
* wave summary
* final report

## Required Tables

### Table 1: Agent Role Table

| Role | Owns | Must produce | Must not do |
| ---- | ---- | ------------ | ----------- |

### Table 2: Review Lane Table

| Review lane | Purpose | Blocking if fails? |
| ----------- | ------- | ------------------ |

### Table 3: Wave Gate Table

| Gate | Required evidence | Blocking if missing? |
| ---- | ----------------- | -------------------- |

### Table 4: Review Scope Table

| Review scope | Checked by | Required for |
| ------------ | ---------- | ------------ |

### Table 5: Loop Control Table

| Case | Action |
| ---- | ------ |

### Table 6: Early Escape Table

| Trigger | Required report |
| ------- | --------------- |

### Table 7: Persistent Report Table

| Report | Path |
| ------ | ---- |

## Required Evidence

* wave plan
* environment report
* implementation changes
* test result
* two-lane review report
* domain completion report
* integration review
* final report
* conflict report
* early escape report

## Review Checklist

### Blocking

* [ ] `/goal` as Undine is defined.
* [ ] Wave 0 is mandatory or an accepted environment report exception is defined.
* [ ] agent roles are defined.
* [ ] wave planning is defined.
* [ ] domain cycle is defined.
* [ ] Design / Development Compliance Review and Test Adequacy Review are separated.
* [ ] Clean Context Review is defined as an execution mode, not a review lane.
* [ ] loop control and early escape are defined.
* [ ] persistent report paths are defined.
* [ ] Integrator review is required.
* [ ] Cubism formats, SDK/Core, Viewer, Physics compatibility, and existing Cubism models are not oracles.
* [ ] machine-readable IDs use no spaces.

---

# P0 Policy Completion Gate

P0規約群は、以下を満たしたら完成とする。

```md
- [ ] P0の9規約すべてが存在する。
- [ ] 各規約が共通テンプレートに従っている。
- [ ] 各規約にRequired Decisionsがある。
- [ ] 各規約にRequired Mermaid Diagramsがある。
- [ ] 各規約にRequired Tablesがある。
- [ ] 各規約にRules / Forbidden / Required Evidenceがある。
- [ ] 各規約にReview Checklistがある。
- [ ] Source of Truth / Conflict Handlingが定義されている。
- [ ] monorepo前提がRepository Structure Policyに明記されている。
- [ ] Module Boundaryが図と表で定義されている。
- [ ] Runtime / Dynamicsのdeterminism方針が定義されている。
- [ ] Operation Coreがmutation gatewayとして定義されている。
- [ ] Testing / AcceptanceにClean Context Reviewが定義されている。
- [ ] Diagnostic Policyでformal/candidateが分離されている。
- [ ] Implementation Orchestration Policyで`/goal` as Undine、Wave 0、two-lane review、Integrator review、早期脱出、永続レポートが定義されている。
- [ ] Cubism関連oracle禁止が全体方針として維持されている。
