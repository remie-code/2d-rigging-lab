# シナリオ: Future Streaming App Boundary

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/219_Open_VTuber_App.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/219_Open_VTuber_App.md)
> Status: Future / out of current MVP.
> Filename note: historical filename retained for link stability.

## 0. 目的

配信用アプリ、tracking、OBS outputをCurrent MVPから分離し、Streaming Demo Surfaceとは別の将来設計として扱う。

## SC-VTUBER-001: streaming app要望をFuture扱いへ分類できる

### Given

- Tracking、expression hotkey、OBS output、配信用stageの要望がある。

### When

1. ReviewerがMVP AC、demo policy、このscenarioを確認する。
2. Reviewerがprivate viewer captureで足りるか、配信用アプリ設計が必要かを分類する。

### Then

- Current MVPはprivate viewerとdemo-safe captureまでで成立する。
- Future streaming app、OBS output、tracking appはFuture / separate designとして扱う。

### 検証するAC

- AC-VTUBER-001
- AC-VTUBER-002
- AC-VTUBER-003
- AC-VTUBER-004
- AC-VTUBER-005
