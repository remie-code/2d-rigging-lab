# 咳払いの落とし(段階 2)の実装計画

> Status: **完了**(2026-11-06・人のゲート合格・master へマージ)。ブランチ `ai-cohost/cough-experiment`(段階 1 のコミット `bced201e` の続き)。
> 根拠:
> - 決定: [cough-experiment-plan.md](cough-experiment-plan.md) §6(ユーザーの言葉つき)
> - 実験の結果: [../../research/cough-filter-audio-tagging-2026-11.md](../../research/cough-filter-audio-tagging-2026-11.md) §9
> - 画面の置き場: [../../research/cough-drop-indicator-ui-2026-11.md](../../research/cough-drop-indicator-ui-2026-11.md)(候補 A)
> - 耳の経路の棚卸し: [../../research/cough-filter-stage2-inventory-2026-11.md](../../research/cough-filter-stage2-inventory-2026-11.md)(以下「棚卸し」)

## 0. 何をするか

本番の耳で、咳や咳払いが「うん」などに化けた区間を、会話に出す前に落とす。落としたら、操縦席の上の帯に「咳 ×N」を 8 秒だけ出す。ローカルの耳と Discord の耳の両方で効かせる。

## 1. 決まったこと(ユーザー 2026-11-06。§6 の写し+その後)

- **落とす条件**:
  - 文字起こしが 4 文字以下の区間だけを、音の種類の判定(CED-tiny int8)にかける。
  - Speech の確率が線(既定 0.1)より低ければ落とす。咳や咳払いの確率は見ない。
  - 長い発話は判定せず、そのまま通す。
- **数字**: 文字数の上限(既定 4)と Speech の線(既定 0.1)は、画面に出さない設定ファイル `cockpit-settings.local.json` で変えられるようにする。今のローカルの文字起こしの設定と同じ扱いで、Start ごとに読む。ユーザーは既定の 0.1 も含めて「異論ない」とした。
- **知らせ**:
  - 上の帯の状態の表示の隣に、薄いグレーで「咳 ×N」と出す。
  - 最後に落としてから 8 秒で消える。続けて落ちると N が増え、消えるまでの時間がのびる。
  - マウスを乗せたときだけ、文字と確率を出す。
  - ログのタブには、落とした行として残ってよい。
  - アニメーションは付けない。開き直したときに札が消えていてもよい。
- **Discord**: Discord の耳でも効かせる。誰の咳かは出さない。
- **効く文字起こし**: Zipformer か Parakeet を選んだときだけ効かせる(ユーザー「異論ない」)。whisper と ElevenLabs には掛けない。
- **モデルが無い・読み込めないとき**: 判定せず、今までどおり全部通す。警告は場ごとに 1 回だけ出す(ユーザー OK)。Start は失敗させない。
- **取得**: いつもの取得スクリプトの既定に CED-tiny を足す(ユーザー OK)。
- **範囲の外**: 咳で VAD が出す「話し始め」の合図(ユーザー「運用上問題になることはなさそう」)。
  - チャッピーの声を切る判定には 2 秒の猶予がある(`BARGE_IN_GRACE_MS`)ので、咳では切れない。
  - 残るのは「話し中」の印が一瞬つくことだけ。

## 2. Undine が決めた細部

1. **文字数の数え方**: 空白を除いたコードポイントの数。実験の `countChars`(`scripts/cough-experiment-lib.mjs:251`)と同じにして、実験で引いた線と意味を揃える。数えるのは、耳が正本に積む文字(client の `text`。`trim()` 済み)。
2. **判定に渡す音**: 子が受け取る区間の音をそのまま使う。前後の余白も込みで、実験と同じ。それを 0 で 5 秒にのばす。
3. **比べる場所**:
   - 子は、確率と「判定にかけたか」だけを返す。
   - 落とすか通すかを比べるのは親(`ear-pipeline.mjs` の `transcribeAndAppend`)。正本に積む前に比べる(棚卸し §7 の 2)。
   - 文字数を数えて判定にかけるかを決めるのは子でよい。子は文字起こしの直後にそれが分かるからで、文字数の上限は `init` で子に渡す。
