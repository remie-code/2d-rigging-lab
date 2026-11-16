# 探す・確かめる6ニュアンスの登録

2026-11-15。本人が採用した六案を「探す・確かめる」の親定義にまとめ、`game` 向けの六つの候補として登録した。八つの既存演技を含めて、9ファイル・14候補・21対象組・18クリップになる。 [試作の比較と再現](../../../experiments/speech-motion-search-nuances-v1/README.md) · [配布元の親定義](../../../../../apps/runtime-player/assets/speech-motions/search-nuances.json)

| ニュアンス | `search-nuances--` に続くID | 原時計 |
|---|---|---:|
| 場所を探す | `search` | 6,600 ms |
| 一か所を見極める | `discern` | 6,500 ms |
| 関係を見比べる | `compare` | 6,900 ms |
| 状態・残りを確認する | `recheck` | 6,200 ms |
| 相方の気づきに追いつく | `follow-cue` | 5,700 ms |
| 安全を確かめながらうかがう | `cautious` | 7,200 ms |

試作レンダラーで曲線に上書きされていた固定値と表示用メタデータを実行用クリップから省いた。採用した六案の全曲線・時刻・実効固定値を照合し、Stageの倍率1とY=0を維持した。口パクの制御値は既存の音声経路に従う。`follow-cue` の短い相方への振り向きも、全体の対象はゲーム画面。

Playerは階層データを起動時に既存の候補・ペア・クリップへ展開する。Soulは同じDecisionリクエストの独立した二問で候補と対象を選び、`none`、対象不明、未制作の扱いを使える。区間記録の選択ID、親定義のSHA-256、クリップIDから再現用の定義を辿れる。判定時の候補全体の版保存は後続候補。 [外部形式と記録の契約](contract.md)

## 確認結果

- Player型検査に合格。実装担当のControl Channelテスト269/269、Soulの発話意図モーション・Fire連携テスト139/139が通過した。
- 独立確認はPlayerの配布・ローダー・実WebSocket接続40/40、Soulの発話意図モーション・Fire連携139/139。各曲線のキーと実再生経路での50 ms間隔の値を試作と照合した。六案すべてでゲーム対象だけが再生解決され、選択を模擬した区間記録の参照から正しいニュアンスとクリップを開けることを確認した。六案が共有する保存親定義のSHA-256は `db9f38f70e81da44ee0a512d4710ae4ba42798d3aaa37101476e4db96f96dffa`。

## Windows配布

11月16日、通常版 `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` とportable `apps/runtime-player/dist/Runtime Player 0.0.0.exe` を更新し、現用 `autonomous-default/speech-motions` に親JSONを配置した。通常版77ファイルとportableは検証候補とバイト一致。親JSONのSHA-256は配布元と現用先ともに `96f3d0ad513789eb71daf606bfcb1fec379717bba394be4536ab33b3dd86040f`。現用の旧8資産、配布元の旧8資産、試作の定義・描画・生成用5ファイル、現用Export確認対象4ファイルのハッシュは配布前後で一致した。試作READMEには登録状況を追記した。

現用Exportを使い、両候補を分離した環境で起動した。選択と音声のfixtureを実WebSocketで接続し、各版で11件の区間記録を確認した。内訳は六案の選択、既存の苦笑、相方・視聴者の未制作、対象不明、`none`。隔離スロットから新規JSONを外して再起動すると既存8候補に戻り、六案の区間記録からは保存済みの親定義と対応するクリップを開けた。両版が読んだ `app.asar` のSHA-256は `f54dd54413031cb129f3db747533067d35501cce6bf7ea80a3bff7af09f26644`。

証拠と旧版バックアップはワークスペースの `tmp/search-nuances-registration/` に保存した。隔離起動は `staging-normal-nH7y8R/report.json` と `staging-portable-iqGb0I/report.json`、適用と照合は `backup-Prepare-85cb3a1d-7e0b-406b-b1e3-9ced97efe11f/report.json`。 [独立レビュー](../../reviews/search-nuances-registration/review.md)

現用アプリは次回起動から反映される。実会話でどのニュアンスを選び、どう見えるかと、実APIの選択精度は未確認。 [起動と会話記録の読み返し](../all-motion-recording/human-gate.md)
