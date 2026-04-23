# Agent Communication Protocol

## Context

The Swarm CLI currently launches AI agents in isolated git worktrees but provides no mechanism for real-time bidirectional communication between the orchestrator and running agents, nor between concurrent agents. State is shared only through a JSON file (`read_state` / `write_state`) which has a read-then-write race condition. Research in `.agents/research/agent-to-agent-communication.md` evaluated IPC channels, Unix domain sockets, file mailboxes, message brokers, and advisory locking.

## Goal

Agents and the orchestrator can exchange messages and synchronise state safely without race conditions, using mechanisms that work within the existing detached-terminal-launch architecture.

## User-visible behavior

- `swarm new foo --launch` writes state atomically; concurrent `swarm list` reads never see corrupted or partial state.
- A new `swarm message <slug> <json>` command allows sending ad-hoc messages to a running agent (if the IPC shim is active).
- `swarm status <slug>` shows not only PID and backend but also last heartbeat timestamp and recent events.

## Scope

**In scope:**
- Advisory file locking for `AgentState` read/write operations.
- IPC-shim backend as an opt-in terminal launcher.
- File-based event mailbox for pull-based state observation.
- `swarm message` and `swarm status` commands.

**Non-goals:**
- Real-time bidirectional push between arbitrary agents (requires broker infrastructure).
- Cross-machine agent swarms.
- ZeroMQ or Redis integration.

## Requirements

1. **Atomic state access** — `read_state` and `write_state` must be safe when called concurrently from multiple processes.
2. **IPC shim backend** — A new backend `shim` that launches a tiny Node.js proxy with an IPC channel to the orchestrator, which then spawns the terminal emulator.
3. **Event mailbox** — Each agent writes NDJSON events to `.agents/logs/{slug}.jsonl`. The orchestrator can tail these files.
4. **Message command** — `swarm message <slug> '{"type":"pause"}'` forwards the JSON to the agent via the IPC shim.
5. **Status command** — `swarm status <slug>` displays: state from JSON registry + last 5 events from mailbox + heartbeat age.

## Constraints

- Must not require native compilation on macOS, Linux, or Windows.
- Must work with existing terminal emulator launchers (Terminal.app, iTerm2, etc.).
- Must follow DDD module boundaries; state logic stays in `AgentState`, IPC in `Terminal`, commands in `Commands`.

## Design decisions

### Decision: Advisory locking via `proper-lockfile`

**Chosen:** Use `proper-lockfile` to wrap `read_state` / `write_state`.

**Considered and rejected:**
- `fs-ext` direct `flock` — requires native compilation on some platforms.
- SQLite WAL — overkill for a single JSON file; adds dependency.
- Atomic rename only — fixes write atomicity but not read-modify-write races.

### Decision: IPC shim as opt-in backend

**Chosen:** Implement `shim` backend in `Terminal/useCases/terminal.ts` that spawns a proxy script with `stdio: 'ipc'`.

**Considered and rejected:**
- Unix domain sockets — path length limits, cleanup on crash, not Windows-friendly without named pipes.
- File mailbox only — sufficient for observation but not for push messaging.

## Acceptance criteria

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test:run` includes a test spawning two processes that hammer `read_state` / `write_state` concurrently without corruption.
- [ ] `swarm new test-shim --launch --backend=shim` launches the agent and the shim process appears in `ps`.
- [ ] `swarm message test-shim '{"type":"ping"}'` returns success when the shim is running.
- [ ] `swarm status test-shim` shows last heartbeat within 5 seconds of agent activity.

## Implementation notes

- Add `proper-lockfile` to `package.json` dependencies.
- Create `src/modules/Terminal/useCases/shim.ts` — the proxy script that is spawned with IPC.
- Modify `src/modules/AgentState/useCases/state.ts` to use `proper-lockfile.lockSync` around file operations.
- Add `src/modules/Commands/useCases/message.ts` and `status.ts` commands.
- The shim script should be written to a temp file (like existing AppleScript temp files) and cleaned up on exit.

## Test plan

1. Run two Node processes in parallel, each calling `write_state` 100 times with different slugs. Verify `read_state` returns exactly 200 valid entries.
2. Launch `swarm new test-shim --backend=shim --launch`, verify shim process exists, send a message, verify agent receives it.
3. Manual: `swarm status test-shim` after agent exits — should show `exited` with exit code.

## Open questions

- [ ] **[MINOR]** Should the shim use `process.send` or a Unix domain socket for agents that do not support Node IPC natively (e.g., Python-based agents)?

## Tradeoffs and risks

- `proper-lockfile` may add ~50KB of dependencies. Acceptable.
- IPC shim adds one more process to manage. If it crashes, the channel dies. Need a watchdog or clear error message.
- File mailboxes grow unbounded. A `swarm logs --prune` command should be added later.
