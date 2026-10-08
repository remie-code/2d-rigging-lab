---
name: discussion-management
description: "Use when: creating or updating discussion/_conventions.md, discussion/_map.md, or a discussion memory structure; deciding where discussion artifacts belong; keeping official facts, repository facts, assumptions, decisions, experiment results, and unresolved questions separate; persisting and restoring the root orchestrator's context across sessions and compaction."
---

# discussion-management

Use this skill to design and maintain `discussion/` as external memory for agents.

This skill is not about making tidy Markdown. Its purpose is to help future agents restore context: what exists, what was decided, what is still uncertain, and which files should be read next.

## Essence

`discussion/` is **durable external memory for the root orchestrator: the persistence and restoration of your context.**

Your context is the scarce, protected asset of a large task — it holds the whole picture, the accepted decisions, and the user's intent. Chat history and model context are temporary; they die at session end and thin out under compaction. `discussion/` is how you carry that judgment basis forward, so a future session or another agent can rebuild it instead of losing it.

Restoration only works without polluting the restorer's context if you obey one structural principle:

> **Separate information-bearing files from navigation files.**
>
> - **Artifact files** hold the actual information — decisions, research, design, experiment results.
> - **Navigation files** (`_map.md`, `_conventions.md`) hold only the wiring: links, status, one-line descriptions, next actions, and unresolved questions. They must **never** carry the full content.
>
> Why separate them: reading `_map.md` should let an agent decide **what to read next**, then fetch only the artifacts it actually needs. If the map carries the details, the restorer is forced to ingest everything just to orient — and that ingestion is exactly the context pollution this structure exists to prevent. The map is the 導線 (the guide-line); the artifacts are the payload. Keep the guide light so it can guide.

Everything below is the procedure that instantiates these two layers for a specific task.

## Core Values

### External Memory

Chat history and model context are temporary. `discussion/` is durable external memory for future sessions and other agents.

### Task-Specific Memory Structure

Do not assume one fixed directory structure fits every task.

For a new task, discuss with the user what topics and memory areas are needed. Then record the agreed structure in `discussion/_conventions.md` and the current map in `discussion/_map.md`.

Existing examples, such as `research/`, `design/`, `experiments/`, and `drafts/`, are examples only. Use them when they fit the task; do not force them when they do not.

### Mutable Conventions

`_conventions.md` does not need to be perfect at the beginning. If the work reveals a new topic or memory area, update `_conventions.md` after reaching agreement with the user.

### Separate Information Types

Keep these distinct:

- Official facts
- Repository facts
- Assumptions
- Design or policy decisions
- Experiment results
- Unresolved questions

Do not write uncertain information as if it were settled.

### Unresolved Questions Are Useful Memory

Unresolved questions and user-decision points help future agents recover the current state. Record them explicitly.

### Do Not Create Handover Documents Spontaneously

Dedicated handover documents are special artifacts created only when the user explicitly asks for them. Normally, `_map.md` plus focused artifact files should be enough to restore context.

## When To Use

Use this skill when:

- `discussion/_conventions.md` does not exist
- `discussion/_map.md` does not exist
- A new task needs a memory structure
- A new topic or directory needs to be added
- An artifact exists but cannot be found from `_map.md`
- Facts, assumptions, decisions, and experiment results are getting mixed together
- Another agent or future session would have trouble restoring context

## Workflow

### 1. Check The Entry Points

First look for:

```text
discussion/_conventions.md
discussion/_map.md
```

If they exist, follow them before exploring broadly.

If they do not exist, do not invent a fixed directory structure immediately. First discuss the needed memory structure with the user.

### 2. Agree On The Memory Structure

Ask what kinds of records this task needs.

Example question:

```markdown
What kinds of records should be separated for this task?

1. Official sources and research results
2. Policy or design decisions
3. Experiment protocols and measurements
4. Drafts before real config or implementation files
5. Other task-specific records
```

The goal is not to choose perfect category names. The goal is to make future agents know where to look.

### 3. Create Or Update `_conventions.md`

Record the agreed memory structure.

Include at least:

- Purpose of the discussion structure
- Directory structure
- Meaning of each directory
- Owner or primary users of each directory
- File naming rules
- Role of `_map.md`
- Rules for separating information types
- How to add new topics later

