# Domain A レビュー(Review-Sylph)

**判定: 合格**(ブロッカーなし)

## 機械ゲート
- `node --test`(apps/soul/agent): **2341 / 2341 pass**、fail 0(土台 2320 から +21)。
- `pnpm run check:soul-zone`: pass(1628 ファイル)。
- 依存・lockfile の変更なし。

## 確認結果
1. **範囲**: 変更は plan §2 の許可ファイル(memory.mjs / memory-store.mjs / cockpit.mjs / conventions-seed.md / pin expected / 各テスト)だけ。cockpit.mjs は import・typedef・`createRecordLogImpl`・`streamRecord: ...({ startedAtMs })`・`record: place.streamRecord` のみ。`stream-wording-pin-calls.mjs`・`recall.mjs`・`skills/recall.md` は未変更。
2. **文面(機械照合)**:
   - plan §2.5 の 2 行を plan 本文から読み出して比較。ファイル名の行は新しい場・続きの場とも一字一句一致(全角（）、`_conventions.md` の実バッククォート)。続きの場の行は `${files}` を `, ` で並べた形で一致。
   - HEAD の pin 期待値との差は `writer.request.new` で 1 行、`writer.request.existing` で 2 行(ファイル名の行と続きの行)だけ。新しい場の行・日付・手順・材料は同一。
   - pin の全 35 キーのうち差があるのは `writer.request.new` / `.existing` の 2 つだけ。それ以外(writer.systemPrompt・writer.transcript・recall.*・fire.* 等)は HEAD とバイト一致。冒頭の例外 1 行(日付と根拠入り)あり。`buildWriterRequest` の出力が pin と一致。
3. **種**: 差分は本体のファイル名の 1 文のみ。plan §2.6 の文言どおり。
4. **挙動**(temp の git で実走させて確認):
   - `readCommitChangedFiles`: 日本語名・空白入りパス(`ゲーム/2026/11/日記 1.md`)が壊れない。ルートコミットが動く。`.git` なし・`dir` なしは失敗で返し throw しない。
   - `readMemoryHead`: コミットありはハッシュ、未生成 HEAD は `head:null`。
   - `discardUncommittedChanges`: 追跡済みの変更は戻り、追跡外と `git add` 済みの新規は消え、ignore されたものは残る。未生成 HEAD は no-op。
   - `prepareMemoryFolder`: 種の `_conventions.md` だけを `魂 <JST>` でコミット(pathspec)。その後に discard しても種は残る。
   - `detectWriterMiss`: committed:false → miss。本体 A/M が無ければ miss。一覧失敗・コミット失敗は書けた扱い。
   - 蓄積: ask 失敗の回のコミットも note してから throw。化けで revert した回は note しない。revert 失敗の回は残るので note する。
   - discard は最初の試行の前に 1 回だけ。失敗は固定英語 1 行の警告で続行。化けの検査は書き出し役のコミットに今までどおり掛かる。
   - 削除した 3 関数(`resolveStreamRecordBaseName` / `findStreamRecordFiles` / `createStreamRecordIdentity`)は src/ と scripts/ に呼び出し元なし。残るのは「無いこと」を確かめるテスト 2 か所だけ。
5. **ルール**: テストの git は tmpdir 配下(cockpit.test.mjs の `memories` も `mkdtemp` の下)。実データのフォルダ・`.env*` への参照なし。実 LLM・API 呼び出しなし。新しい警告 2 つ(`WRITER_CHANGED_FILES_FAILED_WARNING` / `WRITER_DISCARD_FAILED_WARNING`)は固定英語で、名前・id・本文なし。

## 非ブロッカーのメモ
- `stream-wording-pin-calls.mjs:77,82` は不要になった `baseName:` を渡したまま。分割代入で無視されるので動作に影響なし。plan で触らない指定なので正しい。
- `D` の経路は `files()` に入らない(`A`/`M` のみ)。plan どおり。整理役が本体を動かした後でも、次の場では持ち回りがリセットされるので影響なし。
- discard は `reset --hard` + `clean -fd`(`-x` なし)。plan §2.1 の仕様どおりで強さは適切。ただし「ユーザーが記憶フォルダを手で編集中の未コミット変更」も消える。plan §2.4 の意図どおりなので Domain A ではブロッカーではない。C の結線時に注意。
- 一時コミットの `魂` は既存の `buildCommitMessage` を使用。B が「最後の `整理役 ` コミット」を探す際、`魂` コミットは無関係で干渉しない。
- 実装者が挙げた「範囲外の古いコメント」は、今回の差分では見つからなかった。

## 質問
なし。
