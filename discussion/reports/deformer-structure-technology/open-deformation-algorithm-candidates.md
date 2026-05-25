# Open deformation algorithm candidates

作成日: 2026-05-25

## 1. 位置付け

このレポートは、Open Live2D Stack が Cubism 内部実装を複製せずに、deformer 相当構造を open / implementable / GUI-editable / runtime-friendly / AI-readable に設計するためのアルゴリズム候補を比較する。

対象は主に次の2系統である。

- rotation deformer 相当: pivot 付き 2D affine transform。
- warp deformer 相当: 制御格子、lattice / grid free-form deformation、bilinear / bicubic / Bezier patch、MLS、cage / mean value coordinates。

この文書は設計判断の材料であり、最終決定ではない。

## 2. Repository facts

参照したリポジトリ文書:

- [discussion/_conventions.md](../../_conventions.md): 議論文書では公式事実、リポジトリ事実、仮説、設計判断、実験結果、未決事項を分離する。
- [discussion/reports/deformer-structure-technology/_map.md](_map.md): このトピックは Cubism の観測可能な deformer semantics、Open実装可能な変形アルゴリズム候補、MVP採用案を分けて調査する。
- [discussion/design/initial-design-decisions-and-open-questions.md](../../design/initial-design-decisions-and-open-questions.md): MVP は GUI Editor 必須の Authoring-to-Runtime 一周を前提とし、deformer相当構造の技術的正体が要調査になっている。
- [discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md): MVP は GUI Editor で deformer相当構造、parameter / keyform、preview、保存、Runtime / Viewer、Validator、AI Agent が一周できることを求める。Cubism SDK/Core 依存はMVP条件にしない。
- [discussion/acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md): 変形制御構造は、子 drawable / 子 deformer、局所変形と大域変形、回転的変形と面変形、親子階層、検証可能な情報を扱う必要がある。

## 3. Official / primary facts

- W3C CSS Transforms Level 1 は、transform-origin を原点へ移動し、transform functions を適用し、原点移動を戻す行列計算を定義している。また、親から子へ変換行列が累積する。これは Open Live2D Stack の runtime 仕様そのものではないが、pivot付き affine transform と階層合成を説明する公開仕様上の根拠として使える。  
  Source: https://www.w3.org/TR/css-transforms-1/
- Khronos WebGL 1.0 仕様は、WebGL が ECMAScript から Canvas 経由で使う OpenGL ES ベースの低レベル3D APIであり、頂点・index・texture 等のデータ転送に Typed Array を使うこと、WebGL 1.0 / OpenGL ES 2.0 では double precision floating-point をサポートしないことを示す。deformer runtime は Float32 前提の許容誤差と診断を持つべきである。  
  Source: https://registry.khronos.org/webgl/specs/1.0.0/
- Sederberg and Parry の Free-Form Deformation は、モデルを格子内に埋め込み、Bernstein polynomial によって global / local な自由変形を与える手法である。原典は3D solid geometric models向けであり、2D drawable warp の直接仕様ではなく、制御格子型変形の背景技術として扱うべきである。  
  Source: https://doi.org/10.1145/15886.15903
- Schaefer, McPhail, Warren の Moving Least Squares image deformation は、ユーザーが点または線分ハンドルを動かし、affine / similarity / rigid 変換クラスの MLS で画像変形を構成する。論文は closed-form solution と real-time deformation を主張している。  
  Source: https://people.engr.tamu.edu/schaefer/research/mls.pdf
- Hormann and Floater の mean value coordinates for arbitrary planar polygons は、自己交差しない任意の平面多角形に対して mean value coordinates が定義でき、滑らかで効率的に実装でき、polygon 頂点値の補間や image warping に利用できることを示す。  
  Source: https://www.inf.usi.ch/hormann/papers/Hormann.2006.MVC.pdf
- Ju, Schaefer, Warren の closed triangular meshes 向け mean value coordinates は、座標が interior で smooth、triangle 上で linear、linear function を再現でき、surface deformation に使えることを示す。2D cage deformation の直接候補というより、cage / generalized barycentric coordinates 系の背景として扱う。  
  Source: https://doi.org/10.1145/1073204.1073229

