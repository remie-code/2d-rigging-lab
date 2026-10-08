# 隣接Optical Flow試作: Wave計画

状態: Accepted plan / Wave 1・2 technical PASS、User Gate待ち。2026-09-25、ユーザーは2 wave構成、レビュー分離、必要なライブラリ導入を了承し「計画を書いて起動してくれ」と指示。

## 目的と範囲

位置合わせ済みの正面→中間→最大について、対応を推定・可視化し、格子へ移す手がかりになるかを確かめる。格子への当てはめ・rig変更・他軸・新規画像生成は今回の2 waveには含まない。正面→最大の直接推定は必要性が見えた際の比較候補。

## Accepted User Gate
### あなたが受け取るもの／行うこと
位置合わせ済みの正面・中間・最大を、同じ位置・倍率で切り替える比較ビューを受け取る。正面→中間、中間→最大の対応点・移動経路・不確実な領域を必要に応じて表示し、顔・眼鏡・帽子・前髪・後ろ髪などを観察する。
### あなたが判断すること
対応が同じ部位を追っているか、別の部位へ飛んでいないか、デフォーマへ移すための手がかりとして使えそうかを判断する。
### あなたが判断しないこと
ライブラリ導入、座標やフロー合成の実装、テストの正否をユーザーの作業として要求しない。それらは実装・独立レビューで確認する。今回は完成したrigの品質を判定する段階ではない。
### 合格条件
使えそうな対応と、まだ使えない対応を画像上で説明できる候補を提示し、ユーザーが格子への次工程に進めると判断する。数値や内部テストの成功はこの判断を代替しない。
### 違和感や不足があった場合のフィードバック
ユーザーが部位・画像・挙動の違和感を示す。rootは原因を参照画像、対応推定、表示に分けて調べ、必要な修正後に具体物を再提示する。過去の版の承認を変更後の版へ自動継承しない。

上のUser Gateはユーザーが行使する。rootは画像を直接観察し、違和感があれば修正を依頼する。Orch/Gnome/Reviewによる内部passはUser Gateではない。gateを後続promptへ全文継承し、変更権限を渡さない。

## 基準と作業場所

- 共通判断: [scope-and-decisions.md](scope-and-decisions.md)、[deformer-transfer.md](deformer-transfer.md)、[motion-review.md](motion-review.md)。
- 入力記録: [experiments/face-x-registration.md](experiments/face-x-registration.md)。
- 作業root W: C:/workspace/remie/rigging/second-rigging-6-sol
- 素材root R: W/reference-generation
- 正面: R/source/normal-outfit-neutral-full.png
- 中間: R/alignment/midpoint-aligned.png（生成中間v2）
- 最大: R/alignment/endpoint-aligned.png（生成最大v1）
- 画像hash・行列: R/alignment/alignment-manifest.json。元素材・承認済み画像は書き換えない。
- 新規実装 O: R/optical-flow/
- 既存同位置ビュー: R/alignment/compare.html（今回のBはO/viewer/に別ビューを作り、承認済みビューを壊さない）。
- 旧second-rigging-astraのrigging成果物、他試験の解答、editorのref/closed-problems/research、git履歴は調べない。明示されたskill文書は例外。editorアプリ本体・rig packageは変更しない。
- 初期棚卸し: 通常Python3.11、numpy/Pillowあり、cv2/torch/torchvisionなし。RTX4070 SUPER/VRAM約12GB。CUDAでの実推定はまだ未確認。
- ユーザーは必要なライブラリ・学習済み重みの導入を許可済み。O/.venv内を基本とし、正規の配布元を確認してversion/source/hashを記録。画像を外部サービスへ送信しない。
- 実行時のcwdは必ずWまたは明示された正しいpath。sandboxの既定cwdは旧workspaceなので使わない。必要時に承認済み作業内容を添えてrequire_escalatedを使う。

## Waveと依存

