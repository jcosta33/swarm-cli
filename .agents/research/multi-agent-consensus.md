# Multi-Agent Consensus & Conflict Resolution

> **Note:** Research on strategies for merging, reviewing, and resolving conflicts when multiple AI agents modify overlapping files in isolated worktrees.

---

## Research question

When multiple agents in a swarm modify the same source files in parallel worktrees, what automated strategy can reliably detect conflicts, resolve non-overlapping changes, and escalate overlapping semantic conflicts to a review agent without losing developer trust or code correctness?

---

## Sources

- **[S1]** Git documentation. _Merge strategies: recursive, ours, theirs, octopus_. https://git-scm.com/docs/merge-strategies
- **[S2]** Git documentation. _Rerere (Reuse Recorded Resolution)_. https://git-scm.com/docs/git-rerere
- **[S3]** CRDTs — Martin Kleppmann. _Conflict-free Replicated Data Types_. https://martin.kleppmann.com/papers/crdt-survey.pdf
- **[S4]** GitHub Actions. _Merge queues_. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- **[S5]** OpenAI. _Code review with structured critique_. https://platform.openai.com/docs/guides/prompt-engineering
- **[S6]** Pijul documentation. _Patch-based version control_. https://pijul.org/manual/reference/theory.html

---

## Key findings

### Git merge strategies

Git provides several merge strategies that are relevant to multi-agent work:

- **`recursive`** (default): Three-way merge with conflict markers. Best for agents making independent changes.
- **`ours`**: Keeps the current branch version, discarding the other. Useful for "meta" files (e.g., `package-lock.json`) where one agent's changes should dominate.
- **`theirs`**: Opposite of `ours`.
- **`octopus`**: Merges multiple branches at once. Fails if any pairwise merge has conflicts. Useful for aggregating many agent branches into a single integration branch [S1].

```bash
# Merge all agent branches into integration
git checkout integration
git merge --no-ff agent/oauth-ui agent/oauth-repo agent/oauth-handler
# If octopus fails, fall back to pairwise recursive merges
```

### Rerere for automated conflict resolution

Git's `rerere` (Reuse Recorded Resolution) records how conflicts were resolved and automatically re-applies the same resolution when the same conflict pattern re-occurs. This is powerful for agent swarms because:

1. A human resolves a conflict pattern once.
2. All future agents encountering the same pattern get the same resolution automatically.
3. The resolution database is stored in `.git/rr-cache/` and can be committed to the repo [S2].

```bash
git config --local rerere.enabled true
# After resolving a conflict, the resolution is recorded
git rerere status
```

### CRDTs for real-time collaboration

Conflict-free Replicated Data Types guarantee that concurrent edits to text or structured data converge without conflicts. Operational Transformation (OT) and CRDTs are used in Google Docs, Figma, and VS Code Live Share [S3].

For code, CRDTs are theoretically appealing but practically difficult:
- Code is not arbitrary text; it must remain syntactically valid.
- CRDTs for tree-structured ASTs exist (e.g., Yjs on ProseMirror), but applying them to TypeScript source is uncharted territory.
- Performance overhead for large files is significant.

**Verdict:** CRDTs are not applicable to Swarm CLI's batch-oriented, worktree-isolated model. They are designed for real-time, not async batch processing.

### Review agent pattern

When automatic merge fails, escalate to a dedicated "review agent" worktree:

1. The orchestrator creates `agent/review-{parent-slug}` from `main`.
2. It cherry-picks or merges the conflicting agent branches one by one.
3. The review agent receives a prompt: "Resolve merge conflicts between branch A (changes X) and branch B (changes Y). Preserve test coverage and type safety."
4. The review agent outputs a clean branch that the orchestrator merges into `main`.

This pattern is analogous to GitHub merge queues but executed locally by AI [S4][S5].

### File-level locking (pessimistic concurrency)

Before starting work, an agent can "claim" files by writing to a shared lock file. Other agents avoid modifying claimed files.

