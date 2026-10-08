# C6 比較ゲート手順: 二体並置で「口が生きて話す」を人間が確かめる

> Status: 手順確定(Domain C 統合、2026-07-12)。**この手順の実施はユーザーの人間ゲート**——機械ゲート(凸恒等・再調音ディップ・undershoot・512拒否・無退行)は Domain A/B で実装・検証済みだが、「生きた発話中の口に見えるか」の最終審は本比較ゲートのみが下せる(設計 §5・§7 の留保「実際できた結果を見ないと厳密にはわからない」)。
> 出典: wave計画 [../../orchestration/c6-wave-plan.md](../../orchestration/c6-wave-plan.md) §7 Manual Check Notes / 設計 [../../../architecture/c6-mouth-phoneme-timeline.md](../../../architecture/c6-mouth-phoneme-timeline.md) §5 / 棚卸し [../../orchestration/c6-planning-inventory.md](../../orchestration/c6-planning-inventory.md) §2.7。
> コマンドは実コード(`apps/soul/reference-driver/reference-driver.mjs`・`channel-url.ts`・`channel-server.ts`・`channel-page.tsx`・`mapping-page.tsx`)から抽出した。

---

## 0. ゲートの目的(何を見るか)

同じフレーズ「これじっさいのところどうなってるの」を、

- **(a) トラッキングホスト**でユーザー自身が実発話した口(vowel lipsync 有効)
- **(b) 自律ホスト**で同フレーズの fixture モーラ列を参照ドライバから駆動した口

の二体を**並べて見て、(b) が (a) と同種の生き物に見えるか**を判定する(同一である必要はない)。正解データは毎配信動いているユーザーの口そのもの。判定は 4 観点(§3〜§6)。

---

## 1. 前提(ゲートが成立する条件)

### 1.1 テストモデル(両ホスト共通)

- ロードするモデルは **`mouth.vowel.a/i/u/e/o` と `mouth.open` を external-input リグパラメータとして持つ**こと(auto-mapping は target 一致スロットだけを `enabled` にするため。棚卸し §2.1)。無いと自律側のチャネル母音書込が `slotNotWritable` で拒否され、口が動かない。
- 裁定 7(設計 §7)により **テストモデル = ユーザー本番 Runtime Export**(母音リグ + `mouth.open` の external-input 保有をユーザー確認済み)を使う。
- (a)(b) は同一モデルで揃えると比較が素直(口の形状差を排除できる)。

### 1.2 (a) トラッキングホスト側: vowel lipsync の有効化

トラッキングホストは母音推定器を持つが、**`vowelLipsyncEnabled` が true でないと母音スロットを出さない**(棚卸し §2.7、`runtime-parameter-frame.ts` の写像層ゲート)。有効化の操作:

1. トラッキングホストで本番 Runtime Export モデルをロードする。
2. コントロールウィンドウの **Mapping ページ**を開く。モデルが母音リグを持つとき(`vowelLipsyncSupported`)、**「Vowel lipsync」トグル**が現れる(`mapping-page.tsx` の `VowelLipsyncToggle`)。
3. これを **ON** にする。以降、ユーザーの実発話の口形(母音ブレンド)がアバターの口に出る。

> ここは器の新工事ではなく既存機能(C6 以前から在る母音 lipsync)。ユーザーが「これじっさいのところどうなってるの」を実際に声に出して言う実演がゲートの (a)。

### 1.3 (b) 自律ホスト側: 参照ドライバの経路

自律ホストはトラッキングを持たず、**制御チャネル(WebSocket)経由**で口を駆動する。参照ドライバ `apps/soul/reference-driver/reference-driver.mjs`(依存ゼロ .mjs、Node 22 のグローバル WebSocket のみ)が `intent.speech` を一発送ると、器の口グループ・タイムライン評価器が 60Hz でモーラ列を再生する。ドライバは器コードを import せず、契約 JSON を `readFileSync` で参照するのみ。

---

## 2. 参照ドライバの起動

### 2.1 dry-run(WS 不要・タイムライン印字。ドライバ単体確認の土台)

接続前に、送る予定のモーラ列を目視確認できる。URL もアプリ起動も不要:

```
node apps/soul/reference-driver/reference-driver.mjs --scenario=speech --print-timeline
```

→ 1 行 JSON(`{"kind":"reference-driver-timeline","version":1,"scenario":"speech","sections":[{"section":"speech","kind":"intent.speech","slotId":null,"timeline":[{"timeMs":0,"vowel":"o","s":0.6}, ... 全 15 モーラ ...]}]}`)を stdout に出して exit 0。fixture フレーズ「これじっさいのところどうなってるの」の 15 モーラ列(`o,e,i,a,i / o,o,o,o,o / u,a,e,u,o`、促音「っ」は母音なしで省略、idx 5..9 の o×5 が「のところど」の再調音ディップ試金石)がここで確認できる。

### 2.2 live 送信(WS 接続。自律ホストの口を実駆動)

```
node apps/soul/reference-driver/reference-driver.mjs "<ws-url>" --scenario=speech
```

