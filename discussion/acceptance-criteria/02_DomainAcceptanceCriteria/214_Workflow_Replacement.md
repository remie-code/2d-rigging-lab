# DOMAIN-14: Private Workflow Independence

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is Private Workflow Independence.

## 問い

Private Prototypeは、Cubism ecosystemに依存せず、個人用の制作、preview、保存、検証、demo/proposal化までをどう成立させるべきか。

### AC-WF-001: project-defined packageを中心にした制作ワークフローを成立させること

素材取り込み、part/drawable/mesh作成、parameter/keyform編集、保存、再読み込みがproject-defined package上で成立すること。

### AC-WF-002: private runtime/viewerによる確認ワークフローを成立させること

Editor previewとprivate viewerが同じprivate runtime coreで評価し、保存後の見た目を確認できること。

### AC-WF-003: 新規モデル制作ワークフローを段階的に成立させること

Rights-clean素材から小さな可動モデルを制作し、validatorとAI assistantで問題を確認できること。

### AC-WF-004: demo-safe workflowを成立させること

配信・録画・スクリーンショットに出す範囲をdemo-safe preflightで確認できること。

### AC-WF-005: AI assistant workflowを成立させること

AI assistantは、inspection、explanation、dry-run、diff、repair suggestion、provenance記録を支援できること。

### AC-WF-006: Cubism既存資産を入力・解析対象から除外すること

既存Cubismモデル、公式サンプル、第三者Live2Dモデル、Cubism形式は、現在MVPの入力・解析・変換対象にしないこと。
