# 一緒に笑う表情と、配信で伝わる演技

2026-11-12。ユーザーとの議論・画像による認知合わせと、次のキーフォーム試作の前提。制作完了・製品採用の記録ではない。

## 1. 次に表したいこと

[15系統の仮分類](speech-motion-candidate-families.md)の⑨「一緒に笑う」を次の制作対象に選んだ。⑥は「驚いて身を引く」であり、笑みなしでも取り組める候補として残る。⑧苦笑、⑬親しみ・照れとの比較後、⑨をユーザーが了承した。

基準にした実配信のテキスト記録:

- 原意図: `つられて笑う`
- 発話: `「こいつ倒して終わろう」が、もう一戦増える合言葉になってきたね。`
- 文脈: 配信を締めるつもりが戦いが続き、視聴者が「ｗｗｗ」と反応した場面。
- 記録: `fire-448 / section-0`、[元ログ](../../../apps/soul/agent/tmp/speech-intent-none/468719ddfcadd18052b52e1b614c9083ac9cadd58da1b4d045263b3890a69476.json)。原音声ではなく保存された発話テキストに基づく。

相手や視聴者の面白がりに乗り、「うちもそれをおもしろいと思っている」と共有する。愛想笑い・照れ・苦笑・安堵とは区別する。大笑いである必要はないが、ちゃんと笑っている反応が欲しい。演技の意味の合意であり、今回のモーションの注意対象別variant一覧は未決。

## 2. 画像で合わせた笑み

内蔵imagegenで、[r804正面](shared-laughter-expression/neutral-r804.png)を参照して作成した相談用画像。モデルに適用済みの絵・キーフォームではない。画像原本はこの文書とともに保存し、[生成条件](shared-laughter-expression/generation.md)から辿れる。

1. [初稿](shared-laughter-expression/laugh-v1.png): 開いた笑い口、頬の上がり、細まった目。ユーザーは笑いとして認知できたが、目元に微かな違和感があり、第一印象は「ちょっと怖い」。笑いきった瞬間を静止して見ている影響かもしれない、という仮説も挙がった。
2. エージェントは、口は明るく笑う一方、狭い目から瞳が強く見えて、力を入れてじっと見る印象が混じる可能性を示した。ユーザーは「力が入っているように感じている可能性がある」と応答。原因の確定ではない。
3. [目元と口元の力を抜いた第二稿](shared-laughter-expression/laugh-relaxed-v2.png): ユーザー評価は「こっちのがそれっぽい」。この方向を参照にする。ただし全細部を最終承認した、または開いた口の形を固定再現すると合意したものではない。

## 3. 技術的な課題と棚卸し

ユーザーの問題意識は、口角を笑みにして口パクと重ねる際、単純加算で自然な形になるか、母音や開口量に応じた形を現行keyformで指定できるか、というもの。エージェントが先に述べた「笑みを作って口パクと重ねる」だけではこの前提が不足していた。

シルフのソース/Export読取による確認（今回、テストやGUIの再実行はなし）:

- EditorのVariantはdrawable可視性を切り替える仕組み。作成・保存・Export・Runtime手動切替まであるが、SoulがVariantを選択・解除するwireは未接続。
- 既存`<smile>`は口角・細目・頭傾げのパラメータ演出。r804には`Mouth Smile`の宣言とaliasはあるが、その口角変形を実体化するkeyformはない。パラメータの存在と造形の存在を区別する。
- 単軸Smileは母音/開口に依存しない変形。既存Grid2DならSmile×Open、Smile×U等を個別に補正できる。通常キー編集UIは1D、`addKeyformGrid2d`操作には2軸の作成経路があり保存・Export・Runtimeを通る。r804の口にもOpen×母音の補正が存在する。
- 加算Grid2Dに入れるのは望む完成形と既存合成との差。2Dが既存1Dを自動的に打ち消すわけではない。Smile×Open×Uの独立した3軸条件は直接指定できない。warp階層に分けるだけでこの条件依存を得られるわけでもない。

参照: [タグ演出表](../../../apps/soul/agent/src/mind/expression-table.mjs)、[2軸作成操作](../../../packages/operation-core/src/operations/add-keyform-grid2d.ts)、[2軸補間](../../../packages/runtime-core/src/keyform-grid2d-interpolation.ts)。