### Wave 1 A: フロー計算基盤
Orch-A→Gnome-A→Review-A。Orchはsourceを書かない。
- 推定器を公式情報に基づいて一つ選び、専用環境と重みを導入。小画像でGPU推定の実行を確認。
- 入力検証、前処理、forwardフロー出力、座標復元、隣接フロー合成、不確実性/無効領域の記録、再実行コマンドを実装。
- 重みサイズ・推定解像度はGPUに応じて選ぶ。OOM時は条件を記録して調整できる。無断でCPU成功をGPU確認済みと報告しない。
- 所有: O/src/, O/tests/, O/scripts/, O/weights/, O/.venv/, O/requirements関連, O/README.md, O/fixtures/compute/, O/smoke/。
- AからBへは下記共通契約以外の実装依存を作らない。初期推定器の選択・手順はAの実装裁量だが、目的・入力・gateを変えない。
- review単位: 入出力/前処理、推定器adapter、座標・合成。意味のある単位でreviewし、最後に通し確認。
- 完了: 必要な試験と独立reviewが完了。実参照の見た目が合格したとは言わない。

### Wave 1 B: 比較ビュー基盤
Orch-B→Gnome-B→Review-B。Aと並行。
- 下記契約に従う人工fixtureで、同位置切替、点の対応経路、疎な矢印表示、不確実領域表示を作る。
- 説明なしにフローをアニメーション補間して「自然な動き」と見せない。原画像の即時切替を保ち、overlay on/offと共通cropを提供。
- 元の点→中間の対応先→最大の対応先を追えるようにする。画面上で「無効/不確実」を認識できる。信頼度を確率と断言しない。
- 所有: O/viewer/, O/fixtures/viewer/。Aの環境やsourceへ書き込まない。
- ブラウザ操作・検証はcua_replを使う。他担当と同じユーザー向けtabを同時操作しない。serverは既存8769（Rをrootに127.0.0.1で配信）を利用可能。必要なら未使用localhost portの自分専用server。
- 完了: 人工fixtureで向き・点・無効領域・切替位置が実際のbrowser表示で確認され、独立review完了。人工結果を実参照の成果と見せない。

### Wave 1 gate
A/B各々のcompletion+reviewをrootが受領。共有契約への適合を確認してからWave 2を起動。待ち時間を失敗とみなして担当を中断しない。

### Wave 2 C: 実画像での統合・試作
Wave 1完了後に別Orch-C→Gnome-C→Review-C。
- Aの基盤で実入力の隣接フローを推定、合成し、Bのviewerへ接続。GPU重い推定を並列に競合させない。
- 画像背景・ハローは運動の証拠として扱わない。白背景合成だけではforeground maskにならない。可視領域やconfidenceの推定限界を記録する。
- 前処理/マスク等の調整は根拠を残す。元画像の描き変わりを補正して対応精度を偽装しない。低信頼を隠して全点正しいように見せない。
- 所有: O/runs/、統合記録。A/B完了後は必要なsource修正のownershipを引き継げる。変更には独立reviewを付ける。
- flowによる再投影を補助に加える場合、forward場を負号反転してbackwardとして使わない。holes/collisions/occlusionを明示し、rig結果と呼ばない。
- 実参照の観察用に、頭・肩、胴体、髪を見られる共通cropを整える。Bの人工fixture向け中央70%だけでは縦長全身の頭が外れるため、そのまま最終提示しない。初期選択点も頭付近を実画像で確認して置く。これは既存の部位観察体験の実参照への適用。
- rootへ渡す: 起動中の比較URL、実入力manifest、選択した条件、顔/眼鏡/帽子/前後髪の観察箇所と限界、レビュー報告。
- rootの画像観察→必要なら修正依頼→ユーザー提示でUser Gate。ここで次工程を自動開始しない。

## A/B共通の交換契約 v1（計画側の固定事項）