4. **落とした区間の数え方**:
   - ログのタブの「落とした」の数とゴースト行に入れる。reason は `"cough"`。
   - 今の `discard` は空の文字起こし(`"blank"`)にしか付いていないので、咳の分の口を足す。正本に口を足すか、診断を変換するかは Gnome の裁量。どちらでも、`discarded` の数・SSE `discard`・ゴースト行が揃うこと。
5. **文字と確率の行き先**:
   - SSE `discard` で `reason:"cough"` のときだけ、`text` と `speech` を足す。`blank` の形は変えない。
   - ほかの道には文字を出さない。ファイル、`[cockpit]` の行、`diagnostic` の放送、`ears-cli` の stderr(棚卸し §5)がそれに当たる。
   - 画面はブラウザに保存しない(Undine が確かめた: `src/cockpit` に localStorage・sessionStorage・indexedDB の使用なし)。
6. **モデルが無いときの警告**:
   - 場の側(`warningBoard`)で 1 回にまとめる。Discord で人数ぶん出さない。
   - 文言は決まった 1 行で、文字起こしの文字や名前は入れない。**日本語にする**(上の帯の既存の警告に揃える。Domain A では英語で入れたので Domain B で直す・Undine 2026-11-06。初めに「英語」と書いたのは、ログの行の流儀と取り違えたもの)。
7. **取得の向き**: CED-tiny の置き場の決まり(`CED_TINY_MODEL_LAYOUT` など)を本番の場所(`src/ears/local-stt/` の下など)へ移す。実験の lib と取得スクリプトの両方がそこを読むようにする(棚卸し §7 の 8)。
8. **設定の名前と範囲**(Gnome の裁量で直してよい):
   - `localSttCoughMaxChars`: 整数 0〜10。既定 4。0 なら判定しない。
   - `localSttCoughSpeechThreshold`: 0〜1。既定 0.1。0 なら落とさない。
   - どちらも範囲外や型違いは既定に戻す(今の `normalizeLocalSttSettings` の流儀)。
9. **札のホバー**: 今出ている札が数えている区間を新しい順に並べ、「「うん」 Speech 0.05」の形で出す。最大 5 件まで。

## 3. wave の組み方

**2 つのドメインを順に回す(wave 1 → wave 2)。**

| wave | ドメイン | 触る所 | 合格の条件 |
|---|---|---|---|
| 1 | **A: 耳とサーバー** | `src/ears/local-stt/`(子の入口・`local-stt-worker-core.mjs`・`local-stt-client.mjs`・モデルの置き場)、`src/ears/ear-pipeline.mjs`、`src/ears/transcript-buffer.mjs`(要るなら)、`src/cockpit/cockpit-server.mjs`(`onDiscard` の SSE・警告)、`src/cockpit/cockpit-settings-store.mjs` と `local-stt-engines.mjs`(設定)、`scripts/fetch-local-stt-models.mjs`、`scripts/cough-experiment-lib.mjs`(置き場の import の向きだけ)、それぞれのテスト | 下の §4 A |
| 2 | **B: 画面の札** | `src/cockpit/ui/`、`src/cockpit/view-logic/`、`styles.mjs`、画面のテスト | 下の §4 B |

**こう組む理由**(implementation-orchestration の波分割に照らした):
- **依存**: B は、A が出す SSE `discard`(`reason:"cough"`・`text`・`speech`)を受けて札を出す。依存の向きが A → B なので、A を基盤の層として先に回す。
- **並列にしない理由**:
  - 契約(SSE の形)を先に固めれば、形の上では並列にできる。
  - けれど同じ作業ツリーで 2 つの Gnome が同時に `node --test` を全部走らせると、互いの書きかけで偽の失敗が出る。
  - B は小さい(札 1 つ・純関数 1 本・CSS 数行・ゴースト行のラベル)ので、待っても失うものは少ない。
  - A の本物の形の上に B を作れる。
