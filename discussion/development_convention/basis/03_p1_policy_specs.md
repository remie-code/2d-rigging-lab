# Development Convention Basis: P1 Policy Specs

## Status

Draft

## Purpose

この文書は、初期実装中または対応moduleの本格実装前に必要となる P1 開発規約ドキュメントについて、各規約が必ず決めるべき内容、必ず含めるべき Mermaid 図、必ず含めるべき表、必要な証拠、レビュー観点を定義する。

この文書は、各開発規約本文そのものではない。  
各規約を作成するための **出力仕様** である。

---

## Scope

この文書は、以下の P1 開発規約を対象とする。

```text
discussion/development/gui-implementation-policy.md
discussion/development/ai-assistant-implementation-policy.md
discussion/development/demo-rights-ip-policy.md
discussion/development/dependency-policy.md
discussion/development/review-and-pr-policy.md
discussion/development/subagent-workflow-policy.md
discussion/development/e2e-test-policy.md
````

P1規約は、開発規約作成タスクのスコープに含める。
ただし、実装開始前の全体blockerではなく、**対応moduleの本格実装前にAcceptedにする**。

例:

```text
GUI実装に入る前:
  gui-implementation-policy.md がAcceptedであること。

AI assistant実装に入る前:
  ai-assistant-implementation-policy.md がAcceptedであること。

E2E acceptance実装に入る前:
  e2e-test-policy.md がAcceptedであること。
```

---

## Common Requirements for All P1 Policies

すべての P1 規約は、`discussion/development/development_convention_basis/01_common_policy_template.md` の共通テンプレートに従う。

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
* GUI / AI / demo / dependency / E2E の成果物は、P0規約で定義された module boundary、operation boundary、testing / acceptance、diagnostic policy に従う。
* Clean Context Review を実施できるように、成果物だけで判断可能な evidence を残す。
* P1規約はP0規約と矛盾してはならない。矛盾がある場合は Conflict Resolution Log に記録する。

---

# 1. GUI Implementation Policy

## Output Path

```text
discussion/development/gui-implementation-policy.md
```

## Purpose

GUI Implementation Policy は、Editor GUI の実装境界、GUI操作とOperation Coreの関係、GUI evidence、stable test ID、demo-safe capture mode、visual reviewとの関係を定義する。

この規約は、以下を防ぐ。

* GUIがOperation Coreを通さずmodel packageを直接変更すること。
* GUI testがpixel positionやスクリーンショットだけに依存すること。
* GUI操作の証拠がoperation logやsemantic evidenceとして残らないこと。
* demo-safeではない内部情報が配信画面に出ること。
* Cubism Editor UIの模倣やCubism用語がpublic/demo surfaceに混入すること。

## Required Decisions

### DEC-GUI-001: GUI mutation boundary

GUIからのmodel mutationは必ずOperation Coreを通すことを定義する。

必須方針:

```text
GUI event
  ↓
semantic command / operation request
  ↓
Operation Core
  ↓
dry-run or commit
  ↓
