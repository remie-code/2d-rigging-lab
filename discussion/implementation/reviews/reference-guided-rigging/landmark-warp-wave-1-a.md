# レビューレポート: landmark-warp Wave 1 A 素材・指定データ

- 判定: **合格（A の技術範囲）**
- レビュー: 初回レビュー + 修正 loop 1 の再レビュー完了。
- 実装 Gnome と独立した Review-Sylph が basis、source、tests、PSD、実 PNG/JSON を直接確認した。実装者の報告だけを PASS 根拠にしていない。
- Gate 1 未実施。顎以外は root の認知・指定待ち。Wave 2 へ進める承認ではない。

## 判定根拠と対象

基準は discussion/model-authoring/reference-guided-rigging/landmark-warp-wave-plan.md の共通交換契約 v1、Wave 1 A、Accepted User Gate 全文。User Gate の内容・判断主体・前提は変更しない。

P = C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp。
対象は P/src/input/{contracts.py,annotations.py,export_psd.py,raster.py}、P/tests/input/test_input.py、P/docs/input.md、P/assets/、P/annotations/candidate.json。旧 Astra の成果物、editor source、ref/research/closed-problems、git 履歴は参照していない。明示された implementation-orchestration skill のみ読み込んだ。

## 設計適合

1. **通常衣装・通常表情・閉口**: export_psd.py:25 の選択を既存 prepare-source.py と照合。ware 表示、別衣装非表示、通常表情の mouth_a から mouth へのメモリ内切替が同じ。PSD の保存処理はない。assets provenance は保存状態 mouth_a と選択後 mouth を区別する。
2. **PSD 不変と元画像整合**: 現物 PSD の SHA-256 を独立取得し、前後記録と一致した。値は 74e1ea9a98da480f2da079b8744d7f6fa3e048e64160b79d1a3f4436aa8a854c。既存 source の hash は 165e96b0db174d1d00e254eb2971359814000320c075abb54915c7a83db12eca。source PNG と psd-neutral.png の実画素配列は RGBA 完全一致。
3. **レイヤ・順序・マスク**: 独立した PSD 読込で閉口の全可視 leaf 順を抽出し、assets の sourceLayers 全順と照合して一致。static-band-0 → face 11 層 → eyewear → static-band-1。顔群は肌、鼻、目眉、閉口を保持し、耳・髪・衣装は静的。動く 12 層それぞれの PSD composite と export PNG の元 bbox 内は完全一致した。ラスターマスク適用による alpha 変化は face-face 3666 画素、eyewear 3974 画素など、対象 9 層で直接確認。paste の追加 alpha mask はなく二重適用しない。
4. **無変形再合成**: full canvas 14 PNG を stackIndex 昇順で独立に source-over し、reconstructed-neutral.png と完全一致。差分画像や参照画像を再合成へ入力するコードはない。顔 crop 2 枚と visible-difference-x32.png を実際に表示し、閉口・眼鏡・前髪の位置関係と残差の分布を確認した。
5. **visibleSourceMask**: raster.py:11 の定義は、各群の alpha と全前景の透過率の積を群内で加算する source-over 寄与。別計算で実 mask と全画素一致。face は非ゼロ 28157 画素、分数境界 5089 画素、eyewear は非ゼロ 1525 画素、分数境界 1519 画素。全体 alpha や flow validity を代用せず、前髪・眼鏡の遮蔽と半透明境界を含む。
6. **座標・注釈**: 2048×3072 の full canvas、pixel-edge-centers、bbox は情報のみ。partId face/eyewear の群対応は一意。left/right は正面画像の左右で全 frame 共通。root 顎候補 3 点のみ visible、残り 5 点・左右曲線は unmarked。曲線の各 index を対応点とせず、frame ごとの頂点数差を許容する。
7. **validator・serializer**: contracts.py:54/95/129 は未知・曖昧・静的 part、非有限座標、不可視座標の穴埋め、役割/ID/frame/canvas 不整合を拒否。scene は実在画像、寸法、指定 hash、既存 flow manifest と frame の同一性を検証する。annotations.py の import は accepted 入力を含め必ず draft に戻す。accepted 化、変更ごとの revision、ユーザー確認と画像 hash の記録は docs/input.md:13 に root 責務として明記。
8. **Gate 1 scene**: assets/scene.json の実在参照・hash 整合を検証。outputs は空配列。candidate revision は root-chin-candidate-1、review.status は draft。技術成功や顎候補を Gate 1 完了とは扱わない。

