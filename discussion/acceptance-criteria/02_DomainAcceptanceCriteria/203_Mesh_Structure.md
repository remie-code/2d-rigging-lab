# DOMAIN-03: Mesh Structure

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、drawableを変形可能にするmeshをどの粒度で保持・検証するべきか。

### AC-MESH-001: メッシュ付き描画単位を扱えること

Drawableは、vertices、uvs、triangles、bounds、vertex stable IDsを持つmeshと結び付けられること。

### AC-MESH-002: メッシュを編集できること

Private GUI editorは、manual mesh edit、simple generated mesh、vertex/triangle editingを扱えること。

### AC-MESH-003: メッシュ変形をモデル状態として保持できること

Meshはkeyform、rig control、parameter evaluationの入力として保存・再読み込みできること。

### AC-MESH-004: メッシュ品質を検証可能であること

Validatorは、三角形index、重複/欠落vertex、bounds外変形、過大変形、texture参照不整合を構造化reportとして返せること。
