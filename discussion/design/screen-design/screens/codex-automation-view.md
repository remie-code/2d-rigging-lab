# Codex / Automation View 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Codex / Automation Viewは、Codex proposal review、AI approval、AI transcript、structured command surface状態を扱うviewである。

## 2. レイアウト

```text
+--------------------------------------------------------------------------------+
| Codex / Automation                                                              |
+----------------------------+---------------------------------------------------+
| Automation Tools           | Tool Detail                                       |
| - Proposal Review          | pasted proposal / validation / diff / approval   |
| - AI Approval              | dry-run / approve / commit                       |
| - AI Transcript            | command and approval events                      |
| - Command Surface Status   | available structured surfaces                    |
+----------------------------+---------------------------------------------------+
```

## 3. 表示するもの

- Codex Proposal Review
- AI Approval
- AI Transcript
- structured command host availability
- Codex-facing structural parityの状態

## 4. 関連機能ID

- `UX-FEAT-030`
- `UX-FEAT-031`
- `UX-FEAT-032`
- `UX-FEAT-037`
- 一部 `UX-FEAT-018`, `UX-FEAT-019`, `UX-FEAT-028`, `UX-FEAT-029`

## 5. 未決事項

- 通常authoring UIの機能として見せるか、Codex/evidence専用viewとして扱うか。
- Codex-facing structural execute/stale parityをこのviewでどのように示すか。
