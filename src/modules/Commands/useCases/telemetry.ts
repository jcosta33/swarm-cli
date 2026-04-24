#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { red, cyan, bold, dim, green, yellow } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

interface AgentInfo { status?: string; backend?: string; agent?: string; }

function isAgentInfo(value: unknown): value is AgentInfo {
    return typeof value === 'object' && value !== null;
}

export interface Metrics {
    activeCount: number;
    completedCount: number;
    crashedCount: number;
}

export function aggregateMetrics(state: Record<string, unknown>): Metrics {
    let activeCount = 0;
    let completedCount = 0;
    let crashedCount = 0;

    const slugs = Object.keys(state);
    for (const slug of slugs) {
        const info = state[slug];
        if (!isAgentInfo(info)) continue;
        if (info.status === 'running') activeCount++;
        else if (info.status === 'crashed') crashedCount++;
        else completedCount++;
    }

    return { activeCount, completedCount, crashedCount };
}

function run(): number {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    console.log(cyan(`\n📊 Swarm Telemetry Dashboard\n`));

    const statePath = join(repoRoot, '.agents', 'state.json');
    if (!existsSync(statePath)) {
        console.log(yellow(`No swarm telemetry data available. (.agents/state.json not found)`));
        return 0;
    }

    const state: Record<string, unknown> = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    const slugs = Object.keys(state);

    if (slugs.length === 0) {
        console.log(dim(`Swarm is currently idle and has no historical data.`));
        return 0;
    }

    const metrics = aggregateMetrics(state);

    console.log(bold(`Global Metrics:`));
    console.log(`  Total Agents Spawned: ${String(slugs.length)}`);
    console.log(`  Active Agents:        ${green(metrics.activeCount.toString())}`);
    console.log(`  Completed Tasks:      ${cyan(metrics.completedCount.toString())}`);
    console.log(`  Crashed/Failed:       ${metrics.crashedCount > 0 ? red(metrics.crashedCount.toString()) : green('0')}`);
    
    console.log(`\n${bold(`Recent Execution Logs:`)}`);
    
    slugs.slice(-5).forEach(slug => {
        const info = state[slug];
        if (!isAgentInfo(info)) return;
        const statusStr = info.status === 'running' ? green('[RUNNING]') :
                          info.status === 'crashed' ? red('[CRASHED]') : dim(`[${(info.status ?? 'unknown').toUpperCase()}]`);

        console.log(`  ${statusStr} ${cyan(slug)}`);
        console.log(dim(`    Backend: ${info.backend ?? 'unknown'}, Agent Type: ${info.agent ?? 'default'}`));
    });

    console.log('');
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
