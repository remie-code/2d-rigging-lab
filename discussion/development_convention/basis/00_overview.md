# Development Convention Basis: Overview

## Status

Draft

## Purpose

この文書は、Private 2D Rigging Lab / Prototype の実装へ進む前に作成する **開発規約群の全体設計** を定義する。

ここで定義する対象は、個別の開発規約本文そのものではない。  
本フェーズの目的は、次を明確にすることである。

- どの開発規約ドキュメントを作るべきか。
- 各規約ドキュメントが何を決めるべきか。
- 各規約ドキュメントがどの形式で情報を出力すべきか。
- 実装開始前にどの規約が必須か。
- 初期実装中にどの規約が必要か。
- 開発規約作成後、どの条件を満たせば実装フェーズへ進めるか。

この文書および後続の `development_convention_basis` 文書群は、開発規約作成タスクの入力仕様として扱う。

---

## Project Baseline

現在のプロジェクト baseline は以下である。

```text
Private 2D Rigging Lab / Prototype
````

このプロジェクトは、Cubism互換エディタ、Cubism形式変換ツール、Cubism SDK/Core代替runtime、Live2D互換viewerを目的としない。

目的は、独自形式・独自UI・独自runtimeにより、個人利用の範囲で2Dキャラクターリギング、編集、preview、validation、AI補助、demo-safe capture、Live2Dへの機能提案材料化を可能にすることである。

---

## Fixed Decisions

以下は開発規約作成時点で固定済みの前提として扱う。

### Repository Topology

実装repositoryは **monorepo** とする。

理由:

* 開発は主にエージェントによって行う。
* schema、runtime、validator、fixtures、tests、acceptance runner、GUI、AI command、generated evidence を同一workspace上で参照できる必要がある。
* module間のDTO整合、test fixture、runtime artifact、validator diagnostics、acceptance evidence を横断的に確認しやすくする。
* サブエージェントが必要な周辺文脈へアクセスしやすくする。
* cross-module変更時に、同一PR / patch単位でschema、implementation、test、fixture、documentationを同期できるようにする。

したがって、Repository Structure Policy では、monorepo採用を前提として、apps / packages / fixtures / generated / discussion / tests 等の配置、依存方向、generated artifact配置、fixture配置、test runner配置を定義する。

### Minimum Open Dynamics v1

MVPには Minimum Open Dynamics v1 を含める。

Dynamicsは以下の方式に限定する。

```text
driver parameter
  ↓
Minimum Open Dynamics v1
  ↓
computed output parameter
  ↓
keyform / parameter-grid / rigControl
  ↓
mesh deformation
  ↓
