# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-01: Input Asset and Model Intake

### 問い

Open Live2D Stack における入力とは何か。
どの素材や既存資産を、Open Model Format の制作・検証対象として立ち上げなければならないか。

### AC-IN-001: 静的な2D素材を受け取れること

Open Editor または authoring tool は、Live2D 的モデル制作の入力となる静的な2D素材を受け取れること。

入力対象は段階的に定義されるが、少なくとも以下の概念を扱える必要がある。

- 単体画像
- レイヤー構造を持つ素材
- テクスチャ化される画像素材
- 下絵、ガイド、制作補助画像


### AC-IN-002: 入力素材を Open Model Format の制作対象へ変換できること

Open Editor または authoring tool は、入力素材を drawable、mesh、part、texture、metadata などの Open Model Format 構成要素へ変換できること。

変換後のモデルは、後続の編集、runtime評価、viewer表示、package validation に利用できること。


### AC-IN-003: Open Model Package を読み込めること

Open Live2D Stack は、既存の Open Model Package を読み込み、制作・表示・検証対象として扱えること。

読み込んだ package について、モデル構造、参照関係、parameter、keyform、mesh、texture、physics、motion、metadata を保持・観測できること。


### AC-IN-004: Cubism runtime package を移行元・参照元として扱えること

Open Live2D Stack は、`.model3.json`、`.moc3`、texture、physics3、motion3、exp3 などの Cubism runtime package を、移行元または参照元として観測できること。

ただし、`.moc3` から deformer hierarchy、keyform、authoring state を完全復元することを初期成功条件にしない。

Cubism runtime package から得られる情報と、Open Model Format へ移行できない情報を区別して報告できること。


### AC-IN-005: `.cmo3` の独立読み書きを初期成功条件にしないこと

`.cmo3` は Cubism Editor の authoring project であり、仕様公開状況と権利境界が不明確である。

Open Live2D Stack は、`.cmo3` の独立読み書きを初期ACまたはMVPの成功条件にしない。

`.cmo3` は、ユーザーが所有する参照資料、手動移行元、または将来調査対象として扱ってよい。


### AC-IN-006: 入力由来情報と欠落情報を保持できること

Open Live2D Stack は、入力素材または既存資産から得られる構造情報を、後続の編集・検証・出力に利用できる形で保持できること。

同時に、保持できない情報、変換された情報、推定した情報を区別して provenance として記録できること。

保持・記録すべき情報には以下を含む。

- 入力ファイルと由来
- drawable / part / mesh / texture 対応
- parameter / keyform / physics / expression / motion
- 変換時の警告
- 欠落した authoring 情報
- Open Model Format へ移行した情報
