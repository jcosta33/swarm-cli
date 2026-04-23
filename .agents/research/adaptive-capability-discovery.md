# Adaptive Agent Capability Discovery

> **Note:** Research on runtime skill registration, introspection, and dynamic matching of tasks to agent capabilities in a modular CLI architecture.

---

## Research question

How can the Swarm CLI maintain a registry of agent capabilities (skills, adapters, commands) that is discoverable at runtime, versioned with the codebase, and used to route tasks to the most appropriate agent or tool without hard-coded command mappings?

---

## Sources

- **[S1]** Node.js documentation. _Module loading and `require.main`_. https://nodejs.org/api/modules.html
- **[S2]** TypeScript documentation. _Declaration merging and module augmentation_. https://www.typescriptlang.org/docs/handbook/declaration-merging.html
- **[S3]** Fastify documentation. _Plugin architecture_. https://www.fastify.io/docs/latest/Reference/Plugins/
- **[S4]** VS Code extension API. _Contribution points and activation events_. https://code.visualstudio.com/api/references/contribution-points
- **[S5]** npm `commander` documentation. _Dynamic command loading_. https://github.com/tj/commander.js/blob/master/docs/advanced-topics.md
- **[S6]** Semantic Versioning 2.0.0. https://semver.org/

---

## Key findings

### Plugin architectures in Node.js CLIs

There are three dominant patterns for runtime capability discovery in Node.js CLI tools:

1. **Convention-based filesystem scanning** — Scan `src/modules/*/index.ts` (or a `plugins/` directory) and `require()` each file, collecting exported metadata. Used by Fastify and many CLI frameworks [S3].
2. **Package.json `contributes` field** — Declare capabilities in `package.json` under a custom key. VS Code uses `contributes.commands`, `contributes.views`, etc. [S4]. The CLI reads `package.json` at startup.
3. **Decorator / metadata reflection** — Use TypeScript decorators or `reflect-metadata` to annotate classes/functions with capability metadata. Requires `emitDecoratorMetadata` and a runtime reflection library [S2].

For Swarm CLI, pattern 1 (filesystem scanning) aligns perfectly with the existing DDD module structure. Each module already has an `index.ts` barrel. We can extend this with a `capabilities` export.

### Runtime registry pattern

```ts
// src/modules/Commands/index.ts
interface Capability {
    name: string;
    version: string;
    type: 'command' | 'adapter' | 'skill';
    description: string;
    entryPoint: string; // path to the implementing file
    constraints?: { os?: string[]; minNodeVersion?: string };
}

const registry = new Map<string, Capability>();

export function register_capability(capability: Capability): void {
    if (registry.has(capability.name)) {
        throw new Error(`Capability ${capability.name} already registered`);
    }
    registry.set(capability.name, capability);
}

export function find_capabilities(filter: Partial<Capability>): Capability[] {
    return [...registry.values()].filter((c) =>
        Object.entries(filter).every(([key, value]) => c[key as keyof Capability] === value)
    );
}

export function get_capability(name: string): Capability | undefined {
    return registry.get(name);
}
```

### Adapter auto-discovery

Currently adapters are hard-coded in `src/modules/Adapters/`. Auto-discovery would scan `src/modules/Adapters/useCases/` for files matching `*.ts`, import each, and register any exported `adapter` object that satisfies an `Adapter` interface.

```ts
// src/modules/Adapters/useCases/claude.ts
export const adapter: AgentAdapter = {
    name: 'claude',
    displayName: 'Claude Code',
    command: 'claude',
    buildArgs: (config, worktreePath) => ['--dir', worktreePath],
};
```

The `Adapters` module `index.ts` would import all files in `useCases/` and call `register_capability()` for each adapter.

### Semantic versioning for capabilities

If capabilities evolve, they should declare a SemVer version [S6]. The orchestrator can check compatibility:

```ts
function is_compatible(required: string, provided: string): boolean {
    const [reqMajor] = required.split('.');
    const [provMajor] = provided.split('.');
    return reqMajor === provMajor;
}
```

