# サムネ用の透過スクショ — 合意の途中経過

> Status: 合意済み(2026-10-28)。実装済み・人間ゲート合格。
> 材料: [current-screens-inventory-2026-10.md](current-screens-inventory-2026-10.md)(今の画面の棚卸し、Sylph)。

## 1. 目的(ユーザー 2026-10-28)

- サムネに使うために、チャッピーを背景が透明な PNG で撮りたい。
- 今の器には、画像を撮って保存する機能は無い(棚卸し §7)。

## 2. 決めたこと(ユーザー 2026-10-28)

- 大きさ: 窓に映っているそのまま(拡大して描き直さない)。
- 範囲: ステージの全体(チャッピーの周りの透明な余白は切り落とさない)。
- 撮るもの: その瞬間。撮る前に表情や向きは選ばない。

## 3. 決めたこと(ユーザー 2026-10-28、棚卸しを見たあと)

- **使う場面**: サムネを作るときに撮る。OBS(Browser Source)にはつながっておらず、器の Stage Window でチャッピーが動いている場面を想定する。
  - 背景: ユーザーは配信で Browser Source を使う。Browser Source がつながっている間は、Stage Window に live の動きが届かない(棚卸し §2.3)。配信中に撮る場面は想定しない。
- **置き場**: 器の Control Window の Stage ページと Live Controller ページの両方に「Capture PNG」を置く。
- **保存**: 決まったフォルダに日付の名前で置き、「フォルダを開く」ボタンを付ける。撮るたびに何も聞かない。

## 4. 決めたこと(ユーザー 2026-10-28、続き)

- ホットキーは付けない。
- 保存先: Windows の「ピクチャ」の下の `Runtime Player\`。
- ファイル名: `<Runtime Export のフォルダの名前>-<YYYYMMDD>-<HHMMSS>.png`(例 `astra-chan-runtime-20261028-153012.png`)。
  - 経緯: 最初は「モデルの名前」(例 `chappy-…`)で合意した。調べると、Runtime Export の表示名は 2 体とも Editor の既定の `Untitled model`、packageId も同じ値だった([../implementation/thumbnail-capture-inventory.md](../implementation/thumbnail-capture-inventory.md) §1)。そこでフォルダの名前に変えた(ユーザー 2026-10-28)。
- Browser Source がつながっている間も撮れる。止まったままの姿が写ってよい。
- 写すのはチャッピーを描いている部分(canvas)だけ。Arrange 中の枠やハンドルは写らない。
- 画面の拡大率が 100% でない PC では、実際のピクセル数(窓の大きさ × 拡大率)で撮る。
- モデルを読み込んでいないときは「Capture PNG」を押せない。
- Tracking Host でも Autonomous Host でも同じように撮れる。
- 実機の確認は、`pack` で作り直した器で行う。
- 計画: [../implementation/orchestration/thumbnail-capture-wave-plan.md](../implementation/orchestration/thumbnail-capture-wave-plan.md)
