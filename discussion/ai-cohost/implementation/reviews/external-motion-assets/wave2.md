# 外部演技資産 Wave 2 独立レビュー

候補レビュー、実配布後の独立レビューとも合格。通常版・portable、現用 workspace と Export r844、現用自律スロットの7演技を確認した。本人確認は普段の会話で行う。

## 実装と移行

- [受け入れ基準](../../waves/external-motion-assets/wave2-basis.md)と[資産契約](../../waves/external-motion-assets/wave1-contract.md)に対し、Player の起動時読み込み、hello、要求時の能力検査、共通再生器、Soul の質問生成を照合した。旧静的レジストリ、明示 legacy fixture、旧 preset 処理への製品参照は消え、旧 preset を拒否するテストがある。Stage Y 単独診断は専用ペイロードを保持し、診断・キャプチャスクリプトから使える。
- 旧6演技11組は両候補の初回起動で全組が accepted。旧時計との25ms刻みの照合でモデル値・Presence・Stage Yは約 1e−9、倍率は約 1e−7の許容差に収まった。別の r840 対 r844 比較は旧全11組の980姿勢で表示対象の頂点・描画順等が一致し、比較した PNG 37枚も完全一致した。通常顔・左右と口形の組み合わせでも9ケースの描画が一致した。[旧時計比較](../../../../../tmp/external-motion-assets-wave2/legacy-parity.log)・[旧描画比較](../../../../../tmp/external-motion-assets-wave2/drawable-parity-final.log)・[描画集計](../../../../../tmp/external-motion-assets-wave2/drawable-parity.json)
- 採用済み r843 のグラフと現用 r843 の一致を確認する Export スクリプトは、隔離コピー上で正規 atlas を再構成し、キーフォーム・パラメータ・メッシュを保持した r844 を保存、再読込、Export した。検証診断は前後とも warning 12・error 884・blocking 0。候補 workspace 67 ファイルと Export 4 ファイルの SHA-256 を集計に照合した。r844 atlas の hash は r840 と一致し、検証用 r845 atlas は別 hash だった。[Export](../../../../../tmp/external-motion-assets-wave2/export.log)・[別 atlas](../../../../../tmp/external-motion-assets-wave2/alternate-r845-export.log)
- 苦笑は画面・視聴者が同一クリップを参照し、相方は未制作。配布元の JSON と候補試験投入用 JSON の SHA-256 は一致した。採用原本のモデル値と Stage Y を121フレーム、表示対象の頂点と相対描画順を同フレームで照合した。624×660 の PNG 17枚の最大差は1枚につき3画素、各チャンネルで1階調。口パク入力を加えた比較も2画素・最大1階調で、静止口の描画とは異なった。表示対象の相対順で比較するのは、Export が対象外 drawable を除き絶対順が詰まるため。画素差の実測値を基に採用表情の保持と判断した。[採用原本](../../../experiments/speech-motion-wry-headshake-v1/README.md)・[比較結果](../../../../../tmp/external-motion-assets-wave2/drawable-parity.json)

## 固定配布候補

- 通常版と portable で 6演技11組 → 7演技13組 → 説明編集 → 削除後6演技11組を確認した。隔離スロットの実パスと候補一覧が一致し、起動中の編集後に再接続しても同じ起動 snapshot の説明を返した。再起動後は Soul の演技選択の質問に編集済み説明が入り、削除後は候補が消えて再生も `unsupported-performance`。候補試験は実 Soul が生成した演技・対象の二つの Decision 質問を記録し、判定サービスの応答を試験用に差し替えている。通常版では r840 の `param_wry_smile` 欠落を明示して拒否し、別 atlas の r845 は苦笑と別ファイルの新規演技 ID を受理した。
- 通常版6起動・portable 4起動の各 exe と実ロード app.asar の SHA-256 は、固定候補を別途再計算した値に一致した。通常版は `fd6fb8cb…476a`、portable は `4c7a3540…cb13`、共通 app.asar は `fd57e0a6…a7e8`。[通常版](../../../../../tmp/external-motion-assets-wave2/normal-dPOpeG/report.json)・[portable](../../../../../tmp/external-motion-assets-wave2/portable-stcsTl/report.json)・[固定ハッシュ](../../../../../tmp/external-motion-assets-wave2/fixed-hashes.json)
- 両候補の追加起動で Native、Browser Source の順に計測した。驚きの Y・縮小と中断からの復帰、苦笑の首振り往復、固定目、音声口パク、早期発話終了後の完走、別試行での中断と視線復帰を確認した。Browser は実 WebSocket の受信フレーム、両経路は実描画 PNG を採取している。最終試行は両版とも完走した。

