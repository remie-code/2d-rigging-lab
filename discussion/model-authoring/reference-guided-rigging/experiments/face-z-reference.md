# Face-Z 参照のすり合わせ

2026-09-27。ユーザーはBody-Xの首修正revision1330を承認し、Face-ZとBody-Zを希望。まずFace-Zのゴール像を合わせるよう指示した。Body-Zは未着手。

Face-Zを正面顔のまま首をかしげる頭部rollとして扱い、rootは最初に画面右への控えめな候補を生成した。元の通常衣装・通常表情・閉じ口の全身画像のみを入力。顔・帽子・眼鏡・頭の根元の髪は一緒に傾ける。肩・襟・身体は正面に保ち、首の付け根を襟へ接続。長い髪は根元が頭へ追従しつつ、下へ垂れる形を残すよう指定。傾斜10度は生成プロンプトの目安であり、実測の角度保証ではない。

内蔵image_genを使用。reference-face-z-v1.pngとreference-face-z-v1.prompt.txtをsecond-rigging-6-sol/reference-generation/face-z/へ保存。元絵と同位置で頭と肩・髪全体・全身を切替する http://127.0.0.1:8770/face-z/ に提示。参照のユーザー承認待ち。Face-Zのrigの編集には進んでいない。保存モデルはbody-x/package revision1330のまま。
