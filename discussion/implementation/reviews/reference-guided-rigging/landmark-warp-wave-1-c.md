# Wave 1 C 独立レビュー

2026-09-25 / reviewer: Review-Sylph (`landmark_wave1_c/review_viewer`) / review loop 2（初回確認と軽微所見修正の再確認）

## 判定

**ソース・契約接続・内部試験: PASS。独立実ブラウザー: 未実施（接続不可）。** 実ブラウザーを含む表示検証全体のPASSは付けない。blockingな実装不備は確認されなかった。Gate 1/Gate 2のユーザー画像判断は未実施であり、この判定では代替しない。Wave 2は実施していない。

## Basisと対象

basis: `discussion/model-authoring/reference-guided-rigging/landmark-warp-wave-plan.md` のAccepted User Gate、共通交換契約v1、Wave 1 C、レビューの粒度・証拠。

P = `C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp`。

直接確認: `P/viewer/{index.html,style.css,app.mjs,model.mjs}`、`P/fixtures/viewer/generate.py` とfixture JSON、`P/tests/viewer/{model.test.mjs,app.test.mjs}`、`P/docs/viewer.md`。追加のread-only接続確認: `P/assets/scene.json`、そのassets/annotationsと参照画像。実装者の説明だけでは判定していない。reviewerはsourceを編集していない。旧Astra成果物、既存ユーザーoptical-flowタブは参照・操作していない。

## 確認結果

- scene queryとJSON相対参照の解決、scene/assets/annotationsのschema・kind・canvas・座標規約の整合を確認。人工sceneはsynthetic-fixtureと明記され、説明用図形をsolverの実結果と称さない。
- Gate 1のoutputs=[]では3原画像のみを利用し、flow-only/guidedを無効化。出力はtargetFrameIdとmodeの両方で選択し、正面や別frameの出力を流用しない。部分出力のないframeへ移ると参照への切替が表示ラベルにも反映される。
- 画像と点/曲線は単一SVGのcanvas座標に置き、viewBoxだけでcrop/倍率を適用。frame/mode/overlay切替後も同一viewBoxを保持。補間アニメーションはない。2048×3072、顔crop、倍率、SVG余白を含む変換試験を確認。
- overlay ON/OFF、ID・partId・群・可視性のsidebar表示を確認。非visible座標は描画せず、未知または曖昧なpartIdは拒否。曲線配列indexを対応点として扱わない。対象外の所属と全体表示がある。
- 操作は全表示画像のdecode/寸法検査後に有効化。HTTP/JSON/契約/画像decode/寸法の失敗はerrorとして扱い、成功画像を捏造しない。実際のbrowser decodeと描画は未確認。
- cropは対象bboxと3frameの可視指定のunionにpaddingを付ける。明示cropはcanvas内の[x,y,width,height]を検査し、全体表示へ切替可能。bboxを追加transformとして使わない。

## 独立実行の証拠

- `node P/tests/viewer/model.test.mjs`: 12/12 PASS。
- `node P/tests/viewer/app.test.mjs`: 7/7 PASS。DOM stubで実appのイベントを通す内部試験であり、実ブラウザー試験ではない。
- `node --test .../model.test.mjs`はsandboxの子process生成で`spawn EPERM`。同ファイルを直接nodeで実行し、node:testの全12件が完了した。
- A実sceneをreviewerのread-only fetcherで`loadBundle`へ渡し接続成功。kind=`real-reference`、revision=`root-chin-candidate-1`、3frame、outputs=0、共通crop=`[793.5,237.5,411,406]`。解決後の3PNGを直接読んで各2048×3072と確認。顎候補と残りunmarkedのdraftであり、指定完了やGate 1完了ではない。

## 独立ブラウザーの実施者と可否

実施者はこのReview-Sylph。cua_replで専用IAB新規タブを要求した。

1. `createBrowserTab("iab", "http://127.0.0.1:8769/", {visible:true})`: subagent threadではIAB visibility非対応。
2. `visible:false`で再試行: ブラウザーが`net::ERR_CONNECTION_REFUSED`を返した。

従ってページの表示、目視座標一致、画像切替の描画品質、loading/errorの実画面確認は未実施。server再起動や既存ユーザータブの操作は行っていない。後日8769で配信が成立した際に、専用タブで人工Gate 1/Gate 2/部分出力/error sceneとA実sceneを確認する必要がある。rootの目視を本reviewerの独立browser PASSへ置き換えない。

## 裁量・軽微所見・残課題

- 共通cropの自動決定と任意`scene.viewer.crop`は表示上の裁量。3frameを通して固定され、User Gateの意味は変更していない。
- Loop 1の軽微所見は解消: overlay半径/文字サイズが幅だけで補正され、高さ律速時に縮む点を報告。Loop 2でGnomeが実際のmeet scale（幅/高さの小さい比率）へ修正した。reviewerはapp.mjsとapp.test.mjsの差分を直接確認し、app試験7/7を再実行してPASS。幅/高さ律速、crop/全体、倍率1/2/4、resize後に点半径4px・文字12pxを維持する検証を含む。座標変換や比較内容は変更していない。
- 人工fixtureは変形アルゴリズムや実画像の自然さを検証しない。19内部試験の成功、annotation.review.status、今回のレビューはユーザーの指定・画像判断を代替しない。
- Gate 1の指定完成、rootの実表示確認、ユーザーのrevision/hashに対する承認が引き続き必要。今回の技術判定からWave 2を開始する権限は生じない。
## 配信再開後の独立ブラウザー再試行

2026-09-25。rootから127.0.0.1:8769でRを配信するserverを再起動したとの連絡を受け、このReview-Sylphが残りのbrowser検証を再開した。

- `cua.createBrowserTab("iab", "http://127.0.0.1:8769/landmark-warp/viewer/", {visible:false})`を実行したが、`Browser is not available: iab`で失敗した。
- 続く`cua.getState()`の結果は`apps:[], browsers:[]`。今回はHTTP到達より前にbrowser providerが利用できない状態であり、前回の接続拒否と区別する。
- ページを開けなかったため、人工Gate 1/Gate 2/部分出力/error/A実sceneの実画面と操作は引き続き未検証。browser PASSへの変更はしない。ソース再実装・広い試験再実行は行っていない。
- 専用タブ作成は成立せず、操作可能な自分のタブは得られなかった。既存ユーザーoptical-flowタブには触れていない。今回の専用タブ操作試行は終了した。
- 残課題は利用可能なcua_repl browser providerでの独立確認。rootの画像判断や内部19試験のPASSを独立browser PASSへ置き換えない。Aの顎候補＋残りunmarkedに対するGate 1品質合格は出しておらず、Wave 2は起動していない。