## 4. A/Bの選択と配信での価値

ユーザーが二つの選択を提示した。

- A: 複雑なキーフォームを入れる機構を作り、口の組み合わせの細部までこだわる。
- B: 目・眉・ステージモーションなどを中心に表現し、口の複雑な条件付き変形を無理に追わない。

**ユーザーとエージェントはBに合意した。Bで十分に伝わるかは、まだ検証していない。** 口は現在の口パクを使う方針。複雑な口の機構追加や、母音別の笑い口を作り込むことを今回の前提にしない。画像の開いた口を固定して発話させる方針でもない。

ユーザーが示した利用状況:

- 主対象は配信画面。本人はほぼゲームを見ており、OBS確認時などにチャッピーを時々見る。
- 視聴者向けの表現という意味が強い。視聴者も主にゲームを見るのではないか、というユーザーの見立て。
- 実際、たまにこちらを向く・頷く動きだけでも、ずいぶん表情豊かになったと感じた。
- 動きそのものにはこだわるが、顔の細部より、目・眉・身体等で意味のある反応が読めることを優先したい。

エージェントは、反応するタイミング、動き出しから収まりまで、注意対象、目元/眉の伴い方を重視し、配信画面内の大きさでも評価する方針を提案。ユーザーはその議論を了承し、記録とcontext-checkを依頼した。顔の拡大表示は造形の確認に使えるが、それだけを最終の有用性判断にしない。細部を省くことを、動きの粗さを許容する根拠にしない。

## 5. 次の行為と未確認

ユーザーの依頼は「さっきの笑みを実際にキーフォームで作ること」のcontext-check。rootの理解は、第二稿の力を抜いた笑いを参照し、Bに沿って目元・眉を中心に既存モデルで試作すること。今回は記録と前提確認までで、モデル編集や製品接続を開始していない。

- 現在のモデルsourceと作業差分、目/眉の実装・編集/描画経路を限定棚卸しする。
- 既存の瞬き・視線・口パクと笑いの共存、および左右の向きでの見え方は実物で確かめる必要がある。
- 完成した演技の時間曲線、対象別variant、Decision候補への追加、配布更新は次段階。今回の表情試作の了承に含めて自動着手しない。
- モデルを更新してExportする場合、既存安堵clipのr804限定適用条件への影響を確認する。現在の製品モデルを試作の都度置き換えるとは合意していない。

## 6. 安堵3案と228件の関係（議論の入口）

シルフが既存228区間の原意図を確認し、安堵/緩みを含む16件の本文と文脈を照合した人手の見積もりでは、今回の「短く息を抜く」3対象版に明確に近い5件、柔らかく解釈すれば計9件（2.2〜3.9%）。この追加だけなら219〜223件が残る。16件すべてが対応したとは見なさない。実Decision再判定・実再生率の測定ではなく、既存receive/interest/askで拾い直せる分も含めていない。228は区間数であり、原タグの完全一致で数えた文字列は206種。この見積もりを入口に笑みと次の演技の議論へ進んだ。

## 7. キーフォーム試作に向けたcontext-check

行為の理解: 力を抜いた第二稿を参照し、Bの方針で目元・眉を中心に「一緒に笑う」表情を既存keyform機構で試作する。口は既存の口パクを保つ。顔の拡大確認と配信画面内の大きさでの確認を行えるようにする。完成モーションの登録・製品更新は、この行為と分ける。

前提:

