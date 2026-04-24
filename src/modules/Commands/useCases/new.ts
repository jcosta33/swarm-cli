#!/usr/bin/env node

import {
    bold,
    cyan,
    dim,
    green,
    logger,
    parse_args,
    prompt_input,
    red,
    success,
    yellow,
} from '../../Terminal/index.ts';
import { load_config } from '../../Terminal/index.ts';
import { write_state } from '../../AgentState/index.ts';
import {
    branch_exists,
    get_repo_name,
    get_repo_root,
    worktree_create,
    worktree_list,
} from '../../Workspace/index.ts';
import {
    create_or_update_task_file,
    derive_names,
    next_duplicate_slug,
    to_slug,
} from '../../TaskManagement/index.ts';

import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { run_agent_launch } from './launch-agent.ts';

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        logger.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const config = load_config(repoRoot);
    const { flags, positional } = parse_args(process.argv.slice(2));

    let slug = positional[0];
    const title = positional.slice(1).join(' ');

    if (!slug) {
        return 1; // prompt_input is async, handled below
    }

    slug = to_slug(slug, config.slugMaxLen);

    const repoName = get_repo_name(repoRoot);

    // Check for duplicates and auto-increment if needed
    const existingWorktrees = worktree_list(repoRoot);
    const existingSlugs = new Set(existingWorktrees.map((w) => w.branch?.replace('agent/', '') ?? ''));
    if (existingSlugs.has(slug) && !config.reuseExistingByDefault) {
        slug = next_duplicate_slug(slug, existingSlugs);
    }

    const { branch, worktreePath: rawWorktreePath } = derive_names(
        slug,
        repoName,
        config as Record<string, string>
    );
    const worktreePath = resolve(repoRoot, rawWorktreePath);

    // Check for existing branch or worktree
    const existing = existingWorktrees.find((w) => w.branch === branch);
    if (existing) {
        logger.info(
            yellow(
                `Worktree for "${slug}" already exists at ${existing.path}`
            )
        );
        if (config.reuseExistingByDefault) {
            logger.info(dim('Reusing existing worktree (--reuseExistingByDefault is true).'));
        } else {
            logger.error(red('Aborting. Use a different slug or remove the existing worktree.'));
            return 1;
        }
    }

    if (branch_exists(branch, repoRoot) && !existing) {
        logger.info(yellow(`Branch ${branch} already exists but has no worktree. Attaching to it.`));
    }

    // Create worktree
    logger.info(cyan(`\nCreating worktree for ${bold(slug)}...`));
    try {
        worktree_create(worktreePath, branch, config.defaultBaseBranch ?? 'main', repoRoot);
        success(`Worktree created: ${worktreePath}`);
    } catch (_e: unknown) {
        const e = _e instanceof Error ? _e : new Error(String(_e));
        logger.error(red(`Failed to create worktree: ${e.message}`));
        return 1;
    }

    // Ensure .agents directories exist inside the worktree
    const agentsDir = join(worktreePath, '.agents');
    if (!existsSync(agentsDir)) mkdirSync(agentsDir, { recursive: true });
    const tasksDir = join(agentsDir, 'tasks');
    if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });

    // Create task file
    const taskFilePath = join(tasksDir, `${slug}.md`);
    const templateDir = join(repoRoot, '.agents', 'templates');

    const data: Record<string, string> = {
        title,
        slug,
        agent: config.defaultAgent ?? 'claude',
        branch,
        baseBranch: config.defaultBaseBranch ?? 'main',
        worktreePath,
        createdAt: new Date().toISOString(),
        status: 'active',
        taskFile: `.agents/tasks/${slug}.md`,
        type: (flags.get('type') as string | undefined) ?? '',
    };

    if (config.writeTaskTemplateOnCreate !== false) {
        create_or_update_task_file(taskFilePath, templateDir, data);
        success(`Task file created: ${taskFilePath}`);
    }

    // Write state
    write_state(repoRoot, slug, {
        status: 'created',
        backend: config.defaultTerminal ?? 'auto',
        agent: config.defaultAgent ?? 'claude',
    });

    logger.raw(
        cyan(`\nSandbox "${bold(slug)}" is ready.\n`) +
            dim(`  Branch:     ${branch}\n`) +
            dim(`  Worktree:   ${worktreePath}\n`) +
            dim(`  Task file:  ${taskFilePath}\n`)
    );

    // Optionally launch agent
    const shouldLaunch = flags.get('launch') === true || flags.get('launch') === 'true';
    if (shouldLaunch) {
        return run_agent_launch({ repoRoot, slug, worktreePath, title });
    }

    logger.info(
        cyan(`Run ${green(`swarm open ${slug}`)} to reopen it, or add --launch to auto-start the agent.`)
    );
    return 0;
}

async function main(): Promise<number> {
    const { positional } = parse_args(process.argv.slice(2));
    let slug = positional[0];
    let title = positional.slice(1).join(' ');

    if (!slug) {
        slug = await prompt_input('Task slug (e.g. billing-refactor): ');
    }
    if (!slug) {
        logger.error(red('Slug is required.'));
        return 1;
    }
    if (!title) {
        title = await prompt_input('Task title: ', slug);
    }

    // Re-assemble argv so the sync run() can parse them normally
    const extraArgs = [];
    if (title && title !== slug) extraArgs.push(title);
    process.argv = [process.argv[0], process.argv[1], slug, ...extraArgs, ...process.argv.slice(2).filter((a) => a !== slug && a !== title)];

    return run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    void main().then((code) => {
        process.exitCode = code;
    });
}
