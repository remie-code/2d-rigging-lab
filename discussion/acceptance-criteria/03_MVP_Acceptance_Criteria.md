# Open Live2D Stack Acceptance Criteria System Draft

# 3. MVP Acceptance Criteria

## 0. 位置付け

このMVPは、「最小モデルを表示できること」ではなく、**権利的にクリーンな素材から GUI Editor で Live2D 的な可動モデルを制作し、保存し、Runtime / Viewer で表示し、Validator と AI Agent で検証できること**を初期成功条件とする。

GUI Editor は後付けの表示確認UIではない。MVPでは、モデル形式、編集操作、検証設計、AI Agent Interface が、GUI上で人間が制作できる authoring workflow を前提に成立していなければならない。

Cubism Editor の画面配置やメニュー構成を模倣することは目的ではない。再構築する対象は、素材から Live2D 的な可動モデルを作る制作能力、制作途中の見通し、保存と再編集、runtime確認、構造化検証である。

Cubism 公式資料は参考資料であり、Open Live2D Stack のオラクルではない。Open Live2D Stack の正は、`discussion/concept/modified_concept.md`、Root AC、Domain AC、本MVP AC、対応シナリオである。

## 1. MVPの中心問い

最初に何ができれば、Open Live2D Stack は「制作から実行まで一周できる」と言えるのか。

MVPの中心問いは次である。

> 権利的にクリーンなレイヤー分割素材または分割画像を、GUI Editor で drawable / texture / part / mesh / parameter / keyform / deformer 相当構造を持つ Live2D 的な可動モデルへ制作し、Open Model Package として保存・再読み込みし、Runtime / Viewer で parameter 操作に応じて表示し、Validator と AI Agent が構造化レポート・operation・diff・検証結果として扱えるか。

この問いに答えられない成果は、CLI、script、AI操作、手書きJSON、単体Runtime表示が成功していてもMVP達成とはしない。

## 2. 旧MVPから継承する意図

現行MVP ACの旧前提から、次の意図は残す。ただし、すべて GUI Editor 必須の Authoring-to-Runtime 一周へ再配置する。

| 旧MVPの意図 | 新MVPでの配置 |
|---|---|
| Open Model Format を最小モデルの正にする | GUI Editor が保存・再読み込みでき、Runtime / Viewer / Validator / AI Agent が同じ package を扱う形式として扱う |
| 最小モデルを保存・読み込みする | Editor の制作結果として保存し、Editor 再読み込みと Runtime 読み込みの両方で round-trip を検証する |
| Runtime が parameter に応じて評価する | Viewer と Runtime state inspection で、keyform / deformer 相当構造に基づく評価済み drawable state を確認する |
| Viewer が表示・操作する | Editor preview とは別に、Runtime / Viewer が Open Model Package を読み込み、parameter 操作と構造 inspection を行う |
| Validator が構造化レポートを出す | schema、asset、mesh、drawable、parameter、deformer、mask、runtime load、rights を対象にする |
| 権利クリーンなサンプルを使う | 入力素材、sample package、validation fixture、AI編集結果の provenance をMVP条件に含める |
| AIエージェントが観測・操作・検証する | GUI制作済みモデルに対し、構造観測、編集operation、diff、validation、repair候補を扱う |
| Cubism資産を初期成功条件にしない | `.cmo3` 復元、`.moc3` 互換出力、Cubism SDK/Core 必須依存をMVP外に明示する |

## 3. 参照範囲

### 3.1 MVPで参照する公式資料

公式資料は制作能力の参考として参照する。URLは後続シナリオ・仕様化で再確認できるよう明示する。

- Live2D Cubism Editor Tutorial top: https://docs.live2d.com/cubism-editor-tutorials/top/
- 基本チュートリアル1 イラストの加工: https://docs.live2d.com/cubism-editor-tutorials/psd/
- 基本チュートリアル2 イラストを動かす準備: https://docs.live2d.com/cubism-editor-tutorials/import/
- 基本チュートリアル3 表情の動き付け: https://docs.live2d.com/cubism-editor-tutorials/expression/
- 基本チュートリアル4 体の動き付け: https://docs.live2d.com/cubism-editor-tutorials/deformer/
- 基本チュートリアル5 顔のXYの動き付け: https://docs.live2d.com/cubism-editor-tutorials/xy/
- 基本チュートリアル6 アニメーションの作成: https://docs.live2d.com/cubism-editor-tutorials/animator/
- PSD import: https://docs.live2d.com/en/cubism-editor-manual/psd-import/
- ArtMesh: https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/
- Automatic Mesh Generator: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
- Edit Mesh manually: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
- Parts: https://docs.live2d.com/en/cubism-editor-manual/parts/
- Draw Order: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- Clipping Mask: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- Parameter: https://docs.live2d.com/en/cubism-editor-manual/parameter/
- Parameter keys / keyforms: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
- Keyforms X/Y: https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/
- Deformer: https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Warp Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
- Rotation Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
- Parent-child hierarchy: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/
- Data for Embedded Use: https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/
- Viewer loading: https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
- SDK model loading reference: https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- SDK parameter operation reference: https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- Cubism model integrity reference: https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/