manifest.jsonと画像/バイナリを、同じrun/fixture配下から相対URLで参照可能にする。絶対Windowsパスはbrowser参照に使わない。URLはmanifestのURLを基準に解決する。
- schema: reference-flow-v1
- kind: synthetic-fixture または real-reference（表示で区別）
- coordinateConvention: pixel-edge-centers（pixel i,jの中心はi+0.5,j+0.5）
- canvas: {width,height}。実参照は2048×3072。すべての画像は同じcanvas。
- frames: [{id:neutral|midpoint|endpoint,label,image,sha256}]。imageはmanifest相対URL。
- fields: [{id:f01|f12|f02,from,to,width,height,vectors,validity,description}]。f02はcomposed neutral→endpoint。
- vectors: row-major、little-endian float32、shape [height,width,2]、dx,dy順のraw binary。単位はcanvas px。forward displacement。
- validity: row-major uint8 [height,width]、0=使えない/不確実、1=推定上の採用候補。1は正解保証ではない。理由やconfidence指標は追加artifactとして記録可。baselineでは、少なくとも非有限・画像外・合成先無効を区別して扱う。曖昧な点がすべて検出できるとは主張しない。
- fieldの格子中心(i,j)が対応するcanvas位置は ((i+0.5)*canvas.width/field.width,(j+0.5)*canvas.height/field.height)。
- 中間qにおけるfield参照indexは qx*field.width/canvas.width-0.5（yも同様）。補間・境界・validityを一貫して処理し、画像外を黙ってclampしない。
- 境界仕様補足（A/B共有済み）: canvas有効域は0<=x<W, 0<=y<H。画像外は無効。canvas内でfieldの最外中心より外の半セル領域だけは最外サンプル値を延長する。bilinear補間の非ゼロ寄与点がすべてfiniteかつvalidity=1の場合だけ有効とする。
- F02(p)=F01(p)+F12(p+F01(p))。fieldの格子密度が異なっても意味を保つか、明示的に同じ密度に揃える。
- provenance: method, weights, parameters, software, inputs等のobject。具体項目はAが補足。数値の情報を一般ユーザーの操作画面に大量に出さない。
- 任意拡張: diagnosticsやobservationsはA/Bの通知で追加可。上記必須項目や意味を変える場合はrootへ報告して両担当に伝える。
- viewerはquery parameter manifestでmanifest URLを指定できるようにする。例: viewer/index.html?manifest=../runs/trial-001/manifest.json。defaultはBのsynthetic fixtureとし、実画像の既定URLはWave 2で決める。

## 内部verification（User Gateとは別）

- 画像hash、サイズ、ペア順序、dtype・shape・bytes・有限性を検証。
- 既知の平行移動で符号・軸・単位・リサイズ復元を確認。
- 空間的に変化する既知のfieldで合成を確認し、同座標加算の誤実装を検出。
- out-of-bounds、無効な中間対応、補間境界を確認。不確実な点を有効として復活させない。
- 学習器のsynthetic画像での誤差閾値を美的ACにしない。adapter/数理の既知解と、学習器の実測を別に記録。
- viewerの座標復元、同位置切替、overlay切替、loading/errorを実browserで検証。
- 統合reviewは実入力から表示まで確認。別run取り違え、古いcache、非表示の補正、表示から消した失敗に注意。

## レビューと運用

- GnomeとReviewは別コンテキスト。reviewerは計画・実装・差分・試験・artifactを独立確認し、Gnomeの説明だけに依存しない。
- 修正は最大5loop、改善が止まる/ユーザー価値の判断が必要ならrootへescalate。単に待機が長い理由で中断しない。
- rootはdomain source/tests/large diffを自分で作成・詳細精査しない。受領basisは計画・completion・review・ユーザー用視覚artifact。
- 既存のroot製alignment/compare.htmlは前段の実験資産で、新waveの技術passの代用にしない。必要な接続部分は独立review対象。
- 共有workspaceでは他担当が作業中。自分の所有外や他者変更を上書き・巻き戻ししない。git全体commitや既存履歴探索は不要。
- source実装、環境setup、verification、判定と残課題はファイルへ永続化。画像の合格状態は必ずpendingと区別する。

## 報告先と状態

計画/地図はroot所有。担当は下記自分のreportだけを書き、地図登録はrootへ依頼。
- Wave1 A completion: experiments/optical-flow-wave-1-a-completion.md
- Wave1 B completion: experiments/optical-flow-wave-1-b-completion.md
- Wave2 completion: experiments/optical-flow-wave-2-completion.md
- 独立review: C:/workspace/remie/code/ai-native-live2d-editor/discussion/implementation/reviews/reference-guided-rigging/ 配下 wave-1-a.md, wave-1-b.md, wave-2.md
- 所有する技術メモはO内README等。実験固有の入力・観測はO/runs内+completionからリンク。
- 現在: Wave1 A/B、Wave2 Cのcompletionと独立technical review PASSをrootが受領。rootの最終画像・UI確認済み。ユーザーのフロー候補採否は未判定。格子工程は未開始。

## Rootの受領・目視（2026-09-25）

両解像度の顔の原画像/点付きartifactを直接確認。baselineで眼鏡橋・左レンズ下縁が同部位近傍を追う候補と観察。1536の鼻付近は頬側へ到達する疑いがあり、validityを意味的正解と扱わない。既知の手作業GTではない。高解像度を自動採用せずbaselineを提示入口、1536を比較に保持。