## 4. Secondary / implementation references

- OpenGL Programming Guide の evaluators 章は、Bezier curve / surface patch を parameter `u` / `v` の vector-valued function として説明し、Bernstein polynomial と control points による評価を示す。これは一次論文ではないため二次・実装ガイド扱いだが、bicubic / Bezier patch 型候補の用語整理には有用である。  
  Source: https://book.huihoo.com/opengl-programming-guide-version-1.1/chapter12.html

## 5. Engineering assumptions

- Open Live2D Stack の deformer は、opaque な Cubism互換構造ではなく、`id`、`kind`、`parentId`、`targetIds`、`bounds`、`controlPointIds`、`restState`、`keyformState`、`evaluatorVersion` を持つ、検証可能なデータ構造として設計する。
- Runtime は Editor preview と Viewer で同じ評価セマンティクスを共有する前提にする。CPU / WebGL の差は許容誤差と diagnostics で扱う。
- Diff と operation log の読みやすさを優先し、基本的には raw matrix だけを保存しない。affine は角度・scale・translation・pivotを一次データにし、matrix は派生値にする。
- Warp は target mesh vertex を直接書き換えるだけではなく、「deformer の制御データから評価済み vertex を生成できる」構造を保つ。これにより AI Agent が原因、操作、検証結果を追跡できる。
- MVPでは商用品質の変形表現より、GUIで制作・保存・再編集・runtime評価・validationできる最小の構造を優先する。
- このレポートでは性能ベンチマークは行っていない。性能評価はアルゴリズムの計算量と WebGL 実装容易性に基づく見積もりである。

## 6. Candidate notes

### 6.1 Pivot-based 2D affine transform

rotation deformer 相当の第一候補。deformer node に pivot `c=(cx, cy)`、translation `t`、rotation `theta`、optional scale / shear を持たせ、代表式を `p' = T(t) T(c) A T(-c) p` とする。`A` は MVP では rotation + optional uniform / non-uniform scale までに限定できる。

GUI適性は高い。ユーザーは pivot をドラッグし、回転ハンドルで角度を変え、keyform ごとに値を保存できる。Undo / redo は `movePivot`、`setRotation`、`setTranslation` のような小さな operation に分解できる。AI Agent にとっても、角度、中心、対象IDが読めるため説明しやすい。

Runtime適性も高い。各 vertex に 3x3 行列を一回適用すればよく、親子階層は CTM として合成できる。WebGL では uniform matrix または CPU side pre-evaluation のどちらでも扱える。

Validator は、finite number、pivot の bounds、scale が 0 または極小でないこと、determinant、target ID 存在、親子循環、評価後 bounds / protrusion を検出できる。MVPで入れないと後から hierarchy / keyform / runtime state の基礎を作り直す可能性が高い。

### 6.2 Lattice / grid based free-form deformation

warp deformer 相当の主候補。矩形または局所座標系の control lattice を作り、各 mesh vertex に rest lattice coordinate `(u, v)` と cell index を関連付け、keyform ごとの control point displacement から評価済み vertex を得る。

GUI適性は高い。制御点を直接ドラッグでき、grid resolution を 2x2、3x3、4x4 のように明示できる。Undo / redo は制御点単位の移動操作として記録できる。操作ログも `moveControlPoint(deformerId, pointId, from, to)` のように構造化しやすい。

Runtime適性は補間方式に依存する。bilinear なら各 vertex は4点参照で済む。bicubic / Bezier patch なら16点参照または隣接patch連続性が必要になり、GUIとValidatorが重くなる。

Model format は、grid size、rest bounds、control point stable IDs、keyformごとの offset を保存すれば diff しやすい。Validator は grid dimension、重複点、NaN、cell foldover、対象vertexが範囲外に出すぎる状態、親子循環、parameter未接続を検出できる。

### 6.3 Bilinear interpolation on a control lattice

