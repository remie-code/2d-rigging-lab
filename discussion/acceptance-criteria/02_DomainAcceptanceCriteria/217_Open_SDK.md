# DOMAIN-17: Future SDK Boundary

> Status: Future / out of current MVP.
> Filename note: the historical filename is kept for link stability.

## 問い

将来、Private Prototypeの一部を外部アプリから利用する場合、どの境界を別途設計すべきか。

## 方針

Current MVPはFuture SDKを含まない。SDK、native SDK、game engine plugin、third-party integrationは、Future Public Clean Subsetまたは別途ユーザー判断で再開する。

### AC-SDK-001: Web / TypeScript SDKを将来候補として扱えること

将来検討時には、private runtime coreの外部利用境界をTypeScript APIとして切り出せるか評価できること。

### AC-SDK-002: model loading APIを将来候補として扱えること

将来検討時には、project-defined packageのload/unload/error boundaryを設計できること。

### AC-SDK-003: parameter control APIを将来候補として扱えること

将来検討時には、parameter値取得、設定、購読のAPI境界を設計できること。

### AC-SDK-004: rendering integration APIを将来候補として扱えること

将来検討時には、renderer adapterと外部アプリ描画loopの責務境界を設計できること。

### AC-SDK-005: validation / inspection APIを将来候補として扱えること

将来検討時には、runtime snapshot、diagnostics、validation reportを外部APIとして出す範囲を再レビューできること。
