# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-03: Mesh Structure

### 問い

Live2Dモデルにおける「変形可能な絵」とは何か。
Open Editorはどの単位でテクスチャを変形可能にしなければならないか。

### AC-MESH-001: メッシュ付き描画単位を扱えること

Open Editorは、描画要素にメッシュを割り当て、頂点・辺・面を持つ変形可能な描画単位として扱えること。


### AC-MESH-002: メッシュを編集できること

Open Editorは、メッシュの頂点配置および分割状態を編集できること。


### AC-MESH-003: メッシュ変形をモデル状態として保持できること

Open Editorは、メッシュの形状変化を、パラメータまたは変形制御構造に結びつくモデル状態として保持できること。


### AC-MESH-004: メッシュ品質を検証可能であること

Open Editorは、メッシュが意図した変形に耐えうるかを確認できる情報を提供できること。

検証対象には以下を含む。

- 頂点数
- 面構成
- 変形時の破綻
- 不自然な折れや潰れ
- 描画要素との対応関係