- **known（ユーザー判断）**: ⑨の意味、第二稿の方がそれらしいという評価、Bの採用、配信画面での反応の読みやすさを重視する背景。
- **known（既存合意）**: 目の開閉・視線・口パクの機能を保つ。左右の向きは通常モーションで80%程度までを上限とする。
- **known（棚卸し）**: 現在のモデルsourceは `C:/workspace/remie/rigging/astra-chan/workspace`。manifestはr804、現用Exportもr804、115件のkeyform IDとキー内容が一致。Gitはそのworkspace内でbranch `codex/reference-face-x-left`、HEAD `5b2e732` のmanifestはr335。読み取りでindexと照合できた7追跡ファイルに差分があり、r804制作成果を含む。通常statusは環境のcwd権限エラーで得られず、未追跡ファイルを含む全状態は未確認。
- **known（棚卸し）**: 目の開閉はまつ毛・白目・虹彩・opacityを連動させる。現在のsmileの細目は独立squint造形ではなく、既存開閉の途中値。眉Yには専用warp、眉Formには宣言がある。既存の開閉キーを保ちつつ別入力で表情を試作できる操作経路はある。何をどれだけ造形するかは、参照と描画を見て定める。
- **known（棚卸し）**: Authoring Hostにparameter/warp/keyform編集と `renderView` + `parameterOverrides` がある。現在姿勢・笑みゼロ/有効・左右yaw±24°・視線・瞬き・口形を比較する経路がある。旧astra側 `workspace-notes/tools/host.mjs` は現用保存と自動git操作を含むため、そのまま試作へ流用しない。
- **known（製品契約）**: 安堵clipはr804に厳密一致を要求する。新revisionを現用へロードするとslot不変でも拒否される。試作は別のコピー・出力で進め、現在の配信モデルを置き換える作業とは分ける、という実施案をrootから提示する。
- **inferred / 未検証**: 目・眉中心の造形が第二稿の柔らかい笑いを十分に伝えられるか。これは制作前の事実として扱わず、試作を見て評価する対象。新規独立入力を採用した場合のSoul割当は、今回の手動表情試作とは別の接続事項。

棚卸しの根拠: [既存smile表](../../../apps/soul/agent/src/mind/expression-table.mjs)、[r804適用条件](../../../apps/runtime-player/src/main/control-channel/speech-motion-state.ts)、[craftのHost入口](../../model-authoring/craft/00-workspace-bootstrap.md)。外部モデル内の `workspace/model/keyforms.json`、`workspace-notes/eye-constraints.md`、`workspace-notes/tools/rig-lib.mjs` とr804 Exportもread-onlyで照合した。モデル編集・描画・新たなテストは未実施。

context-check結果: **Inventory first → 限定棚卸し済み、試作の進め方を組み立てられる（Plan directly）**。新しいユーザー価値判断を埋めないと試作を組めない前提は現時点で見つかっていない。Bの表現が十分かは本人の視覚評価に残す。これはモデル編集の開始や、表情の製品採用を意味しない。

### 試作前の現状コミット（2026-11-12）

ユーザーは試作開始前に、現モデルの未コミット成果を先にコミットし、その上へ積み上げるよう指示した。モデル編集は未着手のまま、通常Gitコマンドで再確認したr804成果を保存した。

- `astra-chan/workspace`: branch `codex/reference-face-x-left`、commit **`7ac9841`**。承認済みの顔/髪再造形と追加側面髪素材、atlas、provenance等14ファイル。
- `astra-chan/workspace-notes`: branch `master`、commit **`0d767b3`**。`export-face-rebuild-r804/` の手順・検証・描画証拠10ファイル。
- 各コミット後のGit statusは両リポジトリともclean。JSON 21ファイルの解析と追加素材2件のmanifest記載サイズ/SHA-256一致を確認。モデルrevisionは804のまま。試作のkeyformはまだ追加していない。

この記録により、上の棚卸し時点にあった「未コミットr804成果」は保存済みとなった。モデル変更後の製品clip適用条件については別途確認が必要な点を維持する。

### 試作開始（2026-11-12）

ユーザーがコミット後に「改めて笑みの試作に入ってくれ」と指示。`shared_laughter_expression_astra`（GPT-6 Astra）へ造形を委譲した。上記コミットを復元点としてauthoring workspaceへ表情のkeyformを積み上げる。現用r804 Exportは維持し、必要な試作用出力は別にする。目元・眉の表情入力、通常の瞬き/視線/口パクとの共存、左右80%までの見え方を確認し、正面比較・小さめ表示例・短い試作動画でユーザーが判断できる状態を目指す。独立パラメータを作った場合の製品接続は今回に含めない。

### 試作v1の受領（2026-11-12）

Astraがsourceをr815として保存。未コミット。成果物は `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v1/` の `README.md`、`comparison.png`、`shared-laughter-v1.mp4`、`verification-sheet.png`、再現scripts/recipe/provenanceへ保存した。

