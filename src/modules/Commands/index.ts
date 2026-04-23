export * from './services/registry.ts';

import { register_capability } from './services/registry.ts';
import { adapter_capabilities } from '../Adapters/index.ts';

for (const cap of adapter_capabilities) {
    register_capability(cap);
}

// Core commands
register_capability({ name: 'new', version: '1.0.0', type: 'command', description: 'Create a new isolated sandbox task', entry_point: './useCases/new.ts' });
register_capability({ name: 'open', version: '1.0.0', type: 'command', description: 'Reopen an existing sandbox', entry_point: './useCases/open.ts' });
register_capability({ name: 'list', version: '1.0.0', type: 'command', description: 'List active sandboxes', entry_point: './useCases/list.ts' });
register_capability({ name: 'show', version: '1.0.0', type: 'command', description: 'Show detailed metadata for a sandbox', entry_point: './useCases/show.ts' });
register_capability({ name: 'remove', version: '1.0.0', type: 'command', description: 'Forcefully remove a sandbox', entry_point: './useCases/remove.ts' });
register_capability({ name: 'prune', version: '1.0.0', type: 'command', description: 'Clean up merged or orphaned sandboxes', entry_point: './useCases/prune.ts' });
register_capability({ name: 'validate', version: '1.0.0', type: 'command', description: 'Run configured linters and typechecks', entry_point: './useCases/validate.ts' });
register_capability({ name: 'test', version: '1.0.0', type: 'command', description: 'Run the test runner', entry_point: './useCases/test.ts' });
register_capability({ name: 'init', version: '1.0.0', type: 'command', description: 'Setup Swarm in the current repository', entry_point: './useCases/init.ts' });
register_capability({ name: 'lock', version: '1.0.0', type: 'command', description: 'Advisory file locking for parallel agents', entry_point: './useCases/lock.ts' });
register_capability({ name: 'merge', version: '1.0.0', type: 'command', description: 'Merge a branch with conflict detection', entry_point: './useCases/merge.ts' });
register_capability({ name: 'capabilities', version: '1.0.0', type: 'command', description: 'List registered capabilities', entry_point: './useCases/capabilities.ts' });
register_capability({ name: 'help', version: '1.0.0', type: 'command', description: 'Show command reference', entry_point: './useCases/help.ts' });
register_capability({ name: 'dashboard', version: '1.0.0', type: 'command', description: 'Launch interactive TUI dashboard', entry_point: './useCases/dashboard.ts' });

export * from './useCases/arch.ts';
export * from './useCases/audit-sec.ts';
export * from './useCases/chaos.ts';
export * from './useCases/chat.ts';
export * from './useCases/compress.ts';
export * from './useCases/context.ts';
export * from './useCases/daemon.ts';
export * from './useCases/dead-code.ts';
export * from './useCases/deps.ts';
export * from './useCases/docs.ts';
export * from './useCases/epic.ts';
export * from './useCases/find.ts';
export * from './useCases/fuzz.ts';
export * from './useCases/graph.ts';
export * from './useCases/heal.ts';
export * from './useCases/health.ts';

export * from './useCases/init.ts';
export * from './useCases/knowledge.ts';
export * from './useCases/logs.ts';
export * from './useCases/memory.ts';
export * from './useCases/migrate.ts';
export * from './useCases/mock.ts';
export * from './useCases/pr.ts';
export * from './useCases/profile.ts';
export * from './useCases/refactor.ts';
export * from './useCases/references.ts';
export * from './useCases/release.ts';
export * from './useCases/repro.ts';
export * from './useCases/review.ts';
export * from './useCases/screenshot.ts';
export * from './useCases/telemetry.ts';
export * from './useCases/test-radius.ts';
export * from './useCases/test.ts';
export * from './useCases/triage.ts';
export * from './useCases/validate.ts';
export * from './useCases/visual.ts';
