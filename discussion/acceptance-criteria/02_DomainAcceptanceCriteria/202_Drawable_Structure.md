# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-02: Drawable Structure

### 問い

Live2Dモデルにおける「描かれるもの」は何か。
Open Editorは何を描画単位として扱わなければならないか。

### AC-DRAW-001: 描画要素を管理できること

Open Editorは、Live2Dモデルを構成する描画要素を管理できること。

描画要素は、テクスチャ、表示状態、描画順、所属パーツ、マスク・クリッピング等の描画制約と結びつく。


### AC-DRAW-002: 描画要素の階層・所属を扱えること

Open Editorは、描画要素がどのパーツまたは構造に所属するかを管理できること。


### AC-DRAW-003: 描画順と表示状態を制御できること

Open Editorは、描画要素の表示/非表示、透明度、描画順を制御できること。


### AC-DRAW-004: マスク・クリッピング等の描画制約を扱えること

Open Editorは、Live2Dモデルに必要な描画制約を扱えること。

これには少なくとも、ある描画要素を別の描画要素の範囲内に制限する表現が含まれる。
