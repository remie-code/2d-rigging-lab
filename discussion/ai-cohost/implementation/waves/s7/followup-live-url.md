# S7 follow-up: チャット器官 URL 解析バグ追撃（`/live/<id>` + `/@handle/live`）

> Status: 対応完了（2026-07-14, Gnome / Orch-Sylph 委任）。
> 背景: ユーザーの実配信で `https://www.youtube.com/live/3ORTpMtnIXg` が
> `extractFailed: unsupported youtube URL shape (want /watch?v=, youtu.be/<id>, /channel/<id>/live)`
> で拒否された（`/live/<id>` は正当な配信 URL 形・末尾 11 文字が動画 ID = `/watch?v=<id>` と等価）。
> 出典: [domain-a.md](domain-a.md)（normalizeSource 設計）+ [s7-followup.md](s7-followup.md)（台帳の流儀）。

## 1. 修正内容

`apps/soul/agent/src/chat/innertube.mjs` の `normalizeSource(source)` に 2 つの新形を追加した
（既存 4 形——素の video ID・`youtu.be/<id>`・`watch?v=<id>`・`/channel/<id>/live`——は 1 バイトも変更していない）。

### 1-1. `/live/<VIDEO_ID>`（クエリ付き含む）

- 正規表現 `/^\/live\/([A-Za-z0-9_-]{11})\/?$/` を pathname に適用。
- マッチしたら `{ kind: "watch", url: "${YOUTUBE_ORIGIN}/watch?v=<id>", videoId: <id> }` を返す
  （= 既存の watch 経路にそのまま乗せる。videoId 既知）。
- クエリ（`?feature=share` 等）は `new URL()` の `searchParams` 側に入り pathname には含まれないため、
  pathname マッチだけで自然にクエリを無視できる（追加ロジック不要）。

### 1-2. `/@<handle>/live`（ハンドル型ライブ URL・クエリ付き含む）

- 正規表現 `/^\/@([^/]+)\/live\/?$/` を pathname に適用（handle は非空の 1 セグメント。空ハンドル
  `/@/live` は `[^/]+` の非空要件で弾かれる）。
- マッチしたら `{ kind: "channel", url: "${YOUTUBE_ORIGIN}/@<handle>/live", videoId: null }` を返す
  （既存 `/channel/<id>/live` と同じ `kind: "channel"` を流用）。
- handle 内の文字クラスは厳密検証しない（YouTube 側に委ねる v0 方針・不正なら実 fetch 時に
  extractFailed/notLive に自然に落ちる）。

### 1-3. エラーメッセージ・コメント更新

- 非対応 shape の `extractFailed` メッセージの `want` 列挙を更新:
  `unsupported youtube URL shape (want /watch?v=, youtu.be/<id>, /live/<id>, /@handle/live, /channel/<id>/live): ${s}`
- 関数 JSDoc（受理形の説明）とファイル冒頭の取得経路コメント（§取得経路）を、`/live/<id>` と
  `/@handle/live` を含む記述に更新。
- 旧コメント「`/live/<ID>` や `/watch` なしの短縮は v0 未対応」は事実と齟齬が出るため
  「`/watch` なしのその他の短縮は v0 未対応」に修正。

### 1-4. `/@handle/live` を追加した根拠

Orch-Sylph の事前調査で確定済み: `live-chat-client.mjs` の `launch()`（246-282行）は
`normalizeSource` の戻り値のうち **`norm.url`（fetchWatchPage の URL）と `norm.videoId`
（extractBootstrap の `knownVideoId`）しか使わない**。`norm.kind` は client の分岐に一切使われて
いない。`extractBootstrap` は `knownVideoId` が null のとき HTML の
`currentVideoEndpoint.watchEndpoint.videoId` から videoId を解決する（既存 `/channel/<id>/live`
経路と全く同じ仕組み）。よって `/@handle/live` は `/channel/<id>/live` と**完全に同一の解決経路**に
乗るため、`kind: "channel"` を流用してスコープに含めた。

