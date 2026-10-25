# 記憶の作り直し Wave 2 の仕上げ(2 点) 完了報告

> Gnome → Undine(2026-10-21)。依頼: Undine 裁定 2026-10-21(domain-c-report.md 質問 1・3、reviews/memory-recall/wave-2.md 注記 1・2)。プロジェクトのリポジトリにはコミットしていない。記憶の中身・会話本文はこの報告に書かない。質問 2(config/read 失敗の判定の定数化)は指示どおり今回は扱っていない(Wave 3)。

## 1. ②が書かずに答えたら、その場で 1 回だけやり直す(質問 3)

`apps/soul/agent/src/mind/memory.mjs` の `writeStreamRecord` を組み替えた。

- 1 回分(create → ask → dispose → commit)を内部の `runWriterOnce` に切り出し、最大 2 回まわす。やり直しは**新しい使い捨てセッション**で、**同じ頼みの本文**(同じ材料・頼む前に調べた既存の本体の一覧も同じ)を渡す。各回のあとにコミットする(役名「書き出し役」)。
- 書き損じの検出(`detectWriterMiss`):
  - 1 回目の保存(頼む前に今回の本体が無かった): 終わったあとも、どのトピックにも `<名前>.md` が無い(今までどおり)。目次だけ書かれてコミットがあっても、本体が無ければやり直す。
  - 2 回目以降の保存(頼む前に本体があった): `commitMemoryChanges` が `ok:true, committed:false`(変更なし)。
  - コミット自体が失敗(`ok:false`)したときは判断できないので、やり直さず「書けた」扱い(今までどおり。コミット失敗の警告は出る)。
- 1 回目で検出したら `onWarning("memory: the writer finished without writing this stream's record; retrying once")`(定数 `WRITER_MISS_RETRY_WARNING`)を出してやり直す。やり直しでもだめなら、今までの警告(`WRITER_MISS_WARNING`、文言は変えていない)を出し `{ written: false, missing: true, commit }` を返す。保存の係は今までどおり記録時刻・転写件数を進めない。
- ask の失敗(1 回目・やり直しのどちらも)はやり直さず、コミットしてから throw(今までどおり)。
- Ctrl+C の 90 秒の打ち切り: やり直しは `writeImpl` の中で走るので、既存の `raceMemoryRecordWithTimeout` が優先する(コードの変更なし)。`scripts/cockpit.mjs` は `SHUTDOWN_MEMORY_TIMEOUT_MS` のコメントに 1 行足しただけ。

## 2. 本体の番号の決まりを今の作りに合わせる(質問 1)

`_conventions.md` §2 の一文「同じトピックで同じ日に 2 回目があれば `<YYYY-MM-DD>-2.md` にします。」を、次に直した(3 か所とも同じ文)。

> 同じ日付の本体が既にあれば、どのトピックかに関わらず次の番号を付けます(`<YYYY-MM-DD>-2.md`、`<YYYY-MM-DD>-3.md`…)。

- `apps/soul/agent/src/memory/conventions-seed.md`(種)
- `discussion/ai-cohost/memory/conventions-draft.md`(本文の §2。「たたき台について」のメモ 65 行「`-2` は、うちの仮置き」は本文外なので触っていない → 質問 2)
- `apps/soul/agent/memories/_conventions.md`(本物の記憶のフォルダ)。`commitMemoryChanges({ dir: DEFAULT_MEMORY_DIR, role: "整備" })` でコミットした(変更は `_conventions.md` の 1 行のみ)。記憶のフォルダの git は **3 コミット**(移し替え前・移し替え・整備)、`status` は clean。

種と draft 本文の一致テスト(memory-store.test「種は conventions-draft の本文」)は通っている。

## 3. 変更ファイル

| ファイル | 中身 |
|---|---|
| `apps/soul/agent/src/mind/memory.mjs` | 書き損じの検出と 1 回だけのやり直し(`runWriterOnce`・`detectWriterMiss`・`warnSafely`、定数 `WRITER_MISS_WARNING`・`WRITER_MISS_RETRY_WARNING` を export)。冒頭コメントに 1 行 |
| `apps/soul/agent/src/mind/memory.test.mjs` | 偽物のコミットに「順番に返す」を足し、やり直しのテストを追加・既存 1 件を更新 |
| `apps/soul/agent/scripts/cockpit.mjs` | 90 秒の定数のコメントに 1 行(コードの変更なし) |
| `apps/soul/agent/src/memory/conventions-seed.md` | §2 の一文 |
| `discussion/ai-cohost/memory/conventions-draft.md` | 本文 §2 の一文 |
| `apps/soul/agent/memories/_conventions.md` | §2 の一文(記憶のフォルダの git にコミット済み) |

## 4. テスト

- 追加・更新(memory.test.mjs、偽物の頭・偽物のコミット):
  - 1 回目の保存: 書かない → やり直しも書かない → `written:false`・create/dispose/commit 各 2 回・警告は「やり直し」→「書けなかった」の順(既存のテストを更新)。
  - 1 回目の保存: 書かない → やり直しで書く → `written:true`・頼みの本文が 2 回とも同じ・コミット 2 回・警告は「やり直し」だけ。
  - 1 回目の保存: コミットはあるが本体が無い → やり直す。
  - 2 回目以降: 変更なし → やり直しで変更あり → `written:true`(頼みに既存の本体が載ったまま)。
  - 2 回目以降: 2 回とも変更なし → `written:false`。
  - 2 回目以降: 変更あり → やり直さない。
  - 2 回目以降: コミット失敗 → やり直さない(コミット失敗の警告だけ)。
  - ask 失敗 → やり直さない。やり直しの ask 失敗 → コミットしてから throw。
  - 本物の git の通しに続けて、2 回目の保存で何も書かない②を走らせ、2 回 ask・コミットは増えず・clean・`written:false`。
- `apps/soul/agent` で `node --test`: **1515 件すべて合格**(1507 → 1515)。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1513 ファイル)。
- 実機(本物の Codex)での確認はしていない(偽物の頭と本物の git での確認のみ)。

## 5. 境界

- 変更は上の 6 ファイルだけ。既存の未コミットの Wave 2 の変更は触っていない。依存の追加・環境変更なし。プロジェクトのリポジトリにはコミットしていない。
- 本物の記憶のフォルダは `_conventions.md` の 1 行だけを変え、「整備」のコミット 1 つにした。ほかのファイルは読んでも変えてもいない。

## 6. 残るリスク

- やり直しで②の所要が最大で倍(1 回 約 20〜40 秒)になる。Ctrl+C の時点で別の保存が走っていると、90 秒の枠に収まらず最後の保存が打ち切られうる(打ち切り優先は裁定どおり)。
- 2 回目以降の「変更なし」の判定は、②がフォルダの中を何も変えなかったときだけ効く。目次だけ直して本体を書き足さなかった場合は検出できない(魂は中身を判断しない方針のため)。
- 耳の Stop → Start で転写が入れ替わり、件数がたまたま同じでも保存はスキップされる(レビュー注記 3・変更なし)。

## 7. 質問

1. ②への頼みの本文の「このファイル名は魂が決めたもので、`_conventions.md` の `-2` の付け方よりこちらを優先します。」は、決まりが揃ったので不要になったが、保険として残した。外すか。
2. `conventions-draft.md` の「たたき台について」のメモ(本文外)にある「1 日に同じトピックで 2 回配信した場合の名前(`-2`)は、うちの仮置き。」は古くなった。直すか(Undine のメモなので触っていない)。