## 試験実行と結果

環境: global Python 3.11、psd-tools 1.17.1、Pillow 12.1.1、NumPy 2.4.6。新規依存導入なし。

- P で `python -B -m unittest discover -s tests/input -v` を独立実行。初回 14/14 PASS、修正 loop 1 後も **14/14 PASS（1.882 秒）**。
- 修正後 source を直接確認。不可視曲線の検証で不正な landmark が先に失敗していた問題を解消し、各 visibility の点/曲線を独立データで試験。静的 part への点/曲線指定について専用拒否理由を検証する case を追加。
- 別の一時 Python probe による 10 negative cases: 不可視曲線 3 状態、静的 part、曲線 NaN/Infinity/頂点不足/範囲外、scene 欠損画像/hash 不一致をすべて意図した理由で拒否。
- 別の実画素検証: scene/hash、現物 PSD hash、14 層の再合成、群 mask の全画素、PSD の可視 leaf 順、12 可動レイヤの composite を照合し PASS。生成物は書換えていない。

## 再合成残差の評価

独立再計算は recomposition.json と一致した。再合成対 source は alpha 最大差 1、premultiplied RGB 最大差 2.9686274509803923、平均絶対差 0.0022784652793069807、RGB 差が 1 を超える画素は 2607。raw RGBA 最大差 255 と相違画素 4883536 は透明 RGB の相違も含むため、可視差と同一視しない。

installed psd-tools の composite_pil が float composite 後に `(255 * color).astype(np.uint8)` で量子化することを確認した。export は層/band ごとにこの処理を挟み、その PNG を Pillow で再合成するため、PSD 一括合成とは量子化の時点と合成丸めが異なる。PSD の埋込 ICC は sRGB-elle-V2-srgbtrc.icc で、独立に全体合成の ICC 適用有無を比較したところ画素差 0。今回の小残差を中間 8-bit 化と合成丸めで説明することは合理的。ただし一般的な誤差上限の証明とはしない。残差は開示され、差分の貼り込みはないため、A の技術範囲では許容する。数値閾値は自然さや User Gate の合格条件ではない。

## 裁量判断

- 静的要素を可動層の前後 2 つの最大連続 band とする表現は、今回の PSD 順序を保持し契約の意図に合う。
- visibleSourceMask を分数寄与の grayscale とし、不可視曲線を空配列、不可視点を null とする具体化は契約と整合する。
- 人工 raster fixture は test 内の 1×1 RGBA であり、fixtures/input の独立ファイルはない。必要な境界・遮蔽・順序試験は実装されている。
- root への受渡しは annotations JSON 全体の import とし、汎用注釈 editor を増設しない。

## 差分・残課題・実ブラウザ

A の未修正 blocking 差分はなし。初回レビューで指摘した 2 つの試験精度問題は修正 loop 1 で解消済み。

顎以外の root 認知・指定、root の実表示確認、ユーザーの Gate 1 確認と revision/画像 hash の承認記録は未実施。承認を変更後に自動継承してはならない。Gate 1 前の実参照 guided 実行および Wave 2 起動は不可。

実ブラウザ検証は C の責務で、**A Review-Sylph は未実施**。本レビューの PNG 実見を独立 browser PASS とみなさない。実画像変形後の欠損素材・新規露出・静的周辺素材による限界と、見た目の改善判断は Wave 2 / Gate 2 に残る。

## 追補: root-feature-candidate-1 の指定取込レビュー

**判定: 指定取込の技術範囲は合格。** 上記初回レビューに記録した root-chin-candidate-1 の内容は当時の snapshot。現在の candidate は本追補の revision へ更新されている。初回の素材・入力実装レビューの判定は維持し、今回の変更対象は annotations/candidate.json のみ。