- 独立した `param_shared_laughter`（0〜1、初期0）。製品aliasとSoul接続は未追加。口の素材/口パクを変更せず、白目マスクとまつ毛の下縁を持ち上げ、眉の控えめな変化を合わせた。
- 既存開閉キーを保持し、Smile×Eye Openの2軸補正は閉眼時にゼロへ減衰。モデル側の既存操作で制作し、エンジン機構は追加していない。
- 既存115 keyformは内容一致。笑み0の正面PNGは基点と一致し、8条件の評価頂点差は0。保存後の中立/強のPNGは制作時と一致。新規キーの負のゼロが保存で0になる差は描画差ではないと切り分けた。
- 20条件の描画を担当とrootが目視。±24°、視線、半閉・閉眼・片目閉眼、口開きとの組合せに明らかな白目/虹彩の漏れや閉じ残りは見えなかった。全入力組合せの保証ではない。
- strict検証blockingは0。ただし既存538件のerrorに、新しい2warpのruntimeEvidenceMissingが加わり540件となった。検証全体がcleanという結果ではなく、新しい造形の製品接続も未実施。
- 6秒・20fps・無音動画は笑み立上がり/復帰、既存の母音口形と瞬きを含む。実音声同期や完成した笑いの演技ではない。小サイズ例は208×220で、実OBS配置を計測したものではない。
- rootも目元の変化を確認したが、閉口・小サイズで「一緒に笑う」が十分伝わるとはまだ判断していない。動画を含めたユーザーの印象確認待ち。
- 現用r804 Exportは非更新。sourceのGit差分はmanifest/graph/keyforms/parameters/rig-controlsの5ファイル。基点commit `7ac9841` を維持し、無断commit/pushはしていない。

## 8. 参照表示を先に整える判断（2026-11-12）

ユーザーはv1を見て作り方に疑問を持ち、craftの開閉手順との比較を依頼した。担当から、目標輪郭を取り直す工程を行わず、既存目矩形に対する上下変位関数の係数で形を調整したと報告された。参照のまつ毛線と開口を直接比較して合わせる工程が不足していた。目標形へ合うことと既存機能を壊さないことを分けて確認する必要がある。

その後、参照をCanvas/Hostで同じ場所に表示し、opacityや単独表示で比較する機能を先に整えることで合意。指定基準点を拡縮・回転の両方に使い、基準点の置き直しでは画像を動かさない。位置合わせ完了後は参照を固定して既存モデル編集へ戻る。参照は制作資料として保存復帰し、Runtime Exportに入れない。1Dキー編集GUIの範囲は維持し、2D編集画面まで今回追加するとは合意していない。

context-check後、ユーザーが計画作成と起動を指示。実装・Orch・独立レビューはGPT-6.1 Sol。[参照画像表示の2 Wave計画](../../implementation/orchestration/reference-image-overlay-wave-plan.md)が現在の入口。Wave 1で共通状態・保存・Host描画、Wave 2でEditor操作と片目一か所の比較往復を確認する。笑み全体の再造形はこの作業面の確認後に続ける。

同日、2 Waveの実装・独立レビューが合格。Editorで基準点の拡縮/回転、参照固定後の既存1Dキー編集、Undo、保存再開を実操作で確認し、別Hostも同じ参照を再現した。[本人確認の手順と最終Editor候補](../../implementation/waves/reference-image-overlay/human-gate.md)へ。検証用コピーで上まつ毛の一点を下げた比較は作業経路の証拠であり、局所的な折れと参照との差が残る。笑み全体の再造形・本番astraへの反映・現用Export更新は行っていない。

## 9. 参照を直接比較する笑みv2の試作

ユーザーは本題の前提を再確認した後、「試作に移ってくれ」と再開を指示。Astraの制作担当へ、共通Host参照表示を使い、参照の線と現在の描画を同じ配置で見比べて目元・眉を造形する作業を委譲した。v1の推測的な上下変位関数を前提にせず、上まつ毛・下縁・白目と目頭/目尻のつながりを観察し直す。口は既存口パクのまま。authoringモデルの試作、比較画像、短い無音動画が今回の成果物であり、製品ExportやDecision接続は含めない。

開始時点: v1 r815が未コミットの前提を現物で確認し、変更前を復元できる形で保存してから積み上げる。担当 `shared_laughter_expression_astra`、制作中。ユーザーの美的判断は試作提示後に残す。

### v2の受領

