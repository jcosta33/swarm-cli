import {
    intro,
    outro,
    log,
    spinner,
    confirm,
    isCancel,
    cancel,
} from '@clack/prompts';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import { basename } from 'path';
import color from 'picocolors';

const KNOWN_AGENTS = {
    aider: {
        install: 'pip install aider-chat',
        run: 'aider',
        desc: 'Interactive command-line pair-programming AI.',
    },
    cline: {
        install: 'npm install -g @cline/cli',
        run: 'cline',
        desc: 'Autonomous engineering CLI agent.',
    },
    'swe-agent': {
        install: 'pip install swe-agent',
        run: 'swe-agent',
        desc: 'Headless agent for SWE tasks.',
    },
};

function get_git_info() {
    try {
        const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
        const repoName = repo ? basename(repo) : 'Standalone';
        const branch =
            spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
        const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim().length > 0;
        return { repoName, branch, dirty, worktree: process.cwd() };
    } catch {
        return { repoName: basename(process.cwd()), branch: 'N/A', dirty: false, worktree: process.cwd() };
    }
}

function extract_model_arg(args: string[]) {
    const modelIdx = args.findIndex((a) => a === '--model' || a === '-m');
    if (modelIdx !== -1 && args.length > modelIdx + 1) {
        return args[modelIdx + 1];
    }
    return 'default';
}

function print_agent_banner(agentName: string, args: string[]) {
    const info = get_git_info();
    const model = extract_model_arg(args);

    // Pick a stable color based on worktree path
    const colorsList = ['cyan', 'magenta', 'yellow', 'blue', 'green'] as const;
    const hash = info.worktree.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const themeColor = colorsList[hash % colorsList.length];
    const c = (color as unknown as Record<string, (text: string) => string>)[themeColor];

    // Set Terminal Title
    process.stdout.write(`\x1b]0;[Swarm] ${info.repoName} | ${info.branch}\x07`);

    console.clear();
    console.log(c('╔' + '━'.repeat(78) + '╗'));
    console.log(
        c('┃') + ' ' + color.bold(color.white(`🤖 SWARM EVOLUTION : ${(agentName).toUpperCase()}`)).padEnd(87) + c('┃')
    );
    console.log(c('┣' + '━'.repeat(78) + '┫'));

    const labels = [
        { label: 'Repo', val: color.white(info.repoName) },
        {
            label: 'Branch',
            val: color.white(info.branch) + (info.dirty ? color.red(' (dirty)') : color.green(' (clean)')),
        },
        { label: 'Worktree', val: color.dim(info.worktree.replace(os.homedir(), '~')) },
        { label: 'Model', val: color.magenta(model) },
        { label: 'Status', val: color.green('● ACTIVE') },
    ];

    for (const row of labels) {
        const text = `  ${c('■')} ${color.dim(row.label.padEnd(10))} ${row.val}`;
        console.log(c('┃') + text.padEnd(99) + c('┃'));
    }

    console.log(c('╚' + '━'.repeat(78) + '╝'));
    console.log('');
}

async function handle_unknown_command(cmd: string): Promise<number> {
    if (Object.hasOwn(KNOWN_AGENTS, cmd)) {
        const agent = KNOWN_AGENTS[cmd as keyof typeof KNOWN_AGENTS];

        const isInstalled =
            spawnSync('which', [agent.run]).status === 0 || spawnSync('where', [agent.run]).status === 0;

        if (!isInstalled) {
            intro(color.bgCyan(color.black(' Swarm CLI ')));
            note(
                color.yellow(`Command '${cmd}' is not a built-in tool, but it matches a known agent CLI.`),
                'Unrecognized Command'
            );
            log.warn(`The agent '${cmd}' (${agent.desc}) is not installed on your system.`);

            const shouldInstall = await confirm({
                message: `Would you like Swarm CLI to install it for you using \`${agent.install}\`?`,
                initialValue: true,
            });

            if (isCancel(shouldInstall)) {
                cancel('Setup cancelled.');
                return 0;
            }

            if (shouldInstall) {
                const s = spinner();
                s.start(`Installing ${cmd}...`);
                const installParts = agent.install.split(' ');
                const installRes = spawnSync(installParts[0], installParts.slice(1), { shell: false, stdio: 'pipe' });

                if (installRes.status !== 0) {
                    s.stop(`Failed to install ${cmd}.`);
                    log.error(installRes.stderr.toString());
                    log.message(`Try installing manually: ${color.cyan(agent.install)}`);
                    return 1;
                }
                s.stop(color.green(`Successfully installed ${cmd}!`));
            } else {
                log.message(`You can install it manually via: ${color.cyan(agent.install)}`);
                return 0;
            }
            outro();
        }

        // Massive, un-missable beautiful header
        print_agent_banner(cmd, process.argv.slice(3));

        spawnSync(agent.run, process.argv.slice(3), { stdio: 'inherit', shell: false });

        console.log('');
        outro(color.green(`Agent '${cmd}' execution completed.`));
        return 0;
    }

    intro(color.bgCyan(color.black(' Swarm CLI ')));
    log.error(color.red(`Unknown command: ${cmd}`));
    log.message('Use ' + color.cyan('swarm --help') + ' to see available commands.');
    log.info(
        color.dim(`If '${cmd}' is a project-specific script, add it to your swarm.config.json under "commands".`)
    );
    outro();
    return 1;
}

function note(message: string, title: string) {
    log.message(`${color.cyan('│')} ${color.bold(title)}\n${color.cyan('│')} ${message}`);
}

function print_help() {
    intro(color.bgCyan(color.black(' Swarm CLI ')));
    log.message(`
  Usage: swarm <command> [args]

  Core Subcommands:
    init              Setup Swarm in the current repository
    new <slug>        Create a new isolated sandbox task
    open <slug>       Reopen an existing sandbox
    list              List active sandboxes
    show <slug>       Show detailed metadata for a sandbox
    task <slug>       Append human feedback to the task file
    remove <slug>     Forcefully remove a sandbox and its worktree
    prune             Clean up merged or orphaned sandboxes
    validate          Run configured linters and typechecks
    test              Run the test runner
    test-radius <f>   Run impacted specs for a modified file
    ui                Launch interactive dashboard
    health            Run pre-flight environment checks

  Context & Analysis:
    compress, graph, references, docs, complexity, audit-sec
    dead-code, format, logs, context, memory, knowledge

  Autonomous Lifecycles:
    epic, triage, arch, review, chat, repro, find, mock, daemon, heal

  Production Scale:
    refactor, deps, migrate, fuzz, chaos, visual, telemetry
    profile, release, screenshot, pr

  Supported Agent Runtimes (Auto-install):
    aider, cline, swe-agent
`);
    outro();
}

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
        print_help();
        return 0;
    }

    const cmd = argv[0];

    // Sanitize command to prevent path traversal
    if (!/^[a-z0-9-]+$/.test(cmd)) {
        console.error(color.red(`Invalid command: ${cmd}`));
        return 1;
    }

    const commandPath = new URL(
        `./modules/Commands/useCases/${cmd}.ts`,
        import.meta.url
    );

    if (existsSync(commandPath.pathname)) {
        const res = spawnSync(
            process.execPath,
            ['--experimental-strip-types', commandPath.pathname, ...argv.slice(1)],
            {
                stdio: 'inherit',
                cwd: process.cwd(),
            }
        );
        // Forward signal exit codes correctly
        if (res.signal) {
            process.kill(process.pid, res.signal);
            return 1;
        }
        return res.status ?? 1;
    }

    return handle_unknown_command(cmd);
}

void main().then((code) => {
    process.exitCode = code;
});
