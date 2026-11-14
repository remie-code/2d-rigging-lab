# Canvas で参照画像を使う

1. Editor でモデルの workspace を開きます。中央の **Canvas / Preview** で、グリッドやデフォーマ表示の隣にある画像アイコン **Reference Image** を押し、**Choose PNG** で静止 PNG を選びます。**Replace PNG** は画像と配置を入れ替え、**Remove** は現在の参照を解除します。
2. **View** の **Overlay** でモデルに重ねます。**Opacity** を動かして線を比べます。**Model only** と **Reference only** でも配置と透明度の設定を保持します。
3. **Adjust Reference** を押します。水色の枠の内側をドラッグすると移動し、四隅をドラッグすると縦横の比率を保って拡縮します。枠の上の丸をドラッグすると回転します。**Set Pivot** を押して画像内をクリックすると水色の十字を置き直せます。画像の位置はそのままで、その点が拡縮・回転の中心になります。**Scale** と **Rotation (°)** は数値を入力し、Enter または欄の外をクリックして確定できます。
4. **Done** で参照を固定します。モデルが見える表示にして、通常の Rig 操作を続けます。ホイールでズーム、中ボタンか Space を押しながら左ドラッグでパンできます。狭いウィンドウでは縦にスクロールして Canvas を表示します。モデル全体に戻すには **Fit Artwork** を使います。
5. 参照変更と Rig 操作は同じ **Undo / Redo** で順に戻せます。**Save Workspace** で配置と元 PNG が workspace に保存され、同じ workspace を開き直すと表示が戻ります。Host の比較にも、その workspace に保存した参照を使えます。

Host が同じ workspace の参照を更新した場合は、開き直して新しい設定を読み込みます。Editor のモデルだけを保存しても Host の参照設定は保持されます。両方で参照を変更した場合は、最後に保存された参照設定が workspace に残ります。
