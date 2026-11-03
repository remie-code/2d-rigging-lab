# Codex(ChatGPT サインイン)が 429 を返す条件(公式・クライアント・報告の整理)

> 状態: 調査済み(2026-11-03)。**429 の発動条件を明記した公式の記述は見つからなかった。**クライアント側の動きはソースで確定。
> 調べた人: Sylph(Undine から委任)。読んだもの: learn.chatgpt.com / developers.openai.com の公式ページ、openai/codex のソース(タグ `rust-v0.163.0`)と PR・issue、OpenAI コミュニティフォーラム。help.openai.com は取得が 403 で拒否されたため、検索結果の抜粋でしか読めていない。`~/.codex` には触れていない。
> 関係: [codex-429-stall-2026-11-03.md](codex-429-stall-2026-11-03.md)(今回の観察)、[quota-sources-2026-10.md](quota-sources-2026-10.md)(残量の取り方)。

区分の書き方: **[公式]** OpenAI の文書・ソース / **[社員]** OpenAI 社員の発言 / **[報告]** 利用者の報告 / **[推測]** この文書の推測。

## 1. 結論

- 今回の 429 は「使用量の上限(5 時間・週)に達した」429 **ではない**。Codex はその場合 `usage_limit_reached` として即座に打ち切りメッセージを出す。今回のログの文言 `exceeded retry limit, last status: 429` は、**本文がそれ以外の 429(中身は捨てられる)**でしか出ない。[公式・ソース]
- 同じ文言・同じ形(すぐ断られる、Retry-After が数分、アカウントの全プロセスで同じ締め切り、締め切り後は数回通る)の報告が 10/20 以降 Plus・Pro・Pro Lite で多数ある。拾われた本文は `turn_rate_limit_exceeded` / 「Codex is at capacity」。[報告]
- この枠(回数・窓の長さ・誰に掛かるか)を説明した公式の記述は無い。OpenAI 社員からの説明も見つからない。priority やクレジット消費が条件という公式の根拠も無い(priority でない設定でも同じ 429 の報告あり)。
- App Server は待っている間を**ほぼ知らせない**: 最初のやり直し(1/5)は WebSocket 利用時に意図的に隠される。今回のように 1 回待てば通る場合、クライアントには何も届かない。[公式・ソース]

## 2. 公式の記述

