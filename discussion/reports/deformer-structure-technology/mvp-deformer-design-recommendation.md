# MVP Deformer Design Recommendation

> 状態: Preliminary recommendation
> 対象: Open 2D Character Rigging Stack MVP の rotation / warp deformer 相当構造
> 前提: 本レポートは独立した推奨パスであり、`cubism-observable-deformer-semantics.md` と `open-deformation-algorithm-candidates.md` が存在することを仮定しない。

## 1. 位置付け

このレポートでは、MVP AC とシナリオをオラクルとして、Open 2D Character Rigging Stack が MVP で露出すべき deformer 相当構造を提案する。

Cubism 公式資料と一般的な変形アルゴリズムは参考資料であり、Cubism の内部実装や互換出力を Open 2D Character Rigging Stack の正とはしない。

## 2. Repository facts

- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPを「GUI Editor で制作し、保存し、Runtime / Viewer で表示し、Validator と AI Agent が検証できる Authoring-to-Runtime 一周」と定義している。
- `AC-MVP-009` は、GUI Editor が warp / rotation 相当 deformer、親子階層、対象 drawable または子 deformer、回転中心または制御格子、parameter / keyform 接続を扱えることを要求している。
- `AC-MVP-010` は、まばたき、眉、口開閉、顔Z、体上下 / 傾き、腕、髪揺れ、顔 Angle X / Y を MVP ミニモデルで制作、保存、再読み込み、Preview、Runtime 評価できることを要求している。
- `AC-MVP-012` は、Runtime / Viewer が parameter 操作に応じて評価済み drawable state、vertex、visibility、opacity、draw order、mask 状態、diagnostics を構造化 runtime state として取得できることを要求している。
- `AC-MVP-013` は、Validator が deformer 相当構造、親子階層、parameter 接続、runtime load test、代表 parameter 評価を構造化レポートとして出力できることを要求している。
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md` は、回転的変形と面変形の区別、局所変形と大域変形の分離、親子伝播、検証可能性を要求している。
- `discussion/scenarios/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md` は、前髪の warp、頭部の rotation、親 rotation 配下の局所 warp、はみ出し検出、parameter 接続検証を代表シナリオとしている。
- `discussion/design/initial-design-decisions-and-open-questions.md` は、Validator MVP を解析的に判定可能な不可解状態の検出中心に置き、Operation log を Open Model Package に組み込む方向としている。
- `discussion/reports/deformer-structure-technology/_map.md` は、MVP warp 補間方式、Cubism のベジェ分割数相当、rotation を pivot 付き 2D affine transform と見なせるかを未決事項としている。

## 3. Official / reference facts

- Live2D Cubism 公式資料では、deformer は複数頂点をまとめて編集するための構造として説明され、warp deformer と rotation deformer が区別されている。
- Cubism の warp deformer は、親にした object をまとめて面状に変形し、作成時に変換分割数、ベジェ分割数、サイズなどを指定する。
- Cubism の rotation deformer は、object の親として設定し、角度、位置、ハンドル長、標準角度を調整して内部 object を回転させる。
- Cubism の親子階層では、親 deformer の変形は子へ伝播するが、子の変形は親へ逆伝播しない。
- Cubism には、親 warp deformer からはみ出した子頂点や空 deformer を検出・選択する制作支援機能がある。
- 一般的な Free-Form Deformation は、対象を格子または制御 hull に埋め込み、制御点の変位から内部形状を変形する考え方である。
- Moving Least Squares 系の画像変形は、制御点または線分に基づく滑らかな変形を提供できるが、MVP に必須とするには評価コスト、実装複雑度、操作予測性の確認が必要である。

## 4. Assumptions

- MVP の主対象は 2D キャラクターモデルであり、3D 回転、奥行き推定、物理シミュレーション、Cubism 互換出力は MVP 外である。
- MVP では、Editor preview と Viewer / Runtime が同じ評価セマンティクスを共有するべきである。少なくとも同一 package と同一 parameter 値から、同じ評価済み vertex state を得られる必要がある。
- MVP deformer は、制作上の意味を持つ graph node として保存する。Runtime 用に焼き込まれた最終 vertex だけを保存する方式は、GUI 再編集、Validator、AI diff の要件を満たしにくい。

## 5. Design recommendation

### 5.1 Summary

MVP では、deformer 相当構造を次の 2 種類として露出することを推奨する。

| 種別 | MVPで露出する概念 | 推奨 |
|---|---|---|
| rotation deformer equivalent | pivot-based 2D transform node | 採用。GUI上は「回転中心と角度ハンドルを持つ回転的変形」として露出し、内部表現は pivot 付き 2D affine transform にする。ただし MVP GUI では任意 shear を直接露出しない。 |
| warp deformer equivalent | 2D control lattice deformation node | 採用。GUI上は矩形または局所 domain を持つ制御格子として露出し、対象 mesh 頂点を格子変形で移動する。補間方式は最終未決だが、schema では方式と version を必ず明示する。 |

この 2 種は、`kind` を明示した deformer graph node として扱う。どちらも drawable または子 deformer を child として持てる。親 node の評価結果は子へ伝播し、子の編集は親 node の状態を変更しない。

### 5.2 Rotation deformer equivalent

MVP の rotation 相当は、`rotation2d` node として露出する。

推奨する最小機能:

- 回転中心 `pivot` を持つ。
- 標準角度または rest angle を持つ。
- keyform ごとに `angle` を持つ。
- 必要に応じて `translation` と `scale` を持てる。ただし MVP の主操作は回転であり、GUIで任意 matrix / shear editor は出さない。
- handle length は制作 UI 用の状態として保存できる。ただし Runtime の見た目評価に必須ではない。
- child drawable / child deformer に対して、親から子への 2D transform を合成する。
- parameter / keyform 接続により、`ParamAngleZ`、腕回転、体傾きなどの連続値で評価される。

暫定仮説「rotation deformer equivalent = pivot-based 2D affine transform」は、MVP ではおおむね妥当である。ただし、最終判断では「どこまでを affine として許すか」を分けるべきである。

- Runtime 内部: pivot 付き 2D affine matrix に展開してよい。
- 保存形式: 任意 matrix だけではなく、`pivot`、`angle`、`scale`、`translation` という意味フィールドを優先して保存する。
- GUI: 回転中心、角度ハンドル、標準角度、scale handle まではよい。shear や任意 matrix 数値編集は MVP 外に置く。

### 5.3 Warp deformer equivalent

MVP の warp 相当は、`warpLattice2d` node として露出する。

推奨する最小機能:

- rest pose の 2D domain を持つ。MVP では矩形 domain を基本にする。
- control lattice を持つ。最小は `2 x 2`、実用初期値は `3 x 3` または `5 x 5` を候補にする。
- control point は rest position と keyform position を持つ。
- child drawable の mesh vertex は、rest domain 内の bind coordinate を介して lattice deformation を受ける。
- child deformer は、親 warp の変形後の空間に配置される。
- parameter / keyform 接続により、まばたき、髪揺れ、顔 Angle X / Y の面状変形を評価できる。
- interpolation method は `interpolationMethod` と `interpolationVersion` として明示する。

暫定仮説「warp deformer equivalent = 2D control lattice deformation」は、MVP の制作能力要件に合っている。ただし、補間方式は最終決定を急がない。

暫定の実装候補としては、以下の順で検討する。

| 候補 | MVP適性 | 注意点 |
|---|---:|---|
| bilinear grid / piecewise bilinear lattice | 高 | 実装と検証が単純。曲線的な見た目は弱い可能性がある。 |
| bicubic / Bezier patch lattice | 中 | Cubism のベジェ分割数語彙に近いが、編集 UI と境界条件が増える。 |
| MLS / ARAP 系 | 低から中 | 品質は期待できるが、MVP の deterministic Runtime、Validator、GUI 操作予測性の確認が重い。 |

MVP 推奨は「schema と GUI は control lattice deformation として固定し、具体補間方式は algorithm-candidates 側の検証で確定する」である。実装を先に進める必要がある場合のみ、`bilinear-grid-v1` を provisional baseline として採用する。

## 6. Proposed minimal schema sketch

実装コードではなく、Open Model Package に保存すべき最小概念を示す。

| Concept | Required fields | Notes |
|---|---|---|
| Deformer node | `id`, `name`, `kind`, `partId`, `parentId`, `childIds`, `targetDrawableIds`, `localSpace`, `restBounds`, `enabled` | `kind` は `rotation2d` または `warpLattice2d`。`childIds` は drawable と deformer の参照を区別できること。 |
| Deformer hierarchy | parent-child edge list, evaluation root order | 循環検出、差分、AI inspection のため、暗黙順序だけにしない。 |
| Rotation definition | `pivot`, `restAngle`, `restTranslation`, `restScale`, optional `handleLength`, constraints | 保存は意味フィールド優先。Runtime は 2D affine matrix に展開できる。 |
| Rotation keyform state | `parameterId`, `keyValue`, `angle`, optional `translation`, optional `scale` | 複数 parameter 合成の詳細は未決。MVP では少なくとも 1 parameter axis の keyform を確実に扱う。 |
| Warp definition | `domainBounds`, `latticeColumns`, `latticeRows`, `restControlPoints`, `interpolationMethod`, `interpolationVersion` | Cubism の `conversion divisions` / `Bezier divisions` と同名にしない。必要なら参考 metadata として別保持する。 |
| Warp keyform state | `parameterId`, `keyValue`, `controlPointPositions`, optional `domainBoundsOverride` | keyform は control point の位置差分または全点 snapshot のどちらかを選ぶ必要がある。MVP は検証容易性を優先して全点 snapshot を推奨する。 |
| Vertex binding | drawable mesh vertex id to deformer local bind coordinate | Runtime が keyform ごとに再バインドしないよう、rest pose での対応を保存する。 |
| Parameter binding | `parameterId`, `targetDeformerId`, key list, interpolation policy | `parameter` と `keyform` の既存設計と整合させる。 |
| Evaluation metadata | `evaluationOrderPolicy`, numeric precision note, invalid-state handling | Editor preview、Viewer、Validator の一致に必要。 |
| Authoring metadata | creation operation id, last edited operation id, UI state needed for editing | Operation log / provenance と接続する。Runtime に不要な UI 状態は分離する。 |

Open Model Package 内のファイル分割は別設計事項だが、少なくとも deformer definition、keyform state、operation log、validation report から同じ stable ID を参照できる必要がある。

## 7. GUI Editor must support directly

MVP GUI Editor は、次を直接サポートする必要がある。script や手書き JSON だけでは MVP 達成にしない。

- deformer node の作成、命名、削除、選択、複製。
- drawable または child deformer を選択し、rotation / warp node の子として追加する操作。
- deformer hierarchy の確認、reparent、親子伝播の preview。
- rotation node の pivot 移動、角度ハンドル操作、標準角度設定、keyform 登録。
- warp node の domain サイズ調整、lattice 解像度設定、control point 移動、keyform 登録。
- parameter slider と keyform 編集を通じた deformer state の編集。
- 代表 parameter 値での preview。少なくとも `ParamEyeOpen`、`ParamMouthOpenY`、`ParamAngleX`、`ParamAngleY`、`ParamAngleZ` 相当を確認できること。
- 子要素が親 warp domain からはみ出す状態、空 deformer、未接続 parameter などの inline warning 表示。
- lock / hide / select と runtime visibility の分離。
- undo / redo と operation log への記録。
- AI Agent が stable ID を使って同じ対象を指せる inspection view。

## 8. Runtime must evaluate

Runtime は、GUI Editor で保存した Open Model Package を正として、次を評価する必要がある。

- package から deformer graph、parameter、keyform、drawable mesh、mask、draw order を読み込む。
- parameter 値を範囲内に clamp または diagnostics 付きで扱う。
- keyform 間の補間により、各 deformer node の評価済み state を得る。
- parent before child の順序で deformer graph を評価する。
- `rotation2d` は pivot 付き 2D affine transform として評価し、子の vertex / child coordinate に合成する。
- `warpLattice2d` は指定された interpolation method / version に従い、child mesh vertex を変形する。
- 複数 deformer 階層を通った最終 vertex を drawable state として返す。
- visibility、opacity、draw order、mask state と deformed vertex を合わせて描画できる。
- Editor preview と Viewer で同じ評価結果を得られるよう、Runtime 評価関数を共有または同等性テストで固定する。
- runtime state snapshot として、parameter 値、deformer evaluated state、drawable final vertex、diagnostics を取得できる。

## 9. Validator can detect analytically

Validator MVP は、目視品質ではなく、構造的に判定できる不整合を中心に検出する。

| Check | Severity proposal | Analytic basis |
|---|---|---|
| deformer ID 欠落、重複、不正文字 | Fail | schema / ID table |
| parent / child 参照切れ | Fail | reference graph |
| 親子循環 | Fail | graph cycle detection |
| Runtime 評価順序が定まらない graph | Fail | topological sort failure |
| 空 deformer | Warning | child count |
| parameter 未接続 deformer | Warning or Fail in MVP review profile | parameter binding absence |
| 存在しない parameter ID / keyform target | Fail | reference table |
| keyform value が parameter 範囲外 | Fail or Warning | numeric range |
| rotation pivot / angle / scale が NaN または infinite | Fail | numeric validation |
| rotation transform が singular または過度に縮退 | Warning or Fail | determinant / threshold |
| warp lattice の rows / columns が最小未満 | Fail | schema rule |
| warp control point 欠落、NaN、重複異常 | Fail or Warning | array length / numeric checks |
| warp cell の反転、自己交差、極端な面積縮退 | Warning or Fail | signed area / orientation |
| child vertex が親 warp domain 外 | Warning | bind coordinate / bounds |
| deformer hierarchy の局所 / 大域意図と対象 part の不整合 | Needs review | rule-based heuristic |
| representative parameter evaluation で runtime load 不能 | Fail | runtime load test |
| Editor preview と Runtime snapshot の代表値差分 | Fail | deterministic comparison |

Validator は、髪揺れの美しさ、顔 Angle X / Y の自然さ、商用品質のリギング完成度までは解析的に保証しない。これらは acceptance scenario の目視確認または将来の品質指標に分ける。

## 10. Rationale

MVP AC は、deformer を Cubism 互換ファイルの再現ではなく、GUI authoring、保存、Runtime 評価、Validator / AI inspection をつなぐ制作構造として要求している。そのため、MVP の deformer は「最終 vertex の焼き込み」ではなく、意味を持つ graph node として保存する必要がある。

rotation 相当を pivot-based 2D transform node にする理由は、頭部の顔Z、腕、体傾きなど、形を潰さず回転的に扱う制作要求に対して、もっとも少ない概念で Runtime と Validator を安定させられるためである。Cubism 公式資料も、線形補間だけで大きく回転すると縮みが起きるため rotation deformer を使う、という制作上の区別を示している。

warp 相当を 2D control lattice deformation にする理由は、顔 Angle X / Y、髪揺れ、まばたき、局所形状補正のような面状変形を、複数 drawable / child deformer に対して一体的に適用できるためである。格子は GUI 編集、保存、diff、Validator のどれにも向く。

一方、補間方式は MVP の最終判断を止める論点である。bilinear は単純で検証しやすいが、曲線的な品質が不足する可能性がある。Bezier / bicubic は品質候補だが、編集 UI と Runtime 実装が重い。MLS / ARAP 系は参考価値があるが、MVP の deterministic authoring-to-runtime 一周には過剰になりやすい。

## 11. MVP vs Post-MVP

| Area | MVP | Post-MVP |
|---|---|---|
| rotation equivalent | pivot、angle、standard angle、optional translation / scale、親子伝播 | 任意 affine editor、shear、3D rotation helper、IK / bone-like controls |
| warp equivalent | 2D rectangular control lattice、control point keyforms、deterministic interpolation method | Cubism 類似の Bezier 分割再現、高度な lattice refinement、MLS / ARAP、cage deformation |
| hierarchy | drawable / deformer の parent-child graph、cycle prevention | constraints、multi-parent influence、weighted binding |
| keyform | 1 parameter axis の keyform 補間を確実に成立させる | 複数 parameter の高次元 blend、extended interpolation、blend shape 高度機能 |
| GUI | 作成、reparent、pivot / lattice 編集、parameter 接続、warning | auto generation、template rig、mirror、advanced brushes |
| Runtime | deterministic 2D evaluation、state snapshot、Viewer slider | physics、motion timeline、tracking input、external app API |
| Validator | schema、参照、循環、bounds、NaN、代表 runtime load | 見た目品質評価、自動修復、高度な performance profiler |
| Compatibility | Cubism 非依存の Open Model Package | `.cmo3` 復元、`.moc3` / `.model3.json` 互換出力、Cubism migration |

## 12. Risks

Final decision をブロックすべき未確定リスク:

- warp 補間方式が未決である。MVP の見た目、Runtime 性能、Validator の反転検出、将来の package 互換性に直接影響する。
- multi-parameter keyform 合成の仕様が未決である。顔 Angle X / Y と斜め方向をどう評価するかが曖昧なままだと、Runtime と Editor preview がずれる。
- coordinate space と bind coordinate の定義が未決である。親子 deformer、drawable mesh、texture UV、canvas coordinate の境界を固定しないと、保存再読み込みと AI diff が壊れやすい。
- rotation node に scale / translation をどこまで含めるかが未決である。少なすぎると制作力が落ち、多すぎると rotation と generic transform の境界が崩れる。
- Cubism の `conversion divisions` / `Bezier divisions` と Open Stack の lattice schema をどう対応付けるかが未決である。名前だけ借りると互換性を誤認させる。
- Runtime の数値決定性が未検証である。Editor preview、Viewer、Validator runtime load test が同じ結果を出す必要がある。
- GUI 操作量が MVP に対して過大になる可能性がある。特に warp lattice keyform 編集、reparent、warning、operation log を同時に成立させる必要がある。

Final decision をブロックしないが追跡すべきリスク:

- bilinear baseline は顔 Angle X / Y の品質が不足する可能性がある。
- warp domain 外にはみ出した子要素を Warning にするか Fail にするかは profile によって変える必要がある。
- deformer opacity や deformer-level visibility を MVP に含めるかは、drawable opacity / visibility との責務分離を確認してから決めるべきである。

## 13. Validation checklist

MVP 実装または設計レビューで最低限確認する項目:

- [ ] GUI Editor で `rotation2d` node を作成し、頭部または腕を child に設定できる。
- [ ] GUI Editor で `rotation2d` の pivot、angle、standard angle を編集し、parameter keyform に保存できる。
- [ ] GUI Editor で `warpLattice2d` node を作成し、前髪、目、顔部位など複数 drawable を child に設定できる。
- [ ] GUI Editor で warp lattice control point を keyform ごとに編集できる。
- [ ] deformer hierarchy と child target を stable ID で inspection できる。
- [ ] Open Model Package 保存後、Editor 再読み込みで deformer definition、hierarchy、keyform state、parameter binding が保持される。
- [ ] Runtime / Viewer で parameter slider を動かすと、評価済み deformer state と drawable vertex が連続的に変化する。
- [ ] Editor preview と Viewer が代表 parameter 値で同じ vertex state を返す。
- [ ] Validator が cycle、missing target、missing parameter、empty deformer、out-of-bounds child vertex、NaN / infinite、runtime load failure を構造化 report に出せる。
- [ ] AI Agent が deformer ID、parameter ID、keyform ID を指定して dry-run diff を取得できる。
- [ ] Cubism Editor、Cubism SDK/Core、`.moc3` なしで上記が成立する。

## 14. Open questions

- MVP warp の最終補間方式を `bilinear-grid-v1` に固定するか、Bezier / bicubic 系を採用するか。
- 顔 Angle X / Y の斜め方向は、2 parameter blend の正式仕様まで MVP に含めるか、代表的な composite keyform だけで成立とみなすか。
- rotation node の `scale` と `translation` は Runtime 評価必須にするか、GUI 制作用 metadata から始めるか。
- deformer-level opacity / visibility を持つか、MVP では drawable / keyform 側に限定するか。
- warp lattice の keyform state は全 control point snapshot と delta のどちらを正にするか。暫定推奨は全点 snapshot だが、diff サイズと操作ログの扱いを確認する必要がある。
- 親 warp domain からの child vertex はみ出しを通常 Validator では Warning、MVP review profile では Fail にするか。
- Operation log は deformer definition と同じ package ファイル内に置くか、別ファイルに分離して single responsibility を保つか。
- Open Stack 独自の標準 parameter alias と Cubism 参考 alias をどの層で保持するか。

## 15. Source URLs

Cubism 公式参考:

- About Deformers: https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Warp Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
- Rotation Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
- Parent-Child Hierarchy Structure: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/
- Validate Deformer Function: https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/
- About Parameters: https://docs.live2d.com/en/cubism-editor-manual/parameter/
- Add/Delete Keys to/from Parameters: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
- Parameter Operation: https://docs.live2d.com/en/cubism-sdk-manual/parameters/

一般アルゴリズム参考:

- Sederberg, T. W. and Parry, S. R., "Free-Form Deformation of Solid Geometric Models", SIGGRAPH 1986, DOI: https://doi.org/10.1145/15886.15903
- Schaefer, S., McPhail, T., and Warren, J., "Image Deformation Using Moving Least Squares", 2006: https://people.engr.tamu.edu/schaefer/research/mls.pdf
