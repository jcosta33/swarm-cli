#!/usr/bin/env node

import { cyan, dim, green, red, yellow } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface OutdatedInfo {
    current?: string;
    latest?: string;
}

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    console.log(cyan('\nChecking for outdated dependencies...\n'));

    const pkgPath = join(repoRoot, 'package.json');
    if (!existsSync(pkgPath)) {
        console.error(red('No package.json found.'));
        return 1;
    }

    const res = spawnSync(
        'npm',
        ['outdated', '--json'],
        { cwd: repoRoot, encoding: 'utf8' }
    );
    let outdated: Record<string, OutdatedInfo | undefined> = {};

    try {
        if (res.stdout) outdated = JSON.parse(res.stdout) as Record<string, OutdatedInfo>;
    } catch (_e: unknown) {
        console.error(
            yellow(
                'Failed to parse npm outdated output. Make sure dependencies are installed.'
            )
        );
        return 1;
    }

    const packages = Object.keys(outdated);
    if (packages.length === 0) {
        console.log(green('✓ All dependencies are up to date.'));
        return 0;
    }

    console.log(yellow(`Found ${packages.length.toString()} outdated packages.`));

    const tasksDir = join(repoRoot, '.agents', 'tasks');
    if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });

    const epicSlug = `deps-upgrade-${Date.now().toString()}`;

    packages.forEach((pkg) => {
        const info = outdated[pkg];
        if (!info) return;
        const taskSlug = `upgrade-${pkg.replace(/[^a-zA-Z0-9-]/g, '-')}-${info.latest ?? 'unknown'}`;
        const taskPath = join(tasksDir, `${taskSlug}.md`);

        const template = `# Upgrade ${pkg}

## Metadata

- Slug: ${taskSlug}
- Parent: ${epicSlug}
- Type: chore

---

## Objective

Intelligently upgrade \`${pkg}\` from \`${info.current ?? 'unknown'}\` to \`${info.latest ?? 'unknown'}\`.

## Plan
1. Use \`agents:web\` or curl to fetch the GitHub release notes for \`${pkg}\` version \`${info.latest ?? 'unknown'}\`.
2. Analyze breaking changes.
3. Update \`package.json\` and run \`pnpm install\`.
4. Apply necessary API migrations in \`src/\`.
5. Run \`pnpm test\` to verify.

## Progress checklist

- [ ] Release notes analyzed
- [ ] Dependencies updated
- [ ] Code migrated
- [ ] Tests passing

`;
        writeFileSync(taskPath, template, 'utf8');
        console.log(green('  ✓ Created task: ') + dim(taskSlug));
    });

    console.log(cyan(`\nDelegated to ${packages.length.toString()} separate upgrade tasks.`));
    console.log('');
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
