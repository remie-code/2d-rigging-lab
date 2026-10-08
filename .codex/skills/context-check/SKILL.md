---
name: context-check
description: Use when the user fires a context-sufficiency check before you act on a defined decision or action — typically at a decision boundary the user has detected (after discussion has closed, after compaction/resume, after several implementation waves, or before committing to a plan). Given the defined action, restate it as you understood it, audit the premises it rests on (known vs inferred), and return an outcome: proceed, inventory the facts you can close yourself, or surface the premises only the user can decide. You do not self-detect the boundary, and you do not rule whether the action is defined — you report what you can and cannot enumerate; those judgments are the user's.
---

# Context Check

> The full derivation and rationale live in [DESIGN.md](DESIGN.md). Read it whenever this skill starts to feel like a pre-implementation ritual — that feeling is a decay signal, not the skill's purpose.

## Essence

This is a **handoff protocol**, not a gate you pass through and not a lens you wear.

Its subject is one question: **is your context sufficient for the *defined action* you are about to take?** Planning is only one kind of action, and context rot is only one cause of insufficiency ("never had the context" and "acting on stacked assumptions" are the same insufficiency). Do not narrow this to "the ritual before implementation planning."

The protocol has a fixed division of labor. Honor it — most of its value comes from *not* doing the other party's part.

## Division of Labor

| Part | Owner | Why |
| --- | --- | --- |
| **(A) Fire** — detect the decision boundary ("we've reached a decision / discussion has closed"), and guarantee the action is defined enough to act on | **User** | This is an outside-view judgment. You cannot see yourself from outside, so you cannot reliably make it — the same reason you cannot self-detect rot. |
| **(B) Audit** — given the defined action, enumerate the premises it rests on and mark each *known* vs *inferred* | **You** | An inside-view retrieval you are fast at. But **not infallible**: you can hallucinate having been told something. |
| **Backstop** — catch a wrong audit | **User** | Because (B) is fallible. The backstop operates on the premise list you expose, so you must expose it. |

You are the **audit**, not the trigger. Do not build a habit of firing this on yourself at every step — the boundary detection (A) is your blind spot, and a self-fired reflex there degrades into over-asking and analysis paralysis, which is its own rot.

## The Fire (light)

The user hands you little: **the action they are about to take.** That is enough. They are not required to enumerate its premises — that is your job. Their fire carries an implicit guarantee that *the action is defined*, and that guarantee is nearly free to them because it rides on a discussion having closed (shared understanding reached). See DESIGN.md §9.

## The Return (rich)

You return two things, then an outcome:

1. **The action as you understood it.** State it plainly. This lets the user catch the case where you *confabulated* a definition for a still-fuzzy action — your backstop against passing your own front door.
2. **The premises the action rests on, each marked `known` or `inferred`.** Produce this even when the outcome is "proceed": it turns "proceed" from a rubber stamp into a **checkable claim** the user can refute ("that premise is your inference, not something I told you").

## Outcome Model

The outcome falls out of the premise state:

| Premise state | Who closes the gap | Outcome | Loop-back |
| --- | --- | --- | --- |
| Enumerable, all `known` | no one | **Plan directly** | none |
| Enumerable, some `inferred` but closable from repo/tests | you | **Inventory first** | narrow re-audit |
| Enumerable, some `inferred` needing a decision | user | **Discuss first** (confirm premise) | proceed after |
| Not enumerable (action undefined) | user + why | **Discuss to define** (why work) | re-gate on all-new premises |

- Loop-back widens as you go down. Combinations exist (**Inventory then discuss**) when premises sit in different states at once.
- Do not conflate the last two rows. "This premise isn't nailed down" (a hole *inside* a defined action → confirm) is not "we haven't even decided what to do" (no definition yet → define). Both sound like "insufficient discussion" but split cleanly on whether the audit could run.

## You Emit Symptoms, Not Definedness Verdicts

Judging *whether the action is defined* is an outside-view call (§A). It is **not yours**. So:

- If you can enumerate the premises → audit and return an outcome above.
- If you **cannot** cleanly enumerate them → do **not** rule "this is undefined, go define it." Report the **symptom** instead: *"I could not cleanly enumerate premises for ___; I may be guessing the action."* Then let the user decide whether that means the action is undefined.

The bottom row of the table is reached by the **user's** reading of your symptom, never by your verdict.

## Inventory (when the gap is facts you can close)

When the outcome is inventory, you own the investigation design and integration; delegate the actual reading to research subagents (e.g. Sylph via the `Agent` tool) so the token cost is spent in a fresh context, not yours.

You own:

- Decide what must be learned before the audit can resolve.
- Split into bounded research questions with explicit inputs, outputs, evidence expectations, and non-goals.
- Instruct subagents not to ask the user or make product/scope decisions.
- Integrate reports into a compact basis, then re-audit.

Avoid: "survey everything" without bounded questions; loading broad source into your own context when a delegated inventory would protect it; treating a subagent report as a user decision; passing full conversation history unless truly necessary.

## Discuss (when a premise needs the user)

Prefer asking over hiding an assumption inside a plan. Surface a premise to the user when:

- It rests on an inferred user preference.
- It affects product philosophy, UX meaning, scope, responsibility boundaries, public API, data model, naming, or acceptance criteria.
- Terms like "automatic", "smart", "simple", "friendly", "safe", or "done" could mean different things.
- Several technical options are viable and the deciding factor is user value or product direction.

Recommendations are fine, but present them as recommendations, not decisions — include the current assumption and why it matters. If a premise can be settled by reading the repo or running tests, that is inventory, not discussion — do that instead of asking.

## Return Format

```md
Context Check

Action as I understood it:
- ...

Premises it rests on:
- [known] ...
- [inferred] ... — closable by: repo/tests | your decision

Outcome: Plan directly | Inventory first | Discuss first | Inventory then discuss

Inventory plan (if any):
- Sylph A: ...

Premises for you to decide (if any):
- I am assuming X. Correct?
- I recommend A over B because ..., but this is your call.

Could not enumerate (only if it happened):
- I could not cleanly enumerate premises for ___; I may be guessing the action. Whether this is still undefined is your call.
```

Omit sections that are genuinely empty. If no user decision is needed, say so.

## What This Is NOT

- **Not a ritual to pass.** The exposed premise list (not a checkmark) is what makes a "proceed" trustworthy.
- **Not a lens you self-fire.** The boundary detection is the user's; internalizing it as an always-on reflex fails and breeds over-asking.
- **Not a definedness judge.** You never render "this is undefined." You report the symptom; the user rules.