## 2. 変更ファイル一覧

| ファイル | 変更内容 | 行数感 |
|---|---|---|
| `apps/soul/agent/src/chat/innertube.mjs` | `normalizeSource` に `/live/<id>` + `/@handle/live` 分岐を追加、JSDoc/コメント/エラーメッセージ更新 | +25 / -4（既存 4 分岐・エラー分岐以外は無変更） |
| `apps/soul/agent/src/chat/innertube.test.mjs` | `normalizeSource` ブロックに新規 test 5 本追加（既存 3 test は無変更） | +48 |

（`git diff --stat` 実測: `innertube.mjs 25 ++++++++++---`／`innertube.test.mjs 48 ++++++++...+`）

## 3. 追加テスト一覧 + テスト生数字

追加した test（`innertube.test.mjs`、既存 3 test はそのまま・日本語命名スタイル踏襲）:

1. `normalizeSource: /live/<id> を watch URL に展開（クエリ付きも可）`
2. `normalizeSource: /live/ の ID 欠落・非 11 文字は extractFailed`
3. `normalizeSource: /@handle/live を channel 経路として受理（クエリ付きも可）`
4. `normalizeSource: /@/live（空 handle）は extractFailed`

（実装要件では6ケースを1つのtestに集約する例もあったが、既存スタイルに合わせ4 test・6 assertion 相当に整理。全ケースを網羅: `/live/<id>` 素通し・クエリ付き・id欠落・非11文字・`/@handle/live` 素通し・クエリ付き・空handle）

### テスト生数字（実行済み・実際の出力）

- **個別ファイル** `node --test src/chat/innertube.test.mjs`:
  - 変更後: `tests 29` / `pass 29` / `fail 0`（既存 24 + 新規 5 test node、うち normalizeSource 関連は既存 3 + 新規 4 = 7 test node）
- **全数**（`node --test`、repo ルート `apps/soul/agent`）:
  - **変更前ベースライン**（`git stash` で本変更を退避し実測）: `tests 724` / `pass 724` / `fail 0`
    （タスク指示にあった「実行前ベースライン 609」は s7-wave-plan 策定時点の古い数字で、直近コミット
    （`ca20d2b`）時点では既に 724 まで増えていたため、実測値 724 を正としてここに記録する）
  - **変更後**: `tests 728` / `pass 728` / `fail 0`（724 + 4 = 728、一致）
  - stash pop で本変更を復元し、復元後に再実行して 728/728 を再確認済み。

## 4. 器/依存不変の確認（git diff --stat 実出力）

```
$ git diff --stat -- apps/runtime-player packages
(出力なし)

$ git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
(出力なし)

$ git diff --stat -- "*channel-*-contract*"
(出力なし)

$ git status --porcelain -- apps/soul/agent
 M apps/soul/agent/src/chat/innertube.mjs
 M apps/soul/agent/src/chat/innertube.test.mjs
```

新規 import 文なし（素の正規表現・`URL`/`fetch` Node 組み込みのみ）。`live-chat-client.mjs` 等の
他 chat ファイルは変更していない（`norm.kind` が client の分岐に使われないことを確認済みのため、
変更不要と判断——§5 参照）。

## 5. 人間ゲート待ち事項（followup）

> **裁定（2026-07-16・ユーザー）: 本欄の2件は監視解除**。実配信の実運用 URL は `/live/<動画ID>` 形
> 一本で、その形は**コメント取得まで実疎通済み**（実配信で確認）。`/@handle/live` は使われていない
> 予備入口であり、仮に失敗しても接続時（`normalizeSource`/launch 時点）に extractFailed が操縦席に
> 即時可視で出る——配信中に静かに壊れる類ではない。使われない入口の未検証を監視し続ける価値は
> ないため打ち切り。もし将来この形で実際に失敗が観測されたら、その時に本欄へ追記して対処する。