- ドライバは connect → `server.hello` 受領 → `supportedKinds` に `intent.speech` があることを自己照合 → `sendSpeech(timeline)` で 1 発送信 → 発話尺(最終モーラ timeMs 1700ms)+ 600ms 観測 → close(終端 release で口が閉じる)。
- 完遂で exit 0(1 行 JSON レポート `{"kind":"reference-driver-report","scenario":"speech","moraCount":15,...}` を stdout)。想定外拒否で exit 1、引数(URL)不正で exit 2。
- RTT は `sendSpeech` の replyTo 相関で計測(p95 予算 100ms、loopback)。

### 2.3 `<ws-url>`(token 込み)をアプリからどう得るか

ws-url は `ws://127.0.0.1:<port>/channel?token=<token>` の形(`channel-url.ts` の `createControlChannelWebSocketUrl`。bind=127.0.0.1 loopback、path=`/channel`、token はクエリ)。トークンは URL 構成要素としてのみ現れる(C4 §4 秘匿規律)。**アプリからの取得手順**:

1. 自律ホストのコントロールウィンドウで **Channel ページ**を開く。
2. 起動時はチャネル Closed。**「Open Channel」**を押してチャネルを開く(`channel-server.ts` がポートに bind しトークンを発行)。
3. 開くと **Endpoint** 行に `ws://127.0.0.1:<port>/channel?token=<token>` が表示される(既定ポートは slot 番号由来、例 17310)。
4. **「Copy Channel URL」**ボタン(`channel-page.tsx` の `onCopyChannelUrl`)で URL 全体(token 込み)をクリップボードへコピー。
5. これを §2.2 の `<ws-url>` にそのまま貼る(ダブルクォートで囲う)。

> ドライバの `loadContract()` は器の契約 JSON(`apps/runtime-player/src/main/control-channel/contract/*.json`)を読んで `supportedKinds`/slotId 語彙を自己照合する。契約が読めない環境(standalone 配布)では組み込み最小語彙にフォールバックし、`expectedKinds` に `intent.speech` を含む。

---

## 3. 観察 1【本体】: 並置比較(a と b が同種の生き物か)

1. トラッキングホストで §1.2 の通り vowel lipsync を ON にし、ユーザーが「これじっさいのところどうなってるの」を**実発話**する(a)。
2. 自律ホストで §2 の通り Open Channel → Copy Channel URL → `--scenario=speech` で参照ドライバから同フレーズの fixture モーラ列を送る(b)。
3. 二画面を並べて見る。**判定: (b) が (a) と同種の生き物に見えるか**(口の開閉のリズム・母音の渡り歩き・undershoot の混合感。同一である必要はない。機械的な「特定ゴール形への変形反復」に見えたら負け)。

---

## 4. 観察 2: 「のところど」で口が拍ごとに動くか(再調音ディップの試金石)

同母音連続(idx 5..9 = o×5)の区間で、**口が拍ごとに沈み/回復して動くか**を見る。相補式だけなら weight 恒常・s 同値で口が凍る区間だが、器側の普遍ディップ(モーラ境界で s を〜40% へ 40ms 沈める)が拍ごとの再調音を作る。凍っていたら負け。

---

## 5. 観察 3: 終端で口がすっと閉じるか(release)

発話が最後まで喋り終わると(最終モーラ後、保持 → releaseMs)、**口がすっと閉じるか**を見る。器の終端 release で口グループ 6 値が生きた基底(=口 0=閉口)へ収束する。閉じ切らず開いたまま残ったら負け。

---

## 6. 観察 4: kill で口が閉じて呼吸だけ残るか(切断 releaseAll)

参照ドライバを発話の途中で **kill**(Ctrl-C / プロセス終了)する。切断でサーバが `releaseAll` を呼び、口グループが forced-release で閉口へ収束する。**口が閉じて、生理の呼吸(physiology)だけが残るか**を一目で見る。口が駆動値のまま固まったら負け。

---

## 7. 機械ゲートとの関係(この手順が最終審である理由)

以下は Domain A/B で**実装・自動検証済み**(本ゲートで再確認する必要はないが、前提として成立している):

- **凸恒等 Σvowel = s = mouth.open**: 全 tick 性質テストで代表フレーズを 4ms 刻み全域走査し assert(構造保証、後段補正なし)。
- **再調音ディップ**: o×5 で境界<中央・非静止を assert。
- **undershoot**: fast モーラの母音ピーク < slow を assert。
- **512 拒否**: timeline 長 > 512 を `invalidPayload` で拒否(クランプ/切詰め禁止)、単調違反/空配列/未知 vowel も `invalidPayload`。
- **無退行**: C4/C5 契約 fixture・圧縮/知覚シナリオ・physiology golden・リゾルバ・トラッキング経路が無変更で通過。

**機械が保証できないのは「生きた発話中の口に見えるか」だけ**であり、それが本比較ゲート(§3〜§6)の役割。ここが済むまで C6 は「実装完了・人間ゲート未実施」の状態。
