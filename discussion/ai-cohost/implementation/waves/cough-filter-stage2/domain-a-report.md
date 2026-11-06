# ドメイン報告: 咳払いの落とし(段階 2)wave 1 — Domain A「耳とサーバー」

- 判定: **pass**
- ループ: 1 / 上限 5(Gnome は 2 回に分けた: 1 回目 子の側 → 2 回目 親の側。レビュー 1 回で合格)
- 計画: `discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md` §4 A の 1〜8
- Gnome の報告: `waves/cough-filter-stage2/domain-a-gnome-report-1.md`(子の側)、`domain-a-gnome-report-2.md`(親の側)
- レビュー: `reviews/cough-filter-stage2/domain-a.md`(Review-Sylph・合格・blocking なし・§4 A の 1〜8 すべて適合)

## 機械ゲート
- `apps/soul/agent` で `node --test`: 着手前 2345/2345 → 1 回目後 2363/2363 → 2 回目後 **2382/2382 pass**(Gnome 申告。Review-Sylph が自分で走らせて 2382/2382・fail 0・skipped 0 を確認)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1639 files。Review-Sylph が確認)。
- `package.json` / `pnpm-lock.yaml`・`src/mind`(固定の文面)・`src/cockpit/ui`・`view-logic` の差分なし(Orch-Sylph が `git diff --stat` で確認)。

## 作成・変更ファイル(`apps/soul/agent/` の下・未コミット)
- 新規: `src/ears/local-stt/audio-tagging.mjs`(+`.test.mjs`)、`src/cockpit/cockpit-server-cough.test.mjs`
- 変更(子の側): `src/ears/local-stt/local-stt-worker-core.mjs`・`local-stt-client.mjs`(各 +test)、`no-sherpa-in-parent.test.mjs`(実行時チェックの対象に新ファイルを足しただけ)、`scripts/cough-experiment-lib.mjs`(本番から re-export)、`scripts/fetch-local-stt-models.mjs`(+test)
- 変更(親の側): `src/ears/local-stt/local-stt-engines.mjs`・`src/cockpit/cockpit-settings-store.mjs`・`src/ears/transcript-buffer.mjs`・`src/ears/ear-pipeline.mjs`(各 +test)、`src/cockpit/cockpit-server.mjs`、`scripts/cough-experiment.mjs`(+test)
- `discord-experience.mjs` と `scripts/cockpit.mjs` は変更不要だった。

## Domain B へ渡す契約(確定)
- **SSE `discard`(reason cough)**: `{ startMs, endMs, reason: "cough", appended, discarded, text, speech }`
  - `text`: 耳が正本に積むはずだった文字(client の `text`・trim 済み)。`speech`: Speech の確率(数)。
  - 誰の咳か(名前・人の番号・Discord の id・耳の key)は載らない。
- **SSE `discard`(reason blank)**: `{ startMs, endMs, reason: "blank", appended, discarded }`(従来のまま。text なし)
- `discarded` の数(SSE transcript・snapshot)に咳の分が入る(正本の `discard()` が数える)。
- 診断 `transcriptDiscarded {type, reason:"cough", startMs, endMs, latencyMs}` も出る(文字・確率なし)。画面は今 reason を見ずにゴースト行 `(discarded)` を出すので、wave 2 まで咳もそう出る。

## 設定(`cockpit-settings.local.json`・画面には出さない・Start ごとに読む)
| キー | 型・範囲 | 既定 | 0 のとき |
|---|---|---|---|
| `localSttCoughMaxChars` | 整数 0〜10 | 4 | 判定しない(子は AudioTagging を作らない) |
| `localSttCoughSpeechThreshold` | 数 0〜1 | 0.1 | 落とさない |
範囲外・型違いは既定に戻す(`normalizeLocalSttSettings`)。経路: `getLocalStt` → `checkEarEngine` → `earPlan.localStt.local` → `createEarPipeline` の `stt.local` → 上限は client の `audioTaggingMaxChars` で子の `init` へ、線は親の比較へ。