### 4. Create Or Update `_map.md`

`_map.md` is a lightweight map and link index. It is not the place for full decisions, full research notes, or full design text.

Detailed content belongs in dedicated artifact files. `_map.md` should contain links, status, short descriptions, next actions, and unresolved questions.

Avoid context pollution: reading `_map.md` should help an agent decide what to read next, not force it to ingest every detail.

### 5. Place Artifacts In The Agreed Memory Structure

Put artifacts in the area that matches their purpose.

If no area fits, do not force it. Discuss the new topic with the user, update `_conventions.md`, then place the artifact.

## `_conventions.md` Template

````markdown
# Discussion Conventions

> Agreed rules for discussion/ file structure, naming, and map behavior.

## 1. Purpose

This discussion structure exists to preserve external memory for {task-name}, so future agents and sessions can restore context.

## 2. Directory Structure

```text
discussion/
  _conventions.md
  _map.md
  {topic-a}/
  {topic-b}/
```

## 3. Directory Meanings

| Path | Role | Primary users |
|---|---|---|
| `{topic-a}/` | ... | ... |
| `{topic-b}/` | ... | ... |

## 4. File Naming

- Prefer meaningful English kebab-case names.
- Use leading `_` for meta files such as maps and conventions.

## 5. Information Separation

Keep official facts, repository facts, assumptions, decisions, experiment results, and unresolved questions separate.

## 6. Adding Topics

When a new memory area is needed, agree with the user and update this file.
````

## `_map.md` Template

```markdown
# Discussion Map

> Lightweight map for discussion/ under {task-name}.

## Entry Points

- Conventions: [_conventions.md](_conventions.md)
- Initial reference: ...

## Directories

| Path | Role | Status |
|---|---|---|
| `{topic-a}/` | ... | Not created / Created |
| `{topic-b}/` | ... | Not created / Created |

## Key Files

| Path | Content |
|---|---|
| [topic-a/example.md](topic-a/example.md) | One-line description. Details live in the linked file. |
| [topic-b/example.md](topic-b/example.md) | One-line description. Details live in the linked file. |

## Current State Summary

- Keep this short.
- Do not paste full decisions, research notes, or design text here.
- Use this map to decide which file to read next.

## Next Actions

1. ...
2. ...

## Unresolved Questions

- ...
```

## Example: Runtime Player

This workspace's `discussion/runtime-player/` is a live instantiation of this skill:

```text
discussion/runtime-player/
  _map.md                       # top navigation for the whole Runtime Player memory
  screens/                      # shared understanding: what to build
    _map.md                     #   navigation over screen docs
    initial-runtime-player-screen.md, ...   # artifacts (the actual agreed UX)
  architecture/                 # technology stack / development policy decisions
  research/                     # input adapter research, external specs
  backlog/
  implementation/
    _map.md
    orchestration/              # wave plans built per the planning-gate skill
      _map.md                   #   navigation over wave plans + their status
      player-wave1-plan.md, ... # artifacts (each a full, instantiated wave contract)
      runtime-player-wave-planning-conventions.md
    waves/                      # per-wave implementation reports (waveN/)
    reviews/                    # per-wave review reports (waveN/)
```

Note the two layers in action:

- Every directory carries a `_map.md` that is pure 導線 — it lists the artifacts, their status (`Completed / final pass`, `Domain A pass; B/C pending`, ...), and a one-line description, so an agent restoring context reads the map and then opens only the wave it needs.
- `screens/` holds the "what to build" shared understanding (the output of Undine × user dialogue); `implementation/orchestration/` holds the plans; `waves/` and `reviews/` hold the results produced by delegated Gnome / Review-Sylph subagents. Information types stay in separate areas.

This is an example, not a universal structure.

## Do Not Include

Do not include these concerns in this skill:

- Detailed user-question / clarification policy
- Create/review/fix orchestration loops
- Per-call subagent delegation judgment
- Individual task implementation steps

Those belong in the top-level instructions (e.g. `CLAUDE.md`), the `implementation-orchestration` skill, task-specific design documents, or implementation tasks.