This is forward-looking but not needed for v1.

### Skill marketplace (future)

A `skills/` directory inside `.agents/` already exists for domain knowledge. A capability registry could treat skills as first-class capabilities:

```ts
interface SkillCapability extends Capability {
    type: 'skill';
    domain: string;
    loadBefore: string[]; // list of task types that should load this skill
}
```

When launching an agent, the orchestrator would inspect the task type and prepend relevant skill files to the agent's context.

---

## Relevant patterns and snippets

### Pattern: Glob-based module discovery

```ts
import { globSync } from 'glob';

function discover_capabilities(modulesDir: string): Capability[] {
    const indexFiles = globSync('*/index.ts', { cwd: modulesDir });
    const capabilities: Capability[] = [];
    for (const file of indexFiles) {
        const modulePath = join(modulesDir, file);
        const mod = await import(modulePath);
        if (mod.capabilities) {
            capabilities.push(...mod.capabilities);
        }
    }
    return capabilities;
}
```

Note: Dynamic `import()` in ESM returns a Promise. For synchronous startup, pre-generate a manifest at build time.

### Pattern: Build-time manifest generation

```ts
// scripts/generate-manifest.ts
const capabilities = await discover_capabilities('src/modules');
writeFileSync('src/generated/manifest.json', JSON.stringify(capabilities, null, 2));
```

The CLI imports the manifest synchronously at startup, avoiding async I/O during command dispatch.

---

## Comparison / tradeoffs

| Criterion               | FS Scanning | package.json | Decorators | Build-time Manifest |
| ----------------------- | ----------- | ------------ | ---------- | ------------------- |
| Zero build step         | ✅          | ✅           | ❌         | ❌                  |
| Type-safe               | ⚠️          | ❌           | ✅         | ✅                  |
| Startup performance     | Slow        | Fast         | Fast       | Fastest             |
| Dynamic (user plugins)  | ✅          | ✅           | ⚠️         | ❌                  |
| Complexity              | Low         | Low          | Medium     | Medium              |

---

## Applicability to this repo

Swarm CLI uses ESM with `NodeNext` resolution and has a strict no-codemod policy. Therefore:

- **Decorators are excluded** — they require `reflect-metadata` and complicate the build.
- **Build-time manifest is attractive** but conflicts with the current no-build-step philosophy (the CLI runs directly from `.ts` via `--experimental-strip-types`).
- **Filesystem scanning** is the pragmatic choice. We can limit scanning to the `Adapters` and `Commands` modules, which are small enough that startup overhead is negligible.
- **package.json `contributes`** is too static for runtime agent discovery but could be used for CLI-level feature flags.

The capability registry should be a new module `CapabilityRegistry` (or a service within `Commands`) that is populated at startup by scanning `src/modules/*/useCases/*.ts` for exported `capability` objects.

---

## Risks and uncertainties

- Dynamic `import()` of TypeScript files in ESM is brittle with `--experimental-strip-types`. Need to test that `await import('./foo.ts')` works correctly in Node 22+.
- Circular imports during discovery could crash the CLI. Need to ensure capability registration is side-effect-free (no immediate I/O, no cross-module imports during module init).
- User-installed plugins (e.g., from npm) would require `node_modules` scanning, which is slow and risky. Limit to built-in modules for now.

---

## Recommendation

1. **Introduce a `Capability` interface** and an in-memory registry in a new file `src/modules/Commands/services/registry.ts`.
2. **Refactor `Adapters`** so each adapter file exports a `capability` constant. The `Adapters/index.ts` imports all adapter files and registers them.
3. **Refactor `Commands`** so each command file can optionally export a `capability` constant with metadata (description, arguments, examples). The CLI help generator uses the registry instead of hard-coded strings.
4. **Keep it synchronous:** Do not use dynamic `import()` at runtime. Explicitly import each module in the barrel `index.ts` and register capabilities during module initialisation.
