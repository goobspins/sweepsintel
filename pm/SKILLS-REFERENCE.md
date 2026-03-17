# Skills Reference

Skills that enhance how Claude operates on this project.

## /realign — State Persistence

Automatically activated. Maintains `_state.md` and `_decisions.md` at the project root to preserve context across compaction boundaries.

**How it works:** On session start (or after compaction), Claude reads `_state.md`, states what it believes is true in 2-4 sentences, and asks if anything is wrong. During work, Claude silently updates `_state.md` when decisions are made, approaches change, constraints are added, or artifact statuses change. Non-obvious decisions get logged to `_decisions.md` with full reasoning.

**When to rely on it:** Always. This is the mechanism that prevents context loss during long sessions. If Claude's understanding seems off after a long conversation, the state file is more reliable than reconstructing from memory.

**Rules:** Keep `_state.md` under 40 lines. Keep `_decisions.md` entries self-contained. Don't update either file for exploration or debugging — only for state changes.

## /framework — Structured Problem Thinking

Trigger manually when facing a design decision, architectural choice, or any problem where the framing matters more than the first answer.

**The process (4 passes):**

1. **Naive draft** — Get the obvious design down without overthinking it.
2. **Adversarial critique** — Attack the draft. What fails at scale? What gets gamed? What data are we not capturing? Find at least 5 real problems.
3. **Perspective shift** — Evaluate through user archetypes (Grinder, Casual, Contributor). What does each love? What frustrates them? What makes them leave?
4. **Reconciliation** — Rebuild incorporating the critique and perspectives. Flag remaining tensions that can't be fully resolved.

**When to use:** Complex system design (like the intelligence layer), product tradeoffs with no obvious answer, any problem where jumping to a solution feels premature. This is exactly the methodology that produced the Intelligence Layer Design v2 document.

**When NOT to use:** Execution tasks, straightforward Codex prompts, or problems with clear right answers. Don't framework your way through a CSS bug.

## Using Skills Together

A typical deep design session might look like:
1. /realign fires on session start → Claude re-reads state
2. Claude and Dylan identify a design problem
3. /framework runs the 4-pass methodology
4. The output becomes a design doc in docs/active/
5. /realign captures the decision in _decisions.md
6. Claude writes a Codex prompt based on the reconciled design
