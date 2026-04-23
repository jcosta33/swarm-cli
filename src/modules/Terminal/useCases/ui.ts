#!/usr/bin/env node
import {
    bold,
    cyan,
    dim,
    green,
    red,
    yellow,
} from './colors.ts';
import { is_process_running, read_state } from '../../AgentState/index.ts';
import { get_repo_root, worktree_list } from '../../Workspace/index.ts';

const clear_screen = () => process.stdout.write('\x1Bc');
const hide_cursor = () => process.stdout.write('\x1B[?25l');
const show_cursor = () => process.stdout.write('\x1B[?25h');
const move_cursor_to_top = () => process.stdout.write('\x1B[H');

function render_dashboard(repoRoot: string) {
    const sandboxes = worktree_list(repoRoot);
    const globalState = read_state(repoRoot);

    move_cursor_to_top();
    console.log(
        `\n  ${bold(cyan('👾 Swarm Command Center'))}  ${dim(`(Updated: ${new Date().toLocaleTimeString()})`)}`
    );
    console.log(`  ${'─'.repeat(60)}`);

    if (sandboxes.length === 0) {
        console.log(`  ${dim('No active agents in the swarm.')}`);
    }

    sandboxes.forEach((s) => {
        const slug = s.branch?.replace('agent/', '') ?? 'unknown';
        const state = globalState[slug] ?? {};
        let statusTag = dim('[IDLE]');

        if (state.status === 'running') {
            if (state.pid) {
                const alive = is_process_running(state.pid);
                statusTag = alive ? green('[RUNNING]') : red('[CRASHED]');
            } else {
                statusTag = green('[LAUNCHED]');
            }
        } else if (state.status) {
            statusTag = yellow(`[${state.status.toUpperCase()}]`);
        }

        const backend = state.backend
            ? dim(` via ${state.backend}`)
            : '';
        const pid = state.pid ? dim(` (PID: ${state.pid.toString()})`) : '';

        console.log(
            `  ${statusTag.padEnd(20)} ${bold(slug)} ${pid}${backend}`
        );
        console.log(`  ${dim('↳')} Branch: ${s.branch ?? 'unknown'}  Path: ${s.path}`);
    });

    console.log(`\n  ${'─'.repeat(60)}`);
    console.log(`  ${dim('Press Ctrl+C to exit.')}`);
}

function run() {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        process.exit(1);
    }

    hide_cursor();
    clear_screen();

    render_dashboard(repoRoot);

    const interval = setInterval(() => {
        render_dashboard(repoRoot);
    }, 2000);

    process.on('SIGINT', () => {
        clearInterval(interval);
        show_cursor();
        console.log('');
        process.exit(0);
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run();
}