| 項目 | 出典 | 内容(要約。引用は 15 語未満) |
|---|---|---|
| Plus の枠 | [learn.chatgpt.com/docs/pricing](https://learn.chatgpt.com/docs/pricing)(日付表示なし。2026-11-03 閲覧) | 5 時間あたりの目安。GPT-6 Astra は Plus で **5〜45 ローカルメッセージ**。「Weekly limits may also apply.」数字は目安で固定の上限ではない、と明記。5 時間より短い窓の記述は無い。 |
| クレジット | 同上 | 含まれる枠を使い切ると「available credits let you continue working」。Plus・Pro は購入可。Astra は 100 万トークンあたり 入力 250・キャッシュ入力 25・出力 1,250 クレジット。**クレジット消費中の回数制限・同時実行制限の記述は無い。** |
| 途中の turn | 同上 | 枠が尽きても進行中の turn は続けられる、ただし「subject to fair use limits」。fair use の中身は書かれていない。 |
| Fast(= priority) | [learn.chatgpt.com/docs/agent-configuration/speed](https://learn.chatgpt.com/docs/agent-configuration/speed)(10/14 の項目あり) | 含まれる枠を Standard の **2.5 倍**、購入クレジットは **2 倍**で消費。Fast 専用の別枠・回数制限・429 の記述は無い。 |
| 順番 | help.openai.com 12642688「Using Credits for Flexible Usage」(検索抜粋のみ) | 含まれる枠が先、尽きたらクレジット。同時タスクで残高がマイナスになり得る。 |
| 枠に達したとき | help.openai.com 11369540「Using Codex with your ChatGPT plan」(検索抜粋のみ) | 使用量ページ・バナーで確認し、クレジット購入・リセット・待機。消費量はモデル・文脈・推論・速度などで変わる。 |
| 1 分・10 分の枠、回数か量か | — | **公式の記述は見つからない。** |
| 自動化・異常利用 | — | Codex のサブスクで「異常な使い方」を絞るという公式の条文は見つからない(上記 fair use の一語のみ)。 |
| 変更履歴 | [learn.chatgpt.com/docs/changelog](https://learn.chatgpt.com/docs/changelog) | CLI 0.162.0(10/08): Responses / WebSocket の失敗で Retry-After に従う。0.166.0(10/29): 「policy-restricted capacity」を過負荷と区別(503 系。今回とは別)。 |
| サポートの一般論 | [community.openai.com/t/…/1384577](https://community.openai.com/t/codex-429-too-many-requests/1384577)(OpenAI_Support、2026-06-25) | [社員] 429 は「短時間の要求過多か使用量超過」。待てば自動で戻る、と一般論のみ。 |

## 3. Codex クライアントの動き(タグ `rust-v0.163.0` のソースで確認)

**429 の分け方**(`codex-rs/codex-api/src/api_bridge.rs`)
- 本文の `error.type` が `usage_limit_reached` → `UsageLimitReached`(プラン別の文言・リセット時刻付きで表示。**やり直さない**)。
- `usage_not_included` / `insufficient_quota`・`credit_balance_exhausted` など → `QuotaExceeded`(やり直さない)。`flex_unavailable` も別扱い。
- **それ以外の 429** → `RetryLimit`。表示は `exceeded retry limit, last status: 429 Too Many Requests`。本文と `x-codex-*` ヘッダは捨てられる。今回のログはこれ。

**やり直し**
- HTTP 層は 429 をやり直さない(`model-provider-info/src/lib.rs` で `retry_429: false`)。「exceeded retry limit」という文言だが、実際は 1 回目の 429 がそのまま上がる。`request_max_retries`(既定 4)は 429 には効かない。
- 上の層(`core/src/responses_retry.rs`)で `stream_max_retries`(既定 5)まで再試行。`RetryLimit` は**サーバーの Retry-After があるときだけ**再試行し、その締め切りまで待つ(上限なし)。無ければ即失敗。→ 今回 443〜528 秒待ったのは、**サーバーが Retry-After でその秒数を指示した**ため(PR #47641 / #49441、2026-09)。
- 5 回使い切ると、WebSocket → HTTPS に切り替えてもう一巡(このときも締め切りは守る)。

**利用者への見え方**
- 再試行のたびに `StreamError`「Reconnecting... N/5」を出し、App Server はそれを `error` 通知(`willRetry: true`、`codexErrorInfo: responseStreamDisconnected { httpStatusCode: 429 }`、`additionalDetails` に上の文言)にする(`app-server/src/bespoke_event_handling.rs`)。**待つ秒数・締め切りは入っていない。**
- ただし `report_error = retry_count > 1 || debug ビルド || WebSocket 不使用`。組み込みの `openai` プロバイダは WebSocket 対応(`supports_websockets: true`、config で変えられない)なので、**リリース版では 1/5 の通知は出ない**。2/5 以降は出る。
- `thread/status/changed` は turn 中ずっと active のままで、待ちを示すものは無い(該当コードなし)。
- `UsageLimitReached` などの打ち切りは `error`(`willRetry: false`)+ turn の失敗として出る。`account/rateLimits/updated` は token_count 時にだけ出る。

## 4. 利用者の報告(openai/codex の issue。社員の説明はどれにも無い)

- [#58883](https://github.com/openai/codex/issues/58883)(2026-11-02、Pro Lite、gpt-6-astra)[報告]: **今回とほぼ同じ**。`1/5 in 400s` の形、複数セッションの締め切りが同じ秒にそろう、締め切り後に再開。負荷の低い 10 分(4〜5 回)でも絞られ、200 回超の 10 分でも絞られない日がある。週の枠は 46〜48%。1/5 の通知が隠れる点と、本文が捨てられる点をソースで指摘。
- [#57073](https://github.com/openai/codex/issues/57073)(2026-10-26、**Plus**、gpt-6.1-sol)[報告]: 生の応答を捕捉。`HTTP 429`・`Retry-After: 205`・本文 `{"type":"rate_limit_error","code":"turn_rate_limit_exceeded","message":"Codex is at capacity, please try again later"}`。約 1.8 秒で返る。コメントに Pro で `service_tier: "priority"` の例もあり。
- [#58906](https://github.com/openai/codex/issues/58906)(2026-11-02、Pro、gpt-6-astra)[報告]: **`service_tier=default` でも**再現。419 秒待ち。別経路でも締め切りが 0.07 秒差で一致。
- [#57084](https://github.com/openai/codex/issues/57084)(2026-10-26〜、Pro、87 コメント)[報告]: 週の枠が 84〜99% 残っていても 429。共通の締め切り。
- [#55964](https://github.com/openai/codex/issues/55964)(2026-10-21、gpt-5.6-sol)[報告]: 同じ `turn_rate_limit_exceeded`・`Retry-After: 152`。別モデル(terra)は通った。数日後に自然に解消して閉じた。
- [#58888](https://github.com/openai/codex/issues/58888)(2026-11-02、Pro、**含まれる枠を使い切ってクレジットで運用**、gpt-6-astra low)[報告]: 作業中の 1 本だけが数分の 429 待ち。[社員] etraut-openai の返答(11/03、「response from codex」)は、枠 99% 以上で TUI が 5 秒ごとに残量を問い合わせるのは仕様、という点のみ。**429 との関係には触れていない**。
- フォーラム「New "Fast" mode cooked me」(2026-10-22、Plus)[報告]: Fast で枠が早く減ったという話のみ。429 の話は無い。
- 社員の Tibo 氏が 2026-08-21 に「limits の苦情の多くは sub2api(サブスクを API 化する道具)利用者」と述べた、という二次報道がある [社員・二次情報、原文未確認]。不正検知の話で、公式クライアント経由の利用には当てはまらないとされる。

## 5. 今回の観察との突き合わせ

| 観察 | 説明できるか |
|---|---|
| 429 がすぐ返る | できる。HTTP 層は 429 をやり直さない。[公式・ソース] |
| 121 秒・443〜528 秒待つ | できる。サーバーの Retry-After に従っている。[公式・ソース] 秒数の決め方はサーバー側で非公開。 |
| 10 分の決まった区切りで解ける・頭と書き出し役が同じ締め切り | 他の報告(#58883・#58906・#57084)と同じ形。**アカウント単位の固定窓**に見える。[報告+推測] |
| 解けたあと 4〜5 回通ってまた断られる | #58883 と同じ。ただし窓あたりの回数が固定かは、報告でもばらつく(200 回超通る日もある)。[報告] |
| 量でなく回数で数えているように見える | 本文の `turn_rate_limit_exceeded` の名前とは合う [推測]。公式の根拠は無い。 |
| 使用量上限の 429 ではない | 確定。`usage_limit_reached` なら文言が変わり、やり直さない。[公式・ソース] |
| 画面に何も出なかった | できる。1/5 の通知は WebSocket 利用時に隠れる。[公式・ソース] |
| 11:27 に始まった理由 | **説明できない。** 10/20 以降、プランを問わず同じ報告が増えているので、OpenAI 側の容量・混雑の絞りの可能性が高いと見る [推測]。priority やクレジット運用が引き金という根拠は無い(default でも、枠が残っていても起きている)。 |

作るものに関わる事実:
- App Server の `error`(`willRetry: true`)を拾っても、**1 回目の待ち(今回の全件)は届かない**。届いても待ち秒数は入っていない。
- 「断られて待っている」を出すには、クライアント側で「最初の文字まで N 秒」を数えるしかない(または Codex 側の修正待ち)。`turn/interrupt` で抜けることはできる(前回確認済み)。
- 待ち中に同じ turn へ追加で送ると、すぐ 429 → 同じ締め切りで待ち直しになる、という報告あり(#58883)。

## 6. 分からないこと

- この枠の正体(名前・窓の長さ・回数か量か・アカウント単位かモデル単位か)。公式の記述も社員の説明も無い。
- 今回の 429 の本文。クライアントが捨てるため、ログからは `turn_rate_limit_exceeded` だったか確かめられない。
- priority(Fast)とクレジット運用が絞られやすさに関係するか。公式に記述が無く、報告でも決め手は無い。
- help.openai.com の該当記事(11369540、12642688、20001106、20001625)の全文。今回は取得できず、検索の抜粋だけで書いた。
- 新しい版(0.166 以降)で 1/5 の通知が隠れる挙動が変わったか。#58883 では 0.166.0 でも同じとの報告。

## 7. 今起きやすくなっているか(2026-11-03 追記)

> 調べ方: openai/codex の issue を作成日ごとに検索し、題名で 2 種類に分けて数えた(2026-11-03 04:30 UTC 時点)。OpenAI コミュニティフォーラムの検索、status.openai.com の履歴も読んだ。Reddit・X は取得できなかった(Reddit は取得を拒否された)。X は二次報道だけ。
> 注意: 題名だけで数えたので漏れや重複がある。issue の総数は 1 日 150〜280 件でほぼ一定なので、日ごとに比べることはできる。

**見分け方**: 似た症状が 2 種類ある。

- (A)「Selected model is at capacity」: 503 の過負荷。すぐに失敗が表示される。
- (B) 今回と同じ種類: 本文の無い 429 が返り、Retry-After の分だけ黙って待つ。

### 件数の推移(題名に該当語を含む新規 issue)[報告を数えたもの]

| 日付(UTC) | (A) 過負荷 | (B) 429 | メモ |
|---|---|---|---|
| 10/12〜10/13 | 15・15 | 0〜2 | (B) の 2 件は自動レビュー機能の 429 で、別物 |
| 10/14〜10/15 | 5・3 | **6・2** | (B) の最初のまとまり(#53978・#54004・#54010・#54017 ほか) |
| 10/16〜10/19 | 0〜8 | 0 | |
| 10/20〜10/23 | **17・27・20・16** | 2・4・1・0 | (A) が最も多い時期。(B) の `turn_rate_limit_exceeded` が初めて記録された(#55964、10/20〜) |
| 10/24〜10/25 | 2・0 | 0 | |
| 10/26 | 3 | **5** | #57072・#57073・#57084・#57139・#57142 |
| 10/27〜11/01 | 1〜5 | 0〜1 | (B) の 1 件(10/30、#58413)は使用量上限の 429 で、別物 |
| 11/02 | **8** | **3** | (B): #58883・#58888・#58906 |
| 11/03(04:30 まで) | 2 | 0 | |

- (B) は **5〜7 日おきにまとまって出ている**(10/14 → 10/20〜21 → 10/26 → 11/02)。週あたりの件数は 5〜6 件でほぼ横ばい。収まってはいない。[報告を数えた結果+推測]
- 今回(11/03 02:27 UTC〜)は、11/02 のまとまりの直後にあたる。[推測]
- (A) は 10/21 前後が山。10/26 に OpenAI が「解決」と書いたあと 1 日 2〜5 件に減ったが、11/02 に 8 件と再び増えた。[報告を数えた結果]
- 最初と最新:
  - (B) の古い例は 6 月の #30471 にもある。ただし長い Retry-After・アカウント全体で同じ締め切り、という今回と同じ形は 10/14 からで、最新は 11/02(#58906、15:22 UTC)。
  - フォーラムでは「Recurring Codex 429 errors despite substantial weekly allowance remaining」(2026-10-26)が (B) にあたる。(A) は 11/01 にも新しい投稿がある。[報告]

### 公式の認め方

- status.openai.com [公式]: 10/20〜11/03 の間に、429・レート制限・容量を名指しした障害は**無い**。近いものは次のとおり。
  - 10/21「Degraded performance in ChatGPT, Codex, and APIs」(解決済み)
  - 10/22「Elevated ChatGPT conversation and Responses API errors」(解決済み)
  - 10/14「Degraded performance in Codex and ChatGPT Work」(範囲外だが、(B) の最初のまとまりと同じ日)
- フォーラムの OpenAI_Support [社員]: どちらも (A) についての発言で、(B) への言及は無い。
  - [10/15](https://community.openai.com/t/1403410): 容量を足し、中断を減らす変更を出した。
  - [10/26](https://community.openai.com/t/1398372): 「known model capacity issue affecting Codex」は解決した。
- 同じ 10/15 に、Codex 責任者の Tibo 氏が X で「容量を足した。at capacity の後は自動で続くようにした」と書いた、という報道がある [社員・二次情報、原文未確認]。
- GitHub [社員]:
  - (B) の issue には `rate-limits` ラベルは付く。しかし調べた範囲では、OpenAI 社員が原因・調査中・修正に触れたコメントは**一つも無い**。
  - 閉じられたものはどれも報告者自身が閉じている(「自然に直った」など)。
  - 唯一の社員コメント(#58888、11/03)は残量の問い合わせの話だけ。
- 変更履歴 [公式]: (B) の枠に触れた項目は無い。0.166.0(10/29)の「policy-restricted capacity」は (A) 側(503)の話。

### 誰に起きているか [報告]

- プラン: Plus・Pro・Pro Lite・Business・Enterprise のすべてで報告がある。
  - (B) の Plus の例: #57073
  - (A) の Plus の例: #55444・#56039・#56121・#56135・#56646
  - クレジットで運用中の例: #58888(Pro)
- モデル: gpt-6-astra(#58883・#58906)、gpt-6.1-sol、gpt-5.6-sol。(A) は luna でも出ている。特定のモデルに限られてはいない。
- service tier: priority(#57073 のコメント)でも、default(#58906)でも起きている。
- 時間帯: (B) の報告時刻は 10:01・10:34(10/26)、11:35・12:51・13:02・14:45(11/02)UTC で、日本の夜〜欧州の昼に寄って見える。ただし件数が少ない。今回の 02:27〜03:44 UTC はその外。(A) には「一日中」という報告もある(#56324)。**時間帯の傾向は言えない。** [推測]
- 地域: 報告者は東アジア(UTC+8)が目立つが、Linux / VS Code・米国・英国の例もある。地域が偏っているとは言えない。[推測]

### 効いたと報告されている回避策 [報告。公式に勧められたものは無い]

- モデルを変える: `turn_rate_limit_exceeded` の間も gpt-5.6-terra は通った(#55964)。sol で effort を low から medium に上げたら通った(#55477)。(A) でも別モデルへの切り替えが提案されている。
- 止めて送り直す: 締め切りより前に動き出せた、という報告がある(#57073)。逆に、同じ締め切りで待ち直しになった、という報告もある(#58883)。**報告が食い違っている。**
- WebSocket を切る: 組み込みの openai プロバイダでは設定で切れない(#58883)。WebSocket を切った CLI でも (A) は出た(#57975)。
- Fast を切る: 効いたという話は第三者ブログの又聞きだけで、確認できない。
- 待つ: 数日で自然に直ったという報告がある(#55964、10/26 に解消)。