### 3.2 MVP参照範囲

MVPは Cubism 基本チュートリアル 1-5 相当の制作操作を参照範囲とする。

- 1: レイヤー分割済み素材、または分割画像を制作入力として扱う。
- 2: 入力素材を drawable / texture / part / mesh へ立ち上げ、メッシュ生成・編集できる。
- 3: まばたき、眉、口開閉、clipping / mask を含む表情可動を制作できる。
- 4: warp / rotation 相当 deformer、親子階層、体上下、体の傾き、腕、髪揺れ、顔Z相当の回転を制作できる。
- 5: 顔 Angle X / Y、斜め方向、複数パーツをまとめた deformer 制御を制作できる。

基本チュートリアル6のアニメーションモード、timeline、motion作成は MVP+1 / 将来候補とし、MVP条件に含めない。

## 4. MVP Acceptance Criteria

### AC-MVP-001: GUI Editor を必須の制作入口にすること

MVPでは GUI Editor が必須であること。

ユーザーは GUI Editor で素材を読み込み、パーツや描画要素を選択し、lock / hide / select、draw order、mesh編集、parameter / keyform / deformer編集、preview、保存、再読み込みを行えること。

CLI、script、AI操作、手書きJSONだけで Open Model Package を生成できても、それはMVP達成とはしない。これらは GUI Editor の補助、検証、fixture生成、automation として使ってよいが、GUI制作フローを置き換えるものではない。

### AC-MVP-002: 権利的にクリーンな素材とサンプルで完結すること

MVPに使う入力素材、分割画像、texture、sample package、validation fixture、AI編集結果は、Open Source 公開可能な権利状態であること。

各素材と生成物は、出典、作成者、ライセンス、生成・編集手順、AI利用の有無、再配布可否を provenance として記録できること。

Cubism公式サンプル、商用モデル、再配布不可SDK/Core、権利不明素材を、MVPの必須データにしないこと。

### AC-MVP-003: レイヤー素材または分割画像を制作入力として受け入れられること

GUI Editor は、レイヤー構造付き素材または分割画像セットを入力として受け入れられること。

入力時には、元素材、レイヤーまたは分割画像、キャンバス上の配置、表示状態、グループ構造、下絵またはガイド画像、受け入れ時の警告を観測できること。

入力素材に欠落、同名要素、権利未確認、変換不能属性がある場合は、無条件に成功扱いにせず、受け入れ可否、保持できた情報、失われた情報、手動確認が必要な情報を区別すること。

### AC-MVP-004: drawable / texture / part 化できること

GUI Editor は、入力素材から texture、drawable、part を作成・管理できること。

各 drawable は、安定ID、元素材との対応、texture参照、初期配置、表示状態、opacity、draw order、part所属を持つこと。

part は、顔、目、眉、口、髪、体、腕など、制作上のまとまりとして作成・整理できること。part と drawable の対応は、Editor、保存形式、Runtime、Viewer、Validator、AI Agent から同じIDで追跡できること。

### AC-MVP-005: mesh を生成・編集・検証できること

GUI Editor は、drawable に対して mesh を生成し、頂点、UV、triangle index を編集できること。

MVPでは、自動生成と手動編集の少なくとも一方がGUI上で成立し、頂点移動により drawable の見た目を変形できること。

mesh は、vertex数、uv数、triangle index範囲、重複または退化triangle、texture範囲、drawable参照、保存後の整合性を Validator と AI Agent が検証できること。

### AC-MVP-006: part管理、lock / hide / select、draw order を扱えること

GUI Editor は、part / drawable 単位で lock、hide、select、multi-select、表示確認、編集対象の限定を行えること。

