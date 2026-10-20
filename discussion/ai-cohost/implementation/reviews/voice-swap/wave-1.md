# 声の差し替え Wave 1 レビュー(Review-Sylph・軽め 1 レーン)

> 対象: 未コミット作業ツリー(Domain A 器の流し込み / Domain B 流し込みプレイヤー)。基準: voice-swap-wave-plan §0・§1。コードは変更していない。

## 判定: 合格(要修正なし)

契約の食い違い・明らかな不具合は見つからなかった。Wave 2 への申し送りが 5 点ある(下記)。

## テスト(自分で実行)

| 項目 | 結果 |
|---|---|
| apps/soul/agent `node --test` | 1399 / 1399 pass(fail 0) |
| `check:soul-zone`(repo root) | passed(1501 ファイル) |
| apps/runtime-player `pnpm run test:unit`(vitest) | 142 ファイル 969 件 pass |
| apps/runtime-player `pnpm run typecheck` | 成功 |

報告の件数(969 / 1399)と一致。B 単独の 1395 は A の channel-client +4 を除いた数で整合する。

## 1. Domain A — 計画との突き合わせ

- op(open/append/end)・1 回 512・発話全体 4096・単調性(続きの先頭は前回の最後より後): 契約 JSON(`channel-intent-speech-stream-payload-schema.json`)、TS 型/定数(`channel-protocol-contract.ts`)、検証(`channel-intent-validation.ts`)、ストア(`control-channel-overlay-store.ts` の二重ガード)で値が一致。拒否コードは既存のみ(invalidPayload / slotValueOutOfRange / slotNotWritable)。
- 別 id の append/end: 検証は形・値域まで通し、続き・上限の照合は現在の id にだけ行い、ストアが accepted のまま無視する。契約・例(speechStreamPath)・テストが同じ。
- end 前は終端クローズなし: `awaitingEnd` で保持のみ(done にならない)。end 後は従来の「最後の間隔ぶん保持 → 400ms」で、`endAtMs` により遅れた end でも飛ばない。
- intent.speech の糖衣化: `setSpeech` = open + append + end を同時刻に流す。`onsetAtMs`/`awaitingEnd`/`endAtMs` は未指定時に従来式と同値(サンプラの差分を確認)。既存の凸恒等式・onset・golden の期待値は変更なし。
- 停止: `#yieldSpeechForSlot` が口グループのスロットへの個別 intent で `#stream` を落とし、`releaseAll` / `clearAll` も同様。append 前の open だけの状態でも止まる。
- hello・envelope-schema・examples・ws-double(既定 4 種)・channel-client(既定 requiredKinds に追加、openSpeech/appendSpeech/endSpeech、64KiB 上限を speech 系で共有)に食い違いなし。reference-driver は examples から期待 kind を読むので追従する(フォールバックの 3 種リストは古いが到達しない)。

## 2. Domain B — 計画との突き合わせ

- 行プロトコル: OPEN/DATA/END/STOP と STARTED/ENDED/STOPPED/ERROR、追加の READY と `STOPPED\t<id>` が、冒頭コメント・パーサ・Node 側で一致。計画の形を保った追加のみ。
- Node API: 計画の `open/write/end/stop/onEvent/dispose` を満たし、`whenReady/current/isAlive` が追加。id は「空でない・タブ/改行なしの文字列」(`assertId`)。
- 古い id: write/end は現在の id のみ送出(false を返す)、STARTED/ENDED は現在の id 以外を捨てる。常駐側も同じく無視。
- 異常終了: `exit` を 1 回だけ出して以後の操作は throw。EPIPE は握りつぶして exit 側で扱う。
- 分割: 16KiB ごと、4 バイト境界に切る。C# 側はバイト列キューで受けるので奇数長の境目も安全。

## 3. 差分

なし(修正を求める箇所なし)。

## 4. Wave 2 への申し送り(食い違いではなく、つなぐときの注意)

1. **時刻の基準**: 口の t=0 は「器が open を受理した時刻」、engine の timeMs は「音声先頭からの通し値」。声は open 受理 → player.open → STARTED の後に出る(実測 20〜85ms 遅れ)ので、口は声より少し先行する。計画の `alignmentLeadMs` と合わせて人間ゲートで調整する前提でよい。open は「鳴らす番が来た時」に送ること(前の文の再生中に先に open すると前の口を早く置き換える)。
2. **accepted の意味**: 古い id の append/end も accepted で返り、無視の印は付かない(応答スキーマが閉じているため)。魂側は自分の発話順序だけを根拠にし、accepted を「効いた」と読まないこと。
3. **end が来ないと口が開いたまま**(A の質問 1): 自動時限なしは計画どおり。Wave 2 の SpeechStreamer は、例外・中断・dispose のどの経路でも `endSpeech` か `sendSet mouth-open=0` を必ず送る try/finally にする。これを Domain C の完了条件に入れることを勧める。
4. **データ不足後の跳び**(A の質問 2): 追いついた後に続きが届くと口形が跳ぶが、ElevenLabs は約 9 倍速で届くため実害は小さい。そのままでよい。timeline は音声より先に append しておく運用にすれば避けられる。
5. **器の再ビルド**: `apps/runtime-player/out/main/main.js` に旧 hello(3 種)が焼かれている。魂の既定 requiredKinds が 4 種になったので、Wave 2 の実機確認の前に器を再ビルドしないと接続時に fail-fast する。

## 5. 注記(裁量判断の是非)

- A: 既存 2 テストの hello 一覧 3 → 4 種の更新は必然で妥当。古い発話を accepted で捨てる、onset の起点を最初の append 受理時刻にする、最初の append まで前の口を維持する、遅れた end を受理時刻から閉じる、の各判断は妥当(口のスナップを避けている)。utteranceId の長さ上限なし(64KiB フレーム上限で抑制)も許容。
- B: WASAPI 採用(名前の全長一致・再生開始の検出)は妥当。READY/`STOPPED\t<id>` の追加も加算のみで問題なし。プリバッファなし(途切れは無音で進める)は人間ゲートで確認する方針に賛成。起動約 0.5 秒は Start 時に作る運用(B の提案)に賛成。
- `check:source` は physiology/index.ts の既存違反で落ちる(A の報告どおり、今回の対象外)。