- **A を 1 つのドメインにまとめる理由**:
  - 子の側(確率を返す)と親の側(比べて落とす・知らせる・設定)は、`init` と `result` の形でつながっている。依存がドメインの中で閉じている。
  - Orch-Sylph が Gnome を 2 回に分けて順に呼んでよい(子の側 → 親の側)。1 回の Gnome の量がコンテキストの枠を超えないようにするため。
  - 分けるかどうかは Orch-Sylph の裁量。
- **3 つに分けない理由**: 子の側だけでは振る舞いとして確かめられない(落とす所が無い)。A を割ると、レビューが「契約が合っているか」だけになる。

## 4. 合格の条件

### A: 耳とサーバー

1. **子**:
   - Zipformer・Parakeet の子は、CED-tiny があれば `AudioTagging` を作る。
   - 文字起こしの文字が上限以下のときだけ判定にかけ、`result` に Speech の確率を足す。判定にかけないときは null。
   - CED-tiny が無い・作れない・判定が失敗したときは、`fatal` にしない。「判定なし」で文字起こしを続ける。
   - sherpa を読むのは今までどおり子の入口だけ(`no-sherpa-in-parent.test.mjs` が通ること)。
2. **親**:
   - `transcribeAndAppend` で、確率が線より低ければ正本に積まずに落とし、reason `"cough"` で `discard` を出す。
   - 線が 0、確率が null、文字が上限を超える、のどれかなら、今までどおり積む。
   - 文字起こしが whisper・ElevenLabs のときは何も変わらない。
3. **SSE**:
   - `discard` の `reason:"cough"` に `text` と `speech` が載る。`blank` の形は今のまま。
   - `discarded` の数に咳の分が入る。
4. **文字の漏れ**: 文字と確率は SSE `discard` にしか出ない。テストで、診断・警告・`[cockpit]` の行・ファイルに文字が出ないことを確かめる。
5. **モデルが無いとき**: Start は成功する。警告は場ごとに 1 回で、Discord で 2 人いても 1 回。
6. **設定**: 2 つの数字が `cockpit-settings.local.json` から Start ごとに耳と子へ届く。範囲外は既定に戻る。画面の設定には出さない。
7. **取得**:
   - `fetch-local-stt-models.mjs` の既定で CED-tiny も取る。`--only ced-tiny` は残す。
   - 置き場の決まりは本番の場所にあり、実験の道具も今までどおり動く(実験のテストが通る)。
8. **Discord**: 人ごとの耳でも同じように落ち、同じ SSE が出る。誰の咳かは載せない。

### B: 画面の札

1. SSE `discard` の `reason:"cough"` を受けると、上の帯の状態の表示の隣に、薄いグレーで「咳 ×N」が出る。
2. 最後の咳から 8 秒で消える。消える前に次が来れば N が増え、8 秒が数え直しになる。消えたあとの次の咳は ×1 から。
3. マウスを乗せると(`title`)、§2 の 9 の形で文字と確率が出る。
4. 会話のタイムラインには出ない(今のとおり `discard` を無視すること。`glance-timeline.test.mjs:192` の固定が通ること)。
5. ログのタブのゴースト行は、reason が `cough` なら咳と分かるラベルにする。`blank` は今のまま。
6. 帯の並びが札の出入りで崩れない(幅の確保か絶対配置)。アニメーションは付けない。
7. 札の残り時間は、画面の 1 秒ごとの時計(`nowTick`)で消す。サーバーに状態は持たない。
8. 咳の落としが止まっているときの警告(`cough-filter-off`)の文言を日本語にする(§2 の 6)。中身は「咳の聞き分けが止まっている」と理由(モデルが無い / 読み込めない)。取得のコマンドは detail のまま。触るのは `cockpit-server.mjs` のその定数と、そのテストだけ。

