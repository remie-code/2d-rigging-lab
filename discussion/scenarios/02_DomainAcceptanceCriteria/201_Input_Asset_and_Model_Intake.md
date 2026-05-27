# シナリオ: Input Asset and Project Package Intake

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototypeで扱う入力を、rights-clean layered character artとproject-defined packageへ限定して検証する。

## 1. Source-of-Truth

### Repository Facts

- 現在のMVPは、private GUI editorでlayered character artを取り込み、project-defined packageへ保存する。
- `layered-character-psd-profile-v1` は汎用のlayered character art import profileであり、Live2D / Cubism import profileではない。

### Design Decisions

- 入力は自作、生成、または明示許諾済み素材に限定する。
- Unsupported PSD featureは警告またはFailとして扱い、黙って破壊的に変換しない。
- Cubism形式や既存モデルは、MVPの入力成功条件に含めない。

### Research Notes

- 過去のCubism model intake調査はprivate research archiveであり、実装仕様ではない。
- `.cmo3`、`.moc3`、`model3.json`等の形式名が必要な場合は、非対応説明またはリスク整理に限定する。

## SC-IN-001: layered character artをimportできる

### Given

- ユーザーは自作または明示許諾済みのPSDまたはsplit PNG setを持っている。
- 入力素材には、作成者、出典、利用区分、demo表示可否が記録されている。

### When

1. ユーザーがprivate GUI editorで新規projectを作成する。
2. ユーザーがlayered character artをimportする。
3. Editorがlayer、group、texture、bounds、opacity、blend modeを読み取る。

### Then

- Projectにはpart候補、drawable候補、texture参照、layer metadataが保存される。
- 取り込めないlayer効果や不明なblend modeは、warningまたはFailとして表示される。
- Import結果は、元素材のprovenanceと結び付く。

### 検証するAC

- AC-IN-001
- AC-IN-002
- AC-IN-006

## SC-IN-002: rights/provenanceが欠けた素材を検出できる

### Given

- Import対象の一部に出典不明またはdemo表示不可の素材が含まれる。

### When

1. ユーザーがimport後にvalidatorを実行する。
2. Validatorが素材ごとのrights/provenance metadataを確認する。

### Then

- 出典不明素材はNeeds reviewまたはFailになる。
- Demo表示不可素材はdemo-safe captureから除外される。
- Reportは対象layer、texture、理由、推奨対応を示す。

### 検証するAC

- AC-IN-006
- AC-RIGHTS-002

## SC-IN-003: project-defined packageを再読み込みできる

### Given

- User projectにはpart、drawable、mesh、texture参照、provenanceが保存されている。

### When

1. ユーザーがproject-defined packageとして保存する。
2. ユーザーが同じpackageをprivate GUI editorで再読み込みする。

### Then

- Import由来のlayer metadata、texture参照、part/drawable構造が保持される。
- Unsupported feature warningは再読み込み後も確認できる。
- 元素材へのprovenance linkが失われない。

### 検証するAC

- AC-IN-003
- AC-IN-006

## SC-IN-004: 対象外形式をMVP入力として扱わない

### Given

- ユーザーがCubism形式、公式サンプル、第三者Live2Dモデル、nizima素材、商用モデルを入力しようとしている。

### When

1. ユーザーがprivate GUI editorでimportを試みる。
2. Editorまたはvalidatorが入力種別とrights/provenanceを確認する。

### Then

- MVPの入力成功条件には含めない。
- 既存モデル由来の入力は、rights-cleanな自作layered character artに置き換える案内になる。
- 非対応理由は、互換実装しない方針と権利境界の両方から説明される。

### 検証するAC

- AC-IN-004
- AC-IN-005
- AC-RIGHTS-001

## 2. 未決事項

- MVP fixtureとして許容するPSD featureの最小集合。
- split PNG setのmetadata manifest形式。