## 独立再実行

Runtime Player の外部資産・配布・実接続・Stage Y 診断の4ファイル55件と、Soul の Cockpit・Speech Intent・Fire Orchestrator の3ファイル278件が合格。既定サンドボックスのループバック拒否を受けた Soul 試験は、ローカル接続許可で再実行した。実装側の Runtime 全156ファイル1,082件と型検査の完了証跡も確認した。[Runtime 全体](../../../../../tmp/external-motion-assets-wave2/runtime-final.log)

## 実配布後の独立確認

- 最終配布のバックアップと現用ファイルを記録済み SHA-256 に再照合した。旧 manifest、旧 Export 4ファイル、旧通常版75ファイル、旧 portable が復元用に保存されている。旧演技フォルダは初期配置前には存在しなかった。隔離リハーサルは意図的な失敗から復元し、最初の現用切替も一時退避 manifest を照合に含めたため失敗して全対象を自動復元した。両記録は `rollback-verified` で復元エラーなし。再試行前の全5対象の旧ハッシュ記録は初回と一致し、再試行は `verified`。現用 workspace の候補対応67ファイルと Export 4ファイルは r844 の候補と一致した。[最終配布とバックアップ](../../../../../tmp/external-motion-assets-wave2/deployment-backup-6e5cfae2-dd70-47b0-9233-6bd31df7c283/report.json)・[現用の自動復元](../../../../../tmp/external-motion-assets-wave2/deployment-backup-bc64f0d8-5ad0-4e4a-9fdf-baf7b99e0c64/report.json)・[隔離リハーサル](../../../../../tmp/external-motion-assets-wave2/deploy-rehearsal.log)
- `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` と `apps/runtime-player/dist/Runtime Player 0.0.0.exe` はレビュー済み固定候補の各 SHA-256 に一致した。両実配布先からの隔離起動で実ロードされた app.asar の SHA-256 も固定候補と一致した。両起動は現用 Export r844 を開いた。現用自律スロットの保存済み Export 参照先も同じ絶対パスだった。
- 現用フォルダ `C:/Users/remie/AppData/Roaming/@private-2d-rigging-lab/runtime-player/slots/autonomous-default/speech-motions` の7 JSONを、配布元および両隔離スロットの7 JSONとファイル単位で SHA-256 照合した。通常版は隔離 userData の `slots/autonomous-default/speech-motions`、portable は同じ規則で名前付き `slots/external-motion-proof/speech-motions` を解決した。両方の診断はそれぞれの隔離ルートを含む絶対パスを記録している。検証コードは専用 userData とデバッグ接続先で自分が起動したプロセスを閉じており、現用スロットはディスクの配置と設定の確認に使った。[通常版の実配布起動](../../../../../tmp/external-motion-assets-wave2/deployed-normal-ikgge4/report.json)・[portable の実配布起動](../../../../../tmp/external-motion-assets-wave2/deployed-portable-hIlFbG/report.json)
- 両起動で hello の7演技13組と全13組の再生受付を確認し、実 Soul が生成した Decision の演技選択に苦笑説明が入った。Native → Browser Source の順で、驚きの Stage Y・縮小と中断後の復帰、苦笑の首振り往復、固定目、発話口パク、早期終了後の完走、途中中断からの視線復帰を確認した。採取した両版16枚の描画 PNG の SHA-256 は記録と一致した。判定サービスの応答は候補試験と同じく試験用で、普段の会話での自然さ・口パク・復帰は本人確認に残る。
