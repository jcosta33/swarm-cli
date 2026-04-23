#!/usr/bin/env node

import { bold, cyan, dim, green, parse_args, red } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

function run() {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {

        console.error(red('Error: Not inside a git repository.'));
        process.exit(1);
    }

    const { positional } = parse_args(process.argv.slice(2));
    const epicFile = positional[0];

    if (!epicFile) {
        console.log(red('Usage: agents:epic <path/to/epic.md>'));
        console.log(dim('The markdown file should contain a markdown list of tasks.'));
        process.exit(1);
    }

    const fullPath = join(repoRoot, epicFile);
    if (!existsSync(fullPath)) {
        console.error(red(`File not found: ${epicFile}`));
        process.exit(1);
    }

    const content = readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const tasks = [];
    const epicSlug = basename(epicFile, '.md');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const taskName = trimmed.slice(2).trim();
            if (taskName) tasks.push(taskName);
        }
    }

    console.log(cyan(`\nDecomposing Epic: ${bold(epicSlug)}...`));

    if (tasks.length === 0) {
        console.log(dim('  (No markdown list items found in epic file)'));
        process.exit(0);
    }

    const tasksDir = join(repoRoot, '.agents', 'tasks');
    if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });

    tasks.forEach((task, i) => {
        const taskSlug = `${epicSlug}-task-${(i + 1).toString()}`;
        const taskPath = join(tasksDir, `${taskSlug}.md`);

        const template = `# ${task}

## Metadata

- Slug: ${taskSlug}
- Parent: ${epicSlug}
- Status: pending
- Created: ${new Date().toISOString()}

---

## Objective

${task} (Derived from Epic ${epicSlug})

## Progress checklist

- [ ] Complete implementation
- [ ] Pass agents:validate

## Next steps

- Read the parent epic for context.
`;
        writeFileSync(taskPath, template, 'utf8');
        console.log(green(`  ✓ Created task: `) + dim(taskSlug));
    });

    console.log('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run();
}
