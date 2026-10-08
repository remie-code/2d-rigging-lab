# Runtime Player Wave Planning Conventions

> Runtime Player実装waveの計画に含めるべき共通事項。

## 1. Final Integration Documentation Alignment

Runtime Playerの各waveでは、final integration / closeout scopeに次を明示する。

```text
実装事実に合わせて関連ドキュメントを更新する。
```

ここでいう関連ドキュメントは、計画前のdiscussionでユーザーと合意したUX、設計、非目標、実装境界に対して、実装後に事実が変わった箇所である。

目的:

- 古いscreen docsやmapが次waveの判断を誤らせないようにする。
- 実装で明らかになった責務分離を外部記憶へ戻す。
- Root/Undine/Sylph/Gnomeが、古い仮説ではなく実装済み事実をbasisにできるようにする。

## 2. What To Update

Final integrationで確認する対象:

- `discussion/runtime-player/screens/**`
- `discussion/runtime-player/architecture/**`
- `discussion/runtime-player/research/**`
- `discussion/runtime-player/backlog/**`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- 各waveのreport / review map

ただし、すべてを機械的に編集する必要はない。実装事実やユーザー合意と矛盾する箇所だけを更新する。

## 3. Non-Goal

Final integrationは、未合意の新しいUX方針を勝手に決めない。

新しい仕様判断が必要な場合は、次wave前のdiscussion / planning-gateへ戻す。
