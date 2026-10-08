# 手動Face-X中間姿勢試作：経過・完了記録

## 現在の状態

**v4試作の実装・独立技術レビュー・rootブラウザ確認は完了。技術PASS、ユーザーの自然さ判断は未取得。** ユーザー了承済みのflat leaf warp方式で、neck_backは衣服としてidentity、neckのみroot指定v4変形を適用。t=0/.5/1の3frameを同位置で比較できる。下記の中断は解消済みの履歴であり、現時点の停止を意味しない。

最終URL: http://127.0.0.1:8769/manual-midpoint/viewer/?run=../runs/root-manual-v4/manifest.json

独立レビュー報告は discussion/implementation/reviews/reference-guided-rigging/manual-midpoint.md に保存済み。試験10/10 PASS、最終frameとcontrols整合、t=.5の独立再描画一致を確認。Review自身のブラウザは環境制約で利用不可だったため、rootの実操作確認を分けて記録する。

## 中断時点の状態（履歴）

ユーザーからDrawableに対するdeformerの既存craft方針との不整合懸念が示され、rootの指示で停止した。実装・造形更新・新たな生成・追加検証は停止。停止時に実行中だったv2描画のみ安全に完了し、実行中処理はない。技術レビューは未完了で最終PASSではなく、ユーザーの外観承認も未取得。

## 成果の性質

本成果はcraft準拠rig構造ではなく、**flat leaf warp試作**である。PSDの通常衣装・通常表情・閉口の可視33leafを独立RGBAへ抽出し、元の描画順で合成する。assignmentsはleaf IDから単一transform IDへの直接対応で、元座標にaffineまたはpiecewise bilinear変位場を適用する。親子deformer階層、既存rig塔のwrap、親変形の継承・合成は実装していない。

各側の目の白目・虹彩・まつ毛3leafは共通affine、前髪3leaf・後髪5leaf・首2leafはそれぞれ共通fieldを参照する。ただし各leafへ独立に逆写像して8bit RGBA化後に合成するため、親deformerによる共有ではない。faceのfieldは目・鼻・口・眉・眼鏡へ継承せず、各部品は直接指定された独立変形を使う。未指定leafはidentity。

## craftとの照合事項

rootからの照合報告では、craftの06 Face-X構造は1要素×1パラメータ、既存rig塔のwrap、実頂点unionと移動余裕を使うdomainが前提。06-0末尾にはneck_backが後ろ襟で衣服所有と記載されているという。今回の素材についてPSD表示からその意味を確かめる作業は未実施。rootはこのポリシーと所有を確認せず、neckとneck_backへ共有fieldを指示した。現在のv1/v2はその指示を保持し、停止後の推測修正はしていない。

## 保存済み成果

場所: C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/manual-midpoint

- assets/assets.json と33leaf PNG、identity診断。
- controls/root-manual-v1.json と root-manual-v2.json。rootの指定によるsource/target格子・affine。RAFTや画像fitは使用しない。
- src/ の素材抽出・描画器、viewer/、tests/。
- runs/root-manual-v1-preview/ のt=1試作。
- runs/root-manual-v2-preview/ のframe-00.png、frame-00-head.png、frame-00-face.png、frame-00-head-white.png、frame-00-face-white.png。
- v2のt=.5は未生成。実ブラウザ検証未実施。

## 造形の経緯とrootの視覚所見

rootが参照を見てv1の部品別数値を指定。初回画像について、目・眼鏡・顔の関係は良い初期結果、全身では首以外に大きな破綻は見えないと報告した。一方、首が斜めに傾いて見えたため、v2ではneck共有fieldの横変位だけを[35,35,20,8,0]から[6,6,4,1,0]へ小さくした。他の造形制御は不変。これはrootの初期視覚所見であって、自然さの最終合格やcraft適合を意味しない。v2画像への最終所見はこの記録では未受領。

## 検証の到達点

Gnome報告では最小試験10件PASS。元PSDのhash不変、閉口PSD直接合成と既存正面source完全一致を確認。個別PNG再合成には8bit量子化差があり、premult RGB最大3/255・平均0.0059185/255、alpha最大1/255。差分画像による補填なし。

独立Reviewは33leafの画素・bbox・順序・hash・identity再合成と、解析bilinear、affineとの一致、t=0/.5/1、変位の端値延長、fold・非finite拒否、premult補間を確認した。v1からv2の変形変更がneckのみであることも確認。Gnome試験一式の独立実行、最終runの独立再現、実ブラウザ、craft適合は未完了。自然さを技術試験で承認していない。

## 再開条件

