# Hierarchical Task Decomposition & Delegation

> **Note:** Research on breaking down large engineering tasks into sub-tasks that can be farmed out to child agents, with dependency graphs and result aggregation.

---

## Research question

How can the Swarm CLI decompose a high-level feature request (e.g., "implement OAuth login") into a directed acyclic graph (DAG) of sub-tasks, dispatch each sub-task to an isolated agent worktree, and reliably aggregate the results back into a coherent codebase?

---

## Sources

- **[S1]** OpenAI. _Function calling and structured outputs_. https://platform.openai.com/docs/guides/function-calling
- **[S2]** LangChain documentation. _DAG execution with LangGraph_. https://langchain-ai.github.io/langgraph/
- **[S3]** Make documentation. _Makefile dependency graphs_. https://www.gnu.org/software/make/manual/html_node/Rule-Syntax.html
- **[S4]** Git worktree documentation. _Multiple working trees_. https://git-scm.com/docs/git-worktree
- **[S5]** CUE language. _Configuration validation and DAGs_. https://cuelang.org/
- **[S6]** Temporal.io documentation. _Durable execution_. https://docs.temporal.io/

---

## Key findings

### Structured output for task decomposition

Modern LLMs (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro) support structured JSON output via schemas. A decomposition prompt can return a JSON object representing a task graph:

```json
{
  "tasks": [
    { "id": "auth-model", "description": "Define User and Session types", "dependencies": [] },
    { "id": "auth-repo", "description": "Implement repository layer", "dependencies": ["auth-model"] },
    { "id": "auth-handler", "description": "Implement login/logout handlers", "dependencies": ["auth-repo"] },
    { "id": "auth-ui", "description": "Build login form component", "dependencies": ["auth-handler"] }
  ]
}
```

Validation: the output must form a DAG (no cycles). A simple topological sort validates this in O(V+E) [S1].

### Execution engines for DAGs

LangGraph provides a ready-made DAG executor with checkpointing, but it is Python-only and carries heavy dependencies [S2]. For a Node.js CLI, a custom executor is lighter.

A minimal executor pattern:

```ts
interface TaskNode {
    id: string;
    description: string;
    dependencies: string[];
    status: 'pending' | 'running' | 'done' | 'failed';
    worktreeSlug?: string;
}

async function execute_dag(tasks: TaskNode[], run_task: (t: TaskNode) => Promise<void>): Promise<void> {
    const pending = new Set(tasks.map((t) => t.id));
    const completed = new Set<string>();
    const failed = new Set<string>();

    while (pending.size > 0) {
        const ready = tasks.filter((t) => pending.has(t.id) && t.dependencies.every((d) => completed.has(d)));
        if (ready.length === 0 && pending.size > 0) {
            const blocked = [...pending].filter((id) => !failed.has(id));
            if (blocked.length === 0) throw new Error('All remaining tasks failed');
            throw new Error(`Deadlock: tasks ${blocked.join(', ')} cannot proceed`);
        }

        await Promise.all(
            ready.map(async (task) => {
                pending.delete(task.id);
                task.status = 'running';
                try {
                    await run_task(task);
                    task.status = 'done';
                    completed.add(task.id);
                } catch (_e: unknown) {
                    task.status = 'failed';
                    failed.add(task.id);
                }
            })
        );
    }
}
```

### Worktree allocation strategy

Each sub-task gets its own `agent/{parent-slug}-{subtask-id}` worktree branched from `main` (or from the parent's base branch). This keeps changes isolated [S4].

Aggregation options:
1. **Merge cascade:** After all children succeed, merge each child branch into the parent branch in topological order. Conflicts are resolved by requiring the later task to rebase on the earlier.
2. **Patch quilt:** Each agent produces a `.patch` file. The orchestrator applies patches in order, halting on the first failure.
3. **Shared worktree (risky):** Agents write to the same worktree with file-level locking. Not recommended — violates isolation principles.

### Result validation and rollback

Each sub-task should output a validation report (tests pass, lint clean, typecheck clean). The orchestrator reads `.agents/tasks/{slug}.md` Self-review section to determine success [S6].

If a task fails, its dependents are automatically skipped (fail-fast) or retried with a modified prompt (retry with backoff). The retry policy should be configurable in `swarm.config.json`.

---

## Relevant patterns and snippets

### Pattern: Task Graph Schema (CUE)

Using CUE to validate that a decomposition output is a valid DAG:

```cue
#Task: {
    id: string & =~"^[a-z0-9-]+$"
    description: string
    dependencies: [...#Task.id]
}

#TaskGraph: {
    tasks: [...#Task]
    // No cycles enforced by topological sort in application layer
}
```

### Pattern: Merge Cascade

```bash
# After task auth-model completes on branch agent/oauth-auth-model
git checkout agent/oauth-main
git merge --no-ff agent/oauth-auth-model

# After task auth-repo completes
git merge --no-ff agent/oauth-auth-repo
# ... and so on
```

---

## Comparison / tradeoffs

| Criterion          | LangGraph | Custom DAG Executor | Makefile | Temporal |
| ------------------ | --------- | ------------------- | -------- | -------- |
| Language           | Python    | TypeScript          | Shell    | Go/TS SDK |
| Dependency weight  | Heavy     | None                | Built-in | Heavy |
| Checkpointing      | Built-in  | Manual (git)        | None     | Built-in |
| Retry logic        | Built-in  | Manual              | None     | Built-in |
| Observable         | Yes       | Custom              | No       | Yes |
| Learning curve     | Medium    | Low                 | Low      | High |

---

## Applicability to this repo

Swarm CLI is a Node.js tool with a strict no-heavy-dependency policy (see `AGENTS.md`). Therefore:

- **LangGraph is excluded** (Python dependency).
- **Temporal is excluded** (heavy infrastructure, requires server).
- **Custom DAG executor** is the correct choice. It can live in a new `TaskOrchestration` module or extend `TaskManagement`.
- The DAG executor should reuse existing worktree primitives (`worktree_create`, `branch_exists`, etc.) from the `Workspace` module.
- Merge cascade is preferred over patch quilt because it uses native git semantics and preserves commit history.

The decomposition itself can be triggered by a new command: `swarm decompose "implement OAuth" --max-tasks 5`.

---

## Risks and uncertainties

- LLM may produce cyclic dependencies or impossible dependency graphs. Need runtime validation with clear error messages.
- Merge conflicts between sibling tasks (tasks with no dependency edge) are likely. The cascade merge order may need to be configurable or derived from a heuristic (e.g., fewer changed files first).
- Nested decomposition (a child task itself decomposing) could exhaust available worktree names or disk space. Need a depth limit.
- The aggregation step requires the orchestrator to run inside the repo, not in a worktree. This is already true for `swarm`.

---

## Recommendation

1. **Build a `decompose.ts` command** that takes a natural language prompt, calls an LLM with a JSON schema for task decomposition, validates the DAG, and prints the graph without executing it (`--dry-run`).
2. **Add a `run_dag()` function** in `TaskManagement` that accepts a list of `TaskNode`, allocates worktrees, and runs agents in parallel where dependencies allow.
3. **Implement merge cascade** as a post-DAG step: `swarm merge --cascade agent/oauth-*`.
4. **Start simple:** No retry logic, no checkpointing beyond git commits. Add complexity only after the basic flow is proven.
