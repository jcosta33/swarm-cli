# {{title}}

## Metadata

- Slug: {{slug}}
- Agent: {{agent}}
- Branch: {{branch}}
- Base: {{baseBranch}}
- Worktree: {{worktreePath}}
- Created: {{createdAt}}
- Status: {{status}}
- Task file: {{taskFile}}
- Spec: {{specFile}}
- Type: {{type}}

## Objective

Describe the concrete goal of this task. What must be true when this task is complete?

## Background

Relevant context from research, specs, or prior work. Link to `.agents/research/` or `.agents/specs/` files.

## Constraints

- Stay inside this worktree only.
- Do not switch branches.
- Do not merge.
- Do not push unless explicitly asked.
- Follow the architecture and coding conventions in `AGENTS.md`.

## Plan

1. 
2. 
3. 

## Implementation

### Step 1

### Step 2

### Step 3

## Self-review

### Verification outputs

Paste command output for each check before declaring done.

- [ ] `git status` — only intended files changed.
- [ ] `pnpm typecheck` — zero errors.
- [ ] `pnpm lint` — zero errors.
- [ ] `pnpm test:run` — all tests pass.
- [ ] `pnpm deps:validate` — zero violations.

### Did I stay within scope?

### Are there any follow-up tasks?
