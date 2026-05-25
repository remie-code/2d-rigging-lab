# シナリオ: Open Model Package Export and Runtime Readiness

> 参照元AC: [211_Runtime_Export_and_Compatibility.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/211_Runtime_Export_and_Compatibility.md)
> 状態: コンセプト変更反映ドラフト

## 0. このドラフトの目的

このファイルは、`AC-EXPORT` を「Open Model Package を出力し、Open Runtime / Viewer / Validator で利用可能であることを確認する」シナリオへ降ろす。

Cubism Editor / Cubism Viewer / Cubism SDK の出力資産は、参考資料として扱う。

ただし、このシナリオの正は `.moc3` / `.model3.json` 互換ではない。正は Open Model Format と Open Runtime / Viewer / Validator による読み込み・評価・表示・検証である。

## 1. 公式事実

- Live2D Cubism の組み込み用データには、`.png`、`.moc3`、`.model3.json`、`.physics3.json`、`.motion3.json` などが含まれる。`.moc3` はアプリケーション用のLive2Dモデル実データ、`.model3.json` は MOC3 やテクスチャなどを結びつけるJSON形式の情報として説明されている。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer では、`.moc3` または `.model3.json` を読み込み、モーション、表情、物理設定などを確認できる。
  参照: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- Cubism SDK for Web では、`.model3.json` から `.moc3` や texture の参照を取得し、Core で runtime model を生成する流れが示されている。
  参照: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)

## 2. リポジトリ事実

- 参照元ACは、Open Model Package 出力、資産整合、Open Runtime / Viewer 検証、Open Model Format 内 round-trip、編集反映性、Cubism互換非要求を定義している。
- `discussion/concept/modified_concept.md` は、プロジェクトの正を Cubism 互換ではなく Open Live2D Stack 自身の仕様・AC・シナリオへ変更している。

## 3. 設計判断

- `.moc3` 互換出力は初期成功条件にしない。
- `.model3.json` は参照資料として扱うが、Open Model Package の schema を `.model3.json` に従属させない。
- 出力検証の基準環境は、Cubism Viewer ではなく Open Runtime / Open Viewer / Open Package Validator とする。

## 4. シナリオ記述方針

- Given: Open Model Package、編集状態、検証環境などの前提条件を書く
- When: Cubism参照操作と Open Stack実用操作を分けて書く
- Then: Open Stack期待結果として、package、参照整合、runtime表示、操作、validation report を観測可能に書く

## SC-EXPORT-001: 最小 Open Model Package を出力し、Open Viewer で読み込める

### Given: 前提条件

- 最小モデル `MinimalAvatar_A` が Open Editor または authoring script で作成済みである。
- モデルには、1つ以上の texture、drawable、mesh、part、parameter、keyform が存在する。
- Open Viewer と Open Package Validator が利用できる。

### When: Cubism参照操作

1. Cubism では、最小モデルを書き出す場合に `.moc3`、`.model3.json`、texture を揃える。
2. Cubism Viewer では `.model3.json` を読み込み、モデル表示を確認する。

### When: Open Stack実用操作

1. ユーザーが `MinimalAvatar_A` を Open Model Package として保存する。
2. ユーザーが Open Viewer で出力 package を開く。
3. ユーザーが Open Package Validator を実行する。

### Then: Open Stack期待結果

- 出力先には、Open Model Format のモデル本体、1つ以上の texture、package metadata が存在する。
- package 内の参照はすべて解決できる。
- Open Viewer でモデルが表示される。
- Open Package Validator は、必須ファイル、schema、参照解決、runtime load を Pass として報告する。

### 検証するACの項目

- AC-EXPORT-001
- AC-EXPORT-002
- AC-EXPORT-003

## SC-EXPORT-002: parameter 操作が Open Runtime の評価結果へ反映される

### Given: 前提条件

- `MinimalAvatar_A` には `ParamAngleX` 相当の parameter が存在する。
- その parameter により、少なくとも1つの drawable の vertex 状態が変化する。

### When: Open Stack実用操作

1. ユーザーが Open Viewer で `ParamAngleX = 0` を表示する。
2. ユーザーが `ParamAngleX = -1` と `ParamAngleX = 1` を適用する。
3. ユーザーが runtime state inspection を開く。

### Then: Open Stack期待結果

- 各 parameter 値に対して、Open Runtime は評価後の vertex / drawable state を返す。
- Open Viewer の表示は parameter 操作に応じて変化する。
- runtime state report には、入力 parameter、評価対象 drawable、評価後 vertex、diagnostics が含まれる。

### 検証するACの項目

- AC-EXPORT-003
- AC-EXPORT-005

## SC-EXPORT-003: Open Model Package の欠落参照を出力前後で検出できる

### Given: 前提条件

- `MinimalAvatar_A` の package から、参照されている texture を意図的に欠落させた検証用 package がある。

### When: Open Stack実用操作

1. ユーザーが欠落参照を含む package に対して Open Package Validator を実行する。
2. ユーザーが Open Viewer で読み込みを試みる。

### Then: Open Stack期待結果