Astraが **r818** としてauthoring sourceへ保存。未コミット。制作記録は [v2 README](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v2/README.md)、[参照/v1/v2/overlay比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v2/eye-comparison.png)、[強さ別比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v2/comparison.png)、[6秒無音動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v2/shared-laughter-v2.mp4)へ。

- 共通HostのreferenceImage登録/更新とrenderViewを実制作に使用。目頭と両目の位置を見て一様配置を合わせ、倍率0.83・時計回り2.4°を固定して形を比較。参照の頭の傾きを笑みへ焼き込まず、目元の輪郭を合わせた。
- v1の下側を切り取る形から、上まつ毛がかぶさり、虹彩の下側の明るさが残る形へ修正。まつ毛・白目マスク・虹彩を分けて造形。初回のインク分布写像は目尻に折れが出て不採用、参照で観察した輪郭対応点から調整し、実描画を再確認した。
- v1表情残差が通常Openのreplaceで消されるモデル側の評価順を修正。Editor/Host間の差ではない。表情側order10、眉の表情キーはadditiveDeltaへ。旧v1の4つのGrid2Dを置換し、眉2つを修正、虹彩の2つを追加。打消し層や新エンジン機構は追加していない。
- rootは途中形、最終比較、25状態のシート、動画の抜粋フレームを目視。白帯や大きな目尻の鉤は解消したと判断。一方で上の細線の端・目尻の微小差、極端な上視線で虹彩が隠れる限界が残る。閉口の静止形では穏やかな半眼にも読め、笑いとしての十分さは本人評価を待つ。
- 元115キーは内容不変、笑み0の9条件で基点r804との頂点差0。保存後の別Host CLIでmodel/overlay/中立の描画が候補PNGとバイト一致。25状態・120フレームが有限座標、動画decode成功。strict validationはblocking0だが既存を含むerror540/warning2であり、全体cleanではない。
- r815復元用資料はv2内before-r815へ保存。r815からmodel変更はmanifest/graph/keyformsの3つ、別途authoring参照。基点7ac9841からはv1込み5 modelファイル差分。現用r804 Export全ファイルhash不変、製品接続・commit/pushは未実施。

動画は表情の立上がり/保持/復帰、既存母音口形と瞬きを見るための6秒・20fps・無音の試作。実発話同期や完成した笑い演技ではない。小サイズは208×220の例で、実OBS配置は未測定。次はユーザーが表情と動きを見て、参照の柔らかさと笑いの印象についてすり合わせる。

### v3 — 瞳孔の位置と視線の印象

ユーザーは参照とv2を横に並べて確認し、「形状はかなり近い」と評価。一方、黒い瞳孔が試作では上、参照では中央にあり、試作が変な方向を見ている印象だと指摘した。瞼の形を保ち、見える目の中で黒い部分が中央に収まってこちらを見る印象へ寄せる調整を了承。

Astraが笑み時の左右の虹彩だけを下へ戻し、**v3/r819** として保存した。変更は虹彩の表情Grid2D左右2つ。瞼・白目の開口・口・通常の視線キーは不変。参照の配置もv2の0.83倍/2.4°のまま固定。rootは候補の目元・顔全体・overlay、15状態シートと動画抜粋を目視し、上瞼に黒が寄って見える印象が減ったと判断。参照と比べた瞳孔自体の縦長形状等は残し、今回の位置調整から拡大して作り込まない。本人の評価は未受領。

成果は [v3 README](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v3/README.md)、[参照/v2/v3の横並び](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v3/eye-comparison.png)、[6秒無音動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v3/shared-laughter-v3.mp4)、[口の開閉を切替できる比較ページ](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v3/reference-side-by-side.html)へ。

r818復元資料をbefore-r818へ保存。今回のsource差分はmanifest/keyformsの2ファイル、未コミット。元115キー保持、笑み0の4代表条件で基点r804との頂点差0。15静止条件・120動画frameを確認し、保存後の別Host CLIで目元/overlay/中立のPNGが候補とバイト一致。strictは従来と同じblocking0/error540/warning2。現用r804 Exportと参照設定は不変、製品接続やcommit/pushなし。

## 10. 閉じ切った「にっこり」へ目標を簡単化する

