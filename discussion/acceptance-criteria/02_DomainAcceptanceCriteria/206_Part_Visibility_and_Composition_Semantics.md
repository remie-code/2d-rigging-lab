# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-06: Part, Visibility, and Composition Semantics

### 問い

Live2Dモデルは、どのような部品構造として存在するのか。
Open Editorは部品、表示、構成状態をどう扱わなければならないか。

### AC-PART-001: パーツ構造を管理できること

Open Editorは、モデルを構成するパーツを管理できること。


### AC-PART-002: パーツ単位の表示状態を制御できること

Open Editorは、パーツまたは描画要素単位で表示状態や不透明度を制御できること。


### AC-PART-003: ポーズ・差し替え表現を扱えること

Open Editorは、複数の部品状態を切り替える表現を扱えること。

これには、腕、手、衣装、差分パーツなどの切り替えが含まれる。


### AC-PART-004: 表示状態のランタイム再現性を保持できること

Open Editorは、パーツ表示やポーズ状態が出力後のランタイム利用において再現可能な形で保存・出力できること。
