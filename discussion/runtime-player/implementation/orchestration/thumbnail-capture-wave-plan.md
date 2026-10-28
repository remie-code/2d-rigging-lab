# サムネ用の透過スクショ(Capture PNG)wave 計画

> Status: 実装済み(2026-10-28。突き合わせ合格 [../reviews/thumbnail-capture/review.md](../reviews/thumbnail-capture/review.md)、報告 [../waves/thumbnail-capture/report.md](../waves/thumbnail-capture/report.md)、runtime-player 1025/1025)。**人間ゲート合格(2026-10-28)** → [../waves/thumbnail-capture/human-gate.md](../waves/thumbnail-capture/human-gate.md)。ブランチ `runtime-player/thumbnail-capture`。
> 合意: [../../screens/thumbnail-capture.md](../../screens/thumbnail-capture.md)。材料: [../../screens/current-screens-inventory-2026-10.md](../../screens/current-screens-inventory-2026-10.md)、[../thumbnail-capture-inventory.md](../thumbnail-capture-inventory.md)。
> 規模: 1 wave・1 ドメイン(Gnome)。終わったら軽い突き合わせ(Sylph)を 1 回。器(apps/runtime-player)の中だけ。魂・操縦席・チャネルの契約は変えない。

## 1. 振る舞い(ユーザーの合意)

- Control Window の **Stage ページ**と **Live Controller ページ**に「Capture PNG」と「Open Folder」(フォルダを開く)を置く。
- Capture PNG を押すと、Stage Window の canvas を、その瞬間の姿・ステージの全体・透明のまま、実際のピクセル数(窓の大きさ × devicePixelRatio)で PNG にする。Arrange 中の枠やハンドルは写らない。
- 保存先は `app.getPath("pictures")` の下の `Runtime Player\`(無ければ作る)。何も聞かない。
- ファイル名は `<Runtime Export のフォルダの名前>-<YYYYMMDD>-<HHMMSS>.png`(ローカル時刻)。同じ名前があれば `-2`、`-3`… を付け、上書きしない。Windows のファイル名に使えない文字は置き換える。
- Browser Source がつながっている間も撮れる(Stage Window の止まったままの姿が写ってよい)。
- モデルを読み込んでいないとき(Runtime Export が loaded でない)と、Stage Window が無いときは押せない。撮っている間も押せない。
- 保存したら Control Window の feedback に保存したファイル名を出す。失敗したら理由を出す。
- Open Folder は、そのフォルダを開く(無ければ作ってから開く)。
- Tracking Host でも Autonomous Host でも同じ。ホットキーは付けない。

## 2. Domain T — 実装(Gnome)

1. **Stage 側**: 外から「今の姿を描き直して、すぐ PNG にする」入口を足す。preserveDrawingBuffer は false のままにし、描き直しと読み出しを同じタスクで行う。透明(premultiplied)の縁が保たれること。
2. **main ↔ Stage の往復**: main から Stage へ id 付きの頼みを送り、Stage が invoke で結果(PNG のバイト列)を返す形を新しく足す。返事が来ないときは時間切れで失敗にする。
3. **Control → main**: 新しい bridge チャネル(撮る/フォルダを開く)。結果にファイル名(とパス)を載せる。既存の Copy Window Title の流れに倣う。
4. **保存**: main で、フォルダの作成・名前の決定(重複の回避・文字の置き換え)・書き込み。`shell.openPath` でフォルダを開く。
5. **UI**: 2 つのページのボタン・押せない条件・feedback。
6. **テスト**: 名前の決定(日時の形・重複・置き換え)、押せない条件、往復(成功・時間切れ・Stage 無し)、チャネルの契約テスト、既存の境界テスト(`stage/` 側の文字の縛りなど)を守ること。実機の 1 回(開発起動で 1 枚撮り、PNG にアルファがあることを確かめる)。
7. ゲート: runtime-player の型検査とテストが全部通る。

## 3. 人間ゲート(ユーザーの実機確認、`pack` で作り直した器)

1. モデルを読み込み、Stage ページの Capture PNG を押す → `ピクチャ\Runtime Player\` に PNG ができ、feedback にファイル名が出る。
2. その PNG を画像のソフトで開くと、背景が透明で、チャッピーの縁がきれい。
3. Live Controller ページの Capture PNG でも撮れる。続けて押しても上書きされない。
4. Open Folder でフォルダが開く。
5. モデルを読み込んでいないときは押せない。
