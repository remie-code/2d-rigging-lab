# Wave 1 C 完了報告: 比較表示

2026-09-25。Orch-Sylph: landmark_wave1_c。実装: gnome_viewer。独立レビュー: review_viewer。

## 判定

source・契約接続・内部試験はPASS。実装と独立レビューは2 loopで完了。独立実ブラウザー確認は未実施（初回8769接続拒否、server復旧後の再試行ではIAB provider不在）であり、表示検証全体のPASSは付けない。Gate 1/Gate 2のユーザー判断を内部試験で代替しない。Wave 2は未起動。

## 変更一覧

P = C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp。

- P/viewer/index.html, style.css, app.mjs, model.mjs: scene queryを消費する静的viewer。単一SVGで画像と指定を重ね、3frameと参照/flow-only/guidedを同位置・同倍率で即時切替する。
- P/fixtures/viewer/generate.py と人工PNG/JSON: 2048×3072 canvasのGate 1、Gate 2、部分出力、未知部品、欠損画像、寸法不正fixture。
- P/tests/viewer/model.test.mjs, app.test.mjs: 契約と座標・crop・相対URL・frame/variant選択、およびDOM stubを用いた実appイベントの試験。
- P/docs/viewer.md: 起動URL、操作、座標処理、人工データの意味、検証と限界。

所有範囲外のsource、既存optical-flow viewer、源画像は変更しない。必須交換契約の変更なし。実画像guided生成は行っていない。

## 動作と裁量

outputs=[]はGate 1として3原画像を表示し、まだない出力は選べない。部分出力でframeを切り替えて現在modeの結果がなければ、表示ラベルも含めて参照へ戻す。点/輪郭overlayを切替可能。ID・partId・群・可視性・未指定を表示し、未知/曖昧なpartIdは拒否する。曲線indexを物質点対応に読み替えない。処理対象と対象外を示し、全体表示も用意する。

画像はフルcanvasのまま、点/曲線と共通SVG viewBoxで変換する。cropはface/eyewear群bboxと全3frame可視指定のunionにpaddingを付け、情報がなければ全canvas。任意scene.viewer.crop=[x,y,width,height]は範囲を検証して優先する。frame/variant切替でcrop/倍率を変えない。loop2でmeetの実倍率に合わせた点半径4px・文字12pxの補正を追加し、縦横どちらが表示制限でも大きさを保持する。

全表示画像のdecodeとcanvas寸法検証が成功してから操作を有効化する。HTTP/JSON/契約/画像欠損/寸法不正はerrorとして示し、成功結果を捏造しない。

## 試験・独立レビュー

実装者と独立Review-Sylphが計19/19件PASSを確認。model 12件、app DOM stub 7件。app試験は実ブラウザー検証とは区別する。共通viewBox、overlay、出力欠損、frame/variant対応、loading/error、2048×3072座標、縦横律速、crop/全体、倍率1/2/4、resize後の注釈サイズを対象とした。

reviewer環境のnode --testはsandbox子process生成のspawn EPERMがあったため、各test.mjsをnodeで直接実行しnode:testの全件完了を確認した。

A実sceneも独立read-only接続検証済み。P/assets/scene.jsonはkind=real-reference、annotation revision=root-chin-candidate-1、3frame、outputs=[]。解決済み3画像は2048×3072、共通crop=[793.5,237.5,411,406]。顎候補と残りunmarkedのdraftであり、指定完成とは扱わない。

独立レビュー: C:/workspace/remie/code/ai-native-live2d-editor/discussion/implementation/reviews/reference-guided-rigging/landmark-warp-wave-1-c.md

## 独立ブラウザーの実施者・可否

実施者: Review-Sylph review_viewer。cua_replで専用IAB新規tabを要求した。visible:trueはsubagent threadで非対応、visible:falseの新規tabはhttp://127.0.0.1:8769/に対してnet::ERR_CONNECTION_REFUSEDとなった。Orchのread-only HEADも接続拒否。server再起動や既存ユーザーtabの操作は行わなかった。

したがって実browserの画像decode、目視座標一致、切替描画、loading/error画面は未実施。配信復旧後、独立reviewerの専用tabで人工Gate 1/Gate 2/部分出力/errorとA実sceneを確認する余地を残す。rootの目視を独立browser PASSへ置き換えない。

## rootへの引継ぎ

server配信成立後のURL:

- 実Gate 1: http://localhost:8769/landmark-warp/viewer/?scene=../assets/scene.json
- 人工Gate 1: http://localhost:8769/landmark-warp/viewer/
- 人工Gate 2: http://localhost:8769/landmark-warp/viewer/?scene=../fixtures/viewer/gate2/scene.json

操作は1/2/3で正面/中間/最大、R/F/Gで参照/flow-only/guided、Oで指定overlay。全体/共通crop、倍率を切替可能。人工出力は説明用図形でありsolver成果物ではない。

Gate 1の具体指定完成、root実表示確認、ユーザーによるannotation revision/画像hashに対する承認は未完了。この承認前にWave 2へ進まない。Gate 2の改善/新しい違和感の判断も未実施。変更後へ過去承認を自動継承しない。

## server復旧後の独立ブラウザー再試行

rootがRをrootとする127.0.0.1:8769のHTTP serverを再起動した後、同じ独立Review-Sylphへブラウザー確認を再委譲した。source再実装や広い内部試験の再実行は行っていない。

cua.createBrowserTab('iab', viewer URL, {visible:false})は「Browser is not available: iab」を返し、続くcua.getState()はapps:[], browsers:[]だった。今回はserver接続の前段階であるブラウザーprovider不在で、専用tab自体を作成できなかった。初回のserver接続拒否が継続しているという判定ではない。

人工Gate 1/Gate 2/部分出力/errorとA実sceneの実browser確認は未実施のまま。既存ユーザーtabは操作していない。専用tab作成不成立のため進行中の専用tab操作もなく、今回のブラウザー試行は終了した。レビュー報告にも同じ再試行結果を追記済み。19/19内部試験PASSと実browser未検証を分け、Gate 1未完了/Wave 2未起動を維持する。

## rootによる実sceneの受領目視

root環境の専用tab 6でA実sceneを表示し、画面のcheckboxによる正面/中間/最大の切替、zoom 1→2、および各screenshotの目視で画像表示を確認したとの報告を受領した。未出力のflow-only/guidedはdisabled。2倍時のDOM viewBoxは `896.25 339 205.5 203`。

これはrootの受領目視であり、独立Review-Sylphのbrowser PASSではない。人工scene群のbrowser検証や独立レビューをrootが代替したとも扱わない。独立browserはprovider不在による未実施を維持する。source修正依頼はなく追加実装は不要。CはrootのGate 1候補完成待ちとして待機する。Gate 1品質判断は未完了、Wave 2未起動。