MVP warp の最有力補間候補。cell 内の局所座標を `s,t in [0,1]` とし、4隅の変形後制御点を `P00,P10,P01,P11` とすると、代表式は次になる。

```text
P(s,t) =
  (1-s)(1-t)P00 +
  s(1-t)P10 +
  (1-s)tP01 +
  stP11
```

長所は、実装が短く、決定的で、GUI上の結果が予測しやすく、control point と評価結果の対応を説明しやすいことである。各 cell の共有 control point を使えば位置は連続する。一方で導関数は cell 境界で連続とは限らず、滑らかな曲面変形には見えにくい場合がある。

Validator は、各 cell の4点が finite であること、極端につぶれていないこと、foldover が起きていないことを検査する。foldover は厳密判定が難しい場合でも、corner / center / edge midpoint の Jacobian 符号サンプルを MVP 診断として使える。

MVPでは、bilinear を `gridWarp.bilinear.v1` のように evaluator version 付きで固定し、将来 bicubic / cage を追加しても deformer node / keyform / hierarchy は変えない形にするのがよい。

### 6.4 Bicubic / Bezier patch style interpolation

4x4 control points の tensor-product Bernstein / Bezier patch、または bicubic spline grid として設計できる。bilinear より滑らかな変形を作りやすく、表情や髪の連続的な曲がりには有利になり得る。

ただし GUI 編集では、1つの見た目に16点以上の制御点が効くため、初心者の直接操作と operation log が複雑になる。隣接patch間の C1 / C2 連続性を求めると、制御点制約、境界条件、patch 分割の説明が必要になる。Runtime は WebGL で実装可能だが、per-vertex 参照点数と evaluator 分岐が増える。

MVPに入れる必要性は低い。ただし、model format には `interpolation` / `evaluatorVersion` を持たせ、bilinear から bicubic へ拡張できる余地を残すべきである。

### 6.5 Sederberg-Parry Free-Form Deformation

FFD の原典は、3D object を lattice に埋め込み、Bernstein polynomial で自由変形する背景技術である。Open Live2D Stack の 2D warp は、この考え方を「2D制御格子に対象meshをbindする」という形で縮約して使える。

原典のまま trivariate FFD をMVPへ入れる必要はない。3D lattice、volume preservation、任意次数の導関数連続性は、MVPの GUI authoring / validation 範囲を超える。背景としては有用だが、採用対象は 2D grid warp evaluator として再設計する。

### 6.6 Moving Least Squares image deformation

MLS は、ユーザーが点または線分ハンドルを移動し、各評価点ごとに局所的な affine / similarity / rigid transformation を最小二乗で求める。直接操作の感触は良く、固定格子に縛られないため、補正・修復・スケッチ的な変形ツールとして魅力がある。

一方、runtime deformer としては注意が必要である。評価点ごとに全 handle または近傍 handle を参照し、重み関数、同一点、handle重複、特異行列、極端な距離での数値問題を扱う必要がある。制御構造の diff は handle 単位で読めるが、「どの局所範囲がどのように変形するか」は lattice より説明しにくい。

MVPの中核 runtime evaluator にはしない方がよい。将来候補としては、GUI上の advanced warp tool、AI repair proposal、または編集時に grid / mesh keyform へ bake する補助アルゴリズムが適している。

### 6.7 Cage deformation / mean value coordinates

cage deformation は、対象 drawable / part を多角形 cage で囲み、内部 vertex に cage vertex の重みを割り当て、cage の変形から内部点を補間する方式である。mean value coordinates は、三角形の barycentric coordinates を一般多角形へ拡張する代表的手法であり、非矩形の部位や髪束のような形状には grid より自然な UI になり得る。

Runtime は、bind 時に各 mesh vertex の cage weights を前計算すれば、評価時は `sum(weight_i * cagePoint_i)` で済む。cage vertex 数が少なければ十分軽い。Model format は cage vertex IDs と weights を保存するか、source cage から再計算するかを決める必要がある。weightsを保存するとdiffが大きくなり、再計算にすると evaluator version と数値差分の扱いが重要になる。

