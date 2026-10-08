# Domain C（操縦席 UI + 観測 + docs）レビュー — design レーン

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: `apps/soul/agent/src/mind/fire-orchestrator.mjs`（latencyMs 配線箇所）・`src/cockpit/cockpit-server.mjs`（brain 札 / latencyMs 実値化）・`src/cockpit/view-logic/{transcript,usage,health,settings}.mjs`・`src/cockpit/ui/{rows,app,settings-drawer}.mjs`・`apps/soul/README.md`。
> 基準: [brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §4 blocking 基準（主眼 #7 KILL/NG 弁の頭非依存・#6 additive）。
> 方法: Gnome の実装報告（`waves/brain-swap/domain-c.md`）は裏取り対象として読み、判断は実コード精読・`git diff`・自分での `node --test` 実行に基づく。

## 総合判定: **PASS**

blocking #7（KILL/NG 弁の頭非依存）は独立検証で成立を確認した——`fire-orchestrator.mjs` の diff は正味 +9/-1 行のみで、`killed` 判定（:351）・`containsNgWord` 判定（:360）の条件式は 1 文字も変わっておらず、latencyMs 配線は自然完了パス（:457-465）の emit 呼び出し 1 箇所にのみ追加されている。NG ブロック時（:361-364）・barge-in/kill 中断時（severSpeaking :544-548）の emit 呼び出しはどちらも無変更のままで、latencyMs は乗らない。blocking #6（additive）も同様に成立している。既存 fixture・既存テストはすべて無変更のまま緑であり、新規テストは「検問所節に latencyMs が漏れていないこと」を `hasOwnProperty` で直接固定している。node --test は自分で実行し、報告書記載の個別ファイル絶対数（66/95/5/4/8/11/38）と完全に一致することを確認した——Domain B レビューで発見された「報告書の生ログが実行結果と一致しない」問題は Domain C には存在しない。

---

## 1.【最重要 blocking #7】検問所無傷の独立検証

`git diff -- apps/soul/agent/src/mind/fire-orchestrator.mjs` を自分で取得し全文を読んだ。diff 統計は `10 ++-`（実質 +9/-1 行）で、変更箇所は JSDoc コメント3行の追加と、以下1箇所のコード変更のみ:

```diff
-      emit(onSoulTranscript, appended.entry);
+      // 多頭化 Domain C: 応答レイテンシの実値化（wave-plan §3 Domain C・blocking #7 は不変=検問所
+      // ロジック自体は 1 行も触っていない・ここは自然完了パスのみへの additive な通知配線）。
+      // asked.elapsedMs（知性契約 MindSessionAskResult・brains.mjs）を entry のコピーへ乗せて通知する
+      // （transcriptBuffer 正本の Object.freeze entry は直接変更しない・スプレッドで新規オブジェクト化）。
+      const latencyMs = asked && typeof asked.elapsedMs === "number" ? asked.elapsedMs : null;
+      emit(onSoulTranscript, { ...appended.entry, latencyMs });
```

`processAskedReply`（:333-469）を全文読み、以下4つの emit 経路すべてを個別に確認した:

1. **killed-inflight（:351-354）**: `if (killed) { emit(onDiagnostic, {type:"killDiscarded"}); return {fired:false, reason:"killed-inflight", ...extra}; }` — 判定条件・戻り値とも無変更。soul 追記自体が発生しない経路であり、そもそも latencyMs が乗りようがない。
2. **NG ブロック（:360-367）**: `if (containsNgWord(speechText)) { const appended = buffer.append(...); if (...) { emit(onSoulTranscript, appended.entry); } ... }` — `containsNgWord` の判定条件、`emit(onSoulTranscript, appended.entry)` の呼び出し形とも diff に一切現れない（旧版とバイト等価）。latencyMs は乗らない。
3. **barge-in/kill 中断（severSpeaking :544-548 経由）**: `interrupt()`（bargeIn）と `kill()`（S8）はどちらもこの共有関数を通るが、`emit(onSoulTranscript, appended.entry)`（:547）は diff に現れず無変更。latencyMs は乗らない。
4. **自然完了（:457-465）**: 上記の唯一の変更箇所。`asked.elapsedMs` が number のときのみ latencyMs をスプレッドで additive に足す。

さらに `killed` フラグそのものの検問所（`fire()` 冒頭ガード :802-804、kill/revive :592/:609）も grep で洗い出したが、diff に一切現れていないことを確認した。

**結論**: KILL/NG 検問所の判定条件・emit 呼び出し形はどちらも 1 バイトも変更されていない。latencyMs 配線は自然完了パスの emit 呼び出し1箇所のみへの additive 追加であり、blocking #7 は独立検証で成立している。

### NG ブロック時に latencyMs が乗らないことを固定するテストの実在確認

`fire-orchestrator.test.mjs` の新規3本目のテストを読んだ:

```js
test("onSoulTranscript: NG ブロック時の entry には latencyMs フィールドが乗らない（検問所ロジックは無変更・観測配線は自然完了パスのみ additive）", ...async () => {
  ...
  session: { async ask() { return { replyText: `そうだね、${ngWord}って言葉はひどいよね`, elapsedMs: 999 }; } },
  ...
  const result = await orch.fire();
  assert.equal(result.reason, "ng-blocked");
  assert.equal(souls.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(souls[0], "latencyMs"), false);
```

`elapsedMs: 999` をあえて与えた fake session を使い、それでも NG ブロック経路の entry には `latencyMs` プロパティ自体が存在しないことを `hasOwnProperty` で直接検証している——「実測値があるのに漏れていないか」を積極的に踏む、価値のあるテスト設計だと判断した。実行して緑であることも自分の `node --test src/mind/fire-orchestrator.test.mjs` で確認済み（§5）。

---

## 2. latencyMs additive 配線の健全性（blocking #6）

- `appended.entry` は `transcript-buffer.mjs` の `append()` が返す `Object.freeze` 済み正本。変更箇所は `{ ...appended.entry, latencyMs }` というスプレッドで新規オブジェクトを作っており、正本を直接変更していない。新規テスト1本目が `buffer.all()` で見た正本エントリに `latencyMs` プロパティ自体が存在しないことを `hasOwnProperty` で確認しており（transcript buffer 側は無傷）、この主張を裏取りできた。
- `broadcastSoulTranscript`（cockpit-server.mjs :1177-1200）は `entry.latencyMs` が number ならそれを使い、そうでなければ従来どおり `null` に落とす:
  ```js
  const latencyMs = entry && typeof entry.latencyMs === "number" ? entry.latencyMs : null;
  ```
  既存の `hooks.onSoulTranscript({...})` 呼び出し形（latencyMs フィールド無し）を渡す既存テスト（S3〜S8 時代のもの）は無変更のまま緑であることを自分で実行して確認した。新規テスト「onSoulTranscript の entry に latencyMs が無ければ従来どおり null」も同じ後方互換性を SSE レベルで固定している。

---

## 3. brain 札の頭非依存

`cockpit-server.mjs` の diff を読んだ結果、`fire-orchestrator.mjs` には brain 概念が一切現れないことを確認した（fire-orchestrator の diff・全文どちらにも `brain` という識別子は登場しない）。brain 札は cockpit-server.mjs 側で2箇所のみ additive に足されている:

1. `broadcastSoulTranscript`: `const brain = typeof brainStatusImpl === "function" ? (brainStatusImpl()?.brain ?? null) : null;` → soul の transcript イベントにのみ付加。
2. `onUsage` フック: `broadcast("usage", { ...info, brain: ... })`。

**耳/viewer 行に brain が乗らないことの確認**: `cockpit-server.mjs` 内の他の2つの `broadcast("transcript", ...)` 呼び出し箇所を grep で洗い出し、個別に確認した:
- 耳（you）の onTranscript 経路（:672-678）: `latencyMs`/`audioCtx`/`appended`/`discarded` のみ、`brain` フィールドは無い。
- viewer（chat 取り込み）経路（:1344-1350）: 同様に `brain` フィールドは無い。

`broadcastSoulTranscript`（:1192-1198）だけが `brain` を additive に持つ。soul 行のみに brain 札が乗るという設計意図がコードで裏付けられている。**orchestrator は最後まで頭を一切知らないまま、cockpit-server が観測時点で「今の頭」を読むだけ**という報告書の主張は正確である。

---

## 4. in-flight 切替の brain 札近似

`broadcastSoulTranscript`/`onUsage` はどちらも broadcast 時点（≒ソウルの発話完了・usage 受信の瞬間）の `brainStatusImpl()?.brain` を読む設計であり、`asked` オブジェクト自体（ask 開始時点の頭識別）は参照していない。したがって配信中に頭を切り替えた直後の in-flight 応答（切替前の頭が生成し、切替後に完了した応答）には、実際に生成した頭ではなく「切替後の今の頭」の札が付く——報告書が主張する近似は実コードと一致する。

この近似は `brain-swap-followup.md` §C-1 に明記されており、wave 計画 §1「配信前選択が本線・切替は運用外」という v0 裁定の下では実害が小さいと判断した。将来「配信中の頭切替」が一級 UX に格上げされる場合は、`asked` 結果自体に頭 id を持たせて entry に刻む設計へ変更する必要があるという申し送りも妥当。**non-blocking として許容範囲**と判断する。

---

## 5. view-logic の後方互換

- `latencyLabel(latencyMs, brain)`（transcript.mjs）: `latencyMs == null` は brain の有無に関わらず即 `null`（発話していない行では札を出さない）。`brain` が falsy（未指定/null/空文字）なら従来どおり `"(Ns)"` のみ。既存テスト（`assert.equal(latencyLabel(1234), "(1.2s)")` 等）は無変更のまま緑。新規テストは brain あり/なし/null/空文字/latencyMs 無しの全組み合わせを固定している。
- `usageNoteText(d)`（usage.mjs）: `d.brain` が truthy なら vision 表記の直後に `[brain]` を追加、falsy なら従来文字列。既存 fixture（`usageNoteText({usage:{}})` 等）は無変更のまま緑。
- `rows.mjs` の `feedWithTranscript`: `latencyLabel(d && d.latencyMs, d && d.brain)` と additive に渡すのみ。d.brain 未搭載時は `undefined` が渡り、`latencyLabel` 内で falsy 扱いされ従来形に落ちる——設計として一貫している。

自分で `node --test src/cockpit/view-logic/transcript.test.mjs`（5/5）・`usage.test.mjs`（4/4）・`cockpit-ui.test.mjs`（38/38、brain 札の feedWithTranscript テスト含む）を実行し、全緑を確認した。

---

## 6. 設定区画の設計

- `settings-drawer.mjs` の「頭脳」区画は「声の出力先」行の写経として構造化されており、`onAudioSet`/`useEffect` と同型のパターン（state → doFetch → view-logic でエラー文言 → applySnapshot）を踏襲している。
- **責務境界の整合性**: `BRAIN_LABELS` は `view-logic/health.mjs` に定義され、`settings-drawer.mjs` は `Object.keys(BRAIN_LABELS).map(...)` で `BRAIN_OPTIONS` を組み立てるのみで `src/mind/brains.mjs` を import しない。`cockpit-server.mjs` 側の `POST /api/brain` も `body.brain !== "claude" && body.brain !== "codex"` と頭 id を直書きしている（`brains.mjs` を import しない）。この「頭 id を各層が直書きする」規律は、既存の verbosity（quiet/normal/chatty を各層で直書き）と同型であり、Domain B の cockpit-server.mjs の規律とも一致している。整合性のある設計と判断した。
- **brain select の同期方式**: 一覧取得 API が無い固定2択のため `useEffect` で `settings.brain.brain` の変化に `brainSelected` を同期する設計。chat source のような「編集中は復元しない」ガードは無いが、「選ぶ→即 Set」という短いフローでは実害は小さいという評価は妥当（followup §C-3 に記録済み・non-blocking）。
- **資格情報**: `brainCredentialHealthLabel` は `credentialHealth` boolean を3分岐で文言化するのみで、パス・中身には一切触れない（health.mjs の実コードで確認）。blocking #4 の design 面は成立している。

---

## 7. 自分で実行した `node --test`

**全体（`apps/soul/agent`）**:
```
1..827
# tests 827
# pass 827
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1647.6608
```
ベースライン 814 → 827（+13）を独立再現できた。

**触った7ファイルの個別再実行**（報告書記載の数字との一致を確認）:
```
$ node --test src/mind/fire-orchestrator.test.mjs        → tests 66 / pass 66 / fail 0
$ node --test src/cockpit/cockpit-server.test.mjs        → tests 95 / pass 95 / fail 0
$ node --test src/cockpit/view-logic/transcript.test.mjs → tests 5  / pass 5  / fail 0
$ node --test src/cockpit/view-logic/usage.test.mjs      → tests 4  / pass 4  / fail 0
$ node --test src/cockpit/view-logic/health.test.mjs     → tests 8  / pass 8  / fail 0
$ node --test src/cockpit/view-logic/settings.test.mjs   → tests 11 / pass 11 / fail 0
$ node --test src/cockpit/cockpit-ui.test.mjs            → tests 38 / pass 38 / fail 0
```
すべて domain-c.md §2 記載の数字と完全一致した。Domain B レビュー（domain-b-design.md §9）で発見された「報告書の生ログが実際の実行結果と一致しない」問題は、Domain C の報告書には見られなかった。

エンドポイント数の実測（19）も `grep -c 'pathname === "/'` で自分で数え、報告書の主張と一致することを確認した。

---

## 8. non-blocking の気づき

1. **`cockpit-ui.test.mjs:454` および `cockpit-server.mjs:668` の `\ ★` / `\ ──` というコメント行頭の孤立バックスラッシュ**: Domain C の diff には現れず既存コード（他ドメイン由来）の記法だが、意図不明の記法として一応記録する。挙動に影響は無い（コメント行のため）。実害なし・Domain C 起因でもないため blocking ではない。
2. brain 札の意匠（`·` 区切り文字・`[brain]` の位置）と select 同期方式は、報告書 §7 のとおり Orch/人間ゲートでの確認事項として妥当に申し送りされている（followup §C-3, §C-4）。design レビューとしてはどちらも「変更は view-logic 側1箇所で閉じる」という局所性が担保されており、差し戻しコストは低いと評価する。

---

## 9. 質問

特になし。§C-1（in-flight 近似）・§C-3（select 同期方式）・§C-4（意匠）はいずれも Gnome 自身が non-blocking と自己評価し followup に記録済みで、design レーンの独立検証でもその評価は妥当と判断した。Orch 裁定が必要な論点（domain-b.md の `brainInitialChoice` 削除等）は本 Domain C には無い。

---

以上、design レーンとしては **PASS**。blocking #7（KILL/NG 弁の頭非依存）・blocking #6（additive のみ）ともに実コード精読・独立 diff 確認・独立 `node --test` 実行で成立を確認した。