## 5. 守ること(両ドメイン)

- Undine → Orch-Sylph(opus)→ Gnome(opus)+ Review-Sylph(sonnet)。
- 機械ゲート: `apps/soul/agent` で `node --test` 全件 pass、リポジトリの根で `pnpm run check:soul-zone` pass。依存と lockfile は変えない。要るなら escalate。
- テストと子エージェントは実データに触らない。触らないもの: `cockpit-settings.local.json`、`memories/`、`roles/`、`session-usage/`、`fire-diagnostics/`、`memory-backups/`、`cough-experiments/`、`.env*`(読まない)。
- 操縦席を起動しない。本物のマイク・本物の bot・LLM・外部 API を呼ばない。モデルを取得しない(テストは偽物の sherpa で)。
- 声は保存しない。製品のログに文字起こしの文字・名前・Discord の id を出さない。
- ②④と判定の頼みの文面は一字も変えない(固定のテストが通ること)。

## 6. 人のゲート(実装の合格のあと)

- ユーザーが操縦席で Zipformer の耳を使い、咳払いをする。
- 確かめること:
  - 「うん」が会話に出ないこと。
  - 札が出て 8 秒で消えること。
  - ホバーで文字と確率が見えること。
  - 本物の「うん」が落ちないこと。
- Discord でも Zipformer を選んで同じことを確かめる。

## 7. Status

- 案(2026-11-06)→ wave の組み方にユーザー OK。wave 1(Domain A)を起動(2026-11-06)。
- **Domain A 合格**(2026-11-06・1 周目)。テスト 2345 → 2382 件(Undine も確認)、check:soul-zone pass、`src/mind`・画面・依存に差分なし。SSE `discard`(reason cough)は `{ startMs, endMs, reason, appended, discarded, text, speech }`。設定は `localSttCoughMaxChars`(0〜10・既定 4)と `localSttCoughSpeechThreshold`(0〜1・既定 0.1・`speech < 線` で落とす)。警告 `cough-filter-off` は一回きりの出来事で、場ごとに 1 回。報告 [../waves/cough-filter-stage2/domain-a-report.md](../waves/cough-filter-stage2/domain-a-report.md)、レビュー [../reviews/cough-filter-stage2/domain-a.md](../reviews/cough-filter-stage2/domain-a.md)。
- wave 2(Domain B)を起動(2026-11-06)。警告の文言を日本語にする分を B に足した(§4 B の 8)。
- **Domain B 合格**(2026-11-06・1 周目)。テスト 2382 → 2402 件(Undine も確認)、check:soul-zone pass。
  - 札: 状態のピルの右の幅 68px の置き場に「咳 ×N」(`--muted`)。`nowTick` で 8〜9 秒後に消える。
  - ホバー: 新しい順に最大 5 件、確率は小数 2 桁。
  - ゴースト行: reason cough なら `(咳として落とした)`。
  - 警告: 「咳の聞き分けが止まっている（モデルが無い / モデルを読み込めない）」。
  - 報告 [../waves/cough-filter-stage2/domain-b-report.md](../waves/cough-filter-stage2/domain-b-report.md)、レビュー [../reviews/cough-filter-stage2/domain-b.md](../reviews/cough-filter-stage2/domain-b.md)。
  - 残課題(非 blocking): `warnCoughFilterOff` の JSDoc に「英語の 1 行」が残っている。Discord の場では、ピルと接続の表示の間に 68px の空きが常にある。
- **人のゲート合格**(2026-11-06)。ユーザー「うん、はちゃんと入るし咳払いは弾かれてる / 応答が遅くなってる感じもなさそうだね / 札も出るし問題なさそうだ」。
- master へマージ(ユーザー「コミットしてmasterにマージしよう」)。