draw order は GUI Editor で編集でき、Editor preview、保存後の再読み込み、Runtime / Viewer 表示、Validator report で一致すること。

lock / hide / select は制作支援状態として扱い、runtimeに必要な表示状態や描画順と混同しないこと。

### AC-MVP-007: clipping / mask を扱えること

GUI Editor は、drawable に clipping / mask 関係を設定できること。

MVPでは、少なくとも目の白目と瞳、または同等の小さな局所部位で、mask対象と被mask drawable の関係を作成し、Editor preview と Runtime / Viewer で確認できること。

Validator は、mask参照先の欠落、循環、無効対象、runtimeで解決不能な mask を構造化して報告できること。

### AC-MVP-008: parameter、範囲、keyform、補間を制作できること

GUI Editor は、parameter を作成し、ID、表示名、最小値、最大値、初期値、現在値、標準または推奨識別子を扱えること。

GUI Editor は、parameter に keyform を追加し、各keyformで drawable、mesh、deformer相当構造、opacity、visibility などの状態を編集できること。

Runtime は、keyform間の中間値を補間し、Viewer で slider 操作したときに連続的な見た目の変化を確認できること。

### AC-MVP-009: warp / rotation 相当 deformer、親子階層、parameter接続を制作できること

GUI Editor は、warp deformer 相当と rotation deformer 相当の変形制御構造を作成できること。

deformer相当構造は、対象 drawable または子deformer、親子階層、局所変形と大域変形、回転中心または制御格子、parameter / keyform 接続を持てること。

MVPでは、少なくとも顔や体のまとまりを変形する warp 相当構造と、頭部または腕などを回転的に扱う rotation 相当構造をGUI上で作成し、parameter に接続できること。

Validator は、親子循環、親子サイズまたは対象範囲の不整合、存在しない対象ID、parameter未接続、runtime評価不能なdeformerを報告できること。

### AC-MVP-010: 基本チュートリアル1-5相当のミニモデル可動を制作できること

GUI Editor で作るMVPミニモデルは、見た目の完成度より、Live2D 的な制作概念を一周検証できることを優先する。

MVPミニモデルは、少なくとも次の可動を制作・保存・再読み込み・Preview・Runtime評価できること。

- まばたき: 左右どちらか、または両目の開閉を parameter と keyform で制御できる。
- 眉: 左右どちらか、または両眉の上下・困り眉・驚き相当を parameter と keyform で制御できる。
- 口開閉: 口の開閉を parameter と keyform で制御できる。
- 顔Z: 顔または頭部の回転Z相当、傾き、またはroll表現を制御できる。
- 体上下 / 傾き: 体の上下移動、傾き、または体幹回転相当を制御できる。
- 腕: 少なくとも片腕の回転、上下、または姿勢差分を制御できる。
- 髪揺れ: 髪パーツを parameter駆動または簡易的な揺れ相当のdeformerで制御できる。フル物理シミュレーションは必須ではない。
- 顔 Angle X / Y: 顔を左右・上下に向かせる parameter を持ち、斜め方向を補間または複合keyformで確認できる。

これらは Cubism の標準パラメータ名と完全一致する必要はない。ただし、標準名を参考aliasとして保持できる場合は、Viewer、Validator、AI Agent が識別できること。

### AC-MVP-011: Editor preview、保存、再読み込みが成立すること

GUI Editor は、制作中のモデルを preview できること。

previewでは、parameter slider または同等のGUI操作により、keyform、deformer、clipping、draw order、part表示状態が制作意図通りに反映されること。

制作結果は Open Model Package として保存でき、GUI Editor で再読み込みしたときに、素材対応、drawable、texture、part、mesh、parameter、keyform、deformer、clipping、draw order、rights metadata、provenance が保持されること。

### AC-MVP-012: Runtime / Viewer で表示し parameter 操作できること

Open Runtime / Viewer は、GUI Editor で保存した Open Model Package を読み込み、非空のモデル表示を生成できること。

Viewer は、MVPミニモデルの parameter 一覧、範囲、初期値、現在値を表示し、GUI slider または同等の操作で値を変えられること。

parameter 操作の結果として、評価済み drawable state、vertex、visibility、opacity、draw order、mask状態、diagnostics が変化し、構造化runtime stateとして取得できること。

### AC-MVP-013: Validator が構造化レポートを出力できること

Open Package Validator は、GUI Editor で保存した package に対して、少なくとも次を検証できること。

