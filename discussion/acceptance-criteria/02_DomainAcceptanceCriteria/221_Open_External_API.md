# DOMAIN-21: Future External API Boundary

> Status: Future / out of current MVP.
> Filename note: the historical filename is kept for link stability.

## 問い

将来、外部アプリやpluginからPrivate Prototypeを操作する場合、どのAPI境界を別途設計すべきか。

## 方針

Current MVPはFuture integration surface、plugin system、automation serverを含まない。AI assistantの内部operation contractはMVPに含むが、外部公開面とは分離する。

### AC-API-001: parameter送受信APIを将来候補として扱えること

将来検討時には、parameter値の取得、設定、購読、範囲確認を外部境界として設計できること。

### AC-API-002: model state取得APIを将来候補として扱えること

将来検討時には、model structure、runtime state、validation result、diagnosticsの外部公開範囲を設計できること。

### AC-API-003: expression / motion操作APIを将来候補として扱えること

将来検討時には、composition、timeline、placementなどの外部操作範囲を別途設計できること。

### AC-API-004: automation APIを将来候補として扱えること

将来検討時には、Editor / Viewer操作のautomation boundaryを別途設計できること。

### AC-API-005: WebSocket / HTTP / plugin境界を将来候補として扱えること

将来検討時には、通信方式、認可、plugin boundary、互換性表現を再レビューできること。
