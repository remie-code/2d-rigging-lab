# Domain A 追撃修正 fix1 — fire-orchestrator.test.mjs の二段化(完了信号)

> 実装者: Gnome(サブエージェント委任・Orch-Sylph の追撃修正委任より)。
> 経緯: [domain-a.md](domain-a.md) §9.1 の申し送りを Orch-Sylph が受理し、「`fire-orchestrator.test.mjs` は src/mind/ 配下=Domain A の責務」と判定してスコープを 5 ファイル目まで拡張、追撃修正を委任した。
> 詳細は domain-a.md §10 に追記済み。本ファイルは完了信号。

## 1. 変更点の要約

`apps/soul/agent/src/mind/fire-orchestrator.test.mjs`(1 ファイルのみ):

1. `barge-in.mjs` から `BARGE_IN_GRACE_MS` を import 追加。
2. **:1406「結線: createBargeInGate 確定 → orchestrator.interrupt」**: `gateTimers.advance(200)`(第一段=ノイズ弁通過)の後に `gateTimers.advance(BARGE_IN_GRACE_MS)`(第二段=猶予満了・speechEnd 未着で発話継続)を追加。二段構え導入で `onConfirm`→`interrupt` に到達するタイミングが 200ms→200+2000ms に伸びたことへの追随。`interrupt(1300)` の中断時刻は advance 量と独立なので `result.replyText === "こん"` の assert は不変で通過。コメントも二段化の意図に追随させた。
3. **:1448「窓内 speechCancel は interrupt を呼ばず自然完了」**: 委任指示どおり実測で確認 → 二段構えでも第一段中(150ms)の `speechCancel` で弁が取り消され猶予段に入らないため無改変で通過。不要な改変なし。
4. cascade cancel されていた 15 テスト(kill/revive/ngBlocked/onSoulTranscript 系)は :1406 の解決で連鎖が解け自然回復。

**`fire-orchestrator.mjs`(SOURCE)は不変**(本番の gate 結線は cockpit-server.mjs=Domain B。テスト側のみが gate を構築)。barge-in.mjs / fire-scheduler.mjs / barge-in.test.mjs / fire-scheduler.test.mjs は追撃修正では追加変更なし(既に緑)。

## 2. node --test 生サマリ(自分で実行)

### fire-orchestrator.test.mjs 単体

```
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 177.7964
```

### apps/soul/agent 全体(`node --test`)

```
# tests 863
# suites 0
# pass 863
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1779.9092
```

**全緑到達**: 追撃修正前 `pass 846 / cancelled 17` → 追撃修正後 `pass 863 / cancelled 0`・fail 0。

## 3. git diff --stat 生出力(5 ファイル)

```
$ git diff --stat -- apps/soul/agent/src/mind/barge-in.mjs apps/soul/agent/src/mind/barge-in.test.mjs apps/soul/agent/src/mind/fire-scheduler.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs apps/soul/agent/src/mind/fire-orchestrator.test.mjs
 apps/soul/agent/src/mind/barge-in.mjs              | 150 ++++++++++--
 apps/soul/agent/src/mind/barge-in.test.mjs         | 271 ++++++++++++++++++++-
 .../soul/agent/src/mind/fire-orchestrator.test.mjs |  10 +-
 apps/soul/agent/src/mind/fire-scheduler.mjs        | 187 ++++++++++++--
 apps/soul/agent/src/mind/fire-scheduler.test.mjs   | 246 +++++++++++++++++++
 5 files changed, 802 insertions(+), 62 deletions(-)
```

`git status --porcelain apps/soul/agent/` の生出力(スコープ内変更が 5 ファイルのみであることの確認):

```
 M apps/soul/agent/src/mind/barge-in.mjs
 M apps/soul/agent/src/mind/barge-in.test.mjs
 M apps/soul/agent/src/mind/fire-orchestrator.test.mjs
 M apps/soul/agent/src/mind/fire-scheduler.mjs
 M apps/soul/agent/src/mind/fire-scheduler.test.mjs
```

## 4. 裁量/質問

- **裁量**: :1448 の窓内 speechCancel テストは「必要なら最小限だけ追随」との指示だったが、実測で無改変のまま緑だったため一切変更しなかった(第一段中の speechCancel は二段構えでも弁を取り消すので論理が保たれる)。fire-orchestrator.test.mjs の diff は「10 行変更(import 1 行 + :1406 の advance/コメント)」に留めた。
- **質問・不確実点**: なし。domain-a.md §9.2 に記載した不確実点(猶予中の新 speechStart の扱い・合いの手再武装形の base=refractory×2 依存・interjection の vision:"preferred" マッピングの Domain B 検証)は追撃修正で変わらず有効。人間ゲート(朗読実射)と Domain B のレビューでの確認を引き続き期待する。
- **install/commit なし・依存不変**(import は既存モジュール間の barge-in.mjs → fire-orchestrator.test.mjs のみで、外部依存は増えていない)。KILL/NG 検問所・転写到着ゲート(armed)機構は不変。
