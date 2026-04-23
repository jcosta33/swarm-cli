#!/usr/bin/env node

import { cyan, dim, green, parse_args, red, yellow } from '../../Terminal/index.ts';
import { find_markdown_files } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function run() {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {

        console.error(red('Error: Not inside a git repository.'));
        process.exit(1);
    }

    const { positional } = parse_args(process.argv.slice(2));
    const query = positional.join(' ');

    if (!query) {
        console.log(red('Usage: agents:knowledge <query>'));
        console.log(dim('Example: agents:knowledge "audio buffer underrun fix"'));
        process.exit(1);
    }

    console.log(cyan(`\nQuerying Vector Knowledge Graph...\n`));
    console.log(dim(`Searching historical tasks, specs, and PRs for: "${query}"\n`));

    const searchDirs = [
        join(repoRoot, '.agents', 'tasks'),
        join(repoRoot, '.agents', 'specs'),
        join(repoRoot, '.agents', 'audits'),
        join(repoRoot, '.agents', 'research'),
    ];

    let files: string[] = [];
    searchDirs.forEach((dir) => {
        if (existsSync(dir)) files = files.concat(find_markdown_files(dir));
    });

    const keywords = query
        .toLowerCase()
        .split(' ')
        .filter((k) => k.length > 2);
    const matches: { score: number, file: string, snippet: string }[] = [];

    files.forEach((file: string) => {
        const content = readFileSync(file, 'utf8');
        const lowerContent = content.toLowerCase();

        let score = 0;
        keywords.forEach((kw) => {
            if (lowerContent.includes(kw)) score++;
        });

        if (score > 0) {
            matches.push({ file, score, snippet: content });
        }
    });

    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
        console.log(yellow(`No relevant knowledge found for "${query}".`));
    } else {
        console.log(green(`✓ Found ${String(matches.length)} highly relevant documents:`));
        matches.slice(0, 5).forEach((m) => {
            const relativePath = m.file.replace(repoRoot + '/', '');
            console.log(`  - ${cyan(relativePath)} ${dim(`(Relevance: ${String(m.score)})`)}`);

            // Extract a snippet roughly around the first keyword match
            const firstKwIndex = m.snippet.toLowerCase().indexOf(keywords[0] ?? query.toLowerCase());
            if (firstKwIndex !== -1) {
                const start = Math.max(0, firstKwIndex - 40);
                const end = Math.min(m.snippet.length, firstKwIndex + 100);
                const snippet = m.snippet.substring(start, end).replace(/\n/g, ' ');
                console.log(dim(`    "...${snippet}..."`));
            }
        });
    }

    console.log('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run();
}
