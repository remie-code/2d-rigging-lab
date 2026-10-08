# S8 Domain C — NG 最終検査（実装報告）

担当: Gnome（サブエージェント委任・呼び出し元 Orch-Sylph）
対象: `apps/soul/agent/src/mind/ng-words.mjs`（新規）・`apps/soul/agent/src/mind/ng-words.test.mjs`（新規）・
`apps/soul/agent/src/mind/fire-orchestrator.mjs`（検問所の追加）・
`apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（テスト追加）・
`apps/soul/README.md`（安全弁節の追加）・
`discussion/ai-cohost/implementation/waves/s8/s8-followup.md`（新規）

前提: Domain A（`kill()`/`revive()`/in-flight キル検査・`KILL_NOTE`）・Domain B（`POST /api/kill`・
KILL ボタン・`^!k`）は完了済みとして依存した。両ドメインの担当領域（`src/cockpit/*`・
`scripts/fire-hotkey.ahk`・`scripts/cockpit.mjs`・`src/mind/barge-in.mjs`・
`src/mind/fire-orchestrator.mjs` の Domain A 部分）には一切触れていない。

## 変更/作成ファイル一覧

- `apps/soul/agent/src/mind/ng-words.mjs`（**新規**）— NG 語彙・`containsNgWord`・`NG_BLOCKED_NOTE`。
- `apps/soul/agent/src/mind/ng-words.test.mjs`（**新規**）— health test + 照合テスト（10 件）。
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`（変更）— `ng-words.mjs` からの import・ヘッダ
  JSDoc に「S8『NG 最終検査』」節を追加・`processAskedReply` 内の in-flight キル検査の直後に NG
  検問所を追加。
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（変更）— import に `NG_WORDS`/
  `NG_BLOCKED_NOTE` を追加・ファイル冒頭コメントに NG 実語直書きの注意を追記・末尾「S8『NG 最終
  検査』」節にテスト 3 件を追加。
- `apps/soul/README.md`（変更）— 「操縦席UI改定」節の後（ファイル末尾）に
  「#### S8: 配信に耐える（安全弁）」節を新設。
- `discussion/ai-cohost/implementation/waves/s8/s8-followup.md`（**新規**）— followup 台帳。

`apps/soul/agent` 配下以外（器・契約・packages・lockfile・package.json）は一切変更していません。
`apps/soul/agent/src/cockpit/*`・`scripts/fire-hotkey.ahk`・`scripts/cockpit.mjs`・
`src/mind/barge-in.mjs`（Domain A/B の担当領域）にも一切触れていません。

## ng-words.mjs の設計

`src/mind/expression-table.mjs` の様式（`Object.freeze` 二重凍結・「唯一の在り処」を明記したヘッダ
JSDoc）を写経した宣言ファイル。

- **`NG_WORDS`**（`Object.freeze([...])`・凍結配列）: 差別語級の最悪語のみの**最小 starter list・
  5 語**。中身は `きちがい`/`土人`/`支那人`/`ガイジ`/`つんぼ`。実装者としての選定方針は「明確に
  差別語として機能し、かつ日常会話の通常使用との衝突ができるだけ少ない語」（「弁が通常の発話を
  邪魔しない」人間ゲート基準②に配慮）。候補として検討したが**採用しなかった語**: 「チョン」
  （民族差別語として著名だが「ちょんまげ」「ちょんぼ」等の日常語との部分一致衝突が大きいため
  誤爆リスクを避けて見送った）。ヘッダ JSDoc に「starter（v0）・ユーザーが人間ゲートで最終確認/
  編集する」旨・「語数・語彙を触りたいときは `NG_WORDS` のこの 1 箇所だけを触る」旨を明記した。
- **`containsNgWord(text)`**: `text` を `String.prototype.normalize("NFKC")` で正規化し、
  あらかじめ NFKC 正規化済みの `NG_WORDS` 各語が部分文字列として含まれるか（`Array.prototype.some`
  + `String.prototype.includes`）を判定する素朴形。`typeof text !== "string" || text.length === 0`
  は防御的に `false`（空文字/非文字列）。正規化は全角/半角・互換文字の揺れを吸収する最小限で、
  濁点分解や語形変化・難読化対応は持たない（v0 外）。
- **`NG_BLOCKED_NOTE`**: `"（発話を没にした: NG検査）"`（`s8-wave-plan.md` §Domain C に明記された
  文言をそのまま採用）。BARGE_IN_NOTE/KILL_NOTE と同じ全角括弧様式。
- **health test（`ng-words.test.mjs`）**: `expression-table.test.mjs` の 1 テスト 1 観点の様式を
  写経。凍結検証（`Object.isFrozen`）・全要素非空文字列・語数 3〜5 帯・重複なし・`containsNgWord`
  の命中/非命中/全角半角揺れ（NFKC）/空文字/非文字列（null/undefined/number/object/array）・
  `NG_BLOCKED_NOTE` が非空文字列かつ NG 語を含まないこと、の**10 テスト**。
  - 全角/半角揺れの検証は、`NG_WORDS` の「ガイジ」（全角カタカナ）を、半角カタカナ + 半角濁点の
    コードポイント列（`String.fromCharCode(0xff76, 0xff9e, 0xff72, 0xff7c, 0xff9e)`）で埋め込んだ
    文字列が `.normalize("NFKC")` で `"ガイジ"` と一致すること（前提の直接 assert）+ その半角表記
    でも `containsNgWord` が命中することを確認する形にした（NG_WORDS 自体はひらがな/漢字語が
    多く全角/半角の概念を持たないため、この検証にはカタカナ語が必要——「ガイジ」を選定に含めた
    実務上の理由の一つでもある）。
  - テストファイル冒頭に「NG 実語を直書きするのは health/照合の検証に不可欠」である旨のコメントを
    付けた（設計指示どおり）。

## 検問所の挙動（fire-orchestrator.mjs）

`processAskedReply` 内、in-flight キル検査（既存 :336-339 相当）の直後・`const hasSpeech`（既存
:341 相当）の前に以下を挿入した:

```js
if (containsNgWord(speechText)) {
  const appended = buffer.append({ startMs: 0, endMs: 0, text: NG_BLOCKED_NOTE, speaker: "soul" });
  if (appended && appended.appended && appended.entry) {
    emit(onSoulTranscript, appended.entry);
  }
  emit(onDiagnostic, { type: "ngBlocked" });
  return { fired: false, reason: "ng-blocked", ...extra };
}
```

- **命中時**: `speakImpl` を呼ばない・`speechText` 本文をどこにも書かない（soul 本文・診断・戻り値・
  ログのいずれにも本文・命中語を載せない = 秘匿）。正本へは `NG_BLOCKED_NOTE`（本文なし）だけを
  `buffer.append` し、`onSoulTranscript` で通知（既存の soul broadcast 経路と完全に同じ形）。診断は
  `{type:"ngBlocked"}` のみ。戻り値は `{fired:false, reason:"ng-blocked", ...extra}`（`extra` は
  視覚発火の `injectedChars`/`includedCount`/`vision` 等・既存の他分岐と同じ形で渡している）。
- **非命中時**: `containsNgWord` が `false` を返すだけで、以降の処理（`hasSpeech`/`hasEvents`
  判定・speak・soul 追記・演出）は 1 ビットも変わらない（無退行）。
- **speechText が空（expression-only・空応答）**: `containsNgWord("")` は防御的に `false` を返すため
  この検問所は素通りする。NG 検査は「声になるもの」だけを向く設計どおり。
- **視覚発火経路**: `askWithVision` も `fireVision`/`firePreferred` も最終的に `processAskedReply` を
  呼ぶ共通経路のため、検問所は通常 Fire・視覚発火の両方で自動的に効く（追加の分岐は書いていない）。

### NG_BLOCKED_NOTE の置き場所（裁量判断）

`barge-in.mjs`（notes 集約・`BARGE_IN_NOTE`/`KILL_NOTE` の隣）ではなく **`ng-words.mjs`** に置いた。
理由: `barge-in.mjs` は「barge-in の純部品」という明確なスコープを持つモジュールであり
（ファイルヘッダに「speechStart/speechCancel の機械弁」「モーラタイムライン切断点算出」の 2 部品と
明記されている）、NG 検査は barge-in/kill とは別種の機能（検閲）である。一方 `NG_WORDS`/
`containsNgWord`/`NG_BLOCKED_NOTE` は「NG 検査に関するすべて」を 1 モジュールに集約する方が
「語数・語彙・文言を触りたいときはここだけを触る」という `ng-words.mjs` 自身の設計思想（唯一の
在り処）に忠実だと判断した。

## テスト（追加件数と観点）

### `ng-words.test.mjs`（新規・10 件）

上記「health test」節のとおり。凍結/非空/語数帯/重複なしの 4 件 + `containsNgWord` の命中/非命中/
全角半角揺れ/空文字/非文字列の 5 件 + `NG_BLOCKED_NOTE` の非空・NG 語非包含の 1 件。

### `fire-orchestrator.test.mjs`（既存へ追加・3 件・「S8『NG 最終検査』」節）

1. **`ngBlocked: NG 語を含む応答は丸ごと没——speakImpl 不呼び出し・soul へ NG_BLOCKED_NOTE のみ
   1 件・ngBlocked 診断・戻り値 reason:'ng-blocked'（応答本文/命中語は一切漏れない）`**:
   `NG_WORDS[0]`（`きちがい`）を埋め込んだ fake ask 応答で発火し、`speakImpl` 不呼び出し・
   `buffer.all()` が you 発話 + `NG_BLOCKED_NOTE` の 2 件のみ・`onSoulTranscript` が 1 回・診断
   `ngBlocked` のキーが `["type"]` のみであることを確認したうえで、**秘匿の直接検証**として
   `JSON.stringify(diags)`/`JSON.stringify(result)`/`JSON.stringify(all)` のいずれにも NG 語
   （`ngWord`）と応答本文全体（`replyText`）が含まれないことを assert している。
2. **`ngBlocked: NG 語を含まない普通の応答は従来どおり speak され soul へ speechText が追記される
   （無退行）`**: 通常の応答（NG 語なし）で `fired:true`・`speakImpl` が 1 回・soul に speechText が
   そのまま追記され・`ngBlocked` 診断が出ないことを確認（既存挙動の完全な無変更を担保）。
3. **`ngBlocked: 視覚発火 fire({vision:true}) 経路でも NG 検査が効く（processAskedReply 共通経路の
   確認）`**: `getVisionTarget`/`captureImpl` を fake にして視覚発火を起動し、NG 語（`NG_WORDS[1]`
   = `土人`）を含む応答が同様に没にされる（`reason:"ng-blocked"`・`speakImpl` 不呼び出し・soul は
   `NG_BLOCKED_NOTE` のみ・診断に命中語が現れない）ことを確認した。

全テストに `{ timeout: 5000 }` を付与（既存様式に合わせた）。

## テスト結果（生の集計行・自分で実測）

### 実装前（ベースライン・Domain A/B 込みで自分で実測）

```
1..751
# tests 751
# suites 0
# pass 751
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2662.2387
```

### 実装後（`apps/soul/agent` を cwd に `node --test` フルスイート）

```
1..764
# tests 764
# suites 0
# pass 764
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2475.2678
```

764 − 751 = 13（`ng-words.test.mjs` 新規 10 件 + `fire-orchestrator.test.mjs` 追加 3 件 = 13 と
一致）。全緑・無退行。

`src/mind/fire-orchestrator.test.mjs`・`src/mind/ng-words.test.mjs`・`src/mind/barge-in.test.mjs`・
`src/mind/expression-table.test.mjs` の 4 ファイル限定実行でも 97/97 緑を個別確認済み。

## git diff --stat（apps/soul/agent 配下・Domain A/B/C 累積の現況）

```
apps/soul/agent/scripts/fire-hotkey.ahk              |  38 +-
apps/soul/agent/src/cockpit/cockpit-server.mjs       |  56 ++-
apps/soul/agent/src/cockpit/cockpit-server.test.mjs  | 137 ++++++-
apps/soul/agent/src/cockpit/cockpit-ui.test.mjs      |  39 +-
apps/soul/agent/src/cockpit/ui/app.mjs               |   7 +-
apps/soul/agent/src/cockpit/ui/control-bar.mjs       |  64 ++-
apps/soul/agent/src/cockpit/ui/styles.mjs            |  13 +-
apps/soul/agent/src/cockpit/view-logic/control.mjs   |  50 +++
apps/soul/agent/src/cockpit/view-logic/control.test.mjs |  42 +-
apps/soul/agent/src/mind/barge-in.mjs                |   8 +
apps/soul/agent/src/mind/fire-orchestrator.mjs        | 162 ++++++--
apps/soul/agent/src/mind/fire-orchestrator.test.mjs   | 432 ++++++++++++++++++++-
12 files changed, 989 insertions(+), 59 deletions(-)
```

（`git diff --stat` は追跡済みファイルの差分のみを表示するため、新規ファイル
`src/mind/ng-words.mjs`/`ng-words.test.mjs` はここに現れない。`git status --short` では
`?? apps/soul/agent/src/mind/ng-words.mjs` / `?? apps/soul/agent/src/mind/ng-words.test.mjs` として
確認済み。）

**このうち Domain C（本タスク）が変更したのは `src/mind/fire-orchestrator.mjs` と
`src/mind/fire-orchestrator.test.mjs` のみ**（Domain A の既存差分に対する追記）。差分行数の内訳:
- `fire-orchestrator.mjs`: Domain A 時点の 137 行差分に対し、本タスクで import 1 行・ヘッダ JSDoc
  「S8『NG 最終検査』」節 12 行・`processAskedReply` 内の検問所 9 行を追加（累積で 162 行差分）。
- `fire-orchestrator.test.mjs`: Domain A 時点の 311 行差分に対し、本タスクで import 1 行・冒頭
  コメント 6 行・末尾テスト 3 件（約 114 行）を追加（累積で 432 行差分）。

`scripts/fire-hotkey.ahk`〜`view-logic/control.test.mjs`（9 ファイル）・`src/mind/barge-in.mjs` は
Domain A/B の担当領域であり、本タスクでは一切触れていません。

## 器/契約/依存/lockfile 不変の確認

```
apps/runtime-player: git status --short → 出力なし（無変更）
channel-*-contract 系: git status --short → 出力なし（無変更）
packages/: git status --short → 出力なし（無変更）
pnpm-lock.yaml: git status --short → 出力なし（無変更）
apps/soul/agent/package.json: git status --short → 出力なし（無変更）
package-lock.json: リポジトリに存在しない（pnpm 運用のため対象外）
```

install・commit は行っていません。リポジトリ全体の `git status --short` には、セッション開始時点
から既に `M`/`??` として記録されていた他セッション領分の変更（`apps/authoring-host/src/perception/
render-scene-adapter.ts`・`discussion/mesh-generation/**`・`discussion/design/mesh-rendering/**`・
`.tmp/**` 等）が引き続き存在するが、本タスクでは一切触れていません。

## docs の変更一覧

- `apps/soul/README.md`（変更）— 「操縦席UI改定」節の後（ファイル末尾）に
  「#### S8: 配信に耐える（安全弁）」節を新設。キルスイッチ（ホットキー `^!k` + KILL ボタン・
  声の即切断 + 全発火 OFF + 耳/転写生存）・NG 最終検査（最小リスト・starter・秘匿）・AI 開示
  （L0 が別途起草する旨への言及のみ）・人間ゲート（縮小裁定 2 点）を記載。
- `discussion/ai-cohost/implementation/waves/s8/s8-followup.md`（新規）— §1 新設語彙一覧・
  §2 申し送り（(a) kill API レスポンス正本は snapshot、(b) born-killed は現アーキで未到達経路）・
  §3 v0 外項目（URL/電話番号・NG リスト拡張・語形変化対応）・§4 人間ゲート未実施 2 点・
  §5 wave 外（AI 開示は L0 直轄）を記録。

## blocking レビュー基準への対応（実装側の根拠）

1. **没の秘匿**: `ngBlocked` 診断は `{type}` のみ・soul 追記は `NG_BLOCKED_NOTE`（本文なし）のみ。
   fire-orchestrator.test.mjs のテスト 1 で、診断・戻り値・soul 追記の JSON 文字列化のいずれにも
   NG 語・応答本文が含まれないことを直接 assert 済み。
2. **検問所の位置**: speechText 確定後（パーサ実行後）〜speakImpl 呼び出し前（Domain A の in-flight
   キル検査の直後）に設置。命中で `speakImpl` 不呼び出し・soul 本文追記なし（`NG_BLOCKED_NOTE` の
   みが乗る）。
3. **無退行**: 非命中は `containsNgWord` が `false` を返すのみで以降の分岐は無変更。764/764 全緑
   （751 ベースライン + 13 件新規）。
4. **health test**: `ng-words.mjs` は `Object.freeze` で凍結・`ng-words.test.mjs` で構造整合
   （凍結・非空・語数帯・重複なし）を固定。

## 裁量判断

1. **NG 語の選定（5 語）**: `きちがい`/`土人`/`支那人`/`ガイジ`/`つんぼ`。「明確に差別語として
   機能し、日常語との衝突が少ない」を選定基準にした。「チョン」は著名な民族差別語だが
   「ちょんまげ」等の日常語との部分一致衝突が大きいため見送った（人間ゲート基準②「弁が通常の
   発話を邪魔しない」への配慮）。「ガイジ」はカタカナ表記のため、health test で全角/半角揺れの
   NFKC 正規化を有意に検証できる材料にもなった。
2. **`NG_BLOCKED_NOTE` の置き場所**: `barge-in.mjs`（notes 集約）ではなく `ng-words.mjs` に置いた
   （理由は上記「NG_BLOCKED_NOTE の置き場所」節）。
3. **match 関数の正規化範囲**: `String.prototype.normalize("NFKC")` のみ（濁点分解・かな⇔カナ
   変換・大小文字畳み込み等は行わない）。設計指示どおり「素朴形でよい・凝った正規化や語形変化
   対応は v0 外」を厳格に守った。
4. **README の節の位置**: 「S7 の後（S 系列の並びに従って）」という指示に対し、実際のファイル
   構成では「操縦席UI改定」節が S7 の後・S8 の前に既に存在し、その節自体に「S8 前の独立閉問題」
   と明記されている（時系列: S7 → 操縦席UI改定 → S8）。番号順の字面よりも実際の時系列を優先し、
   ファイル末尾（操縦席UI改定の後）に S8 節を追加した。

## 質問

特に判断に迷う不足情報はありませんでした。念のため 1 点、確認事項として記載します。

- **NG 語の選定基準（裁量判断 1）**: 実装者としての最善の判断で「差別語級かつ日常語との衝突が
  少ない」5 語を選びましたが、これは v0 wave 計画で明記された「ユーザーが人間ゲートで最終確認/
  編集する starter」の前提どおり、**最終的な語彙の妥当性判断はユーザーに委ねられます**。
  `NG_WORDS`（`apps/soul/agent/src/mind/ng-words.mjs`）のこの 1 箇所を編集するだけで語彙を追加/
  削除/差し替えできる構造にしてあります。
