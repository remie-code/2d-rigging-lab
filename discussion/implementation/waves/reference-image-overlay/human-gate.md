# 参照画像を重ねて片目を編集する

Windows の [Editor 候補](<../../../../tmp/reference-overlay-wave2/candidate-final/Private 2D Rigging Lab 0.0.0.exe>) を開きます。操作の詳細は [Canvas で参照画像を使う](../../../../apps/editor/reference-image.md) にあります。

保存済みの位置合わせから試す場合は [r815 の検証 workspace](../../../../tmp/reference-overlay-wave2/r815-editor) フォルダ全体を複製し、Editor の **Open Workspace** で複製先を選びます。参照の重ね合わせが 45% で開きます。選び直す場合は **Replace PNG** を使います。

1. モデルの workspace を開き、中央 **Canvas / Preview** の画像アイコン **Reference Image** から **Choose PNG** を選びます。[検証に使った参照 PNG](../../../ai-cohost/concept/shared-laughter-expression/laugh-relaxed-v2.png) を試せます。
2. **Overlay** で重ね、**Opacity** を動かします。**Adjust Reference** で枠を動かし、**Set Pivot** で合わせたい点を指定します。四隅で拡縮、上の丸で回転すると、指定した点を中心に画像が拡縮・回転します。**Scale** と **Rotation (°)** から数値でも調整できます。[位置合わせの画面](../../../../tmp/reference-overlay-wave2/editor-adjustment.png)
3. **Done** で参照を固定し、モデルが見える表示で既存の Rig を編集します。ホイールでズーム、中ボタンか Space＋左ドラッグでパンします。画面が縦積みの場合は Canvas までスクロールします。**Save Workspace** で保存し、同じ workspace を開き直すと位置合わせが戻ります。[固定後の画面](../../../../tmp/reference-overlay-wave2/editor-fixed-overlay.png)

Editor で保存した参照を Host で読み、右目の上まつ毛を比較しました。まつ毛の制御点183を下に9モデル単位移動すると、比較画像の列 x=290 でモデルの暗い輪郭は y=130 から144へ下がり、参照の y=178 に近づきました。高さの差と局所的な折れが残っています。[参照・変更前・変更後](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye.png) ・ [重ね合わせの前後](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye-overlays.png)

指定した点を中心に拡縮・回転できるか、固定後に同じ参照へ戻って Rig の変更を見比べられるかを試してください。違和感があれば、操作や表示で迷った箇所と、輪郭の印象が違う箇所をそれぞれ伝えてください。
