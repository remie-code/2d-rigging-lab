# シナリオ: Future SDK Boundary

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/217_Open_SDK.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/217_Open_SDK.md)
> Status: Future / out of current MVP.
> Filename note: historical filename retained for link stability.

## 0. 目的

SDK workをCurrent MVPから分離し、将来再開する場合の境界だけを記録する。

## SC-SDK-001: SDK要望をFuture扱いへ分類できる

### Given

- 外部アプリからprivate runtime coreを使いたい、という要望が出ている。

### When

1. ReviewerがMVP ACとこのscenarioを確認する。
2. Reviewerがprivate authoring-to-viewerに必須か分類する。

### Then

- SDK、native SDK、game engine pluginはCurrent MVP外である。
- 再開する場合はFuture Public Clean Subsetまたは別途ユーザー判断として扱う。

### 検証するAC

- AC-SDK-001
- AC-SDK-002
- AC-SDK-003
- AC-SDK-004
- AC-SDK-005
