# Codex Prompt Guide

How to write prompts that Codex executes well on the first pass.

## Prompt Structure

Every Codex prompt follows this skeleton:

```
# Title -- What This Prompt Does

## Context
- What Codex needs to know about the current state
- What was recently changed (so Codex doesn't redo it)
- Stack reminder: Astro 4.0 + React 18 + Neon Postgres + raw SQL

## Phase N: [Task Name]
1. Specific step with file paths
2. Specific step with exact patterns to search
3. Verification step

**Commit message**: `type: description`
**Run `npm run check:full` after this phase.**

## Constraints
- DO NOT modify: [explicit file list]
- DO NOT install new dependencies
- DO NOT change user-visible behavior (for refactoring prompts)
```

## Principles

### Be explicit about what already exists
Codex will redo work if you don't tell it what's done. Always include a "these are ALREADY done" section listing recent changes, existing utilities, and completed decompositions.

### Specify the negative space
"Do NOT touch MyCasinosBoard" is more useful than only listing what to touch. Codex explores aggressively -- fences matter.

### One commit per phase
Makes rollback safe. If Phase 5 breaks something, revert Phase 5 without losing Phases 1-4. Always specify the commit message in the prompt.

### Include verification gates
`npm run check:full` (astro check + astro build) after every phase. Codex should not proceed to Phase N+1 if Phase N doesn't pass.

### Give Codex judgment calls explicitly
"If a component has ZERO imports from any .astro page, delete it. If it IS still imported, document where and leave it alone." Codex handles conditional logic well when the decision tree is spelled out.

### Don't create abstractions Codex has to learn
We rejected a shared `api.ts` helper because it adds a layer Codex must understand on every future prompt. Keep patterns inline and repeated rather than DRY-but-opaque. This tradeoff favors promptability over code elegance.

## Common Patterns

### Refactoring prompt
- Phase 0: Safety rails (branch, check script)
- Phase 1-N: One refactoring concern per phase
- Constraints: No behavior changes, no new deps, scoped styles
- Validation: Checklist of measurable outcomes (line counts, grep results)

### Feature prompt
- Context: Which spec section this implements
- Phase 1: Data layer (schema, queries, types)
- Phase 2: API endpoints
- Phase 3: UI components
- Phase 4: Integration and wiring
- Constraints: Consistent with existing patterns (show examples)

### Audit/fix prompt
- "Read [file]. Compare against [spec section]. Fix any divergence."
- Be specific about what "fix" means -- match the spec, or update the spec?

## Anti-patterns

- "Clean up the codebase" -- Too vague. Codex will touch everything.
- "Use best practices" -- Codex's best practices may not match ours (no Tailwind, no ORM, scoped styles).
- "Make it better" -- Better how? Faster? More readable? More type-safe? Pick one.
- Prompts longer than ~15K words -- Codex's attention degrades. Split into multiple prompts if needed.
- Mixing refactoring and features in one prompt -- Different risk profiles. Keep them separate.

## Stack Reminders (include in every prompt)

```
**Stack**: Astro 4.0 (hybrid mode) + React 18 + Neon Postgres + raw SQL.
No Tailwind. Scoped `<style>` blocks with CSS variables. No external state library.
No ORM -- raw SQL via query<T>() and transaction().
Auth is OTP-based via Resend email.
```
