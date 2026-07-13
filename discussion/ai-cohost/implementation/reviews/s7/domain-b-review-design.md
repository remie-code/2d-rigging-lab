# S7 Domain B レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: `apps/soul/agent/src/{ears,mind,cockpit}/**`（S7 Domain B「合流＋発火結線」実装）。
> 総合判定: **PASS**（blocking なし。non-blocking 数件・§質問への回答は §7 参照）。

---

## 0. 自分で再実行した機械ゲート・器不変・スコープ確認（生結果）

```
git diff --stat -- apps/runtime-player packages
```
→ 出力なし（器コード完全不変）。

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
```
→ 出力なし（lockfile・依存不変＝新規依存ゼロ）。

```
git status --porcelain -- apps/soul/agent
```
→
```
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/ears/transcript-buffer.mjs
 M apps/soul/agent/src/ears/transcript-buffer.test.mjs
 M apps/soul/agent/src/mind/fire-injection.mjs
 M apps/soul/agent/src/mind/fire-injection.test.mjs
 M apps/soul/agent/src/mind/fire-scheduler.mjs
 M apps/soul/agent/src/mind/fire-scheduler.test.mjs
?? apps/soul/agent/src/chat/
```
domain-b.md §1 の申告どおり 8 ファイルのみ変更・`src/chat/**`（Domain A）は未追跡のまま＝1 バイトも触れていない。

```
cd apps/soul/agent && node --test src/ears/transcript-buffer.test.mjs src/mind/fire-injection.test.mjs \
  src/mind/fire-scheduler.test.mjs src/cockpit/cockpit-server.test.mjs
```
→ `# tests 124 / # pass 124 / # fail 0`（1 回で緑）。ネットワークへ出ず一瞬（668ms）で完走。

各ファイルの `test(` 出現数を自分で数えた: transcript-buffer.test.mjs **17**／fire-injection.test.mjs **10**／
fire-scheduler.test.mjs **32**／cockpit-server.test.mjs **65**。domain-b.md §1/§7/§8 の申告本数（17/10/32/65、
14→17・8→10・22→32・60→65）と完全一致。フル `node --test`（583 本）は実行時間の都合で個別実行に留めたが、
変更ファイル 4 本の縦貫通は自分で緑を確認した。

```
grep -n "^import" apps/soul/agent/src/mind/fire-scheduler.mjs
```
→ 0 件（依存ゼロ維持を自分で確認）。

```
grep -n "^import" apps/soul/agent/src/cockpit/cockpit-server.mjs | grep chat
```
→ 0 件（cockpit-server.mjs は Domain A の `src/chat/**` を直接 import していない＝結線は hooks 経由の設計どおり、
逆方向 import なし）。

```
grep -rn "\.onAppend(" apps/soul/agent/src --include=*.mjs
```
→ 本番コードの `onAppend` 購読者は `ear-pipeline.mjs:184` の 1 箇所のみ。これが cockpit-server の `onTranscript`
フックを駆動する唯一の経路であることを確認（他に隠れた購読者が viewer エントリに反応する余地なし）。

---

## 1. design レーン観点別評価

### ①★ 二重発火／二重放送の断ち — **PASS（最重要・自分でコールグラフを追跡して確認）**

トレース手順（Gnome の説明に頼らず、実コードを自分で辿った）:

1. `ear-pipeline.mjs:184` `buffer.onAppend((entry) => { onTranscript(entry, meta); })` — transcriptBuffer への
   **あらゆる** append（you/soul/viewer 無差別）が同期的にこのリスナーを通り、cockpit-server が渡した
   `onTranscript` コールバック（cockpit-server.mjs:562-582）を呼ぶ。
2. `ingestChatMessage`（cockpit-server.mjs:1028-1060）は `buffer.append({..., speaker:"viewer", displayName})`
   （:1044）を呼ぶ。これは transcript-buffer.mjs の `append()` 内で **同期的に** `appendListeners` を回す
   （transcript-buffer.mjs:171-173）ため、①の `onTranscript` フックが `buffer.append()` の呼び出しの中で
   即座に発火する。
3. `onTranscript` フック（cockpit-server.mjs:562-582）はまず無条件に `fireScheduler.handleTranscript(entry)`
   を呼ぶ（:566）。`fire-scheduler.mjs:401-425` の `handleTranscript` は `entry.speaker === "viewer"` のとき
   :410-414 で**完全な no-op**（armSilence も呼ばず、needle 照合も呼ばず、即 return）。you 経路（call 照合 +
   armSilence、:416-424）は speaker が "you"（既定）のときにしか到達しない分岐構造になっており、viewer で
   誤起動する経路が存在しない。
4. 続けて `onTranscript` フックは放送判定 `if (entry.speaker === "soul" || entry.speaker === "viewer") return;`
   （:573）で return するため、耳の onTranscript 経路からは viewer 行が **一切放送されない**。
5. `buffer.append()` の呼び出しが返ってきた後、`ingestChatMessage` 自身が (b) SSE "transcript" を 1 本放送
   （:1046-1054）→ (c) `fireScheduler.handleChatMessage({text, displayName})`（:1056）を呼ぶ。`handleChatMessage`
   （fire-scheduler.mjs:437-457）だけが comment/comment-call の発火判定と活動反映（armSilence・条件付き
   lastFireAtMs 更新）を担う。

この経路を自分で追った結果、放送は ingestChatMessage の 1 本だけ・発火判定は handleChatMessage の 1 系統だけに
確実に収束しており、doc（domain-b.md §3）の主張どおり穴は無い。**onAppend 購読者が ear-pipeline.mjs の 1 箇所
のみ**（§0 で確認済み）であることも、「別経路で viewer が you 経路や二重放送に漏れる」余地が構造的に無いことの
補強になる。

テストによる固定も自分で読み実行して確認した:
- `fire-scheduler.test.mjs:543-568`「★ 二重発火の断ち: handleTranscript(viewer) は no-op」— viewer 転写を
  `handleTranscript` に食わせても `reqs.length===0`・対照で `handleChatMessage` に同じ本文を入れると
  `comment-call` が出ることを固定（pass 確認済み）。**注記（test 品質・non-blocking）**: このテストの
  `clock.pending()` 不変チェック（:562）は「張り替えても件数は 1 のまま」になりうるため厳密には
  armSilence 呼び出しの有無を区別できない弱い assertion だが、**production コード自体は viewer 分岐で
  armSilence 呼び出し行に到達する前に return しており**（fire-scheduler.mjs:410-414 を自分で読んで確認済み）、
  design としての正しさはコード読解で直接確認できている。test レーンへの申し送りに値する程度で design 判定には
  影響しない。
- `cockpit-server.test.mjs:1341-1377`「viewer コメント取り込みで append + viewer 行を 1 回だけ放送」— 実
  pipeline（fake）+ 実 SSE で viewer 行が 1 回だけ来て 50ms 待っても 2 個目が来ないことを積極確認（pass）。
- `cockpit-server.test.mjs:1379-1415`「comment-call は fire を 1 回・selfFire に kind:"comment-call"（call は
  0 件）」— 実 fireOrchestrator（fake）で `fireCount===1`・`call` の selfFire が 0 件であることまで確認する
  エンドツーエンドの縦貫通テスト（pass）。これは①の断ちを「もし you 経路が誤起動していたら fireCount=2 に
  なるはず」という形で積極的に検出できる設計になっており、単なる期待値の書き写しではない。

### ②合流描画の妥当性 — **PASS**

- `fire-injection.mjs:37-41` `labelOf` は soul/viewer/その他(you) の三値。防御的デフォルト（未知値→"you"）は
  既存の防御実装の延長で健全。
- `formatLine`（:51-58）は viewer のとき `displayName` を `trim()` して長さ判定し、非空なら `viewer(名前): 本文`・
  空/空白/欠落なら `viewer: 本文` に劣化。劣化条件（`typeof e.displayName === "string" ? trim : ""`）は
  displayName が undefined でも `typeof` チェックで弾かれ安全に劣化する。
- 窓（`appendedAtMs`）・上限（`maxChars`・古い方から削る・最新 1 行温存）は `{text,speaker?,displayName?,appendedAtMs}`
  しか見ない純関数（formatFireInjection 本体は formatLine 呼び出し以外 speaker で分岐しない・:98-123）ため、
  viewer 行にも無改造で正しく効く。コードを読んで確認した（新規の window/limit 分岐は追加されていない＝
  speaker 別ロジックの二重化が無く「効かせ忘れ」のリスクが構造的に低い）。
- frozen/append-only 不変性: viewer エントリも `Object.freeze`（transcript-buffer.mjs:161-169）の対象で、
  you/soul と同じコードパスを通る（speaker 分岐した freeze ロジックの複製が無い）ため、viewer だけ非 frozen
  になる余地はない。
- テスト（fire-injection.test.mjs:64-86）で you/soul/viewer 混在の seq 昇順整形と劣化の両方を固定・自分で
  実行し pass 確認済み。

### ③スケジューラ拡張の妥当性 — **PASS**

- `handleChatMessage`（fire-scheduler.mjs:437-457）の順序: armSilence（:440・無条件だが自己ガード）→
  enabled/busy ガード（:441）→ 空文字ガード（:442）→ comment-call 判定（needle 命中で無条件発火・:445-449）→
  comment 判定（予算 :451 → 不応期 :452 → 確率 :453 の順）。doc（domain-b.md §2-3・wave-plan §3 裁定 5）と
  完全一致。
- 活動扱いの裁定: `armSilence()` は enabled/busy に関わらず呼ばれる（:440）のに対し、`lastFireAtMs` の更新は
  comment-call 命中時（:446）・comment 発火時（:455）のみで、コメント到着そのものでは更新されない。これは
  `handleTranscript` の you 経路（:417 armSilence 無条件・:422 lastFireAtMs は call 命中時のみ）や
  `handleVadEvent` の speechStart/speechEnd（:380-391、armSilence は無条件）と同じパターンで、既存規律との
  整合が取れている。「うるさくならない/呼ばれたら返す」の趣旨（comment-call は希釈なし・comment は
  予算+不応期+確率の三段希釈）とも一致。
- busy/OFF/空文字ガード: `handleChatMessage` (:441-442) で確認、テスト（fire-scheduler.test.mjs:465-479,
  528-541）で busy/OFF/空文字とも固定・自分で実行し pass 確認。
- 依存ゼロ維持: `grep -n "^import" fire-scheduler.mjs` で 0 件（§0 で確認済み）。LLM/SDK への到達経路が
  構造的に存在しない状態が維持されている。

### ④結線の薄さ・堅牢性 — **PASS**

- `ingestChatMessage`（:1028-1060）は全体を `try { ... } catch (error) { handleDiagnostic({type:"chatIngestError", ...}) }`
  で包み、throw を診断へ落として器官常駐を守る best-effort 設計（:1057-1059）。close 済みなら早期 return
  （:1029 `if (closed) return;`）も既存の他エンドポイントと同じ流儀。
- バッファ無し（耳未起動）: `if (!buffer) { handleDiagnostic({type:"chatBufferAbsent", ...}); return; }`
  （:1035-1042）で append/broadcast/scheduler いずれもスキップ。「合流先が無いのに発火する（盲目発火）」を
  正しく回避している。テスト（cockpit-server.test.mjs:1417-1440）で append 0 件・fire 0 件・診断 1 件を
  自分で実行して確認済み。
- SSE 口の秘匿情報漏洩: `broadcastChatDiagnostic`（:1078-1087）は info オブジェクトを丸ごと転送せず
  `{kind, message, atMs, delayMs, attempt}` の**5 キーだけをホワイトリスト抽出**して broadcast する
  （:1080-1086）。Domain A（`live-chat-client.mjs`）の `emitDiagnostic` 呼び出し箇所を全て grep したが
  apiKey/token/URL を診断ペイロードに載せている箇所は無い（`apiKey` はモジュールスコープのローカル変数の
  ままで emitDiagnostic には渡されていない）ことも自分で確認した。二重の安全（Domain A 側で載せない前提 +
  Domain B 側でホワイトリスト抽出）になっており設計として手堅い。
  **軽微な doc/コメント不一致（non-blocking）**: cockpit-server.mjs:1074-1075 のコメントは「診断オブジェクトは
  そのまま透過」と書いているが、実装は透過ではなくホワイトリスト抽出（5 キー限定）である。実装は
  コメントより安全側に倒れているため実害はないが、コメント文言の正確性としては要修正の余地。
- `broadcastChatStatus`（:1067-1070）も同様に `status` を文字列強制してから 1 フィールドのみ載せる。

### ⑤§5 バッファ生存の裁定（escalate 妥当性） — **PASS（escalate 判断は妥当・non-blocking）**

- transcriptBuffer は ear-pipeline 所有・遅延起動（`pipeline` 変数は ears start/stop で null ⇄ 実体を往復）。
  `ingestChatMessage` は `pipeline ? pipeline.transcriptBuffer : null` で毎回現在の実体を参照する
  （:1034）ため、耳を後から止めた場合も次の `ingestChatMessage` 呼び出しから正しく「バッファ無し」側へ
  倒れる（stale 参照を握り続けるバグの心配はない）。
- 「巻き上げ（cockpit-server がバッファを常設所有し耳・チャット双方が append する構造）」は、`pipeline` の
  生成・破棄タイミング（ears start/stop）と密結合した既存の状態機械（`earsState`・`health`・
  `startedAtMs` 等）を跨ぐ変更になり、S1〜S6 で固定済みの「耳のライフサイクルが transcriptBuffer の生死を
  決める」という前提を崩す。これは局所修正では済まない構造変更であり、v0 スコープ（合流+発火結線の
  additive 実装）を超える。escalate 判断（blocking な構造変更を黙って避け、v0 では未実装として明記する）は
  妥当と判断する。
- non-blocking である根拠: 人間ゲートの運用（マイクを起動した状態でチャットを Connect）で回避でき、
  cohost の設計思想（声もコメントも同じタイムラインに混ざる）とも整合するため、現時点で機能停止や
  誤動作を引き起こさない。「耳を切ったままチャットだけ動かす」という運用を仕様として明示的に禁止/警告する
  UI 表現（ゴースト行 `chatBufferAbsent`）も用意済みで、無言で盲目発火するよりは安全側に倒れている。

### ⑥堅牢性の穴（エッジケース） — 軽微 non-blocking 数件（§6 参照）

---

## 2. §5 escalate の再確認（Orch/Undine への申し送りの前捌き）

domain-b.md §9-1 の escalate 記述を自分で読み、実装（`pipeline ? ... : null` の分岐が cockpit-server 全体で
何箇所あるか）を `grep -n "pipeline ?" apps/soul/agent/src/cockpit/cockpit-server.mjs` で確認したところ、
`snapshot()`（:417,428）・`ingestChatMessage`（:1034）など複数箇所で同じ「pipeline 有無」分岐が既存の
パターンとして繰り返されている。バッファ所有権を cockpit-server 側へ持ち上げる変更は、この分岐パターン全体
（および ears start/stop の状態遷移テスト群）に触れる可能性が高く、Gnome の見立て（「S1〜S6 挙動や器不変を
脅かしうる構造変更」）は自分の grep でも裏付けが取れた。escalate は妥当・non-blocking。

---

## 3. 堅牢性の穴（エッジケース精査）

1. **displayName に括弧/改行を含む場合**: `formatLine`（fire-injection.mjs:51-58）は `displayName` を
   `trim()` するのみで、内部の `)` や改行はエスケープしない。例えば displayName が `"Ha)ru"` なら
   `viewer(Ha)ru): 本文` のような崩れた括弧表示になりうる。LLM への注入テキストは厳密パーサを持たない
   自由形式のプロンプト文字列であり、下流でこの文字列を再パースして `viewer(...)` 部分だけを構造的に
   取り出す処理は存在しない（grep で `viewer\(` を後方参照するコードは無い）ため、**機能的な破損ではなく
   LLM が読む見た目の軽微な劣化**に留まる。you/soul 行も本文中の改行やコロンをエスケープしない点は既存の
   設計と同水準であり、Domain B が新たに持ち込んだ弱点ではない。non-blocking（followup 候補として記録に
   値するが blocking ではない）。
2. **超長文コメント**: `formatFireInjection` の maxChars ロジック（droppedByLimit）は speaker 別分岐が無い
   共通コードのため、超長 viewer 1 行でも「最新 1 行は必ず残す」（:111 `kept.length > 1` ガード）が効き、
   空注入にはならない。これは①で確認した「viewer 行にも自然に効く」設計の直接的な帰結。
3. **空 displayName（undefined/空白)**: fire-injection 側は §1②で確認済み（劣化して `viewer: 本文`）。
   transcript-buffer 側は displayName 省略時 undefined を許容（you/soul と同形、テストで固定済み・
   transcript-buffer.test.mjs:228-234）。cockpit-server の `ingestChatMessage` も
   `typeof msg.displayName === "string" ? msg.displayName : undefined`（:1032）で非文字列 displayName を
   undefined へ落とすため、`transcriptBuffer.append` の型検証（displayName 非文字列なら TypeError）に
   引っかかって器官が落ちることはない。防御が二重（cockpit 側の型ガード + buffer 側の validate throw）に
   なっており健全。
4. **busy 中の comment-call / 予算切れ後の comment-call**: ③で確認済み（テストで固定・pass 確認）。
5. **fire-injection の displayName 内蔵制御文字（例: ゼロ幅文字・絵文字合成列）**: 表示崩れの可能性は
   あるが、LLM 入力テキストとしての機能停止には至らない。既存 you/soul のテキスト本文自体も同種の
   無制御入力を受け入れているため、Domain B 固有の新規リスクではない。non-blocking。

新たな blocking 級の穴は見つからなかった。

---

## 4. blocking / non-blocking の総括

**blocking 指摘: なし。** ★二重発火/二重放送の断ちは自分でコールグラフを追跡し、production コードの分岐
構造そのもの（handleTranscript の viewer no-op・onTranscript の viewer 放送除外）で確実に成立しているのを
確認した（Gnome の説明やテストの green だけに依存していない）。合流描画・スケジューラ拡張・結線の薄さ・
§5 escalate 判断のいずれにも構造的な穴は見当たらない。

**non-blocking（記録・followup 候補）**:
1. `fire-scheduler.test.mjs:543-568` の「viewer no-op」テストの `clock.pending()` 不変チェックは、
   armSilence 呼び出しの有無を厳密には区別できない弱い assertion（production コードの読解で design 上は
   問題ないと確認済み・test レーンへの申し送り）。
2. `cockpit-server.mjs:1074-1075` のコメント「診断オブジェクトはそのまま透過」が実装（5 キーの
   ホワイトリスト抽出）と字面上一致しない。実装は安全側でコメントが不正確なだけ（要 doc 修正・軽微）。
3. displayName に含まれる `)` や改行のエスケープなし（表示崩れの可能性・機能影響なし・followup 候補）。
4. §5 バッファ所有権の巻き上げは escalate 済み・妥当と判断（Orch/Undine の裁定待ち・Domain B 側の
   落ち度ではない）。

---

## 5. §質問（Orch への回答・domain-b.md §9 の該当項目に対応）

domain-b.md §9 の申し送り事項のうち、design レーンとして判断できる範囲で以下を回答する（最終裁定は
Orch/Undine の領分）:

- **§9-1（バッファ所有権の escalate 要否）**: 上記§2/§5-⑤の通り、escalate 判断は妥当と評価する。v0 で
  実装を見送ったことによる実害（盲目発火・器不変破壊）は無く、`chatBufferAbsent` 診断による可視化も
  用意済み。人間ゲートは「マイクを起動した状態で Connect」で成立するため、この escalate は**今回の
  人間ゲートをブロックしない**（non-blocking の記録として Orch へ引き継ぐのが適切）。
- **§9-2（comment 予算 30 の妥当性）・§9-3（表記揺れ集合の混在ケース）・§9-4（comment/comment-call の
  視覚優先発火）・§9-5（paid の扱い）・§9-6（状態表示/ゴースト行材料）**: いずれも design レーンの観点
  （二重発火・合流描画・結線の堅牢性）からは blocking な懸念を生まない裁量事項・Domain C/人間ゲート領分の
  申し送りであり、design レビューとして異論なし。

design レーン独自の追加質問は無い。

---

**総合判定: PASS。** blocking なし。上記 non-blocking 4 件は記録として Orch へ引き継ぐ。
