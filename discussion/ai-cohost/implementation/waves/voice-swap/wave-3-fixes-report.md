# 声の差し替え Wave 3 仕上げ（3 点）完了報告

> Gnome → Undine（2026-10-18）。根拠: [../../reviews/voice-swap/wave-3.md](../../reviews/voice-swap/wave-3.md) の差分 1〜3、Undine 裁定 2026-10-18。
> コミットはしていない。依存・環境は変えていない。書いた範囲は `apps/soul/agent` の `src/voice/engines/`・`src/cockpit/`・`scripts/cockpit.mjs` と各テスト、およびこの報告だけ。

## 1. 変更したファイル（`apps/soul/agent/` 配下）

| ファイル | 内容 |
|---|---|
| `scripts/cockpit.mjs` | `voiceDiagnosticReason`（新規 export）。`createVoiceEngineManager` に `onDiagnostic` の配線と、落ちた ElevenLabs を作り直す処理を追加。冒頭の注記と JSDoc を実態に合わせた |
| `scripts/cockpit.test.mjs` | 4 件追加 |
| `src/cockpit/cockpit-server.mjs` | `clipVoiceReason`（表示側で理由を整える）。`setVoiceEngineStatus` と Start 失敗の経路で使う |
| `src/cockpit/cockpit-server.test.mjs` | 1 件追加 |
| `src/voice/engines/elevenlabs-voice-engine.mjs` | 同じメッセージの中で alignment を audio より先に積む。冒頭の注記に 1 行足した |
| `src/voice/engines/elevenlabs-voice-engine.test.mjs` | 1 件追加 |

## 2. 各点の対応

### 差分 1: 診断の理由を警告に出す

- manager は ElevenLabs の engine の deps にだけ `onDiagnostic` を渡す。AivisSpeech の deps は今までどおり。
- 理由に直すのは `voiceDiagnosticReason(d)`。STT と同じく短い理由だけにする。

  | 診断 | 理由 |
  |---|---|
  | `ttsDisconnected` | `closed code=1006`（STT と同じ形） |
  | `ttsConnectFailed` | `接続できない（closed code=1008）` など |
  | `ttsServerError` | `サーバーのエラー（protocol_violation）` など |
  | `ttsConnected` / `ttsReconnected` | 理由を消す |
  | 上記以外 | 何もしない |

- 診断の `message` は使わない。使うのは engine の `reason` だけ。
- `reason` は、制御文字を除いて 80 字で切る。
- 覚えた理由を載せるのは、`reconnecting` / `down` を知らせるときだけ。`up` などでは null にする。
- engine は「診断を出す → status を変える」の順で動くので、status が変わったときの通知に理由が載る。
- 状態はそのままで理由だけ変わったとき（繋ぎ直しの失敗が続くなど）も、知らせ直す。
- 作り直した古い engine の診断は捨てる。
- 表示側（`cockpit-server`）でも、制御文字を除いて 160 字で切る。空の理由は null にする。
  - 160 字にしたのは、キーの置き場所を示す Start 失敗の理由（約 81 字）が切れないようにするため。

### 差分 2: 落ちた ElevenLabs engine は Start で作り直す

- `prepare(kind)` は、同じ種類なら使い回す。ただし elevenlabs で `engine.status === "down"` のときは使い回さない。
  - そのときは `drop()`（購読を外して dispose）し、キーを読み直して作り直す。
- キーが無くなっていたら Start 失敗にする。古い engine は dispose 済みで、新しい engine も持たない。
- `connecting` / `up` / `reconnecting` は今までどおり使い回す。aivis は down でも作り直さない。

### 差分 3: 時間割を音より先に出す

- `handleMessage` で、同じメッセージの alignment を audio より先に積むようにした。
- 組み立て器が既にあれば（読みが返った通常時）、列の順は `timeline → audio` になる。
- 読みの待ちの間を簡易版で埋める改善（最初の audio から上限 250ms など）はしていない。レビューで「任意」とされていたため。

## 3. テスト

| 対象 | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 1469 件 / pass 1469 / fail 0（前回 1463 + 6） |
| ルートで `pnpm run check:soul-zone` | 成功（1509 ファイル） |

足した 6 件:

- `voiceDiagnosticReason` の語彙・null・undefined・`message` を使わないこと・80 字で切ること
- manager: 理由を reconnecting / down に載せる、理由だけ変わったら知らせ直す、繋がれば消す、古い engine の診断は捨てる、aivis の deps には足さない
- manager: down の ElevenLabs を作り直してキーを読み直す、down 以外は使い回す、キーが無くなっていたら失敗、aivis は作り直さない
- 結線: 本物の `createVoiceEngine("elevenlabs")`（偽の WebSocket と時計）→ manager → `cockpit-server` で、警告の detail を確かめた
  - `tts-down` の detail が `接続できない（closed code=1008）`
  - `tts-reconnecting` の detail が `closed code=1006`、続く失敗で `接続できない（closed code=1011）`
  - 繋がれば警告が消える
  - キーも close の reason 文も state に出ない
- cockpit-server: 表示側で整えること（改行を空白に、160 字で切る、空は null）
- engine: 同じメッセージで `format → timeline → audio → timeline → audio → end`

期待値を変えた既存テストはない。

## 4. 質問

1. **理由の文言。** 次の形にした。STT の `ElevenLabs に接続できない（closed code=…）` に揃えるなら、接頭の語を変えるだけで済む。
   - 切断: `closed code=1006`
   - 接続失敗: `接続できない（…）`
   - サーバーのエラー: `サーバーのエラー（…）`
2. **サーバーのエラーで繋ぎ直しに成功したとき。** `ttsServerError` の理由は、繋ぎ直しに成功すると `ttsReconnected` で消える。状態が up のままなので、警告にはならない。このままでよいか。
