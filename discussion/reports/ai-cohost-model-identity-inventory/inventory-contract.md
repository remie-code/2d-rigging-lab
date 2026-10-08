# AI Cohost Model Identity Inventory Contract

## 1. Defined action under audit

AI Cohostの魂名を固定の「コーディ」からモデル系列に属するidentityへ移し、少なくともClaude系列=`コーディ`、GPT系列=`チャッピー`として扱えるようにするための実装前inventoryを行う。

これは実装・設計決定ではない。現行repoの事実、影響範囲、既存判断、ユーザー判断が必要な前提を確定する。

## 2. Known user decisions

- 現状はClaude Code前提のため魂名がコーディで固定されている。
- GPT系列も選択可能になった。
- GPT系列の魂名はチャッピーにしたい。
- 今回はまずinventoryをシルフへ移譲する。

## 3. Questions not to decide

- 系列単位か個別model単位か。
- 名前をuser-editableにするかregistry-definedにするか。
- brain swap時に即時切替するか。
- 過去ログ・memoryの名前をsnapshot保持するか、現在名で再解決するか。
- prompt内の自己認識、persona、TTS/voiceまで同じidentityに含めるか。

これらはrepo事実では閉じない限り、ユーザー判断点として報告する。

## 4. Investigation rules

1. `discussion/_conventions.md`、`discussion/_map.md`、`discussion/ai-cohost/_map.md`を入口にする。
2. 重要主張はsource/test/package/Git/accepted artifactの`path:line`で裏付ける。
3. 次を分離する: accepted decision、current repository fact、historical evidence、inference、unresolved user decision。
4. `コーディ`、Cody、name/displayName/identity/persona/brain/model/provider等を検索するが、無関係な一般的`name`を無制限に読むことは避ける。
5. `apps/soul`特区、器→魂/魂→contract境界、既存brain swap/memory/privacy方針を維持する。
6. 調査のみ。source、test、既存map、既存reportを編集しない。
7. 各シルフは割り当てられた単一reportだけを`apply_patch`で作成する。stage/commitしない。
8. 他エージェントと同じworktreeで動くため、他者変更を戻さない。

## 5. Required report structure

1. Scope and entry points
2. Executive findings
3. Current data/control flow
4. Exact fixed values and owners
5. Existing extension points
6. Persistence and compatibility implications
7. Tests and verification surfaces
8. Risks and ambiguous semantics
9. Facts closable from repo
10. Premises requiring user decision
11. Evidence index and limitations

実装案は複数の成立可能な方向とtrade-offまでに留め、採用判断を行わない。
