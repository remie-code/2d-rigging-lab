# Landmark warp Wave 1 A 完了記録

- 状態: 素材・指定形式の技術範囲、およびroot指定候補の取込は独立レビュー合格。最新版root-feature-candidate-2はdraftでありGate 1未承認。
- 実施構造: Orch-Sylph → 別Gnome → 別Review-Sylph。Orch/rootによるsource代行なし。
- レビュー: [landmark-warp-wave-1-a.md](../../../implementation/reviews/reference-guided-rigging/landmark-warp-wave-1-a.md)
- 修正: 初版レビュー後、テスト証跡を1回修正。技術実装の方針変更なし。

## 成果物と変更

基準P: `C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp`。

- `src/input/contracts.py`, `annotations.py`, `export_psd.py`, `raster.py`: 契約の検証、指定取込、PSD抽出、RGBA合成。
- `tests/input/test_input.py`: 14 tests。不可視・未指定の座標、未知/静的part、scene/hash/画像の整合等。
- `docs/input.md`: 抽出条件、マスクと合成順、検証結果、指定取込手順。
- `assets/assets.json`, `assets/scene.json`: 共通契約v1の実素材およびGate 1用scene。outputsは空。
- `assets/`内: 顔11層・眼鏡1層・静的2 bandのフルcanvas RGBA、群の寄与mask2枚、再合成/比較画像と検証記録。
- `annotations/candidate.json`: root顎候補を含むdraft。その他はunmarked。rootの追加認知内容待ち。

## 実験結果

GnomeとReview-Sylphがそれぞれ14 testsを実行してPASS。レビュー側最終再実行は14/14、1.882秒。レビュー側の追加negative probes 10件もPASS。

閉じ口のPSD直接合成は既存正面sourceとRGBA完全一致。抽出PNGをsource-overした無変形再合成には8bit量子化・丸めに整合する残差がある。alpha最大差1、premultiplied RGB最大差2.9686/255、平均0.002278/255、差1超の画素2607。透明領域のRGB差を見た目の差に数えていない。差分画像を素材へ貼り込む補填は行っていない。詳細は `assets/verification/recomposition.json`。

Review-SylphがPSDを独立読込し、可視leaf順とassets sourceLayers順、動的12層のPSD compositeと抽出PNGのbbox内完全一致、9層でのraster maskの実効を確認。scene/hash/再合成/寄与maskも別計算で確認した。psd-toolsのfloatからuint8への変換を直接確認し、当該PSDではICC適用有無も完全一致だった。量子化の原因説明は合理的だが、数学的な誤差上限の証明ではない。

PSD前後SHA256は一致: `74e1ea9a98da480f2da079b8744d7f6fa3e048e64160b79d1a3f4436aa8a854c`。元PSD、既存source/alignment/optical-flowは書換なし。

Gnomeは顔crop・全身再合成・差分画像を実画像として確認。Review-Sylphも顔cropと差分画像を直接確認した。A担当の実browser検証は未実施。Cの独立browser検証とrootの目視確認は別証拠であり、Aの画像検証をbrowser PASSと称していない。

## 裁量と条件

- 通常衣装・通常表情・閉じ口は既存prepare-source.pyと同じメモリ内選択。
- 静的層は動的群前後の2 bandとして順序を維持。
- visibleSourceMaskは全体alphaではなく、前景遮蔽を反映した群の分数寄与。
- global環境はpsd-tools 1.17.1 / Pillow 12.1.1 / NumPy 2.4.6。既存optical-flow環境は変更なし。
- 顔の点/曲線のpartIdはface、眼鏡はeyewear。left/rightは正面画像での左右に固定し、全frameで同じIDを維持する（root了承）。

## 指定受渡しと未完事項

rootが共通canvas 2048×3072のannotations v1 JSONを渡し、AのCLIが検証してdraftへ保存する。visible点はxy、visible曲線は順序付きpoints。不可視・unmarkedはxy:null / points:[]とし、推定座標で埋めない。

`python P/src/input/annotations.py import <JSON> --assets P/assets/assets.json --output P/annotations/candidate.json`

顎以外のroot認知、C実scene表示、root目視、ユーザーGate 1は未完。既存顎の承認を他の指定や変更後revisionへ継承しない。技術PASSは自然さや指定内容の目視合格を代替しない。Wave 2・実参照guided変形・格子/rig工程は開始していない。
## 追記: root-feature-candidate-1 の取込

rootから受領した目視指定を既存CLIで取り込んだ。今回の変更は `annotations/candidate.json` のみ。source実装と全test再実行は不要と判断し、候補取込・scene整合の検証と、別Review-Sylphによる期待値の直接照合を行った。