ユーザーのv3評価は「なんか違う。にっこりというより穏やかに何かしている印象」。半眼の笑顔について望む印象を十分に言語化しにくく、共有できる目標を持つことが難しいため、両目をにっこり閉じ切る動作へ問題を簡単化する提案があった。rootは賛成し、閉じた笑顔の参照を先に合わせ、その後craftの閉眼手順を確認して造形する順番を提案。ユーザーが参照画像の作成を指示した。

内蔵imagegenで前の参照の目元を変更した [閉眼の笑顔v1](shared-laughter-expression/laugh-closed-eyes-v1.png) を作成。[生成条件と原文prompt](shared-laughter-expression/closed-eyes-generation.md)。両目を完全に閉じた柔らかな弧と開いた笑い口の案で、本人の印象確認待ち。モデルはr819のまま。画像の口をモデルへ新造形する合意ではなく、B方針の口パク維持は継続。

ユーザーはv1の口が大きく笑いすぎており、通常の口パクで動く実モデルと印象がずれると指摘。目元は維持して口を落ち着かせるよう依頼した。モデルの通常閉口を補助参照に、内蔵imagegenで [控えめな閉口のv2](shared-laughter-expression/laugh-closed-eyes-quiet-mouth-v2.png) を作成。閉じた目の笑う弧と小さな口を組み合わせた参照として、本人確認待ち。モデルへの閉眼笑み造形はまだ開始していない。

### 採用目標: 元の正面画像から再構成した閉眼笑顔v3

ユーザーはv2に対し、意図は「口を閉じる」ではなく「口の開き方を抑えめにしたうえで、元の正面参照画像から笑みを再構成する」ことだと訂正した。元のneutral-r804のみを入力に内蔵imagegenで [閉眼笑顔v3](shared-laughter-expression/laugh-closed-eyes-from-neutral-v3.png) を生成。ユーザーは **「いい感じだ。これをゴールにしよう。めちゃくちゃ解釈一致」** と採用を明示した。

**以後の造形目標はこの閉眼参照v3。** 柔らかな弧で閉じた目と、控えめに開いた口を伴うにっこり笑顔の印象を共有できた。以前の半眼や直線的な閉口の参照を採用目標と混同しない。[生成条件・原文prompt・制作時の扱い](shared-laughter-expression/closed-eyes-v3-generation.md)へ。B方針の通常口パクは維持する。次はcraftの閉眼手順を確認し、目標の形を実際のモデルへ造形する段階。現source r819/現用Export r804はこの参照作成では変更していない。

### 閉眼笑顔の試作開始

ユーザーが「手順確認して試作に入ってくれ」と指示。rootが [craftの目の開閉](../../model-authoring/craft/05-eye-open-close.md) を読み、Astra制作担当へ委譲した。採用参照の笑う弧へ形を合わせ、形が重なる区間で素材を交代すること、まつ毛と白目/虹彩の閉じ方を分けること、素材ごとの閾値を実画像で確認することを継承。通常の瞬きで閉じた顔をそのまま笑顔とはしない。

開始モデルr819の復元記録を残してから造形し、口は既存口パクを維持。笑み0の通常挙動と笑み中の瞬き共存を確認し、参照との横並びと短い無音動画を受け取る。制作担当 `shared_laughter_expression_astra`、記録先 `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/`。制作中、本人の造形受領は別。現用r804 Exportの更新・製品接続・commit/pushは含まない。

### see-throughで閉じ目素材を取り出す方針への変更

ユーザーは作業を一旦止め、起動済みの `http://127.0.0.1:7860/`、本体 `C:/AI/see-through-webui` のsee-throughを使うよう指示。よりよい版があれば差し替えも許可した。既存まつ毛のみを変形していたAstraの接続作業を停止した。途中候補はメモリ内と試作画像のみで、sourceモデルはr819のまま。新しい採用参照の登録だけがauthoring側に保存されている。

rootがローカルAPIを確認し、採用参照v3を **NF4 / 1280 / seed42 / 左右分割有効** で分解開始。インストール済みのモデルIDは、確認時の[公式推論スクリプト](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_quantized.py)と同じ `24yearsold/seethroughv0.0.2_layerdiff3d_nf4` と `24yearsold/seethroughv0.0.1_marigold_nf4`。実装全体が最新版とは断定せず、モデル差し替えより既存環境での素材品質確認を先に行う判断。

