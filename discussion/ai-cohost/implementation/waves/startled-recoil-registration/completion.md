# 驚いて思わず身を引く演技の登録

ゲーム画面と視聴者は同じ採用クリップを再生し、相方は未制作ペアとして既存の記録に残る。Soulは演技と対象を独立に判定し、発話は結果を待たない。笑顔・瞳・まぶたは演技中の競合を防ぎ、口は音声リップシンクを通す。[受け入れ基準](basis.md) · [独立レビュー](../../reviews/startled-recoil-registration/review.md)

## 原本とモデル

採用元パーツ版の16個のopacity overrideを現用r839からの候補へ保存し、正規atlas・Exportを再生成した。r840の42 drawablesには原textureを使う移行虹彩が含まれ、抽出8 drawableは驚き中も非表示。保存の変更はkeyformsとatlas関連4ファイル。Strictの診断896明細は前後一致し、内訳はerror 884、warning 12、blocking 0。atlas更新後のExport preflightはready。[変更前後のハッシュ](../../../../../tmp/startled-recoil-registration/file-changes.json)

既存9組（8クリップ）は907姿勢の描画幾何、不透明度、表示順が一致し、48 PNGも全画素一致。通常顔・左右・笑顔・I口を重ねた9姿勢も全画素一致。新演技は採用原本と13姿勢の幾何が一致し、口開と両側移行虹彩を確認した。カメラ込みの11姿勢は最大3画素・1階調差。[旧演技と新表情の描画比較](../../../../../tmp/startled-recoil-registration/parity.json) · [左右と口パク](../../../../../tmp/startled-recoil-registration/controls-and-mapping.json) · [カメラ込みの比較](../../../../../tmp/startled-recoil-registration/adopted-camera.json)

## 検証

Runtime全155ファイル・1,074件、Runtime型検査、Soul関連4件が成功。原本145フレームの表情・姿勢・Stageを照合。試作のStage縮小率は最小 `0.9482081318473564`、Yは最大 `3.998591604938272px`。本番ではこの倍率を通常のStage合成に掛け、Presence Offでも演技の倍率と上下動だけが効く。NativeとBrowserへ同じ結果を送る。実WebSocketで画面・視聴者、相方の未制作記録、未知モデルの拒否、目の固定と実音声口パク、通常完走と中断の解除を確認した。[Runtime全体ログ](../../../../../tmp/startled-recoil-registration/runtime-tests.log)

## 配布と起動

現用workspaceとRuntime Exportをr840へ更新し、候補と全ファイルのSHA-256一致を確認した。現用Exportを再読込し、atlas SHA-256 `bb440ca91ddc95b397551251cea6be4b07052e5ce1c46a5aae941e2dcb52d18f` を確認した。r839 workspaceの変更前5ファイルとr825 Export全4ファイルは `C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-recoil-registration-backup-0029e87b-06f9-4187-b845-e3c618ffc8b4` に退避した。切替途中の失敗からの復元は隔離コピーで試験した。

| 配布先 | SHA-256 |
| --- | --- |
| `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` | `74e7f965e144ff718da0e0b805fc2010f8ce337fe4519ad4aeafb7f216015867` |
| `apps/runtime-player/dist/Runtime Player 0.0.0.exe` | `fb81247bcb548b4e411ec7abfc09d308959dcd3b5966ff3bda97494430606633` |
| 両版の `app.asar` | `4e5abfcdc14aaac87b75ca76276c6185ced407001c28f687ed964c6afb667403` |

新しいバイナリはr825で既存9組を再生し、驚きを拒否した。r840の両候補では新演技のゲームと視聴者をNative IPCとBrowser Source WebSocketで順に確認した。Browser Source接続中は既存仕様でNativeのライブ配信が休止するため、同じリプレイを別々に計測した。Presence Offで最小倍率は `0.948210`〜`0.948252`、最大Yは `3.949`〜`4.000px`。どちらの出力も完走後に基底へ戻った。配布後は実行ファイルのハッシュを再照合し、両配布先から隔離起動して現用r840を読み込んだ。旧実行物は `tmp/startled-recoil-registration/previous-player` に退避した。[通常版再生](../../../../../tmp/startled-recoil-registration/proof-8lFoex/report.json) · [portable再生](../../../../../tmp/startled-recoil-registration/proof-raoHdz/report.json) · [通常版の配布先起動](../../../../../tmp/startled-recoil-registration/proof-2s2aNc/report.json) · [portableの配布先起動](../../../../../tmp/startled-recoil-registration/proof-4cXb0u/report.json)

普段の自律ホスト `autonomous-default` は更新済みExportを参照する。Playerを開き直すとr840を読み込む。起動済みのSoul操縦席も `start-cockpit.cmd` で開き直すと、追加した演技候補を読み込む。[従来の接続手順](../intent-motion/human-gate.md#起動)

本人確認は、普段の会話で画面・視聴者向けの驚きと落ち着き方を見て、相方に向けたい強い驚きが出たとき未制作ペアの記録を確認する。