## 確定した内部の形(参考)
- 子 `init` に `audioTagging?: { model, labels, maxChars, threads? }`、`ready` に `audioTagging: { enabled, reason, loadMs }`、`result` に常に `tagged, speech, tagMs`。
- 判定にかけるのは `countChars(text)`(空白を除いたコードポイント数・実験と同じ)が 1 以上かつ上限以下のときだけ。音は区間の pcm(余白込み)を 0 で 5 秒にのばしたもの。
- 落とす条件(親 `coughSpeechToDrop`): ローカルの方式で、線 > 0・`speech` が有限の数・上限以内・`speech < 線`(線ちょうどは通す)。
- 警告: id `cough-filter-off`・warn・一回きりの出来事(60 秒で消える)。文言は固定の英語 1 行:
  - `Cough filter is off: audio tagging model not found`(detail: `Fetch it with: node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny`)
  - `Cough filter is off: audio tagging model failed to load`
  - 子の理由は ear-pipeline で 4 語(not-configured / disabled / model-not-found / failed-to-load)に置き換えるので、sherpa のエラー文やパスは外に出ない。not-configured / disabled は警告しない。
  - 場ごとのフラグ(`openVenueTranscript` で戻す)で 1 回。Discord 2 人でも 1 回(テストで固定)。

## 裁量判断
- (Orch-Sylph)Gnome を 2 回に分けた(計画 §3 の目安どおり)。
- (Orch-Sylph)利用者が切った・未設定(not-configured / disabled)は警告しない。警告文に子の reason(sherpa のエラー文)を入れず固定文にした(パス漏れ防止)。
- (Gnome 1)0 文字(空・空白だけ)は判定しない(どうせ blank で落ちる)。`result` に判定の 3 項目を常に載せる(既存の deepEqual 5 か所を新しい形へ)。`tagMs` を足した。失敗専用の欄は作らず `tagged:true, speech:null` で表す。CED の存在確認は本番(英語)と実験(日本語・取得コマンドつき)で分けた。`summarizeAudioEvents`・`CED_TINY_FETCH_COMMAND` は実験側に残した。
- (Gnome 2)discard の口は正本に足した(`transcript-buffer.mjs` の `discard()`)。親でも文字数を数え直す。既存の deepEqual 6 か所(engines 3・settings-store 3)を新しいキーへ。
- (Gnome 2)`scripts/cough-experiment.mjs` も小さく直した(計画 §3 は lib の import の向きだけとしていたが、本番の既定の上限が実験の子に渡ると AudioTagging が二重になるため、実験の `stt.local` に `coughMaxChars: 0`・`coughSpeechThreshold: 0` を明示。段階 1 の振る舞いは保つ。レビューで妥当と判定)。

## 残課題(非 blocking)
1. 本物の sherpa の AudioTagging では通していない(指示どおり偽物だけ)。本番の子は認識器のあとに AudioTagging を作る順で、実験(判定が先)と逆。人のゲート(計画 §6)で確かめる。
2. `compute` は同期なので、判定の間(短い区間だけ)は子のイベントループが塞がる。
3. 警告のフラグは場単位。同じ場の中で耳を Start/Stop し直しても再警告しない(計画どおり・レビュー注記)。
4. 既存の `cockpit-server.test.mjs`(約 850 行目)は標準出力を握りつぶす作りで、テストの走らせ役の報告が消えて件数が欠ける危険がある(今回は触っていない・今回の新テストは写しを取りつつ流す形で回避)。
5. wave 2(Domain B)まで、咳の落としも画面ではゴースト行 `(discarded)` として出る。

## 質問(Undine へ)
1. 警告の文言は計画 §2 の 6 のとおり英語にしたが、上の帯の既存の警告は日本語なので 1 つだけ英語になる。このままでよいか、日本語に揃えるか(揃えるなら wave 2 か小さな追い修正で)。
2. 警告は一回きりの出来事(60 秒で消える)にした。場が開いている間ずっと出す「状態」の警告(`setCondition`)の方がよいか。

## 起動した子と閉域
| 役割 | agentId | 状態 |
|---|---|---|
| Gnome 1 回目(子の側) | `ac67d57a406b0a2a6` | 完了(SubagentHandback で報告回収済み) |
| Gnome 2 回目(親の側) | `a4cfb6779e07e62d8` | 完了(同上) |
| Review-Sylph | `afc8bd11acc011b73` | 完了(同上) |