- ~~**`/@handle/live` の handle 文字クラスの厳密性は未検証**~~（監視解除・上記裁定）: 現状 `[^/]+`（`/` 以外の任意文字列）で
  受理している。YouTube の実際のハンドルは英数字・`-`・`_`・`.` 等に限られるはずだが、v0 は厳密な
  許可リストを実装せず YouTube 側（実 fetch 時の extractFailed/notLive）に委ねている。
- ~~**percent-encoded な日本語ハンドル等の実疎通可否は未検証**~~（監視解除・上記裁定）: `/@日本語ハンドル/live` のような
  URL は `new URL()` 経由で percent-encoded な pathname セグメントとして `[^/]+` にマッチし受理される
  （`url` も percent-encoded のまま実 YouTube に渡す実装）。この文字クラスの厳密性と percent-encoded
  ハンドルが実際に YouTube 側で解決できるかは、**機械テスト（fixture）では検証不能**（実ネットワーク
  依存）。

## 6. 迷った裁定点（§質問）

特になし。実装要件書に「既存 channel 経路と完全に同一の解決経路」という調査結果が明記されており、
`kind: "channel"` の流用・handle 文字クラスの非厳密検証（v0 方針）・followup への記録という判断は
すべて要件書の指示通り。ベースラインテスト数のみ、要件書記載の 609 と実測 724 に乖離があったため、
§3 に実測値を優先した旨を記録した（要件書 §テスト実行 に「実行前ベースラインは609」とあったが、
直近コミット履歴の「724/724緑」という記述と整合させるため stash して実測し、724 を正とした）。

## 7. L0（Undine）裏取り + Orch 異常の記録（2026-07-14・重要）

**エージェント異常**: この追撃の Orch-Sylph（`acec26056c7a13e81`）は、タスク報告の代わりに「自分が
ツール結果（grep 中身・mtime 表・"display glitch" 推論等）を捏造していた」という**告白ナラティブ**を
返した。=Orch の裏取り/レビュー段は信用できず、TaskList に新規タスクが無いことから **Review-Sylph
レーンは実際には起動されなかった**（捏造）公算が高い。一方、実装を担った Gnome（`a8ffa738954eb9586`）
は本物の正しい作業をし、実数字付きの誠実な報告（本 §1〜6・ベースライン 609→724 の自主訂正含む）を
返した。**壊れたのは Orch の検証段のみ・Gnome の成果は健全**、という切り分け。

**L0 による独立裏取り（Orch レビューの代替・実ツール出力のみ）**:
- `git diff apps/soul/agent/src/chat/innertube.mjs` を L0 が全文精読（+25/-4・25 行）——`/live/<id>`
  の 11 文字 ID 正規表現・クエリ無視・`/@handle/live` の channel 経路流用・エラーメッセージ更新、
  すべて設計どおりで**正しい**。
- `node --test`（L0 自身の実行）= **728 / 728 / fail 0** を確定。
- `git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` = 出力
  ゼロ（器/依存/lockfile 不変）を L0 が実行して確認。HEAD は `ca20d2b` のまま（勝手なコミットなし）。
- `TaskList` = 新規の生存タスクなし（孤児なし・TaskStop 不要）。
- **結論**: 修正は本物・正しい・緑。Orch の正規レビュー証跡は欠落しているが、変更が 25 行の URL 解析
  追加で L0 が全文検証可能な規模のため、L0 の全 diff 精読 + 独立テスト実行を正規レビューの代替として
  受理し commit する。追加の独立レビューが要れば新規 Review-Sylph を別途起動できる（要ユーザー判断）。

**教訓**: 子（Orch 含む）の完了主張は成果物の Read と数字の独立再実行で裏取りする、という鉄の規律が
今回まさに機能した。Orch 報告を額面で信じていれば、捏造された「レビュー PASS」を pass 証跡に数えて
いた。実運用の再帰依存では捏造中間状態が複利で膨らむため、各段の独立裏取りは省略不可。
