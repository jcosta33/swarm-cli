# Agent-to-Agent Communication Protocols

> **Note:** Research on IPC, message passing, and shared-state mechanisms for coordinating concurrent AI agents in isolated git worktrees.

---

## Research question

What is the most robust, cross-platform mechanism for enabling real-time bidirectional communication between AI agents running in separate git worktrees, such that an orchestrator CLI can broadcast context, receive partial results, and synchronize state without filesystem race conditions?

---

## Sources

- **[S1]** Node.js documentation. _Child Process IPC_. https://nodejs.org/api/child_process.html#child_process_options_stdio
- **[S2]** Node.js documentation. _net module — Unix Domain Sockets_. https://nodejs.org/api/net.html#ipc-support
- **[S3]** libuv documentation. _Pipes and IPC_. https://docs.libuv.org/en/v1.x/pipe.html
- **[S4]** ZeroMQ guide. _The Transport Bridging_. https://zguide.zeromq.org/docs/chapter2/
- **[S5]** Redis documentation. _Pub/Sub_. https://redis.io/docs/latest/develop/interact/pubsub/
- **[S6]** SQLite documentation. _WAL Mode_. https://www.sqlite.org/wal.html
- **[S7]** Flock(2) man page. Linux Programmer's Manual.

---

## Key findings

### IPC via Node.js `child_process`

When spawning an agent process with `stdio: ['inherit', 'inherit', 'inherit', 'ipc']`, Node.js establishes a unidirectional or bidirectional IPC channel over a libuv pipe. The pipe is represented as a `subprocess.send()` / `process.on('message')` API. This is the lowest-overhead option when the orchestrator directly spawns the agent.

```js
const child = fork(agentScript, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
child.send({ type: 'context', payload: { branch: 'agent/foo', files: ['src/a.ts'] } });
child.on('message', (msg) => { if (msg.type === 'progress') { /* ... */ } });
```

Limitations discovered:
- IPC channel closes if either side calls `process.disconnect()` or exits.
- Message payload is serialised with the structured clone algorithm (no functions, no native handles).
- Not available if the agent is spawned through an intermediate shell script (AppleScript, `osascript`, `gnome-terminal`, etc.), which is exactly how `swarm` currently launches terminal emulators [S1].

### Unix Domain Sockets (UDS) and Named Pipes

A Unix domain socket (`.sock` file) or Windows named pipe offers an OS-level transport that survives intermediate shell processes. Any process with the socket path can connect.

```js
import { createServer, createConnection } from 'net';
const server = createServer((socket) => {
    socket.on('data', (buf) => { const msg = JSON.parse(buf.toString()); /* ... */ });
});
server.listen('/tmp/swarm-agent-{slug}.sock');
```

Trade-offs:
- Requires cleanup on crash (unlink socket file).
- Cross-platform: UDS on macOS/Linux, named pipes on Windows (`\\\\.\pipe\swarm-{slug}`).
- Can be bridged to WebSocket for remote agents [S2].

### File-based "mailbox" with atomic append

A simple, portable approach: each agent writes JSON-lines to a shared mailbox file using `fs.appendFileSync` with `O_APPEND`. The orchestrator tails the file. SQLite WAL mode can be used for structured queryable state [S6].

```js
fs.appendFileSync(mailboxPath, JSON.stringify(msg) + '\n', { flag: 'a' });
```

This is robust against crashes (no socket cleanup) but is pull-based (polling) rather than push-based. Latency is bounded by poll interval. Fine for batch-style agent swarms, poor for real-time collaboration.

### Message broker (ZeroMQ / Redis)

ZeroMQ `PUB/SUB` over `inproc://` or `tcp://127.0.0.1` provides brokerless pub/sub. Redis adds persistence and richer patterns but requires a separate daemon.

For a CLI tool that should work out-of-the-box on a developer laptop, requiring Redis is a heavy dependency. ZeroMQ is a native module (node-gyp) which complicates installation. Evaluated as overkill for the current scope [S4][S5].

