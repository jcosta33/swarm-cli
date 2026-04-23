#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { parse_args, red, green, dim } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import { validate_dag, topological_sort } from '../../TaskManagement/useCases/dag.ts';

interface TaskNode {
    id: string;
    description: string;
    dependencies: string[];
}

function load_task_graph(path: string): TaskNode[] {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Invalid task graph: expected object');
    }
    const obj = raw as Record<string, unknown>;
    if (!obj.tasks || !Array.isArray(obj.tasks)) {
        throw new Error('Invalid task graph: expected { tasks: [...] }');
    }
    return obj.tasks as TaskNode[];
}

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { flags, positional } = parse_args(process.argv.slice(2));
    const graphFile = positional[0];
    const dryRun = flags.get('dry-run') === true;
    const maxTasksRaw = flags.get('max-tasks');
    const maxTasks = parseInt(typeof maxTasksRaw === 'string' ? maxTasksRaw : '5', 10);

    if (!graphFile) {
        console.error(red('Usage: swarm decompose <task-graph.json> [--dry-run] [--max-tasks N]'));
        return 1;
    }

    const fullPath = graphFile.startsWith('/') ? graphFile : `${repoRoot}/${graphFile}`;
    if (!existsSync(fullPath)) {
        console.error(red(`File not found: ${graphFile}`));
        return 1;
    }

    let tasks: TaskNode[];
    try {
        tasks = load_task_graph(fullPath);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(red(`Failed to load task graph: ${message}`));
        return 1;
    }

    if (tasks.length > maxTasks) {
        console.log(dim(`Truncating to ${String(maxTasks)} tasks (found ${String(tasks.length)}).`));
        tasks = tasks.slice(0, maxTasks);
    }

    const validation = validate_dag(tasks);
    if (!validation.valid) {
        console.error(red('Invalid task graph: cycle or missing dependency detected.'));
        if (validation.cycle) {
            console.error(red(`Cycle: ${validation.cycle.join(' -> ')}`));
        }
        return 1;
    }

    const sorted = topological_sort(tasks);

    console.log(green('Task DAG (topological order):\n'));
    for (const task of sorted) {
        const depStr = task.dependencies.length > 0 ? ` (deps: ${task.dependencies.join(', ')})` : '';
        console.log(`  ${task.id}${depStr}`);
        console.log(`    ${task.description}`);
    }

    if (dryRun) {
        console.log(dim('\nDry run complete. No worktrees created.'));
        return 0;
    }

    console.log(dim('\nCreating worktrees and launching agents is not yet implemented.'));
    console.log(dim('Use --dry-run to preview without executing.'));
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
