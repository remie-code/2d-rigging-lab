# シナリオ: Open Source and Rights Hygiene

> 参照元AC: [225_Open_Source_and_Rights_Hygiene.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/225_Open_Source_and_Rights_Hygiene.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-RIGHTS` を Open Live2D Stack を Open Source として公開可能に保つための権利境界・依存境界のシナリオへ降ろす。

Open Stack は、Cubism SDK/Core、公式サンプル、商用モデル、proprietary format 互換に依存しない形で初期成功条件を置く。ローカル検証用依存がある場合も、公開成果物から分離されていることを検証対象にする。

## 1. リポジトリ事実

- 参照元ACは、再配布不可資産を必須依存にしないこと、サンプル資産の権利状態記録、proprietary format互換非要求、contributor向け権利ルール、実験用ローカル依存の分離を要求している。
- `discussion/concept/modified_concept.md` は、Open Source として公開可能な権利関係・依存関係・設計境界を新コンセプトに含めている。
- `.cmo3` 復元、`.moc3` 互換出力、VTube Studio完全互換は初期成功条件ではない。

## 2. 設計判断

- 権利状態が不明なものは、公開成果物の必須依存にしない。
- 参照調査やローカル実験で proprietary 資産を使う場合、repo管理対象、配布物、CI、sample fixture から分離する。
- サンプルモデルとドキュメントは、Open Source 公開時に監査可能な provenance を持つ。

## 3. シナリオ記述方針

- Given: repo、sample、local dependency、contributor artifact、rights metadataを書く。
- When: 依存確認、sample登録、contributor review、公開前check、分離確認を書く。
- Then: 必須依存の不存在、権利metadata、scope外互換、公開可能性、分離状態を観測可能に書く。

## SC-RIGHTS-001: 再配布できない資産を公開リポジトリの必須依存にしない

### Given: 前提条件

- Open Live2D Stack の公開候補ブランチがある。
- Runtime、Viewer、Validator、SDK の初期テストは Open Sample Model Set を使う。
- Cubism SDK/Core、公式Live2Dサンプル、商用モデルは公開repoの必須依存にしない方針である。

### When: Open Stack実用操作

1. reviewer が build/test/sample の依存一覧を確認する。
2. reviewer が公開repoに含まれる binary、model、texture、wasm、SDK由来ファイルを確認する。
3. reviewer が CI または公開手順が Open Sample Model Set だけで成立するか確認する。

### Then: Open Stack期待結果

- 公開repoのbuild/test/sampleは、再配布不可資産なしで成立する。
- 再配布条件に制約がある資産は、必須依存、sample fixture、CI成果物に含まれない。
- 参照調査用の外部資産が必要な場合、入手手順とローカル配置だけが記録され、資産本体はrepoに含まれない。
- 権利不明資産が検出された場合、公開前checkは Fail として対象pathと理由を返す。

### 検証するACの項目

- AC-RIGHTS-001: 再配布できない資産を必須依存にしないこと
- AC-RIGHTS-005: 実験用ローカル依存を公開成果物から分離できること

## SC-RIGHTS-002: サンプル資産の権利状態を記録できる

### Given: 前提条件

- `SampleAvatar_Clean_A` は Open Sample Model Set の公開候補である。
- sample は texture、model body、expression、motion、validation fixture を含む。
- rights metadata schema は、素材、作成者、出典、ライセンス、生成過程、編集履歴を記録できる。

### When: Open Stack実用操作

1. sample作成者が各素材の rights metadata を記入する。
2. reviewer が metadata の欠落、不明な出典、ライセンス不一致を確認する。
3. reviewer が sample package と catalog の権利状態を照合する。

### Then: Open Stack期待結果

- texture、model、motion、expression、生成物のライセンスと出典が記録されている。
- AI生成または手動作成の場合も、生成/編集手順と使用した入力素材が記録されている。
- metadata欠落やライセンス不明は Needs review または Fail として扱われる。
- sample catalog から、公開可能、内部検証のみ、使用禁止の区分を確認できる。

### 検証するACの項目

- AC-RIGHTS-002: サンプル資産の権利状態を記録できること
- AC-RIGHTS-004: contributor 向け権利ルールを定義できること

## SC-RIGHTS-003: proprietary format 互換を初期成功条件にしない

### Given: 前提条件

- Open Model Format、Open Runtime、Open Viewer、Open Package Validator の初期仕様が存在する。
- `.cmo3`、`.moc3`、`.model3.json` などのCubism形式は、参照調査・移行元・将来拡張として扱う方針である。
- 初期MVPの検証対象は Open Model Package である。

### When: Open Stack実用操作

1. reviewer が MVP AC、Domain AC、シナリオ、tutorial の完了条件を確認する。
2. reviewer が `.moc3` 出力や `.cmo3` 復元を初期成功条件として要求していないか確認する。
3. reviewer が Cubism形式に触れる記述が参考資料、調査、移行支援として分離されているか確認する。

### Then: Open Stack期待結果

- 初期成功条件は Open Model Format / Runtime / Viewer / Validator に基づいている。
- `.cmo3` 復元や `.moc3` 互換出力がないことは、初期MVPのFail理由にならない。
- Cubism形式への言及は、成功条件ではなく参照・調査・移行候補として書かれている。
- 将来互換を検討する場合も、権利と仕様公開性の制約が未決事項として分離される。

### 検証するACの項目

- AC-RIGHTS-003: proprietary format 互換を初期成功条件にしないこと
- AC-RIGHTS-001: 再配布できない資産を必須依存にしないこと

## SC-RIGHTS-004: contributor 向け権利ルールを定義できる

### Given: 前提条件

- 外部contributor が新しいsample model、texture、manual、コードを追加する想定である。
- contributor guide は、受け入れ可能な素材、禁止素材、metadata、確認手順を記述できる。
- pull request review では rights hygiene check を実行できる。

### When: Open Stack実用操作

1. contributor が sample model を追加する。
2. contributor が rights metadata と作成手順を添える。
3. reviewer が contributor guide に沿って権利状態、依存、出典を確認する。
4. reviewer が不足事項を指摘し、必要なら公開不可として差し戻す。

### Then: Open Stack期待結果

- contributor guide は、コード、モデル、素材、ドキュメントごとに必要な権利確認を説明している。
- 公式サンプル、商用モデル、再配布不可SDK資産、出典不明素材の持ち込み禁止条件を確認できる。
- PR review は、metadata欠落、ライセンス不一致、禁止資産混入を具体的なpathと理由で報告できる。
- contributor の提案物は、公開可能、修正必要、受け入れ不可の状態に分類できる。

### 検証するACの項目

- AC-RIGHTS-004: contributor 向け権利ルールを定義できること
- AC-RIGHTS-002: サンプル資産の権利状態を記録できること

## SC-RIGHTS-005: 実験用ローカル依存を公開成果物から分離できる

### Given: 前提条件

- Cubism SDK/Core などを参照調査に使うローカル実験が存在し得る。
- 公開repoには、Open Stack 本体、Open Sample Model Set、検証用fixtureだけを含める。
- `.gitignore`、環境変数、adapter境界、ローカル配置手順を定義できる。

### When: Open Stack実用操作

1. 実験担当者がローカルの proprietary SDK/Core を環境変数で参照する。
2. 実験担当者が adapter 境界を通して参照結果だけを比較メモに残す。
3. reviewer が公開repoの tracked files と配布成果物を確認する。
4. reviewer がローカル依存なしで build/test が成立するか確認する。

### Then: Open Stack期待結果

- proprietary SDK/Core 本体、再配布不可wasm、公式sample、商用modelは tracked files に含まれない。
- ローカル依存pathは環境変数や `.gitignore` で分離され、公開成果物の必須依存にならない。
- adapter は、Open Stack 本体が proprietary API に直接結合しない境界として説明される。
- 参照調査の結果は、公式事実、実験結果、設計判断を分けて記録され、資産本体を含まない。

### 検証するACの項目

- AC-RIGHTS-005: 実験用ローカル依存を公開成果物から分離できること
- AC-RIGHTS-001: 再配布できない資産を必須依存にしないこと

## 4. 未決事項

- rights hygiene check をCIに入れる時期。
- sample license と contributor license agreement の扱い。
- ローカル参照調査用adapterの正式配置。
- 外部仕様・商用ツールに基づく互換調査をどこまで公開文書化できるか。