rootがユーザーとcraftのDrawable適用方針および試作範囲を整理するまで停止を維持する。現在のflat試作をcraft準拠rigとして扱わない。記録保存以外の新たな実装・造形・描画・検証は起動しない。

## 再開と構造判断の更新

ユーザーは、同じ変形を適用する単位で部品がまとまり、顔全体を一括変形する構成でなければ今回のflat試作でよいと了承した。これにより停止は解除された。新しい階層rig実装は今回不要。中断前の構造の事実は変わらないが、その構造を今回の試作で使うことは了承済みである。

rootは assets/layers/08.png を実際に見て、neck_backが黒い後ろ襟であると確認した。neck_backは衣服としてidentity固定に変更する。v3はv2のneck縮小変位を保持し、neck_backのassignmentだけを削除して保存した。

rootはv2の頭部白背景画像で、首の傾きは改善したが左上端の水平な描き縁が露出すると判断し、v4のneck格子を直接指定した。x=[900,1100]、y=[540,550,565,580,620,666]、各行のdx=[42,42,10,4,1,0]を両xに同値、dy=0。上端だけを頭へ追従させ、565以下で元の首位置へ戻す意図。neck_backはidentity、その他はv1の指定を保持する。v4の自然さは描画後のrootとユーザーの判断事項である。

独立Reviewは再開後にGnome試験一式を実行し10/10 PASS。Review環境のCUAはbrowser利用不可のため、実ブラウザ確認はrootが最終viewerで行う予定。v3のmulti-frameはv4指示と交差して起動済みで、安全完了して履歴として保存する。採用版の追加判断はv4画像を待つ。

## v4候補の確定

rootはv4の頭部白背景画像を確認し、v2で見えた首上端の水平な描き縁が消え、v1の首全体の傾きも抑制され、後ろ襟が衣服位置に留まると判断した。顔・目・眼鏡は破れず回る形で、髪との大きな下地露出も見られないというroot所見。一方、参照との差は頬・髪の量感と帽子形状に残る。v4を今回の中間一姿勢の試作候補として確定し、追加造形は行わない。完成rigや自然さの最終合格を意味しない。

提示用にはt=0、0.5、1の3枚を保存する。連続動画を生成したとは主張しない。最終viewer予定: http://127.0.0.1:8769/manual-midpoint/viewer/?run=../runs/root-manual-v4/manifest.json 。初期表示は手動モデル試作、t=1、頭部、白背景、格子overlay off。1=元絵、2=参照、3=試作を同位置・同倍率で切り替える。

独立Reviewはv4previewについて、v1からの変更がneck_back割当削除とneck格子だけであること、neckがrootの軸・変位指定に一致すること、その他のtransform/assignmentsの不変、controls/assets/画像hash・寸法・参照元を確認した。最終3frameの整合確認とroot実ブラウザ確認は生成完了後に記録する。


## 最終成果とrootの途中姿勢確認

v4のt=0、0.5、1の最終3frameは生成完了し、runs/root-manual-v4/manifest.json のstatusはcomplete。renderer sourceは独立10試験PASS時から変更なし。viewerの既定は最終runへ更新済み。

rootはt=.5頭部白背景を見て、首の描き縁露出や顔・髪の大きな隙間がなく、正面から今回の中間姿勢への途中として破綻は見えないと観察した。preview viewerの専用tabでキー1/2/3切替、顔crop、Oによる格子表示を実操作し、元絵・参照・試作の同位置切替を確認した。このブラウザ証拠はrootによるもので、Reviewの独立ブラウザ実行ではない。

rootは最終viewerでもsliderの左操作でt=.5（2/3）、Homeでt=0（1/3）、Endでt=1（3/3）を実画像と表示値で確認した。初期の白背景・頭部・格子offを確認し、t=1へ戻して保持した。rootによるブラウザ確認はPASS。自然さの最終ユーザー判断は未取得。

## 最終技術判定

独立Reviewは最終v4のmanifest・controls・assets・各frameのhashとt=[0,.5,1]の整合を確認した。t=0は抽出identityとRGBA完全一致、t=1はv4previewと完全一致、t=.5は保存を伴わない独立再描画とRGBA完全一致。独立技術レビューはPASS。実ブラウザはReview環境では利用不能だったためrootの実操作確認を別証拠として扱う。

実装はmanual-midpoint内のみ。PSD保存、既存landmark-warp/optical-flowの変更、RAFT/自動fit、参照画素の描画混入は行っていない。素材抽出・10試験・入出力・再現性・rootブラウザ確認を完了し、v4をユーザーの視覚判断へ提示できる状態。完成rig、全面的なcraft準拠、自然さの最終承認は主張しない。

独立レビュー記録: discussion/implementation/reviews/reference-guided-rigging/manual-midpoint.md。

