# 外部演技資産 Wave 2 の検証と配布

2026-11-14、ユーザーが実運用で笑み・困り顔の動作を確認し、コミットとpushを承認した。個別の口パク・中断復帰の本人評価までは報告されていない。[本人確認](human-gate.md)

[受け入れ基準](wave2-basis.md) · [独立レビュー](../../reviews/external-motion-assets/wave2.md) · [普段の起動と編集手順](human-gate.md)

候補と実配布の独立レビューは合格。本人の実会話確認は未実施。

## 演技の移行

既存6演技11組を外部資産へ移し、安堵3クリップを1つの演技JSONにまとめた。苦笑は画面と視聴者で同じ採用クリップを使い、相方は未制作として記録する。これで7演技13組。通常再生から旧静的レジストリ、旧preset実行、比較用legacy fixtureを撤去した。単独Stage Yの診断入口は引き続き利用できる。

旧6演技の曲線を25ms刻みで照合し、モデル値・Presence・Stage Yは約1e−9、Stage倍率は約1e−7の許容差で一致した。r840と候補r844で旧11組の980姿勢と37 PNGを比較して一致した。[旧曲線](../../../../../tmp/external-motion-assets-wave2/legacy-parity.log) · [旧描画](../../../../../tmp/external-motion-assets-wave2/old-drawable-summary.json)

本人採用r843の造形を保持し、隔離コピーで正規atlasを保存・再読込してr844をExportした。採用原本121姿勢の曲線、Stage、表示drawableの幾何・不透明度・相対順を照合した。17 PNGの差は1枚あたり最大3画素・各チャンネル1階調、口パクを加えた比較は最大2画素・1階調。通常顔と左右・口形の9姿勢は完全一致した。正規atlasのSHA-256はr840と同じだった。[Export](../../../../../tmp/external-motion-assets-wave2/export.log) · [描画比較](../../../../../tmp/external-motion-assets-wave2/drawable-parity.json)

## 固定した実行物での確認

通常版とportableを固定し、起動スロットのJSONだけを変更した。苦笑の追加で6演技11組から7演技13組になり、説明を変えて再起動するとSoulの実Decision入力が更新された。起動中の編集後に再接続すると、同じ起動時の説明を使った。削除後の再起動で候補から消え、再生は `unsupported-performance` になった。各起動でexeと実際にロードされた `app.asar` のSHA-256は同じだった。Decisionサービスの応答は検証用に制御した。

通常版では苦笑用パラメータが欠けるr840を理由付きで拒否し、必要な値契約を持つ別revision・別atlasのr845で苦笑と新しい演技IDを再生した。両版でNativeとBrowser Sourceを順に描画し、驚きのStage上下・縮小、苦笑の首振り、固定目、音声口パク、早期発話終了後の完走、中断から通常の視線とStageへ戻ることを確認した。[通常版の検証](../../../../../tmp/external-motion-assets-wave2/normal-dPOpeG/report.json) · [portableの検証](../../../../../tmp/external-motion-assets-wave2/portable-stcsTl/report.json)

Runtime全156ファイル・1,082件、追加の苦笑回帰を含む配布資産テスト19件、型検査、Soul 278件と境界検査が合格した。独立レビューはRuntime対象55件、Soul 278件と実行証跡を照合した。[実装・検証の索引](../../../../../tmp/external-motion-assets-wave2/review-entry.md)

## 普段の配布先

- `C:/workspace/remie/rigging/astra-chan/workspace` と `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime` をr844に更新した。workspaceは採用r843からmanifestだけが変わった。
- `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` と `apps/runtime-player/dist/Runtime Player 0.0.0.exe` を更新した。両exe、通常版一式、実際にロードした `app.asar` のSHA-256は独立レビュー済み候補と一致した。[固定ハッシュ](../../../../../tmp/external-motion-assets-wave2/fixed-hashes.json)
- `C:/Users/remie/AppData/Roaming/@private-2d-rigging-lab/runtime-player/slots/autonomous-default/speech-motions` に7 JSONを明示配置した。保存済みモデル参照先は現用Export。実運用スロットの使用状態を保持したまま、配置ファイルと保存済み参照先をディスク上で照合した。

実配布先の両exeから隔離起動し、現用r844 Exportと実配置からコピーしてSHA-256を照合した7 JSONを読み込んだ。通常版は既定スロット、portableは名前付きスロットを使用。両方で13組の再生受理と苦笑のDecision入力、NativeからBrowser Sourceの順でStage・固定目・音声口パク・完走・中断復帰を確認した。[通常版の配布検証](../../../../../tmp/external-motion-assets-wave2/deployed-normal-ikgge4/report.json) · [portableの配布検証](../../../../../tmp/external-motion-assets-wave2/deployed-portable-hIlFbG/report.json)

初回切替は照合が一時退避した旧manifestを拾ったため、自動復元した。照合対象を修正して再適用し、全対象のハッシュを確認した。旧r843のmanifest、r840 Export、通常版一式とportableを[バックアップ](../../../../../tmp/external-motion-assets-wave2/deployment-backup-6e5cfae2-dd70-47b0-9233-6bd31df7c283)に保存した。外部資産フォルダは今回初めて配置した。[配布・復元の証跡](../../../../../tmp/external-motion-assets-wave2/deployment-entry.md)

普段のPlayerを開き直し、操縦席を更新済みの `start-cockpit.cmd` で開いて接続すると、現用モデルと起動時の演技一覧を使う。本人の普段の会話で、苦笑の見え方、音声口パク、通常制御への復帰を確認する。[本人確認と運用手順](human-gate.md)