### 根拠・独立検証

root から渡された crop 座標と意味・visibility の指定を期待値として、保存 JSON を直接読み、実装者の変換コードに依存しない一時 Python probe で照合した。

- revision は root-feature-candidate-1、review.status は draft。root の元画像と browser 拡大での目視候補であり、flow 推定を使っていない由来、真値・承認済ではなく表示で改訂可能という basis を確認。
- 330×250 の face crop から canvas への変換は x+850、y+340 の一度だけ。eye_left_inner_lid_tip / mouth_center / eyewear_bridge_left / eyewear_bridge_right の 4 点×3 frame = 12 座標が全て独立期待値と完全一致。provenance 内の元 crop 座標も一致。
- 左輪郭の neutral/midpoint/endpoint は 7/6/6 頂点、右輪郭は 7/7/7 頂点。計 40 頂点全てを元指定と照合し、変換後の値・順序が完全一致。全 frame visible、face 所属。上部の髪遮蔽を埋めず、可視下部から顎まで、途中の index 対応なしという notes を確認。
- chin_tip は neutral [998,572]、midpoint [1044,571]、endpoint [1091,565] のままで再加算なし。
- eye_left_inner は全 3 frame unmarked / xy:null。notes は「解剖学的交点は今回指定せず、明確に読める上まぶた内側端を別IDで指定」と Unicode 文字列で完全一致。描画から交点を読めない事情を髪による occluded と混同していない。
- eye_left_outer / eye_right_inner / eye_right_outer は全 3 frame occluded / xy:null。新設 eye_left_inner_lid_tip は face 所属で、解剖学的目頭ではなく目頭側の上まぶた線の先端という notes を保持。
- 眼鏡 bridge の 2 点は eyewear 所属で接合部を表す。右上まぶた先端・レンズ下縁極値は追加されていない。全体は 9 landmark と 2 curve で、余分な指定なし。left/right は正面画像の左右を全 frame で維持する provenance を確認。
- validate_annotations と validate_scene を独立実行し PASS。scene から今回の candidate に到達し、素材/原画像/flow frame の実在と寸法・指定 hash が整合。outputs は空のまま。
- 保存ファイルを直接読み SHA-256 を独立計算した値は **e3b2662d72b411bc324d03a4ea8a10d7c2815b8283bddec1f3786efb3b7bc021**。実装者からの最終保存 hash と一致。

取込中の先行読込では eye_left_inner が occluded の状態だったため担当へ通知した。最終保存後の unmarked/null/専用 notes を再照合して解消を確認した。技術 source の変更はないため全 14 tests は再実行せず、今回の変換・所属・visibility・契約・由来・hash に絞って検証した。

### 裁量と残課題

今回、レビュー側で認知内容・座標・部品意味を補完または修正していない。provenance に元 crop 座標と変換操作を保持する拡張は追跡に有用で、共通契約を変更しない。

この追補は保存データが root 指定を正確に運ぶことの確認であり、画像上の指定が意図した箇所・形を捉えるかという目視判断の代替ではない。意図的 unmarked が残るため「全点指定済み」とは扱わない。今回 A のブラウザ表示確認は未実施。root による実表示確認と改訂、ユーザーの Gate 1 確認は別途必要。

Accepted User Gate は計画全文のまま維持する。**Gate 1 未承認、Wave 2・実参照 guided 変形は実行禁止。** この draft や以前の顎確認を承認済み入力と称さず、変更後へ承認を自動継承しない。

## 追補: 再観察用 scene.viewer.crop

**判定: 表示用 crop 設定の技術範囲は合格。** root が最大画像の左下顎を再観察するため、A 所有 assets/scene.json に viewer.crop=[850,370,330,230] を追加した変更を独立確認した。既存 scene の必須項目・原画像/flow/素材/注釈への参照は同じで、outputs は空のまま。