Validator は、cage polygon の自己交差、極端に近い vertex、対象vertexが cage の内外どちらにあるか、boundary上の特異ケース、orientation、NaNを検出する必要がある。MVP first にはやや重いが、将来の非矩形 warp では有力候補である。

## 7. Comparison

| 候補 | GUI editing suitability | Runtime suitability | Model format suitability | Validator suitability | MVP suitability |
|---|---|---|---|---|---|
| Pivot-based 2D affine | pivot / rotation handle が直感的。undo は角度・中心・移動の小操作に分解しやすい。 | 3x3 matrix 適用で軽い。親子階層の合成も明確。WebGL / TS と相性が良い。 | angle / pivot / translation / scale を保存すれば diff とAI説明が読みやすい。 | finite、determinant、bounds、target ID、親子循環を検出しやすい。 | MVP必須候補。rotation相当の基礎として後回しにしにくい。 |
| Grid FFD + bilinear | 格子点ドラッグで分かりやすい。grid resolution もGUIで扱いやすい。 | 各vertex 4点参照で軽い。CPU / shader どちらでも実装しやすい。 | grid size、control point IDs、offset keyform が安定。diffも比較的読みやすい。 | grid寸法、NaN、cell foldover、はみ出し、範囲外bindを検出できる。 | MVP first warp 候補。表現力は限定的だが構造の土台になる。 |
| Grid FFD + bicubic / Bezier patch | 滑らかだが制御点の影響範囲が広く、直接操作の説明が難しくなる。 | 16点参照やpatch境界処理が増える。WebGL可だが実装量が増える。 | patch分割、境界連続性、basis情報が必要。diffはbilinearより重い。 | continuity、degenerate patch、foldover、境界制約の検証が必要。 | MVP外候補。format拡張口だけ確保する。 |
| Sederberg-Parry FFD background | 格子操作の概念は有用だが、原典の3D FFDをそのままGUIへ出すのは過剰。 | 任意次数・3D格子はMVP runtimeには過剰。2D縮約なら有用。 | 原典そのものではなく、Open Stack用 evaluator として再設計が必要。 | 高次・3Dにすると検証範囲が広がりすぎる。 | 背景技術。MVP採用単位ではなく、grid warp の思想的根拠。 |
| Moving Least Squares | 点・線分ハンドルの直接操作は強い。修復・スケッチ編集に向く。 | per-vertex x handles で重め。特異ケース処理が必要。 | handles は読めるが、影響範囲と評価結果の説明はgridより弱い。 | handle重複、距離0、特異行列、重み発散、NaN検出が必要。 | MVP中核にはしない。将来の編集ツールまたはbake補助候補。 |
| Cage / mean value coordinates | 非矩形部位には自然。cage vertex 操作は理解しやすい。 | weights前計算なら軽い。cage vertex数に比例。 | cage と weights の保存方針が設計課題。weights保存はdiffが大きい。 | 自己交差、orientation、inside/outside、boundary特異ケースの検証が必要。 | MVP外またはMVP+候補。将来の非矩形warp向けに設計余地を残す。 |

## 8. Recommendation candidates

### Candidate A: Minimal and stable

- `AffinePivotDeformer` を rotation 相当として採用する。
- `GridWarpDeformer` を warp 相当として採用し、MVP evaluator は `bilinear-v1` に固定する。
- bicubic / Bezier / MLS / cage は MVP 外に置くが、deformer node に `kind` と `evaluatorVersion` を持たせ、将来追加できるようにする。

利点は、GUI、runtime、format、validator、AI Agent の全てで最小一周を作りやすいことである。欠点は、滑らかさと高度な形状制御は初期表現力が低いことである。

### Candidate B: Bilinear first, smoothness escape hatch

- MVP runtime は Candidate A と同じ。
- format には `interpolation: "bilinear-v1"` を必須で保存し、将来 `bicubic-v1` を追加可能にする。
- GUIでは control lattice の操作モデルを bilinear / bicubic 共通に見せるが、MVP実装は bilinear のみ有効にする。

