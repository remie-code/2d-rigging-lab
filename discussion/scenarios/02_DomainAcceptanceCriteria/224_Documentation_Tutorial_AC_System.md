# シナリオ: Documentation, Tutorial, and AC System

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/224_Documentation_Tutorial_AC_System.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/224_Documentation_Tutorial_AC_System.md)
> Status: Current for documentation baseline.

## 0. 目的

Discussion文書、AC、scenario、demo/proposal文書が、Private Prototype baselineを復元できるsource-of-truthとして機能することを確認する。

## SC-DOC-001: conceptとmapから現在方針を復元できる

### Given

- 新しいagentがdiscussionの入口mapを読む。

### When

1. Agentがconcept、Root/MVP AC、scenario map、demo/proposal mapを辿る。
2. Agentがmemo対応状況と残課題分類を確認する。

### Then

- Private Prototype、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subsetを混同しない。
- memo/new_concept.mdへの文書対応完了状態が確認できる。

### 検証するAC

- AC-DOC-001
- AC-DOC-005

## SC-DOC-002: tutorialと仕様境界をCurrent MVPへ限定できる

### Given

- 実装者がtutorial、manual、contractを作ろうとしている。

### When

1. 実装者がMVP ACとDomain ACを参照する。
2. 実装者がprivate editor、private runtime/viewer、validator、AI assistantへ対象を限定する。

### Then

- Future SDK、Future integration surface、Future streaming app manualはCurrent MVPの要件にならない。
- Tutorialはrights-clean素材からpackage、viewer、validator、AI assistantまでの一周を扱う。

### 検証するAC

- AC-DOC-002
- AC-DOC-003
- AC-DOC-004
