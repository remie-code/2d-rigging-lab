# サムネ用の透過スクショ 人間ゲート

> Status: **合格(ユーザー 2026-10-28、`pack` で作り直した器)**。計画は [../../orchestration/thumbnail-capture-wave-plan.md](../../orchestration/thumbnail-capture-wave-plan.md) §3。

## 0. 準備

- 器を作り直す: `pnpm --filter @private-2d-rigging-lab/runtime-player run pack`(`run` を付けないと pnpm 本体の pack が動いて .tgz ができる)。
- 実行ファイル版 `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` を、いつもどおり起動する。OBS にはつながない。

## 1. 確かめる 5 点

| # | やること | 合格の目安 |
|---|---|---|
| 1 | モデルを読み込み、Stage ページの「Thumbnail Capture」で Capture PNG を押す | `ピクチャ\Runtime Player\` に `astra-chan-runtime-<日時>.png` ができ、通知に `Stage PNG saved: <名前>` が出る |
| 2 | その PNG を画像のソフト(サムネを作るソフト)で開く | 背景が透明で、チャッピーの縁がきれい |
| 3 | Live Controller ページの Capture PNG を続けて押す | 撮れる。同じ秒でも `-2` が付き、上書きされない |
| 4 | Open Folder を押す | `ピクチャ\Runtime Player\` が Explorer で開く |
| 5 | モデルを読み込んでいない状態で見る | Capture PNG が押せず、`Load a model to capture` と出る |

あわせて、パネルの名前(「Thumbnail Capture」)と置き場(Stage ページは上段 3 列のすぐ下、Live Controller は一番下)でよいかも見る。

## 2. 記録(ユーザー 2026-10-28)

- 5 点を確かめて「大丈夫だった」(ユーザー)。パネルの名前(「Thumbnail Capture」)と置き場への指摘は無かった。
- 作り直しはユーザーの PowerShell では実行ポリシーで `pnpm.ps1` が止まったため、Undine が Git Bash から `pack` を実行した。
