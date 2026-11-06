# Domain A 報告(Orch-Sylph)— 書き出し役の名前を soul から外す

- 判定: **合格**(1 周目で合格。やり直し 0 回)。
- 根拠: plan §2、設計 §4・§6、コード棚 §1・§4・§5。
- 実装: Gnome([domain-a-gnome.md](domain-a-gnome.md))。レビュー: Review-Sylph([../../reviews/memory-organization/domain-a.md](../../reviews/memory-organization/domain-a.md))。

## 機械ゲート
- `node --test`(apps/soul/agent): 着手前 2320/2320 → 後 2341/2341。
- `pnpm run check:soul-zone`: pass。
- 依存・lockfile の変更なし。

## 変えたファイル(apps/soul/agent/)
- 本体: `src/memory/memory-store.mjs`、`src/mind/memory.mjs`、`scripts/cockpit.mjs`(streamRecord の持ち回りだけ)、`src/memory/conventions-seed.md`(24 行目の 1 文)、`src/mind/fixtures/stream-wording-pin-expected.mjs`(`writer.request.*` と頭書き 1 行)。
- テスト: memory-store / memory / memory-garble / cockpit / cockpit-stream / cockpit-discord-f / cockpit-role-edit、呼ぶだけの 5 つ(baseName を外した)。

## B が使う git の口(memory-store.mjs・throw しない・dir 必須)
- `readCommitChangedFiles({ dir, commit = "HEAD", gitPath?, timeoutMs? })` → `{ ok: true, files: { status, path }[] } | { ok: false, error }`
- `readMemoryHead({ dir, gitPath?, timeoutMs? })` → `{ ok: true, head: string | null }`(コミットが無ければ null)
- `discardUncommittedChanges({ dir, gitPath?, timeoutMs? })` → `{ ok: true }`(`reset --hard HEAD` → `clean -f -d`、ignore は残す。HEAD が無ければ何もしない)
- `parseNameStatusZ(output)`(純関数)、`PREPARE_COMMIT_ROLE = "魂"`
- memory.mjs: `isMemoryBodyPath(path)`、`createStreamRecordLog({ startedAtMs })` → `{ dateJst, files(), note(paths) }`

## 裁量で決めたこと
1. 種のコミット: 「始める前に捨てる」で未コミットの種 `_conventions.md` が消えるため、`prepareMemoryFolder` は `_conventions.md` が HEAD に無ければ、それだけを `魂 <JST>` でコミットする。
2. コミットのファイル一覧が読めないときは書けたとみなし、固定の英語 1 行で警告する。
3. 捨てられなかったときは、固定の英語 1 行で警告して書き出しを続ける。捨てるのは最初の試行の前に 1 回だけ。
4. 消えた本体(`D`)は持ち回りから外さない(足さないだけ)。

## 残る点
- 範囲外の古いコメント(cockpit.mjs の main・createStreamVenueHooks の JSDoc、cockpit-server.mjs)。動きには関わらない。
- 同じ場で②が本体を動かすと、古いパスが次の頼みに残る。
- 捨てるのは強い(人の未コミットの手直しも消える)。設計 §6 の前提どおり。
- `stream-wording-pin-calls.mjs` に、使われない `baseName` が残る(触らない指定のため)。