利点は、後で smooth warp を入れる時に package schema の破壊を避けやすいことである。欠点は、MVP時点で未実装 evaluator 名や migration policy を慎重に扱う必要があることである。

### Candidate C: Authoring tool separation

- Runtime evaluator は affine + bilinear grid に限定する。
- MLS や cage は runtime deformer ではなく、GUI編集時の「変形提案」「mesh/keyformへのbake」「AI修復候補」として導入する。

利点は runtime / validator を小さく保ちながら、将来の編集体験を拡張できることである。欠点は、bake結果の provenance と再編集性を別途設計する必要があることである。

## 9. MVP first candidate

現時点の MVP first candidate は、最終決定ではないが、次の組み合わせが最も低リスクである。

1. rotation 相当: `AffinePivotDeformer`
2. warp 相当: `GridWarpDeformer` with `bilinear-v1`
3. shared deformer node: `id`, `kind`, `parentId`, `targetIds`, `localBounds`, `bindSpace`, `parameterBindings`, `keyforms`, `evaluatorVersion`
4. control data: stable `controlPointId`、rest position、keyform offset、operation log transaction
5. validation: parent cycle、missing target、missing parameter、NaN / Infinity、degenerate scale、grid dimension、cell foldover sample、evaluated bounds / protrusion

この構成は、MVPの AC-MVP-009 と AC-DEF-001〜005 を満たすための最小構造になりやすい。加えて、後から bicubic / cage / MLS を追加しても、deformer hierarchy、parameter / keyform、operation log、validator report の大枠を変えずに済む可能性が高い。

## 10. Open questions

- `GridWarpDeformer` の bind space は、deformer local bounds、drawable mesh local coordinates、UV coordinates のどれを正とするか。
- MVP の初期 grid resolution は 2x2 で十分か、3x3 を標準にするべきか。顔・体の warp 相当を検証するミニモデルで要確認。
- bilinear cell foldover を Validator でどこまで厳密に扱うか。MVPではサンプル点診断でよいか、Jacobian の解析判定まで必要か。
- affine と grid warp の評価順序をどう固定するか。親 affine -> 子 warp -> drawable mesh なのか、deformer tree の preorder 合成として一般化するのか。
- keyform 間補間と deformer evaluator の責務境界をどう分けるか。制御点 offset を補間してから evaluator を走らせる方式が第一候補だが、仕様化が必要。
- WebGL と TypeScript CPU evaluator の数値差を Validator / runtime diff でどの許容誤差にするか。
- cage / MVC を将来 runtime deformer として入れるか、authoring-time bake tool に限定するか。
- MLS を runtime evaluator として保存可能にする必要があるか、それとも編集補助・修復候補に限定するか。
- Operation log はドラッグ中の全 point move を記録するか、commit 時の transaction に圧縮するか。
- `evaluatorVersion` の migration 方針を、MVP package format でどこまで固定するか。

## 11. Source list

Primary / official:

- W3C CSS Transforms Module Level 1: https://www.w3.org/TR/css-transforms-1/
- Khronos WebGL 1.0 Specification: https://registry.khronos.org/webgl/specs/1.0.0/
- Thomas W. Sederberg and Scott R. Parry, "Free-Form Deformation of Solid Geometric Models", SIGGRAPH 1986: https://doi.org/10.1145/15886.15903
- Scott Schaefer, Travis McPhail, Joe Warren, "Image Deformation Using Moving Least Squares", ACM TOG 2006: https://people.engr.tamu.edu/schaefer/research/mls.pdf
- Kai Hormann and Michael S. Floater, "Mean Value Coordinates for Arbitrary Planar Polygons", ACM TOG 2006: https://www.inf.usi.ch/hormann/papers/Hormann.2006.MVC.pdf
- Tao Ju, Scott Schaefer, Joe Warren, "Mean Value Coordinates for Closed Triangular Meshes", ACM TOG 2005: https://doi.org/10.1145/1073204.1073229

Secondary / implementation guide:

- OpenGL Programming Guide, Chapter 12, Evaluators: https://book.huihoo.com/opengl-programming-guide-version-1.1/chapter12.html
