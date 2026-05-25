# シナリオ: Documentation / Tutorial / AC System

> 参照元AC: [224_Documentation_Tutorial_AC_System.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/224_Documentation_Tutorial_AC_System.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-DOC` を Open Live2D Stack の文書体系、チュートリアル、AC/シナリオ運用のシナリオへ降ろす。

この文書体系は、後続の実装・レビュー・検証で参照できる行動可能な正解である必要がある。Cubism互換を前提にした説明ではなく、Open Model Format、Open Runtime、Open Viewer、Open Package Validator を初期の正として扱う。

## 1. リポジトリ事実

- 参照元ACは、concept document、model format specification、runtime/SDK/Viewer/Editor manual、tutorial、AC/scenario の維持を要求している。
- `discussion/_conventions.md` は、discussion配下で公式事実、リポジトリ事実、仮説、設計判断、実験結果、未決事項を分離することを要求している。
- `discussion/concept/modified_concept.md` は、Open Live2D Stack へのコンセプト変更と当面スコープ外を記録している。

## 2. 設計判断

- 文書は、仕様書、AC、シナリオ、チュートリアル、操作マニュアルの役割を分ける。
- ACとシナリオは、実装が何を満たしたかをレビューするためのオラクルとして扱う。
- MotionSync / LipSync と Video Editor は、初期チュートリアルや初期ACの必須対象にしない。

## 3. シナリオ記述方針

- Given: 文書、map、AC、シナリオ、実装候補を書く。
- When: 文書更新、チュートリアル作成、レビュー、リンク確認、未決事項記録を書く。
- Then: 後続作業者が判断できる内容、逆リンク、状態、未決事項を観測可能に書く。

## SC-DOC-001: concept document で目的・非目的・未決事項を維持できる

### Given: 前提条件

- `discussion/concept/modified_concept.md` が存在する。
- プロジェクトは AI-native Live2D Editor から Open Live2D Stack へコンセプト変更済みである。
- `.moc3` 互換出力、`.cmo3` 復元、VTube Studio完全互換は初期成功条件ではない。

### When: Open Stack実用操作

1. ドキュメント担当者が concept document を読む。
2. ドキュメント担当者が目的、非目的、作成対象、当面スコープ外、重要な問いを確認する。
3. 新しい判断が発生した場合、根拠と未決事項を分けて追記する。

### Then: Open Stack期待結果

- concept document は、Open Live2D Stack の目的と非目的を明確に説明している。
- 初期正が Open Model Format / Runtime / Viewer / Validator であることを確認できる。
- MotionSync / LipSync と Video Editor が当面スコープ外であることを確認できる。
- 未決事項は確定事項と混ざらず、後続検討対象として残っている。

### 検証するACの項目

- AC-DOC-001: concept document を維持できること
- AC-DOC-005: AC / scenario を行動可能な正解として維持できること

## SC-DOC-002: Open Model Format specification を実装・検証に使える詳細さで提供できる

### Given: 前提条件

- Open Model Format の仕様ドラフトが存在する。
- `MinimalAvatar_A` と `RiggedAvatar_A` の package例がある。
- Validator は仕様に基づくschema validationを実装する予定である。

### When: Open Stack実用操作

1. 実装者が仕様から top-level fields、ID規則、参照規則、versioning、migration規則を読む。
2. 実装者が package例を loader test と validator test に変換する。
3. reviewer が仕様と AC-FORMAT / SC-FORMAT の対応を確認する。

### Then: Open Stack期待結果

- 仕様は、実装者が loader と validator を作れる粒度で必須/任意フィールドを説明している。
- package例は、schema validation、runtime load、viewer表示に使える。
- versioning、migration、非推奨要素、拡張領域の扱いが文書化されている。
- SC-FORMAT の期待結果に対応する仕様項目を逆引きできる。

### 検証するACの項目

- AC-DOC-002: model format specification を提供できること
- AC-DOC-005: AC / scenario を行動可能な正解として維持できること

## SC-DOC-003: Runtime / SDK / Viewer / Editor / VTuber App / Validator のmanualを分けて提供できる

### Given: 前提条件

- Runtime、SDK、Viewer、Editor、VTuber App、Validator は責務が異なる。
- 各ドメインには対応するACとシナリオが存在する、または作成予定である。
- ユーザー、実装者、AIエージェントが文書の利用者である。

### When: Open Stack実用操作

1. ドキュメント担当者が各manualの対象読者、前提知識、扱う操作、扱わない操作を定義する。
2. Runtime manual に package load、parameter evaluation、runtime state inspection を書く。
3. SDK manual に Web / TypeScript API、model lifecycle、render integration を書く。
4. Viewer / VTuber App / Validator manual に具体操作とreport出力を分けて書く。

### Then: Open Stack期待結果

- 各manualは、自分の責務と隣接ドメインへのリンクを持つ。
- 同じ概念の用語は、Open Model Format の用語に揃っている。
- Cubism UIや既存アプリ互換を前提にしない説明になっている。
- 実装レビュー時に、どのmanualがどのAC/シナリオを満たすか確認できる。

### 検証するACの項目

- AC-DOC-003: runtime / SDK / Viewer / Editor manual を提供できること
- AC-DOC-005: AC / scenario を行動可能な正解として維持できること

## SC-DOC-004: 最小モデル作成から検証までのtutorialを提供できる

### Given: 前提条件

- `MinimalAvatar_A` を作成するための素材と手順が用意されている。
- Open Package Validator、Open Viewer、AI Agent Interface、Open VTuber App の初期操作が定義されている。
- サンプル素材は Open Source 公開可能である。

### When: Open Stack実用操作

1. ユーザーが tutorial に従って最小モデルを作成する。
2. ユーザーが Open Model Package として保存する。
3. ユーザーが Validator で検証し、Viewer で parameter操作を確認する。
4. ユーザーが AIエージェントに structure inspection と validation report review を実行させる。
5. ユーザーが VTuber App で最小tracking mappingを試す。

### Then: Open Stack期待結果

- tutorial の各手順は、必要な入力、操作、期待される観測結果を持つ。
- 完了後に、Open Model Package、validation report、Viewer snapshot、AI review report、VTuber mapping profile が得られる。
- 失敗時には、どのドメインのmanualまたはACを参照すべきか示される。
- MotionSync / LipSync や Video Editor を完了条件に含めない。

### 検証するACの項目

- AC-DOC-004: tutorial を提供できること
- AC-DOC-003: runtime / SDK / Viewer / Editor manual を提供できること

## SC-DOC-005: AC / scenario を実装・レビュー・検証の正解として維持できる

### Given: 前提条件

- `discussion/acceptance-criteria/` と `discussion/scenarios/` が存在する。
- 各シナリオは参照元ACへのリンクと、検証するAC項目を持つ。
- `_map.md` は、現状のファイル、状態、次の行動、未決事項を示す。

### When: Open Stack実用操作

1. 実装者が対象ドメインのACとシナリオを読む。
2. 実装者がシナリオの Then を実装タスクまたはテストケースへ分解する。
3. reviewer が実装結果を Then の観測結果と照合する。
4. 仕様不足やAC不足を見つけた場合、未決事項として記録する。

### Then: Open Stack期待結果

- 各シナリオは、Given / When / Then と検証するAC項目を持つ。
- Then は、表示、API response、validation report、diff、state snapshot など観測可能な結果になっている。
- map から対象ファイル、状態、次に読むべき文書へ辿れる。
- AC不足や仕様未決は、実装済み事実として書かれず、未決事項として分離される。

### 検証するACの項目

- AC-DOC-005: AC / scenario を行動可能な正解として維持できること
- AC-DOC-001: concept document を維持できること

## 4. 未決事項

- 仕様書とtutorialの正式配置場所。
- API reference を自動生成するか手書きで始めるか。
- 文書レビューの完了条件。
- AC不足を一時記録する場所。
