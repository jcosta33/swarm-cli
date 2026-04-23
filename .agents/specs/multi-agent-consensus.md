# Multi-Agent Consensus & Conflict Resolution

## Context

As Swarm CLI moves toward parallel agent execution, multiple agents may modify overlapping files. Git merge conflicts, semantic inconsistencies, and race conditions become likely. Research in `.agents/research/multi-agent-consensus.md` evaluated merge strategies, rerere, review agents, file locking, and CRDTs.

## Goal

The CLI provides automated conflict detection, resolution of non-overlapping changes, and escalation of complex conflicts to a dedicated review agent, while preventing conflicts via optional file-level locking.

## User-visible behavior

- `swarm merge --cascade agent/foo-*` merges branches in order, automatically resolving patterns recorded by `rerere`, and stopping on unresolvable conflicts.
- `swarm lock claim src/modules/User/index.ts --agent foo` reserves a file for an agent.
- `swarm lock release src/modules/User/index.ts` removes the reservation.
- `swarm review --branches agent/foo,agent/bar` creates a review worktree and launches a review agent when conflicts are detected.
- `rerere` is enabled automatically in repos initialised by `swarm init`.

## Scope

**In scope:**
- Enable and leverage `git rerere`.
- File-level locking commands (`claim`, `release`, `list`).
- Enhanced `swarm merge` with conflict detection and structured output.
- Review agent command that launches on conflict.

**Non-goals:**
- CRDT-based real-time merging.
- Automatic semantic conflict resolution (e.g., type incompatibility detection beyond compiler errors).
- Cross-repo merge coordination.

## Requirements

1. **Rerere default** — `swarm init` sets `rerere.enabled true` in the local git config.
2. **Lock claim** — `swarm lock claim <file> --agent <slug>` writes to `.agents/locks.json` if the file is not already claimed.
3. **Lock release** — `swarm lock release <file>` removes the claim.
4. **Lock list** — `swarm lock list` prints all active claims with agent slugs and expiration times.
5. **Merge conflict detection** — `swarm merge <branch>` returns a non-zero exit code and prints JSON conflict details when automatic merge fails.
6. **Review agent** — `swarm review --branches a,b` creates `agent/review-{slug}`, attempts pairwise merges, and launches a review agent on conflict.

## Constraints

- File locking is advisory only; agents must opt in by checking locks before writing.
- Merge operations must use the existing `Workspace` git primitives.
- Review agent prompt must reference `.agents/skills/personas/SKILL.md` and adopt **The Skeptic** persona.

## Design decisions

### Decision: Advisory file locking over OS locks

**Chosen:** JSON-based advisory locks in `.agents/locks.json`.

**Considered and rejected:**
- OS `flock` — not portable to all editors/agents, too coarse.
- Git LFS locking — requires LFS setup, overkill.

### Decision: Review agent as explicit command

**Chosen:** User runs `swarm review` or the orchestrator invokes it automatically on merge failure.

**Considered and rejected:**
- Automatic review agent launch during merge — surprising, could spawn agents unexpectedly.

## Acceptance criteria

- [ ] `swarm init` enables `rerere` in the local git config.
- [ ] `swarm lock claim src/index.ts --agent test` succeeds; a second claim fails with a clear message.
- [ ] `swarm lock list` shows the claim with timestamp and TTL.
- [ ] `swarm merge agent/conflicting-branch` exits non-zero and prints JSON with conflicted files.
- [ ] `swarm review --branches agent/a,agent/b` creates a review worktree when the branches conflict.
- [ ] `pnpm deps:validate` passes.

## Implementation notes

- Add `src/modules/Commands/useCases/lock.ts` with subcommands `claim`, `release`, `list`.
- Add `src/modules/AgentState/services/locks.ts` for lock read/write (reuse advisory locking from the state module).
- Modify `src/modules/Commands/useCases/init.ts` to run `git config rerere.enabled true`.
- Enhance `src/modules/Commands/useCases/merge-related-commands` or create a new merge command with conflict detection.
- Reuse the review task template pattern from `review.ts` but generalise it for arbitrary branch pairs.

## Test plan

1. Unit test: `claim_lock` prevents double-claim.
2. Unit test: `list_locks` returns expired locks based on TTL.
3. Integration test: Create two branches with conflicting edits to the same file; `swarm merge` detects the conflict.
4. Manual: Run `swarm review` on conflicting branches and verify the review worktree is created with the correct task file.

## Open questions

- [ ] **[MINOR]** What should the lock TTL be? 24 hours? Configurable in `swarm.config.json`?
- [ ] **[MINOR]** Should `swarm new` automatically check locks and warn if the task is likely to touch claimed files?

## Tradeoffs and risks

- Advisory locks are conventions, not enforcement. A misbehaving agent can ignore them.
- `rerere` resolutions can become stale if code context shifts significantly. We should document that users should periodically clear `.git/rr-cache`.
- Review agents consume tokens. A `--dry-run` flag for `swarm review` would show the conflict without launching an agent.
