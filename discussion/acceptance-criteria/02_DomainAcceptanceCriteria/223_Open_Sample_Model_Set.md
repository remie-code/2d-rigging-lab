# DOMAIN-23: Future Clean Fixture and Sample Boundary

> Status: Future / out of current MVP except private rights-clean fixtures.
> Filename note: the historical filename is kept for link stability.

## 問い

将来、検証用fixtureや公開可能sampleを扱う場合、どの境界を別途設計すべきか。

## 方針

Current MVPはpublic sample model distributionを含まない。MVP内ではrights-cleanなprivate fixtureだけを使い、公開sample setはFuture Public Clean Subsetで再設計する。

### AC-SAMPLE-001: 権利的にクリーンなprivate fixtureを持てること

Private fixtureは、自作、生成、または明示許諾済み素材だけで構成されること。

### AC-SAMPLE-002: 最小fixtureを持てること

Private fixtureは、package load、runtime evaluation、viewer display、validator reportの最小検証に使えること。

### AC-SAMPLE-003: 機能別fixtureを将来候補として扱えること

Mesh、parameter、face、body、hairSway keyform、validation failureなどのfixtureは、必要に応じて段階的に追加できること。Full dynamics solver fixtureはPrivate Optional / Post-MVPである。

### AC-SAMPLE-004: validation failure fixtureを持てること

ValidatorとAI assistantの検証用に、意図的に壊れたprivate packageを持てること。

### AC-SAMPLE-005: fixture provenanceを記録できること

Fixtureの素材、作成手順、ライセンス、生成過程、編集履歴を記録できること。
