# 外部演技資産 Wave 1 独立レビュー

2026-11-13。再レビュー判定は合格。Stage の開始補正と単一点トラックの接続を再検証し、Wave 2 へ進める。

## 初回指摘と再確認

1. **高**。有効な拡縮トラックを連続再生すると負の倍率が表示経路に流れる。[共通再生器](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-playback.ts) は原時計を維持する開始補正で、曲線の値に開始時の差を足す。モデル値は値域に収めるが、Stage トラックに値域が設定されない。[Stage 合成](../../../../../apps/runtime-player/src/main/stage-motion/stage-motion-runtime.ts) はその値を既存倍率に乗じる。倍率 0.1 の演技から、原時計の倍率曲線 `[[0,10],[1,0.1],[1000,0.1]]` に切り替えると、1ms 後は実測で −9.7999984589。両トラックは [資産検査](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.ts) を満たす。Stage 全チャネルで補正後の値域も保証し、次区間への連続切替で検証する。
2. **中**。同じ再生器で、原時計の単一点 Stage 曲線 `[[0,0.8]]` は開始と同時に終端へ移り、倍率 1 から 0.8 に飛ぶ。単一点も有効な資産なので、滑らかな開始を満たす時間の解釈を決めて検査、再生、契約、テストで揃える。明示 Y と倍率が最終キー時刻から解除し、通常の終端保持を共有しない点も、採用演技の時計を維持したうえで契約に明記する。

- 4軸の値域は資産検査と原時計補正後の出力で共有された。前回の拡縮再現値は0.1になり、Y・横・奥行きも切替時に所定範囲を維持した。単一点は両接続方式で曲線時計の durationMs を使う。原時計の単一点・100msの複数点と先行接続の単一点を再検証し、開始と解除の連続性を確認した。明示 Y・倍率の終端と hold の適用範囲は契約と実装で一致した。

## 照合済み

- 有効 userData を参照する起動処理から hello と再生解決が同じ snapshot を使う。無効ファイルと重複の除外、独立ファイルの維持、空でも発話 accepted、起動中の説明固定、再起動での追加・編集・削除を確認した。実 WebSocket テストで別 package ID・revision・atlas の新 ID が通り、必要パラメータ欠落は理由付きで拒否された。値域不足・既定値不一致も検証した。[資産テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.test.ts)
- Soul は hello に基づいて演技と対象を独立に質問し、意図・本文・文脈を保持する。未対応の記録と、Decision の完了を待たずに音声を開始する経路を確認した。Cockpit の接続世代を変えるテストでは新説明を受け、旧判定から play が送られなかった。[Cockpit テスト](../../../../../apps/soul/agent/scripts/cockpit.test.mjs) · [Soul 判定](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs)
- r840 代表5演技8組の新旧曲線照合が通過。初期3演技の slot→実値換算と Presence 入力、ask の終了後保持、笑いの固定目、驚きの Stage Y・倍率を確認した。実 WebSocket と Frame Heart のテストでは通常の gaze・まぶたの入力が固定値で抑えられ、口パクは動作した。Stage Presence Off で明示 Y・倍率を合成できる。cancel・切断・次区間の同時刻引継ぎ、早期 end 後の完走と400msの解除も代表入力で通過した。[実接続テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-intent-motion-integration.test.ts)
- 隔離 Electron の証跡を照合した。r840 で8組と追加演技の play accepted、次回起動の説明編集、削除後の候補消失と拒否、スロット内の絶対パスを確認した。保存された main.js の SHA-256 は報告と一致する。隔離証跡が示すのは候補と再生受付で、Native/Browser の実配布描画は Wave 2 の検証範囲。[隔離結果](../../../../../tmp/external-motion-assets-wave1/isolated-3E45Us/report.json)
- 本番の候補経路に旧登録へのフォールバックはなく、`legacyMotionFixture` は明示された場合のみ使う。旧 preset の直指定は暫定診断・比較の入口として残っている。安堵、苦笑、普段の exe・portable・Export の全移行と固定配布物の照合は Wave 2。

## 独立実行

最終修正後の Runtime Player 対象4ファイル46件と TypeScript 型検査、Soul 境界1693ソースと5 fixture、Soul の Cockpit・Channel Client・Speech Intent・Fire Orchestrator の対象4ファイル279件が成功した。初回の既定サンドボックスではループバックへの接続が拒否されたため、Runtime と Soul の実接続対象はローカル接続許可で再実行した。