出力先は `C:/AI/see-through-webui/workspace/webui_output/laugh-closed-eyes-from-neutral-v3_1794482639/`。分解結果のまつ毛・瞼の線が採用参照の印象を保つかを目視してから、閉じ目素材として試作へ渡す。全身の分解結果を現モデルへ置換する意図ではない。**この時点では分解実行中で、抽出品質・モデル接続とも未確認。**

分解は完了した。NF4/1280/seed42/30steps、深度720、左右分割あり。WebUI所要8分24秒、推論statsのtotalは約473秒。RGBA層24枚、通常PSDと深度PSDを出力。通常PSDの `eyelash-l/r` と `eyebrow-l/r` をRGBAのまま切出し、透明余白4pxを追加。元参照1280×1229からPSD1280×1280への上余白25pxを補正した切出し位置と、画素SHAをmanifestへ記録した。

rootが参照・抽出層を肌色/白/暗色背景で目視。まつ毛の太い弧と薄い瞼線は残り、原画よりやや柔らかい線になるが試作に使用できると判断した。抽出の受領は完成モデルの本人受領ではない。素材を `tmp/closed-smile-seethrough/` からAstraへ渡し、制作記録へ保存したうえで笑顔用の独立drawableを追加し、採用参照へ終端を合わせてから開閉をつなぐよう制作再開を依頼した。

ユーザーの追加依頼で、別のシルフ（GPT-6.1 Sol）が [see-throughの最新版・手元との差の調査](../../model-authoring/research/see-through-update-survey-2026-11.md) を作成。公式重みの大幅更新は確認できず、必要時に独立環境でbf16 block swapと比較する提案。現在の環境の置換や再起動は行っていない。

### 閉眼笑顔v1の試作受領（source r823）

Astraが抽出した左右の閉じ目を笑顔用drawableとして追加し、sourceを **r823** として保存した。独立入力は既存の `param_shared_laughter`（0〜1、初期0）。通常の口パクと115個の既存keyformは保持し、笑み1では瞬き・視線入力にかかわらず抽出した閉じ目を表示する。新しい左右素材は既存の顔向きに追随する。眉の抽出素材は保管のみで、今回モデルには使っていない。

成果物の正本は [制作記録](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/README.md)。[目元の参照/試作/通常閉眼](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/eye-comparison.png)、[顔全体の比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/face-comparison.png)、[6秒無音動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/shared-laughter-closed-eyes-v1.mp4)を作成。動画は通常→笑顔→既存母音の口パク→復帰で、実音声との同期ではない。

rootは比較画像・22状態シート・動画抜粋を目視し、終端の弧と細線が採用参照の「にっこり閉じる」印象に近づいたことを確認。本人の試作受領はまだ。素材交代区間では細線端と旧素材の毛先にずれが残り、完全な形の一致とはしていない。閉眼時に露出する前髪先端の明るい角は、新素材を隠しても残る既存境界と切り分け、今回未修正。

通常入力4条件で笑み0の描画がr804基点と一致。笑み1の瞬き/視線/左右±24°/口パクを含む22条件、動画120フレームを限定確認した。r822の造形保存後、source layer対応2件のmetadata修正でr823へ更新。読み直した終端PNGはr822とバイト一致し、動画フレームは再利用した。strictは合格ではなく、error540→787/warning2→4/blocking0。増分は細分meshのUV範囲診断237件、既知warp opacity診断8件、runtime evidence未登録2件等で、詳細を制作記録に分類。新規のsource layer不整合2件は修正済み。

新素材によりatlasが古くなりruntime export preflightが拒否するため、今回はauthoring評価とsoftware描画で試作を提示した。atlas更新・配信向け反映は別作業。現用r804 Exportは全ファイルハッシュ不変、製品接続・commit/pushなし。抽出素材/元PSD/設定、before-r819・before-r821、最終saved-r823、再描画scriptを制作記録側に保管した。

ユーザーは動画でモーションと瞬きが重なっていることを確認した。共存確認用として移行中/復帰中にも瞬きを入れていたと説明すると、「それなら多分大丈夫」との暫定評価のうえ、念のため移行単体の動画を希望した。saved-r823を読み、同じ笑み曲線・6秒20fpsで両EyeOpenを常時1、口/視線/顔向きを固定した [瞬きなしの顔拡大動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/smile-only/smile-transition-only-face.mp4) を作成。全120frameの固定入力と動画デコードを確認し、抜粋を目視した。モデルは変更せず、再現script/recipe/全体版も同所へ保存。単独動画に対する本人の確認はこれから。

