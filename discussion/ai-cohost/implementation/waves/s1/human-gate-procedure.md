# S1 人間ゲート手順書 — 「声が答え、口が合っている」

> Status: 手順確定（2026-07-12, Gnome / Domain C）。**実行はユーザー**（実器接続・実スピーカー
> 再生を伴うため Gnome / エージェントは実行しない＝規律）。
> ゴール: [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §1 の人間ゲート
> ——「AI に一言話しかけると、ステージの体が声で答え、口が合っている」を一目一聴で確認する。
> 前提: `cd apps/soul/agent && npm install` 済み（Agent SDK 実在）・`/login` サブスク済み・
> ガード対象環境変数（ANTHROPIC_API_KEY 等）未設定。

## なぜ人間がやるのか（配線の存在 ≠ 疎通）

機械テスト（`node --test`）は魂側の**配線の存在**を検証する（ws-double + echo-player + fake tts で
ロジックを固める）。しかし「実器の channel-server が本当に accepted を返すか」「口が実際に同期して
動くか」「声と口が皮膚感で合っているか」は、**AivisSpeech + 自律ホスト（runtime-player）を起動して
1 回通すまで確定しない**（C 系列の教訓）。ここで初めて「配線の存在」が「疎通」に昇格する。

## 1. 起動一式

1. **AivisSpeech** を起動（`http://127.0.0.1:10101` で待受）。疎通確認:
   ```
   curl http://127.0.0.1:10101/version    # "1.1.0-dev" 等が返れば OK
   ```
2. **自律ホスト（runtime-player の Autonomous Host 役割）** を起動し、AI の身体モデルをステージに
   出す。OBS 等で画面が見える状態にしておく（口の動きを目視するため）。
3. 自律ホストの **Channel ページ**で **`Open Channel`** を押し、表示された **Endpoint URL**
   （`ws://127.0.0.1:<port>/channel?token=<token>`、既定 port 17310）を控える。

## 2. Channel URL を手渡す

上記 Endpoint URL をそのまま次の CLI 起動の位置引数に渡す（token 込み・そのままコピー）。

## 3. 事前疎通（任意）→ CLI 起動 → 一言打つ

### 3-a. 事前疎通（任意・おすすめ）

まず **再生を伴わない**経路で TTS と写像だけ確認する（LLM も器も使わない・枠消費ゼロ）:
```
node apps/soul/agent/scripts/preflight-tts.mjs
```
`RESULT: PASS` なら TTS → WAV → timeline の合成が実機で成立している。

次に **実器フル疎通 + 実再生**の preflight（LLM を使わず固定文で 1 回鳴らす）:
```
node apps/soul/agent/scripts/preflight-e2e.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
```
`一目一聴: 声が鳴り、器の口が同期して動けば合格。` が出て、**声が鳴り・口が動けば**、器との疎通は
確定（LLM を挟む前の土台が通った）。

### 3-b. CLI 起動（LLM を挟む本番の会話）

```
node apps/soul/agent/src/cli.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
```
- 起動時、ガードが働き（API キー等があれば即拒否）、`[cli] 会話を開始します。` が出る。
- stdin に**一文**を打って Enter（例: `こんにちは`）。
- 数秒で AI の応答文が `> …` で表示され、**器の口が動き**、**スピーカーから声が鳴る**。
- 続けて別の一文を打てる（常駐セッション）。**Ctrl+C** または **EOF（Ctrl+Z→Enter / Ctrl+D）**で
  全 dispose して終了。
- stderr に 1 行 JSON の計測（usage・ttft_ms・e2e_ms・timeline_items）が出る（記録の材料）。

## 4. 合格判定

**「声が答え、口が合っている」** — AI に一言話しかけて、

- ステージの体が**声で答える**（応答文が読み上げられる）、かつ
- **口が声に合って動いて見える**（母音の開閉が発話と概ね同期）。

これが一目一聴で成り立てば **S1 人間ゲート合格**。

## 5. ズレたときの追撃（prePhonemeSec 調整）

声と口の**皮膚感のズレ**（口が先行/遅行して見える）がある場合:

- 同期方式は「accepted 受領 → 即再生」で、WAV 先頭 0.1s の無音（prePhonemeLength）が器の口の
  立ち上がり（attack）と概ね相殺する設計（[../domain-b.md](../domain-b.md) §2）。
- ズレる場合は **先頭オフセット（prePhonemeSec）**を微調整して吸収する。純関数
  `buildSpeechTimeline(moras, wavSec, **prePhonemeSec**, postPhonemeSec)` の第 3 引数を、実際の
  audio_query の prePhonemeLength から数十 ms 単位でずらして timeline 全体を前後させる（契約や
  純関数本体の変更は不要＝呼び出し値のみ）。口が**遅れて**見えるなら prePhonemeSec を**小さく**
  （口を前に）、**先行**して見えるなら**大きく**（口を後ろに）。
- 追撃の当否は再度この人間ゲート（3-b）で一聴判定する。

## 6. うまくいかないときの切り分け

| 症状 | 見るところ |
|------|-----------|
| 起動即拒否（`起動を拒否しました`） | ガード対象の環境変数を unset（`ANTHROPIC_API_KEY` 等） |
| 応答が返らない/遅い | LLM レイテンシ（[../../../experiments/s1-first-light.md](../../../experiments/s1-first-light.md) の分布。外れ値あり） |
| 声は鳴るが口が動かない | Channel URL / `Open Channel` の状態・器のモデルロード（`slotNotWritable` 拒否が stderr に出る） |
| 口は動くが声が鳴らない | AivisSpeech 起動・スピーカー出力・PowerShell SoundPlayer |
| `rejected` が出る | stderr の error.code（`slotValueOutOfRange` / `invalidPayload` 等）で契約側を確認 |
