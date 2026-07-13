# 操縦席UI改定 planning inventory

> Status: 完了(2026-07-14)。棚卸し全項目が事実で閉じ、残る判断はL0技術決定(ユーザー裁定不要・既存原則に整合)。
> 実施: Sylph A(preact+htm vendor実態+ヘッドレステスト手段)・Sylph B(現操縦席の全機能=保存オラクル)。
> UXの正: [../screens/cockpit-redesign.md](../screens/cockpit-redesign.md)。守る制約(a〜e)は同文書§6。

## 1. preact+htm の no-build vendor 実態(Sylph A)

### 1-1. 採用形: standalone バンドル単一ファイル(L0決定)

`htm/preact/standalone.mjs`(htm 3.1.1)= **1ファイル・生13,194B/gz5,332B・bare import ゼロ・hooks込み**(`html/render/h/Component/createContext/useState…useErrorBoundary` を全export・実測)。

- **import map不要**: app側は `import { html, render, useState } from "./vendor/htm.preact.standalone.mjs"` の相対import1本で済む。granular構成(preact.mjs+hooks.mjs+htm.mjs+htm.preact.mjs=4ファイル・gz7.2KB)はブラウザ解決に**import map必須**(各vendorが内部で `from "preact"` 等のbare importを持つため)——これを回避できる唯一の形がstandalone。
- **代償**: preactを内包するため後から `@preact/signals` 等を同一preactインスタンス共有では足せない。**操縦席単体では実害なし**(signalsは使わん)。
- **Nodeからも読める**: bare importゼロ=相対importなので、ヘッドレステストからも `import` できる(linkedom採用時の利点)。
- pure JS・ネイティブ非依存・**実行時npm依存を1つも増やさない**(ブラウザが読むだけ)。preact 10.29.7 / htm 3.1.1(いずれも安定最新)。
- 置き場: `apps/soul/agent/src/cockpit/vendor/htm.preact.standalone.mjs`(リポジトリにコミットして持つ)。

### 1-2. ブラウザ配信の最小改修(Sylph A・file:line)

現配信は `serveIndex`(cockpit-server.mjs:915-928)が `cockpit.html` を `GET /` に返すのみ。vendor .mjs用ルートがなく `GET /vendor/…` は404(:912フォールスルー)。

**L0決定: `GET /vendor/*.mjs` 静的ルートを追加**(handleRequestの404手前・:912の前に1分岐)。serveIndex同型に readFile→`content-type: text/javascript`(module scriptはJS MIME必須)。**パストラバーサル防止**(`..`拒否・許可拡張子固定)込み。エントリは `cockpit.html` 内の inline `<script type="module">import … from "/vendor/…"</script>`(後述の既存テスト制約のため)。import mapは不要(standaloneゆえ)。

### 1-3. 既存テストとの摩擦(要注意・Sylph A)

- `cockpit-page.test.mjs:72` が `<script src=…>` を**相対含め全面禁止**(自己完結HTML強制)。→ **エントリは inline module(`<script type="module">…import…`)に保つ**(import文は `<script src>` に当たらず通る)。:73-74はhttp(s)のみ禁止で相対vendorは非該当。
- ただし page test は大半がHTML文字列のregexマッチ(下記§2-4)なので、**preact化で意味を失い書き換え必至**——この制約自体も改定対象。

## 2. 現操縦席の全機能=保存オラクル(Sylph B)

> 完全な網羅表はSylph B報告に file:line 付きで存在。ここに保存チェックリストの要点を残す(作り直し後に1個ずつ潰す)。

### 2-1. 観測層(主役・最優先で無退行保証)

