# 探す・確かめる6案の独立レビュー

2026-11-16。登録と配布は合格。 [登録契約](../../waves/search-nuances-registration/contract.md) · [比較試作](../../../experiments/speech-motion-search-nuances-v1/README.md)

- 起動時ローダーは既存のバージョン1と階層付きのバージョン2を読み、親ファイル9件から選択候補14件、対象組21件、固有クリップ18件を公開する。親だけの選択肢は出ない。親ID重複、連結後の選択ID衝突、不正な階層、継承または欠落した参照は拒否し、独立した有効資産は引き続き解決できる。 [ローダーと検証](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.test.ts)
- 試作と配布元を全キーで独立照合した。試作用の表示項目と、レンダラーでtrackが優先する同名fixedを除くと、残る値と曲線、Stage、`preserve-clock`、時間6600／6500／6900／6200／5700／7200msが全6案で一致した。再生テストでも基準姿勢から50msごとの全入力が試作の五次smoothstepと一致し、Stage Y=0・scale=1、既存の口開き・母音入力、終了後のベース復帰を確認した。 [配布資産の検証](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-distribution.test.ts)
- 6案は複数箇所の探索、一点の見極め、比較、同じ場所の再確認、相方からゲームへの注意移動、慎重な見守りとして説明を区別できる。05を含む全案の制作済み対象はgameのみ。Soulは発話意図・発話本文・直前の文脈を一回のjudge呼び出しに渡し、演技と対象を独立した二問で選ぶ。 `none`、対象不明、partner／viewersの未制作組の抑制は維持される。 [Soulの検証](../../../../../apps/soul/agent/src/mind/speech-intent-motion.test.mjs)
- 隔離した一時プロファイルで、実ローダーと実Soul区間レコーダーにfixtureのjudge・Channel応答を組み合わせた。全6件の `decision.performanceId` と `definition.clipId` から親定義の `nuances[子ID].targets.game` と再生クリップを復元できた。正規化された親定義のSHA-256は6件共通で、保存バイトを再計算して `db9f38f70e81da44ee0a512d4710ae4ba42798d3aaa37101476e4db96f96dffa` と一致した。 [区間記録と親定義](../../waves/search-nuances-registration/contract.md)
- 独立再実行でPlayerのローダー・配布・ループバック統合3ファイル40件、Soulの演技決定とFireの2ファイル139件が通過した。Playerのループバック接続は通常のサンドボックスで `EACCES` だったため、許可されたローカル通信で再実行した。
- 通常版とportableを一時プロファイルで実行した配布担当の証跡を独立確認した。両版ともr844と同一の `app.asar` を使い、6案のgameと既存苦笑の受付、相方／視聴者／不明／`none` の抑制を含む11ケースが一致した。親資産を外して再起動すると8候補・15組に戻り、保存済みの親定義のSHA-256は維持された。 [通常版の試験記録](../../../../../tmp/search-nuances-registration/staging-normal-nH7y8R/report.json) · [portableの試験記録](../../../../../tmp/search-nuances-registration/staging-portable-iqGb0I/report.json)
- 実配布先の通常版77ファイルとportableのSHA-256を隔離候補と照合した。現用 `autonomous-default/speech-motions` の新規親資産は配布元と同一で、SHA-256は `96f3d0ad513789eb71daf606bfcb1fec379717bba394be4536ab33b3dd86040f`。現用と配布元の既存資産各8件、試作の定義・描画・生成用5ファイル、現用エクスポート4ファイルは各作業前のハッシュと一致した。試作READMEには採用・配布の経緯が追記されている。 [実配布の記録](../../../../../tmp/search-nuances-registration/backup-Prepare-85cb3a1d-7e0b-406b-b1e3-9ced97efe11f/report.json) · [登録完了記録](../../waves/search-nuances-registration/completion.md)

現用アプリへの反映は次回起動から。隔離試験では判定回答と音声をfixtureで与えたため、実際のDecisionのニュアンス選択精度、自然な発話との同期、画面上での本人確認が残る。
