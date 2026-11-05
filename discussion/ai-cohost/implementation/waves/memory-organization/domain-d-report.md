# Domain D 報告(Orch-Sylph)— サブトピックと月の目次・上限の撤去

> 2026-11-05。仕様: [../../orchestration/memory-organization-wave-plan.md](../../orchestration/memory-organization-wave-plan.md) §4b。
> Gnome の報告: [domain-d-gnome-report.md](domain-d-gnome-report.md)。レビュー(整理役の頼みの全文と②④の変えた行あり): [../../reviews/memory-organization/domain-d.md](../../reviews/memory-organization/domain-d.md)。

## 判定

**pass**(1 周目)。Gnome(opus)が実装し、Review-Sylph(sonnet)が pass と判定した。

## 機械ゲート

- `apps/soul/agent` で `node --test`: 2433 / 2433 pass(土台 2428 から +5)。Gnome と Review-Sylph がそれぞれ走らせた。
- リポジトリの根で `pnpm run check:soul-zone`: pass。
- 依存と lockfile は変わっていない。

## 変えたこと(apps/soul/agent/)

- `src/mind/memory-organizer.mjs`
  - 定数 `ORGANISER_REQUEST` を純関数 `buildOrganiserRequest(dateJst)` に替えた。
  - 日付は整理の始めに注入された時計を 1 回読み、既存の `formatJstDate` で作る。控えの名前にも同じ時刻を使う。
  - 待つ上限に関わるものを外した: `askTimeoutMs`・`DEFAULT_ORGANISE_ASK_TIMEOUT_MS`・`MAX_TIMEOUT_MS`・`"timeout"` の道・`ORGANISER_TIMEOUT_WARNING`・setTimeout の競争。
  - 打ち切り(`abort()` / `signal`)は残した。systemPrompt は変えていない。
- `src/mind/memory.mjs` 204 行: ②の手順 4 だけ。
- `src/mind/recall.mjs` 123 行: ④の手順 2 だけ。
- `scripts/cockpit.mjs`: `createMemoryOrganiserRunner` から `askTimeoutMs` の口と JSDoc を外した。本番の呼び出しはもともと渡していない。
- テスト
  - `memory-organizer-wording-pin.test.mjs`・`fixtures/stream-wording-pin-expected.mjs`: 期待値を新しい文面に直し、冒頭に 2026-11-05・ユーザー OK・Domain D の 1 行を足した。
  - `memory-organizer.test.mjs`: timeout のテストを外した。次の 3 件を足した。
    - 365 日待っても決着せず、abort で止まる。
    - 頼みの待ちに setTimeout を使わない。
    - 日付が JST になる(UTC 2026-12-31 15:00 → 2027-01-01)。
  - `recall.test.mjs`・`memory.test.mjs`・`cockpit-organiser-c.test.mjs`: 新しい文面と、上限を渡さないことに合わせた。

## 文面の照合

- 整理役の頼み: 計画の 96〜115 行(行頭 3 文字を外したもの)と、`buildOrganiserRequest("${dateJst}")` の出力が byte 単位で一致する(3204 bytes)。Gnome と Review-Sylph が照合し、Orch-Sylph も node でもう一度照合した。
- ②の手順 4 と④の手順 2 は、§4b-2・§4b-3 の文面と一致する。ほかの行は変わっていない。

## 下の層の上限(§4b-4)

整理役の頭は Codex(`resolveWriterBrainDef` → `brains.mjs` → `codex-session.mjs`)。ask の turn の完了待ちにタイマーは無く、turn/completed か失敗でだけ決着する(`await terminal`・codex-session.mjs 1170 行付近)。このため codex-session.mjs は変えていない。

上限が掛かるのは次のものだけで、どれも頼みの完了待ちではない。

- `rpcTimeoutMs`(既定 15 秒): RPC の応答だけ(initialize・thread/start・turn/start の応答)。
- 圧縮の上限: 圧縮は①からしか呼ばれない。
- dispose のときの片付け。

①②④の上限は変えていない。

## 裁量判断(Gnome・Orch-Sylph は妥当と判断)

1. 頼みは関数だけにして、日付の無い定数は残していない。日付の無い頼みを誤って使わせないため。
2. 時計は整理の始めに 1 回読み、頼みの日付と控えの名前の両方に使う。前は控えを作るときに読んでいたので、差はミリ秒だけ。コミットの時刻は今どおりコミットの直前に読む。
3. `askTimeoutMs` を渡されても、型の誤りにはせず無視する。

## 軽微な所見と残リスク

- `cockpit-organiser-c.test.mjs:768` の「渡されても通さない」のテストは、runner が `askTimeoutMs` を読まないことを見ているだけ(レビュー所見・実害なし・直していない)。
- Codex の App Server(soul の外のプロセス)自身に上限があるかは、ここでは確かめられない。あった場合は ask-failed になり、走る前の先頭へ戻る。
- 頭が決着しないまま固まると、Ctrl+C まで「整理中」のままになる。これは設計どおり(上限なし)。

## 守ったこと

- 一発の移行のためのコードは入れていない。`conventions-seed.md` は D では変えていない(差分は A の 1 行だけ)。
- 未コミットの A〜C の変更はそのまま残した。git のコミット・ブランチ操作はしていない。
- 実データに触れていない。操縦席を起動していない。本物の LLM・外部 API を呼んでいない。

## 質問

なし。
