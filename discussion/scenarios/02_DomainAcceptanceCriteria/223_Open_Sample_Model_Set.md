# シナリオ: Future Clean Fixture and Sample Boundary

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/223_Open_Sample_Model_Set.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/223_Open_Sample_Model_Set.md)
> Status: Future / out of current MVP except private rights-clean fixtures.
> Filename note: historical filename retained for link stability.

## 0. 目的

Public sample distributionをCurrent MVPから分離し、MVP内ではrights-clean private fixtureだけを扱う。

## SC-SAMPLE-001: private fixtureを作れる

### Given

- 自作、生成、または明示許諾済み素材がある。

### When

1. ユーザーがprivate fixture packageを作成する。
2. Validatorがrights/provenanceとpackage loadを確認する。

### Then

- FixtureはMVP検証に使える。
- 公開配布前提ではない。

### 検証するAC

- AC-SAMPLE-001
- AC-SAMPLE-002
- AC-SAMPLE-005

## SC-SAMPLE-002: public sample要望をFuture扱いへ分類できる

### Given

- Sample distribution、catalog、external tutorial assetの要望がある。

### When

1. Reviewerがdemo/proposal hygieneとFuture Public Clean Subset方針を確認する。
2. Reviewerがprivate fixtureと公開sampleを分類する。

### Then

- Public sample distributionはCurrent MVP外である。
- 公開する場合は別途rights review、dependency review、naming reviewを行う。

### 検証するAC

- AC-SAMPLE-003
- AC-SAMPLE-004