単独動画に対し、ユーザーが「開始時に眉が細くなる印象」の詳しい説明を求めた。[開始時の診断](shared-laughter-expression/closed-eyes-onset-diagnosis.md)で、眉自体は持ち上げのみである一方、上まつ毛の遷移用複製が白目・虹彩の後ろへ描かれ、交代時に線の一部が隠れる不整合を確認。描画順だけを補正した診断画像で通常側とほぼ同じ見た目へ戻った。モデル修正は未実施、ユーザーの指す部位との対応は説明で区別する。

ユーザーが診断に同意し補正後に違和感がないと評価、モデル修正と動画再作成を指示した。Part childrenの順序を正式操作で修正し **source r824** へ保存。形/キーは不変、通常・終端・左右向き等5条件はr823とPNG一致。修正後の [瞬きなし動画v2](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/smile-only-v2/smile-transition-only-face.mp4) を作成した。詳細は上の診断記録の追記と [v2制作記録](C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/smile-only-v2/README.md)へ。修正後動画は本人確認待ち、現用Export不変。

### 笑顔差分の本人採用と、演技の議論への復帰

ユーザーが修正後動画を見て **「笑顔差分はこれでいいと思う」** と採用した。採用対象はsource r824の閉眼笑顔差分。完成した会話モーションや製品接続・Export更新の受領とは区別する。

ここで⑨「一緒に笑う」の演技制作へ戻る。基準実例は本書§1の `つられて笑う` / fire-448 section-0。「『こいつ倒して終わろう』が、もう一戦増える合言葉になってきたね。」と、視聴者の笑いに乗る文脈。笑顔の造形は合意できたので、次は頭・姿勢・ステージの動き、笑い始め/収まり、注意対象別の演技を議論する段階。これらの具体的曲線やvariant一覧はまだ確定していない。

既存調査とrootの演出案から「面白さに乗る→笑いがこぼれる→共有したまま収まる」を提案。今回は正面から上の視聴者へ注意を向け、笑顔に合わせて頭/上体/Stage Yを二拍（後半は小さく）弾ませ、揺れが収まってから開眼し、対象への注意を残す一案。ユーザーが制作を依頼し、[視聴者向けの一緒に笑う試作](../experiments/speech-motion-shared-laughter-v1.md)へ進んだ。通常瞬きを重ねず、モデル造形は変更しない。演技の本人採用と製品接続はこれから。

視聴者向け試作v1の身体の動きは本人高評価。一方、閉眼中の瞳が上へ吸い込まれる印象を受け、瞳Yのみ制作時位置0へ固定したv2を作成した。ユーザーはv2を採用し、視聴者・画面向けの両方に使う方針に合意。表情移行中は別の視線/瞬きを重ねない方向を検討するが、一般的な制御機構は未実装。次は[相方向け](../experiments/speech-motion-shared-laughter-partner-v1.md)として、画面左へ向きながら笑みを立ち上げ、大小二拍の弾みと開眼へつなぐ案を承認し制作依頼した。

相方版もユーザーが「めっちゃいい、これでいこう」と採用し、笑みモーションの登録を依頼。[登録計画](../implementation/orchestration/shared-laughter-registration-plan.md)に従い、視聴者/画面共通v2と相方版を既存演技×対象の仕組みへ追加する。笑顔を含むExportといつものRuntime Player配布物へ反映し、製品上で瞳固定・瞬き抑制・口パク共存を確認する。実装/独立レビューは6.1 Sol。製品での本人確認はまだ。

製品登録と配布確認が完了。採用r824の形/キーを保ってatlas更新し、現用sourceとExportはr825。相方向けv1、視聴者/ゲーム共用v2を既存二問判定へ接続した。演技中は瞳XY0・EyeOpen1を優先し、専用笑顔で閉眼する。口は本番リップシンク。通常完走と中断後の解除、既存6組と新3組を通常exe/portableで確認。独立レビュー・Runtime 1069件・Soul 2535件・型検査合格。Playerと起動済み操縦席を再起動して実会話へ。詳細と復元先は[完了記録](../implementation/waves/shared-laughter-registration/completion.md)。本人の配信/実会話確認は未実施。
