#!/usr/bin/env node

import { watch } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { red, cyan, dim, yellow } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

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

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let activeProcess: ReturnType<typeof spawn> | null = null;

    watch(join(repoRoot, 'src'), { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.ts') && !filename.endsWith('.tsx')) return;
        if (filename.endsWith('.spec.ts') || filename.endsWith('.spec.tsx')) return;

        if (timeout) clearTimeout(timeout);
        
        // Debounce saves
        timeout = setTimeout(() => {
            console.log(yellow(`\n[Daemon] Detected change in ${filename}`));
            
            if (activeProcess) {
                console.log(dim(`Killing previous test run...`));
                activeProcess.kill();
            }

            console.log(cyan(`Running blast radius check...`));
            activeProcess = spawn('pnpm', ['agents:test-radius', join('src', filename)], { 
                cwd: repoRoot,
                stdio: 'inherit'
            });

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
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
