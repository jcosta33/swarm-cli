# Adaptive Capability Discovery

## Context

Swarm CLI hard-codes adapter lists, command help text, and command dispatch. Adding a new command or adapter requires touching multiple files. Research in `.agents/research/adaptive-capability-discovery.md` evaluated filesystem scanning, `package.json` contributions, decorators, and build-time manifests.

## Goal

The CLI discovers commands, adapters, and skills at runtime from a central capability registry, so adding a new command or adapter requires only creating one file and exporting a `capability` constant.

## User-visible behavior

- `swarm capabilities` lists all registered commands, adapters, and skills with descriptions and versions.
- `swarm capabilities --json` outputs machine-readable registry data.
- Adding `src/modules/Commands/useCases/my-cmd.ts` with `export const capability = { ... }` automatically makes it available in `swarm --help` and dispatch.
- Adapters are registered the same way; `swarm new foo --agent=my-agent` works as soon as the adapter file exists.

## Scope

**In scope:**
- `Capability` interface and in-memory registry.
- Refactor `Adapters` to register via `capability` exports.
- Refactor `Commands` help generation and dispatch to use the registry.
- `swarm capabilities` command.

**Non-goals:**
- External plugin loading from `node_modules`.
- Dynamic `import()` at runtime (keep startup synchronous).
- Semantic versioning enforcement or capability compatibility checks.

## Requirements

1. **Registry interface** — `register_capability()`, `get_capability()`, `find_capabilities()`, `list_capabilities()`.
2. **Adapter registration** — Each adapter file exports a `capability` constant; `Adapters/index.ts` imports all files and registers them.
3. **Command registration** — Each command file exports a `capability` constant; `Commands/index.ts` (or a service) imports all command files and registers them.
4. **Help generation** — `swarm --help` reads command capabilities from the registry instead of hard-coded strings.
5. **Dispatch safety** — Unknown commands still fall through to agent install fallback, but known commands are validated against the registry before spawn.

## Constraints

- Must remain synchronous at startup (no dynamic `import()`).
- Must follow DDD boundaries: registry lives in `Commands` or a new `CapabilityRegistry` module.
- Must not break existing command files; migration is incremental.

## Design decisions

### Decision: Explicit imports in barrel files

**Chosen:** Each module's `index.ts` explicitly imports all files in `useCases/` and registers capabilities during module init.

**Considered and rejected:**
- `globSync` at runtime — requires `fs` access during startup, slower, harder to type-check.
- Build-time manifest — conflicts with running directly from `.ts` sources.

### Decision: Registry in `Commands/services/registry.ts`

**Chosen:** A lightweight service inside `Commands` because capabilities are primarily about CLI surface area.

**Considered and rejected:**
- New top-level `CapabilityRegistry` module — overkill for a single Map and four functions.

## Acceptance criteria

- [ ] `pnpm typecheck` passes.
- [ ] `swarm capabilities` lists at least 10 commands and 2 adapters.
- [ ] Adding a dummy command file with `export const capability` makes it appear in `swarm --help` without editing any other file.
- [ ] Removing a capability export removes it from help and dispatch.
- [ ] `pnpm deps:validate` passes.

## Implementation notes

- Define `interface Capability { name: string; version: string; type: 'command' | 'adapter' | 'skill'; description: string; entryPoint: string; }`.
- Create `src/modules/Commands/services/registry.ts`.
- Refactor `src/modules/Adapters/index.ts` to import all adapter files and call `register_capability()`.
- Refactor `src/modules/Commands/useCases/help.ts` (or create it) to use the registry.
- Refactor `src/index.ts` command dispatch to check the registry before spawning.

## Test plan

1. Unit test: `register_capability` rejects duplicates.
2. Unit test: `find_capabilities({ type: 'command' })` returns only commands.
3. Integration test: Add a temporary command file, run `swarm capabilities --json`, verify it appears, then delete the file.
4. Manual: `swarm --help` shows commands sorted alphabetically with descriptions from registry.

## Open questions

- [ ] **[MINOR]** Should skills in `.agents/skills/` also be registered as capabilities? If so, the registry needs to scan `.agents/` at runtime.

## Tradeoffs and risks

- Barrel files become longer as more commands are added. This is acceptable; it is explicit and type-safe.
- A malformed capability export could crash startup. Add runtime validation in `register_capability`.
- The migration is incremental but touches many files. Run `pnpm deps:validate` after every module.
