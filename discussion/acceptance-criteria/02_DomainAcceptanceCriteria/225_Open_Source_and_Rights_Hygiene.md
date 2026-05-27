# DOMAIN-25: Demo and Proposal Hygiene

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is Demo and Proposal Hygiene.

## 問い

Private Prototypeの素材、画面、ログ、動画、スクリーンショット、提案資料が、互換製品、第三者素材利用、公式提携、SDK/Core利用、モデル変換機能と誤解されないようにするには何が必要か。

### AC-RIGHTS-001: 再配布できない資産を必須依存にしないこと

Private Prototype、demo、proposal、fixtureは、既存Cubismモデル、公式サンプル、第三者Live2Dモデル、nizima素材、商用モデルを必須依存にしないこと。

### AC-RIGHTS-002: 素材の権利状態を記録できること

素材、生成物、編集履歴、demo表示可否、proposal添付可否をrights/provenance metadataとして記録できること。

### AC-RIGHTS-003: proprietary format互換を実装スコープ外にすること

Cubism形式の読み書き、解析、変換、再構築、互換出力を現在MVPの成功条件にしないこと。

### AC-RIGHTS-004: demo/proposal向けhygiene ruleを定義できること

配信デモとLive2D Feature Proposalで見せてよいもの、避けるもの、disclaimer、非目標を文書化できること。

### AC-RIGHTS-005: Cubism SDK/Coreに依存しないこと

Cubism SDK/Coreは、MVP実装、fixture、demo、validator、private viewerの必須依存にしないこと。