```ts
interface FileLock {
    agentSlug: string;
    files: string[];
    claimedAt: string;
    expiresAt: string;
}
```

This prevents conflicts entirely but reduces parallelism. Suitable for high-contention files (e.g., `package.json`, core interfaces).

---

## Relevant patterns and snippets

### Pattern: Automated Merge with Escalation

```ts
interface MergeResult {
    success: boolean;
    conflicts?: string[];
    reviewRequired?: boolean;
}

function merge_agent_branch(integrationBranch: string, agentBranch: string): MergeResult {
    const result = spawnSync('git', ['merge', '--no-ff', agentBranch], { cwd: repoRoot });
    if (result.status === 0) return { success: true };

    const conflicts = result.stdout.toString().match(/CONFLICT \((.*?)\):/g) ?? [];
    spawnSync('git', ['merge', '--abort'], { cwd: repoRoot });
    return { success: false, conflicts, reviewRequired: true };
}
```

### Pattern: Review Agent Prompt

```markdown
You are a code review agent. Resolve the merge conflict between:
- Branch: agent/feature-a (changes to src/modules/User/index.ts)
- Branch: agent/feature-b (changes to src/modules/User/index.ts)

The integration branch is agent/merge-review-feature-a-b.

Steps:
1. Check out the integration branch.
2. Merge both branches, resolving conflicts manually.
3. Ensure `pnpm typecheck` and `pnpm test:run` pass.
4. Write a brief explanation of your resolution decisions.
```

---

## Comparison / tradeoffs

| Strategy             | Automation | Parallelism | Correctness | Complexity |
| -------------------- | ---------- | ----------- | ----------- | ---------- |
| Git recursive merge  | High       | High        | Medium      | Low        |
| Octopus merge        | High       | Very High   | Low         | Low        |
| Rerere               | Very High  | High        | High*       | Low        |
| File locking         | High       | Low         | Very High   | Low        |
| Review agent         | Medium     | Medium      | Very High   | Medium     |
| CRDTs                | Very High  | Very High   | Unknown     | Very High  |

*Correctness depends on the quality of recorded resolutions.

---

## Applicability to this repo

Swarm CLI currently launches one agent at a time (or multiple independent agents). True multi-agent parallelism with overlap is a future feature. Therefore:

- **File locking** is the easiest first step. Add a `locks.json` in `.agents/` that agents check before modifying files.
- **Rerere** should be enabled by default in `swarm init` or `swarm new` so that human resolutions are preserved for future agent runs.
- **Review agent** pattern should be implemented as a fallback command: `swarm review --branches agent/foo,agent/bar`.
- **Octopus merge** can be a convenience command for aggregating non-conflicting agent branches.

The `merge` command in `Commands/useCases/` currently only supports single-branch merges. It needs to support multiple branches and conflict detection.

---

## Risks and uncertainties

- Review agents may themselves introduce bugs while resolving conflicts. Need a validation gate (tests, typecheck) before the review branch is considered clean.
- Rerere can apply stale resolutions if the surrounding context has changed significantly. Need a `--rerere-autoupdated` check or human review of auto-resolutions.
- File locking requires agents to be "lock-aware." A rogue agent (or human) can ignore the lock file. This is a coordination convention, not an OS-enforced lock.
- Overuse of review agents increases token cost and latency. Need a cost budget or conflict threshold.

---

## Recommendation

1. **Enable `rerere` by default** when `swarm` creates a new worktree. Document it in `AGENTS.md`.
2. **Implement `swarm lock claim <files...>` and `swarm lock release`** commands for explicit file-level coordination.
3. **Add `swarm review --branches`** that creates a review worktree, attempts pairwise merges, and launches a review agent on conflict.
4. **Improve `swarm merge`** to accept multiple branch arguments and detect/report conflicts with structured output (JSON).
5. **Defer CRDTs** indefinitely; they solve a real-time problem that Swarm CLI does not have.