model diff / runtime diff / validation diff
```

GUIがpackage JSONやruntime graphを直接mutationしてはならない。

### DEC-GUI-002: GUI semantic evidence

GUI evidenceとして何を記録するかを決める。

最低限:

* active screen
* active tool
* selected object IDs
* panel state
* semantic target ID
* operation request ID
* hit-test result
* visible / hidden panels
* demo-safe visibility state

### DEC-GUI-003: Stable test ID policy

GUIテストで使うstable test IDの命名規則を決める。

必須:

* machine-readable IDに空白を使わない。
* visual labelではなくsemantic role / targetに紐づける。
* test IDの変更はbreaking changeとして扱うかを決める。

### DEC-GUI-004: Screenshot and visual evidence

スクリーンショットの扱いを決める。

推奨方針:

* screenshotは補助証拠。
* primary oracleはsemantic GUI evidence、operation log、runtime snapshot、validation report。
* pixel-perfect比較はMVP初期では必須にしない。
* visual reviewは必要な場合にmanual / hybrid扱いにする。

### DEC-GUI-005: GUI panel ownership

主要GUI panelの責務を定義する。

最低限:

* source asset import panel
* hierarchy / part panel
* mesh editor panel
* parameter / keyform panel
* parameter-grid-2d panel
* rigControl panel
* dynamics panel
* validator panel
* AI assistant panel
* demo-safe capture panel

### DEC-GUI-006: Demo-safe GUI mode

demo-safe capture時にGUIが何を隠すかを決める。

必須:

* internal schema details
* local source paths
* forbidden terms
* Cubism関連語彙
* solver implementation details
* third-party asset risk information
* non-demo-safe debug fields

### DEC-GUI-007: GUI accessibility for agents/tests

GUIをエージェントやテストから操作・観測するためのインターフェースを決める。

例:

* semantic query API
* stable test ID
* GUI evidence export
* headless GUI state inspection
* operation log correlation

## Required Mermaid Diagrams

### Diagram 1: GUI Mutation Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* User
* GUI
* Operation Core
* dry-run
* diff
* commit
* operation log
* validation report

#### Must not imply

* GUIがpackageを直接mutationすること。

### Diagram 2: GUI Evidence Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* GUI state
* semantic evidence
* operation log
* runtime snapshot
* validation report
* acceptance runner

### Diagram 3: Demo-safe GUI Capture Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* GUI surface
* preflight scanner
* redaction
* allowed capture
* blocked capture

## Required Tables

### Table 1: GUI Panel Responsibility Table

| Panel | Responsibility | Produces evidence | Calls operation? |
| ----- | -------------- | ----------------- | ---------------- |

### Table 2: GUI Evidence Table

| Evidence | Producer | Consumer | Required for |
| -------- | -------- | -------- | ------------ |

### Table 3: Demo-safe Visibility Table

| Field / UI element | Normal mode | Demo-safe mode |
| ------------------ | ----------- | -------------- |

### Table 4: GUI Test ID Table

| GUI element | Stable test ID | Semantic target |
| ----------- | -------------- | --------------- |

## Required Evidence

* GUIEvidence
* operation log
* model diff
* runtime snapshot
* validation report
* demo-safe preflight report
* optional screenshot / capture

## Review Checklist

### Blocking

* [ ] GUIがOperation Coreを通さずmodel packageをmutationしていない。
* [ ] GUI evidenceがsemantic stateを含んでいる。
* [ ] GUI testがスクリーンショットだけをprimary oracleにしていない。
* [ ] demo-safe modeで内部schema / local path / forbidden termsが隠れる。
* [ ] Cubism UI模倣やCubism互換表現がGUI surfaceに混入していない。

---

# 2. AI Assistant Implementation Policy

## Output Path

```text
discussion/development/ai-assistant-implementation-policy.md
```

## Purpose

AI Assistant Implementation Policy は、AI assistant が読んでよい情報、発行してよいcommand、dry-run境界、human approval、禁止操作、provenance、repair suggestion の扱いを定義する。

この規約は、以下を防ぐ。

* AIがmodel packageを直接変更すること。
* AIがhuman approvalなしにcommitすること。
* AIがauto-riggingやimage-to-rig生成に踏み込むこと。
* AIがCubism model conversionやCubism互換実装を提案すること。
* AI操作の証拠やprovenanceが残らないこと。
* AI dry-runと実際のcommitが混同されること。

## Required Decisions

### DEC-AI-001: AI command boundary

AI assistantが実行してよいcommandを定義する。

最低限:

* inspect
* explain
* validate
* dry-run operation
* propose repair
* compare diff
* summarize provenance
* request human approval

禁止:

* direct package mutation
* commit without approval
* automatic complete rig generation
* image-to-rig generation
* Cubism model conversion
* Cubism-like auto rigging
* rights/legal final judgment

### DEC-AI-002: AI dry-run requirement

AIによる変更提案はdry-runを必須とする。

必須:

* model diff
* runtime diff
* validation diff
* affected target IDs
* repair candidate provenance
* approval required flag

### DEC-AI-003: Human approval boundary

どの操作にhuman approvalが必要かを決める。

必須:

* package mutation
* fixture update
* golden update
* validator repair commit
* demo-safe publication action

### DEC-AI-004: AI context access

AIが読んでよいcontextを決める。

例:

* accepted design
* module contract
* current package
* validation report
* runtime snapshot
* operation log
* GUI evidence

禁止または制限:

* hidden user data
* third-party model without provenance
* Cubism model internals
* research reports as implementation oracle

### DEC-AI-005: AI repair candidate provenance

AIが提案するrepair candidateに必要なprovenanceを決める。

最低限:

* source diagnostic
* target object
* proposed operation
* expected diff
* confidence / risk
* human approval requirement

### DEC-AI-006: AI refusal / escalation cases

AIが実行せず、human reviewへ回すべきケースを決める。

例:

* ambiguous target
* candidate diagnostic only
* rights/provenance missing
* request to import Cubism format
* request to bypass operation-core
* request to commit without approval

## Required Mermaid Diagrams

### Diagram 1: AI Dry-run Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* AI assistant
* context
* proposed operation
* Operation Core dry-run
* diff
* validation
* human approval

### Diagram 2: AI Approval Boundary

#### Mermaid type

```text
flowchart TD
```

#### Must include

* proposal
* dry-run
* approval required
* commit
* reject

### Diagram 3: AI Forbidden Flow

#### Mermaid type

```text
flowchart TD
```

#### Must show

* direct package mutation blocked
* Cubism conversion blocked
* auto-rigging blocked

## Required Tables

### Table 1: AI Command Permission Table

| Command | Allowed? | Requires approval? | Evidence |
| ------- | -------- | ------------------ | -------- |

### Table 2: AI Context Access Table

| Context | Read allowed? | Write allowed? | Notes |
| ------- | ------------- | -------------- | ----- |

### Table 3: AI Repair Candidate Table

| Field | Required? | Meaning |
| ----- | --------- | ------- |

### Table 4: AI Escalation Table

| Case | Action |
| ---- | ------ |

## Required Evidence

* AI command request
* AI command response
* dry-run operation log
* model diff
* runtime diff
* validation diff
* approval evidence
* repair candidate provenance

## Review Checklist

### Blocking

* [ ] AIがdirect package mutationしていない。
* [ ] AI commitにはhuman approvalが必要。
* [ ] AIがCubism conversionやCubism互換を提案していない。
* [ ] AI dry-run evidenceが残っている。
* [ ] repair candidateにprovenanceがある。

---

# 3. Demo / Rights / IP Policy

## Output Path

```text
discussion/development/demo-rights-ip-policy.md
```

## Purpose

Demo / Rights / IP Policy は、demo-safe capture、rights/provenance、forbidden terms、redaction、IP guardrail、Live2D提案資料に出してよい情報を定義する。

この規約は、以下を防ぐ。

* 配信や動画に内部schema、local path、危険語彙が出ること。
* third-party素材や権利不明素材がdemoに使われること。
* Cubism互換・Live2D代替・Cubism Physics互換のような誤認表示。
* rights/provenanceが不足した素材をfixtureやdemoに使うこと。
* demo-safe surface と private implementation detail が混ざること。

## Required Decisions

### DEC-DEMO-001: Demo-safe surface

配信・動画・スクリーンショットで見せてよい情報を決める。

許可例:

* 自作モデルの結果
* high-level GUI
* parameter / dynamics result
* validation summary
* AI dry-run summary

禁止例:

* local source path
* internal schema dump
* solver implementation detail
* Cubism関連形式名
* Cubism互換表現
* third-party asset risk detail
* hidden debug fields

### DEC-DEMO-002: Forbidden terms

demo surface / docs / UI / generated artifactsで検出すべき禁止語彙を決める。

最低限:

* `.moc3`
* `.cmo3`
* `model3.json`
* `physics3.json`
* `Cubism SDK`
* `Cubism Core`
* `Cubism Viewer`
* `Cubism Physics`
* `Live2D互換`
* `Cubism互換`
* `Live2D代替`
* `Cubism replacement`
* `Glue`
* `ArtMesh`
* `Deformer`

必要に応じてsurface別に扱いを分ける。

### DEC-DEMO-003: Redaction policy

demo-safe captureで隠す情報を決める。

最低限:

* local file path
* user name / machine path
* internal package hash if sensitive
* third-party asset risk detail
* raw schema/debug dumps
* private research notes

### DEC-DEMO-004: Rights/provenance requirement

素材・fixture・demo asset に必要なrights metadataを決める。

最低限:

* author
* source
* license
* displayAllowed
* redistributionAllowed
* AI generated / AI edited flag
* third-party source flag
* provenance chain

### DEC-DEMO-005: Live2D proposal boundary

Live2Dへ提案資料として出してよいものを決める。

許可:

* problem statement
* UX proposal
* high-level demo video
* before / after workflow
* feature request

禁止:

* Cubism互換実装として提示すること
* Cubism形式対応を示唆すること
* Cubism内部構造再現として見せること

### DEC-DEMO-006: Demo preflight

demo-safe preflight の実行条件と出力を決める。

## Required Mermaid Diagrams

### Diagram 1: Demo-safe Preflight Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* package / GUI / capture request
* forbidden term scan
* rights check
* redaction
* allow / block

### Diagram 2: Asset Provenance Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* source asset
* texture
* drawable
* package
* demo artifact
* provenance metadata

### Diagram 3: Proposal Boundary Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* private prototype
* demo-safe output
* feature proposal
* forbidden implementation disclosure

## Required Tables

### Table 1: Demo-safe Field Table

| Field | Show in normal mode | Show in demo-safe mode |
| ----- | ------------------- | ---------------------- |

### Table 2: Forbidden Term Table

| Term | Surface | Handling |
| ---- | ------- | -------- |

### Table 3: Rights Metadata Table

| Field | Required? | Meaning |
| ----- | --------- | ------- |

### Table 4: Proposal Boundary Table

| Content | Allowed in proposal? | Notes |
| ------- | -------------------- | ----- |

## Required Evidence

* demo-safe preflight report
* rights/provenance report
* redaction report
* forbidden term scan
* asset provenance chain
* proposal package review

## Review Checklist

### Blocking

* [ ] demo-safe captureにforbidden termが出ない。
* [ ] rights/provenanceが不足した素材をdemoに使っていない。
* [ ] Cubism互換・Live2D代替を示唆していない。
* [ ] local pathやinternal schema dumpが露出していない。

---

# 4. Dependency Policy

## Output Path

```text
discussion/development/dependency-policy.md
```

## Purpose

Dependency Policy は、実装で使用する外部依存、license確認、禁止依存、binary dependency、tooling dependency、PSD parser等の扱いを定義する。

この規約は、以下を防ぐ。

* Cubism SDK/Coreが依存に入ること。
* license不明の依存がruntime / editor / viewer / testsに入ること。
* binary dependencyの出所や利用条件が不明なこと。
* fixtureやdemoに使用するtoolのlicenseが追跡できないこと。
* エージェントが無許可に依存を追加すること。

## Required Decisions

### DEC-DEP-001: Dependency approval process

依存追加時の手順を決める。

必須:

* proposed dependency
* purpose
* license
* runtime/editor/test/dev only
* risk assessment
* approval

### DEC-DEP-002: Forbidden dependencies

禁止依存を定義する。

必須:

* Cubism SDK/Core
* Cubism proprietary runtime
* Cubism model parser
* unlicensed binary
* dependency with incompatible license
* third-party model pack

### DEC-DEP-003: License categories

許可するlicenseカテゴリを決める。

例:

* allowed
* review-required
* forbidden

### DEC-DEP-004: Binary dependency handling

binary dependencyの扱いを決める。

必須:

* source
* checksum
* license
* purpose
* allowed environment
* redistribution rule

### DEC-DEP-005: PSD / image tooling dependency

PSD parserやimage処理libraryの扱いを決める。

### DEC-DEP-006: Dev / test / runtime dependency distinction

開発時のみ許可するdependencyとruntime dependencyを分ける。

### DEC-DEP-007: Dependency provenance evidence

依存関係の記録場所と形式を決める。

## Required Mermaid Diagrams

### Diagram 1: Dependency Approval Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* proposal
* license check
* forbidden dependency scan
* approval
* lockfile update
* evidence update

### Diagram 2: Forbidden Dependency Boundary

#### Mermaid type

```text
graph TD
```

#### Must show

* project
* allowed dependencies
* forbidden Cubism SDK/Core
* forbidden proprietary parser

## Required Tables

### Table 1: Dependency Registry Table

| Dependency | Purpose | License | Scope | Status |
| ---------- | ------- | ------- | ----- | ------ |

### Table 2: License Policy Table

| License category | Handling |
| ---------------- | -------- |

### Table 3: Forbidden Dependency Table

| Dependency type | Reason | Handling |
| --------------- | ------ | -------- |

### Table 4: Binary Dependency Table

| Binary | Source | Checksum | License | Allowed? |
| ------ | ------ | -------- | ------- | -------- |

## Required Evidence

* dependency registry
* license review
* lockfile diff
* dependency scan result
* forbidden dependency scan result

## Review Checklist

### Blocking

* [ ] Cubism SDK/Core がdependencyに含まれていない。
* [ ] license不明dependencyがruntime/editor/viewerに含まれていない。
* [ ] dependency registryが更新されている。
* [ ] forbidden dependency scanが通っている。

---

# 5. Review and PR Policy

## Output Path

```text
discussion/development/review-and-pr-policy.md
```

## Purpose

Review and PR Policy は、実装PR / patch / agent成果物のレビュー基準、必要テスト、必要証拠、clean context review、merge条件を定義する。

この規約は、以下を防ぐ。

* テストなしPR。
* 設計・開発規約に準拠しない実装。
* 実装者の説明に依存したレビュー。
* fixture / diagnostic / traceabilityの更新漏れ。
* candidate diagnosticをblocking oracleに使うこと。
* module boundary違反が見逃されること。

## Required Decisions

### DEC-REVIEW-001: PR / patch required sections

PRやagent成果物に必要なsectionを決める。

最低限:

* Summary
* Changed files
* Related AC / Scenario / Test ID
* Evidence artifacts
* Tests run
* Risks
* Conflict log entries
* Reviewer notes

### DEC-REVIEW-002: Required review types

以下を必須化する。

* Implementation review
* Test Adequacy Review
* Development Compliance Review
* Clean Context Review when required

### DEC-REVIEW-003: Clean Context Review definition

Clean Context Review を定義する。

必須:

```text
作業担当者の会話文脈を共有していない別サブエージェントまたはレビュワーが、正本文書、差分、テスト結果、evidenceのみを根拠にレビューする。
```

### DEC-REVIEW-004: Merge gate

merge / accept条件を決める。

必須:

* relevant tests pass
* mvp-blocking tests pass
* no blocking diagnostics
* required evidence present
* clean context review if required
* conflict log resolved or accepted

### DEC-REVIEW-005: Evidence requirement

PRに添付すべき証拠を決める。

### DEC-REVIEW-006: Review outcome categories

review結果の分類を決める。

* blocking
* warning
* suggestion
* accepted

## Required Mermaid Diagrams

### Diagram 1: PR Review Pipeline

#### Mermaid type

```text
flowchart TD
```

#### Must include

* implementation
* tests
* evidence
* Test Adequacy Review
* Compliance Review
* Clean Context Review
* merge / reject

### Diagram 2: Clean Context Review Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* implementer
* evidence bundle
* clean reviewer
* review result
* fix loop

## Required Tables

### Table 1: PR Required Field Table

| Field | Required? | Purpose |
| ----- | --------- | ------- |

### Table 2: Review Type Table

| Review type | Reviewer | Required when |
| ----------- | -------- | ------------- |

### Table 3: Merge Gate Table

| Gate | Blocking? |
| ---- | --------- |

### Table 4: Review Finding Table

| Finding type | Meaning | Required action |
| ------------ | ------- | --------------- |

## Required Evidence

* test result
* acceptance result
* validation report
* runtime artifact
* GUI evidence if GUI affected
* AI dry-run evidence if AI affected
* conflict log if conflict found
* review record

## Review Checklist

### Blocking

* [ ] PRに関連Test IDが記載されている。
* [ ] required evidenceが添付されている。
* [ ] Test Adequacy Reviewが必要な場合に実施されている。
* [ ] Development Compliance Reviewが実施されている。
* [ ] blocking conflictが未解決で残っていない。

---

# 6. Subagent Workflow Policy

## Output Path

```text
discussion/development/subagent-workflow-policy.md
```

## Purpose

Subagent Workflow Policy は、サブエージェントによる作業分担、path ownership、handoff、同時編集禁止、conflict reporting、clean context review の運用を定義する。

この規約は、以下を防ぐ。

* 複数agentが同じファイルを同時編集すること。
* module境界を理解しないagentが不適切な範囲を変更すること。
* handoff artifactが不足し、統合者が判断できないこと。
* conflictを黙って補完すること。
* clean context reviewの独立性が失われること。

## Required Decisions

### DEC-SUBAGENT-001: Subagent workflow scope

この規約は、具体的なagent分割を最終決定しない。
規約完成後に改めてagent分割を決める。

ただし、以下を必ず定義する。

* agent assignment format
* allowed edit paths
* forbidden edit paths
* required handoff artifact
* conflict reporting
* review owner

### DEC-SUBAGENT-002: Path ownership

pathごとのowner / reviewerを決める方法を定義する。

### DEC-SUBAGENT-003: Concurrent edit rule

同時編集禁止の扱いを決める。

必須:

* 同一ファイルの同時編集禁止
* shared schema変更時のIntegrator review必須
* contract変更時のcross-module review必須

### DEC-SUBAGENT-004: Handoff artifact

サブエージェントが作業完了時に出すべき情報を決める。

最低限:

* changed files
* decisions made
* assumptions
* tests updated
* conflicts found
* remaining risks

### DEC-SUBAGENT-005: Clean Context Reviewer assignment

clean context reviewerにどの文脈を渡してよいか、渡してはいけないかを決める。

### DEC-SUBAGENT-006: Escalation flow

不明点・矛盾・設計漏れが見つかった場合のエスカレーションを決める。

## Required Mermaid Diagrams

### Diagram 1: Subagent Handoff Flow

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* task owner
* subagent
* handoff artifact
* integrator
* reviewer

### Diagram 2: Conflict Escalation Flow

#### Mermaid type

```text
flowchart TD
```

#### Must include

* conflict found
* conflict log
* owner decision
* document update
* review

### Diagram 3: Clean Context Review Boundary

#### Mermaid type

```text
flowchart TD
```

#### Must include

* implementer context
* evidence bundle
* clean reviewer
* excluded conversation context

## Required Tables

### Table 1: Agent Assignment Table

| Agent role | Allowed paths | Forbidden paths | Reviewer |
| ---------- | ------------- | --------------- | -------- |

### Table 2: Handoff Artifact Table

| Field | Required? | Meaning |
| ----- | --------- | ------- |

### Table 3: Conflict Escalation Table

| Case | Action |
| ---- | ------ |

### Table 4: Concurrent Edit Rule Table

| File type | Concurrent edit allowed? |
| --------- | ------------------------ |

## Required Evidence

* agent assignment
* handoff artifact
* conflict log
* integrator review
* clean context review result

## Review Checklist

### Blocking

* [ ] subagentの編集pathが明確である。
* [ ] 同一ファイルの同時編集が管理されている。
* [ ] handoff artifactがある。
* [ ] conflictが黙って補完されていない。
* [ ] clean context reviewに作業者の会話文脈が混入していない。

---

# 7. E2E Test Policy

## Output Path

```text
discussion/development/e2e-test-policy.md
```

## Purpose

E2E Test Policy は、ユーザージャーニー全体を横断するテストの定義、fixture、expected artifact、pass/fail条件、GUI/headlessの扱い、visual review、demo-safe preflight、AI assistantを含むE2Eの扱いを定義する。

この規約は、以下を防ぐ。

* E2Eが曖昧な意味で使われること。
* GUI E2Eとheadless E2Eが混同されること。
* E2Eがスクリーンショットだけをoracleにすること。
* E2Eがacceptance runnerやfixture設計と接続されないこと。
* demo-safeやrights/provenanceがE2Eから漏れること。

## Required Decisions

### DEC-E2E-001: Definition of E2E

このプロジェクトで何をE2Eと呼ぶかを決める。

最低限:

```text
複数moduleを横断し、ユーザーまたはagentの目的達成を、fixture、operation、runtime、validator、evidence、acceptance resultで確認するテスト。
```

### DEC-E2E-002: GUI E2E vs headless E2E

以下を区別する。

* GUIを通すE2E
* Operation Coreを直接使うheadless E2E
* Runtime / Validator only E2E
* AI assistantを含むE2E

### DEC-E2E-003: Required E2E journeys

最低限のE2E journeyを定義する。

推奨:

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

### DEC-E2E-004: E2E evidence

E2Eが生成すべき証拠を決める。

必須候補:

* operation log
* package artifact
* runtime snapshot
* runtime state sequence
* validation report
* GUI evidence
* AI dry-run evidence
* demo-safe preflight
* acceptance runner result

### DEC-E2E-005: Visual review

E2Eにvisual reviewを含むかを決める。

推奨:

* screenshotは補助証拠。
* primary oracleはstructured evidence。
* visual reviewはmanual / hybridのreview項目として扱う。

### DEC-E2E-006: E2E pass/fail

pass / fail / needs_review の基準を決める。

### DEC-E2E-007: E2E relation to acceptance runner

E2Eをacceptance runnerがどう実行・集計するかを決める。

## Required Mermaid Diagrams

### Diagram 1: Authoring-to-Viewer E2E

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* Editor
* Operation Core
* package
* Runtime Core
* Viewer
* Validator
* Acceptance Runner

### Diagram 2: AI Repair E2E

#### Mermaid type

```text
sequenceDiagram
```

#### Must include

* invalid fixture
* Validator
* AI assistant
* dry-run
* human approval boundary
* acceptance runner

### Diagram 3: Demo-safe E2E

#### Mermaid type

```text
flowchart TD
```

#### Must include

* model
* GUI capture
* forbidden term scan
* rights check
* redaction
* allow/block

### Diagram 4: Deterministic Replay E2E

#### Mermaid type

```text
flowchart TD
```

#### Must include

* RuntimeSequenceFrameDto[]
* initial RuntimeState
* Runtime Core
* RuntimeStateSequenceArtifact
* full sequence comparison

## Required Tables

### Table 1: E2E Journey Table

| E2E ID | Journey | Modules | Fixture | Blocking? |
| ------ | ------- | ------- | ------- | --------- |

### Table 2: E2E Evidence Matrix

| E2E ID | Required evidence |
| ------ | ----------------- |

### Table 3: E2E Oracle Table

| E2E ID | Primary oracle | Secondary evidence |
| ------ | -------------- | ------------------ |

### Table 4: E2E Review Table

| E2E ID | Requires visual review? | Requires clean context review? |
| ------ | ----------------------- | ------------------------------ |

## Required Evidence

* operation log
* runtime snapshot
* runtime state sequence
* validation report
* GUI evidence
* AI dry-run evidence
* demo-safe preflight
* rights/provenance report
* acceptance runner result
* optional screenshot

## Review Checklist

### Blocking

* [ ] E2Eが複数moduleを横断している。
* [ ] E2Eがacceptance runnerまたはTest IDに接続されている。
* [ ] E2Eがstructured evidenceをprimary oracleにしている。
* [ ] exact replay E2Eが全RuntimeState sequenceを比較している。
* [ ] demo-safe E2Eがrights/provenanceとforbidden term scanを含む。

---

# P1 Policy Completion Gate

P1規約群は、以下を満たしたら完成とする。

```md
- [ ] P1の7規約すべてが存在する。
- [ ] 各規約が共通テンプレートに従っている。
- [ ] 各規約にRequired Decisionsがある。
- [ ] 各規約にRequired Mermaid Diagramsがある。
- [ ] 各規約にRequired Tablesがある。
- [ ] 各規約にRules / Forbidden / Required Evidenceがある。
- [ ] GUI Implementation PolicyでGUI mutation boundaryとGUI evidenceが定義されている。
- [ ] AI Assistant Policyでdry-run / approval / direct mutation禁止が定義されている。
- [ ] Demo / Rights / IP Policyでdemo-safe preflightとrights/provenanceが定義されている。
- [ ] Dependency PolicyでCubism SDK/Core禁止とlicense reviewが定義されている。
- [ ] Review and PR PolicyでTest Adequacy ReviewとDevelopment Compliance Reviewが定義されている。
- [ ] Subagent Workflow Policyでhandoff、path ownership、clean context review boundaryが定義されている。
- [ ] E2E Test Policyで主要E2E journeyとrequired evidenceが定義されている。
- [ ] Cubism関連oracle禁止が全体方針として維持されている。