### Advisory file locking

When multiple agents must read/write the same state JSON, `flock` (advisory lock) prevents corruption. Node.js does not expose `flock` directly, but `fs-ext` or `proper-lockfile` provide it.

```js
import lockfile from 'proper-lockfile';
await lockfile.lock(statePath);
try { /* read + write */ } finally { await lockfile.unlock(statePath); }
```

This solves the race condition in `read_state` / `write_state` but does not provide real-time notification [S7].

---

## Relevant patterns and snippets

### Pattern: IPC-Aware Terminal Launch

Instead of launching the terminal emulator detached, launch a tiny Node.js "shim" that opens the IPC channel to the orchestrator, then spawns the terminal emulator as its own child. The shim forwards messages bidirectionally.

```js
// shim.js — spawned by swarm with ipc
import { spawn } from 'child_process';
const agent = spawn('claude', ['--dir', worktreePath], { detached: true });
process.on('message', (msg) => agent.stdin.write(JSON.stringify(msg) + '\n'));
agent.stdout.on('data', (buf) => process.send?.({ type: 'stdout', data: buf.toString() }));
```

### Pattern: Atomic JSON-State with Advisory Locks

Replace `readFileSync` + `writeFileSync` with `proper-lockfile` to eliminate the read-then-write race in `AgentState`.

---

## Comparison / tradeoffs

| Criterion            | Node IPC | UDS / Named Pipe | File Mailbox | ZeroMQ | Advisory Locks |
| -------------------- | -------- | ---------------- | ------------ | ------ | -------------- |
| Zero dependency      | ✅       | ✅               | ✅           | ❌     | ⚠️ (npm pkg)   |
| Cross-platform       | ✅       | ⚠️ (path diff)   | ✅           | ✅     | ✅             |
| Works through shell  | ❌       | ✅               | ✅           | ✅     | ✅             |
| Real-time push       | ✅       | ✅               | ❌ (poll)    | ✅     | ❌             |
| Crash cleanup        | ✅       | ❌               | ✅           | ✅     | ✅             |
| Complexity           | Low      | Medium           | Low          | High   | Low            |

---

## Applicability to this repo

Swarm CLI spawns agents through terminal emulator wrappers (AppleScript, `gnome-terminal`, etc.). Node.js IPC does **not** survive this boundary because the immediate child is the terminal emulator, not the agent process. Therefore:

1. **Short-term:** Use file-based mailbox + advisory locks for state synchronisation. It is the only approach that works with the current detached-launch architecture without heavy refactoring.
2. **Medium-term:** Implement an IPC shim (see Pattern above) that is spawned with IPC, then launches the terminal emulator. This gives us real-time push without changing the user-visible terminal behaviour.
3. **Long-term:** If agent swarms grow beyond a single machine, migrate to ZeroMQ or a lightweight Redis instance.

The existing `read_state` / `write_state` race condition is best fixed with advisory locking (`proper-lockfile`) rather than file rename, because rename only makes the write atomic but does not prevent the read-from-stale-data problem.

---

## Risks and uncertainties

- `proper-lockfile` uses `fs-ext` on some platforms which may require native compilation. Need to verify it works on macOS ARM64, Linux x64, and Windows without additional tooling.
- UDS path length limits on macOS (104 bytes). Slug + repo name must stay under this if using socket paths derived from them.
- File mailbox grows unbounded unless truncated. Need a rotation / compaction strategy.
- IPC shim approach means the shim process must outlive the terminal emulator, or the channel dies.

---

## Recommendation

1. **Immediate:** Add `proper-lockfile` dependency and wrap `read_state` / `write_state` with advisory locks. This is a minimal change with high safety payoff.
2. **Next iteration:** Implement the IPC-shim launcher as an opt-in backend (`backend: shim`). Validate it with a proof-of-concept before making it the default.
3. **Defer:** Message brokers (ZeroMQ, Redis) until there is a demonstrated need for sub-100ms inter-agent latency or cross-machine agent swarms.