- scene JSON を直接読込し、validate_scene を独立実行して PASS。crop は共通 2048×3072 canvas の [x,y,width,height] 単位で、x=850..1180、y=370..600 の正寸法・有限・canvas 内範囲。
- C の docs/viewer.md:21/23、viewer/model.mjs:50、viewer/app.mjs:12 をこの交換境界だけ限定読込。任意拡張 scene.viewer.crop を検証して共通 SVG viewBox に使う実装と整合する。全 frame 共通の表示範囲であり、原画像や注釈の canvas 座標を変更する指定ではない。
- candidate の保存 bytes から再計算した SHA-256 は e3b2662d72b411bc324d03a4ea8a10d7c2815b8283bddec1f3786efb3b7bc021 のまま。注釈への crop offset 再加算・二重座標変換はない。revision root-feature-candidate-1、review.status draft を維持。
- scene の独立 SHA-256 は **bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d** で実装者の最終保存通知と一致。

source 変更のない設定追加であるため全 tests は再実行せず、今回の契約境界・数値範囲・保存 hash に絞って確認した。レビュー側は crop や候補の認知内容を新たに決定していない。実 browser の表示・再観察は C/root の責務で、この追補では未実施。表示を変更したことを指定の目視合格へ読み替えない。

Accepted User Gate 全文の条件は不変。**Gate 1 未承認、Wave 2・実参照 guided 変形は実行禁止。** 今回の crop 設定は候補座標の修正やユーザー承認を含まない。

## 追補: root-feature-candidate-2 の限定改訂

**判定: 候補 2 の取込技術範囲は合格。** 更新前に Review-Sylph が独立保持した候補 1 の JSON と、最終保存後の候補 2 を全フィールド比較した。幾何の差分は cheek_left_outline.frames.endpoint.points と eye_left_inner_lid_tip の全 3 frame の xy のみ。その他の差分は revision、review.basis、元 crop 座標と改訂履歴を含む provenance に限定されている。全 visibility、他の点/曲線座標、ID、partId、role、notes は不変。

### 座標・契約・hash の独立確認

root からの最終期待 crop 座標へ (+850,+340) を一度だけ加算した値と、保存値が完全一致した。

- 最大の左下顎輪郭: [[1018,541],[1031,548],[1048,553],[1064,558],[1080,563],[1091,565]]。末端の顎は維持。
- eye_left_inner_lid_tip: neutral [963,432]、midpoint [1020,431]、endpoint [1077,424]。目頭側の上まぶた線先端という意味・face 所属・visible を維持。
- revision は root-feature-candidate-2、review.status は draft。意図的 unmarked を含む他の visibility は維持。
- validate_annotations / validate_scene を独立実行して PASS。scene.outputs は空配列、viewer.crop=[850,370,330,230] は不変。
- candidate SHA-256 を bytes から独立計算: **3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926**。実装者の最終保存通知と一致。
- scene SHA-256 は **bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d** のままで、原画像参照・共通 crop を含め不変。
- provenance の前版 hash は既検証の e3b2662d72b411bc324d03a4ea8a10d7c2815b8283bddec1f3786efb3b7bc021 と一致。元 crop 座標も指定の改訂内容と一致。

root が同位置 overlay ON/OFF で最大左下顎を合わせ直した根拠と、新 crop 拡大・overlay OFF で黒い上まぶた線の先端を再読取した根拠を review.basis / provenance で確認した。flow 不使用、目視暫定、root browser 観察と独立 browser 検証の区別が記録されている。

source 変更のない指定改訂につき全 tests は再実行せず、今回の全フィールド差分・厳密な座標期待値・validator・hash に絞って検証した。Review-Sylph が認知内容を補完・変更する裁量判断は行っていない。A 独立 browser 検証は今回も未実施であり、root の 3 frame + overlay 目視を独立 browser PASS に読み替えない。root が線や輪郭をどう読むかという意味判断は本レビューの代替対象ではない。

Accepted User Gate 全文を不変で維持。**Gate 1 未承認、Wave 2・実参照 guided 変形は禁止。** 候補 1 や過去の顎確認から承認を自動継承しない。
