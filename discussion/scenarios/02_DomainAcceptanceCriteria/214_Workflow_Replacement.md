# シナリオ: Private Workflow Independence

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/214_Workflow_Replacement.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/214_Workflow_Replacement.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

Private Prototypeの素材入力、編集、preview、保存、viewer確認、validation、AI assistant、demo/proposal化が、Cubism ecosystemに依存せず成立することを検証する。

## SC-WF-001: private authoring-to-viewer workflowを完了できる

### Given

- Rights-cleanなlayered character artがある。

### When

1. ユーザーがprivate GUI editorで素材をimportする。
2. ユーザーがmesh、parameter、keyform、rig controlを作成する。
3. ユーザーがpackageを保存し、private viewerで開く。
4. ValidatorとAI assistantで問題を確認する。

### Then

- 一連の成果物はproject-defined packageとして保存される。
- Private runtime/viewerで表示とparameter操作が成立する。
- 既存Cubism資産を入力・解析・変換しない。

### 検証するAC

- AC-WF-001
- AC-WF-002
- AC-WF-003
- AC-WF-006

## SC-WF-002: demo/proposal workflowをPrivate実装から分離できる

### Given

- ユーザーが配信デモまたはLive2D Feature Proposalを準備している。

### When

1. Demo policyまたはproposal templateを確認する。
2. Demo-safe preflightで表示範囲を確認する。
3. Proposal本文から互換実装や形式対応を示唆する文言を外す。

### Then

- DemoとproposalはPrivate実装の内部形式やコードを公開前提にしない。
- AI assistantはdry-run / diff / repair suggestionとして説明される。

### 検証するAC

- AC-WF-004
- AC-WF-005
