# シナリオ: Demo and Proposal Hygiene

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/225_Open_Source_and_Rights_Hygiene.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/225_Open_Source_and_Rights_Hygiene.md)
> Status: Accepted draft for Private Prototype MVP hygiene track.

## 0. 目的

このシナリオは、Private Prototypeを配信デモやLive2Dへの機能提案に使うとき、private実装本体、demo surface、proposal、将来公開subsetを混同しないためのhygieneを検証する。

## 1. Source-of-Truth

### Repository Facts

- 現在の正はPrivate Prototypeである。
- Streaming Demo SurfaceとLive2D Feature Proposalは、private実装本体から分離した別trackである。

### Design Decisions

- Demoでは、rights-clean素材、private viewerの見た目、一般語彙だけを見せる。
- Proposalでは、互換実装、形式対応、SDK/Core代替を示唆しない。
- 将来公開subsetは現在MVP外であり、公開前に別途権利・依存・文言reviewを必要とする。

### Research Notes

- 旧公開OSS優先前提のscenarioはsupersededである。
- 過去調査資料はprivate research archiveであり、公開配布物やdemo素材にはしない。

## SC-HYGIENE-001: streaming demo preflightを通せる

### Given

- ユーザーはPrivate Prototypeのviewer sceneを配信または録画で見せたい。

### When

1. ユーザーがdemo-safe preflightを実行する。
2. Validatorが素材、provenance、UI文言、ファイル名、表示パネル、capture範囲を確認する。
3. ユーザーがwarningを解消または非表示範囲に移す。

### Then

- Demoにはrights-cleanでdemo表示可の素材だけが含まれる。
- 内部形式、外部形式名、SDK/Core連携、既存モデル読み込みを示唆する画面は出ない。
- Viewer表示にはprivate prototypeであり互換ツールではない旨の短いdisclaimerを添えられる。

### 検証するAC

- AC-RIGHTS-001
- AC-RIGHTS-002
- AC-RIGHTS-005

## SC-HYGIENE-002: Live2Dへのproposal packageを作れる

### Given

- ユーザーはPrivate Prototypeで得た観察を、Live2Dへの機能要望として整理したい。

### When

1. ユーザーがproposal templateに沿って問題、望む体験、prototype観察、非目標を書く。
2. Reviewerが互換実装や形式対応を示唆する文言を確認する。
3. Demo素材とproposal本文を分けて保存する。

### Then

- Proposalは「こういう編集体験が欲しい」という要望に留まる。
- Private Prototypeの内部形式や実装詳細を公開前提にしない。
- 法的安全性や特許クリアを断言しない。

### 検証するAC

- AC-RIGHTS-003
- AC-RIGHTS-004

## SC-HYGIENE-003: Future Public Clean Subsetを現在MVPから分離できる

### Given

- 将来、一部成果物を公開可能にする案が出ている。

### When

1. Reviewerが公開候補をcode、docs、sample、fixture、demo mediaに分類する。
2. Reviewerがrights/provenance、依存、名称、外部形式示唆、third-party素材混入を確認する。
3. 公開候補をFuture Public Clean Subsetとして別trackへ移す。

### Then

- 現在MVPの成功条件はpublic配布を要求しない。
- 公開候補は、公開前reviewが完了するまでprivate project成果物として扱う。
- 不明素材や外部由来の混入はNeeds reviewまたはFailになる。

### 検証するAC

- AC-RIGHTS-001
- AC-RIGHTS-005

## 2. 未決事項

- Demo-safe preflightの自動検査対象に含めるUI panel一覧。
- Proposal提出先、提出形式、公開範囲。
- Future Public Clean Subsetを設計し始める条件。