- revision: `root-feature-candidate-1`
- review.status: `draft`
- candidate SHA256: `e3b2662d72b411bc324d03a4ea8a10d7c2815b8283bddec1f3786efb3b7bc021`
- CLI importおよびvalidate-scene: valid。
- 独立照合: 新たに指定した4 featureの3frame・計12座標、左右曲線の計40頂点が、rootの330×250 crop座標に一度だけ(+850,+340)した値と完全一致。既存chinの3点は不変。
- 顔の追加点は `eye_left_inner_lid_tip`。目頭側の上まぶた線の端であり、解剖学的な目頭交点とは称さない。
- `eye_left_inner` は全frameで意図的な `unmarked` / null。『解剖学的交点は今回指定せず、明確に読める上まぶた内側端を別IDで指定』と記録。描画の省略で読めないことを遮蔽と同一視しない。
- 残りの既存眼角3点は前髪で交点が隠れるため `occluded` / null。
- 眼鏡は独立partId `eyewear` のbridge接合部2点のみ。レンズ下縁の極値を物質対応点として追加していない。
- 両頬曲線は可視下部から顎まで。曲線の点indexを物質点対応と解釈しない旨を記録。
- 最終データは9 landmarks、2 curves。左右は正面画像での左右を維持。

由来はrootによる元画像とbrowser拡大の目視。flow推定は指定に使っていない。rootが表示上で改訂し得る候補であり、真値・全点指定済み・承認済みとは扱わない。上の初版記録にある『root認知待ち』はこの取込で更新されたが、rootの表示確認とユーザーGate 1は引き続き別の未承認gateである。取込技術レビューは目視の意味判断を代替しない。Wave 2は開始していない。
## 追記: Gate 1共通crop

rootの再観察用に `assets/scene.json` の任意拡張 `viewer.crop=[850,370,330,230]` を追加した。単位は共通canvas px、配列はx,y,width,height。rootは目〜顎が同じ範囲で収まる表示で最大左下顎候補を再確認する。この設定は点・曲線や原画像の座標を変更しない。

- scene SHA256: `bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d`
- candidate SHA256は `e3b2662d72b411bc324d03a4ea8a10d7c2815b8283bddec1f3786efb3b7bc021` で不変。
- CLI validate-scene PASS。独立Review-Sylphもscene契約・canvas内crop・Cの共通viewBox使用・注釈の二重変換なしを照合し合格。
- 実browserの観察はroot/Cが担当。候補revisionはdraftを維持し、Gate 1未承認、Wave 2未実行。
root実browser観察の追記: 通常reloadでは旧scene cacheの表示範囲が残ったが、scene queryへcache-bustを付けた再読込で新cropの反映を確認。rootが旧scene cacheを原因と切り分け、source変更は不要とした。これはrootの表示確認であり、A独立browser PASSへの置換ではない。

## 追記: root-feature-candidate-2 の限定修正

rootの新crop拡大・同位置overlay ON/OFF観察を根拠に、Gnomeが既存serializerを使って `annotations/candidate.json` だけを更新した。フロー値は修正根拠に用いていない。候補2も目視の暫定指定であり、draftを維持する。

- 最大画像の `cheek_left_outline` は肌の内側を通っていたため可視輪郭へ合わせ直した。最終canvas座標: `[[1018,541],[1031,548],[1048,553],[1064,558],[1080,563],[1091,565]]`。
- `eye_left_inner_lid_tip` は初期点が線先端から皮膚側へ離れていたため、overlay OFFで黒い上まぶた線の終点を再読取した。最終canvas座標: neutral `[963,432]`、midpoint `[1020,431]`、endpoint `[1077,424]`。
- revision: `root-feature-candidate-2`。candidate SHA256: `3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926`。
- scene SHA256は `bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d` で不変。共通cropも維持。

serializer import・scene validatorはPASS。別Review-Sylphは更新直前に保持した候補1 JSONと全フィールドを比較し、幾何変更が最大左下顎曲線とlid tip 3点だけ、その他はrevision/basis/provenanceだけであることを確認した。cropからの加算は一度、他の座標・visibilityは不変。限定データ変更のためsource実装変更と全tests再実行は行っていない。

rootは3frameとoverlayを実browserで目視済み。このroot目視はAの独立browser検証ではなく、候補2の技術レビューも指定の意味判断を代替しない。Gate 1未承認、Wave 2未実行。
rootの候補2実表示確認: 3frameを同位置で目視し、最大左顎は輪郭に沿う候補となり、lid tip 3点は初版の皮膚側への離れを修正できたと観察。rootはGate 1へ提示可能と判断した。ユーザーは未承認であり、このroot観察は独立browser reviewとは別である。
