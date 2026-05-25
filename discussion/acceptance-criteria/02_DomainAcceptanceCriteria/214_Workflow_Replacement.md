# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-14: Workflow Independence

### 問い

Cubism エコシステムに依存しない制作・実行・配信ワークフローとして成立するとは何か。

### AC-WF-001: Open Model Format を中心にした制作ワークフローを成立させること

Open Live2D Stack は、素材入力から model format 作成、runtime preview、validation、package出力までを Open Model Format 中心で成立させること。


### AC-WF-002: Open Runtime / Viewer による確認ワークフローを成立させること

Open Live2D Stack は、Open Model Package を Open Runtime / Viewer で読み込み、parameter 操作、expression、motion、physics、draw order、mask、validation result を確認できること。


### AC-WF-003: 新規モデル制作ワークフローを段階的に成立させること

Open Editor または authoring tool は、素材入力からモデル構築、可動定義、物理、出力までの新規モデル制作ワークフローを段階的に成立させられること。


### AC-WF-004: 配信利用ワークフローを成立させること

Open VTuber App は、Open Model Package を読み込み、tracking input を parameter に mapping し、OBS 等の配信環境で利用できる表示を提供できること。


### AC-WF-005: AI拡張ワークフローを成立させること

Open Live2D Stack は、Cubism Editor や既存VTuber Appでは困難だったAIエージェントによる編集・補正・レビュー・自動化を成立させること。


### AC-WF-006: Cubism からの移行を参照ワークフローとして扱えること

Cubism 既存資産は、移行元または比較元として扱ってよい。

ただし、Cubism 互換、`.moc3` 出力、`.cmo3` 復元を Open Live2D Stack の初期成立条件にしない。
