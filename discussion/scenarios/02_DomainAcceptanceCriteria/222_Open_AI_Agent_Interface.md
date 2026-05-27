# シナリオ: AI Assistant Interface

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

AI assistantがmodel structure inspection、dry-run operation、diff、scenario-based validation、repair suggestion、provenance trackingを扱えることを確認する。

## SC-AGENT-001: model structureとruntime stateをinspectできる

### Given

- Project-defined packageとruntime snapshotがある。

### When

1. AI assistantがmodel structureの説明を求められる。
2. AI assistantがvalidator reportとruntime snapshotを参照する。

### Then

- AI assistantはstable IDに基づき、対象、原因、影響範囲を説明できる。

### 検証するAC

- AC-AGENT-001

## SC-AGENT-002: dry-run、diff、repair suggestionを提供できる

### Given

- Validator reportに修正候補が含まれる。

### When

1. AI assistantがrepair suggestionを生成する。
2. Editorがdry-run diffを表示する。
3. ユーザーが採用または破棄を選ぶ。

### Then

- ユーザー承認前にpackage本体は変更されない。
- Diff、根拠、provenanceが保存される。

### 検証するAC

- AC-AGENT-002
- AC-AGENT-003
- AC-AGENT-004
- AC-AGENT-005