耳ランプ+状態/whisper・ffmpeg死活/soul状態(idle/thinking/speaking)/usage(input・output tokens・vision区別)/discardedカウンタ+uptime(listening中ローカル刻み+state再同期)/Timeline自動スクロール/**行種9つ**: 転写(you緑/soul青/viewer(名前)紫・live行のみlatency)・speaking行(VAD連動出現消滅)・ゴースト行(discard+diagnostic9種・意図的非表示リスト遵守)・発火マーカー・演出行(word/args/✓✗)・視覚マーカー(サムネimg・data URI・非保存)・barge-inマーカー(chars/elapsed)・自発マーカー(kind・fired:falseはゴースト)/タブ開き直し履歴復元(GET /api/state.transcripts)。

### 2-2. 運転層

Fire(busy中disable・503/reason表示)/Fire視覚(同上)/自発ON/OFFトグル(POST /api/self-fire・null時not available・syncing無限ループ防止)。※口数モードは**未実装**(s6-followup §12の将来課題)——本改定では**運転バーに場所だけ用意**(実配線はモード課題で)。

### 2-3. 設定層

マイク選択+Start/Stop(lastDevice初期選択)/Channel URL(token秘匿=Set後クリア・redact表示・connected/error/connecting色)/YouTube Connect/Disconnect(Disconnect有効無効のstate駆動・dead無効・source記憶復元・chatSourceEdited制御)/視界(ゲーム窓)選択(一覧更新・Set・status)/声の出力先選択(一覧更新・Set・その場再起動・status)/各種エラー欄。

### 2-4. ワイヤ契約=真の不変オラクル(最重要)

- **16 HTTPエンドポイント**(method/path/status分岐)・**13 SSEイベント**(名前+ペイロード形)・**6設定キー永続化**(型・初期値解決順・failure tolerance)・遅延生成(S2.5無退行=URLもfireも使わなければspawnゼロ)・shutdown順。
- **戦略的非対称(Sylph B核心)**: `cockpit-page.test.mjs`(383行)は大半がHTML文字列のregexマッチ→**書き換えで大半FAIL・不変オラクルに使えない**。`cockpit-server.test.mjs`(2000行超)は実サーバ+実HTTP+実SSE購読(fake注入)の**ワイヤ契約テスト→作り直しでも不変**。**∴無退行の背骨はserver test。UI描画は人間ゲート**、の二段構え。

### 2-5. 結合度と純関数化の口(Sylph B)

- cockpit.html 913行(CSS約140+JS約676・関数約32・状態は全てIIFE内クロージャ・グローバル汚染なし)。cockpit-page.mjs(21行)はパスexportのみ=結合皆無。
- **SSEデータ→表示文字列の変換**(「fired N lines」「saw title WxH」「barge-in X/Y chars」等)は現状DOM構築と同一関数に埋没するが**純関数抽出可能な形**。前例: `renderChatStatus`/`applyChat` は byId 注入で既にヘッドレス駆動可(page test:298-352が実証)。→ 要件(b)の具体的な取り出し口。

## 3. ヘッドレステスト手段(Sylph A・依存順)

| 手段 | 追加依存 | 忠実度 | (d)への影響 |
|---|---|---|---|
| **(iii)純関数化+ロジック検証** | **ゼロ** | 最低(vnode見ず) | 無傷。既存 `new Function`+fake byId の延長 |
| (ii)linkedomで実render | devDep linkedom 1つ(pure JS・standaloneと相性良=相対import可) | 中 | devDep初導入 |
| (i)preact-render-to-string | devDep preact+htm+rts 実install(standaloneと非共有) | 最高 | 最大 |

**L0決定: (iii)純関数化を採用(devDepゼロ維持)**。特区は7wave連続でdevDepゼロを保っており、この precedent を崩さない。ビューロジック(SSE→表示文字列)を preact非依存の `.mjs` に括り出して node:test、コンポーネント描画は**人間ゲート(視覚モック承認+実操縦席起動)** で見る。**linkedom は台帳の梯子**——描画退行が純関数検証をすり抜けて頻発したら、その時に初のdevDep導入を裁定する。

## 4. L0技術決定のまとめ(ユーザー裁定不要・既存原則に整合)

1. **vendor形= standaloneバンドル単一ファイル**(import map不要・hooks込み・gz5.3KB・コミットして持つ)。
2. **配信= `GET /vendor/*.mjs` 静的ルート追加**(traversal防止)+エントリはinline module。
3. **テスト= 純関数化+devDepゼロ**(linkedomは梯子)。
4. **無退行の背骨= server test(ワイヤ契約16+13+6)**。UI描画は人間ゲート。
5. **移行方式= ビュー(cockpit.html)の全面書き換え**。理由: 単一自己完結ファイルで段階移行の分割線が引きにくい/page testはどのみち書き換え/ワイヤ契約(server)は不変でオラクルになる=安全に全面書き換えできる。器コード・魂の他部位・契約・実行時依存は不変。

## 5. 未決(計画内の段取り・ユーザー承認を要する1点)

- **モダン外観の「見た目そのもの」**: 主観のため、実装前に**HTMLモックを1枚作ってユーザー承認**を取る(前段議論で合意済みの段取り)。これは計画内の choke point であり、棚卸しの blocker ではない。

## 6. waveへ持ち込む検証項目

1. server test(16+13+6)が全緑を保つ=無退行の一次証明。
2. 保存チェックリスト(§2-1〜2-3)を人間ゲートで1個ずつ潰す。
3. 起動信頼性(a): `npm run cockpit` 一発・ビルド段なし・vendor配信が実ブラウザで解決。
4. devDepゼロ・実行時依存不変・lockfile不変・器コード不変。
