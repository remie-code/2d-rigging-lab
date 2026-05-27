# シナリオ: Future External API Boundary

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/221_Open_External_API.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/221_Open_External_API.md)
> Status: Future / out of current MVP.
> Filename note: historical filename retained for link stability.

## 0. 目的

Future integration surface、plugin system、automation serverをCurrent MVPから分離し、AI assistantの内部operation contractと混同しないようにする。

## SC-API-001: integration surface要望をFuture扱いへ分類できる

### Given

- 外部client、WebSocket、HTTP endpoint、plugin boundaryの要望がある。

### When

1. ReviewerがMVP ACとAI assistant designを確認する。
2. Reviewerが内部operation contractと外部公開APIを分類する。

### Then

- Current MVPに含むのはAI assistantのdry-run / diff / repair suggestion boundaryである。
- External API、plugin、automation serverはFuture / separate designとして扱う。

### 検証するAC

- AC-API-001
- AC-API-002
- AC-API-003
- AC-API-004
- AC-API-005
