# Domain M 完了報告 — 判定の札を同じ場の中だけで結ぶ

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。止めない指摘のうちテストの抜け(4 点)だけ Gnome に戻して足した(実装は変えていない)。製品判断で止める質問は無い。見た目の好みの質問 1 つを §8 に上げる。
> Orch-Sylph(2026-11-03)。ブランチ `ai-cohost/discord-mode`(HEAD `c0d99235`)。コミットしていない。
> 子: Gnome(opus)`a060ec404c9eb0aa7`(実装 + テストの追補 1 回)、Review-Sylph(sonnet)`ad93b12954f7a40d3`。どちらも SubagentHandback で完了を返した(生き残りなし)。
> Gnome の報告 [domain-m-gnome.md](domain-m-gnome.md)(変更・裁量・追補の全文はここが正)、レビュー [../../reviews/discord-mode/domain-m.md](../../reviews/discord-mode/domain-m.md)。
> 原因と直し [gate-3-stale-judgment-chip.md](gate-3-stale-judgment-chip.md) §5、計画 [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain M。
> 鍵(`.env*.local`)は誰も読んでいない。実データ(`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`cockpit-settings.local.json`)に触れていない。操縦席・本物の Bot / LLM / 外部 API は起動していない(サーバのテストは loopback の本物の server に偽の耳・orchestrator・発火の予定。ロールの口を渡さない既存 A のテストと同じ組み方で、ファイルを書く口は無い)。依存・lockfile の差分 0。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2320 / 2320 pass**(土台 2303 から +17)。Gnome(2 回)・レビュー(2315 の時点)・Orch(追補のあと)で確認 |
| 根で `pnpm run check:soul-zone` | pass(1628 files)。Gnome・レビュー・Orch |
| `src/mind/`(stream pin と fixture を含む)・`scripts/`・`src/cockpit/cockpit-server.mjs` | 差分 0(Orch が `git diff` で確認) |
| 既存テストファイル | 差分 0(期待値の変更 0) |
| 改行 | 変更・新規とも CRLF(隣のファイルと同じ。レビュー確認) |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `src/cockpit/view-logic/glance-timeline.mjs`、`src/cockpit/ui/app.mjs`(初期化の 1 行)。
- テスト新規(17 件): `src/cockpit/view-logic/glance-venue-m.test.mjs`(15)、`src/cockpit/cockpit-server-discord-m.test.mjs`(2)。

## 3. 作ったもの(要約)

- **合図(サーバに何も足していない)**: `openStream` は正本を作り直す(seq が 0 に戻る)前に phase `"opening"` の SSE `state` を配る。会話の欄はこれを「新しい場が開いた」の合図にする。取り逃しの控えとして、閉じている・閉じかけを見たあとの `"open"` と、`openedAtMs` が前と違う `"open"` も新しい場とみなす。SSE は接続(つなぎ直しを含む)の最初に必ず `state` を 1 発配るので、つなぎ直しでも控えが働く。
- **状態**: GlanceState に場の番号 `venue` と場の印 `venueMark` を足し、行に `venue` を付けた。新しい場で前の場の `judgments` と `window` を捨てる(行は残す)。閉じた時点では捨てない。
- **結び付け**: `conversationRowsView` の seq での結び付け(判定の札・推論の範囲・`linkedSeq`・きっかけの行が手元にあるかの判定)を今の場の行だけにした。fireId で結ぶもの(causes・latencies・reacted・コメント反応)の鍵は変えていない。
- **開き直し**: `glanceFromHistory` が 3 つ目の引数に snapshot の `stream` を受け、`app.mjs` の初期化で渡す。前の場の履歴は閉じるときに正本ごと手放されるので snapshot に残らない(レビューがサーバのコードで確認)。
- **VC の抜け・入り・移り**: 変わるのは `connection` と `vcName` だけで、phase・`openedAtMs`・正本は変わらないので場は切り替わらない。
- **配信**: `openStream` は体験に依らない共通の段なので、同じ起動で配信を 2 回開いたときにも効く。1 つの場の中の表示は HEAD と同じ(レビューがリポジトリ外で 3000 通りの乱択の突き合わせで一致を確認)。
- **他の seq の結び付け**: ログのタブ(`rows.mjs` など)は判定を時系列の行として積むだけで、seq で結ぶ所は無かった。直していない。

## 4. 確かめ(テスト)

- view-logic: 開き直したあと同じ seq の新しい判定が「待つ」でも前の場の札が出ない/前の場の行に新しい場の札・推論の範囲・きっかけのつなぎが付かない/1 つの場の中の札・範囲・遅延・きっかけ・skip-interval は今と同じ/`glanceFromHistory` の経路/読み込み時が開きかけ/始められなかった場(opening → closed → opening → open)をはさむ通し/VC の移りで場が切り替わらない/控えの合図。
- App の SSE の口: `SSE_EVENT_NAMES` に `state` があること、購読のループと `JSON.parse` をソースの照合で固定し、初期化と購読の手順を写した再生器で場の切り替わりを確かめた(App 本体は描いていない。DOM の代わりが無く依存も足せないため、既存の作法に合わせた)。
- サーバ: 2 回目に開く段を止め、opening の `state` が新しい場の最初の行(seq 0 に戻った行)より先に届くこと、本物の SSE を `glanceAfterSseEvent` に流して seq 1 の判定が 2 回目の行にだけ付くこと、接続直後の 1 発目が `state` であることを固定した。

## 5. ループ

| 回 | 中身 | 結果 |
|---|---|---|
| 1 | Gnome 実装 → Review-Sylph | pass・止める指摘 0 |
| 補 | 止めない指摘のテストの抜け(読み込み時が opening・始められなかった場の通し・App を通した state・サーバの順序の固定)を Gnome に戻した | +5 件。実装の差分は変わらず。Orch が全テスト 2320 / 2320・zone・守りの差分 0 を再確認(テストだけの追補なのでレビューの再委任はしていない) |

## 6. 裁量(Gnome が決め、レビューが妥当と評価)

- 合図は SSE の `state` の phase `"opening"` を主、閉じたあとの `"open"`・`openedAtMs` の変化を控えにした(サーバに足さずに済んだ)。
- 前の場の札と範囲を捨てるのは新しい場が開いたとき(閉じた時点では捨てない。閉じたあとも直前の場の札は見える)。
- 開き直したあと、前の場の返事の行には、fireId で結んだきっかけを「きっかけの行が手元に無いとき」と同じく小さく出す(出さないと情報が消える)。変えるなら `conversationRowsView` の 1 か所の条件だけ。

## 7. 持ち越し(止めない)

1. つないでいない間に配られた `transcript` / `selfFire` の取りこぼし(行や札が抜ける)は既存の挙動のまま(Domain M では変えていない)。
2. 操縦席を再起動すると fireId が 1 から数え直しになり、再読み込みしていない画面では fireId の鍵が衝突しうる(既存・範囲外。レビューの指摘)。

## 8. 質問(Undine へ。止めない)

1. **開き直した瞬間、前の場の返事の行に小さなきっかけの札が出る見た目でよいか**(§6 の 3 点目)。何も出さない方がよければ 1 か所の条件で変えられる。人間ゲートで見て決めてよい。

## 9. 人間ゲートで見てほしい所

- 同じ起動で通話を開き直したあと、最初の発言(とくに前の場の札が出ていた seq と同じ番号)に前の場の札が出ないこと。ゲート 3 の取り違え(「応答 0.34」が付いているのに黙る)が再現しないこと。
- 開き直した瞬間の前の場の行の見た目(札が消え、返事の行にきっかけが小さく出る)。
- VC の抜け・入り・移りでは札が消えないこと。
