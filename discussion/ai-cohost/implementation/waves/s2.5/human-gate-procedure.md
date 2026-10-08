# S2.5 人間ゲート手順書 — 「操縦席で喋ると転写が積もる」

> Status: 手順確定（2026-07-12, Gnome / S2.5 Domain B）。**実行はユーザー**（実マイク取り込みを
> 伴うため Gnome / エージェントは実行しない＝規律）。
> ゴール: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §1 /
> [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md) §5 の人間ゲート——
> **ブラウザで操縦席を開き、マイクを選んで耳を起動し、喋ると転写がタイムラインに積もるのが見える。
> CLI を一切触らない**。
> 前提: `apps/soul/agent` install 済み・`vendor/` に whisper 一式 + kotoba + silero_vad.onnx 配置済み・
> ffmpeg が PATH（または env `FFMPEG_PATH`）にある（S2 人間ゲートと同一の前提）。

## なぜ人間がやるのか（配線の存在 ≠ 疎通）

機械ゲート（魂の全テスト **226 緑** + `preflight-cockpit.mjs`）は「サーバがページを配信し、状態 API と
デバイス列挙 API が応答する」ところまでを実マイク不使用で証明済み。残る未検証は S2 と同じく
**実マイク + 肉声**（dshow デバイスの取り込み・環境雑音下の VAD・肉声の kotoba 転写品質）と、それを
**ブラウザの操縦席から CLI を一切触らずに回せるか**。ここは人間の目と口でしか確定しない。

## 1. 起動コマンド（1 個・これだけ）

```
npm run cockpit --prefix apps/soul/agent
```

（等価: `node apps/soul/agent/scripts/cockpit.mjs`。ポートを変えるなら `-- --port 9000`。）

起動すると標準出力にアクセス URL が出る:

```
[cockpit] listening on http://127.0.0.1:8181 (loopback only)
[cockpit] open  http://127.0.0.1:8181/  in your browser — pick a mic, press Start, speak.
[cockpit] Ctrl+C / EOF で終了します（魂は close で畳みます）。
```

- **127.0.0.1 限定**（外部公開しない・認証なし）。実マイクが無くてもサーバは起動しページは開ける
  （Start を押すまで実デバイスに触れない）。

## 2. ブラウザで URL を開く

表示された `http://127.0.0.1:8181/` をブラウザで開く。操縦席が出る:

- **ヘッダ**: `Soul Cockpit` / 右上に耳の状態（`Stopped`）と `whisper: unknown` / `ffmpeg: unknown`。
- **Microphone**: ドロップダウンに音声デバイス一覧（前回選んだデバイスがあれば初期選択）。
- **Timeline**: 空。
- **footer**: `discarded: 0` / `uptime: 00:00:00`。

（ffmpeg が見つからない等でデバイス列挙に失敗した場合は、ドロップダウンに `(device enumeration failed)`
と赤字の理由が出る。CLI の `--list-devices` は不要——列挙は操縦席が肩代わりする。）

## 3. マイクを選ぶ → Start を押す

1. ドロップダウンで使うマイクを選ぶ。
2. **Start** を押す。
   - ヘッダの耳が `Listening`（緑ドット）に変わり、`whisper: up` / `ffmpeg: up` になる。
     （whisper-server のモデルロード ≈0.5s のあと `up`。起動失敗なら `whisper: down — 理由` が赤字。）
   - footer の `uptime` が刻み始める。

## 4. 喋る → タイムラインに積もる

**普通に数文を話す**:

- 喋り出しで Timeline に `······(speaking)` のライブ行（VAD の speechStart）。
- 言い終わって ≈0.4s で (speaking) 行が消え、≈1.5〜2s 後に本文行が積もる:
  `12:01:34  you  こんにちは、マイクのテストです (1.5s)`（時刻 / 話者 / 本文 / 転写レイテンシ）。
- 空転写（無音の幻聴等）が破棄されると footer の `discarded` が増える。
- **タブを閉じて開き直しても魂は生きている**——開き直すと Timeline に直近の履歴が復元される
  （履歴行にはレイテンシは付かない = live 行のみ表示で正）。ヘッダ/フッタ/耳の状態もそのまま。

## 5. 合格判定

**「操縦席で喋ると転写が積もる」** — ブラウザの操縦席だけで（**CLI を一切触らず**）、

- マイクをドロップダウンで選び、Start を押し、
- 発話のたびに Timeline に本文行が増えていき、
- 内容がおおむね正しく、言い終わりから**数秒以内**（目安 2〜3s）に現れる。

これが一目で成り立てば **S2.5 人間ゲート合格**。あわせて **OBS 同時起動 + 器二体並走**の負荷でも
追従が保たれるかを一度見る（配信を模した実シチュエーション・wave 計画 §1）。

## 6. 終了

操縦席を立てたターミナルで **Ctrl+C**（または stdin EOF）。`[cockpit] closing…` のあと魂が
clean に畳まれて終了する（耳が動いていれば pipeline を dispose・HTTP サーバを close）。

## 7. うまくいかないときの切り分け

| 症状 | 見るところ |
|------|-----------|
| ドロップダウンが `(device enumeration failed)` | ffmpeg が PATH に無い（`FFMPEG_PATH` を設定）。列挙は録音ではないので実害はここだけ |
| Start 直後にヘッダが `whisper: down` | whisper-server の起動失敗。`vendor/` のモデル/exe 配置・ポート衝突を確認（S2 手順書 §6 と同じ） |
| ヘッダに `ffmpeg: down — …` が出た | capture の恒久死（再起動予算切れ）。デバイス名の取り違え等。Stop→デバイス選び直し→Start |
| (speaking) は出るのに本文行が来ない | 転写側（whisper）の問題。ブラウザの devtools コンソール / 操縦席のターミナルの診断を確認 |
| ページが真っ白 | URL が正しいか（127.0.0.1 + 表示されたポート）。サーバのターミナルが生きているか |

（マイク感度・転写品質のチューニング（閾値・スレッド数・audio_ctx）は v0 の操縦席には無い＝設計
（screens/soul-cockpit.md §4「設定の編集 UI は無し」）。調整が要るときは S2 の耳 CLI 手順書 §5 の
フラグで切り分ける。）
