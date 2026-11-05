# Domain B 直し(ループ 2・Gnome)— 先頭が動いたら走る前の先頭へ戻す

- 根拠: Review-Sylph の要修正 1 点([../../reviews/memory-organization/domain-b.md](../../reviews/memory-organization/domain-b.md))、設計 §6。
- 文面(systemPrompt・頼み)は変えていない。ほかの動きも変えていない。コミットなし・依存の変更なし。

## 直したこと
1. `src/memory/memory-store.mjs` に、走る前の先頭へ戻す口を足した。
   - 署名: `resetMemoryToCommit({ dir: string; commit: string; gitPath?; timeoutMs? }) → Promise<{ ok: true } | { ok: false; error: string }>`
   - 中身: `reset --hard --quiet <commit>` → `clean -f -d --quiet --`。`.gitignore` されたものは残す。
   - `commit` は `HEAD` か 16 進のハッシュだけを受ける(既存の `checkCommitTarget` を使う)。throw しない・`dir` 必須・`.git` が無ければ git を呼ばない。
2. `src/mind/memory-organizer.mjs`: 頼んだあとの後始末を、すべて走る前の先頭 `beforeHead` への `resetMemoryToCommit` に替えた(`discardAndSkip` を `rollBackAndSkip` に替えた)。戻せなければ `cleanupFailed: true` と警告 `memory: could not discard the organiser's changes`。差し替え口 `resetImpl` を足した。
3. 警告の文を `memory: organiser rejected: the memory folder's git head moved; rolled back, not committed` に直した。固定のテストも手で直した。
4. JSDoc と頭書きを今の動きに合わせた。domain-b-gnome.md の裁量 3・質問 1・警告の行・口の一覧も直した。

## 裁量
- **ほかの失敗の後始末も同じ戻し方にした**: ask-failed・timeout・aborted・guard-bodies-changed・guard-unreadable・commit-failed のすべて。
  - 先頭が動いていなければ、`reset --hard <走る前の先頭>` は未コミットの変更を捨てるのと同じになる。
  - 動いていれば(頭が `git commit` してから失敗した・打ち切られた)、そのコミットも残さない。
  - commit-failed で魂のコミットが途中まで積まれていた場合(rev-parse の失敗など)も戻るので、時刻は進まない。
- **走る前の先頭が null の場合**: 来ない。先頭が読めない・null なら 3 の段で `snapshot-failed` になり、それまでは何も触っていないので戻さない。仮に来ても戻さず `cleanupFailed: true` にする(コードで守っている)。
- 始める前の捨てる(1 の段)は今どおり `discardUncommittedChanges` を使う。

## テスト
- `node --test`(apps/soul/agent): 2396 → **2401 / 2401 pass**(+5)。
  - 先頭の変化のテストを 2 本にした(頭のコミットの本文が `head commit` のときと `整理役 2026-11-05 14:00:00 +09:00` のとき)。確かめていること:
    - HEAD が走る前の先頭に戻る
    - `git log` に頭のコミットが無い
    - 作業ツリーが走る前と同じ(本体・目次・`_conventions.md`・棚のフォルダや書きかけが無い)
    - `整理役 ` のコミットが無い
    - due が `never` のまま
    - 控えに走る前の先頭がある
  - 足したテスト: 頭がコミットしてから ask が失敗する(ask-failed)場合と、頭がコミットしてから打ち切る(aborted)場合。どちらも同じく戻ることを確かめる。
  - 後始末の失敗のテストは `resetImpl` で失敗させる形に直した。戻す先が走る前の先頭であることも確かめる。
  - `memory-store-organizer.test.mjs` に `resetMemoryToCommit` のテストを 2 本足した:
    - 後ろのコミット・未コミットの変更・追跡外を消し、ignore されたものは残す
    - 形の誤り(`--hard`・`-x`・`main`・空・`HEAD~1`・省略)と `.git` が無いときは git を呼ばない。無いコミットは git が断り、先頭は変わらない
- `pnpm run check:soul-zone`: **pass**。
- 参考: 新しいファイルを `tsc --strict --checkJs` にかけても、エラーは出ない。

## 質問
- なし(domain-b-gnome.md の質問 2・3 は残っている: 打ち切りの警告が C の 1 行と重なるか・文面の確認待ち)。
