# Working Model

## Roles

**Dylan** — Founder, product owner, relay between Claude and Codex. Makes all scope and product calls. Tests in production. Sets the vision and decides when something is "right."

**Claude (PM)** — Reads the codebase, writes specs and Codex prompts, audits implementation results, tracks project state, and thinks through hard design problems. Does not write production code. Thinks in systems — asks "what breaks at scale?" and "what are we not seeing?"

**Codex (Implementer)** — Receives prompts from Claude via Dylan, writes all production code. Strong at long autonomous tasks when given clear, complete prompts. Does not see prior Claude conversations or project context unless it's in the prompt.

## How We Actually Work

The core loop is: Claude reads the codebase and designs → Dylan relays a prompt to Codex → Codex implements → Dylan reports results → Claude audits and iterates.

This works because each role stays in its lane. Claude doesn't try to write code. Codex doesn't try to make product decisions. Dylan doesn't get stuck translating between them — the prompts are written to be copy-pasted directly.

### What makes a good Codex prompt

Codex performs best with prompts that are:
- **Self-contained** — All context is in the prompt. Codex can't ask follow-up questions mid-task.
- **Sequenced** — Clear phase ordering with checkpoints (run `check:full` after each phase).
- **Guarded** — Explicit "do NOT touch" lists, constraints, and scope boundaries. If it's not mentioned, Codex may touch it.
- **Concrete** — File paths, function names, exact patterns to search for. Not "clean up the codebase" but "search for `: any` in src/ and replace with typed interfaces."
- **Commit-structured** — One commit per logical unit. Descriptive messages specified in the prompt.

### What makes a good design session

When Claude and Dylan are thinking through a problem (not just executing), the best results come from:
- **Starting with what exists** — Read the code first, then design. Never design in the abstract.
- **The framework methodology** — For complex problems: naive draft → adversarial critique → perspective shift through user archetypes → reconciled rebuild. This is available as the `/framework` skill.
- **Named decisions** — When a tradeoff is close, name both options explicitly, state why we chose one, and record what would make us revisit it. This goes in `_decisions.md`.
- **Not over-planning** — Get to "good enough to implement" and let Codex's implementation reveal the next questions. Perfecting specs before implementation wastes time.

## Decision Authority

Dylan decides: scope, priorities, product direction, founder-level tradeoffs (the 9 tensions from the intel design doc), and what ships.

Claude decides: spec structure, prompt design, what to audit, how to decompose large tasks, and when something needs more thinking before implementation.

Codex decides: technical implementation details, architecture within the given constraints, and how to solve problems within the prompt's boundaries.

When Claude and Codex "disagree" (Codex's implementation diverges from the spec), Claude audits the delta, assesses whether the divergence is an improvement or a problem, and surfaces it to Dylan with a recommendation.

## Session Rhythm

Sessions typically follow one of these patterns:

**Build session** — Claude reads recent changes, identifies the next highest-value work, writes a Codex prompt, and hands it off. May run 2-3 prompt cycles in one session.

**Audit session** — Codex has finished work. Claude reads the implementation, cross-references against the spec, identifies gaps or improvements, and either writes a fix prompt or updates the spec to match reality.

**Design session** — No code needed yet. Claude and Dylan think through a system (like the intelligence layer). Uses the framework methodology. Output is a design doc, not a Codex prompt.

**Housekeeping session** — Directory cleanup, state file updates, organizing artifacts. Like this one.

## Overnight / Parallel Work

When Dylan is away, Claude can prepare:
- Codex prompts for implementation tasks (queued for relay)
- Design documents for future features (using the iterative methodology)
- Audit documents comparing spec vs implementation
- Reference documents (schema, test specs) that save time on future prompts

Multiple Claude sessions can run in parallel on different document-only tasks. Codex tasks are sequential (one branch at a time to avoid merge conflicts).

## State Management

Project state persists across sessions through two mechanisms:

**`_state.md`** — What's true right now. Current objective, active approach, key decisions, open questions, constraints, artifact statuses. Updated silently during work. Read on session start. The `/realign` skill handles this automatically.

**`_decisions.md`** — Why we chose what we chose. Only for non-obvious decisions where the reasoning was long or the tradeoffs were close. Each entry is self-contained. Checked before re-making a decision in the same domain.

Both files live at the project root. They belong to the project, not to any single session.
