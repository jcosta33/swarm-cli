#!/usr/bin/env node

import { watch } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { red, cyan, dim, yellow } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

const TEST_RADIUS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'test-radius.ts');

function run(): number {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    console.log(cyan(`\nStarting Swarm Daemon (Background Watcher)...\n`));
    console.log(dim(`Watching src/ for changes to trigger automated test-radius...`));
    console.log(dim('Press Ctrl+C to stop.\n'));

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let activeProcess: ReturnType<typeof spawn> | null = null;

    const watcher = watch(join(repoRoot, 'src'), { recursive: true }, (_eventType, filename) => {
        if (!filename) {
            return;
        }
        if (!filename.endsWith('.ts') && !filename.endsWith('.tsx')) {
            return;
        }
        if (filename.endsWith('.spec.ts') || filename.endsWith('.spec.tsx')) {
            return;
        }

        if (timeout) {
            clearTimeout(timeout);
        }

        // Debounce saves
        timeout = setTimeout(() => {
            console.log(yellow(`\n[Daemon] Detected change in ${filename}`));

            if (activeProcess) {
                console.log(dim(`Killing previous test run...`));
                activeProcess.kill();
            }

            console.log(cyan(`Running blast radius check...`));
            activeProcess = spawn(
                process.execPath,
                ['--experimental-strip-types', TEST_RADIUS_PATH, join('src', filename)],
                { cwd: repoRoot, stdio: 'inherit' }
            );

            activeProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(dim(`[Daemon] Radius check passed.`));
                } else if (code !== null) {
                    console.log(red(`[Daemon] Radius check FAILED.`));
                }
                activeProcess = null;
            });
        }, 1000);
    });

    const shutdown = () => {
        watcher.close();
        if (timeout) {
            clearTimeout(timeout);
        }
        if (activeProcess) {
            activeProcess.kill();
        }
        console.log(dim('\n[Daemon] Stopped.'));
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