- package schema と format version
- 必須ファイルと asset reference
- rights metadata と provenance
- texture / drawable / part 参照
- mesh の vertex / uv / triangle index 整合性
- draw order と表示状態
- clipping / mask 参照
- parameter 範囲、初期値、keyform
- deformer相当構造、親子階層、parameter接続
- Runtime load test と代表parameter評価

レポートは、人間向け要約に加え、AI-readable な構造化形式で保存できること。各項目は check ID、status、severity、target ID、根拠、関連ACまたはシナリオ、影響範囲、修復候補、provenance を持てること。

### AC-MVP-014: AI Agent が観測、編集operation、diff、検証を扱えること

AI Agent は、GUI Editor で制作されたMVPミニモデルに対して、構造化された観測、編集operation、diff、検証を行えること。

AI Agent は少なくとも次を実行または取得できること。

- model structure inspection
- runtime state snapshot
- validation report 読み込み
- 対象IDを指定した編集operationのdry-runまたはpreview
- 編集前後の model diff、runtime diff、validation diff
- 修復候補とprovenance
- AC / scenario に照らした Pass / Fail / Needs review / Not applicable の判定材料

AI Agent の操作は、GUI制作フローを置き換えるためではなく、人間がGUIで制作したモデルを検証・補助・修復提案するために使えること。

### AC-MVP-015: Cubism非依存の一周として成立すること

MVPの Authoring-to-Runtime 一周は、Cubism Editor、Cubism SDK/Core、`.cmo3` 復元、`.moc3` 互換出力を必須依存にせず成立すること。

Cubism公式資料、Cubism sample、Cubism runtime package は、参考資料、比較対象、移行調査対象として扱ってよい。ただし、それらがないとMVPを制作・保存・表示・検証できない状態はMVP未達である。

## 5. MVP外項目

次は MVP 条件に含めない。

- Cubism Editor のUI模倣、メニュー模倣、ショートカット模倣。
- `.cmo3` の復元、独立読み書き、authoring state の完全復元。
- `.moc3` 互換出力、`.model3.json` 互換出力、Cubism Viewer 互換。
- Cubism SDK/Core を必須Runtimeとして使うこと。
- 基本チュートリアル6相当のアニメーションモード、timeline、motion作成、motion export。
- expression asset、motion asset、physics asset の完全制作。ただしMVPミニモデル内のparameter駆動表情と髪揺れ相当は含める。
- VTuber App、tracking input、OBS出力、plugin連携。
- SDK全体、External API全体、Marketplace / Registry。
- MotionSync / LipSync、Video Editor。
- 商用品質のモデル表現、販売用モデル品質、全身高品質リギング。

## 6. Domain ACとの対応

| MVP AC | 主対応Domain AC | 補助AC |
|---|---|---|
| AC-MVP-001 GUI Editor必須 | AC-WF-001, AC-WF-003 | AC-ROOT-004, AC-AI-006, AC-DOC-005 |
| AC-MVP-002 権利クリーン素材 | AC-RIGHTS-001, AC-RIGHTS-002, AC-SAMPLE-001, AC-SAMPLE-005 | AC-ROOT-007 |
| AC-MVP-003 入力素材受け入れ | AC-IN-001, AC-IN-002, AC-IN-006 | AC-SAMPLE-001 |
| AC-MVP-004 drawable / texture / part | AC-DRAW-001, AC-DRAW-002, AC-PART-001, AC-FORMAT-002 | AC-IN-002, AC-EXPORT-002 |
| AC-MVP-005 mesh生成・編集・整合性 | AC-MESH-001, AC-MESH-002, AC-MESH-003, AC-MESH-004 | AC-VALIDATOR-003 |
| AC-MVP-006 part管理とdraw order | AC-DRAW-003, AC-PART-001, AC-PART-002, AC-PART-004 | AC-VIEWER-004 |
| AC-MVP-007 clipping / mask | AC-DRAW-004, AC-VALIDATOR-003 | AC-RUNTIME-004, AC-VIEWER-004 |
| AC-MVP-008 parameter / keyform / 補間 | AC-PARAM-001, AC-PARAM-002, AC-PARAM-003, AC-PARAM-004, AC-PARAM-005, AC-PARAM-006, AC-PARAM-007 | AC-RUNTIME-002, AC-RUNTIME-003 |
| AC-MVP-009 deformer / 階層 / 接続 | AC-DEF-001, AC-DEF-002, AC-DEF-003, AC-DEF-004, AC-DEF-005 | AC-PARAM-003, AC-PARAM-007 |
| AC-MVP-010 チュートリアル1-5相当可動 | AC-FACE-001, AC-FACE-003, AC-FACE-004, AC-FACE-007, AC-FACE-008, AC-BODY-001, AC-BODY-002, AC-BODY-003, AC-BODY-005 | AC-DEF-004, AC-PARAM-005 |
| AC-MVP-011 preview / 保存 / 再読み込み | AC-EXPORT-001, AC-EXPORT-002, AC-EXPORT-004, AC-EXPORT-005 | AC-FORMAT-005, AC-IN-003 |
| AC-MVP-012 Runtime / Viewer | AC-RUNTIME-001, AC-RUNTIME-002, AC-RUNTIME-003, AC-RUNTIME-004, AC-RUNTIME-005, AC-VIEWER-001, AC-VIEWER-002, AC-VIEWER-004 | AC-SDK-002, AC-SDK-003 |
| AC-MVP-013 Validator report | AC-VALIDATOR-001, AC-VALIDATOR-002, AC-VALIDATOR-003, AC-VALIDATOR-004, AC-VALIDATOR-005 | AC-VERIFY-004, AC-VERIFY-006 |
| AC-MVP-014 AI Agent | AC-AGENT-001, AC-AGENT-002, AC-AGENT-003, AC-AGENT-004, AC-AGENT-005 | AC-AI-001, AC-AI-003, AC-AI-005, AC-AI-007 |
| AC-MVP-015 Cubism非依存 | AC-IN-005, AC-EXPORT-006, AC-RIGHTS-003, AC-WF-006 | AC-ROOT-006 |

