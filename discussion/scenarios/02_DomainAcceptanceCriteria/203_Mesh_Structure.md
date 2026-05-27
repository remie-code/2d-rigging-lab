# シナリオ: Mesh Structure

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/203_Mesh_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/203_Mesh_Structure.md)
> Status: Current for Private Prototype baseline.

## 0. 目的

Drawable meshを制作、保存、runtime評価、validator検査へつなげる。

## SC-MESH-001: drawableにmeshを作成できる

### Given

- Drawableがtextureとboundsを持っている。

### When

1. ユーザーがmesh作成を開始する。
2. ユーザーがvertices、uvs、trianglesを編集する。
3. Editorがmeshをpackageへ保存する。

### Then

- Meshはvertex stable IDs、uv、triangle index、boundsを保持する。
- 保存・再読み込み後も同じdrawableに結び付く。

### 検証するAC

- AC-MESH-001
- AC-MESH-002

## SC-MESH-002: mesh品質を検証できる

### Given

- Meshに欠落vertex、壊れたtriangle、bounds外の点が含まれている。

### When

1. Validatorがmeshを検査する。
2. AI assistantがreport説明を求められる。

### Then

- Reportは対象mesh、問題種別、影響範囲、repair suggestion候補を示す。
- AI assistantはdry-runとして修正案を提示できる。

### 検証するAC

- AC-MESH-003
- AC-MESH-004