- Validator は欠落 texture を Fail として報告する。
- 報告には、どの model field から、どの path を参照し、何が欠落したかが含まれる。
- Open Viewer は、読み込み失敗、部分読み込み、表示不能を区別して説明できる。

### 検証するACの項目

- AC-EXPORT-002
- AC-EXPORT-003

## SC-EXPORT-004: Open Model Format 内で round-trip 同等性を検証できる

### Given: 前提条件

- `MinimalAvatar_A.openmodel` が存在する。
- Open Runtime / Viewer で初期表示と parameter 操作が確認済みである。

### When: Open Stack実用操作

1. ユーザーが `MinimalAvatar_A.openmodel` を読み込む。
2. ユーザーが編集せずに別フォルダへ再保存する。
3. ユーザーが元 package と再保存 package の validation と runtime evaluation を比較する。

### Then: Open Stack期待結果

- 再保存 package は Open Viewer で読み込める。
- 参照解決、parameter 定義、mesh、texture 対応、runtime evaluation は実用上同等である。
- バイト列差分がある場合でも、semantic diff として許容できる差分か確認できる。

### 検証するACの項目

- AC-EXPORT-004
- AC-EXPORT-003

## SC-EXPORT-005: 軽微な編集が Open Runtime 表示に反映される

### Given: 前提条件

- `MinimalAvatar_A` には、口または目に相当する drawable と parameter が存在する。

### When: Open Stack実用操作

1. ユーザーが対象 parameter の keyform を軽微に編集する。
2. ユーザーが編集後 package を保存する。
3. ユーザーが Open Viewer で編集前後の package を開き、同じ parameter 値を適用する。

### Then: Open Stack期待結果

- 編集後 package は Open Runtime / Viewer で読み込める。
- 対象 parameter の表示結果は、編集意図に沿って変化する。
- 変更対象外の drawable、texture、parameter、metadata は意図せず欠落または破損しない。
- validation report は、編集差分と検証結果を確認できる。

### 検証するACの項目

- AC-EXPORT-005
- AC-EXPORT-003

## SC-EXPORT-006: Cubism互換出力を初期成功条件から除外して検証できる

### Given: 前提条件

- `RiggedAvatar_A` は Open Model Format 上で編集済みである。
- Open Model Package 出力、Open Viewer 読み込み、Open Runtime 評価、Open Package Validator 検証が利用できる。
- 比較用として、Cubism の組み込み用データが `.moc3`、`.model3.json`、texture、任意の sidecar JSON を持つことは公式参考事実として把握している。
- この検証では、`.moc3`、`.model3.json`、Cubism Viewer、VTube Studio 互換を Pass 条件にしない方針が決まっている。

### When: Cubism参照操作

1. Cubism では、組み込み用出力として `.moc3`、`.model3.json`、texture、必要に応じて `.physics3.json` や `.motion3.json` などを揃える。
2. Cubism Viewer では、`.moc3` または `.model3.json` を読み込み、関連する motion、expression、physics などを確認する。
3. Cubism SDK では、`.model3.json` から参照を取得し、`.moc3` から runtime model を作成する。

### When: Open Stack実用操作

1. ユーザーが `RiggedAvatar_A` を Open Model Package として出力する。
2. ユーザーが Open Package Validator を実行し、schema、asset reference、runtime load、parameter 操作、metadata を検証する。
3. ユーザーが Open Viewer で出力 package を読み込み、主要 parameter 値で表示を確認する。
4. ユーザーが Cubism互換出力の有無を確認し、存在しない場合の扱いを validation report に記録する。
5. 比較用 Cubism package がある場合、参考差分として `.model3.json` の資産構成や loading flow との違いを記録する。

### Then: Open Stack期待結果

- Open Model Package が Open Runtime / Viewer / Validator で読み込み・評価・表示できれば、`.moc3` または `.model3.json` が存在しなくても初期成功条件は満たせる。
- Cubism互換出力の未対応状態は、`Fail` ではなく `Not applicable`、`Deferred`、または将来互換候補として区別して報告される。
- Open Stack の出力検証では、Open Model Format の意味論、runtime state、描画結果、validation result が正として扱われる。
- Cubism package との違いは、公式仕様への不一致ではなく、参考事実、設計判断が必要な差分、未決事項として分離して記録される。
- ユーザーやAIエージェントは、Cubism互換の有無と Open Stack としての出力成立性を混同せずに確認できる。

### 参照資料

- 公式参考: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- 公式参考: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- 公式参考: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- 公式参考: [Cubism Core](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/)

### 検証するACの項目

- AC-EXPORT-001: Open Model Package を出力できること
- AC-EXPORT-003: Open Runtime / Viewer で読み込み・表示・操作できることを検証できること
- AC-EXPORT-006: Cubism 互換出力を初期成功条件にしないこと

## 5. 未決事項

- Open Model Package の実ファイル拡張子とディレクトリ構成。
- authoring format と runtime format を同一にするか、分けるか。
- semantic round-trip 同等性の比較基準。
- Open Runtime の画像差分検証を MVP に含めるか。
- Cubism runtime package から Open Model Format への移行支援をどの段階で扱うか。
