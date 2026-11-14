# 発話 Stage Y の実表示・配布確認

r804 の Astra-chan Runtime Export を読み取りで使用した。隔離プロファイルに手動配置 `pan (21, 34)` と `zoomScale 0.85` を保存し、Stage Presence を Off にした。保存した [motion 定義](stage-y-motion.json) を読み、実 WebSocket の `intent.motion` で `receive` と上下トラックを同じ play に渡した。

| 実表示 | 論理ビューポート | 基準・上・下・復帰の pan.y | PNG のモデル下端の Y |
| --- | --- | --- | --- |
| 配布版 Electron Native Stage | 600 × 720 | 34 → -56 → 99 → 34 | 569 → 479 → 634 → 569 |
| 配布版 Browser Source を Chrome で表示 | 850 × 900 | 34 → -56 → 99 → 34 | 703 → 613 → 768 → 703 |

[比較画像](stage-y-contact-sheet.png) と [取得時の変換値](display-transforms.json) を参照。PNG のモデル下端はグレースケール値が 65 を超える領域の下端座標。倍率と X は両表示で一定。Native Stage の上方向サンプルでは頭頂の髪の一部が画面上端にかかった。通常の負荷制御に合わせ、Native を先に撮り、Browser Source 接続後に同じモーションを再送した。Y を省いた `receive` も実送信し、各表示で 18 回サンプリングして pan と zoom が一定であることを確認した。

## 再現

普段のアプリでの確認は [本人確認手順](../human-gate.md) を参照。隔離検証はリポジトリ直下から実行する。

```powershell
$capture = 'discussion/ai-cohost/implementation/waves/stage-vertical-motion/evidence/capture-stage-y.mjs'
$model = 'C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime'
node $capture 'apps/runtime-player/dist/win-unpacked/Runtime Player.exe' $model 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node $capture 'apps/runtime-player/dist/Runtime Player 0.0.0.exe' $model
python discussion/ai-cohost/implementation/waves/stage-vertical-motion/evidence/make-contact-sheet.py
```

Node.js 22 以降、ローカル WebSocket と Chromium のデバッグ接続を使う。比較画像の再生成は Pillow が必要。Chrome 引数を省くと Native Stage で同じ操作を行い、portable 向けの smoke 結果を JSON に記録する。

## 配布物

| 配布物 | サイズ | SHA-256 |
| --- | ---: | --- |
| `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` | 232,562,176 bytes | `d0d59ff780a072abf180ca0dd1fd4823bdbde6f266bf21e3ede053986f689ced` |
| `apps/runtime-player/dist/Runtime Player 0.0.0.exe` | 93,789,905 bytes | `673702d18c37b532f18f37902f4c6b5ce92bfe093b50e37cadbf75f8e002b2a5` |

両配布物を隔離起動して Stage Y が上下動し、手動位置に復帰することを確認した。[Portable smoke](portable-smoke.json) に記録した実行中の展開先 `app.asar` の SHA-256 は、win-unpacked の `resources/app.asar` と一致した。`0fe4446ec62346c202a5fd88f2b6585c5e29fa2cb8d5b2a91b7f68049fc894f4`。ASAR 内の `out/main/main.js` も最新のビルド出力とバイト単位で一致した。`981215cf85e36b89ea5c189e8997b80a9496e3f2808dddb7543a34ea9da84250`。

pnpm ラッパーがシンボリックリンク作成で EPERM になったため、`apps/runtime-player` から `npm run typecheck`、`electron-vite build`、`electron-builder --win --x64` の順で同じ配布設定を使った。Browser Source は Chrome の実ページで取得した。OBS 本体と普段のプロファイルでの見え方確認は本人ゲートに残る。