rendered drawable
```

MVPでは direct vertex physics、cloth simulation、collision、IK、timeline bake、Cubism Physics互換、`.physics3.json` import/export は扱わない。

### RuntimeState Evidence

RuntimeStateは hidden mutable state として扱わない。
Runtime Coreは explicit `RuntimeStateDto` を入力として受け取り、次の `RuntimeStateDto` を出力する。

RuntimeState artifact と RuntimeState sequence artifact は区別する。

```text
runtime/states/*.runtime-state.json
runtime/state-sequences/*.runtime-state-sequence.json
```

### Testing and Evidence

MVP達成は、単なる手動確認ではなく、以下の証拠によって確認する。

* fixture
* operation log
* runtime snapshot
* runtime state
* runtime state sequence
* validation report
* runtime diff
* model diff
* GUI evidence
* AI dry-run evidence
* demo-safe preflight report
* rights/provenance report
* acceptance runner result

### Clean Context Review

Clean Context Review は、**作業担当者の意図・作業ログ・会話文脈を共有していない別サブエージェント** によるレビューを意味する。

Clean Context Reviewer は、以下のみを根拠にレビューする。

* accepted design
* AC / Scenario
* module contract
* test design
* development conventions
* 実装差分
* test evidence
* generated artifacts

Clean Context Review の目的は、実装者の暗黙意図に依存せず、成果物だけを見て要求が満たされているかを確認することである。

---

## Scope of Development Convention Basis

この basis 文書群は、以下を定義する。

* 開発規約として作るべき文書一覧
* 各規約文書の目的
* 各規約文書が必ず決めるべき項目
* 各規約文書に含めるべき Mermaid 図
* 各規約文書に含めるべき表
* 各規約文書の review checklist
* conflict handling の形式
* clean context review の要求
* P0 / P1 の区分
* 開発規約作成タスクの完了条件

この basis 文書群は、実装コード、具体的なpackage実装、具体的なsubagent分担、実際のPR単位までは定義しない。

---

## Non-goals

この文書では、以下を行わない。

* 実装コードを書く。
* 実際のrepositoryを作成する。
* 全開発規約本文を直接完成させる。
* 具体的なサブエージェント分担を確定する。
* UI framework、rendering library、test framework 等の最終選定を行う。
* Post-MVP機能を実装範囲へ昇格する。
* Cubism互換性を定義する。
* Cubism SDK/Core、Cubism Viewer、Cubism形式をoracleにする。

具体的なサブエージェント分割は、開発規約群がAcceptedになった後、改めて議論する。

---

## Development Convention Document Set

開発規約は、P0とP1に分けて作成する。

### P0: Required before implementation starts

P0規約は、core実装に入る前に必ず作成する。

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

Implementation Orchestration Policy は、`/goal` を Undine と見なし、Wave 0、wave分割、Orch-Sylph / Gnome / Review-Sylph / Integrator による実装実行モデルを定義するP0規約である。
この規約は、実装開始前にサブエージェント分担、domain cycle、two-lane review、persistent reports、early escape、Integrator reviewを同じ前提に揃える。

### P1: Required before corresponding module implementation begins

P1規約は、初期実装と並行して作成してよいが、対応moduleの本格実装前にはAcceptedにする。

```text
discussion/development_convention/gui-implementation-policy.md
discussion/development_convention/ai-assistant-implementation-policy.md
discussion/development_convention/demo-rights-ip-policy.md
discussion/development_convention/dependency-policy.md
discussion/development_convention/review-and-pr-policy.md
discussion/development_convention/subagent-workflow-policy.md
discussion/development_convention/e2e-test-policy.md
```

P1も開発規約作成タスクのスコープに含める。
ただし、P0とP1は実装移行gateでの扱いを区別する。

---

## Relationship to Existing Documents

開発規約は、既存の設計・テスト設計を置き換えない。
開発規約は、それらを実装作業へ安全に落とすための作業規則である。

### Primary source documents

開発規約作成時は、少なくとも以下を参照する。

```text
discussion/_conventions.md
discussion/concept/modified_concept.md
discussion/acceptance-criteria/
discussion/scenarios/
discussion/design/module-contracts/
discussion/tests/
discussion/demo/streaming-demo-policy.md
discussion/proposal/live2d-feature-proposal-template.md
```

### Not implementation oracle

以下は実装oracleではない。

```text
discussion/reports/**
Cubism SDK/Core behavior
Cubism Viewer result
Cubism Editor UI behavior
Cubism file formats
third-party Live2D models
official Live2D/Cubism sample models
```

Research reports は、historical / risk review / capability observation としてのみ扱う。

---

## Source of Truth Model

開発規約作成時には、以下の役割分担を前提とする。

```text
AC / Scenario:
  何を満たすべきかを定義する。

Module Contract:
  DTO、API、module boundary、runtime semanticsなどの実装契約を定義する。

Test Design:
  どのfixture、operation、snapshot、report、diff、evidenceで証明するかを定義する。

Development Convention:
  どの順序、どのmodule境界、どのreview、どの証拠、どの禁止事項を守って実装するかを定義する。

Review Memo / Fix Summary:
  判断履歴と修正理由を補助的に記録する。

Research Reports:
  実装正本ではない。
```

単純に「上位文書が常に下位文書を上書きする」とは扱わない。
矛盾がある場合、実装者または規約作成者は独自判断で補完せず、Conflict Resolution Log に記録し、修正対象文書を明示する。

---

## Conflict Handling Requirement

開発規約群には、矛盾発見時の処理を必ず含める。

矛盾例:

* ACとModule Contractの要求が異なる。
* Scenarioで要求されるfixtureがtest traceabilityにない。
* testが参照するdiagnosticがvalidator contractにない。
* fixture manifestで `mvp-blocking` のfixtureがTest IDに接続されていない。
* runtime contractとoperation contractのDTO名が違う。
* design reviewで決まった内容が本文に反映されていない。

Conflict Resolution Log は、少なくとも以下の形式を持つ。

```md
# Conflict Resolution Log

## CONFLICT-0001

### Found in
- `path/to/file-a.md`
- `path/to/file-b.md`

### Conflict
A says ...
B says ...

### Impact
Implementation / test / acceptance にどう影響するか。

### Decision
採用した解釈または修正方針。

### Source of truth after resolution
修正後に正となるファイル。

### Changed files
- ...

### Reviewer
- ...
```

---

## Required Review Model

開発規約は、実装PR / patch / agent成果物に対して、少なくとも以下の2種類のレビューを要求する。

### Test Adequacy Review

Clean Context Reviewer により行う。

目的:

* テストがAC / Scenario / Module Contractを正しく証明しているかを確認する。
* fixture、oracle、expected artifact、diagnostic、runtime state sequence、GUI evidence、AI dry-run evidenceが適切かを確認する。

確認観点:

* Test IDはAC / Scenarioを証明しているか。
* fixtureとoracleの粒度が合っているか。
* expected artifactが十分か。
* failure時に原因を追えるか。
* exact deterministic replayが全RuntimeState sequenceを比較しているか。
* MVP blocking fixtureがTest IDに接続されているか。
* MVP blocking testがcandidate diagnosticだけに依存していないか。

### Development Compliance Review

Clean Context Reviewer または統合reviewerにより行う。

目的:

* 実装が開発規約、module boundary、source of truth、guardrailを守っているか確認する。

確認観点:

* module boundaryを破っていないか。
* Operation Coreを通さずmutationしていないか。
* Runtime Coreがhidden mutable stateを持っていないか。
* formal / candidate diagnosticsを混同していないか。
* Cubism SDK/Core、Cubism Viewer、Cubism形式をoracleにしていないか。
* demo-safe / rights / provenance 方針を破っていないか。
* machine-readable IDに空白を使っていないか。

---

## E2E Test Policy Requirement

E2Eテストは、既存のテスト設計に含まれる複数の要素を横断するため、開発規約として明示的に定義する。

`e2e-test-policy.md` では、少なくとも以下を決める。

* 何をE2Eと呼ぶか。
* GUIを通すE2Eとheadless operation E2Eの違い。
* E2Eが使うfixture。
* E2Eが生成するexpected artifacts。
* E2Eのpass / fail条件。
* Visual reviewを含むか。
* Demo-safe preflightを含むか。
* AI assistantを含むE2Eをどう扱うか。

推奨E2Eカテゴリ:

```text
E2E-001:
  PSD import → authoring → save → reload → Viewer snapshot → Validator pass

E2E-002:
  invalid package → Validator diagnostics → AI dry-run repair suggestion → human approval boundary

E2E-003:
  demo-safe capture → forbidden term scan → rights/provenance check → capture allowed

E2E-004:
  deterministic replay → RuntimeSequenceFrameDto[] → RuntimeStateSequenceArtifact → full sequence comparison
```

---

## Required Mermaid Diagrams

開発規約作成タスクでは、各規約ドキュメントに必要なMermaid図を明示させる。

この overview では全体方針として、以下の種類を使う。

```text
flowchart TD:
  process flow / gate / conflict resolution

graph TD:
  module dependency / repository structure

sequenceDiagram:
  runtime sequence / operation flow / AI dry-run

stateDiagram-v2:
  diagnostic lifecycle / policy state transition
```

具体的な図要求は、後続の basis 文書で定義する。

---

## Development Convention Basis File Set

この overview に続き、以下の basis 文書を作成する。

```text
discussion/development_convention/basis/00_overview.md
discussion/development_convention/basis/01_common_policy_template.md
discussion/development_convention/basis/02_p0_policy_specs.md
discussion/development_convention/basis/03_p1_policy_specs.md
discussion/development_convention/basis/04_required_diagrams_and_tables.md
discussion/development_convention/basis/05_goal_prompt_and_completion_gate.md
```

各ファイルの役割:

```text
00_overview.md:
  開発規約フェーズの全体設計。

01_common_policy_template.md:
  各規約文書の共通フォーマット。

02_p0_policy_specs.md:
  P0規約ごとのRequired Decisions / Diagrams / Tables / Evidence。

03_p1_policy_specs.md:
  P1規約ごとのRequired Decisions / Diagrams / Tables / Evidence。

04_required_diagrams_and_tables.md:
  Mermaid図と表の一覧。

05_goal_prompt_and_completion_gate.md:
  開発規約作成用の/goal指示文と完了条件。
```

---

## Completion Gate for Development Convention Basis

この basis 文書群は、以下を満たしたら完了とする。

```md
- [ ] P0/P1で作る開発規約ドキュメント一覧が定義されている。
- [ ] 各規約ドキュメントに共通するフォーマットが定義されている。
- [ ] P0規約ごとのRequired Decisionsが定義されている。
- [ ] P1規約ごとのRequired Decisionsが定義されている。
- [ ] 各規約で必要なMermaid図が定義されている。
- [ ] 各規約で必要な表が定義されている。
- [ ] Conflict Resolution Logの形式が定義されている。
- [ ] Clean Context Reviewの定義がある。
- [ ] Test Adequacy Reviewが必須化されている。
- [ ] Development Compliance Reviewが必須化されている。
- [ ] E2E Test Policyを作ることが定義されている。
- [ ] monorepo前提が明記されている。
- [ ] Cubism形式、Cubism SDK/Core、Cubism Viewer、Cubism Physics互換をoracleにしない方針が明記されている。