## 7. Domain AC変更候補

このMVP再定義により見つかった Domain AC 側の不足や文言整理候補を記録する。ここでは Domain AC 本体を直接編集しない。

| 候補 | 理由 |
|---|---|
| `AC-EDITOR` または既存Domain内に GUI Editor 必須ACを追加 | Domain ACには Open Editor の制作UI、選択、preview、保存、再編集の一周を直接扱う専用Domainがない。Root ACにはあるが、MVPの実装判断にはDomain粒度のACが欲しい |
| `AC-WF` に「CLI/script/AI操作だけでは制作MVP達成としない」を明記 | Workflow Independence はあるが、GUI authoring をMVP必須とする否定条件が薄い |
| `AC-PART` または `AC-DRAW` に lock / hide / select の制作支援状態を明記 | 現行ACは表示状態とパーツ構造中心で、GUI制作中の lock/select と runtime表示状態の分離が明示不足 |
| `AC-DEF` に parameter接続の独立ACを追加 | 既存mapでも候補化済み。MVPでは deformer が parameter / keyform に接続されることが必須である |
| `AC-FACE` に顔Z / AngleZ 相当の扱いを明記 | 現行の顔向きACが X/Y/Z のどこまでを含むか曖昧である |
| `AC-BODY` に腕、体上下、体傾きの最小可動を明記 | 現行ACは身体姿勢変化として広いが、MVPのチュートリアル相当可動では具体部位が必要である |
| `AC-VALIDATOR-005` にMVP report語彙を明文化 | status、severity、target ID、AC/scenario links、evidence、repair candidate、provenance はMVPで必須のため、Domain AC側にも語彙を固定する候補がある |
| `AC-SAMPLE` にMVP用レイヤー素材・分割画像fixtureを明記 | sample model set はあるが、GUI Editor の入力素材fixtureとしてのPSD/分割画像セットを明示するとMVP検証が安定する |

## 8. MVP完了判定

MVPは、次のすべてを満たしたときに完了とする。

1. 権利的にクリーンな素材から、GUI Editor でMVPミニモデルを制作できる。
2. GUI Editor で、入力、drawable / texture / part、mesh、draw order、clipping、parameter、keyform、deformer、チュートリアル1-5相当可動を編集できる。
3. GUI Editor preview で、代表parameterの変化を確認できる。
4. Open Model Package として保存し、GUI Editor で再読み込みできる。
5. Open Runtime / Viewer で読み込み、parameter操作に応じた表示と runtime state を確認できる。
6. Open Package Validator が構造化レポートを出力できる。
7. AI Agent が観測、編集operation、diff、validation report を構造化して扱える。
8. `.cmo3` 復元、`.moc3` 互換出力、Cubism SDK/Core 必須依存なしで一周できる。