root自身が実browserでbaselineの読込、顔・眼鏡cropの正面/最大切替、髪cropで矢印・無効領域表示on/offを操作した。部位運動と背景上の矢印を分けて観察。ユーザー用tabは顔・眼鏡crop、正面、経路のみ表示にして保持した。source/testsの独立reviewとは別の目視確認であり、User Gateの代理判定ではない。

[Wave 2 completion](experiments/optical-flow-wave-2-completion.md)が結果URL・全観察・レビューを所有する。次はユーザーがフロー候補を見る区切り。追加推定・格子適用は自動開始しない。

## 限定follow-up: 棄却前の推定を可視化する（2026-09-25合意）

ユーザーは、全身・髪・帽子・Body各軸に使える汎用性と、可能な箇所の決定論的処理を重視する。顔の意味情報を使った補正は未合意。まず「値が推定されていない」のか「値はあるが採否処理で見えない」のかを切り分けるため、棄却前の推定の表示に賛成した。顔特化の処理を導入する許可と解釈しない。

### 今回作る表示

同じ画像・crop・倍率で、選択した正面の点から中間/最大へ、採否条件を通った経路と、棄却判定を外して保存済みf01/f12を読む診断経路を区別して表示する。原画像切替は保持。診断経路は破線等で採用経路と区別し、推定値の採用を意味しないと簡潔に明記。正面の任意点に汎用的に使えること。顎専用の座標補正・ランドマーク・輪郭認識を入れない。

f02の無効領域はmasked sampleにより一部vectorが0へ置換されうるので、棄却前の連鎖として直接読まない。f01からqを求め、qでf12のraw vectorを補間する。診断で外すのは採否mask。非有限・画像外・復元不能の値は有効な追跡として捏造しない。画像外到達を示せても、その先のfieldは参照しない。

止まる理由を第一段/第二段・補間近傍の棄却等で表示する。既存artifactのreason/residualを利用可能。情報がないことを往復不整合と断定しない。reason=16はFB不整合。必要な値の詳細は折りたたみ可。

高解像度顎付近(998,572)が診断表示確認の一例: raw中間約(1039.48,570.84)、raw最大約(1076.01,566.81)。この座標やroot目視値を正解として実装しない。実artifactから汎用計算して確認する。人間が同位置切替で大きなずれか判断するための表示であり、数字の閾値を美的合格にしない。

### 分担・検証・区切り

Orch→別Gnome→別Review-Sylphの分離を維持。source所有はO/viewerと必要な人工fixture/test。runの入力・flow・validity・推定器・FB閾値は変えない。sourceと表示の関連する試験だけを実施し、GPU再推定は不要。無効maskで採用経路が止まる一方rawは追える例、空間変化するf12、画像外/非有限、raw表示off時の既存挙動を確認する。独立browserで実顎の正面/中間/最大を確認。

completion: experiments/optical-flow-raw-view-completion.md。独立review: discussion/implementation/reviews/reference-guided-rigging/raw-view.md。rootはsourceを実装せず、最終の画像と役割説明をユーザーへ返す。新たなsemantic補正や格子適用は開始しない。

### このfollow-upでユーザーが受け取るものと判断

ユーザーは同位置で原画像と3点の棄却前経路を見て、現在隠れていた推定が利用に足るか、ずれを大きいと感じるかを判断する。数字の読解やコード検証をユーザーへ要求しない。推定が表示できたことを採用/自然さ/rigの合格としない。違和感の部位や段階をフィードバックし、rootが次の議論へ反映する。

### 限定follow-up受領

[completion](experiments/optical-flow-raw-view-completion.md)と[独立review](../../implementation/reviews/reference-guided-rigging/raw-view.md)を受領。source・関連14試験・実artifact不変性の独立レビューPASS。独立browser確認は担当環境で実施不可、rootは自身のbrowserで実画像を確認した。

root観察: 高解像度の顎付近は、中間R2が顎先近傍、最大R3が顎先より少し左の下顎近傍まで移る。baselineの同点はR2/R3がほぼ重なり首側に残る。両方とも採用経路は初段停止だが、棄却前の内容には明瞭な差があった。目視による暫定観察であり正解対応やユーザー承認ではない。入力・推定・採否条件は変更せず、意味情報による補正と格子工程は未着手。
