#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { red, cyan, bold, dim, green, yellow } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

const newCommandPath = join(dirname(fileURLToPath(import.meta.url)), 'new.ts');

function run(): number {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    console.log(cyan(`\nChecking branch health...`));

    // First check if typecheck passes
    console.log(dim('Running pnpm typecheck...'));
    const typecheck = spawnSync('pnpm', ['typecheck'], { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });

    if (typecheck.status === 0) {
        console.log(green(`✓ Branch is healthy. No healing required.`));
        return 0;
    }

    console.log(red(`✗ Branch is broken (typecheck failed)!`));
    console.log(dim(`Triggering Self-Healing Protocol...`));

    const slug = `heal-${String(Date.now())}`;
    console.log(yellow(`Spawning emergency hotfix agent: ${bold(slug)}`));

    const res = spawnSync(process.execPath, ['--experimental-strip-types', newCommandPath, slug, '--title', 'Emergency Typecheck Fix', '--type', 'fix'], {
        cwd: repoRoot,
        stdio: 'inherit'
    });

    if (res.status === 0) {
        console.log(green(`\n✓ Heal agent spawned successfully.`));
        console.log(dim(`The agent should now fix the type errors and run agents:pr`));
        return 0;
    } else {
        console.log(red(`\n✗ Failed to spawn heal agent.`));
        return 1;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
