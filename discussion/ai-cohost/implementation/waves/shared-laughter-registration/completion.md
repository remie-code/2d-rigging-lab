# 一緒に笑うモーションの登録と配布

相方向けのv1と視聴者・ゲーム画面向けの共通v2を、Runtime PlayerとSoulの共有レジストリに登録した。演技と注意対象を別々に選ぶ経路は既存のまま使う。笑いの間は瞳XYを0、左右まぶたの開度を原本の1に固定し、閉眼笑顔は専用パラメータで出す。通常の口パクを同時に合成する。通常終了では演技を完走し、中断後は400msで通常の制御へ戻る。[受け入れ基準](basis.md) · [独立レビュー](../../reviews/shared-laughter-registration/review.md)

## モデルと互換性

採用済みr824のatlasをEditorと同じ手順で更新し、現用workspaceとRuntime Exportをr825へ切り替えた。変更はworkspace側のatlas関連4ファイルとExportの4ファイル。保存後に正規preflightがreadyとなり、Runtime Playerでr825の32 drawablesとatlas SHA-256 `c47ed99392036148dfe0657a3b67a254c3cfbdb624f6c882f220b3e1e572b054` を確認した。Strictの既存診断は前後ともwarning 4、error 787、blocking 0。モデルの造形と診断設定を保持した。[変更前後のハッシュ](../../../../../tmp/shared-laughter-registration/file-changes.json)

旧6演技は621姿勢で描画幾何、不透明度、表示順が一致し、36枚のPNGで最大1画素・1階調差。採用済みr824とr825の新演技は、両版11姿勢ずつで同じ項目が一致し、PNGは最大5画素・1階調差。左右と中央の顔向きに、笑顔3段階とI口を重ねた追加9姿勢も描画幾何が一致した。新バイナリをr804で動かすと既存6演技は再生し、笑いだけが `motionModelMismatch` で拒否された。[描画比較](../../../../../tmp/shared-laughter-registration/parity.json) · [左右と口パク](../../../../../tmp/shared-laughter-registration/turn-and-mapping.json) · [r804での実行](../../../../../tmp/shared-laughter-registration/proof-uO7xL7/report.json)

現用の旧Export全4ファイルとworkspaceの変更対象4ファイルを退避した。切替途中で失敗した場合の復元を隔離コピーでリハーサルし、元のSHA-256に戻ることを確認した。退避先は `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-registration-backup-2b3bc660-6dbb-41e2-aebd-6c02f3a1e2f6` の `runtime-export-r804` と `workspace-r824`。

## テストと配布

Runtime Player全体155ファイル・1,069件、Soul全体2,535件、Runtime型検査が成功。独立レビューは関連Runtime60件、Soul4件、型検査と実WebSocket統合を再実行した。実WebSocketでは通常完走、中断後の解除、口開度と母音の併走を確認した。[Soul全体ログ](../../../../../tmp/shared-laughter-registration/soul-all-tests.log)

| 更新先 | SHA-256 |
| --- | --- |
| `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` | `a50d99b69e8769086b7b7043d3583b6a16497941f647e6e74a43daf610a8feff` |
| `apps/runtime-player/dist/Runtime Player 0.0.0.exe` | `524242a8402923e0f792d326eaf698a79c9a87996e702a2677400238ea0d4e33` |
| 両版の `app.asar` | `0bc9964da23665102901efff4c4d7e4fb08d965009637921a570127bc36efe5b` |

通常版のASAR内のビルド出力13ファイルが一致した。配布先の通常版とportableをそれぞれ隔離起動し、現用r825をロードして9組を実WebSocketで確認した。笑い3組は上向き視線と左まぶたが閉じかけた状態から始め、笑顔が出る前に瞳XYが0・左右まぶた開度が1となり、途中で通常終了を送っても二拍のStage Yと口パクが重なった。完走後は笑顔の上書きが外れて既定値0に戻り、通常の視線・瞬き入力が再び反映された。[配布先の通常版](../../../../../tmp/shared-laughter-registration/proof-LcGtxp/report.json) · [配布先のportable](../../../../../tmp/shared-laughter-registration/proof-gNZUqX/report.json) · [配布物のハッシュ](../../../../../tmp/shared-laughter-registration/player-artifacts.json)

旧通常版とportableは `tmp/shared-laughter-registration/previous-player` に退避した。

## 次の実会話

普段の自律ホストの `autonomous-default` は今回更新したExportを参照している。普段のPlayerを開き直すとr825を自動でロードする。Control Windowでr825を確認し、別のExportを開いている場合は **Open Export** から `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime` を選ぶ。

Soulは共有レジストリを起動時に読む。起動済みの操縦席は次の会話の前に終了し、いつもの `start-cockpit.cmd` で起動してPlayerに接続する。[接続手順](../intent-motion/human-gate.md#起動)

本人確認は、相方へ向いて笑う動きと視聴者・ゲーム画面での共通の笑い、閉眼中と開眼時の目元、声と口のつながりを普段の会話で見る。
