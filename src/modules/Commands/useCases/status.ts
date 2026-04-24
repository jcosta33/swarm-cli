#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { red, cyan, bold, dim, green, yellow, parse_args } from '../../Terminal/index.ts';
import { get_repo_root, worktree_list } from '../../Workspace/index.ts';
import { read_state, is_process_running } from '../../AgentState/index.ts';
import { query_sessions } from '../../AgentState/index.ts';

function format_duration(startedAt: string, finishedAt?: string | null): string {
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const ms = end.getTime() - start.getTime();
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
        return `${String(minutes)}m ${String(seconds)}s`;
    }
    return `${String(seconds)}s`;
}

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { positional } = parse_args(process.argv.slice(2));
    const slug = positional[0];

    if (!slug) {
        console.log(red('Usage: swarm status <slug>'));
        return 1;
    }

    // Gather state
    const state = read_state(repoRoot)[slug];
    const worktrees = worktree_list(repoRoot);
    const worktree = worktrees.find((w) => w.branch === `agent/${slug}`);
    const taskFile = worktree ? join(worktree.path, '.agents', 'tasks', `${slug}.md`) : null;

    // Gather telemetry
    let sessions: ReturnType<typeof query_sessions> = [];
    try {
        sessions = query_sessions(repoRoot, 10).filter((s) => s.slug === slug);
    } catch (_e: unknown) {
        // Telemetry DB may not exist yet
    }

    console.log(cyan(`\n📊 Status: ${bold(slug)}\n`));

    // State section
    if (state) {
        const statusColor = state.status === 'running' ? green : state.status === 'error' ? red : yellow;
        console.log(`${bold('State:')} ${statusColor(state.status ?? 'unknown')}`);
        if (state.agent) console.log(`${bold('Agent:')} ${state.agent}`);
        if (state.pid) {
            const running = is_process_running(state.pid);
            console.log(`${bold('PID:')} ${String(state.pid)} ${running ? green('(running)') : dim('(not running)')}`);
        }
        if (state.lastUpdated) {
            const lastUpdated = new Date(state.lastUpdated);
            console.log(`${bold('Last updated:')} ${lastUpdated.toLocaleString()}`);
        }
        if (state.exitCode !== undefined && state.exitCode !== null) {
            console.log(`${bold('Exit code:')} ${state.exitCode === 0 ? green('0') : red(String(state.exitCode))}`);
        }
        if (state.error) {
            console.log(`${bold('Error:')} ${red(state.error)}`);
        }
    } else {
        console.log(dim('No state record found.'));
    }

    // Worktree section
    console.log('');
    if (worktree) {
        console.log(`${bold('Worktree:')} ${worktree.path}`);
        console.log(`${bold('Branch:')} ${worktree.branch ?? 'unknown'}`);

        const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: worktree.path, encoding: 'utf8' }).stdout.trim();
        if (dirty.length > 0) {
            const count = dirty.split('\n').length;
            console.log(`${bold('Working tree:')} ${yellow(`${String(count)} uncommitted change${count !== 1 ? 's' : ''}`)}`);
        } else {
            console.log(`${bold('Working tree:')} ${green('clean')}`);
        }
    } else {
        console.log(dim('No worktree found for this slug.'));
    }

    // Task file section
    if (taskFile && existsSync(taskFile)) {
        const content = readFileSync(taskFile, 'utf8');
        const objectiveMatch = /## Objective\n+([^#]+)/.exec(content);
        const objective = objectiveMatch ? objectiveMatch[1].trim().split('\n')[0] : null;
        if (objective) {
            console.log(`\n${bold('Objective:')} ${dim(objective)}`);
        }
    }

    // Telemetry section
    if (sessions.length > 0) {
        console.log(`\n${bold('Recent sessions:')}`);
        for (const session of sessions.slice(0, 5)) {
            const duration = format_duration(session.started_at, session.finished_at);
            const agent = session.agent;
            const status = session.exit_code === null
                ? yellow('running')
                : session.exit_code === 0
                    ? green('success')
                    : red(`failed (${String(session.exit_code)})`);
            console.log(`  ${dim(session.started_at)} | ${agent.padEnd(10)} | ${duration.padStart(6)} | ${status}`);
        }
    }

    console.log('');
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
