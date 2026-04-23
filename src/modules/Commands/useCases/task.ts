#!/usr/bin/env node

import {
    green,
    parse_args,
    prompt_input,
    red,
} from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

import { appendFileSync, existsSync } from 'fs';
import { join } from 'path';

async function run() {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        process.exit(1);
    }

    const { positional } = parse_args(process.argv.slice(2));
    const slug = positional[0];

    if (!slug) {
        console.log(red('Usage: swarm task <slug>'));
        process.exit(1);
    }

    const taskFile = join(repoRoot, '.agents', 'tasks', `${slug}.md`);
    if (!existsSync(taskFile)) {
        console.error(red(`Task file not found: ${taskFile}`));
        process.exit(1);
    }

    const note = await prompt_input('Human note / feedback to append: ');
    if (!note) {
        console.log(red('No note provided. Aborting.'));
        process.exit(1);
    }

    const timestamp = new Date().toISOString();
    const entry = `\n\n## Human Feedback (${timestamp})\n${note}\n`;
    appendFileSync(taskFile, entry, 'utf8');

    console.log(green(`✓ Note appended to ${slug}.md`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    void run();
}